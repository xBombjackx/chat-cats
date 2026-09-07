# Ideas backlog

Owner's list, grouped roughly cheapest to hardest within each bucket, with triage notes in *italics*.
Not commitments. Cross things off or reorder freely.

## Your cat
- Naming your cat separately from your username, `!name Biscuit` — *cheap, display name field*
- Accessories beyond hats: collars with tags, scarves, glasses, wings, tiny backpacks — *modeling time per item; collars/glasses quick*
- Moods that show: unfed cat goes grumpy, well-fed cat purrs with hearts — *medium; bowls already deplete, needs a hunger clock + visible signal*
- Cat "levels" from time in chat, unlocking cosmetics (loyalty, not skill) — *medium-cheap; needs active-minutes counter server-side*
- Personality traits picked at spawn: lazy / zoomy / clingy / grumpy, weighting the idle AI — *cheap; same hash trick as affinity*
- Kittens: long-time regulars can have their cat "adopt" a kitten that follows them — *structural: breaks one-cat-per-chatter (cap, eviction, persistence)*
- `!afk` puts your cat in a cat bed until you type again — *cheap; bed prop + parked state*
- Your cat greets you when you come back after days away — *cheap; last-seen is stored*

## Interaction between chatters
- `!pet`, `!boop`, `!hug`, `!fight @name` — *have pet/boop/hug and !tackle*
- `!gift @name fish` — item economy with fish as currency — *push back: inventory + anti-abuse, and it turns cozy into grind. If ever: cosmetic only, never scarce*
- Cat "friendships": cats petted together start sitting together — *affinity is a static hash today; learned delta per pair in sqlite is a small change*
- `!follow @name` — *cheap; friend-follow logic exists*
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
- Cucumber event — *cheap; arch + jump exist*
- Vacuum event: everyone scatters — *cheap*
- Doorbell: all cats run offscreen and creep back — *cheap; stalk anim exists*
- Feeding time announcement pulls every cat to the bowls — *cheap*
- Treat cannon aimed with a Stream Deck — *cheap; poke logic exists*
- Sub/raid/bits hooks: raid drops a crate of boxes, subs get party hat + confetti — *cheap*

## Persistence and meta
- Cozy leaderboards: most naps, most pets given, longest zoomies — *cheap counters*
- Cat of the day: spotlight + name tag glow — *cheap*
- Cat census page on the companion site
- Cats resume what they were doing next stream — *positions are cheap to persist; states not worth it*

## Suggested order
1. Race + scaffold (done) · 2. personality traits + moods · 3. streamer event pack · 4. cheap per-cat commands (`!name`, `!afk`, `!follow`, welcome back) · 5. leaderboards / cat of the day · economy last or never.
