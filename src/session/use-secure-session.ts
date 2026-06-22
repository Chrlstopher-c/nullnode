import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { deriveSession, open, seal } from '../crypto/encryption'
import { PeerLink } from '../transport/peer-link'
import { encodeAddress } from '../identity/address'
import { appendMessage, loadHistory, messagesFor, type History } from './history'
import { newRuntime, newView, type PeerRuntime, type PeerView } from './peer-session'
import type { ConnectionPhase, Identity, SecureMessage } from '../shared/types'

type Sdp = RTCSessionDescriptionInit

function newId(): string {
  return Math.random().toString(36).slice(2, 10)
}

export interface SecureSession {
  phaseFor: (peer: string) => ConnectionPhase
  fingerprintFor: (peer: string) => string
  typingFor: (peer: string) => boolean
  isSecure: (peer: string) => boolean
  connectedPeers: string[]
  aggregatePhase: ConnectionPhase
  history: History
  messagesFor: (peer: string) => SecureMessage[]
  hydrateHistory: () => void
  appendExternal: (peer: string, msg: SecureMessage) => void
  beginOffer: (peerPub: Uint8Array) => Promise<Sdp>
  respondToOffer: (peerPub: Uint8Array, offer: Sdp) => Promise<Sdp>
  applyAnswer: (peerPub: Uint8Array, answer: Sdp) => Promise<void>
  sendMessage: (peer: string, body: string) => void
  notifyTyping: (peer: string) => void
}

const TYPING_THROTTLE_MS = 2000
const TYPING_CLEAR_MS = 3500

/** Ordre croissant d'avancement : aggregatePhase retient la plus avancée parmi les vues. */
const PHASE_RANK: Record<ConnectionPhase, number> = {
  idle: 0,
  'generating-keys': 1,
  lost: 2,
  'awaiting-peer': 3,
  handshaking: 4,
  secure: 5,
}

/** Format chiffré transitant sur le DataChannel : { id, body }. L'ID est partagé entre les
 * deux pairs (préalable indispensable à épingler/éditer/supprimer/réagir, qui désignent un
 * message commun). Les DM relay portent déjà leur ID dans l'enveloppe. */
interface WirePayload {
  id: string
  body: string
}

function encodeWire(id: string, body: string): string {
  return JSON.stringify({ id, body })
}

/** Décode le plaintext déchiffré ; tolère un ancien message en texte brut (ID local de repli). */
function decodeWire(plain: string): WirePayload {
  try {
    const obj: unknown = JSON.parse(plain)
    if (obj && typeof obj === 'object' && 'id' in obj && 'body' in obj) {
      const w = obj as Record<string, unknown> // narrowing : champs vérifiés juste après.
      if (typeof w.id === 'string' && typeof w.body === 'string') return { id: w.id, body: w.body }
    }
  } catch { /* plaintext legacy non-JSON → traité comme corps brut */ }
  return { id: newId(), body: plain }
}

/** Drives N secure channels (one per peer) + persists per-peer history across sessions. */
export function useSecureSession(identity: Identity | null): SecureSession {
  const selfAddr = identity ? encodeAddress(identity.publicKey) : ''
  const [history, setHistory] = useState<History>(() => loadHistory(selfAddr))
  const [views, setViews] = useState<Record<string, PeerView>>({})

  const runtimeRef = useRef(new Map<string, PeerRuntime>())
  const identityRef = useRef<Identity | null>(null)
  const selfAddrRef = useRef(selfAddr)
  selfAddrRef.current = selfAddr

  useEffect(() => {
    if (identity) identityRef.current = identity
    const runtimes = runtimeRef.current
    return () => {
      runtimes.forEach((rt) => {
        rt.link.close()
        if (rt.typingClear) clearTimeout(rt.typingClear)
      })
      runtimes.clear()
    }
  }, [identity])

  const patchView = useCallback((peer: string, patch: Partial<PeerView>): void => {
    setViews((prev) => ({ ...prev, [peer]: { ...prev[peer], ...patch } }))
  }, [])

  const record = useCallback((peer: string, msg: SecureMessage): void => {
    setHistory((prev) => appendMessage(selfAddrRef.current, prev, peer, msg))
  }, [])

  const clearTyping = useCallback((peer: string): void => {
    const rt = runtimeRef.current.get(peer)
    if (rt?.typingClear) { clearTimeout(rt.typingClear); rt.typingClear = null }
    patchView(peer, { typing: false })
  }, [patchView])

  const handleIncoming = useCallback((peer: string, raw: string): void => {
    const rt = runtimeRef.current.get(peer)
    if (!rt?.keys) return
    try {
      const { id, body } = decodeWire(open(rt.keys, raw))
      clearTyping(peer) // Le pair a envoyé un vrai message → il ne tape plus.
      record(peer, { id, author: 'peer', body, at: Date.now(), cipherTag: raw.slice(-4).toUpperCase() })
    } catch (err) { console.error('[session] decrypt failed', err) }
  }, [record, clearTyping])

  // Réception d'une trame de contrôle non chiffrée (ex: typing) : active + auto-clear renouvelé.
  const handleControl = useCallback((peer: string, frame: Record<string, unknown>): void => {
    if (frame.c !== 'typing') return
    const rt = runtimeRef.current.get(peer)
    if (!rt) return
    patchView(peer, { typing: true })
    if (rt.typingClear) clearTimeout(rt.typingClear)
    rt.typingClear = setTimeout(() => patchView(peer, { typing: false }), TYPING_CLEAR_MS)
  }, [patchView])

  const handleState = useCallback((peer: string, isOpen: boolean): void => {
    patchView(peer, { phase: isOpen ? 'secure' : 'lost' })
  }, [patchView])

  // Crée/remplace l'entrée runtime d'un pair (ferme un link existant), pose la vue initiale.
  const bindPeer = useCallback(async (peerPub: Uint8Array, initiator: boolean): Promise<PeerLink> => {
    const keys = await deriveSession(identityRef.current!, peerPub, initiator)
    const peer = encodeAddress(peerPub)
    const existing = runtimeRef.current.get(peer)
    if (existing) {
      existing.link.close()
      if (existing.typingClear) clearTimeout(existing.typingClear)
    }
    const link = new PeerLink(
      (open) => handleState(peer, open),
      (raw) => handleIncoming(peer, raw),
      (frame) => handleControl(peer, frame),
    )
    runtimeRef.current.set(peer, newRuntime(link, keys))
    setViews((prev) => ({ ...prev, [peer]: newView(keys.peerFingerprint) }))
    return link
  }, [handleState, handleIncoming, handleControl])

  const beginOffer = useCallback(async (peerPub: Uint8Array): Promise<Sdp> => {
    const link = await bindPeer(peerPub, true)
    return link.createOffer()
  }, [bindPeer])

  const respondToOffer = useCallback(async (peerPub: Uint8Array, offer: Sdp): Promise<Sdp> => {
    const link = await bindPeer(peerPub, false)
    return link.acceptOffer(offer)
  }, [bindPeer])

  const applyAnswer = useCallback(async (peerPub: Uint8Array, answer: Sdp): Promise<void> => {
    const peer = encodeAddress(peerPub)
    await runtimeRef.current.get(peer)?.link.acceptAnswer(answer)
  }, [])

  const sendMessage = useCallback((peer: string, body: string): void => {
    const rt = runtimeRef.current.get(peer)
    if (!rt?.keys || !body.trim()) return
    const id = newId()
    const { payload, tag } = seal(rt.keys, encodeWire(id, body))
    rt.link.send(payload)
    record(peer, { id, author: 'self', body, at: Date.now(), cipherTag: tag })
  }, [record])

  // Signale au pair qu'on tape — no-op hors session sécurisée, throttlé à 1 envoi / 2s.
  const notifyTyping = useCallback((peer: string): void => {
    const rt = runtimeRef.current.get(peer)
    if (!rt || views[peer]?.phase !== 'secure') return
    const now = Date.now()
    if (now - rt.lastTypingSent < TYPING_THROTTLE_MS) return
    rt.lastTypingSent = now
    rt.link.sendControl({ c: 'typing' })
  }, [views])

  const phaseFor = useCallback((peer: string): ConnectionPhase => views[peer]?.phase ?? 'idle', [views])
  const fingerprintFor = useCallback((peer: string): string => views[peer]?.fingerprint ?? '', [views])
  const typingFor = useCallback((peer: string): boolean => views[peer]?.typing ?? false, [views])
  const isSecure = useCallback((peer: string): boolean => views[peer]?.phase === 'secure', [views])

  const connectedPeers = useMemo(
    () => Object.keys(views).filter((p) => views[p].phase === 'secure'),
    [views],
  )

  const aggregatePhase = useMemo<ConnectionPhase>(() => {
    let best: ConnectionPhase = 'idle'
    for (const v of Object.values(views)) if (PHASE_RANK[v.phase] > PHASE_RANK[best]) best = v.phase
    return best
  }, [views])

  const getMessages = useCallback((peer: string): SecureMessage[] => messagesFor(history, peer), [history])
  const hydrateHistory = useCallback((): void => setHistory(loadHistory(selfAddrRef.current)), [])

  // Insère un message reçu hors-DataChannel (store-and-forward), dédupliqué par id.
  const appendExternal = useCallback((peer: string, msg: SecureMessage): void => {
    setHistory((prev) => {
      if ((prev[peer] ?? []).some((m) => m.id === msg.id)) return prev
      return appendMessage(selfAddrRef.current, prev, peer, msg)
    })
  }, [])

  return {
    phaseFor, fingerprintFor, typingFor, isSecure, connectedPeers, aggregatePhase,
    history, messagesFor: getMessages, hydrateHistory, appendExternal,
    beginOffer, respondToOffer, applyAnswer, sendMessage, notifyTyping,
  }
}
