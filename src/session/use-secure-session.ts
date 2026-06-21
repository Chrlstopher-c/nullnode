import { useCallback, useEffect, useRef, useState } from 'react'
import { deriveSession, open, seal, type SessionKeys } from '../crypto/encryption'
import { PeerLink } from '../transport/peer-link'
import { decodeDrop, encodeDrop } from '../transport/dead-drop'
import { encodeAddress } from '../identity/address'
import { appendMessage, loadHistory, messagesFor, type History } from './history'
import type { ConnectionPhase, Identity, SecureMessage } from '../shared/types'

type Sdp = RTCSessionDescriptionInit

function newId(): string {
  return Math.random().toString(36).slice(2, 10)
}

export interface SecureSession {
  phase: ConnectionPhase
  peerAddress: string
  peerFingerprint: string
  history: History
  messagesFor: (peer: string) => SecureMessage[]
  hydrateHistory: () => void
  appendExternal: (peer: string, msg: SecureMessage) => void
  localDrop: string
  hostSession: () => Promise<void>
  joinSession: (offerCode: string) => Promise<void>
  completeSession: (answerCode: string) => Promise<void>
  beginOffer: (peerPub: Uint8Array) => Promise<Sdp>
  respondToOffer: (peerPub: Uint8Array, offer: Sdp) => Promise<Sdp>
  applyAnswer: (answer: Sdp) => Promise<void>
  sendMessage: (body: string) => void
  peerTyping: boolean
  notifyTyping: () => void
}

const TYPING_THROTTLE_MS = 2000
const TYPING_CLEAR_MS = 3500

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

/** Drives one secure channel + persists per-peer history across sessions. */
export function useSecureSession(identity: Identity | null): SecureSession {
  const [phase, setPhase] = useState<ConnectionPhase>('generating-keys')
  const [peerAddress, setPeerAddress] = useState('')
  const [peerFingerprint, setPeerFingerprint] = useState('')
  const [localDrop, setLocalDrop] = useState('')
  const selfAddr = identity ? encodeAddress(identity.publicKey) : ''
  const [history, setHistory] = useState<History>(() => loadHistory(selfAddr))
  const [peerTyping, setPeerTyping] = useState(false)

  const linkRef = useRef<PeerLink | null>(null)
  const lastTypingSentRef = useRef(0)
  const typingClearRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const keysRef = useRef<SessionKeys | null>(null)
  const identityRef = useRef<Identity | null>(null)
  const peerRef = useRef('')
  const selfAddrRef = useRef(selfAddr)
  selfAddrRef.current = selfAddr

  useEffect(() => {
    if (identity) { identityRef.current = identity; setPhase('idle') }
    return () => {
      linkRef.current?.close()
      if (typingClearRef.current) clearTimeout(typingClearRef.current)
    }
  }, [identity])

  const record = useCallback((msg: SecureMessage): void => {
    if (!peerRef.current) return
    setHistory((prev) => appendMessage(selfAddrRef.current, prev, peerRef.current, msg))
  }, [])

  const clearTyping = useCallback((): void => {
    if (typingClearRef.current) { clearTimeout(typingClearRef.current); typingClearRef.current = null }
    setPeerTyping(false)
  }, [])

  const handleIncoming = useCallback((raw: string): void => {
    if (!keysRef.current) return
    try {
      const { id, body } = decodeWire(open(keysRef.current, raw))
      clearTyping() // Le pair a envoyé un vrai message → il ne tape plus.
      record({ id, author: 'peer', body, at: Date.now(), cipherTag: raw.slice(-4).toUpperCase() })
    } catch (err) { console.error('[session] decrypt failed', err) }
  }, [record, clearTyping])

  // Réception d'une trame de contrôle non chiffrée (ex: typing) : active + auto-clear renouvelé.
  const handleControl = useCallback((frame: Record<string, unknown>): void => {
    if (frame.c !== 'typing') return
    setPeerTyping(true)
    if (typingClearRef.current) clearTimeout(typingClearRef.current)
    typingClearRef.current = setTimeout(() => setPeerTyping(false), TYPING_CLEAR_MS)
  }, [])

  const handleState = useCallback((isOpen: boolean): void => setPhase(isOpen ? 'secure' : 'lost'), [])

  const link = useCallback((): PeerLink => {
    const l = new PeerLink(handleState, handleIncoming, handleControl)
    linkRef.current = l
    return l
  }, [handleState, handleIncoming, handleControl])

  const bindPeer = useCallback(async (peerPub: Uint8Array, initiator: boolean): Promise<void> => {
    keysRef.current = await deriveSession(identityRef.current!, peerPub, initiator)
    setPeerFingerprint(keysRef.current.peerFingerprint)
    const addr = encodeAddress(peerPub)
    peerRef.current = addr
    setPeerAddress(addr)
  }, [])

  const hostSession = useCallback(async (): Promise<void> => {
    setPhase('awaiting-peer')
    const offer = await link().createOffer()
    setLocalDrop(encodeDrop('offer', offer, identityRef.current!.publicKey))
  }, [link])

  const joinSession = useCallback(async (offerCode: string): Promise<void> => {
    setPhase('handshaking')
    const drop = decodeDrop(offerCode)
    await bindPeer(drop.pub, false)
    const answer = await link().acceptOffer(drop.sdp)
    setLocalDrop(encodeDrop('answer', answer, identityRef.current!.publicKey))
  }, [link, bindPeer])

  const completeSession = useCallback(async (answerCode: string): Promise<void> => {
    setPhase('handshaking')
    const drop = decodeDrop(answerCode)
    await bindPeer(drop.pub, true)
    await linkRef.current!.acceptAnswer(drop.sdp)
  }, [bindPeer])

  const beginOffer = useCallback(async (peerPub: Uint8Array): Promise<Sdp> => {
    setPhase('handshaking')
    await bindPeer(peerPub, true)
    return link().createOffer()
  }, [link, bindPeer])

  const respondToOffer = useCallback(async (peerPub: Uint8Array, offer: Sdp): Promise<Sdp> => {
    setPhase('handshaking')
    await bindPeer(peerPub, false)
    return link().acceptOffer(offer)
  }, [link, bindPeer])

  const applyAnswer = useCallback(async (answer: Sdp): Promise<void> => {
    await linkRef.current?.acceptAnswer(answer)
  }, [])

  const sendMessage = useCallback((body: string): void => {
    if (!keysRef.current || !body.trim()) return
    const id = newId()
    const { payload, tag } = seal(keysRef.current, encodeWire(id, body))
    linkRef.current?.send(payload)
    record({ id, author: 'self', body, at: Date.now(), cipherTag: tag })
  }, [record])

  // Signale au pair qu'on tape — no-op hors session sécurisée, throttlé à 1 envoi / 2s.
  const notifyTyping = useCallback((): void => {
    if (phase !== 'secure') return
    const now = Date.now()
    if (now - lastTypingSentRef.current < TYPING_THROTTLE_MS) return
    lastTypingSentRef.current = now
    linkRef.current?.sendControl({ c: 'typing' })
  }, [phase])

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
    phase, peerAddress, peerFingerprint, history, messagesFor: getMessages, hydrateHistory,
    appendExternal, localDrop,
    hostSession, joinSession, completeSession,
    beginOffer, respondToOffer, applyAnswer, sendMessage,
    peerTyping, notifyTyping,
  }
}
