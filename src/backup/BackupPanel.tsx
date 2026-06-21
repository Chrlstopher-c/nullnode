import { useRef, useState } from 'react'
import { sealBackup, openBackup } from './backup-crypto'
import { collectBackupState, mergeBackupState } from './backup-sync'

/** Filet souverain : export/import d'un blob chiffré (clé dérivée de la seed). */
export function BackupPanel({ mnemonic, selfAddr }: { mnemonic: string; selfAddr: string }): React.ReactElement {
  const fileRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState('')

  const doExport = async (): Promise<void> => {
    if (!mnemonic) return
    try {
      const blob = await sealBackup(collectBackupState(selfAddr), mnemonic)
      const url = URL.createObjectURL(new Blob([blob], { type: 'application/octet-stream' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `nullnode-backup-${Date.now()}.ncb`
      a.click()
      URL.revokeObjectURL(url)
      setStatus('EXPORTED')
    } catch (err) {
      console.error('[backup] export failed', err)
      setStatus('EXPORT FAILED')
    }
  }

  const doImport = async (file: File): Promise<void> => {
    try {
      const state = await openBackup(await file.text(), mnemonic)
      if (!state) { setStatus('WRONG SEED / CORRUPT'); return }
      if (mergeBackupState(selfAddr, state)) window.location.reload()
      else setStatus('NOTHING NEW')
    } catch (err) {
      console.error('[backup] import failed', err)
      setStatus('IMPORT FAILED')
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-3">
        <button
          onClick={() => void doExport()}
          className="text-[9px] tracking-[0.2em] transition-colors"
          style={{ color: 'var(--text-lo)' }}
        >EXPORT FILE</button>
        <button
          onClick={() => fileRef.current?.click()}
          className="text-[9px] tracking-[0.2em] transition-colors"
          style={{ color: 'var(--text-lo)' }}
        >IMPORT FILE</button>
        {status && <span className="text-[9px]" style={{ color: 'var(--accent-dim)' }}>{status}</span>}
      </div>
      <input
        ref={fileRef} type="file" accept=".ncb" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void doImport(f) }}
      />
    </div>
  )
}
