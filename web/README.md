# Spectrum

A single, huge, real-time shared color puzzle. No rooms, no setup — go to the site and you're instantly in the same live game as everyone else, dragging tiles into a gradient together (the Figma-style multiplayer-presence concept from the project log).

**Live right now:** https://web-eta-one-62.vercel.app

**How it works:** there's one global puzzle — a 10x10 grid of 100 tiles, shuffled from a gradient between two randomly-picked, clearly distinct colors (90-180° apart on the color wheel, interpolated along the shorter arc — not a full rainbow wrap, which would start and end on nearly the same hue). Anyone who visits can drag any tile onto any other to swap them — no ownership, no turns, no lobby. Solved when every tile sits in its correct spot; a few seconds later the server reshuffles a new one automatically and everyone's dropped straight into it.

- Dragging a tile really looks like picking it up: a tilted, shadowed copy follows your cursor while the tile's own grid slot goes dim until you drop it. This shows for everyone's drags, not just your own — watch someone else carry a piece across the board live, with a colored ring matching their cursor.
- A legend above the board shows the Start and End colors (swatch + gradient bar + swatch), and small "S"/"E" markers on the first and last grid cells show where the gradient begins and ends spatially.
- Live cursors: everyone's mouse shows up for everyone else, colored and labeled by name.
- A running "X / 100 placed" counter and a highlighted border on correctly-placed tiles, so progress stays visible over a shared task.
- Persistent stats: how many puzzles have been solved all-time, and how many today (resets at UTC midnight) — survives restarts and deploys.
- A rename pill: first visit gets you a generated name (e.g. "Swift Fox") saved in your browser; click it anytime to change what others see.

(Earlier rounds all required exactly 5 players and a room code: "The Chamber of Five" (Simon-says, scrapped — too passive), "The Rune Circle" (hidden-info dials, scrapped), and a 3-level cooperative Rush Hour. See the log for the full history of why each was scrapped, and why rooms went away entirely after that.)

## Stack

- [Next.js](https://nextjs.org) (App Router) for the frontend — the whole app is a single page at `/`
- [PartyServer](https://github.com/threepointone/partyserver) on a Cloudflare Worker + Durable Object for the realtime server (`party/index.ts`) — PartyKit's own hosted platform shut down in Oct 2026, so this is their recommended migration path, and keeps the same `Server` API shape. Everyone connects to the same fixed room name (`GLOBAL_ROOM` in `lib/gameTypes.ts`), so there's exactly one live Durable Object instance for the whole app.

## Running locally

You need two dev servers running at once: the realtime server and the Next.js app.

```bash
npm run dev:party
```

```bash
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000) — you're straight on the puzzle, no setup.

## Deploying

The realtime server deploys to your own Cloudflare account (free tier):

```bash
npm run deploy:party
```

The frontend deploys to Vercel. The project's `NEXT_PUBLIC_PARTYKIT_HOST` environment variable is already set in the Vercel project (Production), pointing at the Worker above — `vercel deploy --prod` will keep using it automatically:

```bash
npx vercel deploy --prod
```

If you ever need to change the realtime host, update it with `vercel env rm NEXT_PUBLIC_PARTYKIT_HOST production` then `vercel env add NEXT_PUBLIC_PARTYKIT_HOST production`, then redeploy. (A quick one-off anonymous link is also possible with `vercel deploy --temporary` — no login needed, but it expires in about an hour, and since that build runs locally rather than through the project's env vars, you'd need to move `.env.local` aside and set `NEXT_PUBLIC_PARTYKIT_HOST` directly in the shell for that one command.)

## What's not here yet

- No accounts — names are per-browser (`localStorage`), not tied to an identity
- No daily-scheduled drop time (see the project log for that earlier direction)
- No touch/mobile drag support yet (pointer events should mostly work, but untested on a touch device)
