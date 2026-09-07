# chat-cats

Cozy voxel cats for stream. Chat spawns and customizes a little cat, cats hang out on the overlay, streamer runs events.

## Run

```
npm install
cp .env.example .env   # set TWITCH_CHANNEL and/or KICK_CHANNEL
npm run dev
```

- Overlay: http://localhost:8080/ (press `H` to toggle the simulator/streamer panels)
- Admin: http://localhost:8080/admin — source status, settings, event buttons, Twitch connect, chat-as-someone
- Companion page for viewers: http://localhost:8080/play — the same cats live, click one to boop it (needs the server reachable from the internet, e.g. a Cloudflare tunnel or ngrok)
- Standalone demo without a server: open `overlay/index.html?demo=1&ws=0`

Node 22.13+ (uses the built-in `node:sqlite`). No token needed: Twitch chat is read anonymously over IRC, Kick over its public Pusher socket. If Kick's channel lookup gets Cloudflare-blocked, set `KICK_CHATROOM_ID` in `.env`.

## OBS

Browser source → `http://localhost:8080/?ui=0&bg=0` (1920×1080). Transparent background. Add `&depth=0` to keep cats in a shallow strip at the bottom, `&tags=0` to hide name tags.

### Rooms

Pick a room on the streamer panel or the admin settings: bedroom, kitchen, living room, garden, or none (transparent, the default). It's saved for every overlay. `?env=kitchen` in the URL pins one page to a room. Rooms bring furniture cats use: the bed and couch fit two, cats jump on the kitchen counters, and the garden tree is climbable. Your own props (bowls, boxes…) sit on top of whichever room is active.

### No-go zones

Cats steer around screen rectangles (webcam, alerts) and are hard-clamped out of them, head included. Draw them on the overlay page: show the UI (`H`), *Draw zone*, drag a box. They persist on the server. Or pass them in the URL, as viewport fractions or percentages, which overrides the saved ones:

```
?nogo=0.7,0.55,0.3,0.45          x,y,w,h — one webcam box bottom-right
?nogo=70,55,30,45;0,0,25,20      several, separated by ;
```

Add `&zones=1` to see them in overlay mode.

## Twitch subs, bits, raids, follows, channel points

Needs a Twitch app: [dev.twitch.tv/console](https://dev.twitch.tv/console) → Register Your Application, OAuth redirect URL `http://localhost:8080/auth/callback`, category "Chat Bot" or whatever. Put the client ID and secret in `.env`, restart, open `/admin` → **Connect Twitch**. The token is stored in SQLite and refreshes itself.

What happens on the overlay:

- **follow** — a cat turns to the camera, waves, says hi
- **sub / resub** — the subscriber's cat (spawned if they don't have one) gets a party hat if they have no hat, everyone jumps, small fish rain
- **gift subs / cheer** — fish rain scaled by count / bits, everyone celebrates on big ones
- **raid** — a crew of visitor cats named after the raider zoom in, everyone gets the zoomies, visitors leave after 90s
- **channel points** — map reward title → action on the admin page: an event name (`fish`, `catnip`, …) or a chat command run as the redeemer with their input appended (`Custom cat => !cat` lets viewers type `purple crown`)

Simulate any of these without Twitch from the admin page, or `GET /api/test?kind=raid&user=bob&viewers=40`.

## Exposing it (companion page)

`/play` is only useful if viewers can reach the server: run a tunnel (`cloudflared tunnel --url http://localhost:8080`, ngrok, …) and hand out `https://<tunnel>/play`. Before you do, set `ADMIN_KEY` in `.env`. With it set, `/admin`, `/api/*`, `/auth` and the overlay's socket need `?key=<ADMIN_KEY>` (the OBS browser source URL too, and Stream Deck URLs); the companion page stays public. Overlay files themselves are always public — they contain nothing secret.

## Cat race

Fire the `race` event (streamer panel, admin page, Stream Deck `/api/event/race`, or a channel point reward mapped to `race`). Chat types `!join` for 20 seconds; if fewer than two join, random cats fill the field. Cats line up on the left, 3-2-1, then run right with speed bursts, grooming stops and a butterfly to chase. First across wins and wears a crown until the next race.

If Twitch is connected with the predictions scope, each race opens a 30-second Twitch Prediction with the racers as outcomes while the cats wait at the line, and resolves it on the winner. Toggle on the admin page. Tokens from before this feature need one more **Connect Twitch** to pick up the scope.

## Leaderboards and cat of the day

Cozy, not competitive: most naps, most pets given, most zoomies, race wins, most booped on the companion page. `GET /api/leaderboard?n=5` or the admin page. One cat seen in the last week is picked as cat of the day (fixed per calendar day); its name tag glows gold.

## Stream Deck / hotkeys

Any HTTP GET or POST works:

```
http://localhost:8080/api/event/fish          wrestlemania catnip fish laser nap race feeding treat boxes vacuum doorbell cucumber confetti refill clearprops
http://localhost:8080/api/event/treat?x=4&z=1  treat cannon: aim in stage units (x -11..11, z -7..3); omit for random
http://localhost:8080/api/event/boxes?n=5      drop n temporary boxes (they vanish after 3 min)
http://localhost:8080/api/chat?user=bob&msg=!meow       add &platform=twitch to test cooldowns
http://localhost:8080/api/status
http://localhost:8080/api/settings                       GET, or POST {"maxCats":30,"cooldownMs":2500,"respawnHours":6}
```

## Chat commands

- `!cat [color] [pattern] [hat] [size] eyes <color>` — spawn or restyle; sizes `kitten skinny adult fat`
- `!meow !jump !spin !sleep !loaf !wave !zoomies !stretch !roll !pounce !hiss !shake !stalk !lick !leave`
- `!join` — enter the cat race while the window is open
- `!name Biscuit` — name your cat (tag shows it; `!pet @biscuit` and `!pet @yourusername` both work) · `!name` resets
- `!afk` — your cat curls up in a free box or a back corner until your next command · `!follow @name` — tag along with someone for a minute
- Regulars who come back after a day get a welcome from their cat
- `!pet @name` — walk over and nuzzle · `!tackle @name` — pick a fight · `!stalk [@name]` — creep up and pounce

Props: food bowl, water, scratch post, ball, cardboard box (cats climb in, peek out, and sometimes lie in wait to swipe at whoever walks past — which can start a fight), perch (cats hop up and lounge). Each cat also has a fixed sleeping style: loaf, on its side, or belly-up.

Each cat also has a secret personality (chill, lazy, zoomy, clingy or grumpy) that weights what it does when left alone, and a hunger clock: about fifteen minutes after eating it starts hunting for a full bowl, and if there isn't one it sits by the empty bowl, stares at the camera and complains. Just-fed cats purr hearts. Refill is on the streamer panel and `/api/event/refill`.

Cats have secret likes and dislikes (a stable hash per pair, nothing to configure): friends hang out together, greet with nose boops, share bowls and play ball together; rivals hiss when close, get stalked, fight over food and start scraps. Everyone else is neutral.

Per-user cooldown (a ⏳ bubble shows when a command is dropped), cat cap with least-recently-active eviction (raid visitors go first). Looks persist; cats active within the respawn window come back when the overlay reloads. Prop layout persists too. Cooldown, cap and respawn window are editable live on `/admin`; `.env` values are just the defaults.

## Layout

- `overlay/` — the OBS browser source. Single page, three.js from CDN, no build step.
  - `cats.js` — scene, `Cat` class, command parser, props, events, render loop
  - `net.js` — websocket client; receives `chat` / `event` / `twitch` / `init` / `cooldown` / `config` / `poke`, sends `cat` / `catgone` / `props` / `zones` / `state`
  - `?mode=play` — companion mode: no AI, mirrors `state` from the primary overlay at 8 Hz, clicks go back as `poke`
  - `style.css` — panels, name tags, speech bubbles
- `server/` — Node, no framework
  - `index.js` — http (static overlay, `/admin`, `/api/*`) + websocket hub, cooldowns
  - `twitch.js` (tmi.js) / `kick.js` (Pusher ws) → normalized `{platform, user, id, msg}`
  - `twitch-auth.js` — OAuth code flow + Helix client; `eventsub.js` — EventSub websocket → `{kind, user, ...}`
  - `db.js` — SQLite: cat looks, prop layout, no-go zones, twitch token, redeem map
  - `admin.html` — streamer control page

Cats are keyed `platform:username`; `!pet @name` matches by display name.

## Roadmap

- [x] server: Twitch + Kick chat → websocket → overlay
- [x] persist looks + prop layout in SQLite
- [x] per-user cooldowns, cat cap with LRU eviction
- [x] admin page / Stream Deck HTTP endpoints for events
- [x] no-go zones (webcam rect etc.)
- [x] channel-point / sub / raid reactions via EventSub
- [x] companion page for click interaction (`/play`)
- [ ] Twitch Extension version of the companion page
- [ ] more cat looks (imported .vox models?), more props, seasonal hats
