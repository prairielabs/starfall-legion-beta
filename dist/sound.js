import {AUDIO_FILES} from './audio-assets.js';
// Authored CC0 recordings. This mixer creates no oscillators or generated noise.
export class ArcadeSound {
 constructor(){this.context=null;this.muted=false;this.mode='opening';this.voices=0;this.error=null;this.buffers=new Map();this.loops=new Map();this.loading=false;this.loadPromise=null;this.shot=0;this.lastAmbientExplosion=-1;this.played={};}
 async unlock(){
  try{
   if(!this.context){
    const Context=globalThis.AudioContext||globalThis.webkitAudioContext;if(!Context)throw new Error('Audio unavailable');const c=this.context=new Context();
    this.sfx=c.createGain();this.music=c.createGain();this.engine=c.createGain();this.music.gain.value=this.engine.gain.value=0;
    this.mix=c.createDynamicsCompressor();this.mix.threshold.value=-10;this.mix.knee.value=16;this.mix.ratio.value=3;this.mix.attack.value=.003;this.mix.release.value=.15;
    this.master=c.createGain();this.master.gain.value=this.muted?0:.85;this.analyser=c.createAnalyser();this.analyser.fftSize=2048;this.samples=new Float32Array(2048);
    for(const bus of [this.sfx,this.music,this.engine])bus.connect(this.mix);this.mix.connect(this.master);this.master.connect(this.analyser);this.analyser.connect(c.destination);
   }
   // Resume in the initiating gesture, before network/decode awaits.
   if(this.context.state!=='running')await this.context.resume();
   if(this.loadPromise)return await this.loadPromise;
   if(this.buffers.size===Object.keys(AUDIO_FILES).length){this.applyMode();return;}
   this.loading=true;this.error=null;
   this.loadPromise=(async()=>{
    const outcomes=await Promise.allSettled(Object.entries(AUDIO_FILES).filter(([id])=>!this.buffers.has(id)).map(async([id,file])=>{
     const r=await fetch(new URL('./assets/audio/'+file,import.meta.url),{signal:AbortSignal.timeout(10000)});if(!r.ok)throw new Error(file);
     this.buffers.set(id,await this.context.decodeAudioData(await r.arrayBuffer()));
    }));
    if(outcomes.some(r=>r.status==='rejected'))this.error='Audio download failed. Tap SOUND to retry.';
    this.startLoop('flight',this.music);this.startLoop('engine',this.engine);this.applyMode();
   })();
   await this.loadPromise;
  }catch{this.error='Audio unavailable. Tap SOUND to retry.';}
  finally{this.loading=false;this.loadPromise=null;}
 }
 startLoop(id,bus){if(this.loops.has(id)||!this.buffers.has(id))return;const source=this.context.createBufferSource();source.buffer=this.buffers.get(id);source.loop=true;source.connect(bus);source.start();this.loops.set(id,source);}
 setMuted(value){this.muted=value;if(this.context)this.master.gain.setTargetAtTime(value?0:.85,this.context.currentTime,.02);}
 applyMode(){if(!this.context)return;const t=this.context.currentTime,paused=this.mode==='paused';this.sfx.gain.setTargetAtTime(paused?0:1,t,.025);this.music.gain.setTargetAtTime(paused?0:this.mode==='playing'?.14:this.mode==='ended'?.05:.1,t,.08);if(paused||this.mode!=='playing')this.engine.gain.setTargetAtTime(0,t,.04);this.motorState=null;}
 update(mode,thrust=0){if(this.mode!==mode){this.mode=mode;this.applyMode();}const c=this.context;if(!c||c.state!=='running')return;const level=Math.round(thrust*20)/20,key=mode+':'+level;if(key!==this.motorState){this.motorState=key;this.engine.gain.setTargetAtTime(mode==='playing'?.08+level*.09:0,c.currentTime,.07);}}
 play(id,{gain=1,pan=0,rate=1,at=null,duration=null}={}){
  const c=this.context,buffer=this.buffers.get(id);if(!c||!buffer||this.muted||this.mode==='paused'||c.state!=='running'||this.voices>=32)return;
  const source=c.createBufferSource(),g=c.createGain(),p=c.createStereoPanner?.();source.buffer=buffer;source.playbackRate.value=rate;g.gain.value=gain;source.connect(g);
  if(p){p.pan.value=Math.max(-1,Math.min(1,pan));g.connect(p);p.connect(this.sfx);}else g.connect(this.sfx);
  this.voices++;this.played[id]=(this.played[id]||0)+1;const start=at??c.currentTime;source.start(start);if(duration!==null){g.gain.setValueAtTime(gain,start);g.gain.setValueAtTime(gain,start+Math.max(0,duration-.04));g.gain.linearRampToValueAtTime(0,start+duration);source.stop(start+duration);}source.onended=()=>{this.voices--;source.disconnect();g.disconnect();p?.disconnect();};
 }
 cannon(player=true,pan=0,level=1){this.play(player?'cannon':(this.shot++%2?'cannonAlt':'cannon'),{gain:player?.9:.65*level,pan,rate:1});}
 impact(shield=false,popped=false,pan=0){this.play(shield?(popped?'shieldBreak':'shield'):'impact',{gain:popped?.55:shield?.48:.66,pan,rate:1,duration:popped?.3:.18});}
 explosion(big=false,pan=0,player=false){const now=this.context?.currentTime??0;if(!player&&now-this.lastAmbientExplosion<.09)return;if(!player)this.lastAmbientExplosion=now;this.play(big?'explosionLarge':'explosion',{gain:player?(big?.5:.42):(big?.34:.28),pan,duration:big?.85:.5});}
 rail(){this.play('rail',{gain:.6,rate:.65});}
 signal(){this.play('signal',{gain:.35});}
 reward({kill=false,big=false,combo=1,pan=0}={}){if(!kill||!this.context)return;const at=this.context.currentTime,punch=big?1.15:1;this.play('impact',{gain:.46*punch,pan,rate:1.08+Math.min(3,Math.max(0,combo-1))*.025,duration:.085,at});this.play('explosion',{gain:.2*punch,pan,rate:.72,duration:.19,at:at+.012});this.play('impact',{gain:.13,pan,rate:1.65,duration:.055,at:at+.075});}
 ending(won){this.play(won?'signal':'explosionLarge',{gain:won?.4:.35,rate:won?1:.8});}
 status(){let rms=0,peak=0;if(this.analyser){this.analyser.getFloatTimeDomainData(this.samples);for(const v of this.samples){rms+=v*v;peak=Math.max(peak,Math.abs(v));}rms=Math.sqrt(rms/this.samples.length);}return{state:this.context?.state??'locked',muted:this.muted,mode:this.mode,voices:this.voices,loaded:this.buffers.size,total:Object.keys(AUDIO_FILES).length,loading:this.loading,rms,peak,error:this.error,source:'CC0 samples',played:{...this.played}};}
}
