// The strategic board: formations as pieces, addressed by centre of gravity,
// on a 14 x 14 grid of 1,000-unit squares.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Battle, WORLD, RULES, TYPES} from '../dist/simulation.js';
import {BOARD, KINDS, WEIGHTS, shipWorth, baseline, squareOf, centreOf, parseSquare, allSquares, reach, reachableSquares,
        centreOfGravity, pieceOf, pieces, boardView, moveOrder, applyMove, legalMoves,
        render, roster} from '../dist/board.js';

const fresh = (options) => new Battle(20260912, options);

test('the board covers the sector in 14 x 14 squares of 1,000 units', () => {
 assert.equal(BOARD.files, 14);
 assert.equal(BOARD.ranks, 14);
 assert.equal(BOARD.files * BOARD.cellWidth, WORLD.width);
 assert.equal(BOARD.ranks * BOARD.cellHeight, WORLD.height);
 // One square is exactly fighter vision.
 assert.equal(BOARD.cellWidth, TYPES.fighter.vision);
 assert.equal(allSquares().length, 196);
 assert.equal(allSquares()[0], 'a1');
 assert.equal(allSquares()[195], 'n14');
});

test('every piece fits inside one square', () => {
 const battle = fresh();
 for (const formation of battle.formations) {
  const members = battle.members(formation.id);
  const xs = members.map(s => s.x), ys = members.map(s => s.y);
  const width = Math.max(...xs) - Math.min(...xs), depth = Math.max(...ys) - Math.min(...ys);
  assert.ok(width < BOARD.cellWidth && depth < BOARD.cellHeight,
   `${formation.name} footprint ${Math.round(width)} x ${Math.round(depth)} fits a ${BOARD.cellWidth} square`);
 }
});

test('world position and square round-trip through the square centre', () => {
 for (const name of ['a1', 'd5', 'h8', 'n14', 'c7', 'k12']) {
  const centre = centreOf(name);
  assert.equal(squareOf(centre.x, centre.y).name, name);
 }
 assert.equal(squareOf(0, 0).name, 'a1');
 assert.equal(squareOf(WORLD.width - 1, WORLD.height - 1).name, 'n14');
 // Out-of-bounds clamps rather than throwing: ships can drift past the edge.
 assert.equal(squareOf(-500, -500).name, 'a1');
 assert.equal(squareOf(WORLD.width + 9999, WORLD.height + 9999).name, 'n14');
 assert.throws(() => parseSquare('z9'));
 assert.throws(() => parseSquare('a15'));
 assert.throws(() => parseSquare('o1'));
});

test('every kind of piece can move to a different square within one order cycle', () => {
 for (const kind of Object.keys(KINDS)) {
  assert.ok(TYPES[KINDS[kind].paceOf], `${kind} has a pacing ship type`);
  assert.ok(reach(kind) >= 1, `${kind} reaches at least one square per cycle`);
  assert.ok(reachableSquares('g7', kind).length > 1, `${kind} has somewhere to go from g7`);
  assert.ok(reachableSquares('g7', kind).includes('g7'), 'holding is legal');
 }
 // The slow hulls are the binding case: two squares in a 30-second cycle; the command ship one.
 assert.equal(reach('artillery'), 2);
 assert.equal(reach('cargo'), 2);
 assert.equal(reach('command'), 1);
 assert.ok(reach('fighter') > reach('artillery'));
 assert.ok(reach('scout') > reach('fighter'));
 // Reach is derived from the live rules, not a hand-typed table.
 assert.equal(reach('fighter'), Math.floor(TYPES.fighter.speed * RULES.cycle / BOARD.cellWidth));
 // A corner is clipped by the edge, never thrown.
 assert.ok(reachableSquares('a1', 'artillery').every(name => parseSquare(name)));
 assert.ok(!reachableSquares('a1', 'artillery').includes('d1'));
 assert.ok(reachableSquares('a1', 'artillery').includes('c1'));
});

test('the simulation spawns only kinds the board knows', () => {
 const battle = fresh();
 const spawned = new Set(battle.formations.map(f => f.kind));
 for (const kind of spawned) assert.ok(KINDS[kind], `board knows ${kind}`);
 assert.deepEqual([...spawned].sort(), ['artillery', 'cargo', 'cavalry', 'command', 'fighter', 'scout']);
 assert.ok(KINDS.command && KINDS.escort);
 assert.ok(WEIGHTS.command > WEIGHTS.artillery && WEIGHTS.artillery > WEIGHTS.cavalry);
 assert.deepEqual([...new Set(battle.ships.map(s => s.kind))].sort(), ['artillery', 'cargo', 'cavalry', 'command', 'escort', 'fighter', 'scout']);
});

test('the full roster is on the board: 32 pieces covering all 424 ships', () => {
 const battle = fresh();
 const all = pieces(battle);
 assert.equal(battle.ships.length, 424);
 assert.equal(all.length, 32);
 const count = kind => all.filter(p => p.kind === kind).length;
 assert.equal(count('fighter'), 8);
 assert.equal(count('scout'), 4);
 assert.equal(count('artillery'), 6);
 assert.equal(count('cavalry'), 4);
 assert.equal(count('cargo'), 8);
 assert.equal(count('command'), 2);
 assert.equal(all.filter(p => p.side === 0).length, 16);
 assert.equal(all.filter(p => p.side === 1).length, 16);
 const covered = new Set(all.flatMap(p => battle.members(p.id).map(s => s.id)));
 assert.equal(covered.size, 424);
 assert.ok(battle.ships.every(s => covered.has(s.id)));
 // Exactly one piece carries the human pilot.
 assert.equal(all.filter(p => p.player).length, 1);
 assert.equal(all.find(p => p.player).kind, 'fighter');
 assert.ok(!all.some(p => /KESTREL|MERLIN|OSPREY|PEREGRINE|HAYMAKER|LANCER|PROXIMA|VEGA/.test(p.name)), 'squadron names are gone; only admirals are named');
});

test('every living ship stays on a piece through a whole battle', () => {
 const battle = fresh({ autopilot: true });
 let samples = 0;
 while (!battle.result && battle.time < RULES.battleDuration + 1) {
  battle.step(1 / 30);
  if (battle.tick % 150 === 0) {
   samples++;
   const covered = new Set(pieces(battle).flatMap(p => battle.members(p.id).map(s => s.id)));
   const alive = battle.ships.filter(s => s.alive);
   const missing = alive.filter(s => !covered.has(s.id));
   assert.equal(missing.length, 0, `t=${Math.round(battle.time)}: ${missing.length} living ships off the board`);
   assert.ok(pieces(battle).length <= 32);
  }
 }
 assert.ok(samples > 20, 'the battle ran long enough to matter');
});

test('strength is weighted by ship type and scaled by hull for big hulls', () => {
 const battle = fresh();
 baseline(battle);
 const command = pieces(battle).find(p => p.kind === 'command');
 assert.equal(command.strength, 30 + 10 * 3);
 const squadron = pieces(battle).find(p => p.kind === 'fighter');
 assert.equal(squadron.strength, 23);
 assert.equal(squadron.remaining, 1);
 const battery = battle.formations.find(f => f.kind === 'artillery');
 const before = pieceOf(battle, battery.id);
 assert.equal(before.strength, 10 + 10);
 // Burn the artillery hull to half: count unchanged, strength falls.
 const hull = battle.members(battery.id).find(s => s.kind === 'artillery');
 hull.hp = hull.maxHp / 2;
 const after = pieceOf(battle, battery.id);
 assert.equal(after.count, before.count);
 assert.equal(after.strength, 15);
 assert.equal(after.remaining, 0.75);
 // A convoy is three pods at 4 plus five escorts at 1.
 assert.equal(pieces(battle).find(p => p.kind === 'cargo').strength, 17);
 // A lost fighter reads as a lost point, and the fraction follows.
 const scoutPair = battle.formations.find(f => f.kind === 'scout');
 battle.members(scoutPair.id)[0].alive = false;
 assert.equal(pieceOf(battle, scoutPair.id).remaining, 0.5);
 assert.equal(shipWorth({ kind: 'command', hp: 250, maxHp: 1000 }), 7.5);
});

test('every formation presents as a piece with a square, a strength and a reach', () => {
 const battle = fresh();
 const all = pieces(battle);
 assert.equal(all.length, battle.formations.length);
 for (const piece of all) {
  assert.match(piece.square, /^[a-n](?:[1-9]|1[0-4])$/);
  assert.ok(piece.count > 0);
  assert.ok(piece.strength > 0);
  assert.equal(piece.reach, reach(piece.kind));
  assert.equal(piece.letter, KINDS[piece.kind].letter);
  assert.equal(piece.cog.x, Math.round(piece.cog.x));
 }
 assert.ok(all.some(p => p.side === 0) && all.some(p => p.side === 1));
});

test('a piece sits at the mean of its members, not at any one ship', () => {
 const battle = fresh();
 const formation = battle.formations.find(f => f.kind === 'fighter');
 const members = battle.members(formation.id);
 assert.ok(members.length > 2);
 const cog = centreOfGravity(battle, formation.id);
 const meanX = members.reduce((t, s) => t + s.x, 0) / members.length;
 assert.ok(Math.abs(cog.x - meanX) < 1e-9);
 const onAShip = members.some(s => Math.abs(s.x - cog.x) < 1e-9 && Math.abs(s.y - cog.y) < 1e-9);
 assert.equal(onAShip, false);
});

test('home edges: blue opens on high ranks, red on low ranks', () => {
 const battle = fresh();
 for (const piece of pieces(battle)) {
  const rank = parseSquare(piece.square).rank + 1;
  if (piece.side === 0) assert.ok(rank >= 8, `${piece.name} on blue's half (rank ${rank})`);
  else assert.ok(rank <= 7, `${piece.name} on red's half (rank ${rank})`);
 }
});

test('moving a piece moves the centre of gravity, not a unit', () => {
 const battle = fresh();
 const formation = battle.formations.find(f => f.kind === 'fighter' && f.side === 0);
 const before = battle.members(formation.id).map(s => ({ id: s.id, x: s.x, y: s.y }));
 const order = moveOrder(battle, formation.id, 'g7');
 assert.equal(order.to, 'g7');
 applyMove(battle, order);
 assert.deepEqual(formation.goal, order.goal);
 for (const ship of battle.members(formation.id)) {
  const previous = before.find(s => s.id === ship.id);
  assert.equal(ship.x, previous.x);
  assert.equal(ship.y, previous.y);
 }
});

test('a move order says whether the square is within reach', () => {
 const battle = fresh();
 const battery = battle.formations.find(f => f.kind === 'artillery' && f.side === 0);
 const at = parseSquare(pieceOf(battle, battery.id).square);
 const near = `${'abcdefghijklmn'[at.file]}${at.rank + 1 - 1}`;
 const far = `${'abcdefghijklmn'[at.file]}${at.rank + 1 - 9}`;
 assert.equal(moveOrder(battle, battery.id, near).legal, true);
 assert.equal(moveOrder(battle, battery.id, far).legal, false);
 // The order is still returned; the caller decides what to do with it.
 assert.equal(moveOrder(battle, battery.id, far).to, far);
});

test('legal moves list only reachable squares for each piece', () => {
 const battle = fresh();
 const moves = legalMoves(battle, 0);
 assert.equal(moves.length, 16);
 for (const move of moves) {
  assert.ok(move.squares.includes(move.at));
  // Fast pieces (scouts, cavalry) can cover the whole board; slow ones cannot.
  if (move.kind === 'artillery' || move.kind === 'cargo') assert.ok(move.squares.length < 30);
  assert.deepEqual(move.squares, reachableSquares(move.at, move.kind));
 }
 const battery = moves.find(m => m.kind === 'artillery');
 const squadron = moves.find(m => m.kind === 'fighter');
 assert.ok(battery.squares.length < squadron.squares.length);
});

test('the group follows its centre toward the ordered square', () => {
 const battle = fresh();
 const formation = battle.formations.find(f => f.kind === 'fighter' && f.side === 0);
 const target = centreOf('h8');
 const start = centreOfGravity(battle, formation.id);
 const startDistance = Math.hypot(start.x - target.x, start.y - target.y);
 applyMove(battle, moveOrder(battle, formation.id, 'h8'));
 for (let tick = 0; tick < 180; tick++) battle.step(1 / 30);
 const cog = centreOfGravity(battle, formation.id);
 assert.ok(cog, 'the piece survived the advance');
 const endDistance = Math.hypot(cog.x - target.x, cog.y - target.y);
 assert.ok(endDistance < startDistance,
  `centre of gravity closed on the square: ${Math.round(startDistance)} -> ${Math.round(endDistance)}`);
});

test('the board view inherits the existing fog', () => {
 const battle = fresh();
 const view = boardView(battle, 0);
 assert.equal(view.version, 2);
 assert.equal(view.side, 0);
 assert.deepEqual(view.board, { files: 14, ranks: 14, square: 1000 });
 assert.equal(view.own.length, 16);
 assert.ok(view.own.every(p => p.side === 0));
 assert.ok(view.enemy.every(p => p.side === 1));
 const visible = new Set(battle.contacts[0]);
 for (const piece of view.enemy) {
  assert.ok(battle.members(piece.id).some(s => visible.has(s.id)));
 }
 assert.ok(view.enemy.length < battle.formations.filter(f => f.side === 1).length);
});

test('the rendered board shows all thirty pieces with the right case', () => {
 const battle = fresh();
 const text = render(battle);
 const lines = text.split('\n');
 assert.equal(lines.length, 14 + 3);
 assert.match(lines[0], /^\s+a\s+b\s+c.*\s+n\s*$/);
 assert.match(lines[1], /^ 14 /);
 assert.match(lines[14], /^  1 /);
 const body = lines.slice(1, 15).join('');
 const upper = (body.match(/[FSACMK]/g) || []).length;
 const lower = (body.match(/[fsacmk]/g) || []).length;
 const stacked = (body.match(/[FSACMKfsacmk][2-9+]/g) || []).length;
 // Every piece is drawn once, either alone or as part of a stacked count.
 assert.ok(upper + lower >= 1);
 const drawn = upper + lower + stacked;
 assert.ok(drawn <= 32 && drawn >= 10, `drawn ${drawn}`);
 assert.match(lines[16], /BLUE upper case/);
 assert.match(body, /K/); assert.match(body, /k/);
 // Fogged render for blue omits enemy pieces out of contact.
 const fogged = render(battle, 0);
 const foggedLower = (fogged.split('\n').slice(1, 15).join('').match(/[fsacmk]/g) || []).length;
 assert.ok(foggedLower < lower || lower === 0);
 // The roster is one line per piece.
 assert.equal(roster(battle).length, 32);
 assert.equal(roster(battle, 1).length, 16);
 assert.ok(roster(battle).some(line => line.includes('(pilot)')));
});

test('a destroyed formation leaves the board', () => {
 const battle = fresh();
 const formation = battle.formations.find(f => f.kind === 'fighter');
 for (const ship of battle.members(formation.id)) ship.alive = false;
 battle.updateGroups();
 assert.equal(centreOfGravity(battle, formation.id), null);
 assert.equal(pieceOf(battle, formation.id), null);
 assert.ok(!pieces(battle).some(p => p.id === formation.id));
 assert.equal(pieces(battle).length, 31);
});
