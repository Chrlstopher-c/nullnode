import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { IdentityCard } from '../identity/IdentityCard'
import { RecoveryPanel } from '../identity/RecoveryPanel'
import { BackupPanel } from '../backup/BackupPanel'
import { SettingsPanel } from '../settings/SettingsPanel'
import type { IdentityState } from '../identity/use-identity'
import type { RelaySetting } from '../settings/use-relay-setting'

interface DrawerProps {
  identity: IdentityState
  relay: RelaySetting
  relayOnline: boolean
  open: boolean
  onClose: () => void
}

/** Drawer latéral : identité, récupération seed, backup souverain, réglage relai. */
export function ProfileDrawer({ identity, relay, relayOnline, open, onClose }: DrawerProps): React.ReactElement {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-30" style={{ background: 'rgba(0,0,0,0.45)' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
          />
          <motion.aside
            initial={{ x: 380 }} animate={{ x: 0 }} exit={{ x: 380 }}
            transition={{ ease: [0.16, 1, 0.3, 1], duration: 0.4 }}
            className="fixed right-0 top-0 bottom-0 z-40 flex w-[380px] max-w-[92vw] flex-col gap-5 overflow-y-auto border-l p-6 backdrop-blur-md"
            style={{ borderColor: 'var(--line)', background: 'rgba(12,15,17,0.9)' }}
          >
            <header className="flex items-center justify-between">
              <span className="text-[11px] tracking-[0.3em]" style={{ color: 'var(--text-mid)' }}>PROFIL</span>
              <button onClick={onClose} title="fermer" style={{ color: 'var(--text-mid)' }}><X size={16} /></button>
            </header>
            <IdentityCard identity={identity} />
            <RecoveryPanel identity={identity} />
            <BackupPanel mnemonic={identity.mnemonic} selfAddr={identity.address} />
            <SettingsPanel relay={relay} relayOnline={relayOnline} />
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
