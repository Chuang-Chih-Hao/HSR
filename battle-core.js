'use strict';
const W=900,H=480, RANGE=100, SKILL_RANGE=185;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function position(p,x,y){p.x=clamp(x,42,W-42);p.y=clamp(y,75,H-38);}
function resetPlayer(p,i){Object.assign(p,{x:330+i*240,y:355,dx:0,dy:0,inputAt:0,goal:null,dodgeUntil:0,dodgeReady:0,combo:0,comboAt:0,face:i? -1:1});}
function initArena(room,now){room.players.forEach(resetPlayer);Object.assign(room.monster,{x:450,y:168,mode:'chase',attackAt:now+2200,zone:null,pattern:0});room.arenaEvents=[];room.eventSeq=room.eventSeq||0;}
function event(room,type,x,y,extra={}){const e={id:++room.eventSeq,type,x,y,...extra};room.arenaEvents.push(e);room.arenaEvents=room.arenaEvents.slice(-24);return e;}
function input(p,payload,now){if(!payload||typeof payload!=='object')return false;
 if(payload.target&&Number.isFinite(payload.target.x)&&Number.isFinite(payload.target.y)){p.goal={x:clamp(payload.target.x,42,W-42),y:clamp(payload.target.y,75,H-38)};p.dx=p.dy=0;}
 else if(Number.isFinite(payload.dx)&&Number.isFinite(payload.dy)){const x=clamp(payload.dx,-1,1),y=clamp(payload.dy,-1,1),n=Math.max(1,Math.hypot(x,y));p.dx=x/n;p.dy=y/n;p.goal=null;}
 else return false;p.inputAt=now;return true;}
function dodge(room,p,now){if(p.hp<=0||now<p.dodgeReady)return false;const m=room.monster;
 let dx=p.dx,dy=p.dy;if(p.goal){dx=p.goal.x-p.x;dy=p.goal.y-p.y;}if(Math.hypot(dx,dy)<.01){dx=p.x-m.x;dy=p.y-m.y;}const n=Math.hypot(dx,dy)||1;
 p.dodgeUntil=now+550;p.dodgeReady=now+1500;p.goal=null;const ox=p.x,oy=p.y;position(p,p.x+dx/n*125,p.y+dy/n*125);event(room,'dodge',p.x,p.y,{ox,oy,player:p.id});return true;}
function step(room,now,dt){const m=room.monster,alive=room.players.filter(p=>p.hp>0);if(!m||!alive.length)return false;
 for(const p of alive){let x=p.dx||0,y=p.dy||0;if(p.goal){x=p.goal.x-p.x;y=p.goal.y-p.y;const n=Math.hypot(x,y);if(n<5){p.goal=null;x=y=0;}else{const scale=Math.min(1,n/(230*Math.max(dt,.001)));x=x/n*scale;y=y/n*scale;}}else if(now-p.inputAt>300){x=y=0;}
 if(Math.abs(x)>.01)p.face=Math.sign(x);position(p,p.x+x*230*dt,p.y+y*230*dt);}
 let changed=false;
 if(m.mode==='windup'&&now>=m.attackAt){
  for(const p of alive){if(dist(p,m.zone)<=m.zone.r+13&&now>=p.dodgeUntil){const damage=Math.min(p.hp,m.damage+(m.boss?5:0));p.hp-=damage;p.combo=0;event(room,'hurt',p.x,p.y,{amount:damage,player:p.id});changed=true;}else if(dist(p,m.zone)<=m.zone.r+13){event(room,'evade',p.x,p.y,{player:p.id});}}
  event(room,'impact',m.zone.x,m.zone.y,{r:m.zone.r});m.zone=null;m.mode='recover';m.attackAt=now+850;
 }else if(m.mode==='recover'&&now>=m.attackAt){m.mode='chase';m.attackAt=now+850;}
 if(m.mode==='chase'){
  const target=alive.reduce((a,b)=>dist(m,a)<dist(m,b)?a:b);
  const d=dist(m,target);if(d>73){const speed=m.boss?106:88;position(m,m.x+(target.x-m.x)/d*Math.min(d-73,speed*dt),m.y+(target.y-m.y)/d*Math.min(d-73,speed*dt));}
  if(now>=m.attackAt&&(d<145||m.boss)){m.pattern++;const slam=m.boss&&m.pattern%2===0;const ranged=!slam&&m.pattern%3===0;
   m.zone={x:slam?m.x:target.x,y:slam?m.y:target.y,r:slam?155:ranged?100:82,kind:slam?'震地衝擊':ranged?'追蹤落雷':'猛擊',until:now+(slam?1250:950)};m.mode='windup';m.attackAt=m.zone.until;event(room,'warning',m.zone.x,m.zone.y);}
 }
 return changed;
}
function hit(room,p,kind,now){
 const m=room.monster;if(!m||dist(p,m)>(kind==='skill'?SKILL_RANGE:RANGE))return {ok:false,error:'距離太遠，請先靠近怪物'};
 const combo=kind==='attack'?(now-p.comboAt<1800?p.combo%3+1:1):0;
 p.combo=combo;p.comboAt=now;
 const damage=kind==='skill'?38+p.level*9:9+p.level*5+(combo===3?9:0);
 const actual=Math.min(m.hp,Math.round(damage*(m.mode==='recover'?1.25:1)));
 m.hp-=actual;p.totalDamage+=actual;
 event(room,kind,p.x,p.y,{tx:m.x,ty:m.y,amount:actual,combo,player:p.id,critical:m.mode==='recover'});
 return {ok:true,actual,combo};
}
function frame(room,now){const m=room.monster;return {code:room.code,phase:room.phase,stage:room.stage,now,players:room.players.map(p=>({id:p.id,name:p.name,x:p.x,y:p.y,hp:p.hp,maxHp:p.maxHp,level:p.level,face:p.face,combo:p.combo,dodgeUntil:p.dodgeUntil,dodgeReady:p.dodgeReady})),monster:m?{name:m.name,emoji:m.emoji,x:m.x,y:m.y,hp:m.hp,maxHp:m.maxHp,boss:m.boss,mode:m.mode,zone:m.zone}:null,events:room.arenaEvents||[]};}
module.exports={W,H,RANGE,SKILL_RANGE,resetPlayer,initArena,event,input,dodge,step,hit,frame,dist};
