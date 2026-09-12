// The free edition has no network, payment, credential, or inference boundary.
// Two local admirals (the battle's standing orders) play the strategic board.
import {Battle} from './simulation.js';
const KEY='starfall-free-session-v1';
let activeRun=null;
try{const saved=JSON.parse(localStorage.getItem(KEY)||'null');if(saved&&typeof saved.id==='string'&&Number.isSafeInteger(saved.seed))activeRun=saved;}catch{}
const config=Object.freeze({free:true,localTest:false,admirals:Object.freeze([Object.freeze({side:0,name:'BLUE',label:'LOCAL ADMIRAL',model:null,brand:null}),Object.freeze({side:1,name:'RED',label:'LOCAL ADMIRAL',model:null,brand:null})])});
const session={authorized:true,mode:'free',tokens:0,runTokens:0,activeRun};
const persist=()=>{try{localStorage.setItem(KEY,JSON.stringify(session.activeRun));}catch{}};
export const state=()=>({session,config});
export async function init(){return state();}
export async function activate(){throw new Error('No code needed. Press start.');}
export async function localTest(){throw new Error('This is the free arcade.');}
export async function start(){if(!session.activeRun){const seed=crypto.getRandomValues(new Uint32Array(1))[0];session.activeRun={id:crypto.randomUUID(),seed};persist();}return session.activeRun;}
export async function finish(id){if(session.activeRun?.id===id){session.activeRun=null;persist();}return{tokens:0,runTokens:0};}
export async function decisions(run,snapshot){return{orders:Battle.standingOrders(snapshot),source:'local',tokens:0,runTokens:0};}
