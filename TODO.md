# TODO — NULLNODE

> Backlog structuré pour **délégation à des sous-agents** (Opus cloud). Chaque tâche est
> autonome : contexte + fichiers + contrat + interdits. Lire `STATE.md`, `ARCHITECTURE.md`,
> `RENDEZVOUS-PROTOCOL.md` avant. Règle E2E : un sous-agent **produit**, ne valide pas
> (pas de navigateur/Playwright/serveur lancé) — la validation E2E revient au parent.
> Standards stricts : fichier ≤500 l, fonction ≤35 l, ligne ≤120, zéro `any`, `as` commenté,
> try/catch+log sur tout I/O, runtime Bun, noms kebab-case. `bunx tsc --noEmit` doit passer.

## État au 2026-06-21
App fonctionnelle : scène WebGL liquide, identité seed BIP39 portable (PSEUDO#disc),
relai aveugle + store-and-forward, demandes d'amis consenties, messagerie P2P chiffrée
avec historique persistant + non-lus + boot réel. **Mono-session WebRTC** (1 conversation
active à la fois). Relai sur :8791 (8787 squatté). Dev app :5180.

---

## P0 — VALIDÉ À LA MAIN (Chris, 2026-06-21) ✅
- [x] Flux 2 fenêtres bout-en-bout : demande d'ami → accept → 💬 → messages temps réel →
      refresh → historique persiste → vrais handles.
- [x] Connexion entrante ne force plus l'ouverture du chat côté récepteur.
- [x] Restore seed sur une autre instance → même identité.
- [x] DM async : A online + B offline → A envoie → B se connecte → B reçoit.

---

## P1 — BACKUP DONNÉES ZERO-KNOWLEDGE — ✅ CORE LIVRÉ (2026-06-21)
Objectif : retrouver roster + historique sur un nouvel appareil via la seed, sans que le
relai puisse lire quoi que ce soit. Couvre le cas « seul connecté → nouvel appareil 3j après ».

- [x] **Crypto backup** (`src/backup/backup-crypto.ts`) : clé dérivée seed BIP39
      (`crypto_generichash` salé `nullnode-backup-v1`), `crypto_secretbox_easy`. seal/open.
- [x] **Endpoint relai backup** (`relay/src/backup-store.ts` + protocol/server) :
      `backup_put`/`backup_get`/`backup`, JSON `relay/data/backups.json` (1 blob/adresse). Opaque.
- [x] **Client backup** (`backup-sync.ts` + câblage `useRendezvous` + `BackupPanel`) : pull au
      login (merge convergent → reload si neuf), push debouncé 2s, EXPORT/IMPORT FILE (.ncb).
- [x] **Restore validé main (P0)** : seed → autre navigateur → données récupérées.
- [x] **Roster/history par-compte** ✅ (2026-06-21) : partition `acct.<addr>.*`
      (`src/shared/local-store.ts`), `migrateAccount` non-destructif, split App/SessionApp.
      Isolation A/B prouvée en runtime. Plus aucune fuite inter-comptes.

## P1 — MESSAGES ASYNCHRONES — ✅ LIVRÉ (2026-06-21)
- [x] DM routés via store-and-forward (envelope `kind:'dm'`) quand le DataChannel est fermé ;
      DataChannel prioritaire si les 2 sont online. `social-envelope.ts` (kind dm) +
      `sendDM` dans `use-rendezvous.ts` (DataChannel sinon relay) + `appendExternal` dédupliqué
      par id dans `use-secure-session.ts`. Délivrance offline = flush au hello (relai existant).
      Input messagerie débloqué offline (libellé « delivered when online », statut RELAY).
- [ ] **À VALIDER MAIN (P0)** : A online + B offline → A envoie → B se connecte → B reçoit.

## P1 — MULTI-CONVERSATION SIMULTANÉE
- [ ] Aujourd'hui mono-session : une seule connexion WebRTC active (`use-secure-session`).
      Refactor pour N PeerLink simultanés (Map<peerAddress, PeerLink/SessionKeys>), afin d'avoir
      plusieurs conversations ouvertes en parallèle. Gros refactor de `use-secure-session.ts`.
      Préalable propre avant l'UI nodes (sinon ouvrir une conv coupe l'autre).

---

## ▶ PROCHAIN — INTERFACE IMMERSIVE / UI INTÉGRÉE AUX NODES (sujet en cours avec Chris)
Remplacer les cartes par une UX où tout vit dans le graphe WebGL. Les cartes restent pour
le test jusqu'à ce que ce soit prêt. **C'est le prochain chantier.**
- [ ] **Raycasting fiable** (LE point dur, signalé par Chris) : détection souris des nodes
      robuste (hitboxes généreuses, `raycaster.params.Points.threshold`, ou meshes invisibles
      d'interaction par-dessus les points). À soigner fortement, sinon hover/clic foireux.
- [ ] Hover node → label flottant (Messagerie, Historique, Notifications, Demandes d'amis,
      Profil, Paramètres). Chaque node = une section.
- [ ] Clic node → ouvre la section correspondante (panneau repliable ou overlay immersif,
      PAS de bureau à fenêtres — intégré au design).
- [ ] Section Messagerie depuis le node : dernières conversations triées, ouverture in-graph.
- [ ] Tri personnalisable des conversations par l'utilisateur (épingler, ordre manuel).
- [ ] Badges non-lus / notifications visibles directement sur les nodes (pulse, compteur).

## P2 — SÉCURITÉ & ROBUSTESSE
- [x] **Seed chiffrée au repos** ✅ (2026-06-21) : vault PIN `crypto_pwhash` (Argon2) + `secretbox`
      (`src/identity/vault/seed-vault.ts`), états anon/locked/ready, migration des comptes en clair.
- [x] **TTL / purge + bornes relai** ✅ (2026-06-21) : `relay/src/limits.ts` (TTL, caps, rate-limit).
- [ ] **SAS / anti-MITM** (différé, prévu après l'UI) : code court dérivé des 2 clés de session,
      comparé de vive voix, pilote le flag `verified` du roster.
- [ ] Fallback dead-drop si relai down (UI : exposer ConnectPanel quand RELAY DOWN).
- [ ] STUN optionnel pour le WAN (aujourd'hui LAN/localhost only). Garder LAN par défaut.
- [ ] Statut `away` (inactivité) en plus de online/offline.
- [ ] **Mesh peer-relay** (différé, à cadrer) : réserve technique — fuite de métadonnées,
      modèle de confiance à décider, fallback only.

## P3 — PACKAGING & POLISH
- [x] **Daemon desktop Tauri 2** ✅ (2026-06-21) : scaffold `src-tauri/`, ghost + tray + handoff.
      Reste `tauri build` (AppImage/deb) à produire/valider sur machine.
- [ ] Réglages visuels : densité particules, intensité grain/aberration, thème accent alt (ambre).
- [ ] start.sh racine qui lance relai + app ensemble.

---

## Done (réf.)
- [x] Scène WebGL liquide (shader fresnel + particules + paquets + post-process)
- [x] Identité persistante + adresse NULLNODE + callsign
- [x] Seed phrase BIP39 portable (reveal + restore), validé E2E
- [x] Handle PSEUDO#discriminant (dérivé clé), pseudo éditable
- [x] Relai aveugle (présence + signaling) + store-and-forward, validé E2E
- [x] Demandes d'amis consenties (request/accept/decline) + réciprocité
- [x] Messagerie P2P chiffrée : historique persistant, vrais handles, non-lus, notif entrante
- [x] Boot réel piloté par les vrais sous-systèmes
- [x] Backup zero-knowledge (seal/open seed-derived, store relai opaque, pull/push, export .ncb)
- [x] Messages asynchrones (DM via store-and-forward)
- [x] Settings relay configurable (presets + URL + indicateur d'état)
- [x] Auth gate login/register + COPY phrase
- [x] **Relay durci** (TTL, caps, rate-limit) · **seed chiffrée PIN** · **multi-compte cloisonné**
- [x] **Daemon Tauri 2** (ghost + tray + handoff présence)
