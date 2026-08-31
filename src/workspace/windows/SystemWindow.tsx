import { SettingsPanel } from '../../settings/SettingsPanel'
import { VisualSettingsPanel } from '../../settings/VisualSettingsPanel'
import type { RelaySetting } from '../../settings/use-relay-setting'
import type { VisualSetting } from '../../settings/use-visual-setting'

interface Props {
  relay: RelaySetting
  relayOnline: boolean
  visual: VisualSetting
}

/** Fenêtre système : relai, réglages visuels, à-propos. */
export function SystemWindow({ relay, relayOnline, visual }: Props): React.ReactElement {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, padding: 14 }}>
      <div>
        <div className="ws-pane-label">relay network</div>
        <SettingsPanel relay={relay} relayOnline={relayOnline} defaultOpen />
      </div>
      <VisualSettingsPanel setting={visual} />
      <div>
        <div className="ws-pane-label">about</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11 }}>
          <Line k="cipher" v="ChaCha20-Poly1305" />
          <Line k="transport" v="WebRTC / P2P" ok />
          <Line k="build" v="souverain · self-hosted" />
        </div>
      </div>
    </div>
  )
}

function Line({ k, v, ok }: { k: string; v: string; ok?: boolean }): React.ReactElement {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span style={{ color: 'var(--text-mid)', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 10 }}>{k}</span>
      <span style={{ color: ok ? 'var(--accent)' : 'var(--text-hi)' }}>{v}</span>
    </div>
  )
}
