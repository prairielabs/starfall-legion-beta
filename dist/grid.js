// The strategic grid. Pure geometry with no imports, shared by the battle,
// the board module, the renderer and the server contract.
//
// The 14,000-unit sector is cut into 14 x 14 squares of 1,000 units, files
// a-n west to east and ranks 1-14 south to north in world coordinates. Rank 1
// is the low-y edge (red's home) and rank 14 the high-y edge (blue's home).
export const SECTOR=14000;
export const BOARD=Object.freeze({files:14,ranks:14,square:1000});
export const FILE_NAMES='abcdefghijklmn';
const clampIndex=(v,limit)=>Math.max(0,Math.min(limit-1,v));
export function squareOf(x,y){const file=clampIndex(Math.floor(x/BOARD.square),BOARD.files),rank=clampIndex(Math.floor(y/BOARD.square),BOARD.ranks);return{file,rank,name:FILE_NAMES[file]+(rank+1)};}
export function parseSquare(name){const text=String(name).trim().toLowerCase(),file=FILE_NAMES.indexOf(text[0]),rank=Number(text.slice(1))-1;if(file<0||!Number.isInteger(rank)||rank<0||rank>=BOARD.ranks)throw new Error(`Not a square on this board: ${name}`);return{file,rank,name:FILE_NAMES[file]+(rank+1)};}
export function isSquare(name){try{parseSquare(name);return true;}catch{return false;}}
export function centreOf(square){const {file,rank}=typeof square==='string'?parseSquare(square):square;return{x:(file+.5)*BOARD.square,y:(rank+.5)*BOARD.square};}
export function allSquares(){const out=[];for(let rank=0;rank<BOARD.ranks;rank++)for(let file=0;file<BOARD.files;file++)out.push(FILE_NAMES[file]+(rank+1));return out;}
export function squareDistance(a,b){const p=parseSquare(a),q=parseSquare(b);return Math.hypot(p.file-q.file,p.rank-q.rank);}
// Squares within `reach` squares (straight line between centres) of `from`, the origin included.
export function reachableSquares(from,reach){const o=typeof from==='string'?parseSquare(from):from,out=[];for(let rank=0;rank<BOARD.ranks;rank++)for(let file=0;file<BOARD.files;file++)if(Math.hypot(file-o.file,rank-o.rank)<=reach)out.push(FILE_NAMES[file]+(rank+1));return out;}
// The reachable square closest to `target`, so an over-ambitious order is clamped along its own line rather than refused.
export function nearestReachable(from,reach,target){const t=parseSquare(target);let best=null,bestDistance=Infinity;for(const name of reachableSquares(from,reach)){const s=parseSquare(name),d=Math.hypot(s.file-t.file,s.rank-t.rank);if(d<bestDistance){best=name;bestDistance=d;}}return best;}
export function squareTowards(from,reach,target){return nearestReachable(from,reach,target);}
export const KIND_LETTERS=Object.freeze({fighter:'F',scout:'S',artillery:'A',cavalry:'C',cargo:'M',command:'K',escort:'E'});
export const KIND_NAMES=Object.freeze({fighter:'fighter squadron',scout:'scout pair',artillery:'artillery battery',cavalry:'cavalry',cargo:'merchant convoy',command:'command ship',escort:'elite escort'});
// The board as text from a list of pieces ({side,kind,square}). Rank 14 at the top so blue reads from its own edge.
export function renderPieces(pieces,{ghosts=[]}={}){
 const cells=new Map();for(const p of pieces){if(!cells.has(p.square))cells.set(p.square,[]);cells.get(p.square).push(p);}
 const ghostCells=new Set(ghosts.map(g=>g.square));
 const mark=p=>{const letter=KIND_LETTERS[p.kind]||'?';return p.side===0?letter:letter.toLowerCase();};
 const header='    '+[...FILE_NAMES].map(f=>` ${f} `).join('');const lines=[header];
 for(let rank=BOARD.ranks-1;rank>=0;rank--){let row=String(rank+1).padStart(3,' ')+' ';for(let file=0;file<BOARD.files;file++){const name=FILE_NAMES[file]+(rank+1),here=cells.get(name);if(!here)row+=ghostCells.has(name)?' ? ':' . ';else if(here.length===1)row+=` ${mark(here[0])} `;else row+=`${mark(here[0])}${here.length>9?'+':here.length} `.padStart(3,' ');}lines.push(row);}
 lines.push(header);return lines.join('\n');
}
