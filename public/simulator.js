import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createItinerary, DIRECTION, ROUTE, LEG_DISTANCE, MAX_SPEED, stepManualDrive, estimateBrakingDistance, canOperateDoors, withinStopZone, speakableAnnouncement } from './sim-core.mjs';
import { create700TCarLayout, noseSurfacePoint, noseSectionAt, TRAIN_LENGTH_700T, NOSE_LENGTH_700T } from './geometry-700t.mjs';

import { buildDriverInterior, buildPassengerInterior, isInteriorMode, passengerPose } from './interior-700t.mjs';

const $ = id => document.getElementById(id);
const randomGenerator = (() => { let seed = 783021; return () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296); })();
const rnd = (a, b) => a + (b - a) * randomGenerator();
const materials = {
  white: new THREE.MeshPhysicalMaterial({ color: 0xf4f5f2, roughness: 0.35, metalness: 0.17, clearcoat: 0.42 }),
  orange: new THREE.MeshStandardMaterial({ color: 0xe66928, metalness: 0.15, roughness: .45 }),
  scarlet: new THREE.MeshStandardMaterial({ color: 0xb7431c, roughness: .55 }),
  roof: new THREE.MeshStandardMaterial({ color: 0xcad4d8, metalness: .38, roughness: .48 }),
  steel: new THREE.MeshStandardMaterial({ color: 0x64717d, metalness: .72, roughness: .41 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x101c27, roughness: .59, metalness: .14 }),
  underbody: new THREE.MeshStandardMaterial({color:0x5a6168,roughness:.75,metalness:.16}),
  glass: new THREE.MeshPhysicalMaterial({ color: 0x18314a, metalness: .38, roughness: .18, transparent: true, opacity: .92 }),
  lamp: new THREE.MeshStandardMaterial({ color: 0xfff2c9, emissive: 0xffd991, emissiveIntensity: 1.45 }),
  concrete: new THREE.MeshStandardMaterial({ color: 0x9babb3, roughness: .88 }),
  track: new THREE.MeshStandardMaterial({ color: 0x43515b, roughness: .9 }),
  grass: new THREE.MeshStandardMaterial({ color: 0x416c4c, roughness: 1 }),
  leaf: new THREE.MeshStandardMaterial({ color: 0x2d694d, roughness: 1 }),
  leafLight: new THREE.MeshStandardMaterial({ color: 0x3c805c, roughness: 1 }),
  bark: new THREE.MeshStandardMaterial({ color: 0x6a594a, roughness: 1 }),
  tunnel: new THREE.MeshStandardMaterial({ color: 0x56636e, roughness: 1, side: THREE.DoubleSide })
};
function box(parent, w, h, d, material, x = 0, y = 0, z = 0, cast = false) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = cast;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
function cylinder(parent, top, bottom, h, material, x=0, y=0, z=0, segments=10) {
  const obj = new THREE.Mesh(new THREE.CylinderGeometry(top, bottom, h, segments), material);
  obj.position.set(x,y,z);
  obj.castShadow=true;
  parent.add(obj);
  return obj;
}
function rod(parent, from, to, radius, material) {
  const start = new THREE.Vector3(...from), end = new THREE.Vector3(...to), offset = end.clone().sub(start);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, offset.length(), 7), material);
  mesh.position.copy(start.add(end).multiplyScalar(.5));
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), offset.normalize());
  parent.add(mesh);
  return mesh;
}
function makeSign(text, subText, w = 11) {
  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 256;
  const c = canvas.getContext('2d');
  c.fillStyle='#183349'; c.fillRect(0,0,1024,256);
  c.fillStyle='#ee742e'; c.fillRect(0,0,24,256);
  c.fillStyle='#ffffff';c.font='bold 116px sans-serif';c.textAlign='center';c.fillText(text,523,140);
  c.font='48px sans-serif';c.fillStyle='#b5d2e4';c.fillText(subText.toUpperCase(),523,210);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(w, w*.25),new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide}));
  return sign;
}

function makeCarProfile(depth) {
  // Straight body has exactly the same cross-sectional boundary as nose ring 0.
  // Matching vertex contours eliminates the seam visible on the old extruded
  // rectangle/capsule carbody at the nose-to-cab join.
  const vertices=[],indices=[],segments=64;
  for(const z of [0,depth])for(let j=0;j<segments;j++){
    const [x,y]=noseSurfacePoint(0,j/segments*Math.PI*2,0,1);
    vertices.push(x,y,z);
  }
  for(let j=0;j<segments;j++){
    const n=j,m=(j+1)%segments,p=n+segments,q=m+segments;
    indices.push(n,m,p,m,q,p);
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  g.setIndex(indices);g.computeVertexNormals();
  return g;
}

/** One continuous, mirrored, 8 m 700T-inspired loft per end car.
 * The head is SUBTRACTED from the 27 m end-car body, not tacked onto a 25 m coach.
 */
function buildNose(parent, isLeading, anchor) {
  const sign=isLeading?-1:1;
  const segments=64, rings=80, verts=[],tri=[];
  const surface=(d,a,offset=0)=>noseSurfacePoint(d,a,anchor,sign,offset);
  for(let i=0;i<=rings;i++){
    const d=i/rings*NOSE_LENGTH_700T;
    for(let j=0;j<segments;j++)verts.push(...surface(d,j/segments*Math.PI*2));
  }
  for(let i=0;i<rings;i++)for(let j=0;j<segments;j++){
    const u=i*segments+j,v=i*segments+(j+1)%segments;
    const w=(i+1)*segments+j,x=(i+1)*segments+(j+1)%segments;
    // Correct opposing normal directions for the two mirrored noses.
    if(isLeading)tri.push(u,w,v,v,w,x);else tri.push(u,v,w,v,x,w);
  }
  // Seal the broad rounded lip with a finite end face (both mirrored normals).
  const [, ,bottom,top]=noseSectionAt(NOSE_LENGTH_700T);
  const cap=verts.length/3;
  verts.push(0,(bottom+top)/2,anchor+sign*NOSE_LENGTH_700T);
  for(let j=0;j<segments;j++){
    const n=rings*segments+j,m=rings*segments+(j+1)%segments;
    if(isLeading)tri.push(cap,m,n);else tri.push(cap,n,m);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));
  geometry.setIndex(tri);geometry.computeVertexNormals();
  const shell=new THREE.Mesh(geometry,materials.white);
  shell.castShadow=true;shell.receiveShadow=true;
  parent.add(shell);

  // Procedurally conform trim directly to the exact interpolated skin. An
  // outward radial offset avoids z-fighting and floating squared-off bars.
  const patch=(start,end,angleA,angleB,material,offset=.015)=>{
    const v=[],faces=[],longSegments=48,across=20;
    for(let i=0;i<=longSegments;i++){
      const t=i/longSegments,d=start+(end-start)*t;
      for(let j=0;j<=across;j++){
        const a=(typeof angleA==='function'?angleA(t):angleA)*(1-j/across)+
                (typeof angleB==='function'?angleB(t):angleB)*(j/across);
        v.push(...surface(d,a,offset));
      }
    }
    for(let i=0;i<longSegments;i++)for(let j=0;j<across;j++){
      const n=i*(across+1)+j,m=n+across+1;
      faces.push(n,m,n+1,n+1,m,m+1);
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));
    g.setIndex(faces);g.computeVertexNormals();
    const obj=new THREE.Mesh(g,material);obj.material.side=THREE.DoubleSide;
    parent.add(obj);return obj;
  };
  // 700T uses a wide orange waist/sweeping cheek on BOTH sides; the white
  // central face remains visible. The two runs meet around the rounded lip.
  const upper=t=>-.12+.34*t*t,lower=t=>-.34-.46*t;
  patch(0,8,lower,upper,materials.orange,.035);
  patch(0,8,t=>Math.PI-upper(t),t=>Math.PI-lower(t),materials.orange,.035);
  patch(7.0,8,Math.PI+.38,Math.PI*2-.38,materials.orange,.038);
  // Dark, low under-nose pan is distinct from the orange side cheeks.
  patch(.0,7.55,Math.PI+1.07,Math.PI*2-1.07,materials.underbody,.018);

  const glass=new THREE.MeshPhysicalMaterial({color:0x142938,roughness:.12,
    metalness:.33,clearcoat:1,side:THREE.DoubleSide});
  // Convex windshield: broad near the roof/cab and gently tapers as the
  // glass follows the sloping upper surface. It is not a black rectangular box.
  const edge=t=>.53+.21*Math.pow(2*t-1,4);
  patch(.65,3.8,edge,t=>Math.PI-edge(t),glass,.038);
  const glazing=new THREE.MeshPhysicalMaterial({color:0x29495f,roughness:.15,metalness:.25,clearcoat:1,side:THREE.DoubleSide});
  const inner=t=>.67+.15*Math.pow(2*t-1,4);
  patch(.91,2.69,inner,t=>Math.PI-inner(t),glazing,.060);
  // Tiny non-illuminated central windscreen divider and a slim wiper.
  for(const a of [1.14,2.0])rod(parent,surface(1.39,a,.080),surface(2.62,a+.12,.080),.016,materials.dark);
  // Four lights are small recessed pairs BELOW the windscreen, rather than
  // two spherical headlights protruding from the tip.
  for(const side of [-1,1]){
    const a=side<0?Math.PI-1.37:.82,b=side<0?Math.PI-.82:1.37;
    patch(3.12,3.74,a,b,materials.dark,.060);
    const lampMat=isLeading?materials.lamp:new THREE.MeshStandardMaterial({color:0xca2424,emissive:0xa01111,emissiveIntensity:.8,side:THREE.DoubleSide});
    patch(3.23,3.61,a+.08,b-.08,lampMat,.078);
  }
  return shell;
}

function buildTrain(scene) {
  const root=new THREE.Group();root.name='THSR 700T | 304m / 12 carriages';scene.add(root);
  const doors=[],wheels=[];
  const layout=create700TCarLayout();
  for(const car of layout){
    const {index,centerZ,bodyStart,bodyEnd,bodyLength,isFront,isRear}=car;
    const group=new THREE.Group();group.name=`Car ${index+1} · ${car.length}m`;
    group.position.z=centerZ;root.add(group);
    const body=new THREE.Mesh(makeCarProfile(bodyLength),materials.white);
    body.position.z=bodyStart;body.castShadow=true;body.receiveShadow=true;group.add(body);
    const center=(bodyStart+bodyEnd)/2;
    // Continuous orange and lower grey strips stay ON the straight portion.
    for(const side of [-1,1]){
      box(group,.028,.37,bodyLength-.12,materials.orange,side*1.699,1.92,center);
      box(group,.031,.09,bodyLength-.12,materials.scarlet,side*1.718,1.685,center);
      const doorPos = isFront ? bodyEnd-2.25 : isRear ? bodyStart+2.25 : bodyEnd-2.20;
      for(let z=bodyStart+1.45;z<bodyEnd-1.25;z+=2.05){
        if(Math.abs(z-doorPos)<1.42)continue;
        box(group,.035,.76,1.26,materials.glass,side*1.704,3.12,z);
        box(group,.039,.065,1.32,materials.roof,side*1.727,3.55,z);
      }
      const doorLeft=box(group,.036,2.13,.62,materials.white,side*1.725,2.24,doorPos-.31);
      const doorRight=box(group,.036,2.13,.62,materials.white,side*1.725,2.24,doorPos+.31);
      box(doorLeft,.043,.66,.31,materials.glass,0,.32,.08);
      box(doorRight,.043,.66,.31,materials.glass,0,.32,-.08);
      doors.push({doorLeft,doorRight,closedLeft:doorLeft.position.z,closedRight:doorRight.position.z});
      box(group,.034,.045,1.9,materials.steel,side*1.725,1.19,doorPos);
    }
    box(group,2.75,.17,bodyLength-.35,materials.roof,0,4.56,center);
    box(group,2.5,.27,bodyLength-.38,materials.dark,0,.80,center);
    for(const wheelZ of [bodyStart+2.8,bodyEnd-2.8]){
      box(group,2.75,.40,2.65,materials.dark,0,.67,wheelZ);
      for(const side of [-1,1]){
        const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.45,.45,.18,18),materials.dark);
        wheel.rotation.z=Math.PI/2;wheel.position.set(side*1.39,.47,wheelZ);
        group.add(wheel);wheels.push(wheel);
      }
    }
    for(let z=bodyStart+2.4;z<bodyEnd-2;z+=4.6)box(group,1.55,.08,.15,materials.steel,0,4.73,z);
    if(isFront||isRear)buildNose(group,isFront,car.noseAnchor);
  }
  // Pantographs are on intermediate roofs rather than on the head car.
  for(const index of [4,7]){
    const pan=new THREE.Group();pan.position.set(0,4.74,layout[index].centerZ);root.add(pan);
    box(pan,2.3,.18,2.9,materials.dark,0,0,0);
    for(const x of [-.72,.72]){
      cylinder(pan,.24,.24,.37,materials.roof,x,.32,0,8);
      rod(pan,[x,.56,-.92],[x,1.37,.34],.065,materials.steel);
      rod(pan,[x,1.37,.34],[x,1.94,-.36],.065,materials.steel);
      rod(pan,[x,.56,.92],[x,1.37,-.34],.05,materials.steel);
    }
    box(pan,2.9,.09,.18,materials.dark,0,2.01,-.35);
    box(pan,2.5,.07,.09,materials.roof,0,2.10,-.35);
  }
  return {root,doors,wheels,layout};
}

function buildStation(station) {
  const group=new THREE.Group();group.userData.isStation=true;
  for(const side of [-1,1]){
    const x=side*7.1;
    box(group,7.4,.45,334,materials.concrete,x,.18,0,true);
    box(group,.24,.23,335,materials.orange,side*3.5,.45,0);
    for(let z=-154;z<=154;z+=19){
      cylinder(group,.14,.20,6.1,materials.steel,side*9.62,3.42,z,8);
      box(group,7.6,.29,16,materials.roof,side*7.03,6.45,z);
      const light=box(group,.15,.08,8.7,materials.lamp,side*6.3,6.26,z);
      light.material=materials.lamp;
    }
    const sign = makeSign(station.zh,station.en,10.3);
    sign.rotation.y=side===1?-Math.PI/2:Math.PI/2;
    sign.position.set(side*5.52,4.95,-2.0);
    group.add(sign);
    box(group,.12,1.5,9.5,materials.glass,side*4.15,1.45,0);
    box(group,1.1,.16,6.0,materials.steel,side*7.2,.60,8);
    for(let z=-159;z<=159;z+=9){
      box(group,.12,.19,.53,materials.orange,side*3.57,.53,z);
    }
  }
  for(const z of [-169,169]){
    box(group,20,.45,2.8,materials.concrete,0,-.4,z);
  }
  return group;
}
function buildTerrain(scene,movers) {
  const terrainGeo=new THREE.PlaneGeometry(720,1100,35,50);
  terrainGeo.rotateX(-Math.PI/2);
  const pos=terrainGeo.attributes.position;
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i),z=pos.getZ(i);
    const hills=Math.max(0,Math.abs(x)-21);
    pos.setY(i,-4.5 + Math.sin(x*.027+z*.009)*hills*.055 + Math.cos(x*.09-z*.012)*hills*.025);
  }
  terrainGeo.computeVertexNormals();
  const landscape=new THREE.Mesh(terrainGeo,materials.grass);landscape.receiveShadow=true;scene.add(landscape);
  box(scene,10.4,.72,1100,materials.concrete,0,-1.25,0);
  box(scene,6.9,.22,1100,materials.track,0,-.74,0);
  for(const x of [-1.12,1.12]){
    box(scene,.14,.20,1100,materials.steel,x,-.37,0);
    box(scene,.1,.08,1100,materials.roof,x,-.22,0);
  }
  for(let z=-365;z<335;z+=5.2){
    const sleeper=box(scene,4.1,.19,.68,materials.dark,0,-.62,z);
    movers.push({object:sleeper,cycle:700});
  }
  for(let z=-360;z<340;z+=30){
    const pole=new THREE.Group();
    box(pole,.34,9.2,.32,materials.steel,-5.25,3.9,0);
    rod(pole,[-5.20,7.9,0],[5.2,7.9,0],.075,materials.steel);
    rod(pole,[-5.25,5.5,0],[-3.0,7.9,0],.060,materials.steel);
    box(pole,.55,.22,.3,materials.roof,0,7.72,0);
    box(pole,.075,.085,8,materials.steel,0,6.91,0);
    box(pole,.055,.035,8,materials.roof,0,6.75,0);
    pole.position.z=z;scene.add(pole);movers.push({object:pole,cycle:700});
  }
  for(let i=0;i<115;i++){
    const tree=new THREE.Group();
    const side=i%2===0?-1:1;
    tree.position.set(side*rnd(16,100),0,rnd(-355,338));
    const height=rnd(5,14);
    cylinder(tree,.25,.45,height*.35,materials.bark,0,1.15,0,7);
    const pine=new THREE.Mesh(new THREE.ConeGeometry(height*.34,height,8),randomGenerator()>.45?materials.leaf:materials.leafLight);
    pine.position.y=height*.65; pine.castShadow=true;tree.add(pine);
    scene.add(tree);movers.push({object:tree,cycle:700});
  }
  for(let i=0;i<20;i++){
    const building=new THREE.Group();building.position.set((i%2===0?-1:1)*rnd(35,105),0,rnd(-340,325));
    const w=rnd(7,18),depth=rnd(7,18),h=rnd(11,38);
    const color= new THREE.MeshStandardMaterial({color:new THREE.Color().setHSL(rnd(.52,.59),.09,rnd(.52,.76)),roughness:1});
    box(building,w,h,depth,color,0,h/2-3.4,0,true);
    for(const y of [h*.28,h*.56,h*.78])box(building,w+.1,.17,depth+.1,materials.steel,0,y-3.4,0);
    scene.add(building);movers.push({object:building,cycle:700});
  }
  const bridge=new THREE.Group();bridge.position.z=-205;
  box(bridge,12,1.2,116,materials.concrete,0,-1.75,0);
  for(let z=-48;z<=48;z+=24){
    box(bridge,2.0,24,2.5,materials.concrete,-4.7,-14.0,z);
    box(bridge,2.0,24,2.5,materials.concrete,4.7,-14.0,z);
    rod(bridge,[-5,-4.8,z],[5,-4.8,z],.48,materials.steel);
  }
  for(const x of [-5.85,5.85]){
    box(bridge,.35,2.4,116,materials.concrete,x,-.45,0);
    for(let z=-52;z<=52;z+=10){
      rod(bridge,[x,-.3,z],[x,2.4,z+10],.12,materials.steel);
      rod(bridge,[x,2.4,z],[x,-.3,z+10],.12,materials.steel);
    }
    box(bridge,.20,.18,112,materials.steel,x,2.45,0);
  }
  scene.add(bridge);movers.push({object:bridge,cycle:700});
  const tunnel=new THREE.Group();tunnel.position.z=-295;
  const radius=11.7,len=75,segments=24,verts=[],indices=[];
  for(let ring=0;ring<2;ring++){
    const z=(ring-.5)*len;
    for(let j=0;j<=segments;j++){
      const a=j/segments*Math.PI;
      verts.push(radius*Math.cos(a),-.2+radius*Math.sin(a),z);
    }
  }
  for(let j=0;j<segments;j++){
    const n=j,p=j+segments+1;indices.push(n,n+1,p,n+1,p+1,p);
  }
  const shellGeo=new THREE.BufferGeometry();shellGeo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));shellGeo.setIndex(indices);shellGeo.computeVertexNormals();
  const shell=new THREE.Mesh(shellGeo,materials.tunnel);shell.castShadow=true;shell.receiveShadow=true;tunnel.add(shell);
  const liningMat=new THREE.MeshStandardMaterial({color:0x303b44,side:THREE.DoubleSide,roughness:1});
  for(let z=-len/2;z<=len/2;z+=8){
    const pts=[];for(let j=0;j<=25;j++){const a=j/25*Math.PI;pts.push(new THREE.Vector3((radius-.18)*Math.cos(a),-.2+(radius-.18)*Math.sin(a),z));}
    const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:0x94a0a5}));tunnel.add(line);
    if(z>-len/2 && z<len/2)box(tunnel,.37,.18,1.8,materials.lamp,0,10.6,z);
  }
  for(const x of [-11.65,11.65])box(tunnel,2.2,4.0,len,liningMat,x,1.4,0);
  scene.add(tunnel);movers.push({object:tunnel,cycle:700});
  // Background ridges provide a distinct Taiwanese west-coast mountain backdrop.
  for(let i=0;i<16;i++){
    const m=new THREE.Mesh(new THREE.ConeGeometry(rnd(55,100),rnd(75,165),5),new THREE.MeshStandardMaterial({color:i%2?0x557e6a:0x638b7c,roughness:1}));
    m.position.set((i%2?1:-1)*rnd(160,330),rnd(-28,10),-330+i*43);
    m.rotation.y=rnd(0,Math.PI);scene.add(m);
  }
  return tunnel;
}
function buildRain(scene){
  const count=1100,positions=new Float32Array(count*3),speeds=new Float32Array(count);
  for(let i=0;i<count;i++){
    positions[3*i]=rnd(-70,70);positions[3*i+1]=rnd(0,55);positions[3*i+2]=rnd(-160,120);
    speeds[i]=rnd(21,43);
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
  const material=new THREE.PointsMaterial({color:0xc1d9f0,size:.16,transparent:true,opacity:.62,depthWrite:false});
  const rain=new THREE.Points(geometry,material);rain.visible=false;scene.add(rain);
  return {rain,positions,speeds};
}

class SimulatedAudio {
  constructor(){this.ctx=null;this.buffer=null;this.source=null;this.filter=null;this.gain=null;this.enabled=false;this.voice=true;}
  init(){
    if(this.ctx){this.ctx.resume().catch(()=>{});return;}
    const Ctx=window.AudioContext||window.webkitAudioContext;
    if(!Ctx)return;
    this.ctx=new Ctx();this.gain=this.ctx.createGain();this.gain.gain.value=0;this.gain.connect(this.ctx.destination);
    this.filter=this.ctx.createBiquadFilter();this.filter.type='lowpass';this.filter.frequency.value=650;
    this.filter.connect(this.gain);
    const buffer=this.ctx.createBuffer(1,this.ctx.sampleRate*2,this.ctx.sampleRate);
    const channel=buffer.getChannelData(0);
    for(let i=0;i<channel.length;i++)channel[i]=Math.random()*2-1;
    this.source=this.ctx.createBufferSource();this.source.buffer=buffer;this.source.loop=true;this.source.connect(this.filter);this.source.start();
  }
  setSpeed(speed){if(!this.ctx||!this.gain)return;
    this.gain.gain.setTargetAtTime(this.enabled ? .005+speed*.00007:0,this.ctx.currentTime,.3);
    this.filter.frequency.setTargetAtTime(260+speed*3.5,this.ctx.currentTime,.4);
  }
  tone(freq,time,duration=.17){if(!this.ctx)return;
    const osc=this.ctx.createOscillator(),gain=this.ctx.createGain(),now=this.ctx.currentTime;
    osc.type='sine';osc.frequency.value=freq;
    gain.gain.setValueAtTime(.0001,now+time);gain.gain.exponentialRampToValueAtTime(.045,now+time+.018);
    gain.gain.exponentialRampToValueAtTime(.0001,now+time+duration);
    osc.connect(gain).connect(this.ctx.destination);osc.start(now+time);osc.stop(now+time+duration+.02);
  }
  chime(){if(!this.enabled)return;this.init();[659.25,783.99,987.77].forEach((f,i)=>this.tone(f,i*.2,.32));}
  pantograph(){this.init();if(!this.ctx)return;
    const now=this.ctx.currentTime,buffer=this.ctx.createBuffer(1,this.ctx.sampleRate*1.4,this.ctx.sampleRate);
    const data=buffer.getChannelData(0);
    for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*Math.sin(i/data.length*Math.PI);
    const src=this.ctx.createBufferSource(),filter=this.ctx.createBiquadFilter(),gain=this.ctx.createGain();
    src.buffer=buffer;filter.type='bandpass';filter.frequency.setValueAtTime(350,now);
    filter.frequency.exponentialRampToValueAtTime(2500,now+.55);filter.frequency.exponentialRampToValueAtTime(600,now+1.35);
    filter.Q.value=.53;gain.gain.setValueAtTime(.001,now);gain.gain.linearRampToValueAtTime(.12,now+.28);
    gain.gain.exponentialRampToValueAtTime(.001,now+1.38);
    src.connect(filter).connect(gain).connect(this.ctx.destination);src.start(now);src.stop(now+1.4);
  }
  speak(text){if(!this.voice||!('speechSynthesis' in window))return;
    window.speechSynthesis.cancel();
    const speech=new SpeechSynthesisUtterance(text);speech.lang='zh-TW';speech.rate=.98;speech.pitch=1.03;
    const voices=window.speechSynthesis.getVoices();speech.voice=voices.find(x=>x.lang.toLowerCase()==='zh-tw')||null;
    window.speechSynthesis.speak(speech);
  }
  stopSpeech(){if('speechSynthesis'in window)window.speechSynthesis.cancel();}
}

class HighSpeedRailSimulator {
  constructor(){
    this.view=$('scene');this.audio=new SimulatedAudio();this.mode='follow';this.weather='day';
    this.direction='north';this.route='local';this.itinerary=createItinerary();
    this.power=0;this.brake=0;this.speed=0;this.running=false;this.completed=false;this.atStation=true;this.overrun=false;this.needsNextLeg=false;
    this.current=0;this.distance=0;this.announced=false;this.doorsOpen=1;this.doorLevel=1;
    this.movers=[];this.lastTime=performance.now();this.weatherTimer=0;
    this.setupScene();this.bindControls();this.setView('follow');this.reset();this.animate();
    window.addEventListener('resize',()=>this.resize());this.resize();
  }
  setupScene(){
    this.scene=new THREE.Scene();
    this.scene.background=new THREE.Color(0x9eb6c8);this.scene.fog=new THREE.Fog(0x9eb6c8,150,750);
    try{this.renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});}catch(e){$('webglError').classList.remove('hidden');throw e;}
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.6));
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure=1.17;this.renderer.shadowMap.enabled=true;
    this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.view.append(this.renderer.domElement);
    this.camera=new THREE.PerspectiveCamera(46,1,.1,1600);this.camera.position.set(26,15,-143);
    this.controls=new OrbitControls(this.camera,this.renderer.domElement);
    this.controls.enableDamping=true;this.controls.maxPolarAngle=1.50;
    this.controls.minDistance=14;this.controls.maxDistance=220;this.controls.target.set(0,2,-48);
    this.controls.enabled=false;
    this.hemi=new THREE.HemisphereLight(0xffffff,0x385849,2.12);this.scene.add(this.hemi);
    this.sun=new THREE.DirectionalLight(0xfff5df,3.0);this.sun.position.set(-85,125,-95);this.sun.castShadow=true;
    this.sun.shadow.mapSize.set(2048,2048);this.sun.shadow.camera.left=-145;this.sun.shadow.camera.right=145;
    this.sun.shadow.camera.top=145;this.sun.shadow.camera.bottom=-145;this.sun.shadow.camera.far=360;
    this.scene.add(this.sun);
    this.tunnel=buildTerrain(this.scene,this.movers);
    this.train=buildTrain(this.scene);this.rain=buildRain(this.scene);
    this.cab3D=buildDriverInterior();this.scene.add(this.cab3D.root);
    this.standard3D=buildPassengerInterior(false);this.scene.add(this.standard3D);
    this.business3D=buildPassengerInterior(true);this.scene.add(this.business3D);
    this.walk=8;
    this.arrivalGroup=null;this.departGroup=null;
    this.setWeather('day');
  }
  createStation(station,position){const group=buildStation(station);group.position.z=position;this.scene.add(group);return group;}
  destroyStations(){for(const g of [this.departGroup,this.arrivalGroup])if(g){this.scene.remove(g);g.traverse(o=>{
    // Shared materials survive; sign textures are unique per station.
    if(o.isMesh && o.material?.map?.isCanvasTexture)o.material.map.dispose();
  });}this.departGroup=null;this.arrivalGroup=null;}
  reset(){
    this.audio.stopSpeech();this.destroyStations();
    this.itinerary=createItinerary(this.direction,this.route);
    this.current=0;this.distance=0;this.speed=0;this.power=0;this.brake=0;this.running=false;this.completed=false;this.atStation=true;this.overrun=false;this.needsNextLeg=false;this.announced=false;this.doorsOpen=1;this.doorLevel=1;
    this.departGroup=this.createStation(this.itinerary.stops[0],0);
    this.arrivalGroup=this.createStation(this.itinerary.stops[1],-LEG_DISTANCE);
    this.updateStatus('列車待命 · 關門、啟動駕駛後設定動力段位');
    $('announcementText').textContent='手動駕駛：先關閉車門、按「啟用駕駛」，再增加動力段位。進站需要自己操作煞車。';
    $('driveBtn').textContent='⚡ 啟用駕駛';
    $('originName').textContent=this.itinerary.stops[0].zh;
    $('destinationName').textContent=this.itinerary.stops.at(-1).zh;
    this.updateRail();this.updateUI();
  }
  setWeather(weather){
    this.weather=weather;
    const presets={
      day:{sky:0xa2c3d8,fog:0xadc4c7,skyLight:2.15,sun:3.0,sunColor:0xfff4de,exposure:1.14},
      sunset:{sky:0xe8a087,fog:0xe5aaa0,skyLight:1.55,sun:2.5,sunColor:0xff9860,exposure:1.04},
      night:{sky:0x07152b,fog:0x19324c,skyLight:.35,sun:.4,sunColor:0x739dff,exposure:.92},
      rain:{sky:0x526476,fog:0x71808a,skyLight:.78,sun:.56,sunColor:0xdbe6ec,exposure:.96}
    };
    const p=presets[weather];if(!p)return;
    this.scene.background=new THREE.Color(p.sky);this.scene.fog.color.setHex(p.fog);
    this.hemi.intensity=p.skyLight;this.sun.intensity=p.sun;this.sun.color.setHex(p.sunColor);
    this.renderer.toneMappingExposure=p.exposure;this.rain.rain.visible=weather==='rain';
    document.querySelectorAll('[data-weather]').forEach(b=>b.classList.toggle('active',b.dataset.weather===weather));
    $('sceneWeatherName').textContent={day:'晴朗 · DAY',sunset:'夕陽 · SUNSET',night:'夜間 · NIGHT',rain:'下雨 · RAIN'}[weather];
  }
  setView(mode){
    this.mode=mode;this.controls.enabled=mode==='free';
    const interior=isInteriorMode(mode);
    this.train.root.visible=!interior;
    this.cab3D.root.visible=mode==='cab';
    this.standard3D.visible=mode.startsWith('standard');
    this.business3D.visible=mode.startsWith('business');
    this.view.parentElement.classList.remove('cab-mode');
    $('cabInterior').classList.add('hidden');
    $('interiorControls').classList.toggle('hidden',!interior||mode==='cab');
    $('seatView').textContent=mode.endsWith('Seat')?'返回走道':'坐到窗邊';
    $('walkForward').disabled=mode.endsWith('Seat');$('walkBack').disabled=mode.endsWith('Seat');
    this.camera.fov=interior?68:46;this.camera.near=interior?.035:.1;this.camera.updateProjectionMatrix();
    if(mode==='free'){this.camera.position.set(32,13,-189);this.controls.target.set(0,3,-137);this.controls.update();}
    else this.updateCamera(1);
    $('cameraLabel').textContent={follow:'◈ 列車追蹤',cab:'◈ 700T 立體駕駛室',standard:'◈ 2 車 標準車廂走道',business:'◈ 6 車 商務車廂走道',standardSeat:'◈ 標準車廂窗邊',businessSeat:'◈ 商務車廂窗邊',side:'◈ 車頭側面',nose:'◈ 700T 車鼻檢視',free:'◈ 自由旋轉'}[mode]||'◈ 鏡頭';
  }
  walkInterior(delta){this.walk=Math.max(-8.7,Math.min(8.7,this.walk+delta));$('walkPosition').textContent=(this.walk+8.7).toFixed(1)+' m';}
  bindControls(){
    document.querySelectorAll('[data-direction]').forEach(button=>button.addEventListener('click',()=>{
      this.direction=button.dataset.direction;this.reset();
      document.querySelectorAll('[data-direction]').forEach(b=>b.classList.toggle('active',b===button));
    }));
    document.querySelectorAll('[data-route]').forEach(button=>button.addEventListener('click',()=>{
      this.route=button.dataset.route;this.reset();document.querySelectorAll('[data-route]').forEach(b=>b.classList.toggle('active',b===button));
    }));
    document.querySelectorAll('[data-weather]').forEach(b=>b.addEventListener('click',()=>this.setWeather(b.dataset.weather)));
    $('cameraMode').addEventListener('change',e=>this.setView(e.target.value));
    $('walkForward').addEventListener('click',()=>this.walkInterior(-1.0));
    $('walkBack').addEventListener('click',()=>this.walkInterior(1.0));
    $('seatView').addEventListener('click',()=>{
      const m=this.mode.endsWith('Seat')?this.mode.replace('Seat',''):this.mode+'Seat';
      $('cameraMode').value=m;this.setView(m);$('seatView').textContent=m.endsWith('Seat')?'返回走道':'坐到窗邊';
    });
    $('powerDown').addEventListener('click',()=>this.changePower(-1));
    $('powerUp').addEventListener('click',()=>this.changePower(1));
    $('brakeDown').addEventListener('click',()=>this.changeBrake(-1));
    $('brakeUp').addEventListener('click',()=>this.changeBrake(1));
    $('emergencyBtn').addEventListener('click',()=>this.emergencyBrake());
    $('doorBtn').addEventListener('click',()=>this.toggleDoors());
    $('retryBtn').addEventListener('click',()=>this.retryLeg());
    $('resetBtn').addEventListener('click',()=>this.reset());
    $('driveBtn').addEventListener('click',()=>this.toggleDrive());
    $('soundBtn').addEventListener('click',()=>{
      this.audio.enabled=!this.audio.enabled;if(this.audio.enabled)this.audio.init();
      const btn=$('soundBtn');btn.setAttribute('aria-pressed',String(this.audio.enabled));btn.textContent=this.audio.enabled?'🔊 音效：開':'🔇 音效：關';
    });
    $('voiceBtn').addEventListener('click',()=>{
      this.audio.voice=!this.audio.voice;if(!this.audio.voice)this.audio.stopSpeech();
      const btn=$('voiceBtn');btn.setAttribute('aria-pressed',String(this.audio.voice));btn.textContent=this.audio.voice?'📣 廣播：開':'🔇 廣播：關';
    });
    $('pantographBtn').addEventListener('click',()=>this.audio.pantograph());
    document.addEventListener('keydown',e=>{
      if(e.ctrlKey||e.metaKey||e.altKey||['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName))return;
      const keys={KeyW:()=>this.changePower(1),ArrowUp:()=>this.changePower(1),KeyS:()=>this.changePower(-1),ArrowDown:()=>this.changePower(-1),KeyD:()=>this.changeBrake(1),ArrowRight:()=>this.changeBrake(1),KeyA:()=>this.changeBrake(-1),ArrowLeft:()=>this.changeBrake(-1),KeyE:()=>this.emergencyBrake(),KeyO:()=>this.toggleDoors(),Space:()=>this.toggleDrive()};
      if(keys[e.code]){e.preventDefault();keys[e.code]();}
    });
  }
  changePower(delta){
    if(this.completed||this.overrun)return;
    if(!this.running && delta>0){this.updateStatus('請先點選「啟用駕駛」');return;}
    if(delta>0 && this.doorsOpen){this.updateStatus('車門尚未關閉！按「關閉車門」再加速');return;}
    if(delta>0 && this.brake>0){this.updateStatus('請先解除煞車才能增加動力');return;}
    this.power=Math.max(0,Math.min(5,this.power+delta));
    if(this.power>0&&this.atStation){
      if(this.needsNextLeg){this.nextLeg();this.needsNextLeg=false;}
      else this.announce('depart',this.itinerary.stops[this.current]);
      this.atStation=false;
    }
    this.updateUI();
  }
  changeBrake(delta){
    if(this.completed)return;
    this.brake=Math.max(0,Math.min(7,this.brake+delta));
    if(this.brake>0)this.power=0;
    this.updateUI();
  }
  emergencyBrake(){
    if(this.completed)return;
    this.power=0;this.brake=7;this.updateStatus('🚨 緊急煞車 B7！');this.updateUI();
  }
  toggleDoors(){
    if(!canOperateDoors(this.speed,this.power)){this.updateStatus('⚠️ 必須完全停車並收回動力才能操作車門');return;}
    if(!this.atStation){this.updateStatus('車門只能在正確月台開啟');return;}
    this.doorsOpen=!this.doorsOpen;
    if(this.doorsOpen){
      this.power=0;
      if(this.current>0){this.announce('arrive',this.itinerary.stops[this.current]);}
      if(this.current===this.itinerary.stops.length-1){
        this.completed=true;this.running=false;
        $('announcementText').textContent=`🎉 已安全抵達${this.itinerary.stops[this.current].zh}站，旅程完成！`;
        $('driveBtn').textContent='↺ 再次出發';this.updateStatus('🎉 全程駕駛完成');
      }else this.updateStatus('月台停靠 · 車門已開啟');
    }else this.updateStatus('車門已關閉 · 可解除煞車後加速');
    this.updateUI();
  }
  toggleDrive(){
    if(this.completed){this.reset();return;}
    if(this.overrun){this.retryLeg();return;}
    this.running=!this.running;
    if(this.running){
      this.audio.init();
      $('driveBtn').textContent='Ⅱ 暫停駕駛';
      this.updateStatus(this.doorsOpen?'車門開啟 · 請關門後加速':'駕駛已啟用 · W 加動力 / D 加煞車');
    }else {this.power=0;this.brake=0;$('driveBtn').textContent='▶ 繼續駕駛';this.updateStatus('模擬已暫停');}
    this.updateUI();
  }
  retryLeg(){
    if(!this.overrun)return;
    this.distance=0;this.speed=0;this.power=0;this.brake=0;this.overrun=false;this.announced=false;
    this.atStation=true;this.needsNextLeg=false;this.doorsOpen=1;this.doorLevel=1;
    this.departGroup.position.z=0;this.arrivalGroup.position.z=-LEG_DISTANCE;
    this.updateStatus('已重試本站；請關門重新手動駕駛');this.updateUI();
  }
  announce(type,station){
    const msg=speakableAnnouncement(station,this.direction,type);
    $('announcementText').textContent=msg;
    this.audio.chime();this.audio.speak(msg);
  }
  updateStatus(value){$('driveStatus').textContent=value;}
  updateRail(){
    const r=$('routeRail');r.replaceChildren();
    for(const [i,station]of this.itinerary.stations.entries()){
      const current=this.itinerary.stops[this.current];
      const alreadyPassed= this.direction==='north'
        ? i < current.index : i < current.index;
      const isCurrent=i===current.index;
      const willStop=this.itinerary.stops.some(stop=>stop.index===i);
      const elt=document.createElement('div');elt.className=`station-stop${alreadyPassed?' passed':''}${isCurrent?' current':''}${willStop?'':' skipped'}`;
      const circle=document.createElement('div');circle.className='station-circle';circle.textContent=isCurrent?'●':alreadyPassed?'✓':willStop?'•':'·';
      const label=document.createElement('div');label.className='station-label';label.textContent=station.zh;
      elt.append(circle,label);r.append(elt);
    }
    $('stationCount').textContent=String(this.current+1).padStart(2,'0')+' / '+String(this.itinerary.stops.length).padStart(2,'0');
    const next=this.itinerary.stops[this.current+1];$('nextStopName').textContent=next?`${next.zh}  ${next.en}`:'旅程終點 · 已完成';
  }
  updateUI(){
    $('speedReadout').textContent=String(Math.round(this.speed)).padStart(3,'0');
    $('speedGauge').style.width=`${this.speed/MAX_SPEED*100}%`;
    $('powerValue').textContent=`P${this.power}`;
    $('brakeValue').textContent=`B${this.brake}`;
    $('powerUp').disabled=!this.running||this.completed||this.overrun||this.doorsOpen||this.brake>0||this.power===5;
    $('powerDown').disabled=this.power===0;
    $('brakeDown').disabled=this.brake===0;
    $('brakeUp').disabled=this.brake===7||this.completed;
    $('doorBtn').textContent=this.doorsOpen?'🚪 關閉車門':'🚪 開啟車門';
    $('doorBtn').disabled=!canOperateDoors(this.speed,this.power)||!this.atStation;
    $('retryBtn').classList.toggle('hidden',!this.overrun);
    const remaining=Math.max(0,LEG_DISTANCE-this.distance);
    $('distanceRemaining').textContent=this.completed?'模擬駕駛完成':this.overrun?'列車已越站 · 請重試本站':this.atStation?'月台停靠 · 請操作車門':`下一站距離 ${Math.ceil(remaining)} 模擬單位`;
    const recommend=estimateBrakingDistance(this.speed,this.weather==='rain');
    const warning= !this.atStation&&!this.overrun&&this.speed>16&&remaining<=recommend+20;
    $('brakingAlert').textContent=this.overrun?'⚠️ 越站了！點選「重試本站」':this.atStation?'請關門、解除煞車後加速':warning?'⚠️ 建議立即煞車，準備進站':`建議煞車距離：約 ${Math.ceil(recommend)} 模擬單位`;
    $('brakingAlert').classList.toggle('warning',warning||this.overrun);
    if(this.mode==='cab')this.cab3D.update(this.speed,this.power,this.brake,this.doorsOpen);
    $('cabPowerValue').textContent=`P${this.power}`;
    $('cabBrakeValue').textContent=`B${this.brake}`;
    $('cabSpeedValue').textContent=String(Math.round(this.speed)).padStart(3,'0');
  }
  arrive(){
    this.speed=0;this.power=0;this.brake=Math.max(3,this.brake);
    this.current+=1;this.announced=false;this.atStation=true;this.needsNextLeg=true;
    this.updateRail();this.updateStatus('✅ 正確停車！請手動開啟車門');
    $('announcementText').textContent=`已停妥${this.itinerary.stops[this.current].zh}站。請按「開啟車門」完成停站。`;
  }
  nextLeg(){
    const oldDepart=this.departGroup;
    if(oldDepart){this.scene.remove(oldDepart);}
    this.departGroup=this.arrivalGroup;
    this.arrivalGroup=this.createStation(this.itinerary.stops[this.current+1],-LEG_DISTANCE);
    this.distance=0;this.announced=false;
    this.announce('depart',this.itinerary.stops[this.current]);this.updateStatus('已離站 · 請控制動力與煞車');
  }
  updateCamera(dt){
    if(this.mode==='free'){this.controls.update();return;}
    if(this.mode==='cab'){this.camera.position.set(-.40,3.49,-144.78);this.camera.lookAt(-.25,3.24,-165);return;}
    if(isInteriorMode(this.mode)){const p=passengerPose(this.mode,this.walk);this.camera.position.set(...p.position);this.camera.lookAt(...p.target);if(this.camera.fov!==p.fov){this.camera.fov=p.fov;this.camera.updateProjectionMatrix();}return;}
    // In-cab view deliberately hides the opaque exterior and draws a dedicated
    // dashboard/windscreen overlay; this prevents the roof/nose clipping bug.
    const positions={follow:[22,12,-183],cab:[-.40,3.92,-143],side:[35,10,-131],nose:[16,8,-173]};
    const targets={follow:[0,2.8,-136],cab:[-.4,3.1,-270],side:[0,2.7,-123],nose:[0,2.6,-143]};
    const p=positions[this.mode]||positions.follow,look=targets[this.mode]||targets.follow;
    const factor=1-Math.exp(-dt*5);
    this.camera.position.lerp(new THREE.Vector3(...p),factor);
    this.camera.lookAt(...look);
  }
  animate(){
    requestAnimationFrame(()=>this.animate());
    const now=performance.now(),dt=Math.min(.06,Math.max(0,(now-this.lastTime)/1000));this.lastTime=now;
    if(this.running&&!this.completed&&!this.overrun&&!this.atStation){
      const remaining=LEG_DISTANCE-this.distance;
      const state=stepManualDrive({speed:this.speed,distance:this.distance,power:this.power,brake:this.brake},dt,{rain:this.weather==='rain'});
      this.speed=state.speed;this.distance=state.distance;
      const moved=state.moved;
      if(this.departGroup)this.departGroup.position.z=this.distance;
      if(this.arrivalGroup)this.arrivalGroup.position.z=-LEG_DISTANCE+this.distance;
      for(const mover of this.movers){mover.object.position.z+=moved;if(mover.object.position.z>350)mover.object.position.z-=mover.cycle;}
      if(remaining<80&&!this.announced){this.announced=true;this.announce('approach',this.itinerary.stops[this.current+1]);}
      if(withinStopZone(this.distance,this.speed))this.arrive();
      else if(this.distance>LEG_DISTANCE+16){this.overrun=true;this.power=0;this.brake=7;this.updateStatus('⚠️ 越站！請重試本站');}
      else if(this.speed>200)this.updateStatus('⚡ 高速行駛中 · 注意進站煞車');
      else if(remaining<90)this.updateStatus('接近月台 · 請手動控制煞車');
      else this.updateStatus(this.power>0?'手動加速中':this.brake>0?'手動煞車中':'滑行中');
      if(Math.abs(this.tunnel.position.z)<28&&this.speed>180&&this.audio.enabled&&!this.inTunnel)this.audio.pantograph();
      this.inTunnel=Math.abs(this.tunnel.position.z)<32;
    }
    this.audio.setSpeed(this.speed);
    this.doorLevel=THREE.MathUtils.damp(this.doorLevel,this.doorsOpen?1:0,3.2,dt);
    for(const d of this.train.doors){d.doorLeft.position.z=d.closedLeft-.40*this.doorLevel;d.doorRight.position.z=d.closedRight+.40*this.doorLevel;}
    if(this.speed>1)for(const w of this.train.wheels)w.rotation.x+=this.speed*.001*dt;
    if(this.weather==='rain'){
      const arr=this.rain.positions;
      for(let i=0;i<this.rain.speeds.length;i++){
        arr[i*3+1]-=this.rain.speeds[i]*dt;arr[i*3+2]+=this.speed*.037*dt;
        if(arr[i*3+1]<-1){arr[i*3+1]=rnd(35,55);arr[i*3+2]=rnd(-155,120);}
        if(arr[i*3+2]>125)arr[i*3+2]=-150;
      }
      this.rain.rain.geometry.attributes.position.needsUpdate=true;
    }
    this.updateCamera(dt);this.updateUI();this.renderer.render(this.scene,this.camera);
  }
  resize(){const r=this.view.getBoundingClientRect();const w=Math.max(10,Math.round(r.width)),h=Math.max(10,Math.round(r.height));this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.renderer.setSize(w,h,false);}
}

window.addEventListener('DOMContentLoaded',()=>{
  try{new HighSpeedRailSimulator();}
  catch(err){console.error('3D simulator startup failed:',err);$('webglError').classList.remove('hidden');}
});