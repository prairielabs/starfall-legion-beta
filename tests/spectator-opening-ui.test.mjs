import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const game=await readFile(new URL('../dist/game.js',import.meta.url),'utf8');
const style=await readFile(new URL('../dist/style.css',import.meta.url),'utf8');

test('spectator cycle follows living friendly ships and returns to the map',()=>{
 assert.match(game,/function spectatorShips\(\)\{return battle\?battle\.living\(0\)\.sort/);
 assert.match(game,/if\(battle\.spectating\)\{cycleSpectator\(\);return;\}/);
 assert.match(game,/ship\.id===spectatorShipId&&ship\.alive&&ship\.side===0/);
 assert.match(game,/else\{spectatorShipId=null;map=true;\}/);
});

test('squadron markers are more distinct without obscuring ships',()=>{
 assert.match(game,/squadMember\(s\)\?3\.5:1\.5/);
 assert.match(game,/line\(p\.x-r,p\.y-r,p\.x-r\+4,p\.y-r,C\.squad\)/);
});

test('launch transition has no horizontal beam or line-collapse frame',()=>{
 assert.doesNotMatch(style,/#launch-transition::after/);
 assert.doesNotMatch(style,/launch-beam/);
 assert.doesNotMatch(style,/clip-path:inset\(49\.5%/);
});
