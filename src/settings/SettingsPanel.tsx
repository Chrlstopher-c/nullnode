import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { RELAY_PRESETS } from './relay-config'
import type { RelaySetting } from './use-relay-setting'

interface Props {
  relay: RelaySetting
  relayOnline: boolean
}

/** Réglages : source du node de rendez-vous + état de connexion en direct. */
export function SettingsPanel({ relay, relayOnline }: Props): React.ReactElement {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(relay.relayUrl)

  const apply = (url: string): void => { setDraft(url); relay.setRelayUrl(url) }

  return (
    <div className="flex flex-col gap-2 border-t pt-3" style={{ borderColor: 'var(--line)' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between text-[9px] tracking-[0.25em]"
        style={{ color: open ? 'var(--accent)' : 'var(--text-lo)' }}
      >
        <span>⚙ RELAY SETTINGS</span>
        <span className="flex items-center gap-1.5">
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: relayOnline ? 'var(--accent)' : 'var(--danger)',
              boxShadow: relayOnline ? '0 0 8px var(--accent-glow)' : 'none' }}
          />
          <span style={{ color: relayOnline ? 'var(--accent)' : 'var(--danger)' }}>
            {relayOnline ? 'CONNECTED' : 'OFFLINE'}
          </span>
        </span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="flex flex-col gap-2 overflow-hidden"
          >
            <div className="flex flex-wrap gap-1">
              {RELAY_PRESETS.map((p) => {
                const active = p.url === relay.relayUrl
                return (
                  <button
                    key={p.url} onClick={() => apply(p.url)}
                    className="rounded border px-2 py-1 text-[9px] tracking-[0.1em] transition-colors"
                    style={{ borderColor: active ? 'var(--accent-dim)' : 'var(--line)',
                      color: active ? 'var(--accent)' : 'var(--text-mid)' }}
                  >{p.label}</button>
                )
              })}
            </div>
            <div className="flex gap-2">
              <input
                value={draft} spellCheck={false}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') relay.setRelayUrl(draft) }}
                placeholder="ws(s)://host:port"
                className="flex-1 rounded border px-2 py-1 text-[10px] outline-none"
                style={{ borderColor: 'var(--line)', background: 'var(--surface-0)', color: 'var(--text-hi)' }}
              />
              <button
                onClick={() => relay.setRelayUrl(draft)}
                className="rounded border px-3 text-[9px] tracking-[0.15em]"
                style={{ borderColor: 'var(--accent-dim)', color: 'var(--accent)' }}
              >SET</button>
            </div>
            <span className="truncate text-[8px]" style={{ color: 'var(--text-lo)' }}>active: {relay.relayUrl}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
