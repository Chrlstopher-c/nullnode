import { useEffect, useRef, useState } from 'react'
import { loadJSON, saveJSON, loadAccount, saveAccount, migrateAccount } from '../shared/local-store'
import { callsign, encodeAddress, handle } from './address'
import { identityFromMnemonic, isValidMnemonic } from './seed'
import { isVaultBlob, openSeed, sealSeed } from './vault/seed-vault'
import type { VaultBlob } from './vault/seed-vault'
import type { Identity } from '../shared/types'

const VAULT_KEY = 'seed-vault'
const LEGACY_KEY = 'seed-phrase'
const SESSION_KEY = 'nullnode.session-seed'

export type AuthStatus = 'loading' | 'anon' | 'locked' | 'ready'

interface AuthResult {
  ok: boolean
  error?: string
}

/** Lit la mnemonic déverrouillée pour cette session de navigateur (volatile). */
function loadSessionSeed(): string {
  try {
    return sessionStorage.getItem(SESSION_KEY) ?? ''
  } catch (err) {
    console.error('[identity] session read failed', err)
    return ''
  }
}

/** Mémorise la mnemonic en sessionStorage pour survivre aux refresh (pas aux fermetures). */
function saveSessionSeed(mnemonic: string): void {
  try {
    sessionStorage.setItem(SESSION_KEY, mnemonic)
  } catch (err) {
    console.error('[identity] session write failed', err)
  }
}

interface StartupState {
  status: AuthStatus
  mnemonic: string
  legacy: string | null
}

/** Décide l'état initial : session ouverte → ready, vault → locked, legacy clair → anon+migration, rien → anon. */
function resolveStartup(): StartupState {
  const sessionSeed = loadSessionSeed()
  if (sessionSeed && isValidMnemonic(sessionSeed)) {
    return { status: 'ready', mnemonic: sessionSeed, legacy: null }
  }
  const vault = loadJSON<unknown>(VAULT_KEY, null)
  if (isVaultBlob(vault)) {
    return { status: 'locked', mnemonic: '', legacy: null }
  }
  const legacy = loadJSON<string>(LEGACY_KEY, '')
  const hasLegacy = Boolean(legacy) && isValidMnemonic(legacy)
  return { status: 'anon', mnemonic: '', legacy: hasLegacy ? legacy : null }
}

export interface IdentityState {
  status: AuthStatus
  identity: Identity | null
  address: string
  callsign: string
  pseudo: string
  handle: string
  mnemonic: string
  hasLegacySeed: boolean
  setPseudo: (next: string) => void
  refreshPseudo: () => void
  unlock: (pin: string) => Promise<AuthResult>
  register: (words: string, name: string, pin: string) => Promise<AuthResult>
  importMnemonic: (words: string, pin: string) => Promise<AuthResult>
  migrateLegacy: (pin: string) => Promise<AuthResult>
}

/** Identité persistante dérivée d'une phrase BIP39, scellée at-rest par un PIN. */
export function useIdentity(): IdentityState {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [identity, setIdentity] = useState<Identity | null>(null)
  const [mnemonic, setMnemonic] = useState('')
  const [legacySeed, setLegacySeed] = useState<string | null>(null)
  const [pseudo, setPseudoState] = useState<string>('')
  const addrRef = useRef('')

  // Active la partition de stockage du compte (migration unique des clés globales héritées)
  // et charge son pseudo. Point unique où l'adresse du compte actif devient connue.
  const enterWith = async (clean: string): Promise<void> => {
    const id = await identityFromMnemonic(clean)
    const addr = encodeAddress(id.publicKey)
    addrRef.current = addr
    saveSessionSeed(clean)
    migrateAccount(addr)
    setIdentity(id); setMnemonic(clean)
    setPseudoState(loadAccount<string>(addr, 'pseudo', ''))
    setStatus('ready')
  }

  useEffect(() => {
    const s = resolveStartup()
    if (s.status === 'ready' && s.mnemonic) {
      enterWith(s.mnemonic).catch((err) => { console.error('[identity] startup failed', err); setStatus('anon') })
      return
    }
    setLegacySeed(s.legacy); setStatus(s.status)
  }, [])

  const persistVault = async (clean: string, pin: string): Promise<AuthResult> => {
    const blob = await sealSeed(clean, pin)
    if (!blob) return { ok: false, error: 'VAULT SEAL FAILED' }
    saveJSON<VaultBlob>(VAULT_KEY, blob)
    localStorage.removeItem('nullnode.' + LEGACY_KEY)
    return { ok: true }
  }

  const setPseudo = (next: string): void => {
    setPseudoState(next)
    if (addrRef.current) saveAccount(addrRef.current, 'pseudo', next)
  }
  const refreshPseudo = (): void => setPseudoState(loadAccount<string>(addrRef.current, 'pseudo', ''))

  const unlock = async (pin: string): Promise<AuthResult> => {
    try {
      const vault = loadJSON<unknown>(VAULT_KEY, null)
      if (!isVaultBlob(vault)) return { ok: false, error: 'NO VAULT' }
      const seed = await openSeed(vault, pin)
      if (!seed || !isValidMnemonic(seed)) return { ok: false, error: 'WRONG PIN' }
      await enterWith(seed)
      return { ok: true }
    } catch (err) {
      console.error('[identity] unlock failed', err)
      return { ok: false, error: 'UNLOCK FAILED' }
    }
  }

  const register = async (words: string, name: string, pin: string): Promise<AuthResult> => {
    const clean = words.trim().toLowerCase()
    if (!isValidMnemonic(clean)) return { ok: false, error: 'INVALID PHRASE' }
    const sealed = await persistVault(clean, pin)
    if (!sealed.ok) return sealed
    await enterWith(clean)
    setPseudo(name.trim())
    return { ok: true }
  }

  const importMnemonic = async (words: string, pin: string): Promise<AuthResult> => {
    const clean = words.trim().toLowerCase()
    if (!isValidMnemonic(clean)) return { ok: false, error: 'INVALID RECOVERY PHRASE' }
    const sealed = await persistVault(clean, pin)
    if (!sealed.ok) return sealed
    await enterWith(clean)
    return { ok: true }
  }

  const migrateLegacy = async (pin: string): Promise<AuthResult> => {
    if (!legacySeed || !isValidMnemonic(legacySeed)) return { ok: false, error: 'NO LEGACY SEED' }
    const sealed = await persistVault(legacySeed, pin)
    if (!sealed.ok) return sealed
    setLegacySeed(null)
    await enterWith(legacySeed)
    return { ok: true }
  }

  const effectivePseudo = pseudo || (identity ? callsign(identity.publicKey) : '')
  return {
    status,
    identity,
    address: identity ? encodeAddress(identity.publicKey) : '',
    callsign: identity ? callsign(identity.publicKey) : '',
    pseudo: effectivePseudo,
    handle: identity ? handle(effectivePseudo, identity.publicKey) : '',
    mnemonic,
    hasLegacySeed: legacySeed !== null,
    setPseudo,
    refreshPseudo,
    unlock,
    register,
    importMnemonic,
    migrateLegacy,
  }
}
