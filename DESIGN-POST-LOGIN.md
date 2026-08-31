# NULLNODE — Page utilisateur post-login : inventaire & placement

> But du doc : lister **tout** ce qui doit vivre sur l'écran applicatif après déverrouillage, pour
> servir de base au redesign. Aucune contrainte de layout imposée ici — c'est la matière à placer.
> Source : état réel du code (`AppShell`, `Sidebar`, `ConversationPane`, `ProfileDrawer`, `HudOverlay`).

## Contexte & contraintes

- **Pas de scène 3D après login** (décidé) : la `NetworkScene` WebGL ne tourne que sur le login. En
  post-login, fond = `AmbientBackground` statique (grille technique + 2 lueurs phosphor figées) →
  fluide sur WebKitGTK/NVIDIA. Tout effet animé en continu (canvas) est à proscrire ici.
- **Identité de marque** : terminal souverain, dense, monospace. Accent phosphor `#00ff9d`
  (thème alt. amber). Fonts : Space Grotesk (display) + JetBrains Mono (mono).
- **Messager P2P chiffré** : WebRTC direct (SECURE) ou file d'attente via relai (RELAY). Chiffrement
  ChaCha20-Poly1305. Multi-conversation simultanée. DM asynchrone (livré quand le pair repasse online).

---

## Layout actuel (référence, pas une cible)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ ● NULLNODE          STATUS: SECURE CHANNEL              10:28:30 UTC        │  ← HUD overlay (haut)
│                                                                            │
│ ┌─────────────────────┐  ┌──────────────────────────────────────────┐     │
│ │ NULLNODE   ●UP  [<]  │  │  [<] ● Pseudo#1234   🛡  📞  SECURE        │     │
│ │ [🔍 rechercher…    ] │  │  ── ÉPINGLÉS (2) ───────────────────────  │     │
│ │ [Chats][Amis][Dem.③] │  │                                          │     │
│ │ ┌─ conversations ──┐ │  │   peer  12:01  bubble……                  │     │
│ │ │ Pseudo  ·last· ② │ │  │              bubble…… 12:02  moi          │     │
│ │ │ Autre   ·last·   │ │  │   ··· typing                              │     │
│ │ └──────────────────┘ │  │  [ transmit…                      ][SEND]│     │
│ │ [👤 mon-handle    ⚙] │  └──────────────────────────────────────────┘     │
│ └─────────────────────┘                                          ProfileDrawer →│
│                                                                            │
│ LOCAL ID 1a2b   PEER ID 9f3c   CIPHER ChaCha20-Poly1305   TRANSPORT WEBRTC/P2P │  ← HUD overlay (bas)
└──────────────────────────────────────────────────────────────────────────┘
```

Trois zones : **Sidebar** (gauche, repliable) · **ConversationPane** (centre) · **ProfileDrawer**
(droite, en overlay) — le tout au-dessus d'un **HUD télémétrie** en overlay (4 coins + centres).

---

## 1. HUD télémétrie (overlay, non-interactif)

Bandeaux fins dans les marges, `pointer-events-none`. Forte signature de marque.

| Emplacement | Élément | Donnée | États |
|---|---|---|---|
| Haut-gauche | Wordmark `NULLNODE` + point d'état | — | point accent si `secure`, sinon `warn`, pulsé |
| Haut-centre | `STATUS` | phase de connexion | STANDBY · KEYGEN · AWAITING PEER · HANDSHAKE · SECURE CHANNEL · LINK LOST |
| Haut-droite | Horloge UTC | live (1 s) | — |
| Bas-gauche | `LOCAL ID` | fingerprint de mon identité | `— — — —` si vide |
| Bas-centre-g | `PEER ID` | fingerprint du pair courant | `unbound` si aucun ; accent si secure |
| Bas-centre-d | `CIPHER` | `ChaCha20-Poly1305` | statique |
| Bas-droite | `TRANSPORT` | `WEBRTC / P2P` | accent si secure |

---

## 2. Sidebar (panneau gauche, repliable — 340 px)

### 2.1 En-tête
- Label `NULLNODE`.
- **RelayStatus** : pastille `UP`/`DOWN` (vert/rouge) cliquable → popover :
  - `RELAI` : EN LIGNE / HORS LIGNE
  - `SOURCE` : URL du relai (sans le préfixe `wss://`)
  - `PAIRS CONNECTÉS` : nombre (ou `—` si offline)
- Bouton **replier** le panneau.

### 2.2 Recherche
- Champ « rechercher un contact… » → filtre conversations **et** amis.

### 2.3 Barre d'onglets
- **Chats** · **Amis** · **Demandes**.
- Onglet `Demandes` : **badge compteur** si demandes entrantes > 0.

### 2.4 Contenu par onglet
**Chats** → `ConversationList` (filtré) :
- liste des conversations : handle du pair, dernier message, **compteur non-lus**, présence.

**Amis** → :
- **PresencePicker** : bascule `Actif` / `Inactif` (= online / away).
- **FriendsList** (filtré) : par ami → point de présence, **badge vérifié** (bouclier), action *ouvrir
  chat*, action *retirer*. Vide : « no peers yet — send a request above. »

**Demandes** → :
- **AddFriend** : champ « null:… (paste address) » + `SEND ▸`. États : `REQUEST SENT ▸` / `FAILED`.
- **FriendRequests** : demandes entrantes → `ACCEPT` / `DECLINE`.

### 2.5 Pied
- Bouton **profil** : avatar + mon handle + engrenage → ouvre le `ProfileDrawer`.

### 2.6 Repli
- Sidebar masquable (slide). Quand repliée : bouton flottant en haut-gauche du pane pour la rouvrir.

---

## 3. ConversationPane (zone centrale)

### 3.1 États de la zone
- **Vide** : aucune conversation sélectionnée (à concevoir — actuellement vide).
- **IncomingNotice** : bandeau central « <pair> connecté — ouvrir » quand un pair se connecte sans
  conversation ouverte (point pulsé).
- **Conversation ouverte** : carte centrée (max ~680 px) contenant le `MessageStream`.

### 3.2 MessageStream — en-tête
- Bouton **retour**.
- **Point de connexion** (accent si lien P2P établi, sinon gris).
- **Handle du pair** (`Pseudo#1234`).
- **VerifyControl** (anti-MITM, si connecté) :
  - non vérifié : bouton **bouclier** → panneau **SAS** = code de 4 mots à lire de vive voix +
    boutons `✓ IDENTIQUE` / `✗ DIFFÉRENT`.
  - vérifié : badge **ShieldCheck** accent.
  - mismatch : alerte « canal potentiellement compromis ».
- **Appel vocal** : bouton 📞 **désactivé** (« bientôt ») — slot à garder ou retirer.
- Label **SECURE** (P2P) / **RELAY** (file d'attente).

### 3.3 MessageStream — corps
- **PinnedBar** : encart repliable des messages épinglés (compteur, désépingler).
- **Flux de messages** : bulles self/pair, auteur + timestamp, **épingler au survol**.
  - Vide : « end-to-end encrypted. say something. »
- **Indicateur de saisie** : « <pair> typing » + points animés (si connecté).

### 3.4 MessageStream — composer
- Champ de saisie. Placeholder selon état :
  - connecté : « transmit… »
  - hors-ligne : « transmit (delivered when online)… » (DM asynchrone).
- Bouton **SEND** (Entrée pour envoyer).

---

## 4. ProfileDrawer (drawer droit — 380 px, overlay)

Ouvert depuis le pied de sidebar. Contient, de haut en bas :

### 4.1 IdentityCard — `YOUR IDENTITY`
- Pseudo (renommable inline : Entrée valide / Échap annule).
- Adresse / handle, bouton `COPY`.

### 4.2 RecoveryPanel — `RECOVERY PHRASE`
- Révéler la phrase de 12 mots + `COPY PHRASE`.
- **RESTORE** : coller une phrase de 12 mots → restaurer (+ définir un PIN).

### 4.3 BackupPanel — sauvegarde souveraine
- `EXPORT FILE` / `IMPORT FILE` (fichier chiffré). États : EXPORTED / EXPORT FAILED /
  WRONG SEED / CORRUPT / NOTHING NEW / IMPORT FAILED.

### 4.4 SettingsPanel — relai
- URL du relai (« ws(s)://host:port ») + `SET`. État : CONNECTED / OFFLINE.

### 4.5 VisualSettingsPanel
- Sliders **DENSITY**, **GRAIN**, **ABERRATION** + toggle **ACCENT** (PHOSPHOR / AMBER).
- ⚠️ **À trancher** : DENSITY / GRAIN / ABERRATION ne pilotaient que la `NetworkScene` (supprimée
  post-login) → **orphelins** ici. Seul **ACCENT** a encore un effet (couleur du fond statique + UI).
  Décision : retirer les 3 sliders, ou les repositionner sur le login uniquement.

---

## 5. Transverse

- **Fond post-login** : `AmbientBackground` statique (grille + lueurs phosphor), suit le thème accent.
- **Auto-away** : passage online → away après 3 min d'inactivité, retour online à la 1re interaction.
- **Multi-conversation** : plusieurs sessions P2P simultanées (une `PeerRuntime` par pair).
- **Boot sequence** : overlay de démarrage au premier montage (jusqu'à `booted`).
- **Motion** : slides framer-motion (sidebar, drawer, popover, bulles).

---

## 6. Décisions à prendre pour le redesign

1. **Sliders visuels orphelins** (DENSITY/GRAIN/ABERRATION) : supprimer ou déplacer ?
2. **Slot appel vocal** : garder le placeholder « bientôt » ou retirer ?
3. **HUD télémétrie** : conserver les 7 ancrages en marge (signature forte) ou condenser ?
4. **État vide** du ConversationPane : à concevoir (aujourd'hui rien).
5. **Responsive** : largeurs fixes (sidebar 340 / drawer 380) — comportement sous petite fenêtre ?
6. **Densité visuelle** : le style terminal actuel est très dense (8-11 px) — on garde ce parti pris ?
