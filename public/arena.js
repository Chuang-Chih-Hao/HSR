'use strict';
(() => {
 const canvas=document.getElementById('arenaCanvas'),ctx=canvas.getContext('2d'),W=900,H=480;
 let snap=null,seen=new Set(),fx=[],smooth=new Map(),arrival=0,lastKey='',lastStage='',shake=0;
 const keys=new Set(),controlKeys=new Set(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright']);
 function accept(f){
  if(!f)return;const tag=f.code+'/'+f.stage;if(tag!==lastStage){lastStage=tag;seen.clear();fx=[];smooth.clear();}
  snap=f;arrival=performance.now();
  for(const e of f.events||[])if(!seen.has(e.id)){seen.add(e.id);fx.push({...e,born:arrival});if(e.type==='hurt'||e.type==='skill'||e.type==='impact')shake=e.type==='skill'?6:3;}
  if(seen.size>500)seen=new Set((f.events||[]).map(e=>e.id));
 }
 socket.on('game:state',s=>accept(s.arena));socket.on('battle:frame',f=>{if(state?.code===f.code&&state.phase==='battle'&&state.stage===f.stage)accept(f);});
 const canMove=()=>socket.connected&&state?.phase==='battle'&&currentPlayer()?.hp>0;
 function movement(){const dx=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0),dy=(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0);return {dx,dy};}
 addEventListener('keydown',e=>{const k=e.key.toLowerCase();if(!controlKeys.has(k)||!canMove()||/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName||''))return;e.preventDefault();keys.add(k);socket.emit('battle:move',movement());});
 addEventListener('keyup',e=>{if(keys.delete(e.key.toLowerCase())&&canMove())socket.emit('battle:move',movement());});
 addEventListener('blur',()=>{keys.clear();if(canMove())socket.emit('battle:move',{dx:0,dy:0});});
 setInterval(()=>{if(keys.size&&canMove())socket.emit('battle:move',movement());},85);
 canvas.addEventListener('pointerdown',e=>{if(!canMove())return;const r=canvas.getBoundingClientRect();socket.emit('battle:move',{target:{x:(e.clientX-r.left)*W/r.width,y:(e.clientY-r.top)*H/r.height}});});
 const ellipse=(x,y,rx,ry,color)=>{ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fill();};
 function rect(x,y,w,h,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();}
 function text(t,x,y,size,color='#fff'){ctx.font='800 '+size+'px system-ui,"Microsoft JhengHei",sans-serif';ctx.textAlign='center';ctx.fillStyle=color;ctx.fillText(t,x,y);}
 function hp(x,y,w,v,max){rect(x-w/2,y,w,8,4,'#172234');rect(x-w/2,y,w*Math.max(0,v/max),8,4,v/max<.3?'#ff7b82':'#79e8a8');}
 function pos(key,p){let a=smooth.get(key);if(!a){a={x:p.x,y:p.y};smooth.set(key,a);}a.x+=(p.x-a.x)*.36;a.y+=(p.y-a.y)*.36;return a;}
 function background(){
  const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,'#233f50');g.addColorStop(1,'#526771');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  ctx.fillStyle='#162a3b';ctx.fillRect(0,0,W,66);ctx.fillStyle='#273e4e';ctx.fillRect(0,12,W,8);
  for(let x=-40;x<W;x+=105){rect(x,25,91,31,5,'#a7c3ce');rect(x+6,29,77,18,4,'#315a70');}
  ctx.fillStyle='#ed9c52';ctx.fillRect(0,58,W,6);
  ctx.strokeStyle='#a1bbc01b';ctx.lineWidth=1;for(let x=0;x<W;x+=48){ctx.beginPath();ctx.moveTo(x,68);ctx.lineTo(x,H);ctx.stroke();}for(let y=90;y<H;y+=42){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
  ctx.strokeStyle='#f0ce73';ctx.lineWidth=3;ctx.setLineDash([12,8]);ctx.strokeRect(18,77,W-36,H-91);ctx.setLineDash([]);
  for(const x of [24,876])for(const y of [125,280,430]){rect(x-9,y-14,18,28,4,'#293f4b');rect(x-5,y-10,10,6,2,'#a8d7df');}
 }
 function player(p,i,now){const a=pos(p.id,p),x=a.x,y=a.y,col=i?'#f3ae58':'#4cdbe5',me=p.id===socket.id;
  ellipse(x,y+5,25,10,'#0005');if(me){ctx.strokeStyle='#f4fffc';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(x,y+4,29,13,0,0,7);ctx.stroke();}
  ctx.save();if(p.hp<=0)ctx.globalAlpha=.42;const bob=Math.sin(now/150+i)*2;
  rect(x-14,y-34+bob,28,31,9,col);rect(x-17,y-51+bob,34,26,11,'#f7d6a8');rect(x-19,y-56+bob,38,16,7,i?'#b76e31':'#227f99');rect(x-12,y-41+bob,24,10,4,'#28394a');ellipse(x-5,y-36+bob,2,2,'#fff');ellipse(x+5,y-36+bob,2,2,'#fff');rect(x-13,y-7,10,12,3,'#233c52');rect(x+3,y-7,10,12,3,'#233c52');ctx.strokeStyle='#d7e7ec';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(x+18*(p.face||1),y-16);ctx.lineTo(x+33*(p.face||1),y-36);ctx.stroke();
  if(p.dodgeUntil>snap.now+(now-arrival)){ctx.strokeStyle='#b6f6ff';ctx.lineWidth=3;ctx.beginPath();ctx.arc(x,y-18,35,0,7);ctx.stroke();}
  ctx.restore();hp(x,y-70,76,p.hp,p.maxHp);text(p.name+(me?'（你）':''),x,y-77,13);if(p.hp<=0)text('等待隊友救援',x,y+24,12,'#ffe4bc');
 }
 function monster(m,now){const a=pos('monster',m),x=a.x,y=a.y,sz=m.boss?48:35,bob=Math.sin(now/180)*3;
  ellipse(x,y+7,sz*1.05,sz*.35,'#0005');ctx.save();ctx.translate(x,y-sz*.63+bob);ctx.scale(sz/35,sz/35);
  const body=ctx.createLinearGradient(0,-43,0,20);body.addColorStop(0,m.boss?'#a45deb':'#f7a25d');body.addColorStop(1,m.boss?'#4c257f':'#b54e48');
  ellipse(0,-1,35,34,body);ellipse(-29,9,12,19,m.boss?'#8950bd':'#cd6c4b');ellipse(29,9,12,19,m.boss?'#8950bd':'#cd6c4b');
  for(const side of [-1,1]){ctx.fillStyle='#d9c3a5';ctx.beginPath();ctx.moveTo(side*17,-26);ctx.lineTo(side*28,-52);ctx.lineTo(side*32,-20);ctx.fill();ellipse(side*13,-6,9,11,'#251e36');ellipse(side*13,-7,4,5,m.mode==='windup'?'#ff4c57':'#ffe69e');}
  rect(-11,12,22,6,3,'#462638');ctx.restore();hp(x,y-sz*1.75-12,sz*2.1,m.hp,m.maxHp);text(m.name,x,y-sz*1.75-19,14,'#ffe5c5');
 }
 function zone(z,now){const remain=Math.max(0,z.until-(snap.now+now-arrival));const pulse=.24+.12*Math.sin(now/75);ellipse(z.x,z.y,z.r,z.r,'rgba(255,65,70,'+pulse+')');ctx.strokeStyle='#ff8a82';ctx.lineWidth=3;ctx.setLineDash([8,5]);ctx.beginPath();ctx.arc(z.x,z.y,z.r,0,7);ctx.stroke();ctx.setLineDash([]);ctx.strokeStyle='#ff4d4d';ctx.lineWidth=5;ctx.beginPath();ctx.arc(z.x,z.y,z.r,0,Math.PI*2*(1-Math.min(1,remain/1250)));ctx.stroke();text('⚠ '+z.kind,z.x,z.y+5,18,'#fff2bb');}
 function effects(now){fx=fx.filter(e=>now-e.born<1000);for(const e of fx){const t=(now-e.born)/1000;ctx.save();ctx.globalAlpha=1-t;
 if(e.type==='attack'||e.type==='skill'){const big=e.type==='skill';ctx.strokeStyle=big?'#ffe58d':'#b2f7ff';ctx.lineWidth=big?12:6;ctx.beginPath();ctx.moveTo(e.x,e.y-20);ctx.quadraticCurveTo((e.x+e.tx)/2+30,(e.y+e.ty)/2-75,e.tx,e.ty-20);ctx.stroke();ellipse(e.tx,e.ty-15,15+t*30,10+t*18,big?'#ffe5a57f':'#baffff60');text((e.critical?'反擊！ ':'')+'−'+e.amount,e.tx,e.ty-50-t*38,25,big?'#ffe58d':'#fff');if(e.combo===3)text('3 HIT!',e.x,e.y-60-t*20,22,'#ffd47b');}
 else if(e.type==='impact'){ctx.strokeStyle='#ffc08c';ctx.lineWidth=8;ctx.beginPath();ctx.arc(e.x,e.y,(e.r||80)*Math.min(1,t*4),0,7);ctx.stroke();}
 else if(e.type==='dodge'){ctx.strokeStyle='#9cecff';ctx.lineWidth=9*(1-t);ctx.beginPath();ctx.moveTo(e.ox,e.oy);ctx.lineTo(e.x,e.y);ctx.stroke();text('閃避',e.x,e.y-45-t*20,16,'#b5f5ff');}
 else if(e.type==='hurt'||e.type==='heal'||e.type==='evade'){text(e.type==='evade'?'成功閃避':(e.type==='heal'?'+':'−')+e.amount,e.x,e.y-38-t*44,21,e.type==='hurt'?'#ff8995':'#9dffc9');}
 else if(e.type==='victory'){text('擊敗怪物！',450,190,44,'#ffe29a');}
 ctx.restore();}}
 function loop(now){requestAnimationFrame(loop);if(!state||state.phase==='lobby'||!snap)return;
  ctx.save();if(shake>.2){ctx.translate(Math.sin(now*.1)*shake,Math.cos(now*.15)*shake);shake*=.82;}
  background();const m=snap.monster;if(m?.zone)zone(m.zone,now);
  const actors=snap.players.filter(p=>Number.isFinite(p.x)).map((p,i)=>({y:p.y,draw:()=>player(p,i,now)}));if(m&&Number.isFinite(m.x)&&m.hp>0)actors.push({y:m.y,draw:()=>monster(m,now)});actors.sort((a,b)=>a.y-b.y).forEach(a=>a.draw());effects(now);
  if(snap.phase==='paused'||snap.phase==='transition'){rect(250,192,400,65,14,'#102337e8');text(snap.phase==='paused'?'等待隊友加入':'勝利！前往下一站',450,231,26,'#ffe5a6');}
  ctx.restore();const me=snap.players.find(p=>p.id===socket.id);if(me){const cd=Math.max(0,(me.dodgeReady||0)-(snap.now+now-arrival));const b=document.getElementById('dodgeBtn');b.disabled=state.phase!=='battle'||me.hp<=0||cd>0;b.querySelector('small').textContent=cd>0?'冷卻 '+(cd/1000).toFixed(1)+' 秒':'躲開紅色攻擊區';}
 }
 requestAnimationFrame(loop);
})();
