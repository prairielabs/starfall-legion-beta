const BOARD='starfall-free-scores-v1',FLIGHT='starfall-free-flight-v15';
export class Storage{
 constructor(storage){this.storage=storage;this.available=true;this.memory={};}
 read(key,fallback){try{const raw=this.storage.getItem(key);return raw?JSON.parse(raw):fallback;}catch{this.available=false;return this.memory[key]??fallback;}}
 write(key,value){this.memory[key]=value;try{this.storage.setItem(key,JSON.stringify(value));return true;}catch{this.available=false;return false;}}
 scores(){const list=this.read(BOARD,[]);return Array.isArray(list)?list.filter(s=>typeof s.id==='string'&&Number.isFinite(s.score)&&s.score>=0).sort((a,b)=>b.score-a.score).slice(0,5):[];}
 score(item){const scores=this.scores().filter(s=>s.id!==item.id);scores.push({...item,name:String(item.name||'YOU').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,3)||'YOU'});scores.sort((a,b)=>b.score-a.score);this.write(BOARD,scores.slice(0,5));return this.scores();}
 save(run,battle){return this.write(FLIGHT,{runId:run.id,battle});}
 flight(runId){const f=this.read(FLIGHT,null);return f?.runId===runId?f.battle:null;}
}
