import * as THREE from 'three';

// 700T photographs: TLife driver's cab, THSR car services, Wikimedia standard cabin.
// All dimensions below are artist-estimated for the game, not manufacturer CAD.
export const CABIN_LAYOUT=Object.freeze({
 standard:{seats:[2,3],pitch:1.04,seatWidth:.435,aisle:.58,rows:18,centerZ:-112.5},
 business:{seats:[2,2],pitch:1.16,seatWidth:.53,aisle:.69,rows:16,centerZ:-12.5}
});
export const isInteriorMode=mode=>['cab','standard','business','standardSeat','businessSeat'].includes(mode);
export function aisleCenter(layout){return (layout.seats[0]-layout.seats[1])*(layout.seatWidth+.018)/2;}
export function seatCenters(layout){
 const xs=[],step=layout.seatWidth+.018,center=aisleCenter(layout);
 for(let side=0;side<2;side++)for(let j=0;j<layout.seats[side];j++)xs.push(center+(side===0?-1:1)*(layout.aisle/2+layout.seatWidth/2+j*step));
 return xs;
}
export function passengerPose(mode,walk=0){
 const business=mode.startsWith('business'),l=CABIN_LAYOUT[business?'business':'standard'];
 const seat=mode.endsWith('Seat');
 let z=Math.max(-8.7,Math.min(8.7,walk));
 const center=aisleCenter(l),xs=seatCenters(l);
 if(seat){const row=Math.max(0,Math.min(l.rows-1,Math.round(z/l.pitch+(l.rows-1)/2)));z=(row-(l.rows-1)/2)*l.pitch-.20;}
 const x=seat?Math.min(...xs):center;
 return {position:[x,seat?2.45:2.97,l.centerZ+z],target:[seat?-3.5:center,seat?2.67:2.85,l.centerZ+z-(seat?1.0:8)],fov:seat?64:70};
}
const material=(color,opts={})=>new THREE.MeshStandardMaterial({color,roughness:.72,...opts});
function mesh(parent,geom,mat,x,y,z){
 const m=new THREE.Mesh(geom,mat);m.position.set(x,y,z);parent.add(m);return m;
}
function box(p,w,h,d,m,x=0,y=0,z=0){return mesh(p,new THREE.BoxGeometry(w,h,d),m,x,y,z);}
function rounded(p,w,h,d,r,m,x,y,z){
 const s=new THREE.Shape(),a=w/2,b=h/2;r=Math.min(r,a,b);
 s.moveTo(-a+r,-b);s.lineTo(a-r,-b);s.quadraticCurveTo(a,-b,a,-b+r);s.lineTo(a,b-r);s.quadraticCurveTo(a,b,a-r,b);s.lineTo(-a+r,b);s.quadraticCurveTo(-a,b,-a,b-r);s.lineTo(-a,-b+r);s.quadraticCurveTo(-a,-b,-a+r,-b);
 const g=new THREE.ExtrudeGeometry(s,{depth:d,bevelEnabled:true,bevelSize:.018,bevelThickness:.018,bevelSegments:2,curveSegments:5});g.translate(0,0,-d/2);
 return mesh(p,g,m,x,y,z);
}
function canvasTexture(w,h,draw){
 const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}
function fabric(business){
 return canvasTexture(128,128,(c,w,h)=>{
  c.fillStyle=business?'#78394e':'#477f81';c.fillRect(0,0,w,h);
  for(let y=0;y<h;y+=16)for(let x=0;x<w;x+=16){
   const off=(y/16%2)*8;c.fillStyle=business?'#995c70':'#95ad9c';c.globalAlpha=.48;
   c.beginPath();c.moveTo(x+off,y+2);c.lineTo(x+off+9,y+5);c.lineTo(x+off+3,y+11);c.closePath();c.fill();
   c.globalAlpha=.19;c.fillStyle='#e6dfd2';c.fillRect(x+off+3,y+1,1,8);
  }c.globalAlpha=1;
 });
}
function floorTexture(business){
 const t=canvasTexture(128,128,(c,w,h)=>{
  c.fillStyle=business?'#3b4654':'#5b5954';c.fillRect(0,0,w,h);
  let seed=71;for(let i=0;i<1800;i++){seed=(1664525*seed+1013904223)>>>0;const x=seed%128;seed=(1664525*seed+1013904223)>>>0;const y=seed%128;c.fillStyle=i%3?'#a8aaa3':'#282e33';c.globalAlpha=business?.10:.24;c.fillRect(x,y,1+i%2,1);}
 });t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(4,28);return t;
}
function sign(p,label,w,h,x,y,z){
 const tex=canvasTexture(512,96,(c)=>{c.fillStyle='#19272c';c.fillRect(0,0,512,96);c.fillStyle='#ffb446';c.font='bold 38px sans-serif';c.textAlign='center';c.fillText(label,256,60);});
 return mesh(p,new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:tex}),x,y,z);
}
function tube(p,points,r,m){const curve=new THREE.CatmullRomCurve3(points.map(v=>new THREE.Vector3(...v)));return mesh(p,new THREE.TubeGeometry(curve,24,r,8,false),m,0,0,0);}
function seatTemplate(business,m){
 const g=new THREE.Group(),w=business?.53:.435;
 // Upholstered seat pan and high back, curved by a bevel and slight recline.
 const cushion=rounded(g,w,.17,.50,.065,m.fabric,0,1.78,0);cushion.rotation.x=-.06;
 const back=rounded(g,w,.80,.15,.09,m.fabric,0,2.22,.19);back.rotation.x=-.10;
 const head=rounded(g,w*.81,.23,.035,.025,m.cloth,0,2.47,.095);head.rotation.x=-.1;
 rounded(g,w*.89,.65,.045,.04,m.plastic,0,2.20,.29);
 rounded(g,w*.76,.31,.028,.025,m.tray,0,2.24,.328);
 box(g,.11,.035,.025,m.dark,0,2.36,.350);
 // A shallow mesh-patterned literature pouch, not an opaque protrusion.
 rounded(g,w*.76,.20,.025,.03,m.net,0,1.99,.328);
 for(const x of [-w/2,w/2]){
  rounded(g,.054,.055,.42,.02,m.arm,x,1.99,-.02);
  box(g,.055,.29,.055,m.plastic,x,1.85,.14);
 }
 box(g,w*.69,.36,.13,m.leg,0,1.51,.03);
 box(g,w*.8,.08,.39,m.leg,0,1.30,.03);
 if(business)box(g,w*.70,.06,.20,m.arm,0,1.51,.44);
 return g;
}
export function buildPassengerInterior(business=false){
 const name=business?'business':'standard',l=CABIN_LAYOUT[name],root=new THREE.Group();root.name=name+' 700T cabin';root.position.z=l.centerZ;
 const wall=material(0xe4e2d8),frame=material(0xc4c7c5),dark=material(0x343f42),trim=material(business?0x783b57:0x34788c),metal=material(0x8d9597,{metalness:.40}),ceiling=material(0xf0eee6);
 const glow=new THREE.MeshBasicMaterial({color:0xfff6e6});
 const fm=floorTexture(business);
 box(root,3.02,.12,23.0,material(0xffffff,{map:fm}),0,1.23,0);
 // Continuous curved ceiling: segment profile with a slightly lower shoulder.
 const arch=[[-1.50,3.70],[-1.30,3.94],[-.92,4.06],[-.48,4.11],[0,4.12],[.48,4.11],[.92,4.06],[1.30,3.94],[1.50,3.70]];
 const vv=[],ii=[];for(const z of [-11.5,11.5])for(const [x,y] of arch)vv.push(x,y,z);
 for(let i=0;i<arch.length-1;i++)ii.push(i,i+1,i+arch.length,i+1,i+1+arch.length,i+arch.length);
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vv,3));geo.setIndex(ii);geo.computeVertexNormals();ceiling.side=THREE.DoubleSide;mesh(root,geo,ceiling,0,0,0);
 const windowGlass=new THREE.MeshPhysicalMaterial({color:0xaed3e0,transparent:true,opacity:.10,roughness:.13,depthWrite:false,side:THREE.DoubleSide});
 for(const side of [-1,1]){
  const x=side*1.50;
  box(root,.095,1.24,23,wall,x,1.93,0);
  box(root,.095,.78,23,wall,x,3.54,0);
  // Windows are literal apertures: wall posts between each glazing bay.
  const bays=10,spacing=2.12;
  for(let i=0;i<bays;i++){
   const z=(i-(bays-1)/2)*spacing;
   box(root,.11,.91,.46,wall,x,2.79,z+spacing/2);
   // Open glazing framed by slim rails.
   for(const dz of [-.82,.82])box(root,.13,.94,.07,frame,x,2.79,z+dz);
   for(const yy of [2.31,3.27])box(root,.13,.065,1.68,frame,x,yy,z);
   box(root,.013,.88,1.65,windowGlass,x+side*.012,2.79,z);
   box(root,.12,.07,1.66,metal,x-side*.05,2.30,z);
   box(root,.12,.075,1.66,frame,x-side*.06,3.28,z);
  }
  // Close the narrow remaining end sections.
  for(const z of [-11.06,11.06])box(root,.10,.92,.90,wall,x,2.79,z);
  box(root,.10,.08,23,trim,x-side*.055,3.30,0);
  // Open shelf luggage rack, colored lip and metal underside.
  box(root,.54,.075,22.2,metal,side*1.21,3.52,0);
  box(root,.085,.19,22.2,trim,side*.96,3.59,0);
  for(let z=-10.5;z<=10.6;z+=1.06)box(root,.56,.065,.043,frame,side*1.20,3.46,z);
  box(root,.11,.045,22.6,glow,side*.75,3.99,0);
  if(business)for(let z=-10;z<11;z+=1.15)box(root,.14,.028,.27,glow,side*.47,4.05,z);
  else box(root,.16,.035,22.4,glow,side*.46,4.09,0);
 }
 if(!business)for(let z=-11;z<11;z+=.17)box(root,.64,.018,.034,frame,0,4.085,z);
 else for(let z=-10.7;z<11;z+=1.14){
  tube(root,[[-.43,4.08,z],[0,4.025,z+.13],[.43,4.08,z]],.023,frame);
 }
 // End bulkheads, glazed sliding gangway door and amber information display.
 for(const end of [-1,1]){
  const z=end*11.5;
  box(root,.99,2.86,.12,wall,-1.02,2.70,z);
  box(root,.99,2.86,.12,wall,1.02,2.70,z);
  box(root,1.06,.55,.12,wall,0,3.86,z);
  box(root,1.02,2.25,.08,frame,0,2.43,z);
  rounded(root,.55,1.1,.035,.12,material(0x44606b,{metalness:.15}),0,2.70,z-end*.065);
  box(root,.06,.30,.075,metal,.42,2.36,z-end*.07);
  const label=sign(root,(business?'6 商務車廂':'2 標準車廂')+'  •  THSR',1.21,.19,0,3.78,z-end*.08);if(end>0)label.rotation.y=Math.PI;
  for(let k=0;k<3;k++)box(root,.15,.11,.06,trim,end*.98,2.98-k*.19,z-end*.08);
 }
 const mat={fabric:material(0xffffff,{map:fabric(business)}),cloth:material(0xf4f1e8),plastic:material(0xc3c5bf),tray:material(0xa6aaa6),net:material(business?0x754353:0x57716f,{roughness:1}),dark,arm:material(0x878d8a),leg:material(0x656f72)};
 const template=seatTemplate(business,mat);
 // Instanced parts reduce draw calls for dozens of detailed seats.
 const positions=[],w=l.seatWidth,step=w+.018;
 for(let i=0;i<l.rows;i++){
  const z=(i-(l.rows-1)/2)*l.pitch;
  for(let side=0;side<2;side++){
   const n=l.seats[side],sg=side===0?-1:1;
   for(let j=0;j<n;j++)positions.push([aisleCenter(l)+sg*(l.aisle/2+w/2+j*step),0,z]);
  }
 }
 template.updateMatrixWorld(true);
 for(const part of template.children){
  const inst=new THREE.InstancedMesh(part.geometry,part.material,positions.length);
  const matrix=new THREE.Matrix4();
  positions.forEach((p,i)=>{matrix.makeTranslation(...p).multiply(part.matrix);inst.setMatrixAt(i,matrix);});
  inst.instanceMatrix.needsUpdate=true;root.add(inst);
 }
 const light=new THREE.HemisphereLight(0xfff8eb,0xb6b4b2,1.45);root.add(light);
 root.visible=false;return root;
}
export function buildDriverInterior(){
 const root=new THREE.Group();root.name='700T photo-referenced 3D cab';root.position.z=-145;
 const shell=material(0x536b7b),dash=material(0x26343e),edge=material(0x18252e),panel=material(0x384a55),rubber=material(0x151c20),metal=material(0x9da5a9,{metalness:.35});
 box(root,2.88,.12,4.0,shell,0,1.24,-.15);
 // Wide, unobstructed opening between upper brow and instrument console.
 box(root,2.94,.22,3.75,shell,0,4.21,-.12);
 box(root,2.96,.23,.52,edge,0,3.98,-2.03);
 for(const side of [-1,1]){
  box(root,.10,2.65,2.25,shell,side*1.46,2.68,.72);
  box(root,.12,1.47,1.80,shell,side*1.46,2.04,-1.25);
  box(root,.11,.26,1.90,edge,side*1.46,3.90,-1.25);
  const pillar=box(root,.18,1.05,.24,shell,side*1.34,3.52,-1.99);pillar.rotation.z=side*.14;
  box(root,.11,.13,1.7,edge,side*1.44,3.00,-1.17);
  const pane=new THREE.MeshPhysicalMaterial({color:0xb8d5e5,transparent:true,opacity:.07,side:THREE.DoubleSide,depthWrite:false});
  box(root,.012,.69,1.77,pane,side*1.45,3.49,-1.24);
 }
 box(root,2.91,2.78,.13,shell,0,2.68,1.82);
 // Curved segmented console face, laid out in a broad wraparound shape.
 rounded(root,2.79,.68,.58,.10,dash,0,2.46,-1.29);
 rounded(root,2.79,.13,.90,.07,edge,0,2.84,-.92);
 rounded(root,1.86,.13,.63,.05,panel,0,2.93,-1.28);
 for(const side of [-1,1]){
  const sideDesk=rounded(root,.59,.15,1.05,.05,dash,side*1.10,2.87,-.63);sideDesk.rotation.y=side*.18;
  box(root,.53,.75,.52,panel,side*1.10,2.08,-.90);
 }
 const displayTex=[];
 for(let i=0;i<3;i++){
  const x=(i-1)*.67,z=-1.39;
  const frame=rounded(root,.62,.45,.09,.045,edge,x,3.09,z);frame.rotation.x=-.16;
  const canvas=document.createElement('canvas');canvas.width=384;canvas.height=256;
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const screen=mesh(root,new THREE.PlaneGeometry(.54,.37),new THREE.MeshBasicMaterial({map:texture}),x,3.09,z+.06);screen.rotation.x=-.16;
  displayTex.push({canvas,texture});
 }
 for(const side of [-1,1]){
  for(let i=0;i<3;i++)for(let j=0;j<3;j++){
   const x=side*(.95+i*.105),z=-.87+j*.11;
   box(root,.065,.035,.075,edge,x,2.97,z);
   box(root,.042,.018,.045,material((i+j)%4===0?0xd4a52e:(i+j)%3===0?0x52a879:0xb9c3c3),x,2.995,z);
  }
 }
 const handles=[];
 for(const x of [-.43,.51]){
  box(root,.28,.075,.42,rubber,x,3.00,-.72);
  const pivot=new THREE.Group();pivot.position.set(x,3.04,-.72);root.add(pivot);
  const shaft=box(pivot,.075,.24,.075,metal,0,.12,0);
  rounded(pivot,.20,.085,.115,.03,edge,0,.26,0);handles.push(pivot);
 }
 // Driver's fabric seat behind camera, rear equipment cabinet and cab door.
 const chair=seatTemplate(false,{fabric:material(0xffffff,{map:fabric(false)}),cloth:material(0xc1d1d2),plastic:panel,tray:panel,net:panel,dark:edge,arm:edge,leg:metal});
 chair.position.set(-.40,0,1.10);root.add(chair);
 rounded(root,.64,2.1,.08,.05,panel,.83,2.51,1.73);box(root,.055,.28,.08,metal,1.05,2.36,1.64);
 // Thin wipers against the edge of the windshield; no opaque front sheet.
 for(const x of [-.95,.74])tube(root,[[x,3.05,-2.03],[x+.22,3.33,-2.05],[x+.32,3.65,-2.06]],.014,edge);
 const lamp=new THREE.HemisphereLight(0xddebf5,0x8b9aa8,.78);root.add(lamp);
 let last='';
 function update(speed,power,brake,doors){
  handles[0].rotation.x=-power*.095;handles[1].rotation.x=brake*.066;
  const key=[Math.round(speed),power,brake,!!doors].join(',');if(key===last)return;last=key;
  for(let i=0;i<displayTex.length;i++){
   const {canvas,texture}=displayTex[i],c=canvas.getContext('2d');c.fillStyle='#142721';c.fillRect(0,0,384,256);
   c.fillStyle='#8accab';c.font='19px sans-serif';c.fillText(['TRAIN STATUS','SPEED / km/h','DRIVE MONITOR'][i],18,29);
   c.strokeStyle='#456c5c';c.strokeRect(12,42,360,199);
   if(i===1){c.fillStyle='#d4ecd4';c.font='bold 94px monospace';c.fillText(String(Math.round(speed)).padStart(3,'0'),28,151);c.fillStyle='#8accab';c.fillRect(25,184,Math.min(330,speed/300*330),14);}
   else if(i===0){c.font='25px monospace';c.fillText('DOOR '+(doors?'OPEN':'CLOSED'),24,83);c.fillText('SYSTEM  READY',24,131);c.fillText('SIMULATION',24,178);}
   else{c.font='28px monospace';c.fillText('POWER  P'+power,25,89);c.fillText('BRAKE  B'+brake,25,143);c.fillText('MANUAL',25,198);}
   texture.needsUpdate=true;
  }
 }
 update(0,0,0,true);root.visible=false;return {root,update};
}
