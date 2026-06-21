// Wrapper WebSocket framework-agnostic pour le relai de rendez-vous aveugle.
// Conforme à RENDEZVOUS-PROTOCOL.md : présence + acheminement de blobs opaques.

export interface RendezvousHandlers {
  onOpen(online: string[], away: string[]): void
  onPeers(count: number): void
  onPresence(addr: string, state: 'online' | 'away' | 'offline'): void
  onSignal(from: string, payload: string): void
  onEnvelope(id: string, from: string, payload: string): void
  onBackup(blob: string | null): void
  onClose(): void
}

const HEARTBEAT_MS = 25_000
const BACKOFF_MIN_MS = 1_000
const BACKOFF_MAX_MS = 15_000

interface IncomingMessage {
  t: string
  online?: string[]
  away?: string[]
  count?: number
  addr?: string
  state?: 'online' | 'away' | 'offline'
  from?: string
  payload?: string
  id?: string
  blob?: string | null
  code?: string
}

export class RendezvousClient {
  private socket: WebSocket | null = null
  private heartbeat: ReturnType<typeof setInterval> | null = null
  private reconnect: ReturnType<typeof setTimeout> | null = null
  private backoff = BACKOFF_MIN_MS
  private closing = false

  constructor(
    private readonly url: string,
    private readonly selfAddr: string,
    private readonly handlers: RendezvousHandlers,
  ) {}

  /** Ouvre le WebSocket et branche les listeners. */
  connect(): void {
    this.closing = false
    try {
      const ws = new WebSocket(this.url)
      this.socket = ws
      ws.onopen = (): void => this.onSocketOpen()
      ws.onmessage = (ev: MessageEvent): void => this.onSocketMessage(ev)
      ws.onerror = (): void => console.error('[rendezvous] socket error')
      ws.onclose = (): void => this.onSocketClose()
    } catch (err) {
      console.error('[rendezvous] connect failed', err)
      this.scheduleReconnect()
    }
  }

  /** Achemine un blob opaque vers `to` si le socket est ouvert. */
  signal(to: string, payload: string): void {
    this.sendRaw({ t: 'signal', to, payload })
  }

  /** Envoie une enveloppe applicative store-and-forward (délivrée même si offline). */
  relay(to: string, payload: string): void {
    this.sendRaw({ t: 'relay', to, payload })
  }

  /** Accuse réception d'envelopes délivrées (le relai les supprime). */
  ack(ids: string[]): void {
    if (ids.length) this.sendRaw({ t: 'ack', ids })
  }

  /** Pousse le blob de backup chiffré (opaque pour le relai), écrase le précédent. */
  backupPut(blob: string): void {
    this.sendRaw({ t: 'backup_put', blob })
  }

  /** Demande le blob de backup stocké sous notre adresse. */
  backupGet(): void {
    this.sendRaw({ t: 'backup_get' })
  }

  /** Met à jour notre état de présence (propagé aux pairs par le relai). */
  setPresence(state: 'online' | 'away'): void {
    this.sendRaw({ t: 'presence_set', state })
  }

  /** Ferme proprement : stoppe heartbeat + reconnexion, ferme le socket. */
  close(): void {
    this.closing = true
    this.stopHeartbeat()
    if (this.reconnect) {
      clearTimeout(this.reconnect)
      this.reconnect = null
    }
    this.socket?.close()
  }

  private onSocketOpen(): void {
    this.backoff = BACKOFF_MIN_MS
    this.sendRaw({ t: 'hello', addr: this.selfAddr })
    this.startHeartbeat()
  }

  private onSocketMessage(ev: MessageEvent): void {
    try {
      const raw: unknown = JSON.parse(String(ev.data))
      this.dispatch(raw)
    } catch (err) {
      console.error('[rendezvous] message parse failed', err)
    }
  }

  private dispatch(raw: unknown): void {
    if (typeof raw !== 'object' || raw === null) return
    const msg = raw as IncomingMessage // narrowing : objet non-null, champs lus défensivement.
    switch (msg.t) {
      case 'welcome':
        this.handlers.onOpen(msg.online ?? [], msg.away ?? [])
        if (typeof msg.count === 'number') this.handlers.onPeers(msg.count)
        return
      case 'peers':
        if (typeof msg.count === 'number') this.handlers.onPeers(msg.count)
        return
      case 'presence':
        if (msg.addr && msg.state) this.handlers.onPresence(msg.addr, msg.state)
        return
      case 'signal':
        if (msg.from && msg.payload) this.handlers.onSignal(msg.from, msg.payload)
        return
      case 'envelope':
        if (msg.id && msg.from && msg.payload) this.handlers.onEnvelope(msg.id, msg.from, msg.payload)
        return
      case 'backup':
        return this.handlers.onBackup(msg.blob ?? null)
      case 'pong':
        return
      case 'error':
        return console.error('[rendezvous] relay error', msg.code)
      default:
        return
    }
  }

  private sendRaw(obj: Record<string, unknown>): void {
    if (this.socket?.readyState !== WebSocket.OPEN) return
    try {
      this.socket.send(JSON.stringify(obj))
    } catch (err) {
      console.error('[rendezvous] send failed', err)
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat()
    this.heartbeat = setInterval(() => this.sendRaw({ t: 'ping' }), HEARTBEAT_MS)
  }

  private stopHeartbeat(): void {
    if (this.heartbeat) {
      clearInterval(this.heartbeat)
      this.heartbeat = null
    }
  }

  private onSocketClose(): void {
    this.stopHeartbeat()
    this.handlers.onClose()
    if (!this.closing) this.scheduleReconnect()
  }

  private scheduleReconnect(): void {
    if (this.closing || this.reconnect) return
    const delay = this.backoff
    this.backoff = Math.min(this.backoff * 2, BACKOFF_MAX_MS)
    this.reconnect = setTimeout(() => {
      this.reconnect = null
      this.connect()
    }, delay)
  }
}
