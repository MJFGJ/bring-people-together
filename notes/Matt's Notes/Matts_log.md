# Log

Our running work journal, updated at least weekly. Newest entries go at the top.

<!-- Copy this template for each entry:

## YYYY-MM-DD

- **What we tested:**
- **With whom:**
- **What happened:**
- **What surprised us:**

-->

## 2026-11-8 (v5) — Five user tests on the live site
- Note: I used claude to help summarize my findings and right a more indepth log. Some users had similar experiences but for each user I tried to keep their findings distinct. I will use a "Matt's takeaway" section for my actual handwritten conclusions.

-**Matt's Takeaway:** The app works! Multiple cursors were a success. Mobile did not appear really work well so for testing I stuck to desktop. Puzzle is not super engaging and I don't know if this is a good direction. A lot of the other puzzle types I created were so boring I scrapped them on the spot. I want the puzzle to be large enough that it will take people a little bit to figure out but currently the colors can feel really hard to get into place. Dragging feature came in after Elise who was the first tester. The puzzle didnt feel as responsive as I would have liked and needed a little more feedback to players. I think overall it's cool to see the cursors working in real time and I think in general this would be an okay "time-waster" but in the end I don't feel it's super engaging currently. But maybe with a bunch of cursors working at once it could seem more fun. The most cursors I had on screen at once was 4 (me, elise, amber, and me again). It was also clear that the "hue" like puzzle is pretty divisive.
- **What we tested:** the live Spectrum deployment (https://web-eta-one-62.vercel.app), five separate passes each focused on a different angle — first impressions, mobile, multiplayer presence, the rename control, and drag robustness.
- **With whom:** Molly, Kris, Josh, Elise, Amber.
- **What happened, person by person:**
  - **Molly** — came in cold, no instructions read, went straight for a tile. Picked one up and dropped it on another without any hesitation or confusion; the drag-and-drop swap is discoverable on its own, the hint text isn't load-bearing for the core interaction.
  - **Kris** — tested on a phone-width screen (375px). Found a real bug: the board is a fixed width and doesn't fit — the rightmost one to two columns of tiles are clipped off the edge of the screen, and there's no horizontal scroll to reach them. On mobile, part of the puzzle is currently unreachable.
  - **Josh** — opened a second tab to check the multiplayer claim. Moved the mouse around *without* dragging anything, and the live cursor still showed up instantly on the first tab. Presence works for just browsing, not only for active drags.
  - **Elise** —  Submitting a way-too-long name got capped at exactly 20 characters server-side. Found puzzle to be a little overwhelming.
  - **Amber** — tested what happens if you pick up a tile and let go somewhere that isn't the board at all (e.g., over the title). The drag cancelled cleanly: no swap happened, the floating tile disappeared, and the origin slot wasn't left stuck in its dimmed "held" state.
- **What surprised us:** four of the five flows needed little instruction. — the only real problem found was Kris's, and it's a significant one (the game is currently unusable on a phone-width screen). That's the clear next fix.

## 2026-11-7 (v4) — 100 tiles, real pick-up-and-carry dragging

- **Resized to 100 tiles** (10x10, down from 500) with bigger tiles (50px) — a more approachable size, and large enough tiles for the new drag visual to actually read well.
- **Real "picked up" drag feel**: dragging a tile now shows a tilted, shadowed floating copy that follows the cursor, while the tile's original grid slot goes dim/empty (like it's been lifted out) until it's dropped. Previously the tile just stayed in its slot and scaled up slightly in place — this is a much more literal "pick up and move it" feeling.
- This extends to everyone, not just your own drags: remote players' held tiles show the same floating/carried visual on your screen too (colored with a ring matching their cursor color), reusing the existing live cursor + "holding" broadcast — so you can watch someone else physically carrying a piece across the board in real time.
- Verified visually with mid-drag screenshots (both the local and a simulated remote player), on both local dev and the live production deployment, then released each drag to confirm the swap still completes correctly.

## 2026-11-7 (v3) — One global puzzle, no rooms

- **Dropped the room/code system entirely.** The site itself *is* the puzzle now — visit it and you're instantly in the same single shared game as everyone else, no name-entry screen, no room code, no "create or join" step.
- **Puzzle completion is now automatic**: solve it and after a ~3.5s "Solved!" celebration, the server reshuffles a new gradient and everyone's dropped straight into it. No manual "Play Again" button anymore.
- **Added persistent stats**: "X solved all-time" and "Y today," stored in the Durable Object's own storage (survives deploys/restarts) via `ctx.storage`, with day-rollover tracked in UTC.
- **Added a rename control**: first-time visitors get an auto-generated name (e.g. "Swift Fox"), persisted in `localStorage` so it survives reloads; a pencil-icon pill lets anyone rename anytime, which re-broadcasts to everyone's cursor labels live.
- **Scaled the board from 150 to 500 tiles** (25x20), with smaller tiles (22px) to keep the board a reasonable size on screen.
- Verified the whole new loop for real: solved all 500 tiles by sending swap messages directly over a raw WebSocket (first attempt tried to drag all 500 tiles through the UI and crashed the browser tab — 500 rapid DOM/React updates was too much; talking to the server directly was both safer and faster), confirmed stats incremented to 1/1, and watched the board auto-reshuffle into a fresh puzzle a few seconds later, live.
- Deployed both sides again: `wrangler deploy` for the realtime server (same Durable Object, so existing persisted stats carry forward — no migration needed since we only use the schema-less KV storage API), `vercel deploy --prod` for the frontend (the project-level env var from last time meant no shell workarounds needed this round).

## 2026-11-7 (v2) — Claimed into a permanent link

- Logged into Vercel (your account, one-time browser device-code login) and promoted the deploy from a temporary anonymous link to a real `--prod` deployment: **https://web-eta-one-62.vercel.app**
- Hit the env-var bug again in a new form: the first `--prod` deploy built *remotely* on Vercel's own infrastructure (it tried to auto-connect a GitHub repo), so the local shell-env trick that worked for the anonymous `--temporary` deploy didn't apply — a remote build never sees your local shell. Fixed properly this time by setting `NEXT_PUBLIC_PARTYKIT_HOST` as an actual Vercel **project** environment variable (`vercel env add`), which is the right way to do it going forward — redeploy any time with `vercel deploy --prod` and it'll keep using the right host automatically.
- Verified again by downloading the redeployed bundle and grepping for the host before testing live, then confirmed a real room loads and syncs on the permanent URL.

## 2026-11-7 — First public deployment

- **You asked to share Spectrum with people testing on their own computers** — this meant actually deploying it, not just running it locally.
- **Discovery: the hosted PartyKit platform shut down** (23 Oct 2026) — `partykit deploy` is dead. Their own shutdown notice recommends migrating to "PartyServer" running directly on a Cloudflare account, so that's what we did: rewrote `party/index.ts` from PartyKit's `Party.Server` interface to PartyServer's `Server` class (same shape — `onConnect`/`onMessage`/`onClose`/`broadcast` — small API differences only), added `wrangler.jsonc` with a Durable Object binding, and deployed with `wrangler deploy`.
- Also tried a tunnel (expose the local dev servers directly) as a faster alternative — Claude Code's sandbox blocks outbound tunnels from this machine by design (reasonable: that's opening ingress to your computer), so that path was a dead end. Proper cloud deployment was the right call anyway.
- **Live now:**
  - Realtime server (permanent): `https://spectrum-puzzle.mjfgj.workers.dev` — your Cloudflare account, free tier, `npm run deploy:party` redeploys it.
  - Frontend (temporary): a Vercel anonymous deploy, expires ~60 minutes after creation unless claimed into a real account. Good for "try it right now with a few people," not for a link you hand out over days.
- **Hit a real packaging bug along the way**: Next.js's `.env.local` takes precedence over `.env.production` and over Vercel's own `--build-env` flag (that flag doesn't propagate into the Vercel CLI's internal build subprocess for anonymous deploys) — so every deploy kept silently baking in `localhost:1999` instead of the real Cloudflare host. Fixed by setting the env var directly in the shell around the deploy command (and temporarily moving `.env.local` out of the way so it can't shadow it), which Next.js does respect.
- Verified the fix by downloading the deployed JS bundle directly and grepping for the host string before testing in a browser — caught the bug this way before wasting a round-trip on a browser test that would've just failed the same way again.

## 2026-11-6 (v3) — Spectrum gradient fix

- **Problem you caught**: the original rainbow gradient (hue 0° to 360°) actually starts and ends on nearly the *same* color, since hue wraps around a full circle. No clear "goal" to aim for.
- Fixed by generating two random, clearly distinct anchor colors each shuffle (90-180° apart on the color wheel) and interpolating along the *shorter* arc between them — so the puzzle is now literally "one color becoming another," not a full wrap-around rainbow.
- Added a legend above the board (swatch + gradient bar + swatch, labeled Start/End) so players know what they're aiming for before they start, plus small "S"/"E" markers on the first and last grid cells so it's clear *where* the gradient begins and ends spatially, not just what colors.
- Verified the math directly: reconstructed the server's hue-per-tile formula in a test script and confirmed rendered tile colors match the expected shortest-arc interpolation within floating-point rounding noise.

## 2026-11-6 (v2) — "Spectrum"

- **Pivoted away from "needs exactly 5" entirely.** New direction: a single huge shared puzzle that any number of people can join and work on together at once, inspired by the "Hue"-style color-sorting puzzle genre plus the Figma-style live-presence research from the very first log entry.
- Built "Spectrum": a 15x10 grid of 150 colored tiles, shuffled from a full hue spectrum. Anyone who joins the room can drag any tile onto any other tile to swap them — no ownership, no turns, no lobby/ready-up gate. You land straight on the puzzle the moment you join. Solved when every tile sits in its correct spot in the gradient (tile i's hue = i/150 of the way around the color wheel).
- Live presence, Figma-style: every connected player's cursor shows up for everyone else in real time, colored and labeled by name (color now generated by hashing each connection's id, since there's no fixed 5-color roster anymore). While someone is mid-drag, the tile they're holding gets a colored outline visible to everyone else too — not just cursors, but actually seeing pieces being moved.
- Progress is fully transparent this time (unlike the Rune Circle's hidden info) — correctly-placed tiles get a highlighted border and there's a running "X / 150 placed" counter, since a long collaborative task needs a visible sense of momentum to stay motivating.
- Removing the 5-player requirement simplified more than it cost: no more lobby/ready phase, no more "someone disconnected mid-game resets everyone" edge case from the Rush Hour version — people can join and leave anytime without disrupting anyone else's progress.
- **Found and fixed a real bug during testing**: when you released a dragged tile, other players' view of "this tile is being held" never cleared, because cursor position updates only sent on pointer *move*, not on release. Fixed by sending one explicit `holding: null` cursor update on pointer-up.
- Playtested live with 2 simulated players: confirmed swap mechanic, live player count, live cursor + held-tile outline (and the release bug + fix), and the correct-placement counter/highlight all work as designed. Did not hand-solve all 150 tiles (not a useful test); the win-check logic itself is the same proven pattern used in the Rush Hour puzzles.

## 2026-11-6

- **Added drag-to-move and live multiplayer cursors to the Parking Garage.** Cars can now be dragged with the mouse (snaps one grid cell per ~54px of drag, in addition to the existing arrow buttons), and every player sees everyone else's cursor moving over the board in real time, colored and labeled by name — the Figma-style "feels alive" pattern from the original multiplayer research in this log, now actually built.
- **Added two harder puzzles, rotating through all three on replay.** "The Parking Garage" (Level 1, 6x6, the original) → "Gridlock" (Level 2, 6x6, adds a 3-link dependency chain and gives one player two cars to manage instead of one) → "The Long Haul" (Level 3, 7x7 board, two players each get two cars, longer goal-car travel distance). "Play Again" after a win advances to the next level; after level 3 it loops back to level 1. A room that resets mid-game (e.g. someone disconnects) does NOT advance the level — only an actual win does.
- Each layout is hand-built (not randomly generated, like real Rush Hour puzzles) and verified solvable by manually tracing the full move order before testing live — every color has at least one car that must move, so nobody is ever just watching.
- Playtested all 3 levels end-to-end with 5 simulated players, solving each with the traced move order: Level 1 in 22.2s, Level 2 in 21.6s, Level 3 in 62.8s. All cleared correctly and the level counter/rotation behaved as designed.
- UI now supports a player having more than one car of their color (needed for levels 2-3) — shows "Your car 1" / "Your car 2" instead of assuming exactly one.

## 2026-11-5 (v3)

- **Scrapped the Rune Circle too, on your spec this time: a cooperative Rush Hour.** You proposed it directly — each player can only drive cars of their own assigned color, plus everyone can nudge the one car trying to leave the parking lot.
- Built one hand-crafted 6x6 board (not randomly generated — like real Rush Hour, a curated puzzle) where every one of the 5 colors has exactly one car that *must* move before the gold "goal" car can reach the exit. No player is a spectator; everyone's color is load-bearing to the solution.
- The dependency chain in this board: yellow must move right (frees red's escape route) → red moves up → purple must move left (frees blue's escape route) → blue moves down → green moves down (no dependency) → then anyone can drive the gold car the rest of the way to the exit.
- Mechanically this is fully transparent (everyone sees the whole board, unlike the Rune Circle's hidden info) — the "puzzle" is purely figuring out the move order together, which reads as a more legible, more recognizable kind of fun since it's a known game format.
- Playtested end-to-end with 5 simulated tabs: confirmed a premature move gets blocked (tried moving red up before yellow cleared the way — correctly rejected), then solved the full dependency chain and drove the gold car out. Cleared in 52.9s.
- Also fixed the gold car's color during testing — it started too close in hue to the yellow player's car (both gold/amber) and was confusing to tell apart; changed it to white for clear contrast.

## 2026-11-5 (v2)

- **Scrapped the first puzzle — not fun — and rebuilt it as "The Rune Circle."**
- Why: the first mechanic ("Chamber of Five," a cooperative Simon-says) only had one of the 5 players acting at any moment while the other four watched and waited for their color to light up. That's turn-taking, not co-op — confirmed by playtesting, where most of the "game" was literally four idle tabs.
- New mechanic: all 5 players hold one dial each, all turnable at any time, all at once. Every dial has a secret correct rune only the server knows. The room only ever reveals the aggregate count ("3/5 aligned") — never which players are right — so solving it requires everyone fiddling with their own dial simultaneously and talking through it ("I just moved to the triangle, did the count change?"). Door opens after all 5 hold alignment for 1.5s straight.
- This keeps the "needs exactly 5, real-time, bite-sized" shape from round one, but everyone's hands are on something the whole time instead of one person acting while four watch.
- Playtested end-to-end again with 5 simulated tabs: used the aggregate count to deduce each player's correct rune by trial and error, got to 5/5, held it, dungeon cleared in ~49s. Felt much more like an actual shared puzzle.
- Kept from round one: the lobby/ready-up/5-player-gate scaffolding (that part tested fine and didn't need to change).

## 2026-11-5

- **Started building: "Dungeon of Five"** — first playable prototype of the real-time co-op dungeon concept.
- Settled on the shape: bite-sized like Wordle (one short puzzle, a couple minutes), real-time like a video game, needs exactly 5 concurrent players like a Zelda dungeon room needs the whole party.
- Stack: Next.js frontend + PartyKit for realtime room sync. Code lives in `web/`.
- Built round one: a lobby (join by room code, waits for exactly 5, ready-up) that hands off into "The Chamber of Five" — a cooperative Simon-says. Each of the 5 players is permanently assigned one torch color; a 7-step sequence lights up one color at a time and only that color's player can advance it, so the whole party has to pay attention to everyone else's turn, not just their own.
- Tested end-to-end with 5 simulated browser tabs joining the same room code — lobby sync, ready-up triggering the puzzle, turn-by-turn presses, and the win screen all broadcast correctly to all 5 in real time.
- **What surprised us:** Next.js's new Cache Components / instant-navigation validation (new in this Next version) flagged our realtime client page as "blocking" by default — had to turn it off in `next.config.ts` since this app is fully dynamic and has nothing to statically cache anyway.
- Not done yet: only one puzzle type exists, no daily-drop scheduling, nothing deployed.

## 2026-11-3

- **Three examples of Multiplayer**

1. Multiplayer Video Game

- Lobby system with nameplates
- In game models with independent movement
- Audio Cues and Communication with indicators on whose speaking
- Visual indicators with call tags, and feedback. 
- Post game scoreboards and statistics
- Map changes
- Live in game feeds that usually use text to narrate game events.

2. Teams

 - Presence indicators and status icons.
 - Activity status with updates on when people are responding.
 - Meeting and channel rooms that show activity.

 3. Figma

 - Live Cursor with ability to chat, follow, spotlight, comment. Color coded and feels "real-time"
- Live selection and highlighting to see what others are working on, again feels very "real-time" so activity truly feels collaborative.

