# Starfall Legion Beta

Starfall Legion is a large-scale 16-bit browser space battle: one pilot inside
two autonomous fleets, three lives, hundreds of ships, fighter dogfights,
merchant convoys, artillery fortresses, rail fire, full battlefield visibility, squad recalls
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

## Commander battles

Scouts are removed. The pilot starts cruising from the left-middle of its
fighter swarm at the same 245-unit speed as the squadron. Finish locks apply
only to damaged capital hulls. The arcade powers on at its final title size;
the opening flight view is wider, with a scroll/keyboard or phone-pinch hint.

The fleets now close toward the centre in about 70 seconds. Capital ships stay
on their own side of the centre line; fighters and cavalry can cross to attack.
Cavalry formations use their faster class speed. The hosted model edition shows
a short radio comment when each admiral completes its orders.

The hosted paid edition now pits **ChatGPT (GPT-5.6 Terra), blue**, against
**Gemini (Gemini 3.8 Flash), red**. This public free edition continues to use
local admirals, with no provider connection or code required. Squadron markers
are compact green dots on the minimap and sector map.

Every battle is now a chess match between two admirals played out by 356
ships. Each side has a command ship, a broad flagship with eight light mounts
and a spinal cannon that fires three-round bursts, guarded by an elite escort
of ten double-shot ships. The game ends the moment a command ship dies.

The admirals never see individual ships. They see pieces on a 14 x 14 board
(`dist/grid.js`, `dist/board.js`): fighter squadrons, scout pairs, artillery
batteries, cavalry, merchant convoys and the command ships, each with its
weighted remaining strength. Every 30 seconds plus the time the admiral takes
to think, it sends each piece to a square within its reach; while it thinks,
its fighters recall to their squadrons, batteries, convoys and escort ring.
A piece finishing a broken enemy piece stays on the kill. In this free
edition both admirals are local standing-orders players; the hosted beta at
starfalllegion.com runs a language model on each side and shows their names on
the scorebar.

## Current beta behavior

- The opening fighter engagement begins at roughly ten seconds.
- Red edge arrows point toward nearby sensor-visible enemies outside the view;
  brighter arrows mean more contacts in that direction.
- Fighters retain formation-level objectives but select and retaliate against
  opponents individually, producing distributed dogfights.
- Recalls last while the admiral thinks, then regroup for 2.5 seconds on the squadron centre.
- Green corner ticks and map dots identify the player's squadron; the pilot flies in a centre squadron.
- Spectating uses an auto cam that rides with a ship in the action and hops every few seconds; Tab cycles by hand.
- Three cavalry wings per side; the third holds the centre of the line.
- When the pilot's lives are exhausted, the fight continues in spectator mode.

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
decision seam, legal-order boundary, full-visibility contract, and the rule that API
keys and model calls must remain behind a server you control. The checked-in
free adapter stays local and deterministic, so cloning this repository never
spends tokens or contacts a model provider.

## Test

```sh
npm test
```

## Contributing

Issues and pull requests are welcome. Please keep changes deterministic,
preserve full battlefield visibility, and include a focused test for gameplay rule
changes. Agent integrations should follow [`AGENTS.md`](AGENTS.md). Never add
credentials, access codes, paid-session data, or proprietary service
configuration.

## License and credits

Game code and original presentation are released under the [MIT License](LICENSE).
The bundled Arcade font is covered by its included SIL Open Font License. Sound
effects and music are CC0; exact sources and transformations are documented in
[`dist/assets/audio/CREDITS.txt`](dist/assets/audio/CREDITS.txt).

Created by [Prairie Labs](https://prairielabs.ai).

The fleet-charge update halves cavalry to 10 ships per side, tightens squadron cohesion, and opens with a 3.5-second flight from the friendly formations into the moving pilot. Hosted model radio uses the arcade font and direct rival-addressed orders; the free edition continues to use local commanders. Existing saved fleets retain their ships; the smaller cavalry roster applies to fresh battles.

The pilot now starts in the middle fighter wing, cruising until movement or fire takes control. Entry zoom runs at display cadence and blends into the regular follow camera; colored arcade stars stay visible at every zoom.

One central cavalry wing remains per side. Capital health increases 20%; the command ship advances behind the battery line and escorts stay near their hulls. Battles end by 300 seconds of simulation time. Supplied ChatGPT and Gemini PNGs are rendered directly on hulls and the HUD.

Launch reminds the pilot to stay with their squadron. Cavalry starts at the rear and joins after the fighters; capital approach now uses a 55-second rendezvous. Commander radio lights up on requests and keeps replies visible until the next transmission; local orders are labeled explicitly.

Background stars are plain, irregularly scattered white dots. Hosted play refreshes stale saved provider connections from the same activation code before any pulse debit; unsupported old cards require re-entry with a current OpenRouter code.

Radio replies now hold for eight seconds and fade over 0.7 seconds. Initial commander calls are staggered at 30/45 seconds; later calls wait for the other reply to clear.

Commander messages address their own units only. Desktop radio occupies the gaps between points and the blue score, and between the red score and audio controls. Only completed orders appear; no channel-opening announcement.
