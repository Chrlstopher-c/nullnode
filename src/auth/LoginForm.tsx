import { useState } from 'react'
import { PinStep } from './PinStep'
import type { IdentityState } from '../identity/use-identity'

interface Props {
  identity: IdentityState
  onBack: () => void
}

type Phase = 'phrase' | 'pin' | 'migrate-pin'

/** Connexion par phrase de récupération, ou migration d'un ancien compte en clair. */
export function LoginForm({ identity, onBack }: Props): React.ReactElement {
  const [phase, setPhase] = useState<Phase>(identity.hasLegacySeed ? 'migrate-pin' : 'phrase')
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const sealImport = async (pin: string): Promise<void> => {
    setBusy(true); setError('')
    const res = await identity.importMnemonic(draft, pin)
    if (!res.ok) { setError(res.error ?? 'FAILED'); setBusy(false) }
  }

  const sealMigrate = async (pin: string): Promise<void> => {
    setBusy(true); setError('')
    const res = await identity.migrateLegacy(pin)
    if (!res.ok) { setError(res.error ?? 'FAILED'); setBusy(false) }
  }

  if (phase === 'migrate-pin') {
    return (
      <div className="flex flex-col gap-2">
        <span className="text-[8px] leading-relaxed" style={{ color: 'var(--warn)' }}>
          ⚠ Your recovery phrase is stored unencrypted. Set a PIN to secure it on this device.
        </span>
        <PinStep title="// SECURE YOUR ACCOUNT" busy={busy} onSubmit={(p) => void sealMigrate(p)} onBack={onBack} />
        {error && <span className="text-[9px]" style={{ color: 'var(--danger)' }}>{error}</span>}
      </div>
    )
  }

  if (phase === 'pin') {
    return (
      <div className="flex flex-col gap-2">
        <PinStep title="// SET A PIN" busy={busy} onSubmit={(p) => void sealImport(p)} onBack={() => setPhase('phrase')} />
        {error && <span className="text-[9px]" style={{ color: 'var(--danger)' }}>{error}</span>}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <span className="text-[10px] tracking-[0.25em]" style={{ color: 'var(--text-mid)' }}>// LOGIN</span>
      <textarea
        autoFocus value={draft} rows={3} spellCheck={false}
        onChange={(e) => { setDraft(e.target.value); setError('') }}
        placeholder="paste your 12-word recovery phrase…"
        className="rounded border p-3 text-[11px] outline-none"
        style={{ borderColor: 'var(--line)', background: 'var(--surface-0)', color: 'var(--text-hi)' }}
      />
      {error && <span className="text-[9px]" style={{ color: 'var(--danger)' }}>{error}</span>}
      <div className="flex gap-2">
        <button
          onClick={() => { if (draft.trim()) setPhase('pin') }}
          className="flex-1 rounded border px-3 py-2 text-[11px] tracking-[0.15em] transition-all hover:brightness-125"
          style={{ borderColor: 'var(--accent-dim)', color: 'var(--accent)' }}
        >▸ NEXT</button>
        <button onClick={onBack} className="text-[10px] tracking-[0.2em]" style={{ color: 'var(--text-lo)' }}>BACK</button>
      </div>
    </div>
  )
}
