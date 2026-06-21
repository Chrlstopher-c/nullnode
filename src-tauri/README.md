# NULLNODE — daemon desktop (Tauri 2)

Process fantôme (« ghost ») qui démarre au boot **sans fenêtre**, tient la présence sur
le relay quand la GUI est fermée, et ouvre la GUI à la demande via le tray.

## Lancer

```bash
bun run tauri:dev     # dev : lance Vite (5180) + la fenêtre Tauri
bun run tauri:build   # build release + bundles
```

`tauri:dev` exécute `beforeDevCommand: bun run dev` (Vite sur `http://localhost:5180`).
La fenêtre démarre **cachée** (`visible: false`) : c'est le mode fantôme.

## Où vit la config

Fichier `presence.json` dans le **app config dir** Tauri (identifier `com.nullnode.desktop`) :

- Linux : `~/.config/com.nullnode.desktop/presence.json`

Contenu : `{ "address": "<adresse NULLNODE publique>", "relay_url": "ws://… | wss://…" }`.
L'adresse NULLNODE est **publique** (partageable) — la stocker en clair est OK.
**Aucune seed ni clé privée ne touche le Rust.**

## Modèle de handoff (le relay ne garde qu'UN socket par adresse)

Daemon et GUI ne sont **jamais** connectés en même temps avec la même adresse : ils se
passent le relais.

1. **Boot (sans GUI)** — si `presence.json` existe → le daemon ouvre une WS minimale,
   envoie `hello`, tient la présence « online », reçoit les enveloppes opaques →
   notification desktop. Sinon → daemon idle, tray « inactif ».
2. **Ouverture GUI** — le JS appelle `gui_opened()` → le daemon **ferme** sa WS, le client
   JS prend le relais.
3. **Masquage GUI** — la fenêtre ne quitte pas l'app (close → `hide()` côté Rust) ; le JS
   appelle `gui_closed()` → le daemon **réouvre** sa WS depuis la config. Retour fantôme.
4. **Reconnexion** — si la WS tombe, reconnexion auto avec backoff (1 s → max 30 s).

### Détection show/hide côté JS

Tauri 2 n'expose pas d'event « show »/« hide » natif fiable. On utilise :

- `tauri://close-requested` (déclenché **avant** le hide Rust) → `guiClosed()`.
- `onFocusChanged(focused=true)` **après** un masquage (réouverture via le tray) → `guiOpened()`.

Câblage : `src/desktop/use-desktop-presence.ts`, monté dans `src/SessionApp.tsx`.

## Modules Rust

| Fichier | Rôle |
|---|---|
| `config.rs` | Persistance `presence.json` (load/save). |
| `presence.rs` | Client WS de présence : `hello`, ping 25 s, notifications, backoff. |
| `state.rs` | État partagé (`PresenceHandle` + drapeau GUI ouverte). |
| `commands.rs` | Commandes Tauri : `configure_presence`, `gui_opened`, `gui_closed`. |
| `tray.rs` | Tray bouclier : Ouvrir, statut, Quitter ; clic gauche → focus GUI. |
| `window.rs` | Show/focus + intercept close → hide. |
| `lib.rs` / `main.rs` | Wiring : plugins, state, setup, boot daemon. |

## Dépendances système (build Linux)

- `webkit2gtk-4.1`, `libappindicator3` (tray), GTK 3 — déjà présents sur l'environnement
  validé. Build Rust : `rustc ≥ 1.77`, `cargo`.
