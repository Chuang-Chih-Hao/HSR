'use strict';
const W=900,H=480, RANGE=100, SKILL_RANGE=185;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function position(p,x,y){p.x=clamp(x,42,W-42);p.y=clamp(y,75,H-38);}
function resetPlayer(p,i){Object.assign(p,{x:330+i*240,y:355,dx:0,dy:0,inputAt:0,goal:null,dodgeUntil:0,dodgeReady:0,combo:0,comboAt:0,face:i? -1:1});}
function initArena(room,now){room.players.forEach((p,i)=>{resetPlayer(p,i);p.role=p.role||(i===0?'guard':'support');p.shieldUntil=0;});Object.assign(room.monster,{x:450,y:168,mode:'chase',attackAt:now+2200,zone:null,pattern:0,phase2:false,shield:false,shieldHits:0,lastAttacker:null,style:room.monster.boss?'boss':room.stage%3===0?'charge':room.stage%3===1?'ranged':'melee'});room.arenaEvents=[];room.eventSeq=room.eventSeq||0;}
function event(room,type,x,y,extra={}){const e={id:++room.eventSeq,type,x,y,...extra};room.arenaEvents.push(e);room.arenaEvents=room.arenaEvents.slice(-24);return e;}
function input(p,payload,now){if(!payload||typeof payload!=='object')return false;
 if(payload.target&&Number.isFinite(payload.target.x)&&Number.isFinite(payload.target.y)){p.goal={x:clamp(payload.target.x,42,W-42),y:clamp(payload.target.y,75,H-38)};p.dx=p.dy=0;}
 else if(Number.isFinite(payload.dx)&&Number.isFinite(payload.dy)){const x=clamp(payload.dx,-1,1),y=clamp(payload.dy,-1,1),n=Math.max(1,Math.hypot(x,y));p.dx=x/n;p.dy=y/n;p.goal=null;}
 else return false;p.inputAt=now;return true;}
function dodge(room,p,now){if(p.hp<=0||now<p.dodgeReady)return false;const m=room.monster;
 let dx=p.dx,dy=p.dy;if(p.goal){dx=p.goal.x-p.x;dy=p.goal.y-p.y;}if(Math.hypot(dx,dy)<.01){dx=p.x-m.x;dy=p.y-m.y;}const n=Math.hypot(dx,dy)||1;
 p.dodgeUntil=now+550;p.dodgeReady=now+1500;p.goal=null;const ox=p.x,oy=p.y;position(p,p.x+dx/n*125,p.y+dy/n*125);event(room,'dodge',p.x,p.y,{ox,oy,player:p.id});return true;}
function zoneContains(p,z){if(z.shape!=='line')return dist(p,z)<=z.r+13;const dx=z.tx-z.x,dy=z.ty-z.y,l=dx*dx+dy*dy||1,t=clamp(((p.x-z.x)*dx+(p.y-z.y)*dy)/l,0,1);return Math.hypot(p.x-z.x-dx*t,p.y-z.y-dy*t)<=z.r+13;}
function step(room,now,dt){const m=room.monster,alive=room.players.filter(p=>p.hp>0);if(!m||!alive.length)return false;
 for(const p of alive){let x=p.dx||0,y=p.dy||0;if(p.goal){x=p.goal.x-p.x;y=p.goal.y-p.y;const n=Math.hypot(x,y);if(n<5){p.goal=null;x=y=0;}else{const scale=Math.min(1,n/(230*Math.max(dt,.001)));x=x/n*scale;y=y/n*scale;}}else if(now-p.inputAt>300){x=y=0;}
 if(Math.abs(x)>.01)p.face=Math.sign(x);position(p,p.x+x*230*dt,p.y+y*230*dt);}
 let changed=false;
 if(m.mode==='windup'&&now>=m.attackAt){
  for(const p of alive){if(zoneContains(p,m.zone)&&now>=p.dodgeUntil){const damage=Math.min(p.hp,Math.max(1,Math.round((m.damage+(m.boss?5:0))*(now<(p.shieldUntil||0)?.40:1))));p.hp-=damage;p.combo=0;event(room,'hurt',p.x,p.y,{amount:damage,player:p.id});changed=true;}else if(zoneContains(p,m.zone)){event(room,'evade',p.x,p.y,{player:p.id});}}
  if(m.zone.shape==='line')position(m,m.zone.tx,m.zone.ty);event(room,'impact',m.zone.x,m.zone.y,{r:m.zone.r});m.zone=null;m.mode='recover';m.attackAt=now+(m.phase2?650:950);
 }else if(m.mode==='recover'&&now>=m.attackAt){m.mode='chase';m.attackAt=now+(m.phase2?450:850);}
 if(m.mode==='chase'){
  const target=alive.reduce((a,b)=>dist(m,a)<dist(m,b)?a:b);
  const d=dist(m,target),desired=m.style==='ranged'?185:73;if(d>desired){const speed=m.phase2?130:m.boss?106:88;position(m,m.x+(target.x-m.x)/d*Math.min(d-desired,speed*dt),m.y+(target.y-m.y)/d*Math.min(d-desired,speed*dt));}
  if(now>=m.attackAt&&(d<145||m.boss||m.style==='ranged'||m.style==='charge')){m.pattern++;const slam=m.boss&&m.pattern%3===0;const charge=(m.style==='charge'||m.boss&&m.pattern%3===1);const ranged=!slam&&!charge&&(m.style==='ranged'||m.pattern%3===0);
   if(charge){const dx=target.x-m.x,dy=target.y-m.y,n=Math.hypot(dx,dy)||1;m.zone={shape:'line',x:m.x,y:m.y,tx:clamp(target.x+dx/n*90,42,W-42),ty:clamp(target.y+dy/n*90,75,H-38),r:38,kind:'衝撞',until:now+1100};}
   else m.zone={x:slam?m.x:target.x,y:slam?m.y:target.y,r:slam?155:ranged?90:82,kind:slam?'震地衝擊':ranged?'鎖定落雷':'猛擊',until:now+(slam?1250:950)};m.mode='windup';m.attackAt=m.zone.until;event(room,'warning',m.zone.x,m.zone.y);}
 }
 return changed;
}
function hit(room,p,kind,now){
 const m=room.monster;if(!m||dist(p,m)>(kind==='skill'?SKILL_RANGE:RANGE))return {ok:false,error:'距離太遠，請先靠近怪物'};
 const combo=kind==='attack'?(now-p.comboAt<1800?p.combo%3+1:1):0;
 p.combo=combo;p.comboAt=now;
 const damage=(kind==='skill'?38+p.level*9:9+p.level*5+(combo===3?9:0))+(p.attackBonus||0);
 const alternating=m.lastAttacker&&m.lastAttacker!==p.id&&now-(m.lastHitAt||0)<2200;
 if(m.shield&&alternating){m.shieldHits--;if(m.shieldHits<=0){m.shield=false;event(room,'break',m.x,m.y);}}
 const actual=Math.min(m.hp,Math.max(1,Math.round(damage*(m.mode==='recover'?1.25:1)*(m.shield?.28:1)*(alternating?1.18:1)*(p.role==='guard'?1.12:1))));
 m.lastAttacker=p.id;m.lastHitAt=now;m.hp-=actual;p.totalDamage+=actual;
 if(kind==='skill'&&p.role==='support'){for(const q of room.players)if(dist(p,q)<260)q.shieldUntil=now+4000;event(room,'shield',p.x,p.y,{player:p.id});}
 if(m.boss&&!m.phase2&&m.hp>0&&m.hp<=m.maxHp*.55){m.phase2=true;m.shield=true;m.shieldHits=3;event(room,'phase2',m.x,m.y);}
 event(room,kind,p.x,p.y,{tx:m.x,ty:m.y,amount:actual,combo,player:p.id,critical:m.mode==='recover'});
 return {ok:true,actual,combo};
}
function frame(room,now){const m=room.monster;return {code:room.code,phase:room.phase,stage:room.stage,now,players:room.players.map(p=>({id:p.id,name:p.name,x:p.x,y:p.y,hp:p.hp,maxHp:p.maxHp,level:p.level,face:p.face,combo:p.combo,role:p.role,shieldUntil:p.shieldUntil,dodgeUntil:p.dodgeUntil,dodgeReady:p.dodgeReady})),monster:m?{name:m.name,emoji:m.emoji,x:m.x,y:m.y,hp:m.hp,maxHp:m.maxHp,boss:m.boss,mode:m.mode,zone:m.zone,style:m.style,phase2:m.phase2,shield:m.shield,shieldHits:m.shieldHits}:null,events:room.arenaEvents||[]};}
const REWARDS=Object.freeze(['power','heart','charge']);
function applyReward(p,choice){if(!REWARDS.includes(choice))return false;if(choice==='power')p.attackBonus=(p.attackBonus||0)+4;else if(choice==='heart'){p.maxHp+=14;p.hp=Math.min(p.maxHp,p.hp+26);}else{p.energy=Math.min(3,(p.energy||0)+2);p.hp=Math.min(p.maxHp,p.hp+12);}return true;}
module.exports={W,H,RANGE,SKILL_RANGE,resetPlayer,initArena,event,input,dodge,step,hit,frame,dist,zoneContains,applyReward,REWARDS};
