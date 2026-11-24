// Artist-estimated track-relative platform geometry; not as-built survey data.
export const PLATFORM_EDGE=1.92, PLATFORM_TOP=1.12, PLATFORM_WIDTH=9, TRACK_SPACING=5.2;
export const SIDE_STYLES=Object.freeze(['slope','landscape','wave','flower','grid','wing']);
export const sideLayout=p=>SIDE_STYLES.includes(p.style);
export const platformShift=(p,side)=>sideLayout(p)&&side<0?-3*TRACK_SPACING:0;
export function stationTrackCenters(p){
 if(sideLayout(p))return [0,-TRACK_SPACING,-2*TRACK_SPACING,-3*TRACK_SPACING];
 if(p.underground)return [0];
 return p.tracks===6?[0,-15,-20,15,20,26]:[0,-15,15,20];
}
// Bounds include object extents, not just root positions. Inclusive with buffer.
export function overlapsStation(object,station,padding=1){
 return object.minX<=station.maxX+padding&&object.maxX>=station.minX-padding&&object.minZ<=station.maxZ+padding&&object.maxZ>=station.minZ-padding;
}
export function translateBounds(b,x,z){return {minX:b.minX+x,maxX:b.maxX+x,minZ:b.minZ+z,maxZ:b.maxZ+z};}
