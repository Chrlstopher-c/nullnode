/* Moteur 2D pur de la topologie réseau. Aucun React : piloté par snapshots de l'état réel
 * (amis joignables, sessions live, relai) et par des impulsions de message.
 * Perf : aucune ombre canvas (shadowBlur tue le thread) — lueurs en sprites pré-rendus ;
 * DPR plafonné ; boucle throttlée ; pause externe pendant le drag de fenêtre.
 * CRUCIAL en rendu logiciel (WebKitGTK/NVIDIA, DMABUF off) : la boucle est EVENT-DRIVEN — elle
 * ne tourne que tant que quelque chose s'anime (pulse en vol, node en fondu) puis s'ARRÊTE et tient
 * la dernière frame. Hors GPU accéléré, la dérive idle perpétuelle est coupée → ~0 CPU au repos. */


export type PeerVizState = 'connected' | 'online' | 'away'

export interface PeerSnapshot {
  id: string
  state: PeerVizState
  verified: boolean
}

export interface TopologySnapshot {
  relayOnline: boolean
  peers: PeerSnapshot[]
}

interface Node {
  id: string
  x: number
  y: number
  vx: number
  vy: number
  r: number
  opacity: number
  fadingOut: boolean
  state: PeerVizState
}

interface Pulse {
  toId: string
  t: number
  speed: number
}

interface IdleNode {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  opacity: number
}

const AMBER: [number, number, number] = [255, 176, 32]
const DANGER: [number, number, number] = [255, 59, 84]
const IDLE_COUNT = 22
const PEER_DIST = 168
const FRAME_MS = 33 // ~30 fps : largement suffisant pour une dérive lente, moitié moins de charge

function hashAngle(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return (h % 360) * (Math.PI / 180)
}

function rand(a: number, b: number): number { return a + Math.random() * (b - a) }

/** Lit l'accent courant depuis les CSS vars → bascule phosphor/ambre gérée gratuitement. */
function readAccent(): [number, number, number] {
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()
  const m = raw.match(/^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i)
  if (!m) return [0, 255, 157]
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)]
}

export class TopologyEngine {
  private ctx: CanvasRenderingContext2D
  private w = 0
  private h = 0
  private dpr = 1
  private raf = 0
  private hidden = false
  private externalPause = false
  private lastT = performance.now()
  private acc = 0
  private accent: [number, number, number] = [0, 255, 157]

  private nodes = new Map<string, Node>()
  private idle: IdleNode[] = []
  private pulses: Pulse[] = []
  private relayOnline = true
  private local = { x: 0, y: 0 }
  private relay = { x: 0, y: 0, r: 6 }
  private glowCache = new Map<string, HTMLCanvasElement>()

  reducedMotion = false
  private canvas: HTMLCanvasElement

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas 2d context unavailable')
    this.ctx = ctx
    this.resize()
    this.accent = readAccent()
    this.spawnIdle()
    this.onResize = this.onResize.bind(this)
    this.onVisibility = this.onVisibility.bind(this)
    window.addEventListener('resize', this.onResize)
    document.addEventListener('visibilitychange', this.onVisibility)
    this.loop = this.loop.bind(this)
    this.raf = requestAnimationFrame(this.loop)
  }

  destroy(): void {
    cancelAnimationFrame(this.raf)
    window.removeEventListener('resize', this.onResize)
    document.removeEventListener('visibilitychange', this.onVisibility)
  }

  /** Gèle le rendu (ex. pendant le drag d'une fenêtre) : zéro repaint canvas = drag fluide. */
  setPaused(p: boolean): void { this.externalPause = p }

  private onResize(): void { this.resize() }
  private onVisibility(): void { this.hidden = document.hidden }

  private resize(): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, 1.5)
    this.w = window.innerWidth
    this.h = window.innerHeight
    this.canvas.width = Math.round(this.w * this.dpr)
    this.canvas.height = Math.round(this.h * this.dpr)
    this.canvas.style.width = this.w + 'px'
    this.canvas.style.height = this.h + 'px'
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    this.local = { x: this.w * 0.5, y: this.h * 0.46 }
    this.relay = { x: this.local.x + 102, y: this.local.y - 62, r: 6 }
  }

  private spawnIdle(): void {
    this.idle = []
    for (let i = 0; i < IDLE_COUNT; i++) {
      this.idle.push({
        x: rand(0, this.w), y: rand(0, this.h), vx: rand(-0.04, 0.04), vy: rand(-0.04, 0.04),
        r: rand(1, 1.8), opacity: rand(0.2, 0.45),
      })
    }
  }

  /** Sprite de lueur pré-rendu (gradient radial), mis en cache par couleur+rayon. */
  private glow(c: [number, number, number], radius: number): HTMLCanvasElement {
    const key = c.join(',') + '|' + radius
    const cached = this.glowCache.get(key)
    if (cached) return cached
    const size = Math.ceil(radius * 2)
    const off = document.createElement('canvas')
    off.width = size; off.height = size
    const g = off.getContext('2d')
    if (g) {
      const grad = g.createRadialGradient(radius, radius, 0, radius, radius, radius)
      grad.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},0.55)`)
      grad.addColorStop(0.4, `rgba(${c[0]},${c[1]},${c[2]},0.22)`)
      grad.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`)
      g.fillStyle = grad
      g.fillRect(0, 0, size, size)
    }
    this.glowCache.set(key, off)
    return off
  }

  private blitGlow(c: [number, number, number], x: number, y: number, radius: number, alpha: number): void {
    const sprite = this.glow(c, radius)
    this.ctx.globalAlpha = alpha
    this.ctx.drawImage(sprite, x - radius, y - radius)
    this.ctx.globalAlpha = 1
  }

  /** Réconcilie les nodes avec l'état réel : ajoute/fade les pairs apparus/disparus. */
  sync(snap: TopologySnapshot): void {
    const next = readAccent()
    if (next[0] !== this.accent[0] || next[1] !== this.accent[1] || next[2] !== this.accent[2]) {
      this.accent = next
      this.glowCache.clear() // l'accent a changé → invalide les sprites mis en cache
    }
    this.relayOnline = snap.relayOnline
    const seen = new Set<string>()
    for (const p of snap.peers) {
      seen.add(p.id)
      const existing = this.nodes.get(p.id)
      if (existing) { existing.state = p.state; existing.fadingOut = false }
      else {
        const a = hashAngle(p.id)
        this.nodes.set(p.id, {
          id: p.id, x: this.local.x + Math.cos(a) * PEER_DIST, y: this.local.y + Math.sin(a) * PEER_DIST,
          vx: rand(-0.02, 0.02), vy: rand(-0.02, 0.02), r: 3.6, opacity: 0, fadingOut: false, state: p.state,
        })
      }
    }
    for (const [id, n] of this.nodes) if (!seen.has(id)) n.fadingOut = true
  }

  pulse(peerId: string): void {
    if (!this.nodes.has(peerId)) return
    this.pulses.push({ toId: peerId, t: 0, speed: 0.022 + Math.random() * 0.01 })
  }

  private step(dt: number): void {
    const mul = this.reducedMotion ? 0 : 1
    for (const n of this.idle) {
      n.x += n.vx * dt * mul; n.y += n.vy * dt * mul
      if (n.x < -10) n.x = this.w + 10; if (n.x > this.w + 10) n.x = -10
      if (n.y < -10) n.y = this.h + 10; if (n.y > this.h + 10) n.y = -10
    }
    for (const [id, n] of this.nodes) {
      n.x += n.vx * dt * mul; n.y += n.vy * dt * mul
      if (n.fadingOut) { n.opacity -= 0.045 * dt; if (n.opacity <= 0) this.nodes.delete(id) }
      else if (n.opacity < 1) { n.opacity = Math.min(1, n.opacity + 0.04 * dt) }
    }
    for (const p of this.pulses) p.t += p.speed * dt
    this.pulses = this.pulses.filter((p) => p.t < 1 && this.nodes.has(p.toId))
  }

  private rgba(c: [number, number, number], a: number): string { return `rgba(${c[0]},${c[1]},${c[2]},${a})` }

  private draw(): void {
    const ctx = this.ctx
    ctx.clearRect(0, 0, this.w, this.h)
    this.drawIdle()
    this.drawRelay()
    this.drawPeers()
    this.drawPulses()
    this.drawLocal()
  }

  private drawIdle(): void {
    const ctx = this.ctx
    ctx.lineWidth = 0.6
    for (let i = 0; i < this.idle.length; i++) {
      for (let j = i + 1; j < this.idle.length; j++) {
        const a = this.idle[i], b = this.idle[j], d = Math.hypot(a.x - b.x, a.y - b.y)
        if (d < 140) {
          ctx.strokeStyle = this.rgba(this.accent, (1 - d / 140) * 0.08)
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
        }
      }
    }
    for (const n of this.idle) {
      ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2)
      ctx.fillStyle = this.rgba(this.accent, n.opacity * 0.4); ctx.fill()
    }
  }

  private drawRelay(): void {
    const ctx = this.ctx
    const c = this.relayOnline ? this.accent : DANGER
    ctx.strokeStyle = this.rgba(c, this.relayOnline ? 0.4 : 0.6)
    ctx.lineWidth = this.relayOnline ? 1.2 : 1.6
    ctx.beginPath(); ctx.moveTo(this.local.x, this.local.y); ctx.lineTo(this.relay.x, this.relay.y); ctx.stroke()
    this.blitGlow(c, this.relay.x, this.relay.y, 18, 1)
    ctx.beginPath(); ctx.arc(this.relay.x, this.relay.y, this.relay.r, 0, Math.PI * 2)
    ctx.fillStyle = this.rgba(c, 0.95); ctx.fill()
    ctx.beginPath(); ctx.arc(this.relay.x, this.relay.y, this.relay.r + 5, 0, Math.PI * 2)
    ctx.strokeStyle = this.rgba(c, 0.28); ctx.lineWidth = 0.8; ctx.stroke()
  }

  private drawPeers(): void {
    const ctx = this.ctx
    for (const n of this.nodes.values()) {
      const live = n.state === 'connected'
      const col = n.state === 'away' ? AMBER : this.accent
      const lineOp = (live ? 0.5 : 0.18) * n.opacity
      ctx.save()
      if (!live) ctx.setLineDash([4, 5])
      ctx.strokeStyle = this.rgba(col, Math.min(lineOp, 0.6))
      ctx.lineWidth = live ? 1.1 : 0.9
      ctx.beginPath(); ctx.moveTo(this.local.x, this.local.y); ctx.lineTo(n.x, n.y); ctx.stroke()
      ctx.restore()
      this.blitGlow(col, n.x, n.y, live ? 12 : 8, n.opacity)
      ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2)
      ctx.fillStyle = this.rgba(col, 0.9 * n.opacity); ctx.fill()
    }
  }

  private drawPulses(): void {
    const ctx = this.ctx
    for (const p of this.pulses) {
      const to = this.nodes.get(p.toId)
      if (!to) continue
      const x = this.local.x + (to.x - this.local.x) * p.t
      const y = this.local.y + (to.y - this.local.y) * p.t
      const fade = Math.sin(p.t * Math.PI)
      this.blitGlow(this.accent, x, y, 14, fade)
      ctx.beginPath(); ctx.arc(x, y, 3.2, 0, Math.PI * 2)
      ctx.fillStyle = this.rgba(this.accent, 0.9 * fade); ctx.fill()
    }
  }

  private drawLocal(): void {
    const ctx = this.ctx
    this.blitGlow(this.accent, this.local.x, this.local.y, 18, 1)
    ctx.beginPath(); ctx.arc(this.local.x, this.local.y, 4.5, 0, Math.PI * 2)
    ctx.fillStyle = this.rgba(this.accent, 0.95); ctx.fill()
    ctx.beginPath(); ctx.arc(this.local.x, this.local.y, 9.5, 0, Math.PI * 2)
    ctx.strokeStyle = this.rgba(this.accent, 0.22); ctx.lineWidth = 0.8; ctx.stroke()
  }

  private loop(now: number): void {
    this.raf = requestAnimationFrame(this.loop)
    if (this.hidden || this.externalPause) { this.lastT = now; return }
    const elapsed = now - this.lastT
    this.lastT = now
    this.acc += elapsed
    if (this.acc < FRAME_MS) return // throttle ~30 fps
    const dt = Math.min(this.acc, 50) / 16.67
    this.acc = 0
    this.step(dt)
    this.draw()
  }
}
