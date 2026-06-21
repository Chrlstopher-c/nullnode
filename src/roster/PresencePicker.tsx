import { Circle, Moon } from 'lucide-react'

interface PresencePickerProps {
  current: 'online' | 'away'
  onChange: (state: 'online' | 'away') => void
}

const OPTIONS: ReadonlyArray<{ id: 'online' | 'away'; label: string; Icon: typeof Circle }> = [
  { id: 'online', label: 'Actif', Icon: Circle },
  { id: 'away', label: 'Inactif', Icon: Moon },
]

/** Toggle de présence manuelle (Actif / Inactif), affiché en tête de l'onglet Amis. */
export function PresencePicker({ current, onChange }: PresencePickerProps): React.ReactElement {
  return (
    <div className="flex gap-1 rounded border p-1" style={{ borderColor: 'var(--line)' }}>
      {OPTIONS.map(({ id, label, Icon }) => {
        const active = current === id
        return (
          <button
            key={id} onClick={() => onChange(id)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded py-1.5 text-[10px] tracking-wide transition-colors"
            style={{
              background: active ? 'rgba(0,255,157,0.06)' : 'transparent',
              color: active ? 'var(--accent)' : 'var(--text-mid)',
            }}
          >
            <Icon size={12} fill={active && id === 'online' ? 'var(--accent)' : 'none'} />{label}
          </button>
        )
      })}
    </div>
  )
}
