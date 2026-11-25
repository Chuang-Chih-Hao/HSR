import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {CAR_LENGTHS_700T,TRAIN_LENGTH_700T,NOSE_LENGTH_700T,CAR_WIDTH_700T,CAR_HEIGHT_700T,
  NOSE_SECTIONS_700T,create700TCarLayout,noseSectionAt,noseSurfacePoint} from '../public/geometry-700t.mjs';
const root=dirname(dirname(fileURLToPath(import.meta.url)));
const sim=readFileSync(join(root,'public/simulator.js'),'utf8');

test('700T prototype dimensions are represented in the shared modelling scale',()=>{
  assert.equal(CAR_LENGTHS_700T.length,12);
  assert.equal(TRAIN_LENGTH_700T,304);
  assert.deepEqual(CAR_LENGTHS_700T,[27,...Array(10).fill(25),27]);
  assert.equal(CAR_WIDTH_700T,3.38);
  assert.equal(CAR_HEIGHT_700T,3.65);
  assert.equal(NOSE_LENGTH_700T,8);
});
test('each 8m nose fits INSIDE the 27m end cars; no attached nose extension',()=>{
  const cars=create700TCarLayout();
  assert.equal(cars.length,12);
  assert.equal(cars[0].bodyLength,19);
  assert.equal(cars.at(-1).bodyLength,19);
  assert.equal(cars[0].centerZ+cars[0].noseAnchor-NOSE_LENGTH_700T,-152);
  assert.equal(cars.at(-1).centerZ+cars.at(-1).noseAnchor+NOSE_LENGTH_700T,152);
  assert.equal(cars[0].bodyStart, -5.5);
  assert.equal(cars.at(-1).bodyEnd,5.5);
  for(let i=0;i<11;i++){
    const right=cars[i].centerZ+cars[i].length/2;
    const left=cars[i+1].centerZ-cars[i+1].length/2;
    assert.ok(Math.abs(right-left)<1e-7,`cars ${i+1} and ${i+2} connect`);
  }
});
test('nose roof slopes steadily without an abnormal needle or point in mid-course',()=>{
  assert.equal(NOSE_SECTIONS_700T.at(-1)[0],8);
  let lastTop=Infinity;
  for(let d=0;d<=8;d+=.05){
    const [,w,bottom,top]=noseSectionAt(d);
    assert.ok(w>=.14-1e-6&&w<=1.8,`width at ${d} is reasonable ${w}`);
    assert.ok(bottom<top,`section at ${d} must not invert`);
    assert.ok(top<=lastTop+.003,`roof profile has no bump at ${d}`);
    lastTop=top;
    if(d<=3.3)assert.ok(w>=1.47,`nose shoulder at d=${d}`);
  }
});
test('leading and trailing nose geometry have matching longitudinal symmetry',()=>{
  const [first,...rest]=create700TCarLayout();const last=rest.at(-1);
  for(const d of [0,.8,2,3.5,5.5,7.5,8]){
    for(const angle of [0,.4,Math.PI/2,3,5]){
      const front=noseSurfacePoint(d,angle,first.noseAnchor,-1);
      const rear=noseSurfacePoint(d,angle,last.noseAnchor,1);
      assert.ok(Math.abs(front[0]-rear[0])<1e-9);
      assert.ok(Math.abs(front[1]-rear[1])<1e-9);
      assert.ok(Math.abs(front[2]+rear[2])<1e-9);
    }
  }
});
test('full train body layout, camera and 334m platform follow the 304m dimensions',()=>{
  assert.match(sim,/create700TCarLayout\(\)/);
  assert.match(sim,/new THREE\.Mesh\(makeCarProfile\(bodyLength\)/);
  assert.match(sim,/buildNose\(group,isFront,car\.noseAnchor\)/);
  assert.match(sim,/box\(group,PLATFORM_WIDTH,\.76,334,materials\.concrete/);
  assert.doesNotMatch(sim,/buildNose\(root,true,-89\.7\)/);
  assert.doesNotMatch(sim,/\[11\.7,\.55/);
  assert.match(sim,/nose:\[16,8,-173\]/);
});

test('nose lip is sealed and both end caps use mirrored winding',()=>{
  assert.match(sim,/const cap=verts.length\/3/);
  assert.match(sim,/if\(isLeading\)tri.push\(cap,m,n\);else tri.push\(cap,n,m\)/);
  assert.ok(noseSectionAt(7)[1]<.85,'taper toward the rounded tip rather than a wide duckbill');
});
