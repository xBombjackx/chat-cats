# chat-cats — notes for Claude Code

Stream overlay: voxel cats controlled by Twitch/Kick chat. Owner streams on Twitch, has built chat-triggered OBS overlays before.

## Current state
`overlay/` — plain HTML + three.js r128 via cdnjs, no bundler. `server/` — Node 22 ESM, `ws` + `tmi.js` only, `node:sqlite` for persistence. Keep both dependency-light until there's a reason not to.

## Conventions
- Cats face +x at heading 0; `facing` is a radian heading, `-Math.PI/2` faces the camera. `rotation.y = θ` maps +x to `(cos θ, 0, -sin θ)`.
- All one-shot animations go through `Cat.play(name, dur)` — one `case` in the switch in `update()`, plus a command line in `handleChat`. Reset any transform you touch in the `p>=1` block.
- Species: `SPECIES[name] = {build, body, tail, say}`. A builder must create the full rig (`head` at `headPos`, `ears[2]`, `eyes[2]` groups, `legs[4]` pivot y=0.4, `tail`, `tongue`, `hatG`, `h`). Animations reference `this.headPos`, never literal head coordinates. Voice lines go through `voice(cat,kind)`. `SPECIES_MODE` (server setting) decides what spawn commands make.
- Markings (stripes, patches, spots, masks, bellies) are `decal(parent,w,h,color,x,y,z,face)` planes on a box face, never protruding boxes; floor tiles and rugs are decals too. Decor must not share a face with the wall/floor (offset ≥0.05) or sit inside a solid box — both z-fight on real GPUs.
- Collisions: one constraint pass per cat per frame in the loop (props, decor rects, zones, bounds; two iterations). Walking cats that keep getting pushed slide sideways for a second, then give up. Don't add separate per-frame clamps.
- Cat scale is `this.baseScale` (0.72 × the size multiplier from `SIZES`); never hardcode 0.72 in animations. Body parts are children of `this.body`; face, ears, hat and tongue are children of `this.head` (pivot at 0.55,1.55,0) so head animations carry them.
- Interrupting an animation goes through `play()`, which calls `resetAnim()` first. New one-shots must be resettable by `resetAnim()` — add any new transform there.
- Elevation: `this.elev` is the cat's resting height (perch). Anything that writes `g.position.y` must add `this.elev`. `onProp` / `inBox` mark a cat parked on a box/perch; `walkTo` and `giveUp` call `dismountNow()` first, so events never have to think about it.
- The neck layer (idle wander, `this.look` glances, walk bob) only runs when no anim/groom/sleep pose owns the head. Per-cat traits (`sleepStyle`, `ph`) come from a hash of the key, like `affinity`.
- Sneak attacks: `sneak(cat,target)` picks a hiding spot (behind, far side of an obstacle/prop, box, or a perch), `crouch` anim waits and watches `cat.sneakTarget`, `sneakPounce` strikes (leaps off if elevated). `giveUp()` clears `sneakTarget`. Furniture seats are `p.taken` slots, released in `releaseProp`.
- Minigames: `race` has its own flow; smaller games use `game.open(name, secs, onStart)` and `!join` routes to whichever is open. `stat(c,'wins')` for winners. Streamer events are methods on `events` plus the `EVENTS` allowlist on the server; the demo director's event list is separate.
- Chat mood: the server turns plain messages into `vibe` (lol/aww/hi/f/hype/bye) and `energy` (msgs/min); the overlay's `vibe()` and `ENERGY` handle them. Settings live in `cfg` on the server and are pushed in `config`/`init` (env, species, holiday, daynight, autoRefillMin, maxCats).
- Personality: `this.T` multipliers from `TRAITS` (key hash). Any new idle behaviour with a probability should multiply by the relevant `T.*`. Hunger: `this.hunger` 0..1, reset by eating.
- Relationships: `affinity(a,b)` is a stable hash of the two keys (-1..1); `isFriend`/`isRival` at ±0.55. Social behaviour lives in `pickIdle`, `goTo`/`useProp`, `squabble`, `wrestle`, `greet`, `stalk`. `busy` guards one fight at a time.
- Props: `spawnProp(type,x,z)`; cats reserve a prop via `goTo(p)` and must `releaseProp()` on any interruption (already wired into `walkTo` / `play`). Call `saveProps()` after layout changes.
- Room decor that stands on the floor goes through `solid(...)` inside `setEnv`, which registers a rect in `obstacles`; cats slide round rects, `freePoint` pushes targets out of them, and the frame loop clamps. Furniture props (bed etc.) use the circular prop repulsion instead.
- Rooms: `setEnv(name)` builds floor/walls/decor into `envGroup` and spawns furniture props flagged `p.env` (never persisted, survive Clear props). Furniture with `cap:2` seats two cats via `this.slot`. Add a room = one `if(name===...)` block in `setEnv` plus the name in `ENVS` (overlay and server).
- Bounds: `XMAX`, `ZMIN` (far), `ZMAX` (near). Everything positional goes through `freePoint(x,z)`, which clamps to these and pushes out of no-go zones. `walkTo` already does it.
- No-go zones are screen rects → floor-space convex polygons (`zoneQuads`), rebuilt on resize/camera change. Anything that raycasts from the camera before the first render must call `camera.updateMatrixWorld()` first.
- Cats keyed `platform:username` (lowercase); `cat.name` is the display name. New cats go through `spawnCat()` (handles the cap). Removal through `removeCat()`.
- Overlay ↔ server messages are tiny JSON `{type,...}`; the list is in README. New streamer events: add to `events` in cats.js and the `EVENTS` allowlist in server/index.js.
- Multi-step events with timeouts must check `cat.dead` before touching a cat.
- Twitch EventSub events arrive at `handleTwitch(m)` in cats.js as `{kind, user, id, ...}`; redeems are resolved server-side (`onTwitchEvent`) into chat commands or events. Test without Twitch via `/api/test?kind=...` or the mock in the session scratchpad pattern: point `TWITCH_ID_URL` / `TWITCH_API_URL` / `TWITCH_EVENTSUB_URL` at a fake.
- `PLAY` (companion page, `?mode=play`): cats have `mirror=true`, `update()` skips AI and follows `cat.net`. Anything that moves cats or spawns from chat must be gated on `!PLAY`; visual-only events (fish, laser dot) are fine.
- Server settings live in `cfg` (sqlite-backed, `/api/settings`), not constants. `MAX_CATS` on the overlay is pushed via a `config` message.
- Style: casual code, terse comments, no over-engineering. Owner prefers blunt feedback.

## Next
See README roadmap.
