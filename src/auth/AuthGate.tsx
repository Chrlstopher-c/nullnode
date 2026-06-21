import { useState } from 'react'
import { motion } from 'framer-motion'
import { LoginForm } from './LoginForm'
import { RegisterForm } from './RegisterForm'
import { UnlockForm } from './UnlockForm'
import type { IdentityState } from '../identity/use-identity'

type Mode = 'choose' | 'login' | 'register'

/** Porte d'entrée : unlock (vault verrouillé), login par phrase, ou register. */
export function AuthGate({ identity }: { identity: IdentityState }): React.ReactElement {
  const [mode, setMode] = useState<Mode>('choose')
  const locked = identity.status === 'locked'
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center px-6"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
    >
      <motion.div
        initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ ease: [0.16, 1, 0.3, 1] }}
        className="flex w-[400px] flex-col gap-5 rounded-lg border p-7 backdrop-blur-md"
        style={{ borderColor: 'var(--line)', background: 'rgba(15,18,20,0.85)' }}
      >
        <div className="flex flex-col gap-1">
          <span className="text-[15px] tracking-[0.35em] accent-glow" style={{ color: 'var(--accent)' }}>NULLNODE</span>
          <span className="text-[9px] tracking-[0.2em]" style={{ color: 'var(--text-lo)' }}>sovereign secure peer link</span>
        </div>
        {locked && <UnlockForm identity={identity} />}
        {!locked && mode === 'choose' && <Choose onLogin={() => setMode('login')} onRegister={() => setMode('register')} />}
        {!locked && mode === 'login' && <LoginForm identity={identity} onBack={() => setMode('choose')} />}
        {!locked && mode === 'register' && <RegisterForm identity={identity} onBack={() => setMode('choose')} />}
      </motion.div>
    </motion.div>
  )
}

interface ChooseProps {
  onLogin: () => void
  onRegister: () => void
}

/** Premier écran : créer une nouvelle identité ou se connecter. */
function Choose({ onLogin, onRegister }: ChooseProps): React.ReactElement {
  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={onRegister}
        className="rounded border px-3 py-3 text-[11px] tracking-[0.15em] transition-all hover:brightness-125"
        style={{ borderColor: 'var(--accent-dim)', color: 'var(--accent)' }}
      >▸ CREATE IDENTITY</button>
      <button
        onClick={onLogin}
        className="rounded border px-3 py-3 text-[11px] tracking-[0.15em] transition-colors"
        style={{ borderColor: 'var(--line)', color: 'var(--text-mid)' }}
      >LOG IN WITH RECOVERY PHRASE</button>
    </div>
  )
}
