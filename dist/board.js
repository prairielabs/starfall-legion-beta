// The strategic board. Units are not commanded individually: a formation is a
// PIECE, addressed by its centre of gravity. Moving a piece moves that centre,
// and the ships keep their existing formation slots as they follow it. Nothing
// here relocates a ship directly.
//
// Geometry lives in grid.js (14 x 14 squares of 1,000 units); piece weights and
// reach live in simulation.js so the battle and the board agree. This module is
// the readable view: pieces, fog, ghosts, legal moves, text render and roster.
// Rank 1 is red's home edge, rank 14 blue's. Files run a-n west to east.
import {WORLD,RULES,TYPES,WEIGHTS,shipWorth,reachOf,legalOrderSquare} from './simulation.js';
import {BOARD as GRID,FILE_NAMES,squareOf as gridSquareOf,parseSquare,centreOf,allSquares,reachableSquares as gridReachable,nearestReachable,squareDistance,KIND_LETTERS,KIND_NAMES,renderPieces} from './grid.js';
export {WEIGHTS,shipWorth,parseSquare,centreOf,allSquares,nearestReachable,squareDistance};
export const BOARD=Object.freeze({files:GRID.files,ranks:GRID.ranks,get cellWidth(){return GRID.square;},get cellHeight(){return GRID.square;}});
export const KINDS=Object.freeze(Object.fromEntries(Object.keys(KIND_LETTERS).map(kind=>[kind,Object.freeze({letter:KIND_LETTERS[kind],name:KIND_NAMES[kind],paceOf:kind,brief:{
 fighter:'the manoeuvre arm: flank, pile on, screen, advance',
 scout:'the eyes: fast, fragile, finds the enemy',
 artillery:'slow heavy hull carrying ten fighters; anchors a line',
 cavalry:'fast heavy hitters for the decisive push',
 cargo:'wildcard: an asset to keep safe, not to the death; may be spent as extra firepower',
 command:'the command ship; its loss ends the game; closes to the centre for the final engagement',
 escort:'ten-ship ring bound to the command ship; returns to it on every recall'}[kind]})])));
export const SIDE_NAMES=Object.freeze(['BLUE','RED']);
export function squareOf(x,y){return gridSquareOf(x,y);}
export function reach(kind){if(!TYPES[kind])throw new Error(`No such kind of piece: ${kind}`);return reachOf(kind);}
export function reachableSquares(from,kind){return gridReachable(from,reach(kind));}
export function baseline(battle){for(const f of battle.formations)if(!Number.isFinite(f.full))f.full=battle.members(f.id).reduce((t,s)=>t+shipWorth(s),0);}
// The centre of gravity of a formation: the mean position of its living members.
export function centreOfGravity(battle,formationId){const members=battle.members(formationId);if(!members.length)return null;return{x:members.reduce((t,s)=>t+s.x,0)/members.length,y:members.reduce((t,s)=>t+s.y,0)/members.length,count:members.length};}
// One formation as a piece: weighted remaining strength, its fraction of full, raw hull, square and reach.
export function pieceOf(battle,formationId){
 const formation=battle.formations[formationId];if(!formation)return null;const members=battle.members(formationId);if(!members.length)return null;
 const state=battle.pieceState(formation,members);
 return Object.freeze({...state,letter:KINDS[formation.kind]?.letter||'?',name:formation.name,full:Math.round((formation.full||state.strength)*10)/10,hull:Math.round(members.reduce((t,s)=>t+s.hp,0)),cog:{x:state.x,y:state.y},reach:reach(formation.kind),state:formation.state,role:formation.role,player:members.some(s=>s.player),finishing:formation.finishing??null});
}
export function pieces(battle){return battle.formations.map(f=>pieceOf(battle,f.id)).filter(Boolean);}
// The board as one side sees it: own pieces, enemy pieces in contact (partial centres when only
// part is seen), and ghosts where enemies were last seen. Same data the admiral receives.
export function boardView(battle,side){const snap=battle.decisionSnapshot(side);return Object.freeze({version:2,board:{files:GRID.files,ranks:GRID.ranks,square:GRID.square},time:snap.time,side,own:Object.freeze(snap.pieces.map(p=>Object.freeze({...p,letter:KINDS[p.kind].letter}))),enemy:Object.freeze(snap.enemies.map(p=>Object.freeze({...p,letter:KINDS[p.kind].letter}))),ghosts:Object.freeze(snap.ghosts)});}
export function moveOrder(battle,formationId,square){const piece=pieceOf(battle,formationId);if(!piece)throw new Error(`No piece ${formationId} on the board.`);const target=parseSquare(typeof square==='string'?square:square.name),centre=centreOf(target);return Object.freeze({piece:piece.id,from:piece.square,to:target.name,goal:{x:Math.round(centre.x),y:Math.round(centre.y)},legal:legalOrderSquare(piece,target.name)===target.name});}
// Apply a move by giving the formation an admiral goal. Ships are never repositioned here.
export function applyMove(battle,order){const formation=battle.formations[order.piece];if(!formation)throw new Error(`No piece ${order.piece} on the board.`);formation.orderGoal={x:order.goal.x,y:order.goal.y};formation.orderSquare=order.to;formation.goal={x:order.goal.x,y:order.goal.y};return order;}
export function legalMoves(battle,side){return boardView(battle,side).own.map(piece=>({piece:piece.id,kind:piece.kind,at:piece.square,reach:piece.reach,squares:reachableSquares(piece.square,piece.kind).filter(to=>legalOrderSquare(piece,to)===to)}));}
// The board as text. Rank 14 (blue home) at the top; blue upper case, red lower case; `?` marks a ghost.
export function render(battle,side=null){
 const list=side===null?pieces(battle):(v=>[...v.own,...v.enemy])(boardView(battle,side)),ghosts=side===null?[]:boardView(battle,side).ghosts;
 const legend=Object.values(KINDS).filter(k=>k.letter!=='E').map(k=>`${k.letter}=${k.name}`).join('  ');
 return renderPieces(list,{ghosts})+`\nBLUE upper case (home rank ${GRID.ranks}), red lower case (home rank 1), ? last seen. ${legend}.`;
}
export function roster(battle,side=null){return pieces(battle).filter(p=>side===null||p.side===side).map(p=>`${p.square.padEnd(3)} ${SIDE_NAMES[p.side].padEnd(4)} ${p.letter} ${p.name.padEnd(16)} ${String(p.count).padStart(2)} ships  strength ${String(p.strength).padStart(5)} (${Math.round(p.remaining*100)}%)  reach ${p.reach}${p.player?'  (pilot)':''}`);}
