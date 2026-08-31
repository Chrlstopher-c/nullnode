import { IdentityCard } from '../../identity/IdentityCard'
import { RecoveryPanel } from '../../identity/RecoveryPanel'
import { BackupPanel } from '../../backup/BackupPanel'
import type { IdentityState } from '../../identity/use-identity'

/** Fenêtre identité : carte d'identité, récupération seed, backup souverain. */
export function IdentityWindow({ identity }: { identity: IdentityState }): React.ReactElement {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, padding: 14 }}>
      <IdentityCard identity={identity} />
      <RecoveryPanel identity={identity} />
      <BackupPanel mnemonic={identity.mnemonic} selfAddr={identity.address} />
    </div>
  )
}
