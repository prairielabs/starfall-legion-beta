# Starfall Legion Beta

Starfall Legion is a large-scale 16-bit browser space battle: one pilot inside
two autonomous fleets, three lives, hundreds of ships, fighter dogfights,
merchant convoys, artillery fortresses, rail fire, fog of war, squad recalls
and a spectator camera.

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

## Current beta behavior

- The opening fighter engagement begins at roughly ten seconds.
- Red edge arrows point toward nearby sensor-visible enemies outside the view;
  brighter arrows mean more contacts in that direction.
- Fighters retain formation-level objectives but select and retaliate against
  opponents individually, producing distributed dogfights.
- Recalls rally slightly toward the front and regroup for 2.5 seconds.
- Green corner ticks and map dots identify the player's squadron.
- When the pilot's lives are exhausted, the fight continues in spectator mode.

## Project layout

```text
dist/
  index.html          Browser entry point
  simulation.js       Deterministic 30 Hz battle engine
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
decision seam, legal-order boundary, fog-of-war contract, and the rule that API
keys and model calls must remain behind a server you control. The checked-in
free adapter stays local and deterministic, so cloning this repository never
spends tokens or contacts a model provider.

## Test

```sh
npm test
```

## Contributing

Issues and pull requests are welcome. Please keep changes deterministic,
preserve fog-of-war boundaries, and include a focused test for gameplay rule
changes. Agent integrations should follow [`AGENTS.md`](AGENTS.md). Never add
credentials, access codes, paid-session data, or proprietary service
configuration.

## License and credits

Game code and original presentation are released under the [MIT License](LICENSE).
The bundled Arcade font is covered by its included SIL Open Font License. Sound
effects and music are CC0; exact sources and transformations are documented in
[`dist/assets/audio/CREDITS.txt`](dist/assets/audio/CREDITS.txt).

Created by [Prairie Labs](https://prairielabs.ai).
