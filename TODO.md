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

## P1 — MULTI-CONVERSATION SIMULTANÉE — ✅ LIVRÉ (2026-06-22)
- [x] `use-secure-session` réécrit : `Map<peer, PeerRuntime>` (links/keys/timers, ref) +
      vues réactives `Record<peer, PeerView>`. Interface par-pair : `phaseFor`/`fingerprintFor`/
      `typingFor`/`isSecure`/`sasFor` + `connectedPeers`/`aggregatePhase` ; `sendMessage(peer,…)`,
      `notifyTyping(peer)`, `applyAnswer(peerPub,…)`. `src/session/peer-session.ts` (runtime/view).
      Typing throttle + auto-clear PAR PAIR. Dead-drop manuel + `ConnectPanel.tsx` supprimés.
- [ ] **À VALIDER MAIN (P0)** : 3 fenêtres → 2 conversations ouvertes simultanément sans coupure.

---

## ❌ ABANDONNÉ (2026-06-21) — INTERFACE IMMERSIVE / NAV DANS LES NODES
Concept tranché par Chris : **le background WebGL reste purement cosmétique**, jamais un outil
de navigation. Pas de nodes cliquables, pas de sections-dans-le-graphe. Le background doit
juste être dynamique (luminescence) et **réactif à l'activité de l'app**. L'UI applicative
vit en 2D par-dessus (cartes NetworkPanel + CommsConsole). Domaine `navigator/` supprimé.
- [ ] **(piste cosmétique)** Background réactif à l'activité : pulse de luminescence sur message
      reçu / connexion établie, au-delà de la réactivité phase déjà en place. À cadrer avec Chris.

## P2 — SÉCURITÉ & ROBUSTESSE
- [x] **Seed chiffrée au repos** ✅ (2026-06-21) : vault PIN `crypto_pwhash` (Argon2) + `secretbox`
      (`src/identity/vault/seed-vault.ts`), états anon/locked/ready, migration des comptes en clair.
- [x] **TTL / purge + bornes relai** ✅ (2026-06-21) : `relay/src/limits.ts` (TTL, caps, rate-limit).
- [x] **SAS / anti-MITM** ✅ (2026-06-22) : `src/crypto/sas.ts` (`deriveSas` = 4 mots des clés
      de session triées par octets → identique des 2 côtés, indépendant du rôle). `sasFor(peer)`
      sur la session ; `setVerified` au roster ; `VerifyControl`/`SasPanel` dans MessageStream
      (IDENTIQUE→verified / DIFFÉRENT→alerte) ; badge `ShieldCheck` (MessageStream + FriendsList).
      À VALIDER MAIN (P0) : 2 fenêtres → même code SAS des 2 côtés → badge bouclier.
- [x] Statut `away` (inactivité) ✅ (2026-06-22) : `src/presence/use-idle.ts` (events DOM +
      visibilitychange, refs only), 3 min → `setPresence('away')`, retour → `online`. Câblé SessionApp.
- [~] ~~Fallback dead-drop si relai down~~ — **ABANDONNÉ (2026-06-22, Chris)** : le node Pi H24
      est le point de rendez-vous assumé. Pas de réintroduction de l'échange SDP manuel. (Code
      retiré récupérable dans l'historique git si la décision change un jour.)
- [~] STUN WAN — **REPORTÉ (2026-06-22)** : pas de STUN public (souveraineté + fuite IP). Le
      store-and-forward via le relay couvre déjà l'échec du P2P direct (messages chiffrés relayés).
      Si temps-réel direct WAN un jour nécessaire → **coturn self-hosted sur le Pi** (souverain).
- [ ] **Mesh peer-relay** (différé, à cadrer) : réserve technique — fuite de métadonnées,
      modèle de confiance à décider, fallback only.

## P3 — PACKAGING & POLISH
- [x] **Daemon desktop Tauri 2** ✅ (2026-06-21) : scaffold `src-tauri/`, ghost + tray + handoff.
      Reste `tauri build` (AppImage/deb) à produire/valider sur machine.
- [x] **Réglages visuels** ✅ (2026-06-22) : `settings/visual-config.ts` + `use-visual-setting.ts`
      + `VisualSettingsPanel` (sliders densité/grain/aberration + toggle accent phosphor/ambre,
      persisté `nullnode.visual`). Couleur accent + density + grain + aberration propagés au WebGL
      par props (fallback constantes). Hook hissé dans App.tsx → thème dès le boot. Rendu à valider à l'œil.
- [x] **start.sh racine relai + app** ✅ (2026-06-22) : lance relay local puis l'app
      (`VITE_RELAY_URL=ws://127.0.0.1:8791`) ; `stop.sh` arrête les deux.

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
