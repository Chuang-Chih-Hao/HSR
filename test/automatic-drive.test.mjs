import test from 'node:test';
import assert from 'node:assert/strict';
import {automaticNotches,stepManualDrive,withinStopZone,LEG_DISTANCE,STOP_LATE} from '../public/sim-core.mjs';
test('automatic control stops inside station window under dry and wet physics',()=>{
 for(const rain of [false,true])for(const dt of [.016,.033,.06])for(const initial of [{speed:0,distance:0},{speed:180,distance:380},{speed:40,distance:900}]){
  let p={...initial},stopped=false;
  for(let i=0;i<Math.ceil(250/dt);i++){
   const n=automaticNotches(p,{rain});assert.ok(n.power===0||n.brake===0);
   p=stepManualDrive({...p,...n},dt,{rain});assert.ok(p.distance<=LEG_DISTANCE+STOP_LATE);
   if(withinStopZone(p.distance,p.speed)){stopped=true;break;}
  }
  assert.ok(stopped,JSON.stringify({rain,dt,initial,p}));
 }
});
