import { motion } from 'framer-motion'
import { IdentityCard } from '../identity/IdentityCard'
import { RecoveryPanel } from '../identity/RecoveryPanel'
import { BackupPanel } from '../backup/BackupPanel'
import { SettingsPanel } from '../settings/SettingsPanel'
import type { RelaySetting } from '../settings/use-relay-setting'
import { AddFriend } from './AddFriend'
import { FriendsList } from './FriendsList'
import { FriendRequests } from './FriendRequests'
import type { IdentityState } from '../identity/use-identity'
import type { RosterState } from './use-roster'
import type { Friend, FriendRequest } from './types'

interface Props {
  identity: IdentityState
  roster: RosterState
  relay: RelaySetting
  relayOnline: boolean
  requests: FriendRequest[]
  onChat: (friend: Friend) => void
  onSendRequest: (address: string) => { ok: boolean; error?: string }
  onAccept: (req: FriendRequest) => void
  onDecline: (req: FriendRequest) => void
}

/** Left console: identity + friend requests + roster. */
export function NetworkPanel(props: Props): React.ReactElement {
  const { identity, roster, relay, relayOnline, requests, onChat, onSendRequest, onAccept, onDecline } = props
  return (
    <motion.aside
      initial={{ opacity: 0, x: -24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="relative z-10 flex w-[340px] flex-col gap-5 rounded-lg border p-6 backdrop-blur-sm"
      style={{ borderColor: 'var(--line)', background: 'rgba(15,18,20,0.72)' }}
    >
      <header className="flex items-center justify-between">
        <span className="text-[11px] tracking-[0.3em]" style={{ color: 'var(--text-mid)' }}>// NETWORK</span>
        <span className="flex items-center gap-2 text-[10px]" style={{ color: 'var(--text-lo)' }}>
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: relayOnline ? 'var(--accent)' : 'var(--danger)', boxShadow: relayOnline ? '0 0 8px var(--accent-glow)' : 'none' }}
          />
          {relayOnline ? 'RELAY UP' : 'RELAY DOWN'}
        </span>
      </header>
      <IdentityCard identity={identity} />
      <RecoveryPanel identity={identity} />
      <BackupPanel mnemonic={identity.mnemonic} />
      <FriendRequests requests={requests} onAccept={onAccept} onDecline={onDecline} />
      <AddFriend onSend={onSendRequest} />
      <FriendsList roster={roster} onChat={onChat} />
      <SettingsPanel relay={relay} relayOnline={relayOnline} />
    </motion.aside>
  )
}
