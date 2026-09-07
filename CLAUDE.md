# chat-cats — notes for Claude Code

Stream overlay: voxel cats controlled by Twitch/Kick chat. Owner streams on Twitch, has built chat-triggered OBS overlays before.

## Current state
Prototype lives entirely in `overlay/`. No bundler, no framework — plain HTML + three.js r128 via cdnjs. Keep it that way until there's a reason not to.

## Conventions
- Cats face +x at heading 0; `facing` is a radian heading, `-Math.PI/2` faces the camera. `rotation.y = θ` maps +x to `(cos θ, 0, -sin θ)`.
- All one-shot animations go through `Cat.play(name, dur)` — one `case` in the switch in `update()`, plus a command line in `handleChat`. Reset any transform you touch in the `p>=1` block.
- Cat scale lives in `build()`: `b.scale.setScalar(0.72)`. Body parts are children of `this.body`, not `this.g`.
- Props: `spawnProp(type,x,z)`; cats reserve a prop via `goTo(p)` and must `releaseProp()` on any interruption (already wired into `walkTo` / `play`).
- Bounds: `XMAX`, `ZMIN` (far), `ZMAX` (near). Everything positional clamps to these.
- Style: casual code, terse comments, no over-engineering. Owner prefers blunt feedback.

## Next
See README roadmap. Server should be Node; overlay talks to it over a websocket and replaces the chat-simulator panel.
