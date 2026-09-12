// Starfall Legion — deterministic 30 Hz world. Rendering, networking and money are separate.
// Commander battles: each side has a command ship housing an admiral. The admirals play the
// strategic grid (grid.js); the battle beneath resolves their orders.
import {BOARD,squareOf,parseSquare,isSquare,centreOf,nearestReachable,squareDistance} from './grid.js';
export const WORLD=Object.freeze({width:14000,height:14000});
const FIGHTER_SPEED=245;
// cycle: each admiral's play clock between orders; thinkCeiling: the longest an admiral may think before standing orders.
export const RULES=Object.freeze({lives:3,playerSpeed:FIGHTER_SPEED*1.1,acceleration:7,formationSpeed:FIGHTER_SPEED,cruiseSpeed:205,firstRecall:30,regroup:2.5,orderWindow:10,cycle:30,thinkCeiling:12,maxOrdersPerSide:10,recallCutoff:300,battleDuration:300,boltSpeed:960,boltRange:1800,shieldDelay:5,railFirst:30,railPeriod:30,railWarning:3,railActive:1,railWidth:44,railDamage:36,artilleryStandOff:700,artilleryAssaultAt:75,fightersPerExchange:2,rendezvousAt:170,launchSpacing:.45});
export const TYPES=Object.freeze({fighter:{hp:54,speed:FIGHTER_SPEED,turn:8.8,radius:12,vision:1000,reload:.75,damage:12},scout:{hp:30,speed:430,turn:3.5,radius:14,vision:1900,reload:1.6,damage:8},cavalry:{hp:72,speed:365,turn:1.35,radius:17,vision:1150,reload:2.3,damage:16},artillery:{hp:1100,speed:68,turn:0,radius:76,vision:1450,reload:1.35,damage:2},cargo:{hp:460,speed:72,turn:1.4,radius:38,vision:900,reload:1.1,damage:6},command:{hp:3600,speed:60,turn:0,radius:74,vision:1500,reload:1,damage:22},escort:{hp:80,speed:330,turn:1.5,radius:17,vision:1150,reload:2.1,damage:14}});
// How much one ship of each type is worth in a piece's remaining strength. Swarm ships count once;
// big single hulls count by significance scaled by remaining hull, so a burning command ship reads as weaker.
export const WEIGHTS=Object.freeze({fighter:1,scout:1.5,cavalry:2,escort:3,cargo:4,artillery:10,command:30});
const BIG_HULLS=new Set(['artillery','cargo','command']);
export function shipWorth(s){const w=WEIGHTS[s.kind]??1;if(!BIG_HULLS.has(s.kind))return w;return w*clamp(s.hp/(s.maxHp||s.hp||1),0,1);}
export function reachOf(kind){return Math.max(1,Math.floor(TYPES[kind].speed*RULES.cycle/BOARD.square));}
const KIND_LABELS={fighter:'SQUADRON',scout:'SCOUTS',artillery:'BATTERY',cavalry:'CAVALRY',cargo:'CONVOY',command:'COMMAND'};
// Pieces are anonymous: only the admirals are named. Labels identify a formation's kind and lane, nothing more.
export function formationName(side,kind,n){const label=KIND_LABELS[kind];const index=kind==='fighter'?n+1:kind==='scout'?(n===4?'W':'E'):kind==='artillery'?n-5:kind==='cavalry'?(n===9?1:2):kind==='cargo'?n+1:'';return `${side?'RED':'BLUE'} ${label}${index===''?'':' '+index}`;}
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const angleDelta=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
export const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export function segmentDistance(x,y,ax,ay,bx,by){const dx=bx-ax,dy=by-ay,t=clamp(((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy||1),0,1);return Math.hypot(x-ax-t*dx,y-ay-t*dy);}
export class Grid{
 constructor(ships,size=180){this.size=size;this.cells=new Map();for(const s of ships)if(s.alive){const k=this.key(s.x,s.y);if(!this.cells.has(k))this.cells.set(k,[]);this.cells.get(k).push(s);}}
 key(x,y){return Math.floor(x/this.size)+Math.floor(y/this.size)*128;}
 query(x,y,r=600){const out=[];for(let a=Math.floor((x-r)/this.size);a<=Math.floor((x+r)/this.size);a++)for(let b=Math.floor((y-r)/this.size);b<=Math.floor((y+r)/this.size);b++){const c=this.cells.get(a+b*128);if(c)out.push(...c);}return out;}
}
// Four fixed batteries make a fortress worth contesting, without letting it erase the fight around it.
const TURRETS=[[0,-70],[-59,22],[59,22],[0,0]];
const CARGO_TURRETS=[[-24,-14],[24,-14]];
// The command ship: eight light mounts around the hull and one spinal cannon (id 8) firing three-round bursts.
const COMMAND_TURRETS=[[-62,-28],[62,-28],[-72,14],[72,14],[-46,48],[46,48],[-22,-62],[22,-62],[0,-44]];
const NAMES=['KESTREL','MERLIN','OSPREY','PEREGRINE','PROXIMA W','PROXIMA E','HAYMAKER I','HAYMAKER II','HAYMAKER III','LANCER'];
const CARGO_NAMES=['MERCHANT VEGA','MERCHANT LYRA','MERCHANT ORION','MERCHANT CYGNUS'];
// Fixed slots, shared by deployment and travel. Local +y trails the formation nose.
export function formationPoint(f,slot){
 let x=0,y=0;
 if(f.kind==='command'){if(slot>0){const ring=(slot-1)/10*Math.PI*2;x=Math.cos(ring)*250;y=Math.sin(ring)*250+40;}}
 else if(f.kind==='artillery'&&slot>0){x=(slot%2?1:-1)*180;y=(Math.floor((slot-1)/2)-2)*78;}
 else if(f.kind==='cargo'){if(slot<3){const cargo=[[0,-92],[-116,92],[116,92]][slot];[x,y]=cargo;}else{const escort=[[0,198],[-170,118],[170,118],[-235,244],[235,244]][slot-3];[x,y]=escort;}}
 else if(f.kind==='scout')x=(slot-.5)*90;
 else if(f.kind!=='artillery'){
  const col=[0,-1,1,-2,2][slot%5],row=Math.floor(slot/5);
  if(f.kind==='fighter'){x=col*130;y=row*140+Math.abs(col)*72;}
  else {x=col*86;y=row*76+Math.abs(col)*42;}
 }
 const a=f.a+Math.PI/2;return{x:f.x+Math.cos(a)*x-Math.sin(a)*y,y:f.y+Math.sin(a)*x+Math.cos(a)*y};
}
// Each opposing pair claims the same central rally point; they meet there instead of crossing past one another.
function artilleryRoute(n,side){const c=WORLD.width/2,lanes=[[c-3900,c],[c,c],[c+3900,c]],p=lanes[n-6];return{x:p[0],y:p[1]+(side? -350:350)};}
function cargoWaypoints(n,side){const x=[.08,.32,.68,.92][n-10]*WORLD.width,outer=side?.1:.9,inner=side?.42:.58;return[{x,y:outer*WORLD.height},{x:clamp(x+(side?-900:900),900,WORLD.width-900),y:inner*WORLD.height},{x:clamp(x+(side?-1800:1800),900,WORLD.width-900),y:outer*WORLD.height},{x:clamp(x+(side?900:-900),900,WORLD.width-900),y:inner*WORLD.height}];}
export function frontPoint(kind,n,side,time){
 const cargo=kind==='cargo',lane=cargo?n-10:n-6,progress=clamp(time/RULES.rendezvousAt,0,1);
 const startX=(cargo?[.08,.32,.68,.92]:[.22,.5,.78])[lane]*WORLD.width,startY=(side?(cargo?.1:.09):(cargo?.9:.91))*WORLD.height;
 const endX=WORLD.width/2+(cargo?(lane-1.5)*360:(lane-1)*220),endY=WORLD.height/2+(side?-1:1)*(cargo?410:180);
 return{x:startX+(endX-startX)*progress,y:startY+(endY-startY)*progress};
}
function intercept(s,t,speed){const dx=t.x-s.x,dy=t.y-s.y,vx=t.vx||0,vy=t.vy||0,a=vx*vx+vy*vy-speed*speed,b=2*(dx*vx+dy*vy),c=dx*dx+dy*dy,disc=b*b-4*a*c;let time=Math.sqrt(c)/speed;if(disc>=0&&Math.abs(a)>1e-6){const roots=[(-b-Math.sqrt(disc))/(2*a),(-b+Math.sqrt(disc))/(2*a)].filter(t=>t>0);if(roots.length)time=Math.min(...roots);}return Math.atan2(dy+vy*time,dx+vx*time);}
// The same flowing hold used by recall, waiting formations and close artillery escorts.
function figureEight(p,s,time,scale=1){const t=time*.58+s.phase,offset=s.slot*2.39996;return{x:p.x+Math.sin(t)*250*scale+Math.cos(offset)*38,y:p.y+Math.sin(2*t)*135*scale+Math.sin(offset)*35};}
export class Battle{
 constructor(seed=1,{autopilot=false,legacyRoster=false}={}){
  this.version=25;this.launchQueue=[];this.chargeAt=null;this.seed=seed>>>0;this.initialSeed=this.seed;this.time=0;this.tick=0;this.ships=[];this.formations=[];this.bolts=[];this.rockets=[];this.events=[];this.lives=3;this.score=0;this.kills=0;this.hits=0;this.shots=0;this.serial=0;this.projectileSerial=0;this.result=null;this.respawn=0;this.rocketCooldown=0;this.phase='opening';this.autopilot=autopilot;this.admirals=[0,1].map(side=>Battle.freshAdmiral(side));this.inference={real:0,fixture:0,fallback:0,status:'standing orders'};this.contacts=[[],[]];this.lastDamage=0;
  for(let side=0;side<2;side++)for(let n=0;n<10;n++){
   const dir=side?1:-1,kind=n<4?'fighter':n<6?'scout':n<9?'artillery':'cavalry';
   // Keep the broad Battle-of-Britain echelons, with their opening lines
   // positioned for first fighter fire at ten seconds of normal flight.
   const x=(kind==='fighter'?[.13,.38,.62,.87][n]:kind==='scout'?(n===4?.05:.95):kind==='artillery'?[.22,.5,.78][n-6]:.34)*WORLD.width;
   const blueY=kind==='fighter'?(n%2?.71:.705):kind==='artillery'?.91:kind==='scout'?.62:.73;
   const y=(side?1-blueY:blueY)*WORLD.height;
   const f={id:side*10+n,side,n,kind,name:formationName(side,kind,n),x,y,a:dir*Math.PI/2,count:0,leader:null,state:kind==='scout'?'patrol':'travel',target:(1-side)*10+n,goal:{x,y:WORLD.height/2},recall:null,drainAt:0,role:'opening',patrolLeg:side?2:0,orderGoal:null,orderSquare:null,finishing:null};
   this.formations.push(f);const count=kind==='fighter'?30:kind==='scout'?2:kind==='artillery'?11:20;
   for(let slot=0;slot<count;slot++){
    const k=kind==='artillery'?(slot===0?'artillery':'fighter'):kind,stats=TYPES[k],pos=formationPoint(f,slot);
    const s={id:this.serial++,side,formation:f.id,slot,kind:k,player:side===0&&n===0&&slot===0,...pos,a:f.a,vx:0,vy:dir*(kind==='artillery'?TYPES.artillery.speed+(n-6):kind==='scout'?stats.speed:RULES.formationSpeed),hp:stats.hp,maxHp:stats.hp,shield:k==='artillery'?0:2,lastHit:-10,alive:true,radius:stats.radius,cooldown:this.random(),target:null,phase:this.random()*Math.PI*2,flash:0,boost:1,outside:0,tagged:false};
    if(s.player){s.vy=autopilot?dir*RULES.formationSpeed:0;s.cooldown=0;this.playerId=s.id;}
   if(k==='artillery'){s.route=artilleryRoute(n,side);s.arrived=false;s.railNext=RULES.railFirst;s.railFired=-1;s.railHits=[];s.turrets=TURRETS.map(([tx,ty],i)=>({id:i,ox:tx,oy:ty,cooldown:this.random()*2,burst:0,flash:0}));}
    this.ships.push(s);
   }
  }
  // Civilian merchant pods run their own outer-sector routes. They are visible
  // secondary opportunities, not commander-directed battle formations.
  for(let side=0;side<2;side++)for(let offset=0;offset<4;offset++){
   const n=10+offset,id=side?24+offset:20+offset,dir=side?1:-1,waypoints=cargoWaypoints(n,side),start=waypoints[0];
   const f={id,side,n,kind:'cargo',name:formationName(side,'cargo',offset),x:start.x,y:start.y,a:dir*Math.PI/2,count:0,leader:null,state:'convoy',target:null,goal:{...waypoints[1]},recall:null,drainAt:0,role:'civilian',patrolLeg:0,waypoints,routeIndex:1,orderGoal:null,orderSquare:null,finishing:null};
   this.formations.push(f);
   for(let slot=0;slot<8;slot++){
    const k=slot<3?'cargo':'fighter',stats=TYPES[k],pos=formationPoint(f,slot),pod=slot<3?slot:(slot-3)%3;
    const s={id:this.serial++,side,formation:f.id,slot,pod,kind:k,player:false,...pos,a:f.a,vx:0,vy:dir*(k==='cargo'?stats.speed:RULES.cruiseSpeed),hp:stats.hp,maxHp:stats.hp,shield:k==='cargo'?0:2,lastHit:-10,alive:true,radius:stats.radius,cooldown:this.random(),target:null,phase:this.random()*Math.PI*2,flash:0,boost:1,outside:0,tagged:false};
    if(k==='cargo')s.turrets=CARGO_TURRETS.map(([ox,oy],i)=>({id:i,ox,oy,cooldown:this.random()*2,burst:0,flash:0}));
    this.ships.push(s);
   }
  }
  this.addCavalryWings();this.addCommandShips();
  if(!legacyRoster){this.ships=this.ships.filter(s=>!(this.formations[s.formation].kind==='fighter'&&s.slot>=23));this.ships.forEach((s,id)=>s.id=id);this.serial=this.ships.length;this.playerId=this.ships.find(s=>s.player).id;}

  // Start the human in the rear rank, with the squadron ahead of them.
  if(!autopilot){
   const pilot=this.player,f=this.formations[pilot.formation];
   const rear=this.ships.filter(s=>s.formation===f.id).sort((a,b)=>((a.x-f.x)*Math.cos(f.a)+(a.y-f.y)*Math.sin(f.a))-((b.x-f.x)*Math.cos(f.a)+(b.y-f.y)*Math.sin(f.a))||b.slot-a.slot)[0];
   for(const key of ['x','y','slot']){const value=pilot[key];pilot[key]=rear[key];rear[key]=value;}
  }

  // Autopilot exists for balance verification; mirrored leads share fire cadence.
  if(autopilot){const mirror=this.ships.find(s=>s.formation===10&&s.slot===0);if(mirror)this.player.cooldown=mirror.cooldown;}
  for(const f of this.formations)f.full=this.members(f.id).reduce((t,s)=>t+shipWorth(s),0);
  this.updateGroups();this.updateVision();
 }
 static freshAdmiral(side,nextAt=RULES.firstRecall){return{side,epoch:0,nextAt,pending:false,sentAt:null,ordersAt:null,status:'standing orders',real:0,fixture:0,fallback:0,local:0,clamped:0,lastSeen:{}};}
 addCommandShips(){
  for(let side=0;side<2;side++){
   const id=30+side;if(this.formations[id])continue;
   const dir=side?1:-1,x=WORLD.width*.5,y=WORLD.height*(side?.2:.8);
   const f={id,side,n:15,kind:'command',name:formationName(side,'command',0),x,y,a:dir*Math.PI/2,count:0,leader:null,state:'hold',target:null,goal:{x,y},recall:null,drainAt:0,role:'command',patrolLeg:0,home:{x,y},orderGoal:null,orderSquare:null,finishing:null};
   this.formations.push(f);
   for(let slot=0;slot<11;slot++){const k=slot?'escort':'command',stats=TYPES[k],pos=formationPoint(f,slot);const s={id:this.serial++,side,formation:id,slot,kind:k,player:false,...pos,a:f.a,vx:0,vy:0,hp:this.result?0:stats.hp,maxHp:stats.hp,shield:k==='command'?0:2,lastHit:-10,alive:!this.result,radius:stats.radius,cooldown:this.random(),target:null,phase:this.random()*Math.PI*2,flash:0,boost:1,outside:0,tagged:false};if(k==='command')s.turrets=COMMAND_TURRETS.map(([ox,oy],i)=>({id:i,ox,oy,cooldown:this.random()*2,burst:0,flash:0}));this.ships.push(s);}
   f.full=this.members(id).reduce((t,s)=>t+shipWorth(s),0);
  }
 }
 addCavalryWings(){
  for(let side=0;side<2;side++){
   const id=28+side;if(this.formations[id])continue;
   const dir=side?1:-1,x=WORLD.width*.66,y=WORLD.height*(side?.27:.73);
   const f={id,side,n:14,kind:'cavalry',name:formationName(side,'cavalry',14),x,y,a:dir*Math.PI/2,count:0,leader:null,state:'travel',target:28+(1-side),goal:{x,y:WORLD.height/2},recall:null,drainAt:0,role:'opening',patrolLeg:0,orderGoal:null,orderSquare:null,finishing:null};
   this.formations.push(f);
   for(let slot=0;slot<20;slot++){const stats=TYPES.cavalry;this.ships.push({id:this.serial++,side,formation:id,slot,kind:'cavalry',player:false,...formationPoint(f,slot),a:f.a,vx:0,vy:dir*stats.speed,hp:this.result?0:stats.hp,maxHp:stats.hp,shield:2,lastHit:-10,alive:!this.result,radius:stats.radius,cooldown:this.random(),target:null,phase:this.random()*Math.PI*2,flash:0,boost:1,outside:0,tagged:false});}
  }
 }
 queueReinforcements(side){
  const epoch=this.admirals[side].epoch;
  for(const hull of this.ships)if(hull.alive&&hull.kind==='artillery'&&hull.side===side&&hull.lastLaunchEpoch!==epoch){
   hull.lastLaunchEpoch=epoch;
   for(let index=0;index<RULES.fightersPerExchange;index++)this.launchQueue.push({hull:hull.id,epoch,index,at:this.time+index*RULES.launchSpacing});
  }
 }
 launchReinforcements(){
  const pending=[];
  for(const job of this.launchQueue){
   if(job.at>this.time){pending.push(job);continue;}
   const hull=this.ships[job.hull];if(!hull?.alive||this.result)continue;
   let f=this.formations[hull.formation];
   const assignment=(job.epoch-1)*RULES.fightersPerExchange+job.index;
   if(assignment%5===2){const cargo=this.formations.filter(t=>t.side===hull.side&&t.kind==='cargo'&&this.members(t.id).some(s=>s.kind==='cargo'));cargo.sort((a,b)=>this.members(a.id).filter(s=>s.kind==='fighter').length-this.members(b.id).filter(s=>s.kind==='fighter').length||a.id-b.id);f=cargo[0]||f;}
   else if(assignment%5>=3){const squadrons=this.formations.filter(t=>t.side===hull.side&&t.kind==='fighter');squadrons.sort((a,b)=>this.members(a.id).length-this.members(b.id).length||a.id-b.id);f=squadrons[0]||f;}
   if(f.kind==='fighter')f.role='attack';
   const stats=TYPES.fighter,slot=this.ships.filter(t=>t.formation===f.id).reduce((max,t)=>Math.max(max,t.slot),-1)+1;
   const a=hull.side?Math.PI/2:-Math.PI/2,port=(job.index%2?1:-1)*30;
   const ship={id:this.serial++,side:hull.side,formation:f.id,slot,pod:job.index%3,kind:'fighter',player:false,x:hull.x+Math.cos(a)*105-Math.sin(a)*port,y:hull.y+Math.sin(a)*105+Math.cos(a)*port,a,vx:Math.cos(a)*stats.speed,vy:Math.sin(a)*stats.speed,hp:stats.hp,maxHp:stats.hp,shield:2,lastHit:-10,alive:true,radius:stats.radius,cooldown:.4,target:null,phase:this.random()*Math.PI*2,flash:0,boost:1,outside:0,tagged:false,launchedBy:hull.id,launchEpoch:job.epoch};
   this.ships.push(ship);this.events.push({type:'launch',x:ship.x,y:ship.y,side:ship.side,owner:hull.id});
  }
  this.launchQueue=pending;
 }
 beginCharge(){
  if(this.phase==='final'||this.result)return;
  this.phase='final';this.chargeAt=this.time;
  for(const f of this.formations){f.recall=null;f.drainAt=0;f.state='charge';f.objective=null;f.combatPass=null;f.goal={x:WORLD.width/2,y:WORLD.height/2};}
  this.events.push({type:'final'});
 }
 checkCharge(){
  const blue=this.living(0).length,red=this.living(1).length;
  if(blue>0&&red>0&&(blue>=red*2||red>=blue*2))this.beginCharge();
 }
 get player(){return this.ships[this.playerId];}
 get decisionPending(){return this.admirals.some(a=>a.pending);}
 commandShip(side){return this.ships.find(s=>s.kind==='command'&&s.side===side);}
 commandAlive(side){return !!this.commandShip(side)?.alive;}
 reach(kind){return reachOf(kind);}
 pieceState(f,members=this.members(f.id)){const n=members.length||1,strength=members.reduce((t,s)=>t+shipWorth(s),0),cx=members.reduce((t,s)=>t+s.x,0)/n,cy=members.reduce((t,s)=>t+s.y,0)/n;return{id:f.id,side:f.side,kind:f.kind,square:squareOf(cx,cy).name,count:members.length,strength:Math.round(strength*10)/10,remaining:f.full?Math.min(1,Math.round(100*strength/f.full)/100):1,x:Math.round(cx),y:Math.round(cy)};}
 get closing(){return this.phase==='final';}
 get fortressless(){return !this.ships.some(s=>s.alive&&s.kind==='artillery');}
 get spectating(){return !this.player.alive&&this.respawn<=0;}
 get viewShip(){return this.spectating?(this.ships.find(s=>s.alive&&s.side===0&&s.kind==='fighter')||this.ships.find(s=>s.alive&&s.side===0)||this.player):this.player;}
 random(){this.seed=(Math.imul(1664525,this.seed)+1013904223)>>>0;return this.seed/4294967296;}
 living(side){return this.ships.filter(s=>s.alive&&s.side===side);}
 members(id){return this.ships.filter(s=>s.alive&&s.formation===id);}
 squad(){return this.formations[this.player?.formation??0];}
 followPoint(){const f=this.squad();if(!f||!f.count)return null;const s=this.ships[f.leader];return {x:f.state==='regroup'?f.recall.x:s?.x??f.x,y:f.state==='regroup'?f.recall.y:s?.y??f.y,name:f.name,state:f.state,role:f.role};}
 updateGroups(){for(const f of this.formations){const m=this.members(f.id);f.count=m.length;if(!m.length){f.leader=null;continue;}if(!m.some(s=>s.id===f.leader))f.leader=(m.find(s=>!s.player)||m[0]).id;f.cx=m.reduce((v,s)=>v+s.x,0)/m.length;f.cy=m.reduce((v,s)=>v+s.y,0)/m.length;}}
 updateVision(){
  this.contacts=[[],[]];for(let side=0;side<2;side++){
   const friends=this.living(side);for(const s of this.ships){if(!s.alive)continue;const visible=s.side===side||friends.some(a=>(a.x-s.x)**2+(a.y-s.y)**2<TYPES[a.kind].vision**2)||(s.kind==='artillery'&&s.arrived&&friends.some(a=>a.kind==='artillery'&&a.arrived));if(visible)this.contacts[side].push(s.id);}
  }
  // The battle remembers on the admirals' behalf: last seen square of every enemy piece out of contact.
  if(this.admirals)for(let side=0;side<2;side++){const seen=new Set(this.contacts[side]);for(const f of this.formations){if(f.side===side)continue;const m=this.members(f.id).filter(s=>seen.has(s.id));if(!m.length)continue;const x=m.reduce((n,s)=>n+s.x,0)/m.length,y=m.reduce((n,s)=>n+s.y,0)/m.length;this.admirals[side].lastSeen[f.id]={x:Math.round(x),y:Math.round(y),square:squareOf(x,y).name,count:m.length,at:Math.round(this.time)};}}
 }
 visible(s,side=0){return s.alive&&(s.side===side||this.contacts[side].includes(s.id));}
 turretPoint(s,t){const a=s.a+Math.PI/2;return{x:s.x+Math.cos(a)*t.ox-Math.sin(a)*t.oy,y:s.y+Math.sin(a)*t.ox+Math.cos(a)*t.oy};}
 railState(s){if(!s.alive||s.kind!=='artillery')return null;let start=s.railNext;if(this.time>=start+1)return null;const till=start-this.time;if(till>3)return null;return{active:till<=0,seconds:Math.max(0,till),a:(s.railAim??s.a)+(till<=0?(clamp(-till,0,1)-.5)*.012:0),start};}
 // One admiral's pulse: its clock expires, its board goes out for orders, and its commanded pieces
 // recall while it thinks. Squadron fighters and cavalry regroup on their own centre; battery,
 // convoy and escort fighters return to their hulls (see npc). Pieces finishing a kill stay on it.
 beginRecall(side){
  const a=this.admirals[side];if(this.phase==='opening')this.phase='combat';
  a.epoch++;a.pending=true;a.sentAt=this.time;a.status='thinking';
  for(const f of this.formations){if(f.side!==side||!f.count||!(f.kind==='fighter'||f.kind==='cavalry')||f.finishing!=null)continue;f.state='regroup';f.recall={x:clamp(f.cx,650,WORLD.width-650),y:clamp(f.cy,650,WORLD.height-650)};f.drainAt=Infinity;f.decision=null;}
  this.queueReinforcements(side);
  this.events.push({type:'recall',side,epoch:a.epoch});this.inference.status='requesting orders';
 }
 // One fresh, team-observed board per side: own pieces, enemy pieces in contact, ghosts of enemy
 // pieces last seen, and each own piece's reach. No transcript, no hidden contacts.
 decisionSnapshot(side){
  const a=this.admirals[side],visible=new Set(this.contacts[side]),pieces=[],enemies=[],ghosts=[];
  for(const f of this.formations){const m=this.members(f.id);if(!m.length)continue;
   if(f.side===side){const p=this.pieceState(f,m);const own={...p,reach:this.reach(f.kind)};if(m.some(s=>s.player))own.player=true;if(f.finishing!=null)own.finishing=f.finishing;pieces.push(own);continue;}
   const seen=m.filter(s=>visible.has(s.id));
   if(seen.length){const p=this.pieceState(f,seen);const e={...p};if(seen.length<m.length)e.partial=true;enemies.push(e);}
   else{const g=a.lastSeen[f.id];if(g)ghosts.push({id:f.id,kind:f.kind,square:g.square,count:g.count,age:Math.max(0,Math.round(this.time-g.at))});}
  }
  return{version:2,epoch:a.epoch,side,time:Math.round(this.time),phase:this.phase,board:{files:BOARD.files,ranks:BOARD.ranks,square:BOARD.square},pieces,enemies,ghosts,legal:pieces.map(p=>({piece:p.id,at:p.square,reach:p.reach}))};
 }
 // Standing orders: the local admiral used when no model answers. Fighters and cavalry close on
 // the nearest known enemy piece (a wounded enemy command ship first); everything else holds or
 // keeps its route.
 fallback(snap){return Battle.standingOrders(snap);}
 static standingOrders(snap){
  const known=[...snap.enemies,...snap.ghosts],centre=squareOf(WORLD.width/2,WORLD.height/2).name,enemyCommand=known.find(t=>t.kind==='command');
  const orders=[];
  for(const p of snap.pieces){
   if(p.kind==='artillery'||p.kind==='cargo'||p.kind==='command')continue;
   if(p.kind==='scout'){orders.push({piece:p.id,to:p.square});continue;}
   let goal;
   if(enemyCommand&&(enemyCommand.remaining??1)<.5)goal=enemyCommand.square;
   else{const near=known.filter(t=>t.kind!=='scout').sort((x,y)=>squareDistance(p.square,x.square)-squareDistance(p.square,y.square))[0];goal=near?near.square:snap.phase==='opening'?p.square:centre;}
   orders.push({piece:p.id,to:nearestReachable(p.square,p.reach,goal)});
  }
  return orders;
 }
 // Orders arrive for one side: every own piece is sent to a square (clamped into reach), a piece
 // without an order holds (batteries and convoys keep their routes), the regroup drains and that
 // admiral's play clock restarts. A move away from a finishing target cancels the finish.
 acceptOrders(snapshot,orders,source='inference'){
  const side=snapshot?.side,a=this.admirals[side];
  if(this.result||!a||!a.pending||snapshot.epoch!==a.epoch||!Array.isArray(orders))return false;
  const given=new Map();for(const o of orders){if(!o||!Number.isInteger(o.piece)||given.has(o.piece)||!isSquare(o.to))continue;given.set(o.piece,parseSquare(o.to).name);}
  let clamped=0;
  for(const p of snapshot.pieces){const f=this.formations[p.id];if(!f||f.side!==side||!f.count)continue;
   let to=given.get(p.id)??null;
   if(to===null){if(f.kind==='artillery'||f.kind==='cargo'||f.kind==='command'){f.orderGoal=null;f.orderSquare=null;continue;}to=p.square;}
   const legal=nearestReachable(p.square,p.reach,to);if(legal!==to){clamped++;to=legal;}
   const c=centreOf(to);f.orderSquare=to;f.orderGoal={x:Math.round(c.x),y:Math.round(c.y)};f.decision={to};
   if(f.finishing!=null){const e=this.formations[f.finishing];if(!e?.count||squareDistance(to,this.pieceState(e).square)>2)f.finishing=null;}
   if(f.kind==='fighter'||f.kind==='cavalry')f.target=null;
  }
  a.pending=false;a.ordersAt=this.time;a.nextAt=this.time+RULES.cycle;a.clamped=clamped;
  for(const f of this.formations)if(f.side===side&&f.state==='regroup')f.drainAt=this.time+RULES.regroup;
  const counter=source==='inference'?'real':source==='fixture'?'fixture':source==='local'?'local':'fallback';a[counter]++;this.inference[counter==='local'?'fallback':counter]++;
  a.status=source==='inference'?'orders received':source==='local'?'local orders':'standing orders';this.inference.status=a.status;
  this.events.push({type:'orders',side,epoch:a.epoch,source});return true;
 }
 setFallback(side){for(const s of side===undefined?[0,1]:[side]){const a=this.admirals[s];if(!a.pending)continue;const snap=this.decisionSnapshot(s);this.acceptOrders(snap,this.fallback(snap),'fallback');}}
 // Snap judgement, made every half second in the battle rather than by the admiral: a piece that
 // has an engaged enemy below a third of its strength, and outweighs it, stays on the kill through
 // recalls. A wounded enemy command ship locks every piece in contact with it.
 updateFinishing(){
  for(const f of this.formations){if(!(f.kind==='fighter'||f.kind==='cavalry')||!f.count)continue;const m=this.members(f.id);
   const votes=new Map();for(const s of m){const t=this.ships[s.target];if(t?.alive&&t.side!==f.side)votes.set(t.formation,(votes.get(t.formation)||0)+1);}
   let engaged=null,best=0;for(const [id,n] of votes)if(n>best){best=n;engaged=id;}
   const own=this.pieceState(f,m);
   if(f.finishing!=null){const e=this.formations[f.finishing],em=e?this.members(e.id):[];if(!em.length){f.finishing=null;continue;}
    if(engaged===f.finishing)f.finishSeenAt=this.time;
    if(this.time-(f.finishSeenAt||0)>5||(e.kind!=='command'&&own.remaining<.34))f.finishing=null;continue;}
   if(engaged===null||best<Math.max(2,m.length*.25))continue;const e=this.formations[engaged],em=this.members(engaged);if(!em.length)continue;const es=this.pieceState(e,em);
   if((e.kind==='command'&&es.remaining<.34)||(es.remaining<.34&&own.strength>=1.5*es.strength)){f.finishing=engaged;f.finishSeenAt=this.time;this.events.push({type:'finishing',side:f.side,piece:f.id,target:engaged});}
  }
 }
 fire(s,a,{turret=null,damage=null,speed=RULES.boltSpeed,light=false,burstFollowup=false,heavy=false,cooldown=null}={}){
  if(!s.alive||this.result)return;const gun=turret||s;if(gun.cooldown>0&&!burstFollowup)return;
  if(!burstFollowup)gun.cooldown=cooldown??(turret?(turret.id===7?(turret.burst>0?.3:4.8):.95):TYPES[s.kind].reload);
  if(s.player&&!this.autopilot&&!turret&&!burstFollowup){s.burstAt=this.time+.12;s.burstRemaining=2;}
  const p=turret?this.turretPoint(s,turret):{x:s.x+Math.cos(a)*20,y:s.y+Math.sin(a)*20};
  const ports=s.kind==='escort'&&!turret?[-9,9]:[0];
  for(const offset of ports)this.bolts.push({id:this.projectileSerial++,x:p.x-Math.sin(a)*offset,y:p.y+Math.cos(a)*offset,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,side:s.side,owner:s.id,player:s.player,heavy,damage:damage??TYPES[s.kind].damage,life:RULES.boltRange/speed,light,visualScale:burstFollowup?.72:1});
  if(s.player)this.shots+=ports.length;this.events.push({type:'shot',x:p.x,y:p.y,a,side:s.side,player:s.player,owner:s.id,heavy,burst:burstFollowup?2:1});
 }

 canDamage(source,target){return this.phase==='final'||source?.kind!=='artillery'||target.kind!=='artillery';}
 damage(s,shot,amount=1,component=null){
  const attacker=this.ships[shot.owner];
  if(this.result||!s.alive||!this.canDamage(attacker,s))return;this.lastDamage=this.time;s.lastHit=this.time;s.flash=.17;
  // The struck pilot reacts to a local attacker; the rest of the formation
  // keeps its own targets instead of receiving one hive-mind threat assignment.
  if(attacker?.alive&&attacker.side!==s.side){if(this.time<10){const formation=this.formations[s.formation];formation.threatTarget=attacker.id;formation.threatUntil=this.time+5;}else{s.threatTarget=attacker.id;s.threatUntil=this.time+5;}}
  const hitPoints=shot.player&&s.side===1?25:0;if(hitPoints){this.hits++;this.score+=hitPoints;s.tagged=true;}
  // Guns are part of the fortress: hits flash the mount and damage hull, never disable a turret.
  if(component)component.flash=.24;
  if(s.kind!=='artillery'&&s.kind!=='command'&&!shot.rail&&s.shield>0){s.shield--;this.events.push({type:'shield',x:s.x,y:s.y,side:s.side,player:s.player,popped:s.shield===0,fromPlayer:shot.player,points:hitPoints});return;}
  s.hp=Math.max(0,s.hp-amount);this.events.push({type:'hit',x:s.x,y:s.y,side:s.side,player:s.player,fromPlayer:shot.player,large:s.kind==='artillery'||s.kind==='command',points:hitPoints});
  if(s.hp<=0)this.destroy(s,shot);
 }
 destroy(s,shot={}){
  if(!s.alive||this.result)return;s.alive=false;s.hp=0;let points=0;if(s.side===1){if(shot.player){this.kills++;points=s.kind==='command'?25000:s.kind==='artillery'?10000:s.kind==='cargo'?3500:s.kind==='escort'?2000:s.kind==='cavalry'?1500:1000;}else if(s.tagged)points=250;this.score+=points;}this.events.push({type:'explosion',x:s.x,y:s.y,side:s.side,player:s.player,fromPlayer:shot.player,large:s.kind==='artillery'||s.kind==='cargo'||s.kind==='command',targetKind:s.kind,points,assist:points===250});
  if(s.player){this.lives=Math.max(0,this.lives-1);this.respawn=this.lives>0?2.2:0;if(!this.respawn)this.events.push({type:'spectate'});}
 }
 replacePlayer(){
  if(this.player.alive)return;this.respawn=0;if(this.lives<=0)return;
  const dead=this.player;let pool=this.living(0).filter(s=>s.kind==='fighter');pool.sort((a,b)=>(a.formation!==dead.formation)-(b.formation!==dead.formation)||distance(a,dead)-distance(b,dead));
  if(!pool.length){this.lives=0;this.events.push({type:'spectate'});return;}const next=pool[0];dead.player=false;next.player=true;this.playerId=next.id;next.outside=0;this.events.push({type:'respawn',x:next.x,y:next.y});
 }
 finish(result,reason=''){if(this.result)return;this.result=result;this.reason=reason;for(const a of this.admirals)a.pending=false;if(result==='won')this.score+=this.lives*2500;this.events.push({type:'end',result});}
 targetFor(s,grid){
  const f=this.formations[s.formation],anchor=this.ships[f.objective],range=s.kind==='scout'?TYPES.scout.vision:1000;let best=null,value=Infinity;for(const t of grid.query(s.x,s.y,range))if(t.alive&&t.side!==s.side){if(anchor?.alive&&t!==anchor&&distance(t,anchor)>1300)continue;const d=(s.x-t.x)**2+(s.y-t.y)**2;if(d>range**2)continue;if(s.kind==='scout'&&t.kind!=='scout'&&d>1000**2)continue;const claimed=this.time<11?0:grid.query(t.x,t.y,450).filter(a=>a.alive&&a.side===s.side&&a!==s&&a.target===t.id).length;let v=d+claimed*range**2*.12;if(t.formation===f.target)v*=.68;if(s.kind==='scout'&&t.kind!=='scout')v+=range**2;if(v<value){best=t;value=v;}}return best;
 }
 steer(s,x,y,dt,speed,grid,weight=1){
  speed=Math.min(speed,TYPES[s.kind].speed);
  let dx=x-s.x,dy=y-s.y,l=Math.hypot(dx,dy)||1;dx=dx/l*weight;dy=dy/l*weight;
  for(const t of grid.query(s.x,s.y,65)){if(t===s)continue;const d=distance(s,t),space=s.radius+t.radius+17;if(d>0&&d<space){dx+=(s.x-t.x)/d*(space-d)/space*1.8;dy+=(s.y-t.y)/d*(space-d)/space*1.8;}}
  const edge=170;dx+=s.x<edge?(edge-s.x)/70:s.x>WORLD.width-edge?-(s.x-WORLD.width+edge)/70:0;dy+=s.y<edge?(edge-s.y)/70:s.y>WORLD.height-edge?-(s.y-WORLD.height+edge)/70:0;
  const turn=TYPES[s.kind].turn;if(s.kind==='fighter'){const desiredTurn=clamp(angleDelta(s.a,Math.atan2(dy,dx))*3,-2.4,2.4);s.turnVelocity=(s.turnVelocity||0)+(desiredTurn-(s.turnVelocity||0))*(1-Math.exp(-dt*8));s.a+=s.turnVelocity*dt;}else{s.a+=clamp(angleDelta(s.a,Math.atan2(dy,dx)),-turn*dt,turn*dt);} const ease=1-Math.exp(-dt*RULES.acceleration);s.vx+=(Math.cos(s.a)*speed-s.vx)*ease;s.vy+=(Math.sin(s.a)*speed-s.vy)*ease;
 }
 moveUnit(f,dt){
  if(!f.count)return;
  if(f.kind==='artillery'){const ship=this.members(f.id).find(s=>s.kind==='artillery');if(ship){f.objective=ship.id;f.x=ship.x;f.y=ship.y;f.goal={x:ship.x,y:ship.y};return;}}
  if(f.kind==='command'){this.moveCommand(f,dt);return;}
  if(f.kind==='cargo'){
   // Convoys follow the shared rendezvous clock unless the admiral has sent them somewhere.
   f.goal=f.orderGoal||frontPoint('cargo',f.n,f.side,this.time);
   const dx=f.goal.x-f.x,dy=f.goal.y-f.y,d=Math.hypot(dx,dy),travel=Math.min(d,TYPES.cargo.speed*dt);
   if(d>.01){f.a=Math.atan2(dy,dx);f.x+=dx/d*travel;f.y+=dy/d*travel;}
   f.state=this.closing?'charge':'convoy';
   return;
  }
  if(f.kind==='scout'){if(f.orderGoal)f.goal=f.orderGoal;return;}
  if(f.state==='regroup'){
   if(this.time>=f.drainAt){f.state='travel';f.x=f.recall.x;f.y=f.recall.y;}else return;
  }
  const finishing=f.finishing!=null?this.formations[f.finishing]:null;
  if(finishing?.count){f.target=finishing.id;f.objective=null;f.goal={x:finishing.cx,y:finishing.cy};}
  else if(f.orderGoal){f.goal=f.orderGoal;f.objective=null;}
  else if(this.closing){f.recall=null;f.objective=null;f.state='charge';f.goal={x:WORLD.width/2,y:WORLD.height/2};return;}
  else{
   if(f.finishing!=null)f.finishing=null;
   if(this.fortressless){f.objective=null;f.target=null;f.goal={x:WORLD.width/2,y:WORLD.height/2};}
   const artilleryAssault=(f.kind==='fighter'||f.kind==='cavalry')&&this.time>=RULES.artilleryAssaultAt&&this.phase!=='opening';
   if(artilleryAssault){const targets=this.formations.filter(t=>t.side!==f.side&&t.kind==='artillery'&&t.count);if(targets.length){const enemyArtillery=targets[f.n%targets.length],hull=this.members(enemyArtillery.id).find(s=>s.kind==='artillery'),a=f.side*Math.PI+f.n*2.1;f.target=enemyArtillery.id;f.objective=hull?.id??null;f.goal={x:enemyArtillery.cx+Math.cos(a)*(f.kind==='cavalry'?650:460),y:enemyArtillery.cy+Math.sin(a)*(f.kind==='cavalry'?650:460)};}}
   const enemy=this.formations[f.target];if(!artilleryAssault&&enemy?.count){const observed=this.contacts[f.side].some(id=>this.ships[id].formation===enemy.id);if(observed)f.goal={x:enemy.cx,y:enemy.cy};}
   if(this.phase==='final'&&(f.kind==='cavalry'||f.kind==='fighter')&&!enemy?.count){const seen=this.contacts[f.side].map(id=>this.ships[id]).filter(s=>s.side!==f.side);seen.sort((a,b)=>distance(a,f)-distance(b,f));if(seen.length){f.target=seen[0].formation;f.goal={x:seen[0].x,y:seen[0].y};}else f.goal={x:WORLD.width/2+Math.sin(this.time/18+f.n)*2300,y:WORLD.height/2+Math.cos(this.time/23+f.n)*2300};}
   if(!artilleryAssault&&f.kind==='cavalry'&&this.time>65&&this.time>= (f.chooseAt||0)){f.chooseAt=this.time+38;const options=this.formations.filter(t=>t.kind==='fighter'&&t.count&&this.contacts[f.side].some(id=>this.ships[id].formation===t.id));options.sort((a,b)=>a.count-b.count||distance(a,f)-distance(b,f));const target=options.find(t=>t.side!==f.side)||options[0];if(target){f.target=target.id;f.goal={x:target.cx,y:target.cy};}}
  }
  const d=distance(f,f.goal);f.a=Math.atan2(f.goal.y-f.y,f.goal.x-f.x);f.state=d<450?'combat':'travel';if(d>350){f.x+=Math.cos(f.a)*Math.min(d,RULES.formationSpeed*dt);f.y+=Math.sin(f.a)*Math.min(d,RULES.formationSpeed*dt);}
 }
 // The command ship holds its home station, moves where its admiral sends it, and closes toward
 // the centre for the final engagement. Its hull drives itself in command(); the formation
 // follows the hull so the escort ring stays with it.
 moveCommand(f,dt){
  const hull=this.commandShip(f.side);
  f.dest=f.orderGoal||(this.closing?{x:WORLD.width/2,y:WORLD.height/2+(f.side?-1:1)*1100}:f.home||{x:f.x,y:f.y});
  if(hull?.alive){f.x=hull.x;f.y=hull.y;}else if(Number.isFinite(f.cx)){f.x=f.cx;f.y=f.cy;}
  f.a=f.side?Math.PI/2:-Math.PI/2;f.goal=f.dest;f.state=this.closing?'charge':f.orderGoal?'travel':'hold';
 }
 npc(s,dt,grid){
  const f=this.formations[s.formation],stats=TYPES[s.kind],awareness=s.kind==='scout'?TYPES.scout.vision:1500,pending=!!this.admirals[s.side]?.pending;
  const threatOwner=this.time<10?f:s,threatened=threatOwner.threatUntil>this.time?this.ships[threatOwner.threatTarget]:null;
  let target=this.ships[s.target];
  if(threatened?.alive&&threatened.side!==s.side&&distance(s,threatened)<=awareness){target=threatened;s.target=target.id;}
  else if(this.tick%12===s.id%12||!target?.alive||distance(s,target)>(s.kind==='scout'?TYPES.scout.vision:1050)){target=this.targetFor(s,grid);s.target=target?.id??null;}
  let x=f.x,y=f.y,speed=stats.speed;
  const recalling=(f.kind==='fighter'||f.kind==='cavalry')&&f.recall&&(f.state==='regroup'||this.time<f.drainAt+(s.slot%5)*.05);
  if(recalling){
   const p=f.recall,near=distance(s,p)<650;
   if(near){const hold=figureEight(p,s,this.time);x=hold.x;y=hold.y;speed=RULES.cruiseSpeed;}
   else{x=p.x;y=p.y;speed=stats.speed;}
  }else if(s.kind==='scout'){
   const edge=f.n===4?900:WORLD.width-900;const legs=[{x:edge,y:1800},{x:edge,y:WORLD.height/2},{x:edge,y:WORLD.height-1800},{x:edge+(edge<WORLD.width/2?800:-800),y:WORLD.height/2}];
   let p=f.orderGoal||legs[f.patrolLeg%4];if(!f.orderGoal&&distance(s,p)<250)f.patrolLeg=(f.patrolLeg+1)%4;
   if(f.orderGoal&&distance(s,p)<600){const hold=figureEight(p,s,this.time,1.2);x=hold.x;y=hold.y;speed=RULES.cruiseSpeed;}else{x=p.x;y=p.y;}if(this.phase==='final'&&this.time>720){x=WORLD.width/2+Math.sin(this.time/18+s.phase)*3000;y=WORLD.height/2+Math.cos(this.time/21+s.phase)*3000;}
   // Scouts intercept other scouts as soon as their sensors detect them, in every phase.
   if(target?.kind==='scout'){const d=distance(s,target),a=intercept(s,target,RULES.boltSpeed);x=s.x+Math.cos(a)*Math.max(220,d);y=s.y+Math.sin(a)*Math.max(220,d);speed=clamp(d*.6,RULES.cruiseSpeed,stats.speed);}
   else if(this.phase==='final'&&target&&this.formations[target.formation].count<6){x=target.x;y=target.y;}
   else if(target&&distance(s,target)<650&&target.kind!=='scout'){x=s.x+(s.x-target.x)*3;y=s.y+(s.y-target.y)*3;}
  }else if(f.kind==='artillery'){
   const hull=this.members(f.id).find(t=>t.kind==='artillery');const p=hull||f;
   if(distance(s,p)<800){const hold=figureEight(p,s,this.time,1.5);x=hold.x;y=hold.y;speed=RULES.cruiseSpeed;}
   else{x=p.x;y=p.y;speed=stats.speed;}
   if(target&&!pending&&distance(target,p)<1000){x=target.x;y=target.y;speed=stats.speed;}
  }else if(f.kind==='command'){
   // The elite escort rings its command ship, sorties only against enemies near the hull, and returns while the admiral thinks.
   const hull=this.commandShip(s.side),p=hull?.alive?hull:f;
   if(distance(s,p)<900){const hold=figureEight(p,s,this.time,1.3);x=hold.x;y=hold.y;speed=RULES.cruiseSpeed;}
   else{x=p.x;y=p.y;speed=stats.speed;}
   if(target&&!pending&&distance(target,p)<1000){x=target.x;y=target.y;speed=stats.speed;}
  }else if(f.kind==='cargo'){
   const pod=this.ships.find(t=>t.alive&&t.formation===f.id&&t.kind==='cargo'&&t.pod===s.pod)||this.ships.find(t=>t.alive&&t.formation===f.id&&t.kind==='cargo');
   if(pod){const hold=figureEight(pod,s,this.time,.82);x=hold.x;y=hold.y;speed=RULES.cruiseSpeed;if(target&&!pending&&distance(s,target)<680){x=target.x;y=target.y;speed=stats.speed;}}
  }else if(target&&distance(s,target)<(threatened?1500:1100)&&(threatened||distance(s,f.goal)<1500)){
   // Individual intercepts within the squadron's objective area.
   // Brief straight exits prevent point-blank pursuit from becoming a curl.
   const d=distance(s,target);
   if(d<150&&(!s.breakAway||this.time>=s.breakAway.until))s.breakAway={a:s.a,until:this.time+1.1+(s.id%4)*.12};
   if(s.breakAway&&this.time<s.breakAway.until){x=s.x+Math.cos(s.breakAway.a)*420;y=s.y+Math.sin(s.breakAway.a)*420;}
   else{const a=intercept(s,target,RULES.boltSpeed),lane=((s.id%5)-2)*22;x=s.x+Math.cos(a)*Math.max(250,d)-Math.sin(a)*lane;y=s.y+Math.sin(a)*Math.max(250,d)+Math.cos(a)*lane;}
   speed=stats.speed;
  }else if(f.state==='combat'){
   if(distance(s,f)<650){const hold=figureEight(f,s,this.time);x=hold.x;y=hold.y;speed=RULES.cruiseSpeed;}
   else{x=f.x;y=f.y;speed=stats.speed;}
  }else{const slot=formationPoint(f,s.slot);x=slot.x+Math.cos(f.a)*90;y=slot.y+Math.sin(f.a)*90;const error=(slot.x-s.x)*Math.cos(f.a)+(slot.y-s.y)*Math.sin(f.a);speed=clamp(RULES.formationSpeed+error*2,RULES.cruiseSpeed,Math.min(330,stats.speed));}
  if(this.fortressless&&!f.orderGoal&&f.kind!=='command'&&!recalling&&f.finishing==null){const a=s.phase+s.side*Math.PI;x=WORLD.width/2+Math.cos(a)*180;y=WORLD.height/2+Math.sin(a)*180;speed=stats.speed;}
  // After the last command cycle, converge on the center and intercept observed survivors.
  // This standing order prevents escorts and scout pursuit circles from stalling elimination.
  if(this.closing&&!f.orderGoal&&f.kind!=='command'&&!recalling&&f.finishing==null){
   const seen=this.contacts[s.side].map(id=>this.ships[id]).filter(t=>t.alive&&t.side!==s.side);
   seen.sort((a,b)=>distance(s,a)-distance(s,b));const contact=target?.alive?target:seen[0];
   if(contact){const d=distance(s,contact),a=intercept(s,contact,RULES.boltSpeed);x=s.x+Math.cos(a)*Math.max(220,d);y=s.y+Math.sin(a)*Math.max(220,d);
    if(d<140){x=s.x+Math.cos(s.a)*360;y=s.y+Math.sin(s.a)*360;}
   }else{const hold=figureEight({x:WORLD.width/2,y:WORLD.height/2},s,this.time,2);x=hold.x;y=hold.y;}
   speed=stats.speed;
  }
  // Threat lanes are visible signals even when the firing fortress is outside sensors.
  if(s.railEvade&&s.railEvade.until<this.time)s.railEvade=null;
  if(!s.railEvade)for(const a of this.ships)if(a.kind==='artillery'&&a.alive){const r=this.railState(a);if(!r)continue;const dx=s.x-a.x,dy=s.y-a.y,along=dx*Math.cos(r.a)+dy*Math.sin(r.a),cross=dx*-Math.sin(r.a)+dy*Math.cos(r.a),future=cross+(-Math.sin(r.a)*s.vx+Math.cos(r.a)*s.vy)*Math.max(.3,r.seconds);if(along>0&&(Math.abs(cross)<170||cross*future<0)){const sign=cross>=0?1:-1;s.railEvade={until:r.start+1.6,x:clamp(s.x-Math.sin(r.a)*sign*440,180,WORLD.width-180),y:clamp(s.y+Math.cos(r.a)*sign*440,180,WORLD.width-180)};break;}}
  if(s.railEvade){x=s.railEvade.x;y=s.railEvade.y;}
  this.steer(s,x,y,dt,speed,grid);
  if(target&&distance(s,target)<(threatened?1150:850)){let aimTarget=target;if(target.kind==='artillery'){const guns=target.turrets;if(guns.length)aimTarget=this.turretPoint(target,guns[s.id%guns.length]);}
   const a=intercept(s,{...aimTarget,vx:target.vx,vy:target.vy},RULES.boltSpeed);
   if(Math.abs(angleDelta(s.a,a))<.17)this.fire(s,s.a+(this.random()-.5)*.04);
  }
 }
 clusterTarget(s,grid,range){
  const candidates=grid.query(s.x,s.y,range).filter(t=>t.alive&&t.side!==s.side&&t.kind!=='artillery'&&distance(s,t)<range);let best=null;
  for(const t of candidates){const members=candidates.filter(o=>distance(t,o)<330);const score=members.length*1000-distance(s,t);if(!best||score>best.score)best={score,members};}
  if(!best||best.members.length<3)return null;const members=best.members;return{x:members.reduce((n,t)=>n+t.x,0)/members.length,y:members.reduce((n,t)=>n+t.y,0)/members.length,vx:members.reduce((n,t)=>n+t.vx,0)/members.length,vy:members.reduce((n,t)=>n+t.vy,0)/members.length,count:members.length};
 }
 artillery(s,dt,grid){
  const dir=s.side?1:-1;
  const destination=frontPoint('artillery',this.formations[s.formation].n,s.side,this.time),dx=destination.x-s.x,dy=destination.y-s.y,d=Math.hypot(dx,dy),travel=Math.min(d,TYPES.artillery.speed*dt);
  s.vx=d?dx/d*travel/dt:0;s.vy=d?dy/d*travel/dt:0;s.x+=s.vx*dt;s.y+=s.vy*dt;s.arrived=this.time>=RULES.rendezvousAt&&d<3;

  if(this.time>=s.railNext+1){s.railNext+=RULES.railPeriod;s.railHits=[];s.railAim=null;}
  if(this.time>=s.railNext-3&&!Number.isFinite(s.railAim)){const cluster=this.clusterTarget(s,grid,3600);s.railAim=cluster?Math.atan2(cluster.y-s.y,cluster.x-s.x):s.a;}
  const rail=this.railState(s);if(rail?.active){if(s.railFired!==rail.start){s.railFired=rail.start;this.events.push({type:'rail',x:s.x,y:s.y,side:s.side});}
   const ex=s.x+Math.cos(rail.a)*13000,ey=s.y+Math.sin(rail.a)*13000;
   for(const t of this.ships)if(t.alive&&t!==s&&this.canDamage(s,t)&&!s.railHits.includes(t.id)&&segmentDistance(t.x,t.y,s.x,s.y,ex,ey)<22+t.radius){s.railHits.push(t.id);this.railDamage.push({target:t,shot:{rail:true,side:s.side,owner:s.id},amount:RULES.railDamage});}
  }
  for(const turret of s.turrets)turret.flash=Math.max(0,turret.flash-dt);
  const cluster=this.clusterTarget(s,grid,820);if(!cluster)return;
  for(const turret of s.turrets){turret.cooldown-=dt;if(turret.cooldown>0)continue;
   const pos=this.turretPoint(s,turret);const a=intercept(pos,cluster,turret.id===3?720:860);
   if(turret.id===3){if(turret.burst===0)turret.burst=2;turret.burst--;this.fire(s,a+(this.random()-.5)*.17,{turret,damage:12,speed:720});}
   else this.fire(s,a+(this.random()-.5)*.28,{turret,damage:4,speed:860,light:true});
  }
 }
 cargo(s,dt,grid){
  const f=this.formations[s.formation];let target=this.ships[s.target];
  if(this.tick%12===s.id%12||!target?.alive||distance(s,target)>TYPES.cargo.vision){target=this.targetFor(s,grid);s.target=target?.id??null;}
  const slot=formationPoint(f,s.slot),lead=100;this.steer(s,slot.x+Math.cos(f.a)*lead,slot.y+Math.sin(f.a)*lead,dt,clamp(distance(s,slot)*.8,20,TYPES.cargo.speed),grid);s.x+=s.vx*dt;s.y+=s.vy*dt;s.x=clamp(s.x,10,WORLD.width-10);s.y=clamp(s.y,10,WORLD.height-10);
  for(const turret of s.turrets){turret.flash=Math.max(0,turret.flash-dt);turret.cooldown-=dt;if(!target||turret.cooldown>0||distance(s,target)>760)continue;const a=intercept(this.turretPoint(s,turret),target,760);this.fire(s,a+(this.random()-.5)*.08,{turret,damage:TYPES.cargo.damage,speed:760,light:true});}
 }
 // The command ship: a slow capital hull with eight light mounts and a spinal cannon that fires
 // three-round bursts of slower, heavier rounds. Its destination is set by moveCommand.
 command(s,dt,grid){
  const f=this.formations[s.formation],dest=f.dest||f.home||s,dx=dest.x-s.x,dy=dest.y-s.y,d=Math.hypot(dx,dy),travel=Math.min(d,TYPES.command.speed*dt);
  s.vx=d>1?dx/d*travel/dt:0;s.vy=d>1?dy/d*travel/dt:0;s.x=clamp(s.x+s.vx*dt,400,WORLD.width-400);s.y=clamp(s.y+s.vy*dt,400,WORLD.height-400);s.a=s.side?Math.PI/2:-Math.PI/2;
  for(const turret of s.turrets)turret.flash=Math.max(0,turret.flash-dt);
  const enemies=grid.query(s.x,s.y,1000).filter(t=>t.alive&&t.side!==s.side&&distance(s,t)<1000);if(!enemies.length)return;
  enemies.sort((a,b)=>distance(s,a)-distance(s,b));const cluster=this.clusterTarget(s,grid,1000)||enemies[0];
  for(const turret of s.turrets){turret.cooldown-=dt;if(turret.cooldown>0)continue;const pos=this.turretPoint(s,turret);
   if(turret.id===8){const a=intercept(pos,cluster,600);turret.burst=turret.burst>0?turret.burst-1:2;this.fire(s,a+(this.random()-.5)*.06,{turret,damage:TYPES.command.damage,speed:600,heavy:true,cooldown:turret.burst>0?.22:4});}
   else{const t=enemies[turret.id%enemies.length],a=intercept(pos,t,860);this.fire(s,a+(this.random()-.5)*.2,{turret,damage:5,speed:860,light:true,cooldown:.9});}
  }
 }
 step(dt,input={}){
  if(this.result)return;dt=clamp(dt,0,1/15);this.time+=dt;this.tick++;this.rocketCooldown=Math.max(0,this.rocketCooldown-dt);
  if(this.respawn>0){this.respawn-=dt;if(this.respawn<=0)this.replacePlayer();}if(this.result)return;
  if(this.tick%6===0)this.updateGroups();if(this.tick%12===0)this.updateVision();
  for(const a of this.admirals){if(!a.pending&&this.time>=a.nextAt&&this.time<RULES.recallCutoff&&a.epoch<RULES.maxOrdersPerSide)this.beginRecall(a.side);if(a.pending&&this.time>=a.sentAt+RULES.thinkCeiling)this.setFallback(a.side);}
  if(this.tick%15===0)this.updateFinishing();
  if(this.time>=RULES.rendezvousAt)this.beginCharge();
  this.launchReinforcements();
  this.railDamage=[];const grid=new Grid(this.ships);for(const f of this.formations)this.moveUnit(f,dt);
  for(const s of this.ships){if(!s.alive)continue;s.cooldown-=dt;s.flash=Math.max(0,s.flash-dt);if(s.kind!=='artillery'&&s.kind!=='cargo'&&s.kind!=='command'&&this.time-s.lastHit>=5)s.shield=2;
   if(s.kind==='artillery'){this.artillery(s,dt,grid);continue;}
   if(s.kind==='command'){this.command(s,dt,grid);continue;}
   if(s.kind==='cargo'){this.cargo(s,dt,grid);continue;}
   if(s.player&&!this.autopilot){const x=clamp(input.x||0,-1,1),y=clamp(input.y||0,-1,1),len=Math.max(1,Math.hypot(x,y)),speed=RULES.playerSpeed,ease=1-Math.exp(-RULES.acceleration*dt);s.vx+=(x/len*speed-s.vx)*ease;s.vy+=(y/len*speed-s.vy)*ease;const aim=Number.isFinite(input.aim)?input.aim:-Math.PI/2,turn=TYPES[s.kind].turn*dt;s.a+=clamp(angleDelta(s.a,aim),-turn,turn);s.boosting=false;if(Number.isFinite(s.burstAt)&&this.time+1e-9>=s.burstAt){s.burstRemaining=Math.max(0,(s.burstRemaining??1)-1);s.burstAt=s.burstRemaining?this.time+.12:null;this.fire(s,s.a,{burstFollowup:true,damage:TYPES[s.kind].damage*.5});}if(input.fire)this.fire(s,s.a);}
   else this.npc(s,dt,grid);
   s.x+=s.vx*dt;s.y+=s.vy*dt;
   if(s.player){if(s.x<0||s.x>WORLD.width||s.y<0||s.y>WORLD.height){s.outside+=dt;if(s.outside>=5)this.destroy(s,{boundary:true});}else s.outside=0;}
   else {s.x=clamp(s.x,10,WORLD.width-10);s.y=clamp(s.y,10,WORLD.height-10);}
  }
  for(const d of this.railDamage)this.damage(d.target,d.shot,d.amount);this.railDamage=[];
  const collision=new Grid(this.ships);for(const b of this.bolts){if(this.result)break;const ax=b.x,ay=b.y;b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;if(b.life<=0)continue;let hit=null,component=null,along=Infinity;
   for(const s of collision.query(b.x,b.y,115)){if(!s.alive||s.side===b.side||!this.canDamage(this.ships[b.owner],s))continue;const d=segmentDistance(s.x,s.y,ax,ay,b.x,b.y);if(d>s.radius+5)continue;let ct=null;
    if(s.kind==='artillery'){for(const t of s.turrets){const p=this.turretPoint(s,t);if(segmentDistance(p.x,p.y,ax,ay,b.x,b.y)<18){ct=t;break;}}if(!ct&&d>54)continue;}
    else if(d>s.radius)continue;const near=distance({x:ax,y:ay},s);if(near<along){hit=s;along=near;component=ct;}
   }if(hit){this.damage(hit,b,b.damage,component);b.life=0;}if(b.x<0||b.y<0||b.x>WORLD.width||b.y>WORLD.height)b.life=0;
  }this.bolts=this.bolts.filter(b=>b.life>0);
  for(const r of this.rockets){if(this.result)break;const ax=r.x,ay=r.y,travel=Math.min(r.distance,720*dt);r.x+=Math.cos(r.a)*travel;r.y+=Math.sin(r.a)*travel;r.distance-=travel;let hit=null;
   for(const s of collision.query(r.x,r.y,120))if(s.alive&&s.side!==r.side&&segmentDistance(s.x,s.y,ax,ay,r.x,r.y)<s.radius+5){hit=s;break;}
   if(hit||r.distance<=0){r.dead=true;this.events.push({type:'blast',x:r.x,y:r.y});for(const s of collision.query(r.x,r.y,120))if(s.side!==r.side&&s.alive&&distance(s,r)<110+s.radius){let t=null;if(s.turrets)t=[...s.turrets].sort((a,b)=>distance(this.turretPoint(s,a),r)-distance(this.turretPoint(s,b),r))[0];this.damage(s,r,s.kind==='artillery'?(t?60:240):18,t);}}
  }this.rockets=this.rockets.filter(r=>!r.dead);
  this.checkCharge();
  const blue=this.living(0).length,red=this.living(1).length,blueCommand=this.commandAlive(0),redCommand=this.commandAlive(1);
  if(!blueCommand&&!redCommand)this.finish('draw','BOTH COMMAND SHIPS DESTROYED');else if(!redCommand)this.finish('won','ENEMY COMMAND SHIP DESTROYED');else if(!blueCommand)this.finish('lost','COMMAND SHIP DESTROYED');
  else if(this.time>=RULES.battleDuration)this.finish(blue===red?'draw':blue>red?'won':'lost',blue===red?'TIME · FLEETS TIED':'TIME · FLEET ADVANTAGE');
  else if(!blue&&!red)this.finish('draw','BOTH FLEETS ELIMINATED');else if(!red)this.finish('won','RED FLEET ELIMINATED');else if(!blue)this.finish('lost','BLUE FLEET ELIMINATED');
 }
 snapshot(){return JSON.parse(JSON.stringify({...this,events:[]}));}
 static restore(d){
  // The first cargo release mislabeled fresh 418-ship saves as version 20.
  // Upgrade only the complete cargo shape; do not append a second merchant wave.
  if(d?.version===20&&d.ships?.length===418&&d.formations?.length===28)d={...d,version:21};
  const legacy=d?.version>=10&&d.version<=20,cargoSave=d?.version===21,modern=d?.version>=22&&d?.version<=25;
  if((!legacy&&!cargoSave&&!modern)||(legacy&&(d.ships?.length!==354||d.formations?.length!==20))||(cargoSave&&(d.ships?.length!==418||d.formations?.length!==28))||(modern&&(!Array.isArray(d.ships)||d.ships.length<402||d.ships.length>700||d.formations?.length!==(d.version===25?32:30)))||!Number.isFinite(d.time)||d.time<0||!Number.isInteger(d.playerId)||d.playerId<0||d.playerId>=d.ships.length)throw new Error('Saved battle belongs to a different version.');
  if(modern||cargoSave)d=JSON.parse(JSON.stringify(d));
  // Expand existing flights into the new sector without resetting progress, losses or paid rounds.
  if(d.version===10){d=JSON.parse(JSON.stringify(d));const shift=p=>{if(p){p.x+=900;p.y+=900;}};
   for(const s of d.ships){shift(s);shift(s.railEvade);if(s.routeEnd!==undefined)s.routeEnd+=900;}
   for(const f of d.formations){shift(f);shift(f.goal);shift(f.recall);if(f.decision?.x!==undefined)shift(f.decision);if(f.cx!==undefined){f.cx+=900;f.cy+=900;}}
   for(const b of d.bolts){shift(b);const old=Math.hypot(b.vx,b.vy)||1;b.vx*=RULES.boltSpeed/old;b.vy*=RULES.boltSpeed/old;b.life=Math.min(b.life,RULES.boltRange/RULES.boltSpeed);}
   for(const r of d.rockets)shift(r);d.version=11;
  }
  if(d.version===11){
   d=JSON.parse(JSON.stringify(d));
   // Preserve the damage fraction, casualties, lives, positions, score and paid epochs.
   for(const s of d.ships)if(s.kind!=='artillery'&&TYPES[s.kind]){const ratio=clamp(s.hp/s.maxHp,0,1);s.maxHp=TYPES[s.kind].hp;s.hp=s.alive?ratio*s.maxHp:0;s.boosting=false;const speed=Math.hypot(s.vx,s.vy);if(s.player&&speed>TYPES[s.kind].speed){s.vx*=TYPES[s.kind].speed/speed;s.vy*=TYPES[s.kind].speed/speed;}}
   for(const b of d.bolts)if(b.player){const speed=Math.hypot(b.vx,b.vy)||1;b.vx*=RULES.boltSpeed/speed;b.vy*=RULES.boltSpeed/speed;b.damage=TYPES.fighter.damage;b.heavy=false;b.life=Math.min(b.life,RULES.boltRange/RULES.boltSpeed);}
   d.version=12;
  }
  if(d.version===12){
   d=JSON.parse(JSON.stringify(d));
   // Bring the closer artillery route into an existing flight without moving a ship or resetting its guns.
   for(const s of d.ships)if(s.kind==='artillery'){
    const dir=s.side?1:-1;s.routeEnd=WORLD.height/2-dir*RULES.artilleryStandOff;
    s.arrived=dir*(s.routeEnd-s.y)<=0;s.vy=s.alive&&!s.arrived?dir*(TYPES.artillery.speed+(s.formation%10-6)):0;
   }
   d.version=13;
  }
  if(d.version===13){
   d=JSON.parse(JSON.stringify(d));
   // Retrofit indestructible guns, preserving every hull, casualty, cooldown and paid round.
   for(const s of d.ships)if(s.turrets)s.turrets=s.turrets.map(({hp,maxHp,...gun})=>gun);
   // An already-started final engagement remains underway; active battles still awaiting it use the new timing.
   d.version=14;
  }
  if(d.version===14){
   d=JSON.parse(JSON.stringify(d));
   // Enforce the shared fighter maximum on old flights without changing position or battle progress.
   for(const s of d.ships)if(s.alive&&s.kind==='fighter'){const speed=Math.hypot(s.vx,s.vy);if(speed>TYPES.fighter.speed){s.vx*=TYPES.fighter.speed/speed;s.vy*=TYPES.fighter.speed/speed;}}
   d.version=15;
  }
  if(d.version===15){
   d=JSON.parse(JSON.stringify(d));
   for(const s of d.ships)if(TYPES[s.kind]){const ratio=clamp(s.hp/s.maxHp,0,1);s.maxHp=TYPES[s.kind].hp;s.hp=s.alive?ratio*s.maxHp:0;}
   d.version=16;
  }
  if(d.version===16){
   d=JSON.parse(JSON.stringify(d));
   for(const s of d.ships)if(s.kind==='artillery'){
    const keep=[0,2,4,7];s.turrets=(s.turrets||[]).filter((_,i)=>keep.includes(i)).map((gun,i)=>({...gun,id:i,ox:TURRETS[i][0],oy:TURRETS[i][1]}));
    const dir=s.side?1:-1;s.routeEnd=WORLD.height/2-dir*RULES.artilleryStandOff;s.arrived=dir*(s.routeEnd-s.y)<=0;s.vy=s.alive&&!s.arrived?dir*(TYPES.artillery.speed+(s.formation%10-6)):0;
   }
   d.version=17;
  }
  if(d.version===17){
   d=JSON.parse(JSON.stringify(d));
   for(const s of d.ships)if(TYPES[s.kind]){const ratio=clamp(s.hp/s.maxHp,0,1);s.maxHp=TYPES[s.kind].hp;s.hp=s.alive?ratio*s.maxHp:0;if(s.kind==='artillery'){s.route=artilleryRoute(s.formation%10,s.side);s.arrived=distance(s,s.route)<2;s.vx=s.vy=0;}}
   d.version=18;
  }
  if(d.version===18){
   d=JSON.parse(JSON.stringify(d));
   for(const s of d.ships)if(s.kind==='artillery'){s.route=artilleryRoute(s.formation%10,s.side);s.arrived=distance(s,s.route)<2;if(!s.arrived){const dx=s.route.x-s.x,dy=s.route.y-s.y,distanceToRoute=Math.hypot(dx,dy)||1,speed=TYPES.artillery.speed+(s.formation%10-6);s.vx=dx/distanceToRoute*speed;s.vy=dy/distanceToRoute*speed;}}
   d.version=19;
  }
  if(d.version===19){
   d=JSON.parse(JSON.stringify(d));const scale=WORLD.width/10800,resize=p=>{if(p){p.x*=scale;p.y*=scale;}};
   for(const s of d.ships){resize(s);resize(s.railEvade);resize(s.route);if(s.kind==='artillery'){s.route=artilleryRoute(s.formation%10,s.side);s.arrived=distance(s,s.route)<2;}}
   for(const f of d.formations){resize(f);resize(f.goal);resize(f.recall);resize(f.decision);if(Number.isFinite(f.cx)){f.cx*=scale;f.cy*=scale;}}
   for(const b of d.bolts)resize(b);for(const r of d.rockets)resize(r);d.version=20;
  }
  if(d.version===20){
   d=JSON.parse(JSON.stringify(d));
   // Existing ships and formations retain their IDs and every saved field. The
   // new merchant wave is appended once; a completed battle stays completed.
   const merchantWave=new Battle(d.initialSeed??d.seed,{legacyRoster:true}),newShips=merchantWave.ships.slice(354,418),newFormations=merchantWave.formations.slice(20,28);
   if(d.result)for(const s of newShips){s.alive=false;s.hp=0;}
   d.ships.push(...newShips);d.formations.push(...newFormations);d.serial=418;d.version=21;
  }
  for(const key of ['decisionPending','orderNumber','nextRecall','decisionEpoch'])delete d[key];
  const b=Object.assign(Object.create(Battle.prototype),d);if(b.version===21){b.launchQueue=[];b.chargeAt=b.phase==='final'?b.time:null;b.addCavalryWings();b.version=22;}
  // Version 25: command ships and per-side admirals join an existing flight without moving a ship or resetting progress.
  if(!Array.isArray(b.admirals)||b.admirals.length!==2)b.admirals=[0,1].map(side=>Battle.freshAdmiral(side,Math.max(RULES.firstRecall,b.time+8)));
  for(const f of b.formations){if(f.orderGoal===undefined)f.orderGoal=null;if(f.orderSquare===undefined)f.orderSquare=null;if(f.finishing===undefined)f.finishing=null;if(f.recall&&f.state==='regroup'&&!Number.isFinite(f.drainAt))f.drainAt=b.time+RULES.regroup;}
  b.addCommandShips();for(const f of b.formations)if(!Number.isFinite(f.full))f.full=b.ships.filter(s=>s.formation===f.id).reduce((t,s)=>t+(WEIGHTS[s.kind]??1),0);
  b.version=25;for(const s of b.ships)if(!Number.isFinite(s.x)||!Number.isFinite(s.y)||!Number.isFinite(s.hp)||!TYPES[s.kind])throw new Error('Invalid saved ship.');b.events=[];b.updateGroups();b.updateVision();return b;
 }
}
