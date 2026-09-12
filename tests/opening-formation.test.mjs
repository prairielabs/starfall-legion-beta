import test from 'node:test';
import assert from 'node:assert/strict';
import {Battle} from '../dist/simulation.js';

const forwardProjection=(ship,formation)=>(ship.x-formation.x)*Math.cos(formation.a)+(ship.y-formation.y)*Math.sin(formation.a);

test('a manual fresh flight places the pilot in the moving left-middle of its echelon',()=>{
 const battle=new Battle(501),formation=battle.formations[battle.player.formation],members=battle.members(formation.id);
 const rear=Math.min(...members.map(ship=>forwardProjection(ship,formation)));
 assert.ok(forwardProjection(battle.player,formation)>rear);assert.equal(battle.player.formation,1);assert.equal(battle.player.slot,11);assert.ok(battle.player.x<formation.x);assert.equal(battle.player.vy,-245);
});

test('fighter formations open as broad, stepped echelons',()=>{
 const battle=new Battle(502,{autopilot:true});
 for(const formation of battle.formations.filter(formation=>formation.kind==='fighter')){
  const members=battle.members(formation.id),xs=members.map(ship=>ship.x),projections=members.map(ship=>forwardProjection(ship,formation));
  assert.ok(Math.max(...xs)-Math.min(...xs)>=500);
  assert.ok(Math.max(...projections)-Math.min(...projections)>=600);
 }
});

test('each fighter echelon begins firing around ten seconds into a fresh flight',()=>{
 for(const seed of [501,502,503]){
  const battle=new Battle(seed,{autopilot:true}),firstFire=new Map();
  while(battle.time<12){
   battle.step(1/30);
   for(const event of battle.events){
    if(event.type!=='shot')continue;
    const formation=battle.formations[battle.ships[event.owner]?.formation];
    if(formation?.kind==='fighter'&&!firstFire.has(formation.id))firstFire.set(formation.id,battle.time);
   }
   battle.events=[];
  }
  for(const formation of battle.formations.filter(f=>f.kind==='fighter')){
   const at=firstFire.get(formation.id);
   assert.ok(at>=8&&at<=12,`${formation.name} first fired at ${at} seconds (seed ${seed})`);
  }
 }
});
