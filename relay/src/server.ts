// Serveur relai de rendez-vous aveugle (Bun.serve websocket). Routing + présence.
// Le payload des messages `signal` est OPAQUE : jamais lu, jamais déchiffré.

import signale from "signale";
import type { ServerWebSocket } from "bun";
import { Registry, type SocketData } from "./registry";
import { EnvelopeStore } from "./envelope-store";
import { BackupStore } from "./backup-store";
import {
  parseClientMessage,
  type HelloMessage,
  type SignalInMessage,
  type RelayInMessage,
  type AckMessage,
  type BackupPutMessage,
} from "./protocol";
import {
  consumeToken,
  createBucket,
  payloadBytes,
  MAX_PAYLOAD_BYTES,
  MAX_BACKUP_BYTES,
} from "./limits";

const PORT = Number(process.env.RELAY_PORT ?? 8791);
const registry = new Registry();
const envelopes = new EnvelopeStore();
const backups = new BackupStore();

type Socket = ServerWebSocket<SocketData>;

function handleHello(ws: Socket, msg: HelloMessage): void {
  const previous = ws.data.addr;
  if (previous && previous !== msg.addr) registry.remove(previous);
  ws.data.addr = msg.addr;
  registry.register(msg.addr, ws);
  ws.send(JSON.stringify({ t: "welcome", online: registry.online() }));
  registry.broadcastExcept(msg.addr, { t: "presence", addr: msg.addr, state: "online" });
  signale.success(`online: ${msg.addr} (${registry.online().length} total)`);
  flushPending(msg.addr);
}

function flushPending(addr: string): void {
  const pending = envelopes.pendingFor(addr);
  for (const env of pending) {
    registry.send(addr, { t: "envelope", id: env.id, from: env.from, payload: env.payload });
  }
  if (pending.length > 0) signale.info(`flushed ${pending.length} envelope(s) to ${addr}`);
}

function handleRelay(ws: Socket, msg: RelayInMessage): void {
  const from = ws.data.addr;
  if (!from) {
    ws.send(JSON.stringify({ t: "error", code: "NOT_REGISTERED" }));
    return;
  }
  if (payloadBytes(msg.payload) > MAX_PAYLOAD_BYTES) {
    ws.send(JSON.stringify({ t: "error", code: "PAYLOAD_TOO_LARGE" }));
    signale.warn(`relay ${from} -> ${msg.to}: PAYLOAD_TOO_LARGE`);
    return;
  }
  const id = crypto.randomUUID().slice(0, 8);
  const stored = envelopes.add({ id, from, to: msg.to, payload: msg.payload, at: Date.now() });
  if (!stored) {
    ws.send(JSON.stringify({ t: "error", code: "STORE_FULL" }));
    return;
  }
  const delivered = registry.send(msg.to, { t: "envelope", id, from, payload: msg.payload });
  signale.info(`relay ${from} -> ${msg.to} [${id}] (${delivered ? "online" : "stored"})`);
}

function handleAck(ws: Socket, msg: AckMessage): void {
  const addr = ws.data.addr;
  if (!addr) {
    ws.send(JSON.stringify({ t: "error", code: "NOT_REGISTERED" }));
    return;
  }
  envelopes.ack(addr, msg.ids);
  signale.info(`ack ${addr} [${msg.ids.length}]`);
}

function handleBackupPut(ws: Socket, msg: BackupPutMessage): void {
  const addr = ws.data.addr;
  if (!addr) {
    ws.send(JSON.stringify({ t: "error", code: "NOT_REGISTERED" }));
    return;
  }
  if (payloadBytes(msg.blob) > MAX_BACKUP_BYTES) {
    ws.send(JSON.stringify({ t: "error", code: "PAYLOAD_TOO_LARGE" }));
    signale.warn(`backup_put ${addr}: PAYLOAD_TOO_LARGE`);
    return;
  }
  if (!backups.put(addr, msg.blob)) {
    ws.send(JSON.stringify({ t: "error", code: "STORE_FULL" }));
    return;
  }
  signale.info(`backup_put ${addr}`);
}

function handleBackupGet(ws: Socket): void {
  const addr = ws.data.addr;
  if (!addr) {
    ws.send(JSON.stringify({ t: "error", code: "NOT_REGISTERED" }));
    return;
  }
  ws.send(JSON.stringify({ t: "backup", blob: backups.get(addr) }));
  signale.info(`backup_get ${addr}`);
}

function handleSignal(ws: Socket, msg: SignalInMessage): void {
  const from = ws.data.addr;
  if (!from) {
    ws.send(JSON.stringify({ t: "error", code: "NOT_REGISTERED" }));
    return;
  }
  if (payloadBytes(msg.payload) > MAX_PAYLOAD_BYTES) {
    ws.send(JSON.stringify({ t: "error", code: "PAYLOAD_TOO_LARGE" }));
    signale.warn(`signal ${from} -> ${msg.to}: PAYLOAD_TOO_LARGE`);
    return;
  }
  const delivered = registry.send(msg.to, { t: "signal", from, payload: msg.payload });
  if (!delivered) {
    ws.send(JSON.stringify({ t: "error", code: "PEER_OFFLINE" }));
    signale.warn(`signal ${from} -> ${msg.to}: PEER_OFFLINE`);
    return;
  }
  signale.info(`signal ${from} -> ${msg.to}`);
}

function routeMessage(ws: Socket, raw: string | Buffer): void {
  if (!consumeToken(ws.data.bucket)) {
    signale.warn(`rate-limited: ${ws.data.addr ?? "anon"} (dropped message)`);
    return;
  }
  try {
    const parsed: unknown = JSON.parse(raw.toString());
    const msg = parseClientMessage(parsed);
    if (!msg) {
      ws.send(JSON.stringify({ t: "error", code: "BAD_MESSAGE" }));
      return;
    }
    if (msg.t === "hello") handleHello(ws, msg);
    else if (msg.t === "signal") handleSignal(ws, msg);
    else if (msg.t === "relay") handleRelay(ws, msg);
    else if (msg.t === "ack") handleAck(ws, msg);
    else if (msg.t === "backup_put") handleBackupPut(ws, msg);
    else if (msg.t === "backup_get") handleBackupGet(ws);
    else if (msg.t === "ping") ws.send(JSON.stringify({ t: "pong" }));
  } catch (err) {
    signale.error("parse/route failed:", err);
    try {
      ws.send(JSON.stringify({ t: "error", code: "BAD_MESSAGE" }));
    } catch (sendErr) {
      signale.error("error reply failed:", sendErr);
    }
  }
}

function handleClose(ws: Socket): void {
  const addr = ws.data.addr;
  if (!addr) return;
  registry.remove(addr);
  ws.data.addr = null;
  registry.broadcastExcept(addr, { t: "presence", addr, state: "offline" });
  signale.info(`offline: ${addr} (${registry.online().length} total)`);
}

await envelopes.load();
await backups.load();
envelopes.startSweep();

const server = Bun.serve<SocketData>({
  port: PORT,
  fetch(req, srv): Response | undefined {
    if (srv.upgrade(req, { data: { addr: null, bucket: createBucket() } })) return undefined;
    return new Response("NULLNODE blind rendezvous relay", { status: 426 });
  },
  websocket: {
    message: routeMessage,
    close: handleClose,
  },
});

signale.start(`NULLNODE relay listening on ws://127.0.0.1:${server.port}`);
