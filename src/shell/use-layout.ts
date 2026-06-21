import { useCallback, useState } from 'react'
import { loadJSON, saveJSON } from '../shared/local-store'

export type SidebarTab = 'chats' | 'amis' | 'demandes'

const TAB_KEY = 'ui.tab'
const SIDEBAR_KEY = 'ui.sidebar'

export interface LayoutState {
  tab: SidebarTab
  setTab: (t: SidebarTab) => void
  sidebarOpen: boolean
  toggleSidebar: () => void
  profileOpen: boolean
  setProfileOpen: (v: boolean) => void
  query: string
  setQuery: (q: string) => void
}

/** État d'affichage du shell : onglet, repli sidebar (persistés), drawer profil, recherche. */
export function useLayout(): LayoutState {
  const [tab, setTabState] = useState<SidebarTab>(() => loadJSON<SidebarTab>(TAB_KEY, 'chats'))
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() => loadJSON<boolean>(SIDEBAR_KEY, true))
  const [profileOpen, setProfileOpen] = useState(false)
  const [query, setQuery] = useState('')

  const setTab = useCallback((t: SidebarTab): void => { setTabState(t); saveJSON(TAB_KEY, t) }, [])
  const toggleSidebar = useCallback((): void => {
    setSidebarOpen((v) => { const next = !v; saveJSON(SIDEBAR_KEY, next); return next })
  }, [])

  return { tab, setTab, sidebarOpen, toggleSidebar, profileOpen, setProfileOpen, query, setQuery }
}
