import {noseSurfacePoint} from './geometry-700t.mjs';
export const DOOR_WIDTH=1.24, DOOR_BOTTOM=1.175, DOOR_TOP=3.305, DOOR_TRAVEL=.64;
export function doorPosition(car){return car.isRear?car.bodyStart+2.25:car.bodyEnd-(car.isFront?2.25:2.20);}
export function doorOffset(level){return DOOR_TRAVEL*Math.max(0,Math.min(1,level));}
// Clip each cross-section edge against an exact height interval. Both sides
// use the same contour as the existing body; nothing opaque spans the opening.
export function skinStrip(z0,z1,{side=0,yMin=-Infinity,yMax=Infinity,offset=0}={}){
 const vertices=[],indices=[],segments=64;
 if(z1<=z0)return {vertices,indices};
 for(let j=0;j<segments;j++){
  const a=noseSurfacePoint(0,j/segments*Math.PI*2,0,1),b=noseSurfacePoint(0,(j+1)/segments*Math.PI*2,0,1);
  if(side&&(a[0]+b[0])*side<=0)continue;
  const dy=b[1]-a[1];let lo=0,hi=1;
  if(Math.abs(dy)<1e-10){if(a[1]<yMin||a[1]>yMax)continue;}
  else {const t0=(yMin-a[1])/dy,t1=(yMax-a[1])/dy;lo=Math.max(0,Math.min(t0,t1));hi=Math.min(1,Math.max(t0,t1));}
  if(hi-lo<1e-8)continue;
  const point=t=>{const x=a[0]+(b[0]-a[0])*t,y=a[1]+dy*t;return [x+Math.sign(x)*offset,y];};
  const p=point(lo),q=point(hi),n=vertices.length/3;
  vertices.push(...p,z0,...q,z0,...p,z1,...q,z1);
  indices.push(n,n+1,n+2,n+1,n+3,n+2);
 }
 return {vertices,indices};
}
export function bodySkin(depth,doorCenter){
 if(!Number.isFinite(doorCenter))return skinStrip(0,depth);
 const lo=doorCenter-DOOR_WIDTH/2,hi=doorCenter+DOOR_WIDTH/2;
 const parts=[skinStrip(0,lo),skinStrip(lo,hi,{yMax:DOOR_BOTTOM}),skinStrip(lo,hi,{yMin:DOOR_TOP}),skinStrip(hi,depth)];
 const vertices=[],indices=[];
 for(const p of parts){const n=vertices.length/3;vertices.push(...p.vertices);indices.push(...p.indices.map(i=>i+n));}
 return {vertices,indices};
}
