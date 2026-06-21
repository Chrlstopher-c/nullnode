import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Search, MessageSquare, Users, UserPlus, PanelLeftClose, Settings, User, type LucideIcon } from 'lucide-react'
import { ConversationList } from '../comms/ConversationList'
import { FriendsList } from '../roster/FriendsList'
import { PresencePicker } from '../roster/PresencePicker'
import { FriendRequests } from '../roster/FriendRequests'
import { AddFriend } from '../roster/AddFriend'
import { filterHistory, filterFriends } from './search'
import type { LayoutState, SidebarTab } from './use-layout'
import type { RosterState } from '../roster/use-roster'
import type { History } from '../session/history'
import type { Friend, FriendRequest } from '../roster/types'

interface SidebarProps {
  layout: LayoutState
  roster: RosterState
  history: History
  friends: Friend[]
  unreadFor: (peer: string) => number
  requests: FriendRequest[]
  onOpenChat: (peer: string) => void
  onAccept: (r: FriendRequest) => void
  onDecline: (r: FriendRequest) => void
  onSendRequest: (addr: string) => { ok: boolean; error?: string }
  relayOnline: boolean
  relayUrl: string
  peerCount: number
  selfHandle: string
  onOpenProfile: () => void
  myPresence: 'online' | 'away'
  onSetPresence: (state: 'online' | 'away') => void
}

const TABS: ReadonlyArray<{ id: SidebarTab; label: string; Icon: LucideIcon }> = [
  { id: 'chats', label: 'Chats', Icon: MessageSquare },
  { id: 'amis', label: 'Amis', Icon: Users },
  { id: 'demandes', label: 'Demandes', Icon: UserPlus },
]

/** Sidebar repliable : recherche + onglets (Chats/Amis/Demandes) + contenu + accès profil. */
export function Sidebar(props: SidebarProps): React.ReactElement {
  const { layout, relayOnline, relayUrl, peerCount, selfHandle, onOpenProfile, requests } = props
  return (
    <div
      className="flex h-full w-[340px] shrink-0 flex-col gap-3 border-r p-4 backdrop-blur-md"
      style={{ borderColor: 'var(--line)', background: 'rgba(12,15,17,0.78)' }}
    >
      <Head relayOnline={relayOnline} relayUrl={relayUrl} peerCount={peerCount} onCollapse={layout.toggleSidebar} />
      <SearchField value={layout.query} onChange={layout.setQuery} />
      <TabBar layout={layout} demandeCount={requests.length} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <TabContent {...props} />
      </div>
      <Foot handle={selfHandle} onOpenProfile={onOpenProfile} />
    </div>
  )
}

interface HeadProps {
  relayOnline: boolean
  relayUrl: string
  peerCount: number
  onCollapse: () => void
}

function Head({ relayOnline, relayUrl, peerCount, onCollapse }: HeadProps): React.ReactElement {
  return (
    <header className="flex items-center justify-between">
      <span className="text-[11px] tracking-[0.3em]" style={{ color: 'var(--text-mid)' }}>NULLNODE</span>
      <div className="flex items-center gap-3">
        <RelayStatus online={relayOnline} url={relayUrl} peerCount={peerCount} />
        <button onClick={onCollapse} title="masquer le panneau" style={{ color: 'var(--text-mid)' }}>
          <PanelLeftClose size={15} />
        </button>
      </div>
    </header>
  )
}

/** Badge UP/DOWN cliquable : ouvre les stats du relai actif (URL, état, pairs connectés). */
function RelayStatus({ online, url, peerCount }: { online: boolean; url: string; peerCount: number }): React.ReactElement {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)} title="stats du relai"
        className="flex items-center gap-1.5 text-[9px]" style={{ color: 'var(--text-lo)' }}
      >
        <span className="h-2 w-2 rounded-full" style={{ background: online ? 'var(--accent)' : 'var(--danger)' }} />
        {online ? 'UP' : 'DOWN'}
      </button>
      <AnimatePresence>
        {open && <RelayPopover online={online} url={url} peerCount={peerCount} onClose={() => setOpen(false)} />}
      </AnimatePresence>
    </div>
  )
}

function RelayPopover({ online, url, peerCount, onClose }: {
  online: boolean; url: string; peerCount: number; onClose: () => void
}): React.ReactElement {
  return (
    <>
      <button className="fixed inset-0 z-10 cursor-default" onClick={onClose} aria-label="fermer" />
      <motion.div
        initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
        className="absolute right-0 top-6 z-20 flex w-56 flex-col gap-2 rounded border p-3 backdrop-blur-md"
        style={{ borderColor: 'var(--line)', background: 'rgba(12,15,17,0.96)' }}
      >
        <StatRow label="RELAI" value={online ? 'EN LIGNE' : 'HORS LIGNE'} accent={online} />
        <StatRow label="SOURCE" value={url.replace(/^wss?:\/\//, '')} />
        <StatRow label="PAIRS CONNECTÉS" value={online ? String(peerCount) : '—'} accent={online} />
      </motion.div>
    </>
  )
}

function StatRow({ label, value, accent }: { label: string; value: string; accent?: boolean }): React.ReactElement {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[8px] tracking-[0.18em]" style={{ color: 'var(--text-lo)' }}>{label}</span>
      <span className="truncate text-[10px]" style={{ color: accent ? 'var(--accent)' : 'var(--text-hi)' }}>{value}</span>
    </div>
  )
}

function SearchField({ value, onChange }: { value: string; onChange: (v: string) => void }): React.ReactElement {
  return (
    <div
      className="flex items-center gap-2 rounded border px-2.5 py-2"
      style={{ borderColor: 'var(--line)', background: 'var(--surface-0)' }}
    >
      <Search size={13} style={{ color: 'var(--text-lo)' }} />
      <input
        value={value} onChange={(e) => onChange(e.target.value)}
        placeholder="rechercher un contact…" spellCheck={false}
        className="flex-1 bg-transparent text-[12px] outline-none" style={{ color: 'var(--text-hi)' }}
      />
    </div>
  )
}

function TabBar({ layout, demandeCount }: { layout: LayoutState; demandeCount: number }): React.ReactElement {
  return (
    <div className="flex gap-1">
      {TABS.map(({ id, label, Icon }) => {
        const active = layout.tab === id
        return (
          <button
            key={id} onClick={() => layout.setTab(id)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded border py-2 text-[10px] tracking-wide transition-colors"
            style={{
              borderColor: active ? 'var(--accent-dim)' : 'var(--line)',
              background: active ? 'rgba(0,255,157,0.06)' : 'transparent',
              color: active ? 'var(--accent)' : 'var(--text-mid)',
            }}
          >
            <Icon size={13} />{label}
            {id === 'demandes' && demandeCount > 0 && (
              <span className="rounded-full px-1.5 text-[8px]" style={{ background: 'var(--accent)', color: 'var(--void)' }}>
                {demandeCount}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

function TabContent(props: SidebarProps): React.ReactElement {
  const { layout, history, friends, unreadFor, onOpenChat, roster, myPresence, onSetPresence } = props
  if (layout.tab === 'chats') {
    return (
      <ConversationList
        history={filterHistory(history, friends, layout.query)}
        friends={friends} unreadFor={unreadFor} onOpen={onOpenChat}
      />
    )
  }
  if (layout.tab === 'amis') {
    return (
      <div className="flex flex-col gap-3">
        <PresencePicker current={myPresence} onChange={onSetPresence} />
        <FriendsList
          roster={{ ...roster, friends: filterFriends(friends, layout.query) }}
          onChat={(f) => onOpenChat(f.address)}
        />
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-4">
      <AddFriend onSend={props.onSendRequest} />
      <FriendRequests requests={props.requests} onAccept={props.onAccept} onDecline={props.onDecline} />
    </div>
  )
}

function Foot({ handle, onOpenProfile }: { handle: string; onOpenProfile: () => void }): React.ReactElement {
  return (
    <button
      onClick={onOpenProfile}
      className="flex items-center gap-2 rounded border px-3 py-2 text-left transition-colors hover:border-[var(--line-bright)]"
      style={{ borderColor: 'var(--line)' }}
    >
      <span
        className="grid h-7 w-7 place-items-center rounded-full border"
        style={{ borderColor: 'var(--accent-dim)', color: 'var(--accent)' }}
      >
        <User size={13} />
      </span>
      <span className="flex-1 truncate text-[11px]" style={{ color: 'var(--text-hi)' }}>{handle}</span>
      <Settings size={13} style={{ color: 'var(--text-lo)' }} />
    </button>
  )
}
