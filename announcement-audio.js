'use strict';
const cache=new Map(),pending=new Map();
function registerAnnouncements(app){
 const loading=import('./public/sim-core.mjs');
 app.get('/api/announcement',async(req,res)=>{
  const core=await loading;
  const {station,phase,direction}=req.query,st=core.SOUTH_TO_NORTH.find(s=>s.en===station);
  if(!st||!['approach','arrive','depart'].includes(phase)||!['north','south'].includes(direction))return res.sendStatus(400);
  const key=process.env.AZURE_SPEECH_KEY,region=process.env.AZURE_SPEECH_REGION;
  if(!key||!region||!/^[a-z0-9]+$/.test(region))return res.sendStatus(204);
  const id=[station,phase,direction].join('/');
  try{
   if(!cache.has(id)){
    if(!pending.has(id)){
     if(pending.size>=3)return res.sendStatus(503);
     const task=(async()=>{
      const msg=core.speakableAnnouncement(st,direction,phase).replace(/&/g,'&amp;').replace(/</g,'&lt;');
      const response=await fetch('https://'+region+'.tts.speech.microsoft.com/cognitiveservices/v1',{method:'POST',headers:{'Ocp-Apim-Subscription-Key':key,'Content-Type':'application/ssml+xml','X-Microsoft-OutputFormat':'audio-24khz-48kbitrate-mono-mp3'},body:'<speak version="1.0" xml:lang="zh-TW"><voice name="zh-TW-HsiaoChenNeural"><prosody rate="-8%">'+msg+'</prosody></voice></speak>',signal:AbortSignal.timeout(6000)});
      if(!response.ok)throw Error('speech unavailable');const audio=Buffer.from(await response.arrayBuffer());if(audio.length>1024*1024)throw Error('audio too large');cache.set(id,audio);
     })().finally(()=>pending.delete(id));pending.set(id,task);
    }
    await pending.get(id);
   }
   res.set('Cache-Control','public, max-age=86400').type('audio/mpeg').send(cache.get(id));
  }catch{res.sendStatus(503);}
 });
}
module.exports={registerAnnouncements};
