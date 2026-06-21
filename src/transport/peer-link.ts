/** Manual-signaling WebRTC link. No signaling server — SDP travels via dead-drop codes. */
type StateListener = (open: boolean) => void
type MessageListener = (raw: string) => void
type ControlListener = (frame: Record<string, unknown>) => void

/** Vrai si le brut est une trame de contrôle JSON (objet avec clé `c`), pas du ciphertext. */
function parseControl(raw: string): Record<string, unknown> | null {
  // Les payloads chiffrés ne sont jamais un objet JSON avec clé `c` → la distinction est sûre.
  if (raw.length === 0 || raw[0] !== '{') return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && 'c' in parsed) {
      return parsed as Record<string, unknown>
    }
    return null
  } catch {
    return null
  }
}

/** Resolve once ICE candidate gathering completes (so the SDP is self-contained). */
function waitForIce(pc: RTCPeerConnection): Promise<void> {
  if (pc.iceGatheringState === 'complete') return Promise.resolve()
  return new Promise((resolve) => {
    const check = (): void => {
      if (pc.iceGatheringState === 'complete') {
        pc.removeEventListener('icegatheringstatechange', check)
        resolve()
      }
    }
    pc.addEventListener('icegatheringstatechange', check)
    setTimeout(resolve, 2500)
  })
}

export class PeerLink {
  private pc: RTCPeerConnection
  private channel?: RTCDataChannel
  private onState: StateListener
  private onMessage: MessageListener
  private onControl: ControlListener

  constructor(onState: StateListener, onMessage: MessageListener, onControl?: ControlListener) {
    // No iceServers: LAN/host candidates only — fully sovereign, no external relay.
    this.pc = new RTCPeerConnection({ iceServers: [] })
    this.onState = onState
    this.onMessage = onMessage
    this.onControl = onControl ?? ((): void => {})
    this.pc.ondatachannel = (e) => this.bindChannel(e.channel)
  }

  private bindChannel(channel: RTCDataChannel): void {
    this.channel = channel
    channel.onopen = () => this.onState(true)
    channel.onclose = () => this.onState(false)
    channel.onmessage = (e) => this.route(e.data as string)
  }

  /** Route une trame brute : contrôle non chiffré (clé `c`) ou ciphertext applicatif. */
  private route(raw: string): void {
    const control = parseControl(raw)
    if (control) { this.onControl(control); return }
    this.onMessage(raw)
  }

  async createOffer(): Promise<RTCSessionDescriptionInit> {
    this.bindChannel(this.pc.createDataChannel('nullnode', { ordered: true }))
    await this.pc.setLocalDescription(await this.pc.createOffer())
    await waitForIce(this.pc)
    // localDescription is non-null after a successful setLocalDescription.
    return this.pc.localDescription as RTCSessionDescriptionInit
  }

  async acceptOffer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    await this.pc.setRemoteDescription(offer)
    await this.pc.setLocalDescription(await this.pc.createAnswer())
    await waitForIce(this.pc)
    // localDescription is non-null after a successful setLocalDescription.
    return this.pc.localDescription as RTCSessionDescriptionInit
  }

  async acceptAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    await this.pc.setRemoteDescription(answer)
  }

  send(raw: string): void {
    if (this.channel?.readyState === 'open') this.channel.send(raw)
  }

  /** Envoie une trame de contrôle en clair (JSON) — éphémère, non sensible (ex: typing). */
  sendControl(frame: Record<string, unknown>): void {
    if (this.channel?.readyState !== 'open') return
    try {
      this.channel.send(JSON.stringify(frame))
    } catch (err) {
      console.error('[session] sendControl failed', err)
    }
  }

  close(): void {
    this.channel?.close()
    this.pc.close()
  }
}
