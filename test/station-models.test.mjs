import test from 'node:test';import assert from 'node:assert/strict';
import {STATION_MODELS,stationModel,stationClearance} from '../public/station-700t.mjs';
import {SOUTH_TO_NORTH,createItinerary} from '../public/sim-core.mjs';
test('12 stations use distinct reference-based station styles',()=>{assert.equal(Object.keys(STATION_MODELS).length,12);assert.equal(new Set(Object.values(STATION_MODELS).map(x=>x.style)).size,12);for(const st of SOUTH_TO_NORTH){const p=stationModel(st);assert.equal(p.zh,st.zh);assert.ok(p.photo.startsWith('https://'));assert.ok(p.source.startsWith('https://'));}});
test('underground stations are not rendered as open platforms',()=>{assert.deepEqual(Object.entries(STATION_MODELS).filter(([k,v])=>v.underground).map(([k])=>k),['Taoyuan','Banqiao','Taipei','Nangang']);assert.ok(stationClearance(STATION_MODELS.Taipei)>stationClearance(STATION_MODELS.Tainan));});
test('northbound and southbound stops resolve the same models',()=>{for(const d of ['north','south'])for(const mode of ['local','express'])for(const st of createItinerary(d,mode).stops)assert.ok(stationModel(st).style);});
