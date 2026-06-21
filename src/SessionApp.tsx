import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { BootSequence } from './boot/BootSequence'
import { NetworkScene } from './visualizer/NetworkScene'
import { HudOverlay } from './hud/HudOverlay'
import { CommsConsole } from './comms/CommsConsole'
import { NetworkPanel } from './roster/NetworkPanel'
import { useUnread } from './comms/use-unread'
import { useRoster } from './roster/use-roster'
import { useSecureSession } from './session/use-secure-session'
import { useRendezvous } from './rendezvous/use-rendezvous'
import type { IdentityState } from './identity/use-identity'
import type { RelaySetting } from './settings/use-relay-setting'

interface Props {
  identity: IdentityState
  relay: RelaySetting
}

/** Application authentifiée : montée uniquement quand l'identité est prête, donc avec
 * une adresse garantie. Les hooks par-compte chargent ainsi leur partition de façon
 * synchrone (aucune ré-hydratation différée, aucune fuite inter-comptes). */
export function SessionApp({ identity, relay }: Props): React.ReactElement {
  const [booted, setBooted] = useState(false)
  const [chatPeer, setChatPeer] = useState<string | null>(null)

  const roster = useRoster(identity.address)
  const session = useSecureSession(identity.identity)
  const unread = useUnread(identity.address, session.history)
  const rendezvous = useRendezvous({
    identity: identity.identity, address: identity.address, pseudo: identity.pseudo,
    mnemonic: identity.mnemonic, relayUrl: relay.relayUrl, session, roster,
    refreshPseudo: identity.refreshPseudo,
  })

  const { markSeen } = unread
  useEffect(() => { if (chatPeer) markSeen(chatPeer) }, [chatPeer, session.history, markSeen])

  const openConversation = useCallback((address: string): void => {
    unread.markSeen(address)
    setChatPeer(address)
    const friend = roster.friends.find((f) => f.address === address)
    const connectedHere = session.phase === 'secure' && session.peerAddress === address
    if (friend && friend.presence === 'online' && !connectedHere) void rendezvous.connectTo(friend)
  }, [roster.friends, session.phase, session.peerAddress, rendezvous, unread])

  const incomingPeer =
    session.phase === 'secure' && session.peerAddress && session.peerAddress !== chatPeer
      ? session.peerAddress : null

  return (
    <>
      <div className="absolute inset-0">
        <NetworkScene phase={session.phase} />
      </div>

      <HudOverlay
        selfFingerprint={identity.identity?.fingerprint ?? ''}
        peerFingerprint={session.peerFingerprint}
        phase={session.phase}
      />

      <div className="absolute inset-0 flex items-center justify-between gap-8 px-[5vw] py-24">
        <NetworkPanel
          identity={identity}
          roster={roster}
          relay={relay}
          relayOnline={rendezvous.relayOnline}
          requests={rendezvous.incoming}
          onChat={(f) => openConversation(f.address)}
          onSendRequest={rendezvous.sendRequest}
          onAccept={rendezvous.acceptRequest}
          onDecline={rendezvous.declineRequest}
        />
        <CommsConsole
          session={session}
          friends={roster.friends}
          unread={unread}
          selfPseudo={identity.pseudo}
          chatPeer={chatPeer}
          incomingPeer={incomingPeer}
          onSend={rendezvous.sendDM}
          onOpenChat={openConversation}
          onCloseChat={() => setChatPeer(null)}
        />
      </div>

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
