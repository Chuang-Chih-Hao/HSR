import * as THREE from 'three';
import { sideLayout, platformShift, stationTrackCenters, PLATFORM_TOP, PLATFORM_EDGE, PLATFORM_WIDTH } from './station-space.mjs';
export const STATION_MODELS=Object.freeze({
  "Zuoying": {
    "zh": "左營",
    "style": "terminal",
    "feature": "地面終點站・大型弧形站棚",
    "tracks": 6,
    "underground": false,
    "photo": "https://commons.wikimedia.org/wiki/Category:Platforms_at_Zuoying_Station_(THSR)",
    "source": "https://media.taiwan.net.tw/zh-tw/portal/travel/details/attraction_397000000a_001029"
  },
  "Tainan": {
    "zh": "台南",
    "style": "slope",
    "feature": "高架・斜屋頂與玻璃帷幕",
    "tracks": 4,
    "underground": false,
    "photo": "https://commons.wikimedia.org/wiki/File:Platform_2,_THSR_Tainan_Station_20150705.jpg",
    "source": "https://www.taiwanglass.com/application_detail.php?id=541&langeno=tw&sid=174"
  },
  "Chiayi": {
    "zh": "嘉義",
    "style": "landscape",
    "feature": "高架・地景式長斜屋頂",
    "tracks": 4,
    "underground": false,
    "photo": "https://www.travelking.com.tw/tourguide/scenery104456.html",
    "source": "https://apextraveller.com/xuite-377802159/"
  },
  "Yunlin": {
    "zh": "雲林",
    "style": "wave",
    "feature": "高架・層疊曲線金屬屋面",
    "tracks": 4,
    "underground": false,
    "photo": "https://www.yunlin.gov.tw/News_Content.aspx?n=1244&s=214596",
    "source": "https://www.krisyaoartech.com/zh-tw/projects/transportation/Yunlin-High-Speed-Rail-Station"
  },
  "Changhua": {
    "zh": "彰化",
    "style": "flower",
    "feature": "高架・花瓣柱與玻璃綠建築",
    "tracks": 4,
    "underground": false,
    "photo": "https://www.krisyaoartech.com/en/projects/transportation/Changhua-High-Speed-Rail-Station",
    "source": "https://www.twarchitect.org.tw/works/高鐵彰化站/"
  },
  "Taichung": {
    "zh": "台中",
    "style": "truss",
    "feature": "高架・大型空間桁架站棚",
    "tracks": 6,
    "underground": false,
    "photo": "https://commons.wikimedia.org/wiki/File:Roof_Structure_of_THSR_Taichung_Station.jpg",
    "source": "https://www.habitech.com.tw/en/portfolio-item/taichung-station-of-taiwan-high-speed-rail/"
  },
  "Miaoli": {
    "zh": "苗栗",
    "style": "grid",
    "feature": "高架・幾何金屬格柵",
    "tracks": 4,
    "underground": false,
    "photo": "https://commons.wikimedia.org/wiki/File:Northbound_platform_of_THSR_Miaoli_Station_01.jpg",
    "source": "https://www.miaolitravel.net/article.aspx?sNo=03007113"
  },
  "Hsinchu": {
    "zh": "新竹",
    "style": "wing",
    "feature": "高架・雙翼曲面與露天軌道",
    "tracks": 4,
    "underground": false,
    "photo": "https://bbs.mychat.to/reads.php?tid=569605",
    "source": "https://www.krisyaoartech.com/zh-tw/projects/transportation/Hsinchu-High-Speed-Rail-Station"
  },
  "Taoyuan": {
    "zh": "桃園",
    "style": "skylight",
    "feature": "地下・採光天窗與挑空",
    "tracks": 4,
    "underground": true,
    "photo": "https://commons.wikimedia.org/wiki/Category:Platforms_at_Taoyuan_Station_(THSR)",
    "source": "https://tlc.tyc.edu.tw/生態巡禮/中壢區：踏青查塘探高鐵/"
  },
  "Banqiao": {
    "zh": "板橋",
    "style": "curve",
    "feature": "地下・弧形月台意象",
    "tracks": 2,
    "underground": true,
    "photo": "https://commons.wikimedia.org/wiki/File:Platform_at_THSR_Banqiao_Station_01.jpg",
    "source": "https://www.thsrc.com.tw/ArticleContent/e6e26e66-7dc1-458f-b2f3-71ce65fdc95f"
  },
  "Taipei": {
    "zh": "台北",
    "style": "city",
    "feature": "地下・密集柱列與長條照明",
    "tracks": 4,
    "underground": true,
    "photo": "https://commons.wikimedia.org/wiki/Category:Platforms_at_Taipei_Station_(THSR)",
    "source": "https://www.thsrc.com.tw/ArticleContent/977abb69-413a-4ccf-a109-0272c24fd490"
  },
  "Nangang": {
    "zh": "南港",
    "style": "modern",
    "feature": "地下終點站・混凝土梁與現代頂棚",
    "tracks": 4,
    "underground": true,
    "photo": "https://commons.wikimedia.org/wiki/File:On_the_platform_at_the_THSR_Nangang_Station_ca._2024.png",
    "source": "https://www.thsrc.com.tw/ArticleContent/2f940836-cedc-41ef-8e28-c2336ac8fe68"
  }
});
export function stationModel(station){const p=STATION_MODELS[station.en];if(!p)throw new Error('Unknown station '+station.en);return p;}
export function stationClearance(p){return p.underground?295:167;}
const mat=(color,other={})=>new THREE.MeshStandardMaterial({color,roughness:.68,...other});
export function addStationArchitecture(group,station,api){
 const {box,rod,cylinder,makeSign}=api,p=stationModel(station),style=p.style;
 group.name='HSR '+station.en+' / '+style;group.userData.stationStyle=style;group.userData.stationFeature=p.feature;group.userData.clearance=stationClearance(p);
 const steel=mat(0x87959e,{metalness:.45}),white=mat(0xe1e4e1),concrete=mat(0xa5aaad),dark=mat(0x344653),glass=mat(0x83b9c7,{metalness:.22,roughness:.25}),blue=mat(0x477483),warm=mat(0xc5b5a0),green=mat(0x527d47),lamp=new THREE.MeshBasicMaterial({color:0xfff5dd}),roof=mat(0x7b8790,{side:THREE.DoubleSide,metalness:.34,roughness:.58}),soil=mat(0x616b53);
 const own=[steel,white,concrete,dark,glass,blue,warm,green,lamp,roof,soil];group.userData.architectureMaterials=own;
 const shift=x=>x < -1.9?platformShift(p,-1):0;
 const b=(w,h,d,m,x,y,z)=>box(group,w,h,d,m,x+shift(x),y,z);
 const bar=(a,b,r=.085,m=steel)=>rod(group,[a[0]+shift(a[0]),a[1],a[2]],[b[0]+shift(b[0]),b[1],b[2]],r,m);
 const raw=(w,h,d,m,x,y,z)=>box(group,w,h,d,m,x,y,z);
 const rawBar=(a,b,r=.085,m=steel)=>rod(group,a,b,r,m);
 const onSide=(side,x)=>side*x+platformShift(p,side);
 // A roof is an actual double-sided curved surface, not a texture billboard.
 function canopy(x0,x1,z0,z1,height,m=roof,cols=20,rows=28){
   const v=[],idx=[];
   for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){const x=x0+(x1-x0)*i/cols,z=z0+(z1-z0)*j/rows;v.push(x+shift(x),height(x,z),z);}
   for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const n=j*(cols+1)+i,q=n+cols+1;idx.push(n,q,n+1,n+1,q,q+1);}
   const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(v,3));geo.setIndex(idx);geo.computeVertexNormals();
   const mesh=new THREE.Mesh(geo,m);mesh.receiveShadow=true;mesh.castShadow=true;group.add(mesh);
   // Thin metal standing seams and eave fascia break up the old featureless slab.
   for(let x=x0+.45;x<x1-.15;x+=.85){
     const zz=(z0+z1)/2,yy=height(x,zz);
     // Only straight/near-straight longitudinal roofs receive continuous strips.
     if(Math.abs(height(x,z0)-yy)<.22&&Math.abs(height(x,z1)-yy)<.22)b(.036,.045,z1-z0,steel,x,yy+.024,zz);
   }
   for(const x of [x0,x1])for(let z=z0;z<z1-1e-4;z+=12){
     const e=Math.min(z+12,z1);bar([x,height(x,z)-.12,z],[x,height(x,e)-.12,e],.13,dark);
   }
 }
 function ribs(x0,x1,y,z0=-155,z1=155,step=20){
   for(let z=z0;z<=z1;z+=step){const n=12;for(let i=0;i<n;i++){const a=x0+(x1-x0)*i/n,bx=x0+(x1-x0)*(i+1)/n;bar([a,y(a,z)-.18,z],[bx,y(bx,z)-.18,z],.10);}}
 }
 function facade(side,z=0,len=96,h=6.5,x=15.3){
   b(.22,h,len,glass,side*x,h/2+.45,z);
   for(let q=z-len/2;q<=z+len/2;q+=4.8)b(.32,h+.12,.12,steel,side*(x-.05),h/2+.45,q);
   for(let y=1.2;y<h+.45;y+=2.0)b(.34,.13,len,steel,side*(x-.05),y,z);
 }
 function platformPosts(side,y=6.7,spacing=20,x=9.5){
   for(let z=-148;z<=148;z+=spacing){b(.34,y-.46,.34,white,side*x,(y+.46)/2,z);b(.18,.09,Math.min(15,spacing-2),lamp,side*6.2,y-.26,z);}
 }
 function sideCanopy(side,h,shape){
   const min=side>0?1.92:-11.25,max=side>0?11.25:-1.92;
   canopy(min,max,-164,164,(x,z)=>shape?shape(x,z,side):h);
   ribs(min,max,(x,z)=>shape?shape(x,z,side):h);
 }
 function rail(x,z0=-167,z1=167){
   const len=z1-z0,cz=(z0+z1)/2;raw(3.4,.15,len,dark,x,-.48,cz);
   for(const off of [-.7175,.7175])raw(.11,.16,len,steel,x+off,-.32,cz);
   for(let z=z0+2;z<z1;z+=1.4)raw(2.9,.09,.34,concrete,x,-.41,z);
 }
 // Additional tracks are visual approximations. The playable rail is kept straight at x=0.
 if(!p.underground){
   const xs=stationTrackCenters(p);
   for(const x of xs)if(x!==0)rail(x);
   if(sideLayout(p)){
     // Two outer stopping tracks and two inner through tracks. A solid median
     // wind/noise screen matches the platform photographs; no tracks through halls.
     raw(.15,2.1,334,dark,-2.60,.65,0);
     for(let z=-164;z<=164;z+=4)raw(.16,2.2,.12,steel,-2.60,.68,z);
     for(let y=-.15;y<1.7;y+=.25)raw(.18,.045,334,steel,-2.60,y,0);
   }
   if(style!=='terminal')for(const z of [-136,-68,0,68,136]){
     for(const x of [-12,12])b(1.6,5.3,2.0,concrete,x,-2.9,z);
   }
 }
 if(style==='terminal'){
   // Ground-level terminal: repeated broad barrel roofs, white columns, island-platform feel.
   for(const center of [-12,0,12]){
     const f=x=>8.4+3.1*Math.sqrt(Math.max(0,1-((x-center)/6.1)**2));
     canopy(center-6,center+6,-166,166,f);ribs(center-6,center+6,f,-150,150,15);
   }
   for(const side of [-1,1]){platformPosts(side,8.4,15,9.5);facade(side,0,160,7.4,23);}
   b(41,.7,5,white,0,11.9,-157);b(37,4,6,glass,0,9.4,-157);
 }else if(style==='slope'||style==='landscape'){
   // Tainan/Chiayi are sister stations: side platforms, open tracks, a separate
   // west-side hall and covered links. Photo reference: white round Y columns,
   // exposed dark roof deck, inclined glazing/louvres, tiled platforms.
   const tainan=style==='slope',columnBase=tainan?white:blue;
   const f=(x,z)=>7.8-.155*(Math.abs(x)-1.92);
   for(const side of [-1,1]){
     sideCanopy(side,7.6,f);
     for(let z=-147;z<=147;z+=21){
       const x=side*7.5,globalX=onSide(side,7.5);
       cylinder(group,.48,.48,2.65,white,globalX,2.45,z,16);
       cylinder(group,.49,.49,.53,columnBase,globalX,1.43,z,16);
       for(const target of [side*2.3,side*10.8])bar([x,3.77,z],[target,f(target,z)-.20,z],.18,steel);
       for(const dz of [-4.5,4.5])bar([x,3.77,z],[x,f(x,z+dz)-.25,z+dz],.13,steel);
       const sign=makeSign(station.zh,station.en,1.6);sign.position.set(globalX,2.85,z+.50);group.add(sign);
       b(.22,.09,14,lamp,side*5.8,6.18,z);
       b(.7,.38,1.8,dark,side*6.1,5.7,z+5);
     }
     for(let z=-156;z<=156;z+=5.5){
       // Glazed outer facade slopes inward at the roof and rests on the parapet.
       b(.14,1.28,5.48,concrete,side*10.85,1.76,z);
       const x=onSide(side,10.72);
       const glassPanel=box(group,.10,3.6,5.36,glass,x,4.27,z);
       glassPanel.rotation.z=side*.15;
       bar([side*10.99,2.45,z-2.75],[side*10.43,6.1,z-2.75],.065,steel);
       for(let j=0;j<5;j++)b(.24,.045,5.45,steel,side*(10.9-j*.10),2.85+j*.55,z);
     }
     for(let x=2.2;x<11;x+=.68)bar([side*x,f(side*x,0)-.19,-164],[side*x,f(side*x,0)-.19,164],.046,dark);
   }
   // One separate station hall rather than two enormous white roofs alongside the whole line.
   const hallRoof=x=>7.8-(x-16)*.245;
   raw(25,.55,116,concrete,28.5,-4.8,8);
   raw(25,6.5,112,white,28.5,-1.1,8);
   raw(.18,5.6,109,glass,41.05,1.3,8);
   for(let z=-46;z<=62;z+=4.8)raw(.23,6.0,.14,steel,41.18,1.0,z);
   canopy(15,43,-53,69,hallRoof,roof,16,20);ribs(15,43,hallRoof,-48,66,12);
   for(const z of [-25,35]){
     raw(6,.30,7,concrete,13.4,.92,z);raw(6,2.9,7,glass,13.4,2.62,z);raw(6.5,.28,7.4,roof,13.4,4.2,z);
   }
   if(tainan){raw(9,4.2,36,glass,48,0,48);raw(10,.28,38,roof,48,2.25,48);}
   else for(let z=-48;z<62;z+=14){raw(4,.35,9,soil,46,-4.4,z);raw(2,.65,7,green,46,-3.9,z);}
 }else if(style==='wave'){
   for(const side of [-1,1]){
     for(let n=0;n<3;n++){
       const lo=3.6+n*3.2,hi=lo+3.5,x0=side>0?lo:-hi,x1=side>0?hi:-lo;
       canopy(x0,x1,-163+n*7,163-n*7,(x,z)=>8.0-n*.68+.62*Math.sin(z/34+n*.5));
     }
     for(let z=-145;z<=145;z+=15){
       const x=side*(9.4+.55*Math.sin(z/33));bar([x,PLATFORM_TOP,z],[x+side*.50,4.2,z],.28,concrete);for(const target of [side*4.0,side*10.6])bar([x+side*.50,4.2,z],[target,7.2,z],.20,steel);
       b(.13,.08,12,lamp,side*6.4,7.15,z);
     }
     facade(side,0,110,6.4,15.8);
   }
 }else if(style==='flower'){
   for(const side of [-1,1]){
     sideCanopy(side,7.7,(x,z)=>7.55-.13*(Math.abs(x)-2));
     for(let z=-144;z<=144;z+=18){
       const x=side*9.4;bar([x,.45,z],[x,4.0,z],.24,white);
       for(const dx of [-4.4,1.4])bar([x,4,z],[x+side*dx,7.1,z],.27,steel);
       b(.18,.09,12,lamp,side*6.2,6.65,z);
     }
     facade(side,0,130,8.4,15.5);
     for(let z=-57;z<=57;z+=9){b(3.8,.5,7.5,soil,side*18.6,.25,z);for(let k=0;k<3;k++)b(.72,1.1+k*.25,.72,green,side*(17.3+k*.85),.8+k*.12,z);}
     canopy(side>0?13:-21,side>0?21:-13,-64,64,(x,z)=>9+.55*Math.cos(z/11),roof);
   }
 }else if(style==='truss'){
   // Large station-wide roof and lattice / diagonal steelwork.
   const f=x=>10.3+3.7*Math.sqrt(Math.max(0,1-(x/27)**2));
   canopy(-27,27,-167,167,f);ribs(-27,27,f,-156,156,12);
   for(const side of [-1,1]){
     for(let z=-150;z<=150;z+=24){
       b(.85,9.3,.85,concrete,side*22,5.0,z);
       bar([side*22,8.8,z],[side*14,12.5,z+5],.22);bar([side*22,8.8,z],[side*14,12.5,z-5],.22);
       b(.14,.11,20,lamp,side*6.8,9.0,z);
     }
     facade(side,0,152,8.6,26.3);
     for(let z=-144;z<144;z+=12)bar([side*23,10.6,z],[side*12,12.5,z+12],.10);
   }
 }else if(style==='grid'){
   for(const side of [-1,1]){
     sideCanopy(side,7.4,(x,z)=>7.6-.13*(Math.abs(x)-2));
     for(let z=-147;z<=147;z+=18){bar([side*10.3,1.12,z],[side*9.5,6.8,z],.18,steel);bar([side*9.5,6.8,z],[side*2.2,7.3,z],.14,steel);bar([side*10.3,3.6,z],[side*5.2,7.1,z],.11,steel);}
     facade(side,0,120,8.1,15.5);
     for(let z=-64;z<64;z+=3.2){b(.18,7.8,.19,white,side*16.15,4.3,z);b(.9,.1,2.85,blue,side*16.1,8.4,z);}
     for(let z=-54;z<=54;z+=8)b(4,.12,6,blue,side*19.0,8.8,z);
   }
 }else if(style==='wing'){
   // Two separate wing canopies leave the center track open to the sky.
   for(const side of [-1,1]){
     const f=(x,z)=>7.3+2.5*Math.sin(Math.PI*(Math.abs(x)-3.8)/10.6)+.55*Math.cos(z/70);
     canopy(side>0?3.8:-14.4,side>0?14.4:-3.8,-166,166,f);ribs(side>0?3.8:-14.4,side>0?14.4:-3.8,f,-150,150,25);
     for(let z=-145;z<=145;z+=25){const x=onSide(side,7.8);cylinder(group,.43,.43,2.8,white,x,2.52,z,14);for(const tx of [side*4.2,side*12])bar([side*7.8,3.92,z],[tx,8.1,z],.18,steel);for(const dz of [-5,5])bar([side*7.8,3.92,z],[side*8.5,8.9,z+dz],.12,steel);}
     facade(side,0,120,7.4,16.0);
   }
 }else{
   // Underground station and approaches use track-relative geometry, not physical elevations.
   const curve=style==='curve',sky=style==='skylight',city=style==='city';
   const xEdge=curve?11.7:12.5,ceiling=sky?7.2:city?7.4:style==='modern'?8.1:7.6;
   const wallMat=curve?warm:city?mat(0xb6b4ab):concrete;if(city)own.push(wallMat);
   // Enclose station and short approach/exit portals; no outdoor scenery through the walls.
   for(const side of [-1,1]){
     b(.65,ceiling,334,wallMat,side*xEdge,ceiling/2,0);
     for(let z=-156;z<=156;z+=curve?11:city?10:16){
       const x=side*(curve?9.0+.65*Math.cos(z/40):city?8.5:9.8);
       b(city?.85:.60,ceiling-.4,city?1.0:.70,style==='modern'?concrete:white,x,(ceiling+.4)/2,z);
       b(.25,.06,curve?8:12,lamp,side*6.0,ceiling-.38,z);
       b(.08,.56,2.9,style==='modern'?blue:dark,side*(xEdge-.38),3.0,z);
     }
     b(.13,.20,334,style==='modern'?blue:city?dark:warm,side*(xEdge-.38),2.4,0);
   }
   // Platform photos show suspended flat ceiling panels and linear lamps,
   // including Banqiao. Its actual curvature is in plan, not a barrel roof.
   b(26,.52,334,concrete,0,ceiling+.35,0);
   for(let z=-165;z<=165;z+=2.3){
     for(const side of [-1,1])b(8.5,.12,2.26,white,side*6.65,ceiling-.28,z);
     if(style==='modern')b(25,.45,.60,concrete,0,ceiling-.1,z);
   }
   for(const side of [-1,1]){
     b(.33,.09,334,dark,side*2.38,ceiling-.28,0);
     b(.28,.07,334,lamp,side*2.38,ceiling-.37,0);
     if(sky)for(let z=-150;z<=150;z+=9)b(.065,1.0,8.7,blue,side*11.96,3.25,z);
   }
   for(const side of [-1,1])b(.16,.07,334,lamp,side*5.8,ceiling-.72,0);
   for(const end of [-1,1]){
     const z=end*231;
     for(const side of [-1,1])b(.65,8.7,128,concrete,side*5.5,4.1,z);
     b(12,.65,128,concrete,0,8.65,z);
     for(let q=-54;q<=54;q+=12){b(.13,.06,7,lamp,-3.5,8.28,z+q);b(.13,.06,7,lamp,3.5,8.28,z+q);}
   }
   // The ground-level structure is illustrative and sits above the underground shell.
   if(sky){b(22,4.5,105,glass,0,ceiling+3.0,0);b(23,.35,110,white,0,ceiling+5.5,0);}
   if(style==='modern'){for(const x of [-9,9]){b(12,15,49,glass,x,ceiling+8.2,12);for(let y=ceiling+2;y<ceiling+15;y+=3)b(12.2,.18,49.2,white,x,y,12);}}
   if(city){b(25,6,68,warm,0,ceiling+3.5,0);canopy(-14,14,-37,37,x=>ceiling+7+3*(1-Math.abs(x)/14),mat(0x73634d,{side:THREE.DoubleSide}));}
   if(curve){b(22,12,55,glass,0,ceiling+6.5,0);for(let y=ceiling+2;y<ceiling+12;y+=2.5)b(22.2,.16,55.2,steel,0,y,0);}
 }
 // Distinctive platform info signs and safe stop location remain common wayfinding.
 // Dedicated station catenary, clear of platform roofs and underground ceiling.
 if(!p.underground){
   const tracks=stationTrackCenters(p),left=Math.min(...tracks)-2.1,right=Math.max(...tracks)+2.1;
   for(let z=-158;z<=158;z+=28){
     raw(.24,7.4,.24,steel,left,3.38,z);
     rawBar([left,7.05,z],[right,7.05,z],.075,steel);
     for(const x of tracks){raw(.13,.22,.15,steel,x,6.91,z);raw(.045,.035,28,steel,x,6.75,z);}
   }
 }else{
   raw(.06,.045,334,steel,0,6.25,0);
 }
 const entrance=makeSign(station.zh+'站',station.en+' / HSR',p.underground?4.8:5.5);
 entrance.position.set(0,p.underground?5.6:8.25,162);group.add(entrance);
 return group;
}
