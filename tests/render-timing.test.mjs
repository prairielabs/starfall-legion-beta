import test from 'node:test';
import assert from 'node:assert/strict';
import {Motion,FrameMeter,FIXED_STEP} from '../dist/render-timing.js';

test('60 and 120 Hz presentation advances between 30 Hz simulation ticks without changing the world',()=>{
 for(const hz of [60,120]){
  const ship={x:0,y:0,a:0},battle={ships:[ship],bolts:[],rockets:[]},motion=new Motion();motion.reset(battle);const frames=[];
  for(let tick=0;tick<30;tick++){
   motion.capture(battle);ship.x+=10;const physical=JSON.stringify(battle);
   for(let frame=0;frame<hz/30;frame++)frames.push(motion.at(ship,frame/(hz/30)).x);
   assert.equal(JSON.stringify(battle),physical);
  }
  assert.equal(frames.length,hz);for(let i=1;i<frames.length;i++)assert.ok(Math.abs(frames[i]-frames[i-1]-300/hz)<1e-8);
  assert.equal(ship.x,300);
 }
});
test('turn interpolation takes the short arc and paused/reset poses resolve exactly',()=>{
 const s={x:10,y:20,a:Math.PI-.1},b={ships:[s],bolts:[],rockets:[]},m=new Motion();m.reset(b);m.capture(b);s.x=30;s.a=-Math.PI+.1;
 assert.ok(Math.abs(m.at(s,.5).a-Math.PI)<1e-8);assert.equal(m.at(s,1).x,30);m.reset(b);assert.equal(m.at(s,0).x,30);
});
test('a new projectile interpolates from its muzzle and does not extrapolate past collision position',()=>{
 const m=new Motion(),bolt={x:100,y:60,vx:960,vy:0,life:1};assert.equal(m.at(bolt,0).x,100-960*FIXED_STEP);assert.equal(m.at(bolt,1).x,100);assert.equal(m.at(bolt,4).x,100);assert.equal(bolt.x,100);
});
test('FPS is measured from display intervals, uses a bounded window, and ignores paused time after reset',()=>{
 const m=new FrameMeter(120);for(let i=0;i<600;i++)m.record(i*1000/60,1);const report=m.report();assert.equal(report.frames,120);assert.ok(Math.abs(report.fps-60)<.001);assert.equal(report.p95WorkMs,1);assert.equal(report.over25ms,0);
 m.reset();m.record(200000,1);m.record(200000+1000/60,2);assert.ok(Math.abs(m.report().fps-60)<.001);
});
