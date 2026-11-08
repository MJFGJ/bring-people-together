export const GRID_COLS = 10;
export const GRID_ROWS = 10;
export const TILE_COUNT = GRID_COLS * GRID_ROWS;

// There's only ever one puzzle — everyone who visits the site lands in the
// same room, no code required.
export const GLOBAL_ROOM = "global";

// How long the "Solved!" celebration stays up before the next puzzle starts.
export const CELEBRATION_MS = 3500;

// Interpolates from startHue to endHue along the shorter arc of the color
// wheel, so the gradient reads as "one color becoming another" instead of
// wrapping all the way around back to (nearly) the same hue.
export function hueForTile(tileId: number, startHue: number, endHue: number): number {
  const t = tileId / (TILE_COUNT - 1);
  const diff = ((endHue - startHue + 540) % 360) - 180;
  return (startHue + diff * t + 360) % 360;
}

export type Player = {
  id: string;
  name: string;
  color: string; // css color string, derived from connection id
};

export type Phase = "solving" | "won";

export type ServerState = {
  phase: Phase;
  players: Player[];
  order: number[]; // order[slot] = tileId currently occupying that slot
  cols: number;
  rows: number;
  tileCount: number;
  solvedCount: number;
  startHue: number;
  endHue: number;
  elapsedMs: number | null;
  totalCompleted: number;
  completedToday: number;
};

export type ClientMessage =
  | { type: "join"; name: string }
  | { type: "rename"; name: string }
  | { type: "swap"; slotA: number; slotB: number }
  | { type: "cursor"; x: number; y: number; holding: number | null };

export type CursorMessage = {
  type: "cursor";
  playerId: string;
  x: number;
  y: number;
  color: string;
  name: string;
  holding: number | null;
};

export type ServerMessage =
  | { type: "state"; state: ServerState }
  | CursorMessage
  | { type: "error"; message: string };
