import { Server, routePartykitRequest, type Connection } from "partyserver";
import {
  CELEBRATION_MS,
  GRID_COLS,
  GRID_ROWS,
  TILE_COUNT,
  type ClientMessage,
  type Phase,
  type Player,
  type ServerMessage,
} from "../lib/gameTypes";

function shuffledOrder(): number[] {
  const order = Array.from({ length: TILE_COUNT }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

function colorForId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  const hue = hash % 360;
  return `hsl(${hue}, 75%, 60%)`;
}

function randomHuePair(): [number, number] {
  const startHue = Math.floor(Math.random() * 360);
  const arc = 90 + Math.random() * 90; // 90-180 degrees apart, always a clear shift
  const sign = Math.random() < 0.5 ? -1 : 1;
  const endHue = Math.floor((startHue + sign * arc + 360) % 360);
  return [startHue, endHue];
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD, UTC
}

export class SpectrumRoom extends Server {
  players = new Map<string, Player>();
  phase: Phase = "solving";
  order: number[] = shuffledOrder();
  huePair: [number, number] = randomHuePair();
  startedAt: number = Date.now();
  elapsedMs: number | null = null;
  totalCompleted = 0;
  completedToday = 0;
  lastResetDate = todayKey();
  celebrationTimer: ReturnType<typeof setTimeout> | null = null;

  async onStart() {
    const stored = await this.ctx.storage.get<{
      totalCompleted: number;
      completedToday: number;
      lastResetDate: string;
    }>("stats");
    if (stored) {
      this.totalCompleted = stored.totalCompleted;
      this.completedToday = stored.lastResetDate === todayKey() ? stored.completedToday : 0;
      this.lastResetDate = todayKey();
    }
  }

  async saveStats() {
    await this.ctx.storage.put("stats", {
      totalCompleted: this.totalCompleted,
      completedToday: this.completedToday,
      lastResetDate: this.lastResetDate,
    });
  }

  onConnect(connection: Connection) {
    this.sendState(connection);
  }

  onClose(connection: Connection) {
    this.players.delete(connection.id);
    this.broadcastState();
  }

  onMessage(connection: Connection, raw: string | ArrayBuffer | ArrayBufferView) {
    if (typeof raw !== "string") return;
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    if (msg.type === "join") {
      this.handleJoin(connection, msg.name);
    } else if (msg.type === "rename") {
      this.handleRename(connection, msg.name);
    } else if (msg.type === "swap") {
      this.handleSwap(msg.slotA, msg.slotB);
    } else if (msg.type === "cursor") {
      const player = this.players.get(connection.id);
      if (!player) return;
      this.broadcast(
        JSON.stringify({
          type: "cursor",
          playerId: connection.id,
          x: msg.x,
          y: msg.y,
          color: player.color,
          name: player.name,
          holding: msg.holding,
        }),
        [connection.id]
      );
    }
  }

  handleJoin(connection: Connection, name: string) {
    if (this.players.has(connection.id)) {
      this.broadcastState();
      return;
    }
    const trimmed = name.trim().slice(0, 20) || "Adventurer";
    this.players.set(connection.id, { id: connection.id, name: trimmed, color: colorForId(connection.id) });
    this.broadcastState();
  }

  handleRename(connection: Connection, name: string) {
    const player = this.players.get(connection.id);
    if (!player) return;
    player.name = name.trim().slice(0, 20) || player.name;
    this.broadcastState();
  }

  handleSwap(slotA: number, slotB: number) {
    if (this.phase !== "solving") return;
    if (
      !Number.isInteger(slotA) ||
      !Number.isInteger(slotB) ||
      slotA < 0 ||
      slotB < 0 ||
      slotA >= TILE_COUNT ||
      slotB >= TILE_COUNT ||
      slotA === slotB
    ) {
      return;
    }

    const tmp = this.order[slotA];
    this.order[slotA] = this.order[slotB];
    this.order[slotB] = tmp;

    if (this.order.every((tileId, i) => tileId === i)) {
      this.handleSolved();
    }

    this.broadcastState();
  }

  handleSolved() {
    this.phase = "won";
    this.elapsedMs = Date.now() - this.startedAt;

    if (this.lastResetDate !== todayKey()) {
      this.lastResetDate = todayKey();
      this.completedToday = 0;
    }
    this.totalCompleted += 1;
    this.completedToday += 1;
    this.saveStats();

    if (this.celebrationTimer) clearTimeout(this.celebrationTimer);
    this.celebrationTimer = setTimeout(() => {
      this.celebrationTimer = null;
      this.order = shuffledOrder();
      this.huePair = randomHuePair();
      this.phase = "solving";
      this.startedAt = Date.now();
      this.elapsedMs = null;
      this.broadcastState();
    }, CELEBRATION_MS);
  }

  send(connection: Connection, message: ServerMessage) {
    connection.send(JSON.stringify(message));
  }

  sendState(connection: Connection) {
    this.send(connection, { type: "state", state: this.currentState() });
  }

  broadcastState() {
    const message: ServerMessage = { type: "state", state: this.currentState() };
    this.broadcast(JSON.stringify(message));
  }

  currentState() {
    const solvedCount = this.order.reduce((n, tileId, i) => n + (tileId === i ? 1 : 0), 0);
    return {
      phase: this.phase,
      players: [...this.players.values()],
      order: this.order,
      cols: GRID_COLS,
      rows: GRID_ROWS,
      tileCount: TILE_COUNT,
      solvedCount,
      startHue: this.huePair[0],
      endHue: this.huePair[1],
      elapsedMs: this.elapsedMs,
      totalCompleted: this.totalCompleted,
      completedToday: this.completedToday,
    };
  }
}

export default {
  async fetch(request: Request, env: Env) {
    return (await routePartykitRequest(request, env)) || new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
