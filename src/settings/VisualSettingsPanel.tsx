import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { VisualSetting } from './use-visual-setting'
import type { AccentTheme } from './visual-config'

interface RangeRowProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
}

function RangeRow({ label, value, min, max, step, onChange }: RangeRowProps): React.ReactElement {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-[9px] tracking-[0.15em]">
        <span style={{ color: 'var(--text-mid)' }}>{label}</span>
        <span style={{ color: 'var(--accent)' }}>{value.toFixed(2)}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1 w-full cursor-pointer appearance-none rounded"
        style={{ accentColor: 'var(--accent)', background: 'var(--surface-0)' }}
      />
    </div>
  )
}

const ACCENT_OPTIONS: { id: AccentTheme; label: string }[] = [
  { id: 'phosphor', label: 'PHOSPHOR' },
  { id: 'amber', label: 'AMBER' },
]

function AccentToggle({ setting }: { setting: VisualSetting }): React.ReactElement {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[9px] tracking-[0.15em]" style={{ color: 'var(--text-mid)' }}>ACCENT</span>
      <div className="flex flex-wrap gap-1">
        {ACCENT_OPTIONS.map((opt) => {
          const active = setting.visual.accent === opt.id
          return (
            <button
              key={opt.id} onClick={() => setting.setVisual({ accent: opt.id })}
              className="rounded border px-2 py-1 text-[9px] tracking-[0.1em] transition-colors"
              style={{ borderColor: active ? 'var(--accent-dim)' : 'var(--line)',
                color: active ? 'var(--accent)' : 'var(--text-mid)' }}
            >{opt.label}</button>
          )
        })}
      </div>
    </div>
  )
}

/** Réglages visuels : densité particules, grain, aberration chromatique, thème d'accent. */
export function VisualSettingsPanel({ setting }: { setting: VisualSetting }): React.ReactElement {
  const [open, setOpen] = useState(false)
  const { visual, setVisual } = setting

  return (
    <div className="flex flex-col gap-2 border-t pt-3" style={{ borderColor: 'var(--line)' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between text-[9px] tracking-[0.25em]"
        style={{ color: open ? 'var(--accent)' : 'var(--text-lo)' }}
      >
        <span>⚙ VISUAL SETTINGS</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex flex-col gap-3 overflow-hidden pt-1"
          >
            <RangeRow
              label="DENSITY" value={visual.particleDensity} min={0.3} max={1.5} step={0.05}
              onChange={(v) => setVisual({ particleDensity: v })}
            />
            <RangeRow
              label="GRAIN" value={visual.grain} min={0} max={0.4} step={0.01}
              onChange={(v) => setVisual({ grain: v })}
            />
            <RangeRow
              label="ABERRATION" value={visual.aberration} min={0} max={2} step={0.05}
              onChange={(v) => setVisual({ aberration: v })}
            />
            <AccentToggle setting={setting} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
