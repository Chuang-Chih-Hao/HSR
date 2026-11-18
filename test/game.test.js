'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { io: client } = require('socket.io-client');
const { makeServer, rooms, STATIONS, buildEncounters } = require('../server');

function ask(sock, name, body = {}) {
  return new Promise((resolve, reject) => sock.timeout(2000).emit(name, body, (err, answer) => err ? reject(err) : resolve(answer)));
}
function onceState(sock, check, ms = 2000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { sock.off('game:state', handler); reject(new Error('state timed out')); }, ms);
    function handler(state) {
      if (!check(state)) return;
      clearTimeout(timer); sock.off('game:state', handler); resolve(state);
    }
    sock.on('game:state', handler);
  });
}
test('兩位玩家可建立房間、換路線、同步戰鬥與獲得經驗', async () => {
  assert.equal(STATIONS.length, 12);
  assert.equal(buildEncounters('express').length, 4);
  assert.equal(buildEncounters('local').length, 11);
  const { server, io } = makeServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = `http://127.0.0.1:${server.address().port}`;
  const a = client(address, { transports: ['websocket'] });
  const b = client(address, { transports: ['websocket'] });
  try {
    await Promise.all([new Promise(r => a.once('connect', r)), new Promise(r => b.once('connect', r))]);
    const health = await fetch(address + '/health').then(r => r.json());
    assert.equal(health.ok, true);
    const created = await ask(a, 'room:create', { name: '阿樂' });
    assert.equal(created.ok, true);
    assert.equal(created.code.length, 6);
    const joined = await ask(b, 'room:join', { code: created.code, name: '小車長' });
    assert.equal(joined.ok, true);
    assert.equal((await ask(b, 'room:setRoute', { route: 'express' })).ok, false);
    assert.equal((await ask(a, 'room:setRoute', { route: 'express' })).ok, true);
    const battleA = onceState(a, s => s.phase === 'battle');
    const battleB = onceState(b, s => s.phase === 'battle');
    assert.equal((await ask(a, 'game:start')).ok, true);
    const [sa, sb] = await Promise.all([battleA, battleB]);
    assert.equal(sa.totalStages, 4);
    assert.equal(sa.monster.hp, sb.monster.hp);
    const hp = sa.monster.hp;
    const action = onceState(b, s => s.monster?.hp < hp);
    assert.equal((await ask(a, 'battle:action', { kind: 'attack' })).ok, true);
    const after = await action;
    assert.equal(after.players.find(p => p.id === a.id).energy, 1);
    assert.equal((await ask(a, 'battle:action', { kind: 'skill' })).ok, false);
    const invalid = await ask(a, 'battle:action', { kind: '__proto__' });
    assert.equal(invalid.ok, false);
  } finally {
    a.disconnect(); b.disconnect();
    await new Promise(resolve => io.close(resolve));
    rooms.clear();
  }
});