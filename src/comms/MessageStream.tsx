import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronDown, ChevronLeft, Phone, Pin, PinOff, Send, Shield, ShieldCheck } from 'lucide-react'
import { resolvePeerHandle } from './peer-label'
import type { SecureSession } from '../session/use-secure-session'
import type { SecureMessage } from '../shared/types'
import type { Friend } from '../roster/types'

interface BubbleProps {
  msg: SecureMessage
  authorName: string
  pinned: boolean
  onTogglePin: (id: string) => void
}

function Bubble({ msg, authorName, pinned, onTogglePin }: BubbleProps): React.ReactElement {
  const self = msg.author === 'self'
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      className="group flex flex-col gap-1" style={{ alignItems: self ? 'flex-end' : 'flex-start' }}
    >
      <div className="flex items-center gap-2 text-[9px]" style={{ color: 'var(--text-lo)' }}>
        <span style={{ color: 'var(--accent-dim)' }}>{authorName}</span>
        <span>{new Date(msg.at).toISOString().slice(11, 19)}</span>
        <button
          onClick={() => onTogglePin(msg.id)}
          title={pinned ? 'désépingler' : 'épingler'}
          className={`transition-opacity ${pinned ? 'opacity-70' : 'opacity-0 group-hover:opacity-100'}`}
          style={{ color: pinned ? 'var(--accent)' : 'var(--text-mid)' }}
        >{pinned ? <PinOff size={11} /> : <Pin size={11} />}</button>
      </div>
      <div
        className="max-w-[80%] rounded border px-3 py-2 text-[12px]"
        style={{
          borderColor: self ? 'var(--accent-dim)' : 'var(--line-bright)',
          background: self ? 'rgba(0,255,157,0.06)' : 'var(--surface-1)',
          color: 'var(--text-hi)',
        }}
      >{msg.body}</div>
    </motion.div>
  )
}

interface PinnedBarProps {
  messages: SecureMessage[]
  selfPseudo: string
  peerName: string
  onTogglePin: (id: string) => void
}

/** Encart repliable des messages épinglés, en tête de conversation. */
function PinnedBar({ messages, selfPseudo, peerName, onTogglePin }: PinnedBarProps): React.ReactElement | null {
  const [open, setOpen] = useState(true)
  if (messages.length === 0) return null
  return (
    <div className="rounded border" style={{ borderColor: 'var(--line)', background: 'var(--surface-0)' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-[10px] tracking-[0.15em]"
        style={{ color: 'var(--accent-dim)' }}
      >
        <Pin size={11} />ÉPINGLÉS ({messages.length})
        <ChevronDown size={12} className="ml-auto transition-transform" style={{ transform: open ? 'none' : 'rotate(-90deg)' }} />
      </button>
      {open && (
        <div className="flex flex-col gap-1 px-3 pb-2">
          {messages.map((m) => (
            <div key={m.id} className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--text-mid)' }}>
              <span style={{ color: 'var(--accent-dim)' }}>{m.author === 'self' ? selfPseudo : peerName}</span>
              <span className="min-w-0 flex-1 truncate" style={{ color: 'var(--text-hi)' }}>{m.body}</span>
              <button onClick={() => onTogglePin(m.id)} title="désépingler" style={{ color: 'var(--text-lo)' }}>
                <PinOff size={11} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

interface VerifyControlProps {
  sas: string
  verified: boolean
  onVerify: () => void
}

/** Panneau de comparaison SAS : code à lire de vive voix + verdict identique/différent. */
function SasPanel({ sas, onMatch, onMismatch }: {
  sas: string; onMatch: () => void; onMismatch: () => void
}): React.ReactElement {
  return (
    <div
      className="absolute left-0 right-0 top-full z-10 mt-2 flex flex-col gap-2 rounded border px-3 py-3"
      style={{ borderColor: 'var(--line)', background: 'var(--surface-0)' }}
    >
      <span className="text-[15px] tracking-[0.3em]" style={{ color: 'var(--accent)' }}>{sas}</span>
      <span className="text-[10px]" style={{ color: 'var(--text-lo)' }}>Comparez ce code de vive voix avec votre pair</span>
      <div className="flex gap-2">
        <button
          onClick={onMatch} className="rounded border px-3 py-1 text-[11px] tracking-[0.1em]"
          style={{ borderColor: 'var(--accent-dim)', color: 'var(--accent)' }}
        >✓ IDENTIQUE</button>
        <button
          onClick={onMismatch} className="rounded border px-3 py-1 text-[11px] tracking-[0.1em]"
          style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}
        >✗ DIFFÉRENT</button>
      </div>
    </div>
  )
}

/** Contrôle anti-MITM : badge si vérifié, sinon bouton bouclier qui ouvre le panneau SAS. */
function VerifyControl({ sas, verified, onVerify }: VerifyControlProps): React.ReactElement {
  const [showSas, setShowSas] = useState(false)
  const [mismatch, setMismatch] = useState(false)

  if (verified) {
    return (
      <span title="identité vérifiée" style={{ color: 'var(--accent)' }}>
        <ShieldCheck size={14} />
      </span>
    )
  }

  return (
    <>
      <button onClick={() => { setShowSas((v) => !v); setMismatch(false) }} title="vérifier l'identité" style={{ color: 'var(--text-mid)' }}>
        <Shield size={14} />
      </button>
      {showSas && (
        <SasPanel
          sas={sas} onMatch={() => { onVerify(); setShowSas(false) }}
          onMismatch={() => { setMismatch(true); setShowSas(false) }}
        />
      )}
      {mismatch && (
        <span className="absolute left-0 top-full z-10 mt-2 text-[10px]" style={{ color: 'var(--danger)' }}>
          canal potentiellement compromis
        </span>
      )}
    </>
  )
}

interface Props {
  session: SecureSession
  peer: string
  friends: Friend[]
  selfPseudo: string
  verified: boolean
  onVerify: () => void
  pinnedIds: string[]
  onTogglePin: (id: string) => void
  onSend: (peer: string, body: string) => void
  onBack: () => void
}

/** One conversation: header, pinned bar, message stream, composer. */
export function MessageStream(props: Props): React.ReactElement {
  const { session, peer, friends, selfPseudo, verified, onVerify, pinnedIds, onTogglePin, onSend, onBack } = props
  const [draft, setDraft] = useState('')
  const endRef = useRef<HTMLDivElement>(null)
  const messages = session.messagesFor(peer)
  const peerName = resolvePeerHandle(peer, friends).split('#')[0]
  const connected = session.isSecure(peer)
  const pinnedSet = new Set(pinnedIds)
  const pinnedMessages = messages.filter((m) => pinnedSet.has(m.id))

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages.length])

  const showTyping = session.typingFor(peer) && connected
  const submit = (): void => { onSend(peer, draft); setDraft('') }
  const onDraftChange = (value: string): void => {
    setDraft(value)
    if (connected) session.notifyTyping(peer)
  }

  return (
    <div className="flex h-[60vh] w-full min-w-0 flex-col gap-4">
      <header className="relative flex items-center gap-3 border-b pb-3" style={{ borderColor: 'var(--line)' }}>
        <button onClick={onBack} title="retour" style={{ color: 'var(--text-mid)' }}><ChevronLeft size={16} /></button>
        <span className="h-2 w-2 rounded-full" style={{ background: connected ? 'var(--accent)' : 'var(--text-lo)' }} />
        <span className="text-[13px]" style={{ color: 'var(--text-hi)' }}>{resolvePeerHandle(peer, friends)}</span>
        {connected && (
          <span className="ml-auto">
            <VerifyControl sas={session.sasFor(peer)} verified={verified} onVerify={onVerify} />
          </span>
        )}
        <button disabled title="appel vocal — bientôt" className={`${connected ? '' : 'ml-auto'} disabled:opacity-30`} style={{ color: 'var(--text-mid)' }}>
          <Phone size={14} />
        </button>
        <span className="text-[9px]" style={{ color: connected ? 'var(--accent)' : 'var(--text-lo)' }}>
          {connected ? 'SECURE' : 'RELAY'}
        </span>
      </header>
      <PinnedBar messages={pinnedMessages} selfPseudo={selfPseudo} peerName={peerName} onTogglePin={onTogglePin} />
      <div className="flex flex-1 flex-col gap-4 overflow-auto pr-2">
        {messages.length === 0 && (
          <span className="text-[11px]" style={{ color: 'var(--text-lo)' }}>end-to-end encrypted. say something.</span>
        )}
        {messages.map((m) => (
          <Bubble
            key={m.id} msg={m} authorName={m.author === 'self' ? selfPseudo : peerName}
            pinned={pinnedSet.has(m.id)} onTogglePin={onTogglePin}
          />
        ))}
        <div ref={endRef} />
      </div>
      {showTyping && (
        <div className="flex items-center gap-1.5 px-1 text-[10px]" style={{ color: 'var(--text-lo)' }}>
          <span style={{ color: 'var(--accent-dim)' }}>{peerName}</span>
          <span>typing</span>
          {[0, 1, 2].map((i) => (
            <span
              key={i} className="h-1 w-1 rounded-full"
              style={{ background: 'var(--accent-dim)', animation: 'pulse-node 1.2s ease-in-out infinite', animationDelay: `${i * 0.2}s` }}
            />
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          value={draft} onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder={connected ? 'transmit…' : 'transmit (delivered when online)…'}
          spellCheck={false}
          className="flex-1 rounded border px-3 py-2 text-[12px] outline-none"
          style={{ borderColor: 'var(--line)', background: 'var(--surface-0)', color: 'var(--text-hi)' }}
        />
        <button
          onClick={submit}
          className="flex items-center gap-1.5 rounded border px-4 text-[11px] tracking-[0.15em] transition-all hover:brightness-125"
          style={{ borderColor: 'var(--accent-dim)', color: 'var(--accent)' }}
        ><Send size={13} />SEND</button>
      </div>
    </div>
  )
}
