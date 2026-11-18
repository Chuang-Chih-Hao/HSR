import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createItinerary, DIRECTION, ROUTE, LEG_DISTANCE, clampSpeed, approachingSpeed, speakableAnnouncement } from './sim-core.mjs';

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

function makeCarProfile() {
  const s = new THREE.Shape();
  s.moveTo(-1.6,1.07); s.lineTo(1.6,1.07); s.lineTo(1.6,3.64);
  s.bezierCurveTo(1.60,4.04,1.24,4.30,.83,4.33);
  s.lineTo(-.83,4.33); s.bezierCurveTo(-1.24,4.30,-1.60,4.04,-1.60,3.64);
  s.closePath();
  return new THREE.ExtrudeGeometry(s,{depth:14.35,steps:1,bevelEnabled:true,bevelSize:.055,bevelThickness:.05,bevelSegments:2,curveSegments:8});
}
function buildNose(train, tipFront, anchor) {
  const sign = tipFront ? -1 : 1;
  const rings = [
    [0, 1.55,1.13,4.07], [1.4,1.50,1.13,4.01], [3.1,1.33,1.11,3.77],
    [5.2,1.04,1.12,3.35], [7.0,.69,1.15,2.68], [8.3,.30,1.25,1.93], [8.8,.08,1.35,1.58]
  ];
  const segments=24, verts=[],indices=[];
  rings.forEach(([offset,width,bottom,top])=>{
    for(let j=0;j<segments;j++) {
      const a=j/segments*Math.PI*2;
      verts.push(width*Math.cos(a), (top+bottom)/2+((top-bottom)/2)*Math.sin(a), anchor+sign*offset);
    }
  });
  for(let i=0;i<rings.length-1;i++)for(let j=0;j<segments;j++){
    const n=i*segments+j, m=i*segments+(j+1)%segments, p=(i+1)*segments+j,q=(i+1)*segments+(j+1)%segments;
    indices.push(n,m,p,m,q,p);
  }
  const geom=new THREE.BufferGeometry(); geom.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));geom.setIndex(indices);geom.computeVertexNormals();
  const nose = new THREE.Mesh(geom, new THREE.MeshPhysicalMaterial({color:0xf4f6f6,metalness:.15,roughness:.34,side:THREE.DoubleSide,clearcoat:.8}));
  nose.castShadow = true; train.add(nose);
  // Sloped, dark driver windscreen and signature orange racing line.
  const wind = new THREE.Mesh(new THREE.BufferGeometry(), materials.glass);
  const vz = tipFront ? [anchor-1.55,anchor-4.25] : [anchor+1.55,anchor+4.25];
  const points=[[-1.22,3.84,vz[0]],[1.22,3.84,vz[0]],[-.82,3.25,vz[1]],[.82,3.25,vz[1]]];
  const windGeom=new THREE.BufferGeometry(); windGeom.setAttribute('position',new THREE.Float32BufferAttribute(points.flat(),3));windGeom.setIndex([0,2,1,1,2,3]);windGeom.computeVertexNormals();wind.geometry=windGeom;wind.material.side=THREE.DoubleSide;train.add(wind);
  for(const side of [-1,1]){
    box(train,.31,.13,1.7,materials.orange,side*.42,1.66,anchor+sign*6.6);
    const light=new THREE.Mesh(new THREE.SphereGeometry(.17,10,7),materials.lamp);light.scale.set(.72,.60,1.24);light.position.set(side*.32,1.83,anchor+sign*7.95);train.add(light);
  }
}
function buildTrain(scene) {
  const root = new THREE.Group();root.name='700T inspired train';scene.add(root);
  const profile = makeCarProfile();const doors=[];const wheels=[];
  for(let i=0;i<8;i++){
    const group=new THREE.Group();group.position.z=-52.5+i*15;root.add(group);
    const body=new THREE.Mesh(profile,materials.white);body.position.z=-7.175;body.castShadow=true;body.receiveShadow=true;group.add(body);
    box(group,3.26,.35,14.05,materials.orange,0,1.87,0);
    for(const side of [-1,1]){
      box(group,.045,.34,14.1,materials.orange,side*1.665,1.88,0);
      box(group,.05,.11,14.1,materials.scarlet,side*1.697,1.65,0);
      for(let j=0;j<7;j++){
        const offset=-5.25+j*1.73;
        if(Math.abs(offset)>4.55)continue;
        box(group,.06,.80,1.19,materials.glass,side*1.689,3.04,offset);
        box(group,.065,.12,1.28,materials.roof,side*1.728,3.51,offset);
      }
      const doorLeft=box(group,.065,2.16,.60,materials.white,side*1.69,2.39,5.30);
      const doorRight=box(group,.065,2.16,.60,materials.white,side*1.69,2.39,5.94);
      box(doorLeft,.07,.64,.35,materials.glass,0,.31,.08);
      box(doorRight,.07,.64,.35,materials.glass,0,.31,-.08);
      doors.push({doorLeft,doorRight,closedLeft:doorLeft.position.z,closedRight:doorRight.position.z});
      box(group,.062,.06,2.05,materials.steel,side*1.728,1.25,5.6);
    }
    box(group,2.68,.30,12.2,materials.roof,0,4.43,0);
    box(group,2.4,.34,12.7,materials.dark,0,.95,0);
    for(const bogieZ of [-4.95,4.95]){
      box(group,2.8,.45,2.5,materials.dark,0,.75,bogieZ);
      for(const side of [-1,1]){
        const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.47,.47,.20,16),materials.dark);
        wheel.rotation.z=Math.PI/2;wheel.position.set(side*1.37,.47,bogieZ);
        group.add(wheel);wheels.push(wheel);
      }
    }
    for(let j=0;j<3;j++)box(group,1.6,.08,.14,materials.steel,0,4.64,-3+j*3);
  }
  buildNose(root,true,-59.7);buildNose(root,false,59.7);
  for(const position of [-20.3,20.5]){
    const pan=new THREE.Group();pan.position.set(0,4.62,position);root.add(pan);
    box(pan,2.3,.18,2.9,materials.dark,0,0,0);
    for(const x of [-.72,.72]){
      cylinder(pan,.24,.24,.37,materials.roof,x,.32,0,8);
      rod(pan,[x,.56,-.92],[x,1.48,.34],.065,materials.steel);
      rod(pan,[x,1.48,.34],[x,2.07,-.36],.065,materials.steel);
      rod(pan,[x,.56,.92],[x,1.48,-.34],.05,materials.steel);
    }
    box(pan,2.9,.09,.18,materials.dark,0,2.09,-.35);
    box(pan,2.5,.07,.09,materials.roof,0,2.18,-.35);
  }
  return {root,doors,wheels};
}

function buildStation(station) {
  const group=new THREE.Group();group.userData.isStation=true;
  for(const side of [-1,1]){
    const x=side*7.1;
    box(group,7.4,.45,147,materials.concrete,x,.18,0,true);
    box(group,.24,.23,148,materials.orange,side*3.5,.45,0);
    for(let z=-58;z<=58;z+=19){
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
    for(let z=-65;z<=65;z+=9){
      box(group,.12,.19,.53,materials.orange,side*3.57,.53,z);
    }
  }
  for(const z of [-74,74]){
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
    this.targetSpeed=260;this.speed=0;this.running=false;this.completed=false;this.dwell=0;
    this.current=0;this.distance=0;this.announced=false;this.doorsOpen=0;
    this.movers=[];this.lastTime=performance.now();this.weatherTimer=0;
    this.setupScene();this.bindControls();this.reset();this.animate();
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
    this.camera=new THREE.PerspectiveCamera(46,1,.1,1600);this.camera.position.set(29,18,111);
    this.controls=new OrbitControls(this.camera,this.renderer.domElement);
    this.controls.enableDamping=true;this.controls.maxPolarAngle=1.50;
    this.controls.minDistance=14;this.controls.maxDistance=220;this.controls.target.set(0,2,0);
    this.controls.enabled=false;
    this.hemi=new THREE.HemisphereLight(0xffffff,0x385849,2.12);this.scene.add(this.hemi);
    this.sun=new THREE.DirectionalLight(0xfff5df,3.0);this.sun.position.set(-85,125,-95);this.sun.castShadow=true;
    this.sun.shadow.mapSize.set(2048,2048);this.sun.shadow.camera.left=-145;this.sun.shadow.camera.right=145;
    this.sun.shadow.camera.top=145;this.sun.shadow.camera.bottom=-145;this.sun.shadow.camera.far=360;
    this.scene.add(this.sun);
    this.tunnel=buildTerrain(this.scene,this.movers);
    this.train=buildTrain(this.scene);this.rain=buildRain(this.scene);
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
    this.current=0;this.distance=0;this.speed=0;this.running=false;this.completed=false;this.dwell=0;this.announced=false;this.doorsOpen=0;
    this.departGroup=this.createStation(this.itinerary.stops[0],0);
    this.arrivalGroup=this.createStation(this.itinerary.stops[1],-LEG_DISTANCE);
    this.updateStatus('已準備就緒，點擊「開始行駛」');
    $('announcementText').textContent='列車已在月台待命。請選擇方向、停靠模式，再開始行駛。';
    $('driveBtn').textContent='▶ 開始行駛';
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
  setView(mode){this.mode=mode;this.controls.enabled=mode==='free';this.controls.target.set(0,2,0);$('cameraLabel').textContent={follow:'◈ 追蹤視角',cab:'◈ 駕駛室視角',side:'◈ 月台視角',free:'◈ 自由視角'}[mode]||'◈ 鏡頭';}
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
    $('targetSpeed').addEventListener('input',e=>{this.targetSpeed=clampSpeed(e.target.value);$('targetSpeedText').textContent=this.targetSpeed;});
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
    document.addEventListener('keydown',e=>{if(e.code==='Space'&&!['INPUT','SELECT','BUTTON'].includes(document.activeElement.tagName)){e.preventDefault();this.toggleDrive();}});
  }
  toggleDrive(){
    if(this.completed){this.reset();return;}
    this.running=!this.running;
    if(this.running){
      this.audio.init();
      $('driveBtn').textContent='Ⅱ 暫停模擬';
      if(this.current===0&&this.distance===0&&this.dwell===0)this.announce('depart',this.itinerary.stops[0]);
      this.updateStatus(this.dwell>0?'月台停靠中':'加速出站');
    } else {$('driveBtn').textContent='▶ 繼續行駛';this.updateStatus('列車已暫停');}
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
    $('speedGauge').style.width=`${this.speed/3}%`;
    const remaining=Math.max(0,LEG_DISTANCE-this.distance);
    $('distanceRemaining').textContent=this.completed?'本次旅程已完成':this.dwell>0?'月台停靠中 · 車門開啟':`距離下一停靠站 ${Math.ceil(remaining)} 模擬單位`;
  }
  arrive(){
    this.distance=LEG_DISTANCE;this.speed=0;
    this.current+=1;this.dwell=5.2;this.announced=false;
    this.announce('arrive',this.itinerary.stops[this.current]);this.updateRail();this.updateStatus('月台停靠中 · 車門開啟');
    if(this.current===this.itinerary.stops.length-1){
      this.completed=true;this.running=false;this.dwell=0;this.updateStatus('🎉 本次行程完成');
      $('announcementText').textContent=`🎉 已抵達終點 ${this.itinerary.stops[this.current].zh} 站！感謝搭乘。`;
      $('driveBtn').textContent='↺ 再次出發';
    }
  }
  nextLeg(){
    const oldDepart=this.departGroup;
    if(oldDepart){this.scene.remove(oldDepart);}
    this.departGroup=this.arrivalGroup;
    this.arrivalGroup=this.createStation(this.itinerary.stops[this.current+1],-LEG_DISTANCE);
    this.distance=0;this.announced=false;this.dwell=0;
    this.announce('depart',this.itinerary.stops[this.current]);this.updateStatus('列車正從月台出發');
  }
  updateCamera(dt){
    if(this.mode==='free'){this.controls.update();return;}
    const positions={follow:[35,22,111],cab:[0,4.16,-55.5],side:[25,10,25]};
    const targets={follow:[0,2,-13],cab:[0,3,-150],side:[0,2,-18]};
    const p=positions[this.mode]||positions.follow,look=targets[this.mode]||targets.follow;
    const factor=1-Math.exp(-dt*3.0);
    this.camera.position.lerp(new THREE.Vector3(...p),factor);
    this.camera.lookAt(...look);
  }
  animate(){
    requestAnimationFrame(()=>this.animate());
    const now=performance.now();const dt=Math.min(.06,Math.max(0,(now-this.lastTime)/1000));this.lastTime=now;
    if(this.running&&!this.completed){
      if(this.dwell>0){
        this.speed=0;this.dwell=Math.max(0,this.dwell-dt);
        if(this.dwell===0)this.nextLeg();
      }else{
        const remaining=LEG_DISTANCE-this.distance;
        const target=approachingSpeed(remaining,this.targetSpeed);
        const maxDelta=(target<this.speed?140:100)*dt;
        this.speed+=THREE.MathUtils.clamp(target-this.speed,-maxDelta,maxDelta);
        const moved=Math.min(remaining, this.speed*.11*dt);
        this.distance+=moved;
        if(this.departGroup)this.departGroup.position.z=this.distance;
        if(this.arrivalGroup)this.arrivalGroup.position.z=-LEG_DISTANCE+this.distance;
        for(const mover of this.movers){mover.object.position.z+=moved;if(mover.object.position.z>350)mover.object.position.z-=mover.cycle;}
        if(remaining<55&&!this.announced){this.announced=true;this.announce('approach',this.itinerary.stops[this.current+1]);}
        if(this.distance>=LEG_DISTANCE-.01)this.arrive();
        else if(this.speed>200)this.updateStatus('⚡ 高速行駛中');
        else if(remaining<95)this.updateStatus('即將進站 · 減速中');
        else this.updateStatus('行駛中 · 逐漸加速');
        if(Math.abs(this.tunnel.position.z)<28&&this.speed>180&&this.audio.enabled&&!this.inTunnel){this.audio.pantograph();}
        this.inTunnel=Math.abs(this.tunnel.position.z)<32;
      }
    }
    this.audio.setSpeed(this.speed);
    const openTarget=(this.dwell>0||this.completed)?1:0;
    this.doorsOpen=THREE.MathUtils.damp(this.doorsOpen,openTarget,2.6,dt);
    for(const d of this.train.doors){d.doorLeft.position.z=d.closedLeft-.40*this.doorsOpen;d.doorRight.position.z=d.closedRight+.40*this.doorsOpen;}
    if(this.speed>1)for(const w of this.train.wheels)w.rotation.x+=this.speed*.001*dt;
    if(this.weather==='rain'){
      const arr=this.rain.positions;
      for(let i=0;i<this.rain.speeds.length;i++){
        arr[i*3+1]-=this.rain.speeds[i]*dt;
        arr[i*3+2]+=this.speed*.037*dt;
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