# STATE — NULLNODE

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
Le node aveugle (store-and-forward) tourne désormais sur le **Raspberry Pi** (pi@10.0.0.2),
pas sur localhost. C'est le point de persistance qui résout l'async (A et B jamais online en
même temps → le node tient le message). Modèle cible : un node par user qui veut l'async fiable,
fédérés. « Zéro dépendance externe imposée » ≠ « zéro machine » — le Pi est ton infra.
- Service systemd `nullnode-relay.service` (User=pi, Restart=always, enabled au boot), port 8791.
- Code : `~/nullnode-relay/` sur le Pi, Bun 1.3.14 installé, lancé via `~/.bun/bin/bun`.
- Exposition WAN : **wss://relai.exemple** via Cloudflare Tunnel `portfolio`
  (388bc072, compte `cert.pem.old-account`). Ingress ajouté dans `/etc/cloudflared/config.yml`
  (backup `.bak-<ts>`), CNAME créé, validé E2E (handshake `welcome` OK via URL publique).
- Client : `DEFAULT_RELAY = wss://relai.exemple`. Override dev :
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

## ▶ REPRISE — lire en premier
**P1 backup zero-knowledge core = LIVRÉ + validé runtime** (cycle pull/push prouvé, blobs
opaques sur disque, zéro erreur console). Reste à valider à la main la **vraie récupération
nouvel appareil** (noter seed → autre navigateur → RESTORE seed → backupGet → merge) — P0.
Prochains morceaux : **per-account prefixing** (dette multi-compte), **messages async**,
**multi-conversation**. Backlog complet dans `TODO.md`. Relai : `cd relay && ./start.sh`
(:8791). App : `./start.sh` (:5180). Mono-session WebRTC actuelle.

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
- Packaging **Electron** (actuellement web Vite) — pour le rendu WebGL cohérent en desktop.
- STUN optionnel pour le WAN (aujourd'hui LAN/host candidates only).
- QR code pour le dead-drop (au lieu du copier/coller seul).
- Transfert de fichiers chiffré sur le DataChannel.
- Idle/reconnect handling (phase `lost`).
