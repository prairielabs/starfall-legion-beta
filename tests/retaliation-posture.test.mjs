import test from 'node:test';
import assert from 'node:assert/strict';
import {Battle,Grid} from '../dist/simulation.js';

test('a struck moving fighter reacts individually and returns fire on its attacker',()=>{
 const battle=new Battle(611),pilot=battle.player,defender=battle.ships.find(ship=>ship.side===1&&ship.kind==='fighter'),formation=battle.formations[defender.formation],wingmate=battle.ships.find(ship=>ship.side===1&&ship.kind==='fighter'&&ship.formation===defender.formation&&ship!==defender);
 const guards=[0,1].map(side=>battle.ships.find(ship=>ship.side===side&&ship.kind==='artillery'));
 for(const ship of battle.ships)ship.alive=ship===pilot||ship===defender||guards.includes(ship);
 for(const guard of guards)guard.railNext=Infinity;
 pilot.x=5000;pilot.y=5000;pilot.vx=pilot.vy=0;
 battle.time=12;
 defender.x=6000;defender.y=5000;defender.a=Math.PI/2;defender.vx=0;defender.vy=245;defender.cooldown=0;
 formation.x=6000;formation.y=5000;formation.goal={x:6000,y:9400};formation.state='travel';
 battle.updateGroups();battle.damage(defender,{owner:pilot.id,side:pilot.side,player:true},1);
 assert.equal(defender.threatTarget,pilot.id);
 assert.equal(wingmate.threatTarget,undefined);
 const start={x:defender.x,y:defender.y};let returnFire=false;
 for(let tick=1;tick<=120;tick++){
  battle.events=[];battle.step(1/30,{});
  returnFire ||= battle.events.some(event=>event.type==='shot'&&event.owner===defender.id);
 }
 assert.ok(Math.hypot(defender.x-start.x,defender.y-start.y)>150,'defender should keep moving');
 assert.ok(returnFire,'a nearby attacker should receive returning fire from the struck fighter');
});
