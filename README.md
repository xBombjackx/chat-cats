# chat-cats

Cozy voxel cats for stream. Chat spawns and customizes a little cat, cats hang out on the overlay, streamer runs events.

## Run

```
npm install
cp .env.example .env   # set TWITCH_CHANNEL and/or KICK_CHANNEL
npm run dev
```

- Overlay: http://localhost:8080/ (press `H` to toggle the simulator/streamer panels)
- Admin: http://localhost:8080/admin — source status, event buttons, chat-as-someone
- Standalone demo without a server: open `overlay/index.html?demo=1&ws=0`

Node 22.13+ (uses the built-in `node:sqlite`). No token needed: Twitch chat is read anonymously over IRC, Kick over its public Pusher socket. If Kick's channel lookup gets Cloudflare-blocked, set `KICK_CHATROOM_ID` in `.env`.

## OBS

Browser source → `http://localhost:8080/?ui=0&bg=0` (1920×1080). Transparent background. Add `&depth=0` to keep cats in a shallow strip at the bottom, `&tags=0` to hide name tags.

### No-go zones

Cats steer around screen rectangles (webcam, alerts) and are hard-clamped out of them, head included. Draw them on the overlay page: show the UI (`H`), *Draw zone*, drag a box. They persist on the server. Or pass them in the URL, as viewport fractions or percentages, which overrides the saved ones:

```
?nogo=0.7,0.55,0.3,0.45          x,y,w,h — one webcam box bottom-right
?nogo=70,55,30,45;0,0,25,20      several, separated by ;
```

Add `&zones=1` to see them in overlay mode.

## Stream Deck / hotkeys

Any HTTP GET or POST works:

```
http://localhost:8080/api/event/fish          wrestlemania catnip fish laser nap refill clearprops
http://localhost:8080/api/chat?user=bob&msg=!meow
http://localhost:8080/api/status
```

## Chat commands

- `!cat [color] [pattern] [hat] eyes <color>` — spawn or restyle
- `!meow !jump !spin !sleep !loaf !wave !zoomies !stretch !roll !pounce !hiss !shake !leave`
- `!pet @name` — walk over and nuzzle

Per-user cooldown (`COOLDOWN_MS`), cat cap with least-recently-active eviction (`MAX_CATS`). Looks persist; cats active within `RESPAWN_HOURS` come back when the overlay reloads. Prop layout persists too.

## Layout

- `overlay/` — the OBS browser source. Single page, three.js from CDN, no build step.
  - `cats.js` — scene, `Cat` class, command parser, props, events, render loop
  - `net.js` — websocket client; receives `chat` / `event` / `init`, sends `cat` / `catgone` / `props` / `zones`
  - `style.css` — panels, name tags, speech bubbles
- `server/` — Node, no framework
  - `index.js` — http (static overlay, `/admin`, `/api/*`) + websocket hub, cooldowns
  - `twitch.js` (tmi.js) / `kick.js` (Pusher ws) → normalized `{platform, user, id, msg}`
  - `db.js` — SQLite: cat looks, prop layout, no-go zones
  - `admin.html` — streamer control page

Cats are keyed `platform:username`; `!pet @name` matches by display name.

## Roadmap

- [x] server: Twitch + Kick chat → websocket → overlay
- [x] persist looks + prop layout in SQLite
- [x] per-user cooldowns, cat cap with LRU eviction
- [x] admin page / Stream Deck HTTP endpoints for events
- [x] no-go zones (webcam rect etc.)
- [ ] channel-point / sub / raid reactions (needs Twitch EventSub + token)
- [ ] companion site for click interaction (Twitch Extension later)
