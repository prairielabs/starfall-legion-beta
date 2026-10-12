# Starfall Legion Beta

Starfall Legion is a large-scale 16-bit browser space battle: one pilot inside
two autonomous fleets, three lives, hundreds of ships, fighter dogfights,
merchant convoys, artillery fortresses, rail fire, team sensor visibility, squad recalls
and a spectator camera.

The artillery cruiser now reads as a true capital ship: a broader textured
hull, layered armor, spinal cannon and machinery detail. Its rail shot adds a
wide bloom, moving energy bands, muzzle shock, a brief screen punch and a
layered impact tail. This is presentation-only; beam timing, width, damage and
the deterministic simulation are unchanged.

This repository contains the complete free-play game. It is a static browser
application with no build step and no runtime dependencies.

## Play locally

Requires Node.js 22 or newer.

```sh
npm start
```

Then open [http://localhost:8080](http://localhost:8080).

## Controls

- WASD or arrow keys: fly
- Space or primary click/tap: fire
- Tab: sector map; while spectating, cycle living friendly ships
- Drag, WASD, arrows, or gamepad stick while spectating: free camera
- `+` / `-` or mouse wheel: zoom
- `M`: mute
- `P` or Escape: pause

## Selected hackathon release — October 12, 2026

This is the exact free-play asset set tested and published at
https://starfalllegion.com/play/. The opening roster is 404 ships, 202 per side,
with full-direction flight, the moving launch and following camera, scouts,
three ten-ship cavalry wings per side, and team sensor visibility.

Both free admirals choose local orders. They first recall at 30 seconds;
each reply is followed by a 15-second rear regroup and each side schedules
its next request independently. There are no model-provider calls here.

Artillery cannot produce additional fighters. Pending launch jobs in resumed
saves are discarded while existing ships, wounds and progress remain intact.
Pilot replacement transfers control to an existing fighter. Matches end when
a command ship dies or at the five-minute limit; exhausted pilots spectate.

The selected version retains mute/unmute, Tab map, zoom and pause controls.
A volume slider and persistent zoom preference are not included in this version.
The separately operated hosted edition retains its access system and Luna 6
admirals; it does not publish those services or credentials in this repository.

## Project layout

```text
dist/
  index.html          Browser entry point
  simulation.js       Deterministic 30 Hz battle engine, command ships and admirals' clocks
  grid.js             The 14 x 14 strategic grid
  board.js            Pieces, visibility, legal moves and a text board
  game.js             Canvas renderer, controls, HUD, camera
  arcade.js           Free-play session and local fleet decisions
  render-timing.js    Display interpolation and frame metering
  sound.js            Browser audio mixer
  storage.js          Local saves and high scores
  assets/             Font and CC0 audio
tests/                 Focused gameplay and presentation contracts
server.mjs             Zero-dependency local static server
```

The commercial beta-code, payment, Mint, provider-key, and hosted inference
services are deliberately not part of this repository. The free edition uses
local fleet decisions and requires no account, code, API key, or network call.

## Beta access and the Prairie Labs system

This public repository is the open free-play game. Beta access codes and
provider-backed sessions belong to the separately operated Starfall Legion /
GenSim portal system from [Prairie Labs](https://prairielabs.ai). Existing beta
players should enter their code through the hosted experience at
[starfalllegion.com](https://starfalllegion.com); the open-source build neither
issues nor redeems codes.

Please do not paste beta codes, provider keys, session data, or portal
credentials into issues, pull requests, commits, or browser code. The GenSim
service boundary is intentionally absent here so the game can stay genuinely
public without publishing customer access or operational infrastructure.

## Agents and Everywhere AI tinkerers

OpenRouter- and OpenAI-based experimenters are welcome to wire in their own
fleet commanders. Start with [`AGENTS.md`](AGENTS.md): it documents the local
decision seam, legal-order boundary, sensor-limited visibility contract, and the rule that API
keys and model calls must remain behind a server you control. The checked-in
free adapter stays local and deterministic, so cloning this repository never
spends tokens or contacts a model provider.

## Test

```sh
npm test
```

## Contributing

Issues and pull requests are welcome. Please keep changes deterministic,
preserve team sensor visibility, and include a focused test for gameplay rule
changes. Agent integrations should follow [`AGENTS.md`](AGENTS.md). Never add
credentials, access codes, paid-session data, or proprietary service
configuration.

## License and credits

Game code and original presentation are released under the [MIT License](LICENSE).
The bundled Arcade font is covered by its included SIL Open Font License. Sound
effects and music are CC0; exact sources and transformations are documented in
[`dist/assets/audio/CREDITS.txt`](dist/assets/audio/CREDITS.txt).

Created by [Prairie Labs](https://prairielabs.ai).

The fleet-charge update halves cavalry to 10 ships per side, tightens squadron cohesion, and opens with a 3.5-second flight from the friendly formations into the moving pilot. Hosted model radio uses the arcade font and direct unit-addressed orders; the free edition continues to use local commanders. Existing saved fleets retain their ships; the smaller cavalry roster applies to fresh battles.

The pilot now starts in the middle fighter wing, cruising until movement or fire takes control. Entry zoom runs at display cadence and blends into the regular follow camera; plain white stars stay visible at every zoom.

One central cavalry wing remains per side. Capital health increases 20%; the command ship advances behind the battery line and escorts stay near their hulls. Battles end by 300 seconds of simulation time. Supplied ChatGPT and Gemini PNGs are rendered directly on hulls and the HUD.

Launch reminds the pilot to stay with their squadron. Cavalry starts at the rear and joins after the fighters; capital approach now uses a 55-second rendezvous. Commander radio shows completed orders for eight seconds before fading; local orders are labeled explicitly.

Background stars are plain, irregularly scattered white dots. Hosted play refreshes stale saved provider connections from the same activation code before any pulse debit; unsupported old cards require re-entry with a current OpenRouter code.

Radio replies now hold for eight seconds and fade over 0.7 seconds. Initial commander calls are staggered at 30/45 seconds; later calls wait for the other reply to clear.

Commander messages address their own units only. Desktop radio occupies the gaps between points and the blue score, and between the red score and audio controls. Only completed orders appear; no channel-opening announcement.

## Final live release

Play the official model-powered beta at [starfalllegion.com](https://starfalllegion.com) with a beta code. The no-code live fallback is at [/lastresort/](https://starfalllegion.com/lastresort/). This repository remains the standalone free edition with local commanders.

Music volume is slightly increased, with effects unchanged. Lobby music attempts to start on load and unlocks on the first click or keypress when required by the browser.
