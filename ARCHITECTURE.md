# ARCHITECTURE — NULLNODE

Messagerie P2P chiffrée end-to-end, design-first, **souveraine** : pas de serveur central
imposé. Le rendez-vous passe par un **node aveugle self-hosted** (sur le Pi de Chris) qui ne
voit que des adresses publiques et des blobs chiffrés — jamais les messages. Fallback dead-drop
(codes SDP) si pas de relai. Identité dérivée d'une seed BIP39, chiffrée at-rest par un PIN.

## Carte des domaines (`src/`)

Organisation par domaine métier (screaming architecture), pas par couche technique.

| Domaine | Responsabilité unique | Frontière publique |
|---|---|---|
| `crypto/` | Primitives libsodium (KX, ChaCha20-Poly1305, fingerprint). Les clés ne quittent jamais la mémoire. | `deriveSession`, `seal`, `open`, `ensureReady` |
| `identity/` | Identité persistante (seed BIP39) + adresse + handle + **vault PIN** (chiffrement at-rest). | `useIdentity`, `encodeAddress`, `callsign`, `seed-vault` |
| `auth/` | Porte d'entrée : login / register / unlock selon l'état (anon/locked/ready). Présentation. | `AuthGate` |
| `roster/` | Carnet d'amis local, **cloisonné par compte** (CRUD, présence, confiance). Aucun annuaire. | `useRoster`, `NetworkPanel` |
| `rendezvous/` | Client du node aveugle : présence, friend-requests, DM relayés, backup. Scellage des signaux. | `useRendezvous`, `RendezvousClient` |
| `transport/` | Lien WebRTC P2P + dead-drops SDP (fallback). Aucune logique crypto. | `PeerLink`, `encodeDrop`, `decodeDrop` |
| `session/` | Orchestration : relie identité, transport et chiffrement. Historique cloisonné par compte. | `useSecureSession` |
| `backup/` | Backup zero-knowledge (blob chiffré seed-derived) + merge convergent + export fichier. | `BackupPanel`, `collectBackupState`, `mergeBackupState` |
| `comms/` | Console interactive : connexion puis flux de messages chiffrés + non-lus. | `CommsConsole` |
| `settings/` | Source du node de rendez-vous (presets + URL) + indicateur d'état. | `useRelaySetting`, `SettingsPanel` |
| `desktop/` | Pont vers le daemon Tauri (présence/handoff). **No-op hors Tauri** (build web pur intact). | `tauri-bridge`, `useDesktopPresence` |
| `visualizer/` | Scène WebGL (r3f) du réseau. Lecture seule de la phase, aucune logique métier. | `NetworkScene` |
| `hud/` `boot/` | Bandeaux techniques + overlay d'intro. Présentation pure. | `HudOverlay`, `BootSequence` |
| `shared/` | Types transverses + **stockage cloisonné par compte** + design tokens. Uniquement le partagé. | `local-store`, `types`, `design/tokens.css` |

## Composants hors `src/`

- **`relay/`** — node de rendez-vous aveugle (Bun WS, déployé H24 sur le Pi). Ne lit jamais les
  payloads : route les signaux, fait du store-and-forward (TTL + caps), stocke des backups opaques.
  Bornes anti-abus dans `limits.ts` (env `RELAY_*`).
- **`src-tauri/`** — daemon desktop (Tauri 2 / Rust). Ghost process au boot : tient la présence
  relay quand la GUI est fermée, tray, GUI à la demande. **Aucune seed côté Rust.**

## Définitions anti-recouvrement

- **transport** = tuyau (WebRTC, SDP). Ne chiffre rien, ignore le contenu.
- **crypto** = serrure (clés, scellage). Ignore le réseau.
- **session** = seul domaine autorisé à composer crypto + transport pour une conversation.
- **rendezvous** = client du node (présence/signaling/relay/backup). Ne déchiffre pas les DM (délègue à session).
- **visualizer / hud / comms / auth** = présentation. Ne touchent ni au réseau ni aux clés en direct.

## Frontières fortes

- L'UI ne parle jamais à `transport`/`crypto` en direct → toujours via `session`.
- La seed/les clés ne touchent **jamais** le Rust (daemon) : l'adresse publique suffit à la présence.
- **Handoff daemon/GUI** : le relay ne garde qu'1 socket par adresse → daemon et GUI ne sont
  jamais connectés en même temps. Ouverture GUI → daemon stop ; fermeture → daemon restart.
- Stockage par compte : `acct.<address>.*`. Le split `App`/`SessionApp` garantit que les hooks
  par-compte montent avec une adresse connue (chargement synchrone, zéro fuite inter-comptes).
- Un import vers l'interne d'un domaine (hors interface publique listée) = red flag.

## Choix techniques structurants

- **Tauri 2** (et non Electron) : daemon natif Rust léger pour le ghost process (présence H24
  à coût quasi nul), webview à la demande. La crypto reste côté JS.
- **libsodium-wrappers-sumo** (toute l'app) : le build base n'expose pas `crypto_pwhash` (Argon2),
  requis pour le vault PIN. Constantes sodium lues à l'appel (après `ready`), jamais au top-level.
- **Pas de STUN/TURN** par défaut : candidats hôte/LAN, souveraineté. STUN optionnel pour le WAN (dette).
- **Node aveugle self-hosted** plutôt que serveur tiers : souveraineté = sa propre machine (le Pi),
  exposée via Cloudflare Tunnel. « Zéro dépendance externe imposée » ≠ « zéro machine ».
