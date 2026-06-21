// Store-and-forward des envelopes applicatives opaques.
// Map<address, Envelope[]> persistée en JSON (debounce). Le payload n'est JAMAIS lu.

import signale from "signale";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import {
  ENVELOPE_TTL_MS,
  MAX_QUEUE_PER_ADDR,
  MAX_ADDRESSES,
  TTL_SWEEP_INTERVAL_MS,
} from "./limits";

export interface Envelope {
  id: string;
  from: string;
  to: string;
  payload: string;
  at: number;
}

const DATA_FILE = new URL("../data/envelopes.json", import.meta.url).pathname;
const FLUSH_DEBOUNCE_MS = 500;

export class EnvelopeStore {
  private readonly byAddress = new Map<string, Envelope[]>();
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  // Stocke une enveloppe. Refuse si store plein (nouvelle adresse). Drop FIFO si file pleine.
  add(env: Envelope): boolean {
    const existing = this.byAddress.get(env.to);
    if (!existing && this.byAddress.size >= MAX_ADDRESSES) {
      signale.warn(`store full (${MAX_ADDRESSES} addr): dropping envelope to ${env.to}`);
      return false;
    }
    const list = existing ?? [];
    list.push(env);
    if (list.length > MAX_QUEUE_PER_ADDR) {
      const dropped = list.splice(0, list.length - MAX_QUEUE_PER_ADDR);
      signale.warn(`queue cap ${MAX_QUEUE_PER_ADDR} for ${env.to}: dropped ${dropped.length} oldest`);
    }
    this.byAddress.set(env.to, list);
    this.scheduleFlush();
    return true;
  }

  pendingFor(addr: string): Envelope[] {
    return this.byAddress.get(addr) ?? [];
  }

  ack(addr: string, ids: string[]): void {
    const list = this.byAddress.get(addr);
    if (!list) return;
    const toRemove = new Set(ids);
    const kept = list.filter((env) => !toRemove.has(env.id));
    if (kept.length === 0) this.byAddress.delete(addr);
    else this.byAddress.set(addr, kept);
    this.scheduleFlush();
  }

  async load(): Promise<void> {
    try {
      const file = Bun.file(DATA_FILE);
      if (!(await file.exists())) return;
      const raw: unknown = await file.json();
      this.hydrate(raw);
      signale.info(`envelopes loaded: ${this.byAddress.size} address(es)`);
      this.purgeExpired();
    } catch (err) {
      signale.error("envelope load failed:", err);
    }
  }

  // Supprime les enveloppes dont `at` dépasse le TTL. Persiste si quelque chose a été retiré.
  purgeExpired(): void {
    const cutoff = Date.now() - ENVELOPE_TTL_MS;
    let removed = 0;
    for (const [addr, list] of this.byAddress) {
      const kept = list.filter((env) => env.at >= cutoff);
      removed += list.length - kept.length;
      if (kept.length === 0) this.byAddress.delete(addr);
      else if (kept.length !== list.length) this.byAddress.set(addr, kept);
    }
    if (removed > 0) {
      signale.warn(`TTL purge: removed ${removed} expired envelope(s)`);
      this.scheduleFlush();
    }
  }

  // Démarre le balayage périodique TTL. Retourne le handle pour arrêt éventuel.
  startSweep(): ReturnType<typeof setInterval> {
    return setInterval(() => this.purgeExpired(), TTL_SWEEP_INTERVAL_MS);
  }

  private hydrate(raw: unknown): void {
    if (typeof raw !== "object" || raw === null) return;
    for (const [addr, value] of Object.entries(raw as Record<string, unknown>)) {
      if (Array.isArray(value)) this.byAddress.set(addr, value as Envelope[]);
    }
  }

  private scheduleFlush(): void {
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = setTimeout(() => {
      void this.flush();
    }, FLUSH_DEBOUNCE_MS);
  }

  private async flush(): Promise<void> {
    this.flushTimer = null;
    try {
      await mkdir(dirname(DATA_FILE), { recursive: true });
      const obj = Object.fromEntries(this.byAddress);
      await Bun.write(DATA_FILE, JSON.stringify(obj));
    } catch (err) {
      signale.error("envelope flush failed:", err);
    }
  }
}
