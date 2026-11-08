"use client";

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { usePartySocket } from "partysocket/react";
import {
  GLOBAL_ROOM,
  hueForTile,
  type ClientMessage,
  type CursorMessage,
  type ServerMessage,
  type ServerState,
} from "@/lib/gameTypes";

const TILE = 50;
const GAP = 3;
const PAD = 3;
const STEP = TILE + GAP;
const CURSOR_SEND_INTERVAL_MS = 40;
const NAME_KEY = "spectrum-name";

const ADJECTIVES = ["Swift", "Bright", "Clever", "Bold", "Quiet", "Lucky", "Gentle", "Brave", "Sunny", "Cosmic"];
const NOUNS = ["Fox", "Owl", "Wolf", "Hawk", "Otter", "Lynx", "Finch", "Heron", "Comet", "Maple"];

function randomName() {
  const a = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const n = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  return `${a} ${n}`;
}

function sendMessage(socket: { send: (data: string) => void }, message: ClientMessage) {
  socket.send(JSON.stringify(message));
}

function slotAt(x: number, y: number, cols: number, rows: number): number | null {
  const col = Math.floor((x - PAD) / STEP);
  const row = Math.floor((y - PAD) / STEP);
  if (col < 0 || col >= cols || row < 0 || row >= rows) return null;
  return row * cols + col;
}

type RemoteCursor = Omit<CursorMessage, "type" | "playerId">;
type Pos = { x: number; y: number };

export default function Home() {
  const [name, setName] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [renameDraft, setRenameDraft] = useState("");

  const [state, setState] = useState<ServerState | null>(null);
  const [cursors, setCursors] = useState<Record<string, RemoteCursor>>({});
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragPos, setDragPos] = useState<Pos | null>(null);
  const [hoverSlot, setHoverSlot] = useState<number | null>(null);
  const dragFromRef = useRef<number | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const lastCursorSent = useRef(0);

  useEffect(() => {
    // One-time bootstrap from localStorage (a browser-only API, unavailable
    // during SSR) — not a derived-state effect, so the cascading-render
    // lint rule doesn't apply here.
    const stored = window.localStorage.getItem(NAME_KEY);
    const resolved = stored ?? randomName();
    if (!stored) window.localStorage.setItem(NAME_KEY, resolved);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName(resolved);
  }, []);

  const socket = usePartySocket({
    host: process.env.NEXT_PUBLIC_PARTYKIT_HOST ?? "localhost:1999",
    room: GLOBAL_ROOM,
    enabled: !!name,
    onOpen() {
      sendMessage(socket, { type: "join", name });
    },
    onMessage(event) {
      const msg: ServerMessage = JSON.parse(event.data);
      if (msg.type === "state") {
        setState(msg.state);
        const ids = new Set(msg.state.players.map((p) => p.id));
        setCursors((prev) => {
          const next: Record<string, RemoteCursor> = {};
          for (const [id, pos] of Object.entries(prev)) if (ids.has(id)) next[id] = pos;
          return next;
        });
      } else if (msg.type === "cursor") {
        setCursors((prev) => ({
          ...prev,
          [msg.playerId]: { x: msg.x, y: msg.y, color: msg.color, name: msg.name, holding: msg.holding },
        }));
      }
    },
  });

  useEffect(() => {
    function onPointerUp(e: PointerEvent) {
      const from = dragFromRef.current;
      if (from === null) return;
      if (hoverSlot !== null && hoverSlot !== from) {
        sendMessage(socket, { type: "swap", slotA: from, slotB: hoverSlot });
      }
      dragFromRef.current = null;
      setDragFrom(null);
      setDragPos(null);
      setHoverSlot(null);

      const rect = boardRef.current?.getBoundingClientRect();
      if (rect) {
        sendMessage(socket, { type: "cursor", x: e.clientX - rect.left, y: e.clientY - rect.top, holding: null });
      }
    }
    window.addEventListener("pointerup", onPointerUp);
    return () => window.removeEventListener("pointerup", onPointerUp);
  }, [socket, hoverSlot]);

  function startDrag(slot: number, e: ReactPointerEvent) {
    e.preventDefault();
    const rect = boardRef.current?.getBoundingClientRect();
    dragFromRef.current = slot;
    setDragFrom(slot);
    if (rect) setDragPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }

  function handleBoardPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (dragFromRef.current !== null && state) {
      setDragPos({ x, y });
      const slot = slotAt(x, y, state.cols, state.rows);
      setHoverSlot((prev) => (prev === slot ? prev : slot));
    }

    const now = performance.now();
    if (now - lastCursorSent.current < CURSOR_SEND_INTERVAL_MS) return;
    lastCursorSent.current = now;
    sendMessage(socket, { type: "cursor", x, y, holding: dragFromRef.current });
  }

  function submitRename() {
    const trimmed = renameDraft.trim().slice(0, 20);
    if (trimmed) {
      setName(trimmed);
      window.localStorage.setItem(NAME_KEY, trimmed);
      sendMessage(socket, { type: "rename", name: trimmed });
    }
    setRenaming(false);
  }

  if (!name || !state) {
    return (
      <main className="page">
        <p className="subtitle">Connecting to Spectrum...</p>
      </main>
    );
  }

  const self = state.players.find((p) => p.id === socket.id);
  const boardWidth = PAD * 2 + state.cols * TILE + (state.cols - 1) * GAP;
  const boardHeight = PAD * 2 + state.rows * TILE + (state.rows - 1) * GAP;

  const remoteHolders = Object.entries(cursors).filter(
    ([id, c]) => id !== self?.id && c.holding !== null
  ) as [string, RemoteCursor & { holding: number }][];
  const heldSlots = new Set<number>(remoteHolders.map(([, c]) => c.holding));
  if (dragFrom !== null) heldSlots.add(dragFrom);

  return (
    <main className="page">
      <h1 className="title">Spectrum</h1>
      <p className="dial-hint">
        One puzzle, everyone at once. Drag any tile onto another to swap them — no rooms, no setup, just jump in.
      </p>

      <div className="stats-row">
        <span className="stats-item">
          <span className="stat-value">{state.totalCompleted.toLocaleString()}</span> solved all-time
        </span>
        <span className="stats-item">
          <span className="stat-value">{state.completedToday.toLocaleString()}</span> today
        </span>
      </div>

      <div className="name-row">
        {renaming ? (
          <input
            type="text"
            autoFocus
            value={renameDraft}
            maxLength={20}
            onChange={(e) => setRenameDraft(e.target.value)}
            onBlur={submitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitRename();
              if (e.key === "Escape") setRenaming(false);
            }}
          />
        ) : (
          <button
            className="name-pill"
            onClick={() => {
              setRenameDraft(name);
              setRenaming(true);
            }}
          >
            Playing as <strong>{name}</strong> &#9998;
          </button>
        )}
        <span className="resonance-label">
          {state.solvedCount} / {state.tileCount} placed &middot; {state.players.length} here now
        </span>
      </div>

      {state.phase === "won" ? (
        <div className="card">
          <h2 className="title" style={{ fontSize: "1.4rem" }}>
            Solved! <span className="accent">Next puzzle starting...</span>
          </h2>
          <div className="stat-row">
            <div className="stat">
              <span className="stat-value">{Math.round((state.elapsedMs ?? 0) / 100) / 10}s</span>
              <span className="stat-label">Time</span>
            </div>
            <div className="stat">
              <span className="stat-value">{state.players.length}</span>
              <span className="stat-label">Solvers</span>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="gradient-legend">
            <div className="gradient-legend-end">
              <span className="gradient-legend-swatch" style={{ background: `hsl(${state.startHue}, 75%, 55%)` }} />
              <span className="gradient-legend-label">Start</span>
            </div>
            <div
              className="gradient-legend-bar"
              style={{
                background: `linear-gradient(to right, hsl(${state.startHue}, 75%, 55%), hsl(${state.endHue}, 75%, 55%))`,
              }}
            />
            <div className="gradient-legend-end">
              <span className="gradient-legend-label">End</span>
              <span className="gradient-legend-swatch" style={{ background: `hsl(${state.endHue}, 75%, 55%)` }} />
            </div>
          </div>

          <div
            ref={boardRef}
            className="spectrum-board"
            onPointerMove={handleBoardPointerMove}
            style={
              {
                width: boardWidth,
                height: boardHeight,
                gridTemplateColumns: `repeat(${state.cols}, ${TILE}px)`,
                gridTemplateRows: `repeat(${state.rows}, ${TILE}px)`,
                gap: `${GAP}px`,
                padding: `${PAD}px`,
              } as CSSProperties
            }
          >
            {state.order.map((tileId, slot) => {
              const correct = tileId === slot;
              return (
                <div
                  key={slot}
                  className={`spectrum-tile ${heldSlots.has(slot) ? "is-held" : ""} ${
                    hoverSlot === slot && dragFrom !== null && dragFrom !== slot ? "is-hover-target" : ""
                  } ${correct ? "is-correct" : ""}`}
                  style={{ background: `hsl(${hueForTile(tileId, state.startHue, state.endHue)}, 75%, 55%)` }}
                  onPointerDown={(e) => startDrag(slot, e)}
                >
                  {slot === 0 && <span className="corner-marker corner-marker-start">S</span>}
                  {slot === state.tileCount - 1 && <span className="corner-marker corner-marker-end">E</span>}
                </div>
              );
            })}

            <div className="cursor-layer">
              {dragFrom !== null && dragPos && (
                <FloatingTile
                  pos={dragPos}
                  color={`hsl(${hueForTile(state.order[dragFrom], state.startHue, state.endHue)}, 75%, 55%)`}
                />
              )}
              {Object.entries(cursors)
                .filter(([id]) => id !== self?.id)
                .map(([id, c]) => (
                  <div key={id}>
                    <PlayerCursor name={c.name} color={c.color} pos={c} />
                    {c.holding !== null && (
                      <FloatingTile
                        pos={c}
                        color={`hsl(${hueForTile(state.order[c.holding], state.startHue, state.endHue)}, 75%, 55%)`}
                        ringColor={c.color}
                      />
                    )}
                  </div>
                ))}
            </div>
          </div>
        </>
      )}
    </main>
  );
}

function FloatingTile({ pos, color, ringColor }: { pos: Pos; color: string; ringColor?: string }) {
  return (
    <div
      className="floating-tile"
      style={{
        left: pos.x,
        top: pos.y,
        width: TILE,
        height: TILE,
        background: color,
        boxShadow: ringColor ? `0 0 0 3px ${ringColor}, 0 6px 16px rgba(0,0,0,0.5)` : undefined,
      }}
    />
  );
}

function PlayerCursor({ name, color, pos }: { name: string; color: string; pos: Pos }) {
  return (
    <div className="player-cursor" style={{ left: pos.x, top: pos.y }}>
      <svg width="18" height="18" viewBox="0 0 18 18" style={{ color }}>
        <path d="M2 1 L16 8 L9 10 L7 17 Z" fill="currentColor" stroke="#0a0815" strokeWidth="1" />
      </svg>
      <span className="player-cursor-label" style={{ background: color }}>
        {name}
      </span>
    </div>
  );
}
