import test from 'node:test';
import assert from 'node:assert/strict';
import {Battle,RULES} from '../dist/simulation.js';
function recalls(b,n=1){for(let i=0;i<n;i++){for(let side=0;side<2;side++)b.beginRecall(side);b.time+=1;b.launchReinforcements();}}
test('ten commander cycles cannot produce fighters',()=>{const b=new Battle(17);recalls(b,10);assert.equal(b.ships.length,404);assert.equal(b.serial,404);assert.deepEqual(b.launchQueue,[]);assert.equal(RULES.fightersPerExchange,0);});
test('restore discards pending launches without changing the existing roster or wounds',()=>{const b=new Battle(29);b.player.hp=23;b.lives=2;b.score=100;const saved=b.snapshot();saved.launchQueue=[{at:0,side:0,kind:'fighter'}];const restored=Battle.restore(saved);assert.deepEqual(restored.ships,saved.ships);assert.equal(restored.lives,2);assert.equal(restored.score,100);assert.deepEqual(restored.launchQueue,[]);recalls(restored,10);assert.equal(restored.ships.length,404);});
test('pilot replacement transfers control to an existing ship',()=>{
 const b=new Battle(41),before=b.ships.length,old=b.player.id;b.player.alive=false;b.player.hp=0;b.lives=2;b.replacePlayer();assert.notEqual(b.player.id,old);assert.equal(b.ships.length,before);
});
test('full battle never grows through update, orders and save/restore',()=>{
 let b=new Battle(17,{autopilot:true}),previous=404,max=404,restored=false,ticks=0;
 while(!b.result&&b.time<301){b.step(1/30,{});for(const a of b.admirals)if(a.pending){const snap=b.decisionSnapshot(a.side);b.acceptOrders(snap,b.fallback(snap),'fixture');}
 const alive=b.living(0).length+b.living(1).length;assert.ok(alive<=previous);previous=alive;max=Math.max(max,b.ships.length);assert.equal(b.ships.length,404);assert.equal(b.launchQueue.length,0);
 if(!restored&&b.time>=75){b=Battle.restore(b.snapshot());restored=true;}ticks++;}
 assert.ok(b.result);assert.equal(max,404);console.log(JSON.stringify({time:b.time,result:b.result,alive:previous,roster:b.ships.length,max,ticks,restored}));
});
