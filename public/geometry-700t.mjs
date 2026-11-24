/**
 * THSR 700T educational display geometry. 1 world unit ~ 1 metre.
 * End cars: 27 m, intermediate cars: 25 m, 12 cars: 304 m.
 * Nose length: about 8 m IN the end-car length, not added to it.
 * Neither the cross-section control points nor trim are original manufacturer CAD.
 * Sources: Taiwan High Speed Rail vehicle specifications and 700T reference photographs.
 */
export const CAR_LENGTHS_700T = Object.freeze([27, ...Array(10).fill(25), 27]);
export const TRAIN_LENGTH_700T = CAR_LENGTHS_700T.reduce((sum, length) => sum + length, 0);
export const NOSE_LENGTH_700T = 8;
export const CAR_WIDTH_700T = 3.38;
export const CAR_HEIGHT_700T = 3.65;

const HALF_WIDTH=CAR_WIDTH_700T/2;
const BASE_Y=0.88;
const ROOF_Y=BASE_Y+CAR_HEIGHT_700T;

// d metres forward of the carbody/nose join, half-width, bottom y, top y.
// Padded shoulders, nearly flat lower lip and rounded nose replace the old
// long cone shape. Control points are artist-made, not official 700T CAD.
export const NOSE_SECTIONS_700T = Object.freeze([
  [0.0, HALF_WIDTH, BASE_Y, ROOF_Y],
  [0.65, 1.70, 0.90, 4.50],
  [1.45, 1.69, 0.91, 4.37],
  [2.35, 1.65, 0.93, 4.13],
  [3.30, 1.58, 0.95, 3.80],
  [4.25, 1.52, 0.98, 3.42],
  [5.20, 1.43, 1.01, 3.04],
  [6.20, 1.36, 1.05, 2.64],
  [7.00, 1.22, 1.10, 2.28],
  [7.53, 1.00, 1.14, 1.98],
  [7.82, 0.72, 1.19, 1.79],
  [7.97, 0.42, 1.25, 1.60],
  [8.00, 0.24, 1.30, 1.49]
]);

// Equally spaced cars at prototype metre lengths, with each end-car nose
// replacing the front 8 metres of its body rather than extending past it.
export function create700TCarLayout() {
  let position=-TRAIN_LENGTH_700T/2;
  return CAR_LENGTHS_700T.map((length,index)=>{
    const centerZ=position+length/2;
    const isFront=index===0;
    const isRear=index===CAR_LENGTHS_700T.length-1;
    const bodyStart= isFront ? -length/2+NOSE_LENGTH_700T : -length/2;
    const bodyEnd  = isRear ? length/2-NOSE_LENGTH_700T : length/2;
    const car={index, length, centerZ, isFront, isRear,
      bodyStart, bodyEnd, bodyLength:bodyEnd-bodyStart,
      noseAnchor:isFront?bodyStart:isRear?bodyEnd:null,
      noseDirection:isFront?-1:isRear?1:0};
    position+=length;
    return car;
  });
}

function slope(points,k,i){
  const before=points[Math.max(i-1,0)],at=points[i],after=points[Math.min(i+1,points.length-1)];
  if(i===0)return (after[k]-at[k])/(after[0]-at[0]);
  if(i===points.length-1)return (at[k]-before[k])/(at[0]-before[0]);
  const s0=(at[k]-before[k])/(at[0]-before[0]);
  const s1=(after[k]-at[k])/(after[0]-at[0]);
  if(s0*s1<=0)return 0;
  return 2*s0*s1/(s0+s1); // harmonic slope: avoid overshooting monotonic sections
}
export function noseSectionAt(distance){
  const d=Math.max(0,Math.min(NOSE_LENGTH_700T,Number(distance)||0));
  const points=NOSE_SECTIONS_700T;
  if(d===0)return [...points[0]];
  if(d>=NOSE_LENGTH_700T)return [...points.at(-1)];
  let i=0;
  while(i<points.length-2 && points[i+1][0]<d)i++;
  const a=points[i],b=points[i+1],span=b[0]-a[0],t=(d-a[0])/span;
  const h00=2*t*t*t-3*t*t+1,h10=t*t*t-2*t*t+t;
  const h01=-2*t*t*t+3*t*t,h11=t*t*t-t*t;
  return [d,...[1,2,3].map(k=>h00*a[k]+h10*span*slope(points,k,i)+h01*b[k]+h11*span*slope(points,k,i+1))];
}
export function noseSurfacePoint(distance,angle,anchor,sign,offset=0){
  const [,width,bottom,top]=noseSectionAt(distance);
  const sectionFraction=Math.min(1,distance/NOSE_LENGTH_700T);
  const shoulderExponent=.48+.38*sectionFraction;
  const verticalExponent=.53+.38*sectionFraction;
  const cs=Math.cos(angle),sn=Math.sin(angle);
  const x=width*Math.sign(cs)*Math.pow(Math.abs(cs),shoulderExponent)+offset*cs;
  const y=(top+bottom)/2+(top-bottom)/2*Math.sign(sn)*Math.pow(Math.abs(sn),verticalExponent)+offset*sn;
  const z=anchor+sign*distance;
  return [x,y,z];
}