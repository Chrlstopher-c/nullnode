import { useCallback, useState } from 'react'
import { loadRelayUrl, saveRelayUrl } from './relay-config'

export interface RelaySetting {
  relayUrl: string
  setRelayUrl: (url: string) => void
}

/** URL du node de rendez-vous, persistée. La changer reconnecte le client (via useRendezvous). */
export function useRelaySetting(): RelaySetting {
  const [relayUrl, setUrl] = useState<string>(() => loadRelayUrl())

  const setRelayUrl = useCallback((url: string): void => {
    const clean = url.trim()
    if (!clean) return
    saveRelayUrl(clean)
    setUrl(clean)
  }, [])

  return { relayUrl, setRelayUrl }
}
