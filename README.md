# chat-cats

Cozy voxel cats for stream. Chat spawns and customizes a little cat, cats hang out on the overlay, streamer runs events.

## Run

```
npm install
npm run dev
```

Then open http://localhost:8080 (or `npm run open`). live-server reloads the page whenever a file in `overlay/` changes.

## OBS

Browser source → `http://localhost:8080/?ui=0&bg=0` (1920×1080). Transparent background. Add `&depth=0` to keep cats in a shallow strip at the bottom, `&tags=0` to hide name tags. Press `H` on the page to toggle the UI.

## Chat commands (prototype)

- `!cat [color] [pattern] [hat] eyes <color>` — spawn or restyle
- `!meow !jump !spin !sleep !loaf !wave !zoomies !stretch !roll !pounce !hiss !shake !leave`
- `!pet @name` — walk over and nuzzle

## Layout

- `overlay/` — the OBS browser source. Single page, three.js from CDN, no build step.
  - `cats.js` — scene, `Cat` class, command parser, props, events, render loop
  - `style.css` — panels, name tags, speech bubbles
- `server/` — (not yet) Node service: Twitch + Kick chat → websocket → overlay

## Roadmap

- [ ] server: tmi.js / EventSub for Twitch, Kick chat websocket, normalize to `{platform, user, msg}`
- [ ] websocket to overlay; persist looks + prop layout in SQLite
- [ ] per-user cooldowns, cat cap with LRU eviction
- [ ] no-go zones (webcam rect etc.)
- [ ] streamer admin page / Stream Deck HTTP endpoints for events
- [ ] companion site for click interaction (Twitch Extension later)
