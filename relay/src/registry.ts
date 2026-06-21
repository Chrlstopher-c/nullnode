// Registre de présence en mémoire : adresse NULLNODE -> socket. Aucune persistance.

import type { ServerWebSocket } from "bun";
import type { ServerMessage } from "./protocol";
import type { TokenBucket } from "./limits";

export interface SocketData {
  addr: string | null;
  bucket: TokenBucket;
}

type Socket = ServerWebSocket<SocketData>;

export class Registry {
  private readonly byAddress = new Map<string, Socket>();

  register(addr: string, ws: Socket): void {
    this.byAddress.set(addr, ws);
  }

  remove(addr: string): boolean {
    return this.byAddress.delete(addr);
  }

  has(addr: string): boolean {
    return this.byAddress.has(addr);
  }

  online(): string[] {
    return [...this.byAddress.keys()];
  }

  send(addr: string, message: ServerMessage): boolean {
    const ws = this.byAddress.get(addr);
    if (!ws) return false;
    ws.send(JSON.stringify(message));
    return true;
  }

  broadcastExcept(exclude: string, message: ServerMessage): void {
    const data = JSON.stringify(message);
    for (const [addr, ws] of this.byAddress) {
      if (addr === exclude) continue;
      ws.send(data);
    }
  }
}
