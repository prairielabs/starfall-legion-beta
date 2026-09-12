import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const root=new URL('../dist/',import.meta.url);
const [game,sound]=await Promise.all([
 readFile(new URL('game.js',root),'utf8'),
 readFile(new URL('sound.js',root),'utf8')
]);

test('artillery has a broader textured capital-ship sprite',()=>{
 assert.match(game,/c\.width=128;c\.height=96/);
 assert.match(game,/r\(57,0,14,28,ink\)/);
 assert.match(game,/size\*1\.44,size\*1\.08/);
 assert.match(game,/ctx\.fillRect\(x-2,y-2,n\+4,n\+4\)/);
});

test('rail beam has layered bloom and a restrained screen punch',()=>{
 assert.match(game,/globalCompositeOperation='lighter'/);
 for(const width of [96,62,25,7])assert.match(game,new RegExp(`${width}\\*zoom`));
 assert.match(game,/ctx\.lineDashOffset=-renderTime\*180/);
 assert.match(game,/railPunch=1/);
 assert.match(game,/railPunch\*\.12/);
});

test('nearby rail audio layers the CC0 rail, impact and explosion samples',()=>{
 assert.match(sound,/this\.play\('rail',\{gain:\.78,rate:\.58\}\)/);
 assert.match(sound,/this\.play\('impact'/);
 assert.match(sound,/this\.play\('explosionLarge'/);
});
