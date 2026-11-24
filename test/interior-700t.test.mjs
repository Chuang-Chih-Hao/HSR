import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CABIN_LAYOUT,isInteriorMode,passengerPose,aisleCenter,seatCenters} from '../public/interior-700t.mjs';
test('700T standard 2+3 and business 2+2 fit the interior width',()=>{
 for(const [name,l] of Object.entries(CABIN_LAYOUT)){assert.equal(l.seats.reduce((a,b)=>a+b),name==='standard'?5:4);assert.ok(l.aisle+l.seatWidth*l.seats.reduce((a,b)=>a+b)+.018*(l.seats.reduce((a,b)=>a+b)-2)<3);assert.ok(l.rows*l.pitch<23);}
});
test('all cabin camera poses stay within the representative car',()=>{
 for(const mode of ['standard','business','standardSeat','businessSeat'])for(const walk of [-100,-8,0,8,100]){
  const p=passengerPose(mode,walk);const l=CABIN_LAYOUT[mode.startsWith('business')?'business':'standard'];
  assert.ok(Math.abs(p.position[2]-l.centerZ)<=9.1);assert.ok(Math.abs(p.position[0])<1.5);assert.ok(isInteriorMode(mode));assert.ok(p.position[1]>1.3&&p.position[1]<4.1);
 }
 assert.equal(isInteriorMode('follow'),false);assert.equal(isInteriorMode('cab'),true);
});
test('simulator uses actual meshes and live driver displays',()=>{
 const js=readFileSync(new URL('../public/simulator.js',import.meta.url),'utf8'),model=readFileSync(new URL('../public/interior-700t.mjs',import.meta.url),'utf8'),page=readFileSync(new URL('../public/simulator.html',import.meta.url),'utf8');
 assert.match(js,/this\.cab3D\.update\(this\.speed,this\.power,this\.brake,this\.doorsOpen\)/);
 assert.match(js,/this\.train\.root\.visible=!interior/);
 assert.match(model,/new THREE\.InstancedMesh/);assert.match(model,/new THREE\.CanvasTexture/);
 for(const m of ['standard','business','standardSeat','businessSeat'])assert.ok(page.includes('value="'+m+'"'));
});

test('asymmetric seating shifts the aisle and all seat edges fit inside walls',()=>{for(const l of Object.values(CABIN_LAYOUT)){const xs=seatCenters(l);for(const x of xs)assert.ok(Math.abs(x)+l.seatWidth/2+.027<1.50);assert.ok(xs.every(x=>Math.abs(x-aisleCenter(l))>=l.aisle/2+l.seatWidth/2-1e-8));}assert.ok(aisleCenter(CABIN_LAYOUT.standard)<0);assert.equal(aisleCenter(CABIN_LAYOUT.business),0);});
