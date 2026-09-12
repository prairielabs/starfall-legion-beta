import {Battle,WORLD,TYPES,clamp,distance} from './simulation.js';
import * as arcade from './arcade.js';
import {Storage} from './storage.js';
import {ArcadeSound} from './sound.js';
import {Motion,FrameMeter,FIXED_STEP} from './render-timing.js';
const motion=new Motion(),frameMeter=new FrameMeter();
const sfx=new ArcadeSound();
const $=id=>document.getElementById(id),canvas=$('field'),ctx=canvas.getContext('2d',{alpha:false}),radar=$('radar'),rc=radar.getContext('2d');
let browserStorage;try{browserStorage=localStorage;}catch{browserStorage={getItem(){throw 0;},setItem(){throw 0;}};}const store=new Storage(browserStorage);
const C={blue:'#6ad9ff',red:'#ff647e',white:'#fff4d8',gold:'#ffdc7e',squad:'#7dff85'};
let battle=null,run=null,mode='opening',w=800,h=450,zoom=1,zoomFactor=1,map=false,camera={x:1750,y:7500},keys=new Set(),mouse={aim:null,fire:false},touch={x:0,y:0,fire:false};
let localDiagnostics=false,diagnosticAt=0,perfAt=0,renderAlpha=1,renderTime=0,pendingSave=null,spectatorDrag=null,spectatorShipId=null;
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
const fogCanvas=document.createElement('canvas');fogCanvas.width=fogCanvas.height=360;const fogContext=fogCanvas.getContext('2d',{alpha:false});
let fogAt=-1,contactSource=null,visibleIds=new Set(),renderFriends=[],friendsAt=-1;
let last=performance.now(),acc=0,hudAt=0,saveAt=0,noticeUntil=0,particles=[],effects=[],rewards=[],muted=false,shake=0,recoil=0,hitConfirm=0,killChain=0,lastKillAt=-99,requestGeneration=0,lastShotSound=0,busy=false,scoreRecord=null,lastPadButtons=[],perf={frames:0,frameMs:[],stepMs:[],drawMs:[]};
const stars=Array.from({length:4000},(_,i)=>({x:(i*7919)%WORLD.width,y:(i*3571)%WORLD.height,b:i%13}));
function resize(){const rect=$('cabinet').getBoundingClientRect();w=canvas.width=Math.ceil(rect.width/1.6);h=canvas.height=Math.ceil(rect.height/1.6);ctx.imageSmoothingEnabled=false;const fit=Math.min(rect.width/320,rect.height/256);$('title-stage').style.setProperty('--title-scale',fit>=2?Math.floor(fit):fit);}
new ResizeObserver(resize).observe($('cabinet'));resize();
const baseZoom=()=>w<h?w/540:Math.min(w/820,h/510);
function activeUI(show){for(const id of ['hud','pilot-hud','minimap','touch-controls'])$(id).hidden=!show;}
function resetInput(){keys.clear();mouse.fire=false;spectatorDrag=null;touch={x:0,y:0,fire:false};$('touch-pad').firstElementChild.style.transform='';}
function soundInit(){const task=sfx.unlock();paintSound();return task.then(paintSound);}
function signal(){sfx.signal();}
for(const button of document.querySelectorAll('.audio-credits-open'))button.onclick=()=>$('audio-credits').showModal();
function announce(t,d=3){$('notice').textContent=t;noticeUntil=(battle?.time||0)+d;}
function status(t){$('entry-status').textContent=t;}
function paintEntry(){const s=arcade.state().session;const ready=!!s?.authorized;$('opening').dataset.ready=String(ready);$('opening-credit').textContent='ON';$('code-form').hidden=ready;$('start').hidden=!ready;$('start').textContent=s?.activeRun?'CONTINUE GAME':'PUSH START';if(ready)status('FREE ARCADE · NO CODE REQUIRED');if(s?.authorized&&!ready)status('ACCESS COMPLETE · INSERT ANOTHER CODE');$('opening-best').textContent=String(store.scores()[0]?.score||0).padStart(6,'0');}
async function activate(e){e?.preventDefault();if(busy)return;busy=true;$('enter-code').disabled=true;status('CHECKING CODE…');try{await arcade.activate($('code').value.trim());$('code').value='';paintEntry();$('start').focus();}catch(e){status(e.message);}finally{busy=false;$('enter-code').disabled=false;}}
$('code-form').onsubmit=activate;
let codeTimer=null,lastAutoCode='';
function autoCode(){clearTimeout(codeTimer);const code=$('code').value.trim().toUpperCase();if(code!==lastAutoCode)lastAutoCode='';if(!/^[A-Z0-9]{6}$/.test(code)||code===lastAutoCode)return;codeTimer=setTimeout(()=>{if(busy||$('code-form').hidden||!arcade.state().config)return;lastAutoCode=code;void activate();},250);}
$('code').addEventListener('input',autoCode);$('code').addEventListener('change',autoCode);window.addEventListener('pageshow',autoCode);
async function launchTransition(){const screen=$('launch-transition');screen.hidden=true;void screen.offsetWidth;screen.hidden=false;$('opening').hidden=true;if(reducedMotion.matches){await new Promise(resolve=>setTimeout(resolve,500));}else{await new Promise(resolve=>setTimeout(resolve,1250));}screen.hidden=true;}
async function start(){if(busy)return;busy=true;soundInit();$('start').disabled=true;$('again').disabled=true;try{
 const next=await arcade.start();let b;const saved=store.flight(next.id);if(saved&&!saved.result)b=Battle.restore(saved);else b=new Battle(next.seed);
 run=next;battle=b;motion.reset(b);frameMeter.reset();fogAt=-1;friendsAt=-1;contactSource=null;requestGeneration++;mode='launching';map=false;spectatorShipId=null;zoomFactor=1;camera={x:b.viewShip.x,y:b.viewShip.y-80};particles=[];effects=[];rewards=[];recoil=0;hitConfirm=0;killChain=0;lastKillAt=-99;acc=0;saveAt=0;resetInput();mouse.aim=null;
 $('ending').hidden=true;$('pause-screen').hidden=true;activeUI(false);signal();await launchTransition();mode='playing';activeUI(true);$('boundary').hidden=true;announce('',0);canvas.focus();syncHUD();
 if(b.decisionPending)void requestOrders();
 }catch(e){status(e.message);$('result-note').textContent=e.message;}finally{busy=false;$('start').disabled=false;$('again').disabled=false;}}
$('start').onclick=$('again').onclick=start;
function save(){if(battle&&run){store.save(run,battle.snapshot());$('save-status').textContent=store.available?'Flight saved on this device.':'Device storage unavailable. Keep this tab open to preserve your flight.';}}
function queueSave(){if(pendingSave!==null)return;const generation=requestGeneration;const task=()=>{pendingSave=null;if(generation===requestGeneration&&mode==='playing')save();};pendingSave=window.requestIdleCallback?requestIdleCallback(task,{timeout:750}):setTimeout(task,0);}
function pause(value){if(!['playing','paused'].includes(mode))return;mode=value?'paused':'playing';sfx.update(mode);$('pause-screen').hidden=!value;resetInput();acc=0;renderAlpha=1;frameMeter.reset();save();if(!value){soundInit();canvas.focus();}}
$('pause').onclick=()=>pause(true);$('resume').onclick=()=>pause(false);$('end-flight').onclick=()=>{if(battle){battle.finish('retired','FLIGHT ENDED');handleEvents();}};
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('cabinet').requestFullscreen();}catch{$('save-status').textContent='Fullscreen is unavailable here. The game still fits this window.';}};
function paintSound(){for(const id of ['sound','pause-sound','battle-sound']){const button=$(id),label=muted?'ENABLE SOUND':sfx.loading?'LOADING SOUND':sfx.error?'RETRY SOUND':'MUTE SOUND';if(button.textContent!==label)button.textContent=label;button.setAttribute('aria-pressed',String(!muted));button.title=muted?'Enable sound (M)':sfx.error||'Mute sound (M)';}}
function mute(){muted=!muted;sfx.setMuted(muted);paintSound();try{browserStorage.setItem('starfall-sound',muted?'off':'on');}catch{}}
try{muted=browserStorage.getItem('starfall-sound')==='off';}catch{}sfx.setMuted(muted);paintSound();for(const id of ['sound','pause-sound','battle-sound'])$(id).onclick=()=>{if(!sfx.error||muted)mute();void soundInit().then(()=>{if(!muted)sfx.signal();});canvas.focus();};
function spectatorShips(){return battle?battle.living(0).sort((a,b)=>a.id-b.id):[];}
function cycleSpectator(){const alive=spectatorShips();if(!alive.length){spectatorShipId=null;map=true;syncHUD();return;}if(map||spectatorShipId===null){spectatorShipId=alive[0].id;map=false;}else{const index=alive.findIndex(ship=>ship.id===spectatorShipId);if(index<0||index<alive.length-1)spectatorShipId=alive[Math.max(0,index+1)].id;else{spectatorShipId=null;map=true;}}syncHUD();canvas.focus();}
function toggleMap(){if(!battle)return;if(battle.spectating){cycleSpectator();return;}map=!map;syncHUD();canvas.focus();}
const sectorZoom=()=>Math.min((w-36)/WORLD.width,(h-155)/WORLD.height);
function freeSpectatorView(){if(battle?.spectating){if(map)zoomFactor=sectorZoom()/baseZoom();map=false;spectatorShipId=null;}}
function panSpectator(x,y){camera.x=clamp(camera.x+x,0,WORLD.width);camera.y=clamp(camera.y+y,0,WORLD.height);}
function changeZoom(factor){if(battle?.spectating)freeSpectatorView();else map=false;zoomFactor=clamp(zoomFactor*factor,battle?.spectating?Math.min(.45,sectorZoom()/baseZoom()):.45,2.1);}
$('minimap').onclick=toggleMap;
window.addEventListener('keydown',e=>{if($('audio-credits').open||e.target?.matches?.('input'))return;if(mode==='playing'&&['Space','Tab','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();if(e.repeat){keys.add(e.code);return;}if(e.code==='Tab'&&mode==='playing'){toggleMap();return;}if(e.code==='Escape'||e.code==='KeyP'){pause(mode!=='paused');return;}if(e.code==='KeyM'){soundInit();mute();}if(mode==='playing'&&e.code==='Space')soundInit();if(e.code==='Enter'&&mode==='opening'&&!$('start').hidden)void start();if(e.code==='Equal')changeZoom(1.25);if(e.code==='Minus')changeZoom(1/1.25);keys.add(e.code);});
window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>pause(true));document.addEventListener('visibilitychange',()=>{if(document.hidden){pause(true);sfx.update('paused');}});window.addEventListener('pagehide',save);
canvas.onpointermove=e=>{const r=canvas.getBoundingClientRect();if(spectatorDrag?.id===e.pointerId&&battle?.spectating&&mode==='playing'){panSpectator((spectatorDrag.x-e.clientX)/r.width*w/zoom,(spectatorDrag.y-e.clientY)/r.height*h/zoom);spectatorDrag.x=e.clientX;spectatorDrag.y=e.clientY;return;}if(e.pointerType==='touch'||!battle?.player.alive||map)return;const p=entityScreen(battle.player);mouse.aim=Math.atan2((e.clientY-r.top)/r.height*h-p.y,(e.clientX-r.left)/r.width*w-p.x);};
canvas.onpointerdown=e=>{if(battle?.spectating&&mode==='playing'&&e.button===0){e.preventDefault();freeSpectatorView();spectatorDrag={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);canvas.focus();return;}if(e.pointerType==='touch')return;soundInit();canvas.focus();if(e.button===0)mouse.fire=true;};
window.addEventListener('pointerup',()=>{mouse.fire=false;spectatorDrag=null;});canvas.onpointercancel=canvas.onlostpointercapture=()=>{mouse.fire=false;spectatorDrag=null;};canvas.oncontextmenu=e=>e.preventDefault();canvas.onwheel=e=>{e.preventDefault();changeZoom(Math.exp(-e.deltaY*.001));};
const pad=$('touch-pad');let padId=null;function movePad(e){const r=pad.getBoundingClientRect(),x=(e.clientX-r.left-r.width/2)/(r.width*.35),y=(e.clientY-r.top-r.height/2)/(r.height*.35),l=Math.max(1,Math.hypot(x,y));touch.x=x/l;touch.y=y/l;pad.firstElementChild.style.transform=`translate(${touch.x*33}px,${touch.y*33}px)`;mouse.aim=null;}
pad.onpointerdown=e=>{e.preventDefault();padId=e.pointerId;pad.setPointerCapture(padId);movePad(e);soundInit();};pad.onpointermove=e=>{if(e.pointerId===padId)movePad(e);};pad.onpointerup=pad.onpointercancel=()=>{padId=null;touch.x=touch.y=0;pad.firstElementChild.style.transform='';};
for(const [id,key] of [['touch-fire','fire']]){$(id).onpointerdown=e=>{e.preventDefault();$(id).setPointerCapture(e.pointerId);touch[key]=true;soundInit();};$(id).onpointerup=$(id).onpointercancel=()=>{touch[key]=false;};}
function input(){let x=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0)+touch.x,y=(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-(keys.has('KeyW')||keys.has('ArrowUp')?1:0)+touch.y;let fire=keys.has('Space')||mouse.fire||touch.fire,aim=mouse.aim??-Math.PI/2;
 const gp=navigator.getGamepads?.()?.find(p=>p?.connected);if(gp){const dz=n=>Math.abs(n||0)>.18?n:0;x+=dz(gp.axes[0]);y+=dz(gp.axes[1]);const ax=dz(gp.axes[2]),ay=dz(gp.axes[3]);if(Math.hypot(ax,ay)>.2)aim=Math.atan2(ay,ax);fire||=gp.buttons[0]?.pressed||gp.buttons[7]?.pressed;const b=gp.buttons.map(b=>b.pressed);if(b[9]&&!lastPadButtons[9])pause(true);if(b[8]&&!lastPadButtons[8])toggleMap();lastPadButtons=b;}
 return{x,y,fire,aim};}
async function requestOrders(){if(!run||!battle)return;const b=battle,generation=requestGeneration;await Promise.allSettled([0,1].map(async side=>{const snap=b.decisionSnapshot(side);try{const r=await arcade.decisions(run,snap);if(generation===requestGeneration&&battle===b&&!b.result){const accepted=b.acceptOrders(snap,r.orders,r.source);if(!accepted)b.inference.status='late orders · standing orders';syncHUD();}}catch{if(generation===requestGeneration&&battle===b&&!b.result){b.inference.status='signal unavailable · standing orders';syncHUD();}}}));}
function localEffect(e){return battle?.visiblePoint?battle.visiblePoint(e):Math.hypot(e.x-camera.x,e.y-camera.y)<Math.max(w,h)/zoom;}
function pulseScore(kill){const box=$('score').parentElement,kind=kill?'reward-kill':'reward-hit';box.classList.remove('reward-hit','reward-kill');void box.offsetWidth;box.classList.add(kind);}
function reward(e){if(!e.points)return;const kill=e.type==='explosion';if(kill){killChain=battle.time-lastKillAt<4.5?killChain+1:1;lastKillAt=battle.time;}const local=localEffect(e),label=e.assist?'ASSIST':kill?(e.targetKind==='cargo'?'CARGO DOWN':e.large?'FORTRESS DOWN':`${String(e.targetKind||'fighter').toUpperCase()} DOWN`):e.popped?'SHIELD BREAK':'HIT';rewards.push({x:e.x,y:e.y,life:kill?1.25:.72,max:kill?1.25:.72,points:e.points,label,kill,combo:kill?killChain:0,local});pulseScore(kill);const pan=local?clamp((e.x-camera.x)*zoom/(w/2),-1,1):0;sfx.reward({kill,big:e.large,combo:killChain,pan});}
function handleEvents(){for(const e of battle.events){
 if(e.type==='recall'){announce('RECALL · GREEN DIAMOND',4);signal();void requestOrders();}
 if(e.type==='final'){announce('FORTRESSES IN POSITION\nFINAL ENGAGEMENT',4);signal();}
 if(e.type==='respawn'){camera={x:e.x,y:e.y-70};announce(`${battle.lives} LIVES · NEW FIGHTER`,3);signal();}
 if(e.type==='spectate'){resetInput();spectatorShipId=null;map=true;announce('SPECTATING · TAB CYCLES SURVIVORS',5);syncHUD();}
 if(e.type==='end'){syncHUD();void end();continue;}
 if(e.type==='shot'){if(e.player){sfx.cannon(true,0,1,e.burst===2);recoil=e.burst===2?5:4;shake=Math.max(shake,.7);effects.push({...e,type:'muzzle',life:.075,max:.075});}else if(localEffect(e)&&battle.time-lastShotSound>.12){const pan=clamp((e.x-camera.x)*zoom/(w/2),-1,1);sfx.cannon(false,pan,.5);lastShotSound=battle.time;effects.push({...e,type:'muzzle',life:.06,max:.06});}continue;}
 if(e.type==='rail'){const p=battle.player;if(p&&Math.abs(e.x-p.x)<700){sfx.rail();shake=4;}continue;}
 if(e.points)reward(e);
 if(['hit','shield','explosion','component','blast','rocket'].includes(e.type)&&localEffect(e)){
  const big=['explosion','blast'].includes(e.type),color=e.side?C.red:C.blue;
  effects.push({...e,life:big?.6:e.popped?.35:.22,max:big?.6:e.popped?.35:.22});if(e.player)shake=big?8:2;
  const count=big?(e.large?45:22):e.type==='component'?20:e.fromPlayer?12:4;for(let i=0;i<count;i++){const a=Math.random()*Math.PI*2,v=30+Math.random()*(big?240:100);particles.push({x:e.x,y:e.y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:.2+Math.random()*.6,color:i%3===0?C.gold:color});}
  const pan=clamp((e.x-camera.x)*zoom/(w/2),-1,1);if(big){sfx.explosion(e.large||e.type==='blast',pan,e.fromPlayer);if(e.fromPlayer)shake=Math.max(shake,3);}else if(e.fromPlayer||e.player)sfx.impact(e.type==='shield',e.popped,pan);if(e.fromPlayer){hitConfirm=e.type==='explosion'?.3:.12;}
  if(e.player&&e.type==='explosion'&&battle.lives>0)announce(`FIGHTER LOST · ${battle.lives} LIVES`,2.2);
 }
}battle.events=[];}
function board(){const rows=store.scores(),list=$('leaderboard');list.replaceChildren();for(let i=0;i<5;i++){const r=rows[i],li=document.createElement('li');if(r?.id===scoreRecord?.id)li.className='new';for(const value of [String(i+1).padStart(2,'0'),r?.name||'---',r?String(r.score).padStart(6,'0'):'------']){const span=document.createElement('span');span.textContent=value;li.append(span);}list.append(li);}}
async function end(){if(mode==='ended')return;const endedBattle=battle,endedRun=run;mode='ended';sfx.update(mode);sfx.ending(battle.result==='won');requestGeneration++;resetInput();save();activeUI(false);$('pause-screen').hidden=true;$('boundary').hidden=true;$('notice').textContent='';$('ending').hidden=false;$('end-title').textContent=battle.result==='won'?'SECTOR CLEAR':battle.result==='draw'?'DRAW':'GAME OVER';$('end-reason').textContent=battle.reason||'FLIGHT COMPLETE';$('final-score').textContent=String(battle.score).padStart(6,'0');$('end-stats').textContent=`${battle.kills} KILLS · ${formatTime(battle.time)} · ${battle.living(0).length} BLUE / ${battle.living(1).length} RED SHIPS LEFT`;scoreRecord={id:run.id,name:'YOU',score:battle.score,seconds:Math.round(battle.time),result:battle.result};store.score(scoreRecord);board();$('name-entry').hidden=!store.scores().some(s=>s.id===run.id);$('save-score').disabled=false;$('result-note').textContent=store.available?'Scores stay on this device.':'Storage unavailable. Scores last for this tab only.';$('initials').value='YOU';try{const receipt=await arcade.finish(endedRun.id,endedBattle.result,endedBattle.score);if(run===endedRun&&mode==='ended'){$('end-stats').textContent=`${endedBattle.kills} KILLS · ${formatTime(endedBattle.time)} · ${endedBattle.living(0).length} BLUE / ${endedBattle.living(1).length} RED SHIPS LEFT`;if(store.available)$('result-note').textContent='FREE ARCADE · SCORES STAY ON THIS DEVICE';}}catch{$('result-note').textContent='Result saved here. Reconnecting before the next flight…';}}
$('save-score').onclick=()=>{if(!scoreRecord)return;scoreRecord.name=$('initials').value;store.score(scoreRecord);board();$('save-score').disabled=true;};
$('close').onclick=()=>{mode='opening';$('ending').hidden=true;$('opening').hidden=false;activeUI(false);arcade.init().then(paintEntry).catch(e=>status(e.message));paintEntry();};
const formatTime=t=>`${String(Math.floor(t/60)).padStart(2,'0')}:${String(Math.floor(t%60)).padStart(2,'0')}`;
function paintCard(){$('card-balance')?.remove();}

function syncHUD(){if(!battle)return;paintCard();const p=battle.player,f=battle.squad(),watched=battle.ships.find(ship=>ship.id===spectatorShipId);$('score').textContent=String(battle.score).padStart(6,'0');$('blue-count').textContent=battle.living(0).length;$('red-count').textContent=battle.living(1).length;$('blue-count').title='All surviving blue ships';$('red-count').title='All surviving red ships';$('timer').textContent=formatTime(battle.time);$('map-label').textContent=battle.spectating?(map?'NEXT SHIP · TAB':watched?.alive?`${watched.kind.toUpperCase()} ${watched.id+1} · TAB`:'NEXT SHIP · TAB'):map?'RETURN TO FLIGHT':'SECTOR · TAB';$('token-count').textContent='FREE ARCADE';$('pilot-hud').classList.toggle('spectating',battle.spectating);$('touch-controls').hidden=battle.spectating;$('lives').textContent=battle.spectating?'SPECTATING':Array.from({length:3},(_,i)=>i<battle.lives?'▲':'△').join(' ');$('hull').value=p.alive?p.hp/p.maxHp:0;$('shield').textContent=(p.shield>0?'●':'○')+' '+(p.shield>1?'●':'○');$('boundary').hidden=!(p.alive&&p.outside>0);if(p.outside>0)$('boundary').textContent=`RETURN TO SECTOR · ${Math.ceil(5-p.outside)}`;}
// Original functional pixel sprites: each class has its own silhouette and hardware.
const FIGHTER=['.......11.......','.......22.......','...1..1221..1...','...1..1221..1...','..11.112211.11..','1111112332111111','11.1112332111.11','1..1112332111..1','...1111111111...','...11..11..11...','...11..11..11...','....4......4....'];
const RED=['..11........11..','..21...11...12..','..21..1221..12..','..211112211112..','..211123321112..','..211123321112..','..211112211112..','..21..1111..12..','..21...11...12..','..11........11..','...4........4...'];
const SCOUT=['.......11.......','......1221......','......1331......','.....112211.....','....11222211....','..111122221111..','..11..1221..11..','......1221......','......1..1......','......4..4......'];
const CAV=['........11........','.......1221.......','......112211......','.....11233211.....','....1122332211....','...112223322211...','..11222233222211..','.1122222332222211.','111222223322222111','11.111223322111.11','1...1122222211...1','.....11111111.....','.....44....44.....'];
const CARGO=['....222222222....','...21111111112...','..2113333333112..','.211333333333112.','21133333333333112','21133333333333112','.211333333333112.','..2113333333112..','...21111111112...','....222222222....','......44..44......'];
function sprite(rows,side,player=false){const c=document.createElement('canvas');c.width=Math.max(...rows.map(r=>r.length));c.height=rows.length;const g=c.getContext('2d'),pal=player?['#c18b35','#fff4d8','#65dbff','#ffdc7e']:side?['#823c59','#e86277','#ffe4ba','#f0a455']:['#395c87','#70bbd7','#f1ead1','#f6b95a'];rows.forEach((r,y)=>[...r].forEach((p,x)=>{if(p!=='.'){g.fillStyle=pal[+p-1];g.fillRect(x,y,1,1);}}));return c;}
function cargoSprite(side){const c=document.createElement('canvas');c.width=Math.max(...CARGO.map(r=>r.length));c.height=CARGO.length;const g=c.getContext('2d'),pal=side?['#2e3a48','#c6d1d4','#80919a','#cf5f68']:['#2e3a48','#c6d1d4','#80919a','#4f9fc5'];CARGO.forEach((r,y)=>[...r].forEach((p,x)=>{if(p!=='.'){g.fillStyle=pal[+p-1];g.fillRect(x,y,1,1);}}));return c;}
const sprites=[0,1].map(side=>({fighter:sprite(side?RED:FIGHTER,side),scout:sprite(SCOUT,side),cavalry:sprite(CAV,side),cargo:cargoSprite(side)}));
function fortress(side){const c=document.createElement('canvas');c.width=96;c.height=76;const g=c.getContext('2d'),color=side?'#be5a66':'#529ac0',r=(x,y,w,h,col)=>{g.fillStyle=col;g.fillRect(x,y,w,h);};r(42,2,12,18,'#cdd8dc');r(38,16,20,14,'#718295');r(18,27,60,34,'#3d4c60');r(10,35,76,19,'#65788a');r(4,42,88,9,'#aebac2');r(15,54,66,12,'#344555');r(23,27,50,28,'#8798a4');r(30,31,36,20,'#d0d7d8');r(42,31,12,20,color);r(44,35,8,7,'#d9f8ff');r(7,47,12,8,'#263846');r(77,47,12,8,'#263846');for(const x of [18,70]){r(x,20,8,17,'#384b5d');r(x+2,13,4,17,'#d5d9d5');}for(const x of [31,59]){r(x,56,7,13,'#495c6e');r(x+1,67,5,6,color);}for(const x of [29,37,53,61])r(x,47,4,4,'#eef3ed');r(31,69,34,4,'#263846');return c;}
const fortressArt=[fortress(0),fortress(1)],playerArt=sprite(FIGHTER,0,true);
function screen(x,y){return{x:(x-camera.x)*zoom+w/2,y:(y-camera.y)*zoom+h/2};}
const pose=s=>motion.at(s,renderAlpha);
function entityScreen(s){const p=pose(s);return screen(p.x,p.y);}
function renderVisible(s){return s.alive&&(s.side===0||visibleIds.has(s.id));}
function text(value,x,y,color=C.white,size=8,align='center'){ctx.font=`bold ${size}px monospace`;ctx.textAlign=align;ctx.fillStyle='#03050a';ctx.fillText(value,Math.round(x)+1,Math.round(y)+1);ctx.fillStyle=color;ctx.fillText(value,Math.round(x),Math.round(y));}
function line(ax,ay,bx,by,color,width=1){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(Math.round(ax),Math.round(ay));ctx.lineTo(Math.round(bx),Math.round(by));ctx.stroke();}
function refreshFog(){
 const epoch=Math.floor(battle.tick/3);if(epoch===fogAt)return;fogAt=epoch;const g=fogContext,size=360;g.fillStyle='#060d19';g.fillRect(0,0,size,size);g.fillStyle='#132335';
 for(const s of renderFriends){g.beginPath();g.arc(s.x/WORLD.width*size,s.y/WORLD.height*size,TYPES[s.kind].vision/WORLD.width*size,0,Math.PI*2);g.fill();}
}
function fog(g,size){g.drawImage(fogCanvas,0,0,size,size);}
function squadMember(s){return s.side===0&&s.formation===battle.player.formation;}
function drawMap(){
 const size=radar.clientWidth,dpr=Math.min(devicePixelRatio||1,3),pixels=Math.round(size*dpr);
 if(radar.width!==pixels||radar.height!==pixels){radar.width=radar.height=pixels;}
 rc.setTransform(dpr,0,0,dpr,0,0);rc.imageSmoothingEnabled=true;fog(rc,size);rc.strokeStyle='#233447';rc.lineWidth=1/dpr;
 for(let n=1;n<4;n++){const pos=n*size/4;rc.beginPath();rc.moveTo(pos,0);rc.lineTo(pos,size);rc.moveTo(0,pos);rc.lineTo(size,pos);rc.stroke();}
 const unit=WORLD.width/size,shown=battle.ships.filter(s=>renderVisible(s)).sort((a,b)=>Number(squadMember(a))-Number(squadMember(b))||Number(a.player)-Number(b.player));
 for(const s of shown){rc.fillStyle=s.player?C.gold:squadMember(s)?C.squad:s.kind==='cargo'?'#c6d1d4':s.side?C.red:C.blue;const n=s.kind==='artillery'?4:s.kind==='cargo'?3:squadMember(s)?3.5:1.5;rc.fillRect(Math.round(pose(s).x/unit*dpr)/dpr-n/2,Math.round(pose(s).y/unit*dpr)/dpr-n/2,n,n);}
 const p=battle.player;if(p.alive){rc.strokeStyle=C.gold;rc.lineWidth=1;rc.strokeRect(pose(p).x/unit-4,pose(p).y/unit-4,8,8);}
 if(!map){rc.strokeStyle='#b2c7cf';rc.lineWidth=1/dpr;rc.strokeRect((camera.x-w/zoom/2)/unit,(camera.y-h/zoom/2)/unit,w/zoom/unit,h/zoom/unit);}
}

function drawEnemyIndicators(){
 if(map||battle.spectating)return;
 const left=18,right=w-18,top=64,bottom=h-36,cx=w/2,cy=h/2,groups=new Map();
 for(const s of battle.ships){if(!s.alive||s.side===0||!visibleIds.has(s.id)||distance(camera,s)>5000)continue;const p=entityScreen(s);if(p.x>=left&&p.x<=right&&p.y>=top&&p.y<=bottom)continue;const a=Math.atan2(p.y-cy,p.x-cx),bucket=(Math.round((a+Math.PI)/(Math.PI/8))+16)%16,group=groups.get(bucket)||{x:0,y:0,count:0};group.x+=Math.cos(a);group.y+=Math.sin(a);group.count++;groups.set(bucket,group);}
 ctx.save();for(const group of groups.values()){const a=Math.atan2(group.y,group.x),ux=Math.cos(a),uy=Math.sin(a),tx=ux>0?(right-cx)/ux:ux<0?(left-cx)/ux:Infinity,ty=uy>0?(bottom-cy)/uy:uy<0?(top-cy)/uy:Infinity,t=Math.min(tx,ty),x=cx+ux*t,y=cy+uy*t,alpha=.18+.7*(1-Math.exp(-group.count/3)),size=4+Math.min(3,group.count*.4),px=-uy,py=ux;ctx.globalAlpha=alpha;ctx.fillStyle=C.red;ctx.beginPath();ctx.moveTo(x+ux*size,y+uy*size);ctx.lineTo(x-ux*size+px*size*.7,y-uy*size+py*size*.7);ctx.lineTo(x-ux*size-px*size*.7,y-uy*size-py*size*.7);ctx.closePath();ctx.fill();}ctx.restore();
}

function draw(){renderTime=battle?Math.max(0,battle.time-(1-renderAlpha)*FIXED_STEP):0;ctx.fillStyle='#02040a';ctx.fillRect(0,0,w,h);if(!battle)return;
 if(contactSource!==battle.contacts[0]){contactSource=battle.contacts[0];visibleIds=new Set(contactSource);}if(friendsAt!==battle.tick){friendsAt=battle.tick;renderFriends=battle.living(0);}refreshFog();
 zoom=map?Math.min((w-36)/WORLD.width,(h-155)/WORLD.height):baseZoom()*zoomFactor;
 if(map)camera={x:WORLD.width/2,y:WORLD.height/2};
 if(map){const edge=screen(0,0);ctx.drawImage(fogCanvas,edge.x,edge.y,WORLD.width*zoom,WORLD.height*zoom);}
 for(const s of stars){if(map&&s.b%4)continue;const x=(s.x-camera.x)*zoom+w/2,y=(s.y-camera.y)*zoom+h/2;if(x<0||y<0||x>w||y>h)continue;ctx.fillStyle=s.b===0?'#c4cdd0':s.b<3?'#6e8094':'#293547';ctx.fillRect(Math.round(x),Math.round(y),1,1);}
 const edge=screen(0,0);ctx.strokeStyle='#3b596b';ctx.setLineDash([4,8]);ctx.strokeRect(edge.x,edge.y,WORLD.width*zoom,WORLD.width*zoom);ctx.setLineDash([]);
 ctx.save();if(map){ctx.beginPath();ctx.rect(edge.x,edge.y,WORLD.width*zoom,WORLD.width*zoom);ctx.clip();}if(shake>.1&&!map&&!reducedMotion.matches)ctx.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake);
 for(const s of battle.ships){const rail=battle.railState(s);if(!rail)continue;const q=pose(s),p=screen(q.x,q.y),end=screen(q.x+Math.cos(rail.a)*13000,q.y+Math.sin(rail.a)*13000),color=s.side?C.red:C.blue;
  if(rail.active){line(p.x,p.y,end.x,end.y,color,Math.max(3,44*zoom));line(p.x,p.y,end.x,end.y,C.white,Math.max(1,22*zoom));}
  else {ctx.globalAlpha=.35+.25*Math.sin(battle.time*15);line(p.x,p.y,end.x,end.y,color,Math.max(1,44*zoom));ctx.globalAlpha=1;ctx.setLineDash([8,6]);line(p.x,p.y,end.x,end.y,color,1);ctx.setLineDash([]);if(!map&&Math.abs(s.x-battle.player.x)<w/zoom*.6)text(`RAIL ${rail.seconds.toFixed(1)}`,clamp(p.x,55,w-55),h*.25,C.gold,9);}
 }
 for(const b of battle.bolts){const p=entityScreen(b);if(p.x<0||p.y<0||p.x>w||p.y>h)continue;const visible=b.side===0||renderFriends.some(s=>(s.x-b.x)**2+(s.y-b.y)**2<TYPES[s.kind].vision**2);if(!visible)continue;const a=Math.atan2(b.vy,b.vx),len=(b.heavy?Math.max(13,38*zoom):Math.max(5,19*zoom))*(b.visualScale??1),tx=p.x-Math.cos(a)*len,ty=p.y-Math.sin(a)*len;if(b.heavy){line(p.x,p.y,tx,ty,'#f69538',Math.max(4,7*zoom));line(p.x,p.y,tx,ty,C.gold,Math.max(2,4*zoom));line(p.x,p.y,p.x-Math.cos(a)*len*.75,p.y-Math.sin(a)*len*.75,C.white,1);}else {line(p.x,p.y,tx,ty,b.light?(b.side?'#ffbcb0':'#bbebff'):b.player?C.gold:b.side?C.red:C.blue,b.player?4*(b.visualScale??1):3);line(p.x,p.y,p.x-Math.cos(a)*len*.6,p.y-Math.sin(a)*len*.6,C.white,1);}}
 for(const r of battle.rockets){const p=entityScreen(r);for(let i=0;i<3;i++){const off=Math.sin(renderTime*28+i*2.1)*4;line(p.x-Math.sin(r.a)*off,p.y+Math.cos(r.a)*off,p.x-Math.cos(r.a)*18-Math.sin(r.a)*off,p.y-Math.sin(r.a)*18+Math.cos(r.a)*off,i===0?C.white:C.gold,1);}}
 for(const s of battle.ships){if(!renderVisible(s))continue;const q=pose(s),p=screen(q.x,q.y);if(s.player&&!map){p.x-=Math.cos(q.a)*recoil*zoom;p.y-=Math.sin(q.a)*recoil*zoom;}if(p.x<-90||p.y<-90||p.x>w+90||p.y>h+90)continue;const color=s.side?C.red:C.blue;
  if(map){ctx.fillStyle=s.player?C.gold:squadMember(s)?C.squad:s.kind==='cargo'?'#c6d1d4':color;const n=s.kind==='artillery'?5:s.kind==='cargo'?3:squadMember(s)?4:2;ctx.fillRect(Math.round(p.x)-n/2,Math.round(p.y)-n/2,n,n);continue;}
  const art=s.player?playerArt:s.kind==='artillery'?fortressArt[s.side]:sprites[s.side][s.kind],size=(s.kind==='artillery'?125:s.kind==='cargo'?72:s.kind==='cavalry'?42:s.kind==='scout'?31:s.player?34:29)*zoom,angle=q.a+Math.PI/2;
  ctx.save();ctx.translate(Math.round(p.x),Math.round(p.y));ctx.rotate(angle);
  if(s.kind!=='artillery'&&Math.hypot(s.vx,s.vy)>25){ctx.fillStyle=s.boosting?C.white:s.side?'#f89b67':'#548eb8';const flame=(s.boosting?28:10+Math.sin(renderTime*40+s.id)*3)*zoom;ctx.fillRect(-size*.23,size*.32,Math.max(1,size*.11),flame);ctx.fillRect(size*.12,size*.32,Math.max(1,size*.11),flame);}
  ctx.drawImage(art,-size/2,-size/2,size,size);if(s.flash>0){ctx.globalAlpha=s.flash*2;ctx.fillStyle=C.white;ctx.fillRect(-size*.25,-size*.3,size*.5,size*.6);ctx.globalAlpha=1;}ctx.restore();
  if(s.kind==='artillery'){
   for(const t of s.turrets){const tp=battle.turretPoint(pose(s),t),q=screen(tp.x,tp.y),n=Math.max(3,12*zoom);ctx.fillStyle=t.flash>0?C.white:color;ctx.fillRect(Math.round(q.x-n/2),Math.round(q.y-n/2),n,n);ctx.fillStyle=C.white;ctx.fillRect(Math.round(q.x),Math.round(q.y)-n/2-3,1,4);}
   const bw=Math.max(72,size*1.05),y=p.y-size*.55;ctx.fillStyle='#222b38';ctx.fillRect(p.x-bw/2,y,bw,3);ctx.fillStyle=color;ctx.fillRect(p.x-bw/2,y,bw*s.hp/s.maxHp,3);text(`${s.side?'RED':'BLUE'} RAIL CRUISER`,p.x,y-5,color,7);const ready=clamp(1-(s.railNext-battle.time)/30,0,1);ctx.fillStyle=C.gold;ctx.fillRect(p.x-bw/2,p.y+size*.52,bw*ready,2);
  }else{
   if(s.kind==='cargo'){for(const t of s.turrets){const tp=battle.turretPoint(pose(s),t),q=screen(tp.x,tp.y),n=Math.max(2,5*zoom);ctx.fillStyle=t.flash>0?C.white:'#d4a64d';ctx.fillRect(Math.round(q.x-n/2),Math.round(q.y-n/2),n,n);}text('MERCHANT',p.x,p.y-size*.72,C.white,7);}
   if(s.shield>0){ctx.globalAlpha=s.lastHit>battle.time-.6?.8:s.player?.35:.15;ctx.strokeStyle=color;ctx.lineWidth=1;ctx.beginPath();ctx.arc(p.x,p.y,size*.67,0,s.shield===2?Math.PI*2:Math.PI*1.5);ctx.stroke();ctx.globalAlpha=1;}
   if(s.hp<s.maxHp){const bw=Math.max(15,size*1.05);ctx.fillStyle='#243244';ctx.fillRect(p.x-bw/2,p.y-size*.7,bw,2);ctx.fillStyle=s.hp/s.maxHp<.35?C.red:C.gold;ctx.fillRect(p.x-bw/2,p.y-size*.7,bw*s.hp/s.maxHp,2);}
  }
  if(squadMember(s)){const r=size*.72+2,y=Math.round(p.y+size*.65+3);ctx.fillStyle='#071d0a';ctx.fillRect(Math.round(p.x)-3,y-1,7,5);ctx.fillStyle=C.squad;ctx.fillRect(Math.round(p.x)-2,y,5,3);line(p.x-r,p.y-r,p.x-r+4,p.y-r,C.squad);line(p.x-r,p.y-r,p.x-r,p.y-r+4,C.squad);line(p.x+r,p.y+r,p.x+r-4,p.y+r,C.squad);line(p.x+r,p.y+r,p.x+r,p.y+r-4,C.squad);}
  if(s.player){const r=size*.8+4;line(p.x-r,p.y-r,p.x-r+5,p.y-r,C.gold);line(p.x-r,p.y-r,p.x-r,p.y-r+5,C.gold);line(p.x+r,p.y+r,p.x+r-5,p.y+r,C.gold);line(p.x+r,p.y+r,p.x+r,p.y+r-5,C.gold);text('YOU',p.x,p.y+r+9,C.gold,7);}
 }
 for(const e of effects){const p=screen(e.x,e.y),age=1-e.life/e.max;if(e.type==='muzzle'){
  if(map)continue;ctx.save();ctx.translate(p.x,p.y);ctx.rotate((e.a||0)+Math.PI/2);const size=14*zoom*(1-age*.5)*(e.player&&e.burst===2?.72:1);for(const port of [0]){const x=port*zoom;ctx.fillStyle=e.player?'#ffc55e':C.gold;ctx.beginPath();ctx.moveTo(x,-size*1.35);ctx.lineTo(x+size*.26,-size*.2);ctx.lineTo(x,size*.2);ctx.lineTo(x-size*.26,-size*.2);ctx.closePath();ctx.fill();ctx.fillStyle=C.white;ctx.fillRect(x-size*.09,-size*.85,size*.18,size);}ctx.restore();continue;
 }
 const big=e.type==='explosion'||e.type==='blast',r=(e.type==='blast'?110:e.large?145:e.popped?45:big?48:27)*age*zoom;ctx.globalAlpha=1-age;
 if(big){const n=Math.max(3,r);ctx.fillStyle=age<.18?C.white:age<.5?C.gold:'#ed7536';ctx.fillRect(p.x-n*.7,p.y-n*.45,n*1.4,n*.9);ctx.fillRect(p.x-n*.45,p.y-n*.7,n*.9,n*1.4);if(e.fromPlayer&&!reducedMotion.matches&&age<.45){const burst=(12+42*age)*zoom;for(let i=0;i<8;i++){const a=i*Math.PI/4;line(p.x+Math.cos(a)*burst*.55,p.y+Math.sin(a)*burst*.55,p.x+Math.cos(a)*burst,p.y+Math.sin(a)*burst,age<.16?C.white:C.gold,2);}}}
 ctx.strokeStyle=e.type==='shield'?(e.popped?C.white:C.blue):C.gold;ctx.lineWidth=e.popped||big?2:1;ctx.beginPath();ctx.arc(p.x,p.y,Math.max(2,r),0,Math.PI*2);ctx.stroke();
 if(e.fromPlayer&&!big){for(const [x,y] of [[-1,-1],[1,-1],[-1,1],[1,1]])line(p.x+x*4,p.y+y*4,p.x+x*9,p.y+y*9,e.type==='shield'?C.blue:C.white,2);}
 if(age<.25){ctx.fillStyle=C.white;ctx.fillRect(p.x-3,p.y-3,6,6);}
 }ctx.globalAlpha=1;
 for(const e of particles){const p=screen(e.x,e.y);ctx.fillStyle=e.color;ctx.globalAlpha=clamp(e.life*2,0,1);ctx.fillRect(Math.round(p.x),Math.round(p.y),2,2);}ctx.globalAlpha=1;
 for(const r of rewards){let p=screen(r.x,r.y);if(!r.local||p.x<20||p.x>w-20||p.y<45||p.y>h-35)p={x:w*.5,y:h*.24};const age=1-r.life/r.max,rise=age*(r.kill?44:24),alpha=Math.min(1,r.life*4);ctx.globalAlpha=alpha;const pop=reducedMotion.matches?1:1+Math.max(0,1-age/.16)*(r.kill?.55:.3),size=(r.kill?13:8)*pop;text(`+${r.points}`,p.x,p.y-rise,r.kill?C.gold:C.white,size);if(r.kill){text(r.label,p.x,p.y-rise+13,C.white,7);if(r.combo>1)text(`${r.combo}x CHAIN`,p.x,p.y-rise+25,C.gold,8);}}ctx.globalAlpha=1;
 ctx.restore();drawEnemyIndicators();
 const pilot=battle.player;if(pilot.alive&&!map){const q=pose(pilot),aim=screen(q.x+Math.cos(q.a)*190,q.y+Math.sin(q.a)*190),n=hitConfirm>0?6:3,color=hitConfirm>0?C.white:C.gold;ctx.globalAlpha=hitConfirm>0?1:.65;line(aim.x-n,aim.y,aim.x-1,aim.y,color);line(aim.x+1,aim.y,aim.x+n,aim.y,color);line(aim.x,aim.y-n,aim.x,aim.y-1,color);line(aim.x,aim.y+1,aim.x,aim.y+n,color);ctx.globalAlpha=1;}
 const follow=battle.followPoint();if(follow&&battle.player.alive){const leader=battle.ships[battle.squad().leader],point=follow.state==='regroup'||!leader?follow:pose(leader),p=screen(point.x,point.y),off=p.x<24||p.x>w-24||p.y<80||p.y>h-55,x=clamp(p.x,24,w-24),y=clamp(p.y,80,h-55);ctx.strokeStyle=C.squad;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,y-6);ctx.lineTo(x+6,y);ctx.lineTo(x,y+6);ctx.lineTo(x-6,y);ctx.closePath();ctx.stroke();
  const label=follow.state==='regroup'?'REGROUP':follow.name;text(label,x,y-12,C.squad,8);if(off){const a=Math.atan2(p.y-y,p.x-x);line(x+Math.cos(a)*10,y+Math.sin(a)*10,x+Math.cos(a)*18,y+Math.sin(a)*18,C.squad,2);text(Math.round(distance(battle.player,follow))+' m',x,y+18,C.squad,7);}}
 if(map&&battle.player.alive){const p=entityScreen(battle.player);ctx.strokeStyle=C.gold;ctx.lineWidth=1;ctx.strokeRect(p.x-5,p.y-5,10,10);text('YOU',p.x,p.y+16,C.gold,8);}
 if(map){ctx.fillStyle='#060d19';ctx.fillRect(edge.x+2,edge.y+2,WORLD.width*zoom-4,14);text('TEAM VISION · GREEN = YOUR SQUADRON',w/2,edge.y+12,C.squad,7);}drawMap();
}
// The opening is a small arcade raster, using five-by-seven title tiles and three-color ship tiles.
const titleCanvas=$('title-pixels'),titleContext=titleCanvas.getContext('2d',{alpha:false});
const titleGlyphs={
 S:['01111','10000','10000','01110','00001','00001','11110'],
 T:['11111','00100','00100','00100','00100','00100','00100'],
 A:['01110','10001','10001','11111','10001','10001','10001'],
 R:['11110','10001','10001','11110','10100','10010','10001'],
 F:['11111','10000','10000','11110','10000','10000','10000'],
 L:['10000','10000','10000','10000','10000','10000','11111'],
 E:['11111','10000','10000','11110','10000','10000','11111'],
 G:['01111','10000','10000','10111','10001','10001','01111'],
 I:['11111','00100','00100','00100','00100','00100','11111'],
 O:['01110','10001','10001','10001','10001','10001','01110'],
 N:['10001','11001','11001','10101','10011','10011','10001']};
function titleWord(word,y,colors){const g=titleContext,scale=4,x=(320-(word.length*6-1)*scale)/2;
 for(let pass=0;pass<2;pass++)for(let i=0;i<word.length;i++)titleGlyphs[word[i]].forEach((row,ry)=>[...row].forEach((p,rx)=>{if(p==='1'){g.fillStyle=pass?colors[Math.min(colors.length-1,Math.floor(ry/3))]:'#3840b8';g.fillRect(x+i*24+rx*scale+(pass?0:2),y+ry*scale+(pass?0:2),scale,scale);}}));}
let titleTick=-1;
function drawTitle(now){const tick=Math.floor(now/100);if(tick===titleTick)return;titleTick=tick;const g=titleContext;g.imageSmoothingEnabled=false;g.fillStyle='#000';g.fillRect(0,0,320,256);
 const still=reducedMotion.matches;for(let i=0;i<45;i++){g.fillStyle=['#3840b8','#4bdcff','#ff3838','#ffe040','#fff'][i%5];const x=(i*73+17)%320,y=((i*47+9)+(still?0:Math.floor(tick/(3+i%3))))%256;g.fillRect(x,y,1,1);}
 titleWord('STARFALL',54,['#fff','#4bdcff','#3840b8']);titleWord('LEGION',89,['#ff3838','#ff8878','#ffe040']);
 const enemy=['1...1...1','11.111.11','.1111111.','..21212..','.1222221.','11.111.11','1.......1'],pilot=['....1....','....1....','...121...','...121...','.1112111.','111222111','1.11211.1','...1.1...','...3.3...'];
 function ship(rows,x,y,scale,palette){rows.forEach((row,ry)=>[...row].forEach((v,rx)=>{if(v!=='.'){g.fillStyle=palette[+v-1];g.fillRect(x+rx*scale,y+ry*scale,scale,scale);}}));}
 for(let i=0;i<6;i++)ship(enemy,70+i*34,40+(still?0:(Math.floor(tick/8)+i)%2),1,['#ff3838','#ffe040']);
 ship(pilot,151,128,2,['#4bdcff','#fff',tick%2?'#ffe040':'#ff3838']);ship(pilot,123,134,1,['#4bdcff','#fff','#ffe040']);ship(pilot,189,134,1,['#4bdcff','#fff','#ffe040']);
}
function frame(now){
 const startAt=performance.now(),dt=Math.min((now-last)/1000,.1);last=now;
 if(mode==='opening')drawTitle(now);
 if(mode==='paused'){const gp=navigator.getGamepads?.()?.find(p=>p?.connected);if(gp){if(gp.buttons[9]?.pressed&&!lastPadButtons[9])pause(false);lastPadButtons=gp.buttons.map(b=>b.pressed);}}
 if(mode==='playing'){
  acc+=dt;let count=0;const controls=input();
  while(acc>=FIXED_STEP&&count++<4&&mode==='playing'){
   motion.capture(battle);const t=performance.now();battle.step(FIXED_STEP,controls);
   if(localDiagnostics)perf.stepMs.push(performance.now()-t);handleEvents();acc-=FIXED_STEP;
  }
  renderAlpha=mode==='playing'?acc/FIXED_STEP:1;
  if(battle.spectating){let watched=battle.ships.find(ship=>ship.id===spectatorShipId&&ship.alive&&ship.side===0);if(spectatorShipId!==null&&!watched){const alive=spectatorShips();spectatorShipId=alive[0]?.id??null;map=!alive.length;watched=alive[0];syncHUD();}if(controls.x||controls.y){freeSpectatorView();const length=Math.max(1,Math.hypot(controls.x,controls.y)),speed=450*dt/zoom;panSpectator(controls.x/length*speed,controls.y/length*speed);}else if(watched&&!map){const p=pose(watched),ease=1-Math.exp(-dt*8);camera.x+=(p.x+Math.cos(p.a)*75-camera.x)*ease;camera.y+=(p.y+Math.sin(p.a)*75-camera.y)*ease;}}
  else if(!map){const p=pose(battle.viewShip),ease=1-Math.exp(-dt*8);camera.x+=(p.x+Math.cos(p.a)*75-camera.x)*ease;camera.y+=(p.y+Math.sin(p.a)*75-camera.y)*ease;}
  for(const e of effects)e.life-=dt;effects=effects.filter(e=>e.life>0);for(const r of rewards)r.life-=dt;rewards=rewards.filter(r=>r.life>0);
  for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;}particles=particles.filter(p=>p.life>0).slice(-800);
  shake*=Math.exp(-dt*12);recoil*=Math.exp(-dt*20);hitConfirm=Math.max(0,hitConfirm-dt);
  if(battle.time>noticeUntil&&$('notice').textContent)$('notice').textContent='';
  hudAt+=dt;saveAt+=dt;if(hudAt>.1){syncHUD();paintSound();hudAt=0;}if(saveAt>2){queueSave();saveAt=0;}
 }else renderAlpha=1;
 sfx.update(document.hidden?'paused':mode,battle?.player?.alive?Math.min(1,Math.hypot(battle.player.vx,battle.player.vy)/300):0);
 if(mode!=='opening'){
  const t=performance.now();draw();
  if(localDiagnostics&&mode==='playing'){perf.drawMs.push(performance.now()-t);perf.frames++;const work=performance.now()-startAt;perf.frameMs.push(work);frameMeter.record(now,work);}
 }
 if(localDiagnostics){
  if(now-diagnosticAt>250){canvas.dataset.audio=JSON.stringify(sfx.status());diagnosticAt=now;}
  if(now-perfAt>1000){canvas.dataset.performance=JSON.stringify(frameMeter.report());perfAt=now;for(const key of ['frameMs','drawMs','stepMs'])if(perf[key].length>1800)perf[key]=perf[key].slice(-900);}
 }
 requestAnimationFrame(frame);
}
function publicState(){return{mode,time:battle?.time??0,lives:battle?.lives??3,score:battle?.score??0,ships:battle?battle.living(0).length+battle.living(1).length:354,shipsLeft:{blue:battle?.living(0).length??177,red:battle?.living(1).length??177},spectating:battle?.spectating??false,visibleEnemies:battle?.contacts[0].filter(id=>battle.ships[id].side===1).length??0,phase:battle?.phase,result:battle?.result,map,inference:battle?.inference};}
arcade.init().then(({config})=>{paintEntry();if(config.localTest){localDiagnostics=true;window.__starfall={state:publicState,get battle(){return battle;},get perf(){return perf;},get performance(){return frameMeter.report();},rendered(id){return {...pose(battle.ships[id])};},get audio(){return sfx.status();},get sound(){return sfx;},get camera(){return {...camera,zoom,viewWidth:w/zoom,viewHeight:h/zoom};},pause,draw,start,async advance(seconds){if(!battle)throw new Error('Start first');for(let i=0;i<seconds*30&&!battle.result;i++){motion.capture(battle);battle.step(FIXED_STEP,{});if(battle.events.some(e=>e.type==='recall'))for(let side=0;side<2;side++){const snap=battle.decisionSnapshot(side);battle.acceptOrders(snap,battle.fallback(snap),'fixture');}handleEvents();}renderAlpha=1;syncHUD();draw();}};}}).catch(()=>status('ARCADE CONNECTION UNAVAILABLE · Reload to reconnect.'));
if(document.modelContext?.registerTool){try{document.modelContext.registerTool({name:'read_starfall_state',description:'Read the pilot’s current arcade state. Includes fleet survivor totals; enemy positions remain restricted to team vision.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute(args){if(!args||Object.keys(args).length)throw new Error('Expected empty input');return publicState();}});}catch{}}
requestAnimationFrame(frame);

if(document.modelContext?.registerTool){for(const tool of [
 {name:'start_free_flight',description:'Start or resume the free browser battle. No payment or tokens.',execute:async()=>{if(!['opening','ended'].includes(mode))throw new Error('Flight already active');await start();return publicState();}},
 {name:'pause_free_flight',description:'Pause the free browser battle and save it on this device.',execute:async()=>{if(mode!=='playing')throw new Error('No playing flight');pause(true);return publicState();}}
])try{document.modelContext.registerTool({...tool,inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:false},execute:async args=>{if(!args||Object.keys(args).length)throw new Error('Expected empty input');return tool.execute();}});}catch{}}
