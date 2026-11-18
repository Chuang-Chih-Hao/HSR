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
test('老師房主不占玩家名額，可管理路線與開局，學生不能代替老師操作', async () => {
  const { server, io } = makeServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = `http://127.0.0.1:${server.address().port}`;
  const teacher = client(address, { transports: ['websocket'] });
  const a = client(address, { transports: ['websocket'] });
  const b = client(address, { transports: ['websocket'] });
  const third = client(address, { transports: ['websocket'] });
  const fakeTeacher = client(address, { transports: ['websocket'] });
  try {
    await Promise.all([teacher, a, b, third, fakeTeacher].map(sock => new Promise(resolve => sock.once('connect', resolve))));
    const created = await ask(teacher, 'room:createTeacher', { name: '王老師' });
    assert.equal(created.ok, true);
    assert.equal(created.role, 'teacher');
    assert.match(created.teacherToken, /^[0-9a-f]{64}$/);
    const room = rooms.get(created.code);
    assert.equal(room.players.length, 0);
    assert.equal(room.hostMode, 'teacher');
    assert.equal(room.hostName, '王老師');
    assert.equal((await ask(fakeTeacher, 'room:joinTeacher', { code: created.code, teacherToken: 'bad' })).ok, false);
    assert.equal((await ask(teacher, 'battle:action', { kind: 'attack' })).ok, false);
    assert.equal((await ask(a, 'room:join', { code: created.code, name: '學生一' })).ok, true);
    assert.equal((await ask(b, 'room:join', { code: created.code, name: '學生二' })).ok, true);
    assert.equal(room.players.length, 2);
    assert.equal((await ask(third, 'room:join', { code: created.code, name: '學生三' })).ok, false);
    assert.equal((await ask(a, 'room:setRoute', { route: 'express' })).ok, false);
    assert.equal((await ask(a, 'game:start')).ok, false);
    assert.equal((await ask(teacher, 'room:setRoute', { route: 'express' })).ok, true);
    const started = onceState(b, s => s.phase === 'battle');
    assert.equal((await ask(teacher, 'game:start')).ok, true);
    const state = await started;
    assert.equal(state.hostMode, 'teacher');
    assert.equal(state.hostName, '王老師');
    assert.equal(state.players.length, 2);
    assert.equal(state.players.some(p => p.id === teacher.id), false);
    assert.equal(state.totalStages, 4);
    const hp = state.monster.hp;
    const fought = onceState(teacher, s => s.monster?.hp < hp);
    assert.equal((await ask(a, 'battle:action', { kind: 'attack' })).ok, true);
    assert.equal((await fought).monster.hp < hp, true);
    teacher.disconnect();
    await new Promise(resolve => setTimeout(resolve, 100));
    assert.equal(room.hostId, null);
    assert.equal(room.phase, 'battle');
    const resumed = onceState(fakeTeacher, s => s.hostId === fakeTeacher.id);
    assert.equal((await ask(fakeTeacher, 'room:joinTeacher', { code: created.code, teacherToken: created.teacherToken })).ok, true);
    assert.equal((await resumed).players.length, 2);
    assert.equal(room.hostId, fakeTeacher.id);
    assert.equal((await ask(fakeTeacher, 'battle:action', { kind: 'attack' })).ok, false);
    room.phase = 'finished';
    assert.equal((await ask(a, 'game:restart')).ok, false);
    assert.equal((await ask(fakeTeacher, 'game:restart')).ok, true);
    assert.equal(room.phase, 'lobby');
    a.disconnect(); b.disconnect();
    await new Promise(resolve => setTimeout(resolve, 100));
    assert.equal(rooms.has(created.code), true);
  } finally {
    for (const sock of [teacher, a, b, third, fakeTeacher]) sock.disconnect();
    await new Promise(resolve => io.close(resolve));
    rooms.clear();
  }
});
