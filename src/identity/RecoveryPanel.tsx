import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { PinStep } from '../auth/PinStep'
import type { IdentityState } from './use-identity'

type Mode = 'closed' | 'reveal' | 'import' | 'import-pin'

/** Recovery phrase: reveal to back up, or import to restore an identity elsewhere. */
export function RecoveryPanel({ identity }: { identity: IdentityState }): React.ReactElement {
  const [mode, setMode] = useState<Mode>('closed')
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)

  const sealImport = async (pin: string): Promise<void> => {
    setBusy(true); setError('')
    const res = await identity.importMnemonic(draft, pin)
    if (!res.ok) { setError(res.error ?? 'FAILED'); setBusy(false) }
  }

  const copyPhrase = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(identity.mnemonic)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch (err) { console.error('[recovery] copy failed', err) }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-3">
        <button
          onClick={() => setMode(mode === 'reveal' ? 'closed' : 'reveal')}
          className="text-[9px] tracking-[0.2em] transition-colors"
          style={{ color: mode === 'reveal' ? 'var(--accent)' : 'var(--text-lo)' }}
        >RECOVERY PHRASE</button>
        <button
          onClick={() => { setMode(mode === 'import' ? 'closed' : 'import'); setError('') }}
          className="text-[9px] tracking-[0.2em] transition-colors"
          style={{ color: mode === 'import' ? 'var(--accent)' : 'var(--text-lo)' }}
        >RESTORE</button>
      </div>
      <AnimatePresence mode="wait">
        {mode === 'reveal' && (
          <motion.div
            key="reveal" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="flex flex-col gap-2"
          >
            <div className="grid grid-cols-3 gap-1 rounded border p-2" style={{ borderColor: 'var(--line)', background: 'var(--surface-0)' }}>
              {identity.mnemonic.split(' ').map((w, i) => (
                <span key={i} className="text-[10px]" style={{ color: 'var(--accent-dim)' }}>
                  <span style={{ color: 'var(--text-lo)' }}>{i + 1}.</span> {w}
                </span>
              ))}
            </div>
            <button
              onClick={() => void copyPhrase()}
              className="self-start text-[9px] tracking-[0.2em] transition-colors"
              style={{ color: copied ? 'var(--accent)' : 'var(--text-lo)' }}
            >{copied ? '✓ COPIED' : 'COPY PHRASE'}</button>
            <span className="text-[8px] leading-relaxed" style={{ color: 'var(--warn)' }}>
              ⚠ These 12 words ARE your account. Write them down offline. Anyone with them owns your identity.
            </span>
          </motion.div>
        )}
        {mode === 'import' && (
          <motion.div
            key="import" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="flex flex-col gap-2"
          >
            <textarea
              value={draft} onChange={(e) => { setDraft(e.target.value); setError('') }}
              placeholder="paste your 12-word recovery phrase…" rows={3} spellCheck={false}
              className="rounded border p-2 text-[10px] outline-none"
              style={{ borderColor: 'var(--line)', background: 'var(--surface-0)', color: 'var(--text-hi)' }}
            />
            <button
              onClick={() => { if (draft.trim()) { setMode('import-pin'); setError('') } }}
              className="rounded border px-3 py-2 text-[10px] tracking-[0.15em] transition-all hover:brightness-125"
              style={{ borderColor: 'var(--accent-dim)', color: 'var(--accent)' }}
            >▸ RESTORE IDENTITY</button>
            {error && <span className="text-[9px]" style={{ color: 'var(--danger)' }}>{error}</span>}
          </motion.div>
        )}
        {mode === 'import-pin' && (
          <motion.div
            key="import-pin" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="flex flex-col gap-2"
          >
            <PinStep title="// SET A PIN" busy={busy} onSubmit={(p) => void sealImport(p)} onBack={() => setMode('import')} />
            {error && <span className="text-[9px]" style={{ color: 'var(--danger)' }}>{error}</span>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
