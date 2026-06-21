import { useCallback, useEffect, useRef, useState } from 'react'
import { decodeAddress } from '../identity/address'
import { RendezvousClient } from './rendezvous-client'
import { ensureSealReady, openSignal, sealSignal } from './sealed-signal'
import { openEnvelope, sealEnvelope, type SocialBody } from './social-envelope'
import { sealBackup, openBackup } from '../backup/backup-crypto'
import { collectBackupState, mergeBackupState } from '../backup/backup-sync'
import { loadAccount, saveAccount } from '../shared/local-store'
import type { Identity } from '../shared/types'
import type { SecureSession } from '../session/use-secure-session'
import type { RosterState } from '../roster/use-roster'
import type { Friend, FriendRequest } from '../roster/types'

interface Args {
  identity: Identity | null
  address: string
  pseudo: string
  mnemonic: string
  relayUrl: string
  session: SecureSession
  roster: RosterState
  refreshPseudo: () => void
}

const BACKUP_DEBOUNCE_MS = 2_000

/** Acheminer un signal WebRTC entrant (offer→answer / answer→apply) vers la session. */
async function routeSignal(
  from: string, payload: string, identity: Identity, session: SecureSession, client: RendezvousClient,
): Promise<void> {
  try {
    const body = openSignal(payload, identity)
    const peerPub = decodeAddress(from)
    if (body.kind === 'offer') {
      const answer = await session.respondToOffer(peerPub, body.sdp)
      client.signal(from, sealSignal({ kind: 'answer', sdp: answer }, peerPub))
    } else {
      await session.applyAnswer(body.sdp)
    }
  } catch (err) { console.error('[rendezvous] signal failed', err) }
}

export interface RendezvousState {
  relayOnline: boolean
  incoming: FriendRequest[]
  connectTo: (friend: Friend) => Promise<void>
  sendDM: (peer: string, body: string) => void
  sendRequest: (address: string) => { ok: boolean; error?: string }
  acceptRequest: (req: FriendRequest) => void
  declineRequest: (req: FriendRequest) => void
}

function shortId(): string {
  return Math.random().toString(36).slice(2, 10)
}

/** Branche le relai : présence, connexion auto ami-à-ami, et demandes d'amis consenties. */
export function useRendezvous(args: Args): RendezvousState {
  const { identity, address, pseudo, mnemonic, relayUrl, session, roster, refreshPseudo } = args
  const clientRef = useRef<RendezvousClient | null>(null)
  const [relayOnline, setRelayOnline] = useState(false)
  const [incoming, setIncoming] = useState<FriendRequest[]>(() => loadAccount<FriendRequest[]>(address, 'requests', []))
  const live = useRef({ identity, session, roster, pseudo, address, mnemonic, refreshPseudo })
  live.current = { identity, session, roster, pseudo, address, mnemonic, refreshPseudo }

  useEffect(() => { if (address) saveAccount(address, 'requests', incoming) }, [incoming, address])

  const handleEnvelope = useCallback((id: string, from: string, payload: string): void => {
    const { identity: id0, roster: r, session: s } = live.current
    clientRef.current?.ack([id])
    if (!id0) return
    try {
      const body = openEnvelope(payload, id0)
      applySocial(body, from, r, s, setIncoming)
    } catch (err) { console.error('[rendezvous] envelope failed', err) }
  }, [])

  // Pull au login : restaure roster/historique depuis le blob chiffré, hydrate le state en place
  // (jamais de window.reload : il coupe le socket et boucle).
  const handleBackup = useCallback((blob: string | null): void => {
    const { mnemonic: m, session: s, roster: r, refreshPseudo: refresh, address: self } = live.current
    if (!blob || !m) return
    void openBackup(blob, m)
      .then((state) => {
        if (state && mergeBackupState(self, state)) { s.hydrateHistory(); r.hydrate(); refresh() }
      })
      .catch((err) => console.error('[backup] restore failed', err))
  }, [])

  // Annonce notre pseudo courant à un ami (propagation des renommages).
  const announceProfile = useCallback((to: string): void => {
    const { pseudo: p, address: self } = live.current
    try {
      const pub = decodeAddress(to)
      clientRef.current?.relay(to, sealEnvelope({ kind: 'profile', pseudo: p, address: self }, pub))
    } catch (err) { console.error('[rendezvous] profile announce failed', err) }
  }, [])

  // Push debouncé : scelle l'état courant et l'envoie au relai (opaque).
  const pushBackup = useCallback((): void => {
    const { mnemonic: m, address: self } = live.current
    const client = clientRef.current
    if (!m || !client) return
    void sealBackup(collectBackupState(self), m)
      .then((blob) => client.backupPut(blob))
      .catch((err) => console.error('[backup] push failed', err))
  }, [])

  useEffect(() => {
    if (!identity || !address) return
    let active = true
    ensureSealReady().then(() => {
      if (!active) return
      const client = new RendezvousClient(relayUrl, address, {
        onOpen: (online) => {
          setRelayOnline(true)
          online.forEach((a) => live.current.roster.setPresence(a, 'online'))
          client.backupGet()
        },
        onPresence: (a, s) => {
          live.current.roster.setPresence(a, s)
          if (s === 'online' && live.current.roster.hasFriend(a)) announceProfile(a)
        },
        onSignal: (f, p) => {
          const c = live.current
          if (c.identity && clientRef.current) void routeSignal(f, p, c.identity, c.session, clientRef.current)
        },
        onEnvelope: handleEnvelope,
        onBackup: handleBackup,
        onClose: () => { setRelayOnline(false); live.current.roster.resetPresence() },
      })
      clientRef.current = client
      client.connect()
    }).catch((err) => console.error('[rendezvous] init failed', err))
    return () => { active = false; clientRef.current?.close(); clientRef.current = null }
  }, [identity, address, relayUrl, handleEnvelope, handleBackup])

  // Sauvegarde debouncée à chaque évolution du roster, de l'historique ou du pseudo.
  useEffect(() => {
    if (!relayOnline) return
    const timer = setTimeout(pushBackup, BACKUP_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [relayOnline, roster.friends, session.history, pseudo, pushBackup])

  // Diffuse notre pseudo aux amis en ligne : à la connexion et à chaque renommage.
  useEffect(() => {
    if (!relayOnline) return
    roster.friends.filter((f) => f.presence === 'online').forEach((f) => announceProfile(f.address))
  }, [relayOnline, pseudo, roster.friends, announceProfile])

  // Envoi d'un DM : DataChannel si le pair est connecté en direct, sinon store-and-forward
  // chiffré via le relai (délivré quand le pair revient online). Toujours enregistré localement.
  const sendDM = useCallback((peer: string, body: string): void => {
    const { session: s, address: self } = live.current
    const text = body.trim()
    if (!text) return
    const liveChannel = s.phase === 'secure' && s.peerAddress === peer
    if (liveChannel) { s.sendMessage(text); return }
    const id = shortId()
    s.appendExternal(peer, { id, author: 'self', body: text, at: Date.now(), cipherTag: '····' })
    try {
      const pub = decodeAddress(peer)
      clientRef.current?.relay(peer, sealEnvelope({ kind: 'dm', id, body: text, at: Date.now(), address: self }, pub))
    } catch (err) { console.error('[rendezvous] dm relay failed', err) }
  }, [])

  const connectTo = useCallback(async (friend: Friend): Promise<void> => {
    const { identity: id0, session: s } = live.current
    if (!id0 || !clientRef.current) return
    try {
      const peerPub = decodeAddress(friend.address)
      const offer = await s.beginOffer(peerPub)
      clientRef.current.signal(friend.address, sealSignal({ kind: 'offer', sdp: offer }, peerPub))
    } catch (err) { console.error('[rendezvous] connect failed', err) }
  }, [])

  const sendRequest = useCallback((target: string): { ok: boolean; error?: string } => {
    const { roster: r, pseudo: p, address: self } = live.current
    const addr = target.trim()
    if (!addr) return { ok: false, error: 'EMPTY ADDRESS' }
    if (addr === self) return { ok: false, error: 'THAT IS YOUR OWN ADDRESS' }
    if (r.hasFriend(addr)) return { ok: false, error: 'ALREADY IN ROSTER' }
    try {
      const pub = decodeAddress(addr)
      clientRef.current?.relay(addr, sealEnvelope({ kind: 'friend_request', pseudo: p, address: self }, pub))
      return { ok: true }
    } catch { return { ok: false, error: 'INVALID NULLNODE ADDRESS' } }
  }, [])

  const acceptRequest = useCallback((req: FriendRequest): void => {
    const { roster: r, pseudo: p, address: self } = live.current
    r.addFriend(req.address, req.pseudo)
    try {
      const pub = decodeAddress(req.address)
      clientRef.current?.relay(req.address, sealEnvelope({ kind: 'friend_accept', pseudo: p, address: self }, pub))
    } catch (err) { console.error('[rendezvous] accept failed', err) }
    setIncoming((prev) => prev.filter((x) => x.address !== req.address))
  }, [])

  const declineRequest = useCallback((req: FriendRequest): void => {
    const { address: self } = live.current
    try {
      const pub = decodeAddress(req.address)
      clientRef.current?.relay(req.address, sealEnvelope({ kind: 'friend_decline', address: self }, pub))
    } catch (err) { console.error('[rendezvous] decline failed', err) }
    setIncoming((prev) => prev.filter((x) => x.address !== req.address))
  }, [])

  return { relayOnline, incoming, connectTo, sendDM, sendRequest, acceptRequest, declineRequest }
}

/** Applique une enveloppe sociale entrante : requête en attente, ou acceptation réciproque. */
function applySocial(
  body: SocialBody, _from: string, roster: RosterState, session: SecureSession,
  setIncoming: React.Dispatch<React.SetStateAction<FriendRequest[]>>,
): void {
  if (body.kind === 'friend_request') {
    if (roster.hasFriend(body.address)) return
    setIncoming((prev) => prev.some((x) => x.address === body.address)
      ? prev
      : [...prev, { id: body.address, address: body.address, pseudo: body.pseudo, at: Date.now() }])
  } else if (body.kind === 'friend_accept') {
    roster.addFriend(body.address, body.pseudo)
  } else if (body.kind === 'profile') {
    roster.updatePseudo(body.address, body.pseudo)
  } else if (body.kind === 'dm') {
    session.appendExternal(body.address, {
      id: body.id, author: 'peer', body: body.body, at: body.at, cipherTag: '····',
    })
  }
}
