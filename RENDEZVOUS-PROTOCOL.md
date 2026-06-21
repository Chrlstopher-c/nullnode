# RENDEZVOUS PROTOCOL — NULLNODE

Le relai de rendez-vous est un **relai aveugle** : il ne voit que des **adresses NULLNODE**
(clés publiques) et des **blobs opaques scellés**. Il ne déchiffre jamais rien, ne stocke aucun
message. Son seul rôle : présence + acheminement d'un blob de signaling vers le bon destinataire.

Self-hostable. Par défaut `ws://127.0.0.1:8787`.

## Transport
WebSocket JSON. Une connexion = un opérateur. L'opérateur s'identifie par son **adresse NULLNODE**
(`null:` + base64url(pubkey)), déjà produite par `src/identity/address.ts`.

## Messages CLIENT → RELAI
```ts
{ t: 'hello', addr: string }                 // s'enregistrer (présence online)
{ t: 'signal', to: string, payload: string } // acheminer un blob opaque vers `to`
{ t: 'ping' }                                 // heartbeat (toutes les 25s)
```
À la fermeture du socket → l'opérateur passe offline.

## Messages RELAI → CLIENT
```ts
{ t: 'welcome', online: string[] }                 // adresses online à la connexion
{ t: 'presence', addr: string, state: 'online' | 'offline' }
{ t: 'signal', from: string, payload: string }     // blob opaque entrant
{ t: 'pong' }
{ t: 'error', code: string }
```
Le relai **broadcast** les changements de présence à tous les connectés (petite échelle).
Le client filtre selon son roster.

## Sémantique du `payload` (OPAQUE pour le relai)
Le payload est un **sealed box** (`crypto_box_seal`) chiffré vers la clé publique du destinataire,
contenant `JSON.stringify({ kind: 'offer' | 'answer', sdp })`. Seul le destinataire peut l'ouvrir
avec sa keypair. Le relai ne voit que du ciphertext base64.

> Conversion clé : `crypto_box_seal` attend des clés **X25519 box**. Nos identités sont des keypairs
> `crypto_kx` (déjà X25519). Réutiliser `identity.publicKey` / `identity.privateKey` directement avec
> `sodium.crypto_box_seal(msg, peerPub)` et `sodium.crypto_box_seal_open(cipher, selfPub, selfPriv)`.

## Flux de connexion auto (A initie vers l'ami X, les deux online)
1. **A** : `PeerLink.createOffer()` → scelle `{kind:'offer',sdp}` vers `X.pub` → `signal{to:X.addr, payload}`.
   A connaît `X.pub` (roster). A dérive la session : `deriveSession(idA, X.pub, true)` (initiateur).
2. **X** reçoit `signal{from:A.addr, payload}` → ouvre le sealed box → c'est une offer →
   `deriveSession(idX, pubFrom, false)` (pubFrom = `decodeAddress(from)`) → `PeerLink.acceptOffer(sdp)` →
   scelle `{kind:'answer',sdp}` vers `pubFrom` → `signal{to:from, payload}`.
3. **A** reçoit `signal` → ouvre → answer → `PeerLink.acceptAnswer(sdp)`.
4. DataChannel ouvre → phase `secure`. Messagerie E2E déjà en place (ChaCha20-Poly1305).

## Store-and-forward — messages applicatifs (friend requests, etc.)
En plus du `signal` temps-réel (WebRTC, online-only), le relai achemine des **envelopes**
applicatives **store-and-forward** : si le destinataire est offline, le relai les **stocke** et
les **délivre à son retour** (au `hello`). Persistées sur disque pour survivre au restart.

Messages ajoutés :
```ts
// CLIENT → RELAI
{ t: 'relay', to: string, payload: string }   // envelope opaque store-and-forward
{ t: 'ack', ids: string[] }                    // accuser réception d'envelopes délivrées

// RELAI → CLIENT
{ t: 'envelope', id: string, from: string, payload: string }  // livraison (immédiate ou différée)
```
Comportement relai :
- À `{t:'relay', to, payload}` : générer un `id` (uuid court). Si `to` online → envoyer
  `{t:'envelope', id, from, payload}` immédiatement ET le garder pending jusqu'à `ack`.
  Si offline → stocker pending. Le `payload` reste **opaque** (jamais lu).
- À `{t:'hello', addr}` : après `welcome`, **flush** toutes les envelopes pending de `addr`
  (envoyer chaque `{t:'envelope', id, from, payload}`).
- À `{t:'ack', ids}` : supprimer définitivement ces envelopes du store.
- Store : `Map<address, Envelope[]>` + persistance JSON (`relay/data/envelopes.json`),
  écrite de façon paresseuse (debounce). Le relai ne lit jamais `payload`.

## Sémantique applicative de l'envelope payload (OPAQUE pour le relai)
`crypto_box_seal` vers la clé du destinataire, contenant un de ces objets JSON :
```ts
{ kind: 'friend_request', pseudo: string, address: string }  // A demande à B
{ kind: 'friend_accept',  pseudo: string, address: string }  // B accepte A
{ kind: 'friend_decline', address: string }                  // B refuse A
{ kind: 'profile',        pseudo: string, address: string }  // A annonce son pseudo courant
```
Le `profile` propage les renommages : émis vers chaque ami détecté online (présence) et à
chaque changement de pseudo local. Le destinataire met à jour `pseudo` de l'ami dans son roster.
Le pseudo n'est donc jamais figé au moment de l'ajout.
`address` = l'adresse NULLNODE de l'émetteur (le destinataire l'ajoute à son roster sur accept).
Côté client : module `src/rendezvous/social-envelope.ts` (seal/open de ces objets, réutilise
`crypto_box_seal` comme `sealed-signal.ts`). Le hook social gère l'état des requêtes + réciprocité.

## Backup zero-knowledge (chiffré, opaque pour le relai)
Le relai stocke **un blob chiffré par adresse** (roster + historique + seen + pseudo), pour
récupérer ses données sur un nouvel appareil via la seed. Le relai ne lit **jamais** le blob.

Clé de chiffrement = dérivée de la **seed BIP39**, indépendante de la keypair X25519 :
`crypto_generichash(crypto_secretbox_KEYBYTES, mnemonicToSeedSync(mnemonic), DOMAIN)`
avec `DOMAIN = 'nullnode-backup-v1'` (sel de domaine, séparation des usages). Chiffrement
`crypto_secretbox_easy` (nonce aléatoire 24o préfixé au ciphertext, le tout base64).

Messages ajoutés :
```ts
// CLIENT → RELAI
{ t: 'backup_put', blob: string }   // remplace le blob stocké sous l'adresse de l'expéditeur
{ t: 'backup_get' }                 // demande le blob de l'adresse de l'expéditeur

// RELAI → CLIENT
{ t: 'backup', blob: string | null }  // blob courant (ou null si aucun)
```
Comportement relai :
- `{t:'backup_put', blob}` : exige un socket enregistré (`hello` préalable). Écrase le blob
  sous `ws.data.addr`. Persistance JSON `relay/data/backups.json` (`Map<address, string>`,
  debounce identique à `envelope-store.ts`). `blob` reste **opaque**.
- `{t:'backup_get'}` : exige enregistré. Répond `{t:'backup', blob}` (ou `null`).
- Un seul blob par adresse (le dernier écrase). Pas de versioning, pas de TTL.

## Limite connue (à documenter, pas à masquer)
Le relai aveugle voit le **graphe social** (qui signale qui) et la **présence** — métadonnées.
Acceptable pour un relai self-hosted que tu possèdes ; à noter dans la doc sécurité.

## Bornes anti-abus (relai)
Le relai est exposé publiquement (Cloudflare Tunnel) sans rien lire des payloads. Bornes configurables par env :

| Variable | Défaut | Effet |
|---|---|---|
| `RELAY_ENVELOPE_TTL_DAYS` | 7 | TTL des enveloppes non délivrées (purge au chargement + balayage horaire) |
| `RELAY_MAX_QUEUE_PER_ADDR` | 500 | Max enveloppes en attente par adresse ; drop FIFO des plus anciennes au-delà |
| `RELAY_MAX_PAYLOAD_BYTES` | 65536 | Taille max d'un payload `signal`/`relay` (64 KB) |
| `RELAY_MAX_BACKUP_BYTES` | 1048576 | Taille max d'un blob `backup_put` (1 MB) |
| `RELAY_RATE_PER_SEC` | 30 | Token bucket par socket ; au-delà le message est droppé (la socket n'est PAS kick) |
| `RELAY_MAX_ADDRESSES` | 10000 | Max adresses stockées globalement (enveloppes + backups), borne mémoire |

Codes d'erreur renvoyés (`{ t:"error", code }`) : `PAYLOAD_TOO_LARGE`, `STORE_FULL`, plus les existants
`NOT_REGISTERED`, `BAD_MESSAGE`, `PEER_OFFLINE`. Le dépassement de rate-limit ne renvoie pas d'erreur (drop silencieux côté relai, warn côté logs).

## Contrat existant à réutiliser (NE PAS réécrire)
- `src/transport/peer-link.ts` : `new PeerLink(onState, onMessage)`, `createOffer()`, `acceptOffer(offer)`,
  `acceptAnswer(answer)`, `send(raw)`, `close()`.
- `src/crypto/encryption.ts` : `deriveSession(self, peerPub, initiator)`, `seal`, `open`.
- `src/identity/address.ts` : `encodeAddress(pub)`, `decodeAddress(addr)`.
- `src/identity/use-identity.ts` : `useIdentity()` → `{ identity, address, callsign }`.
- `src/roster/use-roster.ts` : `useRoster(selfId)` → `{ friends, addFriend, removeFriend, toggleVerified }`.
  Les `Friend` ont `address`, `pub` (base64 std variant), `presence`.
- `src/session/use-secure-session.ts` : `useSecureSession(identity)` (canal dead-drop manuel actuel).
