import { useState } from 'react'
import { newMnemonic } from '../identity/seed'
import { PinStep } from './PinStep'
import type { IdentityState } from '../identity/use-identity'

interface Props {
  identity: IdentityState
  onBack: () => void
}

type Phase = 'pseudo' | 'reveal' | 'pin'

/** Création : pseudo → révéler la phrase → définir un PIN → sceller le vault et entrer. */
export function RegisterForm({ identity, onBack }: Props): React.ReactElement {
  const [phase, setPhase] = useState<Phase>('pseudo')
  const [pseudo, setPseudo] = useState('')
  const [phrase, setPhrase] = useState('')
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const generate = (): void => { if (pseudo.trim()) { setPhrase(newMnemonic()); setPhase('reveal') } }

  const copy = async (): Promise<void> => {
    try { await navigator.clipboard.writeText(phrase); setCopied(true); setTimeout(() => setCopied(false), 1500) }
    catch (err) { console.error('[register] copy failed', err) }
  }

  const seal = async (pin: string): Promise<void> => {
    setBusy(true); setError('')
    const res = await identity.register(phrase, pseudo, pin)
    if (!res.ok) { setError(res.error ?? 'FAILED'); setBusy(false) }
  }

  if (phase === 'pin') {
    return (
      <div className="flex flex-col gap-2">
        <PinStep title="// SET A PIN" busy={busy} onSubmit={(p) => void seal(p)} onBack={() => setPhase('reveal')} />
        {error && <span className="text-[9px]" style={{ color: 'var(--danger)' }}>{error}</span>}
      </div>
    )
  }

  if (phase === 'reveal') {
    return <Reveal phrase={phrase} copied={copied} onCopy={() => void copy()} onNext={() => setPhase('pin')} />
  }

  return (
    <div className="flex flex-col gap-3">
      <span className="text-[10px] tracking-[0.25em]" style={{ color: 'var(--text-mid)' }}>// REGISTER</span>
      <input
        autoFocus value={pseudo} spellCheck={false}
        onChange={(e) => setPseudo(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') generate() }}
        placeholder="choose a pseudo…"
        className="rounded border px-3 py-2 text-[12px] outline-none"
        style={{ borderColor: 'var(--line)', background: 'var(--surface-0)', color: 'var(--accent)' }}
      />
      <div className="flex gap-2">
        <button
          onClick={generate} disabled={!pseudo.trim()}
          className="flex-1 rounded border px-3 py-2 text-[11px] tracking-[0.15em] transition-all hover:brightness-125 disabled:opacity-30"
          style={{ borderColor: 'var(--accent-dim)', color: 'var(--accent)' }}
        >▸ GENERATE IDENTITY</button>
        <button onClick={onBack} className="text-[10px] tracking-[0.2em]" style={{ color: 'var(--text-lo)' }}>BACK</button>
      </div>
    </div>
  )
}

interface RevealProps {
  phrase: string
  copied: boolean
  onCopy: () => void
  onNext: () => void
}

/** Affiche la phrase générée : à sauvegarder avant de définir le PIN. */
function Reveal({ phrase, copied, onCopy, onNext }: RevealProps): React.ReactElement {
  return (
    <div className="flex flex-col gap-3">
      <span className="text-[10px] tracking-[0.25em]" style={{ color: 'var(--text-mid)' }}>// YOUR RECOVERY PHRASE</span>
      <div className="grid grid-cols-3 gap-1 rounded border p-3" style={{ borderColor: 'var(--line)', background: 'var(--surface-0)' }}>
        {phrase.split(' ').map((w, i) => (
          <span key={i} className="text-[11px]" style={{ color: 'var(--accent-dim)' }}>
            <span style={{ color: 'var(--text-lo)' }}>{i + 1}.</span> {w}
          </span>
        ))}
      </div>
      <span className="text-[8px] leading-relaxed" style={{ color: 'var(--warn)' }}>
        ⚠ These 12 words ARE your account. Save them offline now — they cannot be recovered.
      </span>
      <div className="flex gap-2">
        <button
          onClick={onCopy} className="rounded border px-3 py-2 text-[10px] tracking-[0.2em]"
          style={{ borderColor: 'var(--line)', color: copied ? 'var(--accent)' : 'var(--text-lo)' }}
        >{copied ? '✓ COPIED' : 'COPY'}</button>
        <button
          onClick={onNext}
          className="flex-1 rounded border px-3 py-2 text-[11px] tracking-[0.15em] transition-all hover:brightness-125"
          style={{ borderColor: 'var(--accent-dim)', color: 'var(--accent)' }}
        >▸ I SAVED IT — NEXT</button>
      </div>
    </div>
  )
}
