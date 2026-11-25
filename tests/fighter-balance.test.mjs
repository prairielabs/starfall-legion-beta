import test from 'node:test';
import assert from 'node:assert/strict';
import { Battle, RULES, TYPES } from '../dist/simulation.js';

test('both fleets use the released fighter balance', () => {
  const battle = new Battle(73);
  for (const side of [0, 1]) {
    const fighter = battle.ships.find(ship => ship.side === side && ship.kind === 'fighter');
    assert.equal(fighter.maxHp, 48);
  }
  assert.equal(TYPES.fighter.damage, 13);
  assert.equal(Math.ceil(RULES.burstSpacing * 30), 2);
  assert.equal(RULES.fighterShieldDelay, 3.5);
  assert.equal(RULES.shieldDelay, 5);
});

test('older fighter saves keep their hull fraction across repeated restores', () => {
  const saved = new Battle(73).snapshot();
  const pilot = saved.ships.find(ship => ship.player);
  Object.assign(pilot, { hp: 27, maxHp: 54 });
  const restored = Battle.restore(saved);
  assert.equal(restored.player.hp, 24);
  assert.equal(Battle.restore(restored.snapshot()).player.hp, 24);
});
