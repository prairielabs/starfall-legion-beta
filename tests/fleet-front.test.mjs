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
 assert.equal(RULES.rendezvousAt,55);
});
test('cavalry formations advance at cavalry class speed',()=>{
 const b=new Battle(4),f=b.formations.find(f=>f.kind==='cavalry'&&f.count);f.orderGoal={x:f.x,y:f.y-3000};const y=f.y;b.moveUnit(f,.1);assert.ok(Math.abs(y-f.y-TYPES.cavalry.speed*.1)<.001);
});
test('save round trip preserves wounds and positions',()=>{
 const b=new Battle(5);b.time=44;b.player.hp=9;const saved=b.snapshot(),restored=Battle.restore(saved);assert.deepEqual(restored.ships,saved.ships);assert.equal(restored.time,44);
});

test('command ship stays behind the battery line during the shared advance',()=>{const b=new Battle(7),grid={query:()=>[]};for(const s of b.ships)if(s.kind==='artillery')s.railNext=Infinity;for(let tick=0;tick<2400;tick++){b.time=tick/30;for(const side of [0,1]){const hull=b.commandShip(side),f=b.formations[hull.formation];for(const a of b.living(side).filter(s=>s.kind==='artillery'))b.artillery(a,1/30,grid);b.moveCommand(f,1/30);b.command(hull,1/30,grid);const line=b.living(side).filter(s=>s.kind==='artillery').reduce((n,s)=>n+s.y,0)/3;assert.ok(side?hull.y<=line:hull.y>=line);}}});
test('capital hulls gain twenty percent health and battle stops at five minutes',()=>{const b=new Battle(8);assert.equal(TYPES.command.hp,4320);assert.equal(TYPES.artillery.hp,1320);assert.equal(TYPES.cargo.hp,552);b.time=299.99;b.step(1/30,{});assert.ok(b.result);assert.equal(RULES.battleDuration,300);});

test('central cavalry arrives after fighter engagement',()=>{const b=new Battle(81,{autopilot:true});let fighter=null,cavalry=null;for(let i=0;i<900&&cavalry===null;i++){b.events=[];b.step(1/30,{});for(const e of b.events)if(e.type==='shot'){const ship=b.ships[e.owner];if(ship?.kind==='fighter'&&fighter===null)fighter=b.time;if(ship?.kind==='cavalry'&&cavalry===null)cavalry=b.time;}}assert.ok(fighter!==null&&cavalry!==null);assert.ok(cavalry>fighter+4,`${fighter} vs ${cavalry}`);});
