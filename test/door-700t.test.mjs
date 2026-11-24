import test from 'node:test';
import assert from 'node:assert/strict';
import {create700TCarLayout} from '../public/geometry-700t.mjs';
import {bodySkin,skinStrip,doorPosition,doorOffset,DOOR_WIDTH,DOOR_BOTTOM,DOOR_TOP} from '../public/door-700t.mjs';
test('all 12 cars have literal holes in both sides of the skin',()=>{
 for(const car of create700TCarLayout()){
  const z=doorPosition(car)-car.bodyStart,g=bodySkin(car.bodyLength,z);
  for(let i=0;i<g.indices.length;i+=3){
   const p=g.indices.slice(i,i+3).map(k=>g.vertices.slice(k*3,k*3+3));
   const y=p.reduce((a,v)=>a+v[1],0)/3,zz=p.reduce((a,v)=>a+v[2],0)/3;
   assert.ok(!(Math.abs(zz-z)<DOOR_WIDTH/2&&y>DOOR_BOTTOM+1e-6&&y<DOOR_TOP-1e-6));
  }
 }
});
test('curved leaves cover the opening when shut and clear it fully when open',()=>{
 assert.equal(doorOffset(0),0);assert.ok(doorOffset(1)>=DOOR_WIDTH/2);
 for(const side of [-1,1])assert.ok(skinStrip(-DOOR_WIDTH/4,DOOR_WIDTH/4,{side,yMin:DOOR_BOTTOM,yMax:DOOR_TOP}).indices.length>0);
});
