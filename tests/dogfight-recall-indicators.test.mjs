import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Battle,Grid,RULES} from '../dist/simulation.js';

test('fighters spread otherwise equal target claims into individual dogfights',()=>{
 const battle=new Battle(733),fighter=battle.ships.find(s=>s.side===0&&s.kind==='fighter'&&!s.player),wingmate=battle.ships.find(s=>s.side===0&&s.kind==='fighter'&&s!==fighter),enemies=battle.ships.filter(s=>s.side===1&&s.kind==='fighter').slice(0,2),formation=battle.formations[fighter.formation];
 battle.time=12;
 for(const ship of battle.ships)ship.alive=[fighter,wingmate,...enemies].includes(ship);
 fighter.x=wingmate.x=5000;fighter.y=wingmate.y=5000;enemies[0].x=5400;enemies[0].y=5000;enemies[1].x=5000;enemies[1].y=5400;formation.target=null;wingmate.target=enemies[0].id;
 battle.updateGroups();
 assert.equal(battle.targetFor(fighter,new Grid(battle.ships)),enemies[1]);
});


test('recall is slightly faster and rallies toward the front',()=>{
 const battle=new Battle(734);battle.time=30;battle.updateGroups();const blue=battle.formations.find(f=>f.side===0&&f.kind==='fighter'),red=battle.formations.find(f=>f.side===1&&f.kind==='fighter'),blueY=blue.cy,redY=red.cy;
 battle.beginRecall();
 assert.equal(RULES.regroup,2.5);assert.equal(blue.drainAt,32.5);assert.equal(red.drainAt,32.5);
 assert.equal(blue.recall.y,blueY-180);assert.equal(red.recall.y,redY+180);
 assert.equal(RULES.cycle,45);assert.equal(RULES.orderWindow,10);
});

test('edge indicators aggregate only visible nearby offscreen enemies',async()=>{
 const game=await readFile(new URL('../dist/game.js',import.meta.url),'utf8');
 assert.match(game,/function drawEnemyIndicators\(\)/);
 assert.match(game,/visibleIds\.has\(s\.id\)/);
 assert.match(game,/alpha=\.18\+\.7\*\(1-Math\.exp\(-group\.count\/3\)\)/);
 assert.match(game,/if\(map\|\|battle\.spectating\)return/);
});
