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
test('all big hulls reach the central arena by 80 seconds and never cross the line',()=>{
 const b=new Battle(83),hulls=b.ships.filter(big),grid={query:()=>[]};
 for(const s of hulls)if(s.kind==='artillery')s.railNext=Infinity;
 for(let tick=1;tick<=2400;tick++){
  b.time=tick/30;b.tick=tick;
  for(const f of b.formations)if(f.kind==='cargo'||f.kind==='command')b.moveUnit(f,1/30);
  for(const s of hulls){b[s.kind](s,1/30,grid);assert.ok(s.side?s.y<=WORLD.height/2-249:s.y>=WORLD.height/2+249,`${s.kind} crossed`);}
 }
 for(const s of hulls)assert.ok(Math.hypot(s.x-7000,s.y-7000)<1600,`${s.kind} ${s.id} missed centre: ${s.x},${s.y}`);
 assert.equal(RULES.rendezvousAt,70);
});
test('cavalry formations advance at cavalry class speed',()=>{
 const b=new Battle(4),f=b.formations.find(f=>f.kind==='cavalry');f.orderGoal={x:f.x,y:f.y-3000};const y=f.y;b.moveUnit(f,.1);assert.ok(Math.abs(y-f.y-TYPES.cavalry.speed*.1)<.001);
});
test('save round trip preserves wounds and positions',()=>{
 const b=new Battle(5);b.time=44;b.player.hp=9;const saved=b.snapshot(),restored=Battle.restore(saved);assert.deepEqual(restored.ships,saved.ships);assert.equal(restored.time,44);
});
