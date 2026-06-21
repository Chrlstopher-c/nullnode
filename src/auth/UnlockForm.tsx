import { useState } from 'react'
import type { IdentityState } from '../identity/use-identity'

interface Props {
  identity: IdentityState
}

/** Écran de déverrouillage (status 'locked') : saisie du PIN pour ouvrir le vault. */
export function UnlockForm({ identity }: Props): React.ReactElement {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (): Promise<void> => {
    if (busy || !pin) return
    setBusy(true); setError('')
    const res = await identity.unlock(pin)
    if (!res.ok) { setError(res.error ?? 'FAILED'); setPin(''); setBusy(false) }
  }

  return (
    <div className="flex flex-col gap-3">
      <span className="text-[10px] tracking-[0.25em]" style={{ color: 'var(--text-mid)' }}>// LOCKED — ENTER PIN</span>
      <input
        autoFocus type="password" value={pin} spellCheck={false}
        onChange={(e) => { setPin(e.target.value); setError('') }}
        onKeyDown={(e) => { if (e.key === 'Enter') void submit() }}
        placeholder="enter your PIN…"
        className="rounded border px-3 py-2 text-[12px] outline-none"
        style={{ borderColor: 'var(--line)', background: 'var(--surface-0)', color: 'var(--accent)' }}
      />
      {error && <span className="text-[9px]" style={{ color: 'var(--danger)' }}>{error}</span>}
      <button
        onClick={() => void submit()} disabled={busy || !pin}
        className="rounded border px-3 py-2 text-[11px] tracking-[0.15em] transition-all hover:brightness-125 disabled:opacity-30"
        style={{ borderColor: 'var(--accent-dim)', color: 'var(--accent)' }}
      >{busy ? '▸ UNLOCKING…' : '▸ UNLOCK'}</button>
    </div>
  )
}
