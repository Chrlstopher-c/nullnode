// Backup zero-knowledge : 1 blob opaque par adresse (dernier écrase). Map persistée JSON (debounce). Le blob n'est JAMAIS lu.

import signale from "signale";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { MAX_ADDRESSES } from "./limits";

const DATA_FILE = new URL("../data/backups.json", import.meta.url).pathname;
const FLUSH_DEBOUNCE_MS = 500;

export class BackupStore {
  private readonly byAddress = new Map<string, string>();
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  // Écrase le blob de l'adresse. Refuse si store plein (nouvelle adresse).
  put(addr: string, blob: string): boolean {
    if (!this.byAddress.has(addr) && this.byAddress.size >= MAX_ADDRESSES) {
      signale.warn(`backup store full (${MAX_ADDRESSES} addr): refused ${addr}`);
      return false;
    }
    this.byAddress.set(addr, blob);
    this.scheduleFlush();
    return true;
  }

  get(addr: string): string | null {
    return this.byAddress.get(addr) ?? null;
  }

  async load(): Promise<void> {
    try {
      const file = Bun.file(DATA_FILE);
      if (!(await file.exists())) return;
      const raw: unknown = await file.json();
      this.hydrate(raw);
      signale.info(`backups loaded: ${this.byAddress.size} address(es)`);
    } catch (err) {
      signale.error("backup load failed:", err);
    }
  }

  private hydrate(raw: unknown): void {
    if (typeof raw !== "object" || raw === null) return;
    for (const [addr, value] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof value === "string") this.byAddress.set(addr, value);
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
      signale.error("backup flush failed:", err);
    }
  }
}
