import { useState } from 'react'

const MIN_PIN = 4

interface Props {
  title: string
  busy?: boolean
  onSubmit: (pin: string) => void
  onBack: () => void
}

/** Définition d'un PIN avec confirmation. Min 4 caractères, scelle le vault au submit. */
export function PinStep({ title, busy = false, onSubmit, onBack }: Props): React.ReactElement {
  const [pin, setPin] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')

  const submit = (): void => {
    if (pin.length < MIN_PIN) { setError(`PIN MIN ${MIN_PIN} CHARS`); return }
    if (pin !== confirm) { setError('PIN MISMATCH'); return }
    onSubmit(pin)
  }

  return (
    <div className="flex flex-col gap-3">
      <span className="text-[10px] tracking-[0.25em]" style={{ color: 'var(--text-mid)' }}>{title}</span>
      <span className="text-[8px] leading-relaxed" style={{ color: 'var(--text-lo)' }}>
        This PIN encrypts your recovery phrase on this device. It is never sent anywhere.
      </span>
      <input
        autoFocus type="password" value={pin} spellCheck={false}
        onChange={(e) => { setPin(e.target.value); setError('') }}
        placeholder="set a PIN…"
        className="rounded border px-3 py-2 text-[12px] outline-none"
        style={{ borderColor: 'var(--line)', background: 'var(--surface-0)', color: 'var(--accent)' }}
      />
      <input
        type="password" value={confirm} spellCheck={false}
        onChange={(e) => { setConfirm(e.target.value); setError('') }}
        onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
        placeholder="confirm PIN…"
        className="rounded border px-3 py-2 text-[12px] outline-none"
        style={{ borderColor: 'var(--line)', background: 'var(--surface-0)', color: 'var(--accent)' }}
      />
      {error && <span className="text-[9px]" style={{ color: 'var(--danger)' }}>{error}</span>}
      <div className="flex gap-2">
        <button
          onClick={submit} disabled={busy}
          className="flex-1 rounded border px-3 py-2 text-[11px] tracking-[0.15em] transition-all hover:brightness-125 disabled:opacity-30"
          style={{ borderColor: 'var(--accent-dim)', color: 'var(--accent)' }}
        >{busy ? '▸ SEALING…' : '▸ SET PIN & ENTER'}</button>
        <button onClick={onBack} disabled={busy} className="text-[10px] tracking-[0.2em]" style={{ color: 'var(--text-lo)' }}>BACK</button>
      </div>
    </div>
  )
}
