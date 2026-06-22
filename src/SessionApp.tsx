import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { BootSequence } from './boot/BootSequence'
import { NetworkScene } from './visualizer/NetworkScene'
import { SceneBoundary } from './visualizer/SceneBoundary'
import { HudOverlay } from './hud/HudOverlay'
import { AppShell } from './shell/AppShell'
import { useUnread } from './comms/use-unread'
import { usePins } from './comms/use-pins'
import { useRoster } from './roster/use-roster'
import { useSecureSession } from './session/use-secure-session'
import { useRendezvous } from './rendezvous/use-rendezvous'
import { useDesktopPresence } from './desktop/use-desktop-presence'
import { useIdle } from './presence/use-idle'
import type { VisualSetting } from './settings/use-visual-setting'
import type { IdentityState } from './identity/use-identity'
import type { RelaySetting } from './settings/use-relay-setting'

const IDLE_MS = 3 * 60 * 1000

interface Props {
  identity: IdentityState
  relay: RelaySetting
  visual: VisualSetting
  scene3d: boolean
}

/** Application authentifiée : montée uniquement quand l'identité est prête, donc avec
 * une adresse garantie. Les hooks par-compte chargent ainsi leur partition de façon
 * synchrone (aucune ré-hydratation différée, aucune fuite inter-comptes). */
export function SessionApp({ identity, relay, visual, scene3d }: Props): React.ReactElement {
  const [booted, setBooted] = useState(false)
  const [chatPeer, setChatPeer] = useState<string | null>(null)

  const roster = useRoster(identity.address)
  const session = useSecureSession(identity.identity)
  const unread = useUnread(identity.address, session.history)
  const pins = usePins(identity.address)
  const rendezvous = useRendezvous({
    identity: identity.identity, address: identity.address, pseudo: identity.pseudo,
    mnemonic: identity.mnemonic, relayUrl: relay.relayUrl, session, roster, pins,
    refreshPseudo: identity.refreshPseudo,
  })

  // Bascule locale + diffusion au pair en une action ; câblée jusqu'à MessageStream.
  const onTogglePin = useCallback((id: string): void => {
    if (!chatPeer) return
    const pinned = pins.togglePin(chatPeer, id)
    rendezvous.sendPin(chatPeer, id, pinned)
  }, [chatPeer, pins, rendezvous])

  const onVerify = useCallback((peer: string): void => roster.setVerified(peer, true), [roster])

  // Daemon desktop : présence relay tenue par le ghost quand la GUI est fermée (no-op hors Tauri).
  useDesktopPresence({ ready: identity.status === 'ready', address: identity.address, relayUrl: relay.relayUrl })

  // Auto-away : online→away après inactivité, retour online à la première interaction.
  useIdle(IDLE_MS, () => rendezvous.setPresence('away'), () => rendezvous.setPresence('online'))

  const { markSeen } = unread
  useEffect(() => { if (chatPeer) markSeen(chatPeer) }, [chatPeer, session.history, markSeen])

  const openConversation = useCallback((address: string): void => {
    unread.markSeen(address)
    setChatPeer(address)
    const friend = roster.friends.find((f) => f.address === address)
    const connectedHere = session.isSecure(address)
    if (friend && friend.presence === 'online' && !connectedHere) void rendezvous.connectTo(friend)
  }, [roster.friends, session, rendezvous, unread])

  const incomingPeer = session.connectedPeers.find((p) => p !== chatPeer) ?? null

  // Pilote la luminescence du background : change à chaque message reçu ou connexion établie.
  const pulseToken = useMemo(() => {
    const peerMessages = Object.values(session.history)
      .reduce((n, msgs) => n + msgs.filter((m) => m.author === 'peer').length, 0)
    return peerMessages + session.connectedPeers.length
  }, [session.history, session.connectedPeers])

  return (
    <>
      {scene3d && (
        <div className="absolute inset-0">
          <SceneBoundary>
            <NetworkScene phase={session.aggregatePhase} visual={visual.visual} pulseToken={pulseToken} />
          </SceneBoundary>
        </div>
      )}

      <HudOverlay
        selfFingerprint={identity.identity?.fingerprint ?? ''}
        peerFingerprint={chatPeer ? session.fingerprintFor(chatPeer) : ''}
        phase={session.aggregatePhase}
      />

      <AppShell
        identity={identity}
        relay={relay}
        visual={visual}
        roster={roster}
        session={session}
        unread={unread}
        requests={rendezvous.incoming}
        relayOnline={rendezvous.relayOnline}
        peerCount={rendezvous.peerCount}
        myPresence={rendezvous.myPresence}
        onSetPresence={rendezvous.setPresence}
        chatPeer={chatPeer}
        incomingPeer={incomingPeer}
        onOpenChat={openConversation}
        onCloseChat={() => setChatPeer(null)}
        pinnedIds={chatPeer ? pins.pinnedIds(chatPeer) : []}
        onTogglePin={onTogglePin}
        onSend={rendezvous.sendDM}
        onVerify={onVerify}
        onSendRequest={rendezvous.sendRequest}
        onAccept={rendezvous.acceptRequest}
        onDecline={rendezvous.declineRequest}
      />

      <AnimatePresence>
        {!booted && (
          <BootSequence
            identityReady={!!identity.identity}
            relayOnline={rendezvous.relayOnline}
            onComplete={() => setBooted(true)}
          />
        )}
      </AnimatePresence>
    </>
  )
}
