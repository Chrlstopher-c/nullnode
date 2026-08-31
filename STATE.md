# STATE — NULLNODE

## ▶ REPRISE (2026-06-22 b) — UI post-login refondue en « canvas-OS »
Le login est **inchangé** (AuthGate/scène WebGL). Une fois authentifié, l'ancien `AppShell`
(sidebar + pane + drawer) est **remplacé** par `src/workspace/` : shell type OS avec
**topologie réseau vivante en fond** (canvas 2D maison, `network-canvas/topology-engine.ts`,
nodes = amis joignables, liens = sessions live, pulse = message envoyé, relai ambre si down),
**dock** bas, **fenêtres flottantes draggable** (Network/Messages/Identity/System + une fenêtre
par conversation, multi-fenêtre). Le contenu des fenêtres **réutilise les composants réels
existants** (MessageStream, FriendsList, FriendRequests, AddFriend, IdentityCard, RecoveryPanel,
BackupPanel, SettingsPanel, VisualSettingsPanel) — zéro réécriture du câblage crypto/réseau.
- `SessionApp.tsx` monte désormais `<Workspace>` (props = hooks, glue pins/onTogglePin par pair).
- 🧹 Supprimés (code mort) : `src/shell/` entier + `src/hud/HudOverlay.tsx`.
- Build `bun run build` vert, 0 erreur console (validé Playwright). Source du design :
  `~/Downloads/nullnode-canvas-os.html` (proto Opus cloud).
- ⏳ À faire éventuellement : menu contextuel clic-droit sur les pairs (retiré v1, non câblé) ;
  perf glassmorphisme empilé à éprouver sur machine modeste (backdrop-filter ne scale pas).

## Quoi
App desktop de communication P2P chiffrée E2E, esthétique « station de contrôle » (réf. terminal-industries.com).
Priorité design. Souverain : aucun serveur de signaling, aucun relais. Échange via dead-drop SDP.

## Modèle identité (décidé 2026-06-21) — PAS de blockchain
L'unicité vient de la **clé publique** (unique par construction crypto), pas d'un consensus global.
Une blockchain/gossip pour « ce compte existe-t-il ? » résout un problème qu'on n'a pas. Acté :
- **Clé = compte**. Adresse NULLNODE = la clé. Aucun annuaire, aucun serveur d'unicité.
- **Handle = PSEUDO#discriminant** : pseudo lisible (éditable) + 6 chiffres dérivés de la clé
  (distingue les homonymes, lié cryptographiquement à la clé). `src/identity/address.ts`.
- **Portabilité = seed phrase BIP39 (12 mots)** ✅ : l'identité est DÉRIVÉE de la phrase de
  façon déterministe (`crypto_kx_seed_keypair`). Même phrase = même identité partout.
  `src/identity/seed.ts`. Reveal/restore dans `RecoveryPanel.tsx`.

## Persistance / multi-appareils (décidé 2026-06-21)
Vérité dure : le P2P pur NE PEUT PAS récupérer des données sans point de persistance qui
survit à la déconnexion. Stratégie actée :
- **Identité** → seed phrase (fait). Régénère la même clé n'importe où, sans réseau.
- **Données** (roster, historique) → **backup chiffré zero-knowledge sur le relai** (à faire) :
  blob chiffré (clé dérivée de la seed), le relai ne voit que du ciphertext. + export fichier manuel.
- Couvre le cas « seul connecté → nouvel appareil 3j après » car le relai (ton infra) survit.
- **Messages asynchrones** (recevoir pendant absence) → router via le store-and-forward existant.

## Demandes d'amis (décidé 2026-06-21) — consentement + store-and-forward
Fini l'ajout unilatéral local. Modèle relation mutuelle consentie :
A envoie une **friend_request** scellée → B reçoit/accepte/refuse → ajout réciproque sur accept.
Asynchrone via le relai **store-and-forward** : si B offline, le relai stocke et délivre au retour.

## Node déployé sur le Pi (2026-06-21) — souveraineté assumée
Décision actée : **pas de serveur central imposé, mais un node personnel self-hosted H24**.
Le node aveugle (store-and-forward) tourne désormais sur le **Raspberry Pi** (adresse LAN dans `.env.local`),
pas sur localhost. C'est le point de persistance qui résout l'async (A et B jamais online en
même temps → le node tient le message). Modèle cible : un node par user qui veut l'async fiable,
fédérés. « Zéro dépendance externe imposée » ≠ « zéro machine » — le Pi est ton infra.
- Service systemd `nullnode-relay.service` (User=pi, Restart=always, enabled au boot), port 8791.
- Code : `~/nullnode-relay/` sur le Pi, Bun 1.3.14 installé, lancé via `~/.bun/bin/bun`.
- Exposition WAN : le domaine du tunnel (`.env.local`) via Cloudflare Tunnel `portfolio`
  (388bc072, compte `cert.pem.old-account`). Ingress ajouté dans `/etc/cloudflared/config.yml`
  (backup `.bak-<ts>`), CNAME créé, validé E2E (handshake `welcome` OK via URL publique).
- Client : `VITE_RELAY_URL` (aucune adresse en dur dans le code). Override dev :
  `VITE_RELAY_URL=ws://127.0.0.1:8791`. Redéploiement node : `tar | ssh` + `systemctl restart`.

## Modèle réseau (décidé 2026-06-21)
« Nouveau réseau » P2P souverain. Rendez-vous choisi : **relai self-host aveugle + fallback dead-drop**
(le relai ne voit que clés publiques + blobs chiffrés, jamais les messages). Briques :
- **Identité persistante** = keypair X25519 stable, stockée localement → c'est ton adresse.
- **Adresse NULLNODE** = `null:` + base64url(pubkey). Callsign 3-mots dérivé pour reconnaissance humaine.
- **Roster local** = carnet d'amis (pubkey + alias + présence + verified). Aucun annuaire central.
- **Trust** = vérif fingerprint manuelle → badge 🛡 (anti-MITM).
- Présence + reconnect auto = à brancher avec le relai (prochaine étape).

## État actuel (2026-06-21)
**v1 vitrine + socle réseau + rendez-vous — livré.**
- ✅ Scène WebGL refondue : data-sphere à shader (fresnel + flux noise, rendu « liquide »),
  3 couches de particules, connexions courbes + paquets animés, bloom/aberration/vignette/grain
- ✅ Identité persistante + adresse NULLNODE + callsign (`identity/`)
- ✅ Roster d'amis local : add / list / verify / remove + présence, persistant (`roster/`)
- ✅ **Relai de rendez-vous aveugle** (`relay/`, Bun WS, port 8791) : présence + acheminement
  de blobs opaques (`crypto_box_seal`). Validé E2E (2 clients, routing + PEER_OFFLINE).
- ✅ **Client rendez-vous** (`src/rendezvous/`) : sealed-signal (validé E2E : confidentialité +
  tiers bloqué) + RendezvousClient (WS, heartbeat, reconnexion) + `useRendezvous` (présence,
  connexion auto ami-à-ami via bouton CALL).
- ✅ Panneau réseau : statut RELAY UP/DOWN, présence temps réel, bouton CALL par ami online.

## ▶ REPRISE — lire en premier (2026-06-22, multi-session + sécurité finale + desktop natif)
Repo **public** : github.com/trinityUwU/nullnode. Livrés et tsc-verts ce jour :
- ✅ **Multi-session WebRTC** : N conversations simultanées (`Map<peer, PeerRuntime>` + vues
  réactives, API par-pair). Dead-drop manuel retiré (`use-secure-session.ts`, `peer-session.ts`).
- ✅ **SAS anti-MITM** (`crypto/sas.ts`) : 4 mots dérivés des clés de session (symétrique),
  comparés de vive voix → flag `verified` + badge bouclier (MessageStream + FriendsList).
- ✅ **Auto-away** (`presence/use-idle.ts`) : inactivité 3 min → away, retour online à l'interaction.
- ✅ **Réglages visuels** (`settings/visual-*`) : densité/grain/aberration + accent ambre, persistés.
- ✅ **Background réactif** : pulse de luminescence (BloomDriver) sur message reçu / connexion.
- ✅ **Desktop natif** : scripts `start-desktop.sh` + shims Wayland/NVIDIA (DMABUF off + XWayland)
  → l'app Tauri s'affiche sur Hyprland/RTX 3060. Dev desktop auto-suffisant (relay local au boot).
- 🧹 Dead code retiré : `dead-drop.ts`, `DropCode.tsx`, `CommsConsole.tsx`, `NetworkPanel.tsx`.

**Décisions actées (2026-06-22)** : fallback dead-drop **abandonné** (on s'appuie sur le Pi H24) ;
STUN **reporté** (souveraineté ; coturn sur le Pi si besoin un jour) ; **mesh peer-relay** = même
problème que le dead-drop abandonné + fuite de métadonnées → à trancher, NON implémenté.

**À valider à la main (P0, multi-fenêtres — non simulables headless)** : multi-conv 3 fenêtres ·
SAS identique des 2 côtés · DM async · rendu visuel (sliders, ambre, pulse).

Dev web : `./start.sh` (relai local :8791 + app :5180). Dev desktop : `./start-desktop.sh`.

## Sécurité + desktop — LIVRÉ (2026-06-21)
- ✅ **Relay durci** (`relay/src/limits.ts` + stores) : TTL enveloppes (7j, sweep horaire), cap
  file FIFO/destinataire, cap payload/backup, rate-limit token-bucket lazy/socket, cap mémoire.
  Tout en env `RELAY_*`. Indispensable vu le node exposé H24 sur internet.
- ✅ **Seed chiffrée at-rest** (`src/identity/vault/seed-vault.ts`) : vault PIN `crypto_pwhash`
  (Argon2 INTERACTIVE) + `secretbox`. États auth `anon`/`locked`/`ready`, migration des comptes
  en clair, écrans `UnlockForm`/`PinStep`. Seed déchiffrée en sessionStorage (refresh sans PIN).
- ✅ **Multi-compte cloisonné** (`src/shared/local-store.ts`) : partition `acct.<addr>.*`
  (roster/history/seen/requests/pseudo), `migrateAccount` non-destructif. Split **App/SessionApp**
  → les hooks par-compte montent avec une adresse garantie (zéro fuite inter-comptes).
- ✅ **Daemon Tauri 2** (`src-tauri/`) : ghost process au boot (fenêtre cachée), tient la présence
  relay quand la GUI est fermée, tray bouclier, GUI à la demande. **Handoff** car le relay ne garde
  qu'1 socket/adresse : ouverture GUI → daemon stop ; fermeture → daemon restart. Aucune seed côté
  Rust. Bridge JS no-op hors Tauri (`src/desktop/`). `cargo check` + `tsc` verts.
- ⚠ **libsodium = `-sumo`** (toute l'app) : le build base n'a PAS `crypto_pwhash`. Constantes
  sodium lues à l'appel (après `ready`), jamais au top-level.

## Backup zero-knowledge (2026-06-21) — LIVRÉ
- ✅ `src/backup/backup-crypto.ts` : `sealBackup`/`openBackup`, clé dérivée de la seed BIP39
  (`crypto_generichash` salé `nullnode-backup-v1`), chiffrement `crypto_secretbox_easy`.
- ✅ `src/backup/backup-sync.ts` : collecte + merge convergent (union roster/history/seen, pseudo
  si vide) sur localStorage. Non destructif.
- ✅ Relai : `relay/src/backup-store.ts` (1 blob opaque/adresse, JSON `data/backups.json`) +
  messages `backup_put`/`backup_get`/`backup`. Le relai ne lit jamais le blob.
- ✅ Câblage `useRendezvous` : pull `backupGet` au login (merge→reload si neuf), push debouncé 2s
  sur changement roster/history/pseudo. UI `BackupPanel` : EXPORT/IMPORT FILE (.ncb) souverain.
- Validé runtime : backup_get→backup_put dans les logs relai, backups.json = ciphertext, 0 erreur.

## Ajouts 2026-06-21 (messagerie)
- ✅ Historique persistant par pair (`session/history.ts`) — survit au refresh
- ✅ Vrais handles dans le chat (`comms/peer-label.ts` : PSEUDO#disc)
- ✅ Connexion entrante ne force plus l'ouverture (notif + `comms/use-unread.ts` + ConversationList)
- ✅ Boot réel (`boot/BootSequence.tsx`) piloté par identité dérivée + relai connecté

## Ajouts 2026-06-21 (session friend-requests)
- ✅ Identité : pseudo éditable + handle PSEUDO#disc (discriminant dérivé clé), persistés
- ✅ Friend requests : envoi (SEND), réception (PENDING REQUESTS), accept (réciproque) / decline
- ✅ Store-and-forward relai (`relay/src/envelope-store.ts`, persistance JSON debouncée)
- ✅ Client : `social-envelope.ts` (seal/open) + canal relay/ack/envelope dans RendezvousClient
- ✅ UX : CALL → icône 💬 chat ; bouclier « verified » retiré (réintro plus tard, guidé)
- ✅ Validé E2E : friend-request offline (store→flush→ack) ET online (delivery directe)

## Lancer le réseau complet
1. Relai : `cd relay && ./start.sh` (ws://127.0.0.1:8791). **Note : 8787 squatté sur la machine → défaut 8791.**
2. App : `./start.sh` (5180). Override possible via `VITE_RELAY_URL`.

## Validé E2E (par le parent)
- Relai : registre, welcome, signal routing (from correct, payload opaque intact), PEER_OFFLINE.
- Sealed-signal : round-trip offer, payload ≠ plaintext, tiers ne peut pas déchiffrer.
- UI : RELAY UP affiché, identité persistée, zéro erreur console.

## NON validé automatiquement (à tester à la main)
Flux **CALL complet ami-à-ami** (offer→answer→DataChannel→secure) : nécessite 2 fenêtres
navigateur avec 2 identités distinctes, qui s'ajoutent mutuellement, puis CALL. WebRTC DataChannel
ne se teste pas headless. Sans STUN → LAN/localhost uniquement (WAN = TODO).

- ✅ Stack : Vite + React + TS + Tailwind v4 + r3f/drei/postprocessing + GSAP/Framer Motion + libsodium
- ✅ Scène WebGL réseau (core wireframe, nodes pulsants, tunnels, bloom phosphore), phase-aware
- ✅ Boot sequence terminal (overlay d'intro)
- ✅ HUD (fingerprints, statut, cipher, clock)
- ✅ Crypto E2E réelle : identité X25519, session KX, ChaCha20-Poly1305 (seal/open)
- ✅ Transport WebRTC P2P + dead-drop SDP (encode/decode codes copiables)
- ✅ Console : flux host→offer / guest→answer / host→complete, puis messagerie chiffrée
- ✅ tsc clean (exit 0), zéro erreur console/page au runtime, WebGL OK (pas de context-lost)

## Lancer
`./start.sh` → http://localhost:5180 · `./stop.sh` · `./restart.sh`

## Tester le P2P (2 onglets)
1. Onglet A : OPEN SECURE CHANNEL → copier l'OFFER.
2. Onglet B : coller l'OFFER → ACCEPT & ANSWER → copier l'ANSWER.
3. Onglet A : coller l'ANSWER → ESTABLISH LINK. Canal sécurisé des deux côtés.

## Dette / prochaines étapes
- **Interface immersive** (prochain sujet) — refonte UI/UX.
- Packaging desktop via **`tauri build`** (scaffold prêt, plus besoin d'Electron).
- Anti-MITM SAS (différé), mesh peer-relay (différé, à cadrer), UI nodes-driven (différé).
- STUN optionnel pour le WAN (aujourd'hui LAN/host candidates only).
- Transfert de fichiers chiffré sur le DataChannel.
- Idle/reconnect handling (phase `lost`).
