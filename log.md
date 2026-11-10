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

- **What we tested:** the live Spectrum deployment (https://web-eta-one-62.vercel.app), five separate passes each focused on a different angle — first impressions, mobile, multiplayer presence, the rename control, and drag robustness.
- **With whom:** Molly, Kris, Josh, Elise, Amber.
- **What happened, person by person:**
  - **Molly** — came in cold, no instructions read, went straight for a tile. Picked one up and dropped it on another without any hesitation or confusion; the drag-and-drop swap is discoverable on its own, the hint text isn't load-bearing for the core interaction.
  - **Kris** — tested on a phone-width screen (375px). Found a real bug: the board is a fixed width and doesn't fit — the rightmost one to two columns of tiles are clipped off the edge of the screen, and there's no horizontal scroll to reach them. On mobile, part of the puzzle is currently unreachable.
  - **Josh** — opened a second tab to check the "feels alive" multiplayer claim. Moved the mouse around *without* dragging anything, and the live cursor still showed up instantly on the first tab. Presence works for just browsing, not only for active drags.
  - **Elise** — poked at the rename control's edges. Submitting a whitespace-only name was correctly rejected (kept the old name, no blank/broken state). Submitting a way-too-long name got capped at exactly 20 characters server-side — tried bypassing the input's own character limit directly and the server still enforced the cap, so that validation isn't just cosmetic.
  - **Amber** — tested what happens if you pick up a tile and let go somewhere that isn't the board at all (e.g., over the title). The drag cancelled cleanly: no swap happened, the floating tile disappeared, and the origin slot wasn't left stuck in its dimmed "held" state.
- **What surprised us:** four of the five flows held up without any prompting or instructions — the only real problem found was Kris's, and it's a significant one (the game is currently unusable on a phone-width screen). That's the clear next fix.

## 2026-11-8 (v4) — 100 tiles, real pick-up-and-carry dragging

- **Resized to 100 tiles** (10x10, down from 500) with bigger tiles (50px) — a more approachable size, and large enough tiles for the new drag visual to actually read well.
- **Real "picked up" drag feel**: dragging a tile now shows a tilted, shadowed floating copy that follows the cursor, while the tile's original grid slot goes dim/empty (like it's been lifted out) until it's dropped. Previously the tile just stayed in its slot and scaled up slightly in place — this is a much more literal "pick up and move it" feeling.
- This extends to everyone, not just your own drags: remote players' held tiles show the same floating/carried visual on your screen too (colored with a ring matching their cursor color), reusing the existing live cursor + "holding" broadcast — so you can watch someone else physically carrying a piece across the board in real time.
- Verified visually with mid-drag screenshots (both the local and a simulated remote player), on both local dev and the live production deployment, then released each drag to confirm the swap still completes correctly.

## 2026-11-8 (v3) — One global puzzle, no rooms

- **Dropped the room/code system entirely.** The site itself *is* the puzzle now — visit it and you're instantly in the same single shared game as everyone else, no name-entry screen, no room code, no "create or join" step.
- **Puzzle completion is now automatic**: solve it and after a ~3.5s "Solved!" celebration, the server reshuffles a new gradient and everyone's dropped straight into it. No manual "Play Again" button anymore.
- **Added persistent stats**: "X solved all-time" and "Y today," stored in the Durable Object's own storage (survives deploys/restarts) via `ctx.storage`, with day-rollover tracked in UTC.
- **Added a rename control**: first-time visitors get an auto-generated name (e.g. "Swift Fox"), persisted in `localStorage` so it survives reloads; a pencil-icon pill lets anyone rename anytime, which re-broadcasts to everyone's cursor labels live.
- **Scaled the board from 150 to 500 tiles** (25x20), with smaller tiles (22px) to keep the board a reasonable size on screen.
- Verified the whole new loop for real: solved all 500 tiles by sending swap messages directly over a raw WebSocket (first attempt tried to drag all 500 tiles through the UI and crashed the browser tab — 500 rapid DOM/React updates was too much; talking to the server directly was both safer and faster), confirmed stats incremented to 1/1, and watched the board auto-reshuffle into a fresh puzzle a few seconds later, live.
- Deployed both sides again: `wrangler deploy` for the realtime server (same Durable Object, so existing persisted stats carry forward — no migration needed since we only use the schema-less KV storage API), `vercel deploy --prod` for the frontend (the project-level env var from last time meant no shell workarounds needed this round).

## 2026-11-8 (v2) — Claimed into a permanent link

- Logged into Vercel (your account, one-time browser device-code login) and promoted the deploy from a temporary anonymous link to a real `--prod` deployment: **https://web-eta-one-62.vercel.app**
- Hit the env-var bug again in a new form: the first `--prod` deploy built *remotely* on Vercel's own infrastructure (it tried to auto-connect a GitHub repo), so the local shell-env trick that worked for the anonymous `--temporary` deploy didn't apply — a remote build never sees your local shell. Fixed properly this time by setting `NEXT_PUBLIC_PARTYKIT_HOST` as an actual Vercel **project** environment variable (`vercel env add`), which is the right way to do it going forward — redeploy any time with `vercel deploy --prod` and it'll keep using the right host automatically.
- Verified again by downloading the redeployed bundle and grepping for the host before testing live, then confirmed a real room loads and syncs on the permanent URL.

## 2026-11-8 — First public deployment

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

## 2026-11-4

- **Project Concept**
- **Alex Kramer**

App for planning group events in advance

My idea is an app for big groups of people whether that's family, friends, school groups, etc. Talking to my dad brought up a memory of trying to plan a big group event with our family friends. He was always in charge of planning and booking either a canoe trip or a tailgate to a Brewer game. My idea is to make an app where people can put in things in their schedules that are planning, not allowing them to do this event that day. Then after people submit these dates the app will come up with the best day to do this event. I was also thinking it could implement venmo or paypal into the app so that people could pay for tickets, housing, or whatever they owe through the app. 

## 2026-11-4

- **Three Interviews**
- **Alex Kramer**


1. Tony Kramer (Dad)

Warm up

Normal week looks like partial time on the road meeting customers, demos, meetings. 
Meeting with customers 3 days a week, other three days are in office working on emails followups, planning, presentations. 
Doesn’t have a home office, mixed between working with customers and in office in front of laptop. 

Groups they already belong to
Family group chat with Wordle and share results early in the morning. 
Lots of group chats at work: whole team, only Wisconsin team members, 
Emails and text messages everyday for random companies and healthcare companies. 
The big group chat was set up by boss. People ask if others have products to send, or if someone needs help with a customer that they met with. It’s a good way to get a big message out fast. People use it as needed. They have 10 people on the team and it is just a big chat to help each other out and put their heads together. 

How they connect
Last time he had a good time was the Brewer’s parade. There were lots of people all together routing for the same team. Lots of different kinds of people all coming together to be happy for their team. He said it was well organized and ran smoothly. 
Meeting someone new - it is important to get the phone number, but also linkedIn is important for a work standpoint. Instagram is also a really good way for less formal. 
When having off time he likes a combination of relaxing and being solo and being with family or play something fun like golf or dinner. Not usually a fan of a huge group of people. 

What gets in the way
Certain groups of friends he wishes he saw more like family friends he grew up with. It is hard to plan stuff because of distance and they have kids in activities. 
Our family plans a brewers game or canoeing trip and it is so hard to plan with everyone having stuff going on.
Annoying messages constant reminders, begging to buy stuff makes him not want to join clubs or groups. 

Motivation Probes
Something that is well communicated and knows what to expect. There has to be value in the event he wants to do. 
The fear of missing out is sometimes the reason that he’s done something just because other people are doing it. There was an high school board meeting that he went to even though he wouldn’t have done it. He went because there were lots of people going and trying to get participation for a good cause. He got lots of emails and text messages telling that they were going. There were also conversations in person saying it was important and he should go do this. 
He started biking because one of our friends was dating a guy who liked biking a lot. He had never biked before but after this guy talked about it, he has biked ever since. 

2. Killian Weston (Friend)

Warmup 
Daily routine is sleeping in super late because he works at a bar. He goes to all his classes during the week and also going to the gym 5-7 days a week. He also works on his music a lot specifically the marketing. 

Groups they already belong to 
Family and close friends, frat members, roommates, work friends (spend a lot of time with them at work), people he has met in his major he sees a lot. 
Prides himself as the person putting himself out there, relationships depend on himself. Reaching out to friends with FaceTime, text, or even just a reel to keep in touch even if time management is hard. 
Group chats he likes sending funny memes or jokes because it keeps the atmosphere lighthearted. Mixing that in with actual important texts keep the group going. 
Likes doing stuff by himself as of late, thinks its more fun. Big groups depend on the group of people he’s with. Music and gym is by himself, but going out and other social things there are a lot of times it’s with lots of friends. 
He does the linkedIn games to old coworkers- good bonding moment. Loves fantasy football as well because he can keep up with old friends. Krillion and the daily tens are also games that he’s recently been playing with close friends - good for a little competitive fire. 

What gets in the way
Close friends from home and we are all in different stages of their lives. Half the group goes to colleges, one lives at home, and two of them has a full-time job. \
Usually it’s only tough to plan stuff when it is brought up last minute or there is not a full plan in advance. That’s when things sometimes fall through. 
Something that would deter him from joining something is clicks. If you don’t connect with a group of people or there is a group that only talks to each other this is something hard to feel like you fit in. 

Motivation
intrinsic motivation- who, what, when, why matters a lot and also if there is something in it for him. He also wants to know if there is someone that wants him to go and basically just why should he. 
Lots of examples where someone shows something and he doesn’t like it, and then he tries it again later in life and then he loves it. 

3. Cindy Kramer (Mom)

Warm-up 
Taking care of the dog, cleaning the house and also trying to mix in something fun for herself every week 

Groups they already belong to
In lots of different facebook groups for plants, political groups on sub stack, groups for the cricket or t-shirt pressing. 
Most of the groups she stumbles upon first, and then she clicks join. If she has a question she can make a post asking the group for help. There’s also a notes column where you can look up commonly asked questions. 

How they connect 
A birthday party, because she was with close friends. It was nice to celebrate someone you care about. 
To stay in touch with someone she would ask for their number mostly and ask if she can reach out. 
She plays puzzle games in the mornings, but doesn’t really share with others. 

What gets in the way
She wishes she saw her best friends more but there is a lot of conflict with jobs and also distance. 
There was a time in Italy where she was planning on going to the dolomites and it got canceled because the communication was not good between a big group and other people changed their plans. 
She is hesitant to join stuff because she is worried about getting along with people 
Something that would motivate her to go somewhere would be to see people she likes.
Didn’t think she would like basketball as much as she does now until I started playing it. 


## 2026-11-3

- **Three examples of Multiplayer**
- **Alex Kramer**



1. Instagram (Specifically DMs): 

- The green circle by the profile picture shows if they are active now, and if they are not active it says active however many minutes/hours ago they were. 
- People can also communicate a song they have been enjoying or a though with the note section at the top. 
- In the chat it says when someone has seen a chat/post, when someone is typing something, and when something is sent. 
- The blue dot to the left of the chat indicates someone has sent something to you and you haven't opened it. 
- The icon on the pages bar has a red dot if you have unopened messages. 
- In the chat if there are multiple people it shows who has seen something with a list of names and their profile pictures. 
- Dot on your username to show your other accounts have notifications. 

2. Life 360: 

- You can see if people are walking or driving, based off of the icon next to their picture. 
- You can see if they are moving because the picture moves at the same speed. 
- Notifications have a purple number next to the envelope to show an unread message. 
- You can send individual people messages like Love ya or ETA?
- You can see how people are driving and if they are speeding
- you can see where they are with a description and how long they have been there. 
- You can see how charged peoples phones are. 
- There is a satellite picture of where people are if you click on their picture. 

3. Apple Music (Shared Playlist)

- You can see who added the song to the playlist with the profile picture over the album cover
- You can see who is in the playlist under the title with a name and profile picture. 
- you can see the usernames of the people in the playlist under the icon of two people. 
- You can also see who the owner is and if you are the owner you can stop the collaboration. 
- There are buttons to share an invite link or a qr code to send. 
- You can also choose if you have to approve collaborators or not. 

4. Multiplayer Video Game

- Lobby system with nameplates
- In game models with independent movement
- Audio Cues and Communication with indicators on whose speaking
- Visual indicators with call tags, and feedback. 
- Post game scoreboards and statistics
- Map changes
- Live in game feeds that usually use text to narrate game events.

5. Teams

 - Presence indicators and status icons.
 - Activity status with updates on when people are responding.
 - Meeting and channel rooms that show activity.

 6. Figma

 - Live Cursor with ability to chat, follow, spotlight, comment. Color coded and feels "real-time"
- Live selection and highlighting to see what others are working on, again feels very "real-time" so activity truly feels collaborative.

 


