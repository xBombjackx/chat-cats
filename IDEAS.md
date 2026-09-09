# Ideas backlog

Owner's list, grouped roughly cheapest to hardest within each bucket, with triage notes in *italics*.
Not commitments. Cross things off or reorder freely.

## Your cat
- ~~Naming your cat separately from your username, `!name Biscuit`~~ — *done*
- Accessories beyond hats: collars with tags, scarves, glasses, wings, tiny backpacks — *modeling time per item; collars/glasses quick*
- ~~Moods that show: hunger~~ — *done via bubbles (complaints at empty bowls, hearts when fed); a visible model change is still open*
- Cat "levels" from time in chat, unlocking cosmetics (loyalty, not skill) — *medium-cheap; needs active-minutes counter server-side*
- ~~Personality traits picked at spawn~~ — *done: chill/lazy/zoomy/clingy/grumpy*
- Kittens: long-time regulars can have their cat "adopt" a kitten that follows them — *structural: breaks one-cat-per-chatter (cap, eviction, persistence)*
- ~~`!afk`~~ — *done (box or back corner)*
- ~~Your cat greets you when you come back after days away~~ — *done*

## Interaction between chatters
- `!pet`, `!boop`, `!hug`, `!fight @name` — *have pet/boop/hug and !tackle*
- `!gift @name fish` — item economy with fish as currency — *push back: inventory + anti-abuse, and it turns cozy into grind. If ever: cosmetic only, never scarce*
- Cat "friendships": cats petted together start sitting together — *affinity is a static hash today; learned delta per pair in sqlite is a small change*
- ~~`!follow @name`~~ — *done*
- Group naps: one sleeping cat attracts others into a pile — *cheap*
- `!photo` — cats pose, screenshot to chat/Discord — *medium; canvas.toDataURL + Discord webhook*

## Races and minigames
- **Cat race** — *DONE: `race` event, `!join`, bursts, distractions, butterfly, crown, Twitch Predictions hook*
- Obstacle course variant (boxes to jump, tunnel, a box some cats refuse to leave)
- Red light / green light with the laser pointer — *small once the race scaffold exists*
- Box roulette: five boxes drop, `!pick 3`, one has the treat
- Tug of war: two teams pull a yarn string, wins by message count
- Cat stacking, chat votes when it falls — *no physics; fakeable with elevation, will look flimsy*
- Hide and seek: chat guesses where a named cat is — *low visual payoff, cats can only hide in boxes*
- Bingo: cat behaviours as squares
- Cat prediction: which cat reaches the bowl first — *Predictions hook exists now*
- Catnip roulette: one random cat gets it
- Musical cat beds: N cats, N-1 beds — *small once the scaffold exists*

## Streamer / host tools
- Weather: rain (cats run under things), snow (they play in it) — *medium; needs "cover" concept*
- Day/night cycle tied to real time, sleepier at night — *cheap*
- Seasonal decor: pumpkins, a tree cats climb and knock ornaments off
- Roomba that cats ride
- ~~Cucumber event~~ — *done*
- ~~Vacuum event~~ — *done*
- ~~Doorbell~~ — *done*
- ~~Feeding time~~ — *done*
- ~~Treat cannon~~ — *done: `/api/event/treat?x=&z=`*
- ~~Sub/raid/bits hooks: raid box crate, sub confetti~~ — *done*

## Persistence and meta
- ~~Cozy leaderboards~~ — *done: naps, pets, zoomies, race wins, boops*
- ~~Cat of the day~~ — *done*
- Cat census page on the companion site
- Cats resume what they were doing next stream — *positions are cheap to persist; states not worth it*

## Known rough edges
- Control panels (overlay page, press H) fit a normal window now but the compact text is hard to read. Owner said fine for now. Fix idea: tabs or a collapsible sidebar instead of shrinking everything; or move the streamer controls to `/admin` only and keep the overlay panel to the chat simulator.

## Validation plan (2026-09-08)
No channel of our own; the goal is to find out whether streamers want this for starting-soon / BRB / just-chatting screens.
1. ~~Public demo page with auto-director~~ — *done: `overlay/demo.html`, root `index.html` redirects; deploy repo to GitHub Pages*
2. ~~Trailer mode for recording a clip~~ — *done: `index.html?ws=0&trailer=1&env=living`, ~70s scripted*
3. ~~Usage counters~~ — *done: commands / unique chatters / events / online minutes per day, admin + `/api/usage`*
4. Record the clip (`?trailer=1` in OBS), post demo + clip where small just-chatting streamers hang out, offer hands-on setup to 3–5 pilots — demo is live at https://xbombjackx.github.io/chat-cats/
5. Pilot infra: one cheap VPS per pilot streamer (single-tenant is fine), or run it on their PC over a call
6. Decide on hosting / multi-tenant only if pilots keep it on for a second stream

## Suggested order
Batch one (race, traits, hunger, event pack, per-cat commands, leaderboards, cat of the day) is done. Next candidates: group naps, day/night cycle, musical beds / red light green light on the race scaffold, accessories, `!photo`, cat census on /play. Economy last or never.
