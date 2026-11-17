// Live-cursor presence for a single post, so a handful of teammates can see
// each other working on the same post at once (Figma-style).

export type PostitPresence = { id: string; name: string; color: string };

export type PostitClientMessage = { type: "join"; name: string; color: string } | { type: "cursor"; x: number; y: number };

export type PostitCursorMessage = {
  type: "cursor";
  playerId: string;
  x: number;
  y: number;
  color: string;
  name: string;
};

export type PostitServerMessage = { type: "presence"; players: PostitPresence[] } | PostitCursorMessage;
