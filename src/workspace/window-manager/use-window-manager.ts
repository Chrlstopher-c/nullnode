import { useCallback, useState } from 'react'

export interface WinState {
  key: string
  x: number
  y: number
  z: number
  w: number
  h: number
}

interface OpenOpts { w?: number; h?: number }

export interface WindowManager {
  windows: WinState[]
  focusedKey: string | null
  isOpen: (key: string) => boolean
  open: (key: string, opts?: OpenOpts) => void
  toggle: (key: string, opts?: OpenOpts) => void
  focus: (key: string) => void
  close: (key: string) => void
  move: (key: string, x: number, y: number) => void
}

function spawnPosition(index: number, w: number, h: number): { x: number; y: number } {
  const offset = index * 24
  const x = Math.max(20, (window.innerWidth - w) / 2 + offset)
  const y = Math.max(20, (window.innerHeight - h) / 2 + offset - 40)
  return { x, y }
}

/** État des fenêtres flottantes : ouverture, focus/z-order, fermeture, déplacement. */
export function useWindowManager(): WindowManager {
  const [windows, setWindows] = useState<WinState[]>([])
  const [focusedKey, setFocusedKey] = useState<string | null>(null)
  const [zTop, setZTop] = useState(100)

  const isOpen = useCallback((key: string): boolean => windows.some((w) => w.key === key), [windows])

  const focus = useCallback((key: string): void => {
    setZTop((z) => {
      const next = z + 1
      setWindows((prev) => prev.map((w) => (w.key === key ? { ...w, z: next } : w)))
      return next
    })
    setFocusedKey(key)
  }, [])

  const open = useCallback((key: string, opts?: OpenOpts): void => {
    setWindows((prev) => {
      if (prev.some((w) => w.key === key)) return prev
      const w = opts?.w ?? 400
      const h = opts?.h ?? 460
      const pos = spawnPosition(prev.length, w, h)
      const z = zTop + 1
      return [...prev, { key, x: pos.x, y: pos.y, z, w, h }]
    })
    setZTop((z) => z + 1)
    setFocusedKey(key)
  }, [zTop])

  const close = useCallback((key: string): void => {
    setWindows((prev) => prev.filter((w) => w.key !== key))
    setFocusedKey((f) => (f === key ? null : f))
  }, [])

  const toggle = useCallback((key: string, opts?: OpenOpts): void => {
    setWindows((prev) => {
      const existing = prev.find((w) => w.key === key)
      if (!existing) {
        const w = opts?.w ?? 400
        const h = opts?.h ?? 460
        const pos = spawnPosition(prev.length, w, h)
        setZTop((z) => z + 1)
        setFocusedKey(key)
        return [...prev, { key, x: pos.x, y: pos.y, z: zTop + 1, w, h }]
      }
      const topmost = prev.every((w) => w.z <= existing.z)
      if (topmost && focusedKey === key) {
        setFocusedKey((f) => (f === key ? null : f))
        return prev.filter((w) => w.key !== key)
      }
      setZTop((z) => z + 1)
      setFocusedKey(key)
      return prev.map((w) => (w.key === key ? { ...w, z: zTop + 1 } : w))
    })
  }, [zTop, focusedKey])

  const move = useCallback((key: string, x: number, y: number): void => {
    setWindows((prev) => prev.map((w) => (w.key === key ? { ...w, x, y } : w)))
  }, [])

  return { windows, focusedKey, isOpen, open, toggle, focus, close, move }
}
