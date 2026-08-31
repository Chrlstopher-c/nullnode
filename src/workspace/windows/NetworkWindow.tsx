import { Tabs } from './Tabs'
import { FriendsList } from '../../roster/FriendsList'
import { FriendRequests } from '../../roster/FriendRequests'
import { AddFriend } from '../../roster/AddFriend'
import type { RosterState } from '../../roster/use-roster'
import type { Friend, FriendRequest } from '../../roster/types'

interface Props {
  roster: RosterState
  requests: FriendRequest[]
  onChat: (friend: Friend) => void
  onAccept: (r: FriendRequest) => void
  onDecline: (r: FriendRequest) => void
  onSendRequest: (addr: string) => { ok: boolean; error?: string }
}

/** Fenêtre réseau : pairs (FriendsList), demandes entrantes, ajout par adresse. */
export function NetworkWindow({
  roster, requests, onChat, onAccept, onDecline, onSendRequest,
}: Props): React.ReactElement {
  return (
    <Tabs tabs={[
      { id: 'peers', label: 'Peers' },
      { id: 'requests', label: 'Requests', count: requests.length || undefined },
      { id: 'discover', label: 'Discover' },
    ]}>
      {(active) => {
        if (active === 'peers') return <FriendsList roster={roster} onChat={onChat} />
        if (active === 'requests') {
          return requests.length === 0
            ? <div className="ws-empty">aucune demande en attente.</div>
            : <FriendRequests requests={requests} onAccept={onAccept} onDecline={onDecline} />
        }
        return <AddFriend onSend={onSendRequest} />
      }}
    </Tabs>
  )
}
