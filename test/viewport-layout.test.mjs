import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fitScale} from '../public/viewport-layout.mjs';
test('fit scales only oversized content',()=>{assert.equal(fitScale(300,200),1);assert.equal(fitScale(100,200),.5);assert.equal(fitScale(0,0),1);});
test('viewport uses fixed dynamic height and prevents page scrolling',()=>{
 const css=readFileSync(new URL('../public/simulator.css',import.meta.url),'utf8');
 assert.match(css,/height:100dvh/);assert.match(css,/overflow:hidden;overscroll-behavior:none/);
 const html=readFileSync(new URL('../public/simulator.html',import.meta.url),'utf8');
 for(const id of ['drive','route','camera','audio','progress'])assert.ok(html.includes('id="panel-'+id+'"'));
 for(const id of ['driveBtn','doorBtn','emergencyBtn','retryBtn','routeRail','routeTracker'])assert.equal([...html.matchAll(new RegExp('id="'+id+'"','g'))].length,1);
 assert.match(html,/<div class="persistent-controls">[\s\S]*id="emergencyBtn"/);
});
