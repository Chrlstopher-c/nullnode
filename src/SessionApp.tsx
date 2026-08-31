import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { BootSequence } from './boot/BootSequence'
import { Workspace } from './workspace/Workspace'
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
}

/** Application authentifiée : montée uniquement quand l'identité est prête, donc avec
 * une adresse garantie. Les hooks par-compte chargent ainsi leur partition de façon
 * synchrone (aucune ré-hydratation différée, aucune fuite inter-comptes). */
export function SessionApp({ identity, relay, visual }: Props): React.ReactElement {
  const [booted, setBooted] = useState(false)
  const [lastPeer, setLastPeer] = useState<string | null>(null)

  const roster = useRoster(identity.address)
  const session = useSecureSession(identity.identity)
  const unread = useUnread(identity.address, session.history)
  const pins = usePins(identity.address)
  const rendezvous = useRendezvous({
    identity: identity.identity, address: identity.address, pseudo: identity.pseudo,
    mnemonic: identity.mnemonic, relayUrl: relay.relayUrl, session, roster, pins,
    refreshPseudo: identity.refreshPseudo,
  })

  // Bascule locale + diffusion au pair en une action (par pair, multi-fenêtre).
  const onTogglePin = useCallback((peer: string, id: string): void => {
    const pinned = pins.togglePin(peer, id)
    rendezvous.sendPin(peer, id, pinned)
  }, [pins, rendezvous])

  const onVerify = useCallback((peer: string): void => roster.setVerified(peer, true), [roster])

  // Daemon desktop : présence relay tenue par le ghost quand la GUI est fermée (no-op hors Tauri).
  useDesktopPresence({ ready: identity.status === 'ready', address: identity.address, relayUrl: relay.relayUrl })

  // Auto-away : online→away après inactivité, retour online à la première interaction.
  useIdle(IDLE_MS, () => rendezvous.setPresence('away'), () => rendezvous.setPresence('online'))

  const { markSeen } = unread
  useEffect(() => { if (lastPeer) markSeen(lastPeer) }, [lastPeer, session.history, markSeen])

  const openConversation = useCallback((address: string): void => {
    unread.markSeen(address)
    setLastPeer(address)
    const friend = roster.friends.find((f) => f.address === address)
    const connectedHere = session.isSecure(address)
    if (friend && friend.presence === 'online' && !connectedHere) void rendezvous.connectTo(friend)
  }, [roster.friends, session, rendezvous, unread])

  const incomingPeer = session.connectedPeers.find((p) => p !== lastPeer) ?? null

  return (
    <>
      <Workspace
        identity={identity}
        relay={relay}
        visual={visual}
        roster={roster}
        session={session}
        unread={unread}
        requests={rendezvous.incoming}
        relayOnline={rendezvous.relayOnline}
        myPresence={rendezvous.myPresence}
        incomingPeer={incomingPeer}
        onSetPresence={rendezvous.setPresence}
        onOpenChat={openConversation}
        onSend={rendezvous.sendDM}
        onVerify={onVerify}
        pinnedIdsFor={(peer) => pins.pinnedIds(peer)}
        onTogglePin={onTogglePin}
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
