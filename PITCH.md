# Pitch drafts and pilot checklist

Drafts to paste, edit freely. Demo: https://xbombjackx.github.io/chat-cats/ · Repo: https://github.com/xBombjackx/chat-cats

## Short post (Reddit / Discord)

**Made a stream overlay where chat's cats live on your starting-soon / BRB screen — looking for a few just-chatting streamers to try it**

Viewers type `!cat` and get a little voxel cat that stays on your stream. They eat, nap, pick secret friends and rivals, sneak up on each other, hide in boxes, and race (with Twitch Predictions if you want). Dogs, raccoons and otters too. You get buttons for feeding time, a treat cannon, a vacuum that sends everyone scrambling, and subs/bits/raids hooks.

It's meant for the parts of a stream where your face is small and chat needs something to do. Live demo you can type into: https://xbombjackx.github.io/chat-cats/

Free while I'm testing it. If you do just-chatting or long starting-soon screens and want it on your stream, reply or DM and I'll set it up with you (10 minutes, one OBS browser source).

## DM to a specific streamer

Hey — I watch your just-chatting bits and built something for exactly that dead-air stretch. It's an overlay where chat spawns cats that hang out on stream and get into trouble (races, sneak attacks, box ambushes). 30-second demo: https://xbombjackx.github.io/chat-cats/

Would you try it for one stream? I'd set it up with you on a call, it's one browser source in OBS, and I'll take it down if chat doesn't bite. No cost.

## What to watch for on a pilot stream

The admin page shows per-day: chat commands, unique chatters, events fired, minutes online. The questions that matter:

1. Did viewers type commands without the streamer prompting them more than once?
2. Did the streamer turn it on again for stream two?
3. What did chat say about it? (Screenshots of chat reacting are the marketing.)

## Pilot setup checklist (10 minutes on a call)

1. Node 22+ on their PC. `npm install`, copy `.env.example` → `.env`, set `TWITCH_CHANNEL` (and `KICK_CHANNEL`).
2. `npm run dev`. OBS → Browser Source → `http://localhost:8080/?ui=0&bg=0`, 1920×1080.
3. Pick a room (or transparent) and animals on `/admin`. Draw a no-go zone over their webcam on the overlay page (press H).
4. Optional: Twitch app for subs/bits/raids/predictions. Skip on the first stream unless they ask.
5. Show them the Stream Deck URLs: `/api/event/race`, `/api/event/feeding`, `/api/event/treat`, `/api/event/vacuum`.
6. Tell chat the one command: `!cat`. Everything else they'll find.

Alternative if they won't install anything: run the server on a cheap VPS with a tunnel, give them the overlay URL with `?key=`. Single-tenant per streamer is fine for a pilot.
