import test from 'node:test';
import assert from 'node:assert/strict';
import {Battle,RULES,TYPES,WORLD,legalOrderSquare} from '../dist/simulation.js';
import {centreOf} from '../dist/grid.js';
const big=s=>['artillery','cargo','command'].includes(s.kind);
test('capital orders stay in their home half while fighters can cross',()=>{
 for(const side of [0,1])for(const kind of ['artillery','cargo','command','fighter','cavalry']){
  const p={side,kind,square:side?'g7':'g8',reach:4},to=legalOrderSquare(p,side?'g10':'g5'),y=centreOf(to).y;
  if(big(p))assert.ok(side?y<7000:y>7000);else assert.ok(side?y>7000:y<7000);
 }
});
test('cavalry formations advance at cavalry class speed',()=>{
 const b=new Battle(4),f=b.formations.find(f=>f.kind==='cavalry'&&f.count);f.orderGoal={x:f.x,y:f.y-3000};const y=f.y;b.moveUnit(f,.1);assert.ok(Math.abs(y-f.y-TYPES.cavalry.speed*.1)<.001);
});
test('save round trip preserves wounds and positions',()=>{
 const b=new Battle(5);b.time=44;b.player.hp=9;const saved=b.snapshot(),restored=Battle.restore(saved);assert.deepEqual(restored.ships,saved.ships);assert.equal(restored.time,44);
});

test('selected capital hull health and five-minute battle limit',()=>{const b=new Battle(8);assert.equal(TYPES.command.hp,3600);assert.equal(TYPES.artillery.hp,1100);assert.equal(TYPES.cargo.hp,460);b.time=299.99;b.step(1/30,{});assert.ok(b.result);assert.equal(RULES.battleDuration,300);});
