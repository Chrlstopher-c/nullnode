import { useCallback, useRef } from 'react'
import type { WinState } from './use-window-manager'

interface Props {
  win: WinState
  icon: string
  title: string
  sub?: string
  focused: boolean
  autoHeight?: boolean
  onFocus: () => void
  onClose: () => void
  onMove: (x: number, y: number) => void
  onDragChange?: (dragging: boolean) => void
  children: React.ReactNode
}

/** Chrome d'une fenêtre flottante : titlebar draggable + corps. Clamp dans le viewport.
 * Le drag mute directement le DOM (left/top + classe dragging), sans re-render React par
 * mouvement : la position n'est commitée dans l'état qu'au relâchement. Évite la tempête de
 * re-render qui, combinée au compositing, provoquait le clignotement. */
export function Window({
  win, icon, title, sub, focused, autoHeight, onFocus, onClose, onMove, onDragChange, children,
}: Props): React.ReactElement {
  const elRef = useRef<HTMLDivElement | null>(null)
  const drag = useRef<{ sx: number; sy: number; ox: number; oy: number; x: number; y: number } | null>(null)

  const onPointerDown = useCallback((e: React.PointerEvent): void => {
    // narrowing DOM : la cible d'un PointerEvent est typée EventTarget, ici toujours un élément
    if ((e.target as HTMLElement).closest('.ws-ctrl')) return
    onFocus()
    drag.current = { sx: e.clientX, sy: e.clientY, ox: win.x, oy: win.y, x: win.x, y: win.y }
    elRef.current?.classList.add('dragging')
    onDragChange?.(true)
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }, [onFocus, onDragChange, win.x, win.y])

  const onPointerMove = useCallback((e: React.PointerEvent): void => {
    const d = drag.current
    const el = elRef.current
    if (!d || !el) return
    const h = autoHeight ? el.offsetHeight : win.h
    let nx = d.ox + (e.clientX - d.sx)
    let ny = d.oy + (e.clientY - d.sy)
    nx = Math.max(8, Math.min(window.innerWidth - win.w - 8, nx))
    ny = Math.max(8, Math.min(window.innerHeight - h - 8, ny))
    d.x = nx; d.y = ny
    // transform = GPU pur, aucun reflow/repaint ; la position left/top n'est commitée qu'au drop
    el.style.transform = `translate(${nx - d.ox}px, ${ny - d.oy}px)`
  }, [autoHeight, win.w, win.h])

  const onPointerUp = useCallback((e: React.PointerEvent): void => {
    const d = drag.current
    drag.current = null
    const el = elRef.current
    el?.classList.remove('dragging')
    onDragChange?.(false)
    ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    if (d && el) {
      // replie le translate dans left/top puis nettoie le transform → aucun saut visuel
      el.style.left = d.x + 'px'; el.style.top = d.y + 'px'; el.style.transform = ''
      onMove(d.x, d.y)
    }
  }, [onMove, onDragChange])

  return (
    <div
      ref={elRef}
      className={'ws-win' + (focused ? ' focused' : '')}
      style={{ left: win.x, top: win.y, width: win.w, height: autoHeight ? 'auto' : win.h, zIndex: win.z }}
      onMouseDown={onFocus}
    >
      <div
        className="ws-titlebar"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <span className="icon">{icon}</span>
        <span className="title">{title}</span>
        {sub && <span className="sub">{sub}</span>}
        <button className="ws-ctrl" title="fermer" onClick={onClose}>✕</button>
      </div>
      <div className="ws-body">{children}</div>
    </div>
  )
}
