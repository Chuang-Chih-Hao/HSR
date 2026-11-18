import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createItinerary, SOUTH_TO_NORTH, clampSpeed, approachingSpeed, speakableAnnouncement, LEG_DISTANCE } from '../public/sim-core.mjs';

const root=dirname(dirname(fileURLToPath(import.meta.url)));
test('12 official high-speed rail stops, in either direction',()=>{
  assert.equal(SOUTH_TO_NORTH.length,12);
  assert.equal(createItinerary('north','local').stops.length,12);
  assert.equal(createItinerary('north','local').stops[0].zh,'左營');
  assert.equal(createItinerary('north','local').stops.at(-1).zh,'南港');
  assert.equal(createItinerary('south','local').stops[0].zh,'南港');
  assert.equal(createItinerary('south','local').stops.at(-1).zh,'左營');
});
test('express stops on both ends and does not visit all stops',()=>{
  for(const direction of ['north','south']){
    const plan=createItinerary(direction,'express');
    assert.equal(plan.stops.length,5);
    assert.equal(plan.stops[0].zh,plan.stations[0].zh);
    assert.equal(plan.stops.at(-1).zh,plan.stations.at(-1).zh);
    assert.deepEqual(plan.stops.map(x=>x.index),[0,1,2,5,11]);
  }
});
test('route and direction validation',()=>{
  assert.throws(()=>createItinerary('other','local'));
  assert.throws(()=>createItinerary('north','other'));
});
test('driving speed clamps and decelerates on station approach',()=>{
  assert.equal(clampSpeed(400),300);
  assert.equal(clampSpeed(-45),0);
  assert.equal(clampSpeed('not a number'),0);
  assert.equal(approachingSpeed(LEG_DISTANCE,260),260);
  assert.ok(approachingSpeed(10,260)<approachingSpeed(50,260));
  assert.equal(approachingSpeed(0,260),0);
});
test('arrival announcements preserve zh-TW station name',()=>{
  const station=createItinerary('north').stops[1];
  assert.match(speakableAnnouncement(station,'north','approach'),/台南站/);
  assert.match(speakableAnnouncement(station,'north','depart'),/北上/);
  assert.throws(()=>speakableAnnouncement(station,'north','bad'));
});
test('3D simulator is reachable from existing game and keeps teacher hosting',()=>{
  const home=readFileSync(join(root,'public/index.html'),'utf8');
  const html=readFileSync(join(root,'public/simulator.html'),'utf8');
  const backend=readFileSync(join(root,'server.js'),'utf8');
  assert.match(home,/href="\/simulator.html"/);
  assert.match(html,/simulator\.js/);
  assert.match(html,/vendor\/three/);
  assert.match(html,/data-direction="north"/);
  assert.match(html,/data-direction="south"/);
  assert.match(html,/data-route="local"/);
  assert.match(html,/data-route="express"/);
  assert.match(backend,/room:createTeacher/);
  assert.match(backend,/node_modules', 'three'/);
});