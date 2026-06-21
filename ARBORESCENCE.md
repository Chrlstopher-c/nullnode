# ARBORESCENCE — NULLNODE

```
src/
  main.tsx                      Point d'entrée React
  App.tsx                       Porte : scène + AuthGate (anon/locked) OU <SessionApp> (ready)
  SessionApp.tsx                App authentifiée : hooks par-compte (adresse garantie) + panneaux
  index.css                     Tailwind v4 + fonts + design system global
  shared/
    types.ts                    Types transverses (phase, identité, message)
    local-store.ts              localStorage typé + stockage cloisonné par compte (acct.<addr>.*)
    design/tokens.css           Variables CSS du design system (surfaces, accent, motion)
  crypto/
    identity.ts                 ensureReady + fingerprint (libsodium-sumo)
    encryption.ts               Session KX + scellage ChaCha20-Poly1305 (seal/open)
  identity/
    address.ts                  Adresse NULLNODE + callsign + handle PSEUDO#disc
    seed.ts                     Dérivation identité depuis seed BIP39
    use-identity.ts             Hook identité : anon/locked/ready, register/unlock/migrate
    vault/seed-vault.ts         Vault PIN : crypto_pwhash (Argon2) + secretbox (seal/open)
    IdentityCard.tsx            Carte identité (adresse, handle, copy)
    RecoveryPanel.tsx           Reveal/restore de la seed (restore via PIN)
  auth/
    AuthGate.tsx                Routeur login/register/unlock selon le status
    LoginForm.tsx               Login par phrase + PIN (+ migration legacy)
    RegisterForm.tsx            Création identité + étape PIN
    UnlockForm.tsx              Déverrouillage (état locked)
    PinStep.tsx                 Saisie + confirmation du PIN
  roster/
    types.ts                    Friend, FriendRequest, Presence
    use-roster.ts               Carnet d'amis cloisonné par compte (CRUD, présence, heal)
    NetworkPanel.tsx            Colonne réseau : identité + requests + amis + settings
    AddFriend.tsx / FriendsList.tsx / FriendRequests.tsx
  rendezvous/
    rendezvous-client.ts        Client WS du relai (hello, signal, relay/ack, backup)
    sealed-signal.ts            Scellage des signaux (crypto_box_seal)
    social-envelope.ts          Enveloppes sociales (friend_request/accept/profile/dm)
    use-rendezvous.ts           Présence, friend-requests, sendDM, backup pull/push
  session/
    history.ts                  Historique par pair, cloisonné par compte
    use-secure-session.ts       Orchestrateur : identité + transport + crypto + messages
  transport/
    dead-drop.ts                Encode/décode des codes SDP copiables (fallback)
    peer-link.ts                Lien WebRTC P2P (no STUN, LAN/localhost)
  backup/
    backup-crypto.ts            seal/open du blob (clé dérivée seed)
    backup-sync.ts              Collecte + merge convergent (cloisonné par compte)
    BackupPanel.tsx             Export/import fichier .ncb souverain
  comms/
    CommsConsole.tsx            Aiguille connect ↔ stream selon la phase
    MessageStream.tsx           Flux messages chiffrés + composer
    ConversationList.tsx        Liste des conversations
    ConnectPanel.tsx / DropCode.tsx  Échange dead-drop (fallback)
    use-unread.ts               Non-lus par pair (cloisonné par compte)
    peer-label.ts               Résolution handle d'un pair
  settings/
    relay-config.ts             Presets + URL relai (défaut localhost), persisté
    use-relay-setting.ts        Hook URL relai (reconnecte le client)
    SettingsPanel.tsx           Réglage source relai + indicateur d'état
  desktop/
    tauri-bridge.ts             Wrappers Tauri typés, no-op hors Tauri
    use-desktop-presence.ts     Câblage configurePresence / guiOpened / guiClosed
  visualizer/
    network-core.ts / shaders.ts        Géométrie + GLSL
    NetworkScene.tsx / DataCore.tsx / DataStreams.tsx / ParticleField.tsx
  boot/  hud/                   Overlay d'intro + bandeaux data
relay/src/                      Node de rendez-vous aveugle (Bun WS, déployé sur le Pi)
  server.ts                     Bun.serve WS : routing + présence
  registry.ts                   Sockets en ligne (1 par adresse) + token bucket
  envelope-store.ts             Store-and-forward + TTL + cap file
  backup-store.ts               1 blob backup opaque/adresse
  limits.ts                     Bornes anti-abus (env RELAY_*)
  protocol.ts                   Parsing + validation des messages clients
src-tauri/                      Daemon desktop (Tauri 2 + Rust)
  src/lib.rs                    Wiring : plugins, state, setup, boot daemon
  src/presence.rs               Client WS présence (hello, ping, notif, backoff)
  src/config.rs                 Persistance presence.json (address + relay_url)
  src/commands.rs               configure_presence / gui_opened / gui_closed
  src/tray.rs / window.rs / state.rs / main.rs
  tauri.conf.json               Fenêtre cachée au boot, devUrl 5180, frontendDist ../dist

start.sh / stop.sh / restart.sh  Gestion process app (PID, reset log)
relay/start.sh ...               Gestion process relai local
logs/                            Logs runtime (reset au start)
STATE.md TODO.md ARCHITECTURE.md ARBORESCENCE.md README.md RENDEZVOUS-PROTOCOL.md
```
