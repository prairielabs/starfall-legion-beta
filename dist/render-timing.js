export const FIXED_STEP=1/30;
const mix=(a,b,t)=>a+(b-a)*t;
const turn=(a,b,t)=>a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*t;

// Presentation history stays outside the authoritative world and saved flights.
export class Motion {
 constructor(){this.history=new WeakMap();}
 reset(battle){this.history=new WeakMap();this.capture(battle);}
 capture(battle){
  for(const list of [battle.ships,battle.bolts,battle.rockets])for(const entity of list){
   let p=this.history.get(entity);if(!p){p={draw:{x:0,y:0,a:0}};this.history.set(entity,p);}
   p.x=entity.x;p.y=entity.y;p.a=entity.a??Math.atan2(entity.vy||0,entity.vx||0);
  }
 }
 at(entity,alpha=1){
  let p=this.history.get(entity);
  if(!p){
   // A new shot has already travelled once in its birth tick. Show its muzzle origin first.
   const moving=entity.life!==undefined||entity.distance!==undefined;
   const vx=entity.vx??(moving?Math.cos(entity.a)*720:0),vy=entity.vy??(moving?Math.sin(entity.a)*720:0);
   p={x:entity.x-(moving?vx*FIXED_STEP:0),y:entity.y-(moving?vy*FIXED_STEP:0),a:entity.a??Math.atan2(vy,vx),draw:{x:0,y:0,a:0}};this.history.set(entity,p);
  }
  const t=Math.max(0,Math.min(1,alpha)),a=entity.a??Math.atan2(entity.vy||0,entity.vx||0);
  p.draw.x=mix(p.x,entity.x,t);p.draw.y=mix(p.y,entity.y,t);p.draw.a=turn(p.a,a,t);return p.draw;
 }
}

// Fixed-size buffers avoid a growing trace and per-frame array shifts.
export class FrameMeter {
 constructor(capacity=600){this.capacity=capacity;this.intervals=new Float64Array(capacity);this.work=new Float64Array(capacity);this.index=0;this.count=0;this.last=null;}
 reset(){this.index=0;this.count=0;this.last=null;}
 record(now,work){if(this.last!==null){this.intervals[this.index]=now-this.last;this.work[this.index]=work;this.index=(this.index+1)%this.capacity;this.count=Math.min(this.capacity,this.count+1);}this.last=now;}
 report(){
  if(!this.count)return {fps:0,frames:0};const a=Array.from(this.intervals.slice(0,this.count)).sort((a,b)=>a-b),w=Array.from(this.work.slice(0,this.count)).sort((a,b)=>a-b),mean=a.reduce((n,v)=>n+v,0)/a.length;
  return {fps:1000/mean,frames:a.length,p95IntervalMs:a[Math.floor(a.length*.95)],p99IntervalMs:a[Math.floor(a.length*.99)],p95WorkMs:w[Math.floor(w.length*.95)],over25ms:a.filter(v=>v>25).length};
 }
}
