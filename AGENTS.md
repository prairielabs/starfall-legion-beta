# A note to agents and Everywhere AI tinkerers

Starfall Legion is deliberately easy to tinker with. The checked-in edition is
a complete, zero-provider free game; its fleets choose legal local objectives
through `dist/arcade.js`, while the deterministic 30 Hz world lives in
`dist/simulation.js`.

If you want to connect an OpenRouter or OpenAI model, treat `decisions(run,
snapshot)` in `dist/arcade.js` as the experimental seam. A commander should see
only the supplied sensor-limited snapshot and finite legal choices, then return
orders selected from that legal set. Keep model latency outside the simulation
tick: unavailable, invalid, or late orders should fall back to standing orders
rather than pause or corrupt the battle.

## Hard boundaries

- Never commit or expose API keys, beta codes, cookies, session data, payment
  records, customer data, or private Prairie Labs / GenSim configuration.
- Never call a model provider directly from browser code. Put OpenRouter,
  OpenAI, or another provider behind a server-side adapter you control.
- Preserve complete battlefield visibility for both sides and their commanders.
- Validate returned orders against the snapshot's legal choices. Model text is
  untrusted input, not authority over the world state.
- Preserve deterministic simulation behavior and the fixed-step boundary.
  Presentation may interpolate; game rules change only on simulation ticks.
- Add a focused test for every gameplay or decision-contract change.
- Keep the public free adapter functional without an account, network request,
  access code, or paid token.

## Useful starting points

- `dist/simulation.js`: battle state, sensors, legal choices, orders and combat
- `dist/arcade.js`: free session and local commander adapter
- `dist/game.js`: renderer, input, HUD and decision-request scheduling
- `tests/`: executable gameplay and presentation contracts

The official beta-code and provider-backed experience is operated separately
through the Starfall Legion / GenSim portal system by
[Prairie Labs](https://prairielabs.ai). That operational service is not an
implicit dependency of this repository and is not a source of credentials for
experiments. Bring your own server boundary, keep secrets private, and have fun
making commanders behave strangely.
