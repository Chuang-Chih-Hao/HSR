'use strict';

const express = require('express');
const http = require('http');
const path = require('path');
const crypto = require('crypto');
const { Server } = require('socket.io');

const STATIONS = ['左營', '台南', '嘉義', '雲林', '彰化', '台中', '苗栗', '新竹', '桃園', '板橋', '台北', '南港'];
const LOCAL_MONSTERS = [
  ['稻田史萊姆', '🌾'], ['糖果小怪', '🍬'], ['雲朵幽靈', '☁️'],
  ['車廂搗蛋鬼', '👺'], ['貓頭鷹守衛', '🦉'], ['月光蝙蝠', '🦇'],
  ['竹林小妖', '🎋'], ['雷電機器人', '🤖'], ['鐵甲烏龜', '🐢'],
  ['城市巨怪', '👾'], ['終點魔王・暗影列車', '🐉']
];
const EXPRESS_MONSTERS = [
  ['高速風暴怪', '🌪️'], ['隧道守護者', '🦇'],
  ['鋼鐵機器獸', '🤖'], ['終點魔王・暗影列車', '🐉']
];
const rooms = new Map();
const MAX_ROOMS = 500;
const ROOM_TTL = 2 * 60 * 60 * 1000;
const ACTION_INTERVAL = 500;

function cleanName(value) {
  return typeof value === 'string' ? value.trim().replace(/[<>\u0000-\u001f]/g, '').slice(0, 14) || '小小勇者' : '小小勇者';
}
function cleanCode(value) {
  return typeof value === 'string' ? value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) : '';
}
function codeForRoom() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do { code = Array.from(crypto.randomBytes(6), b => alphabet[b % alphabet.length]).join(''); }
  while (rooms.has(code));
  return code;
}
function buildEncounters(route) {
  if (route === 'express') {
    return EXPRESS_MONSTERS.map(([name, emoji], index) => ({
      station: index === 0 ? '左營出發' : index === 3 ? '南港終點' : `直達途中 ${index}`,
      name, emoji, boss: index === 3,
      maxHp: index === 3 ? 230 : 82 + index * 45,
      damage: index === 3 ? 18 : 10 + index * 3,
      xp: index === 3 ? 105 : 35 + index * 14,
      coins: 18 + index * 11
    }));
  }
  return LOCAL_MONSTERS.map(([name, emoji], index) => ({
    station: STATIONS[index + 1], name, emoji, boss: index === 10,
    maxHp: index === 10 ? 265 : 46 + index * 16,
    damage: index === 10 ? 17 : 6 + Math.floor(index / 2),
    xp: index === 10 ? 110 : 25 + index * 6,
    coins: 8 + index * 3
  }));
}
function freshPlayer(id, name) {
  return { id, name, hp: 100, maxHp: 100, level: 1, xp: 0, xpNeeded: 50, energy: 0, coins: 0, lastAction: 0, totalDamage: 0, online: true };
}
function addLog(room, message) {
  room.log.push(message);
  room.log = room.log.slice(-12);
}
function publicState(room) {
  const encounter = room.encounters[room.stage] || null;
  return {
    code: room.code, route: room.route, phase: room.phase,
    hostId: room.hostId, hostMode: room.hostMode, hostName: room.hostName,
    hostConnected: !!room.hostId, stage: room.stage, totalStages: room.encounters.length,
    stationNames: STATIONS, station: encounter ? encounter.station : (room.stage >= room.encounters.length ? '南港' : '左營'),
    monster: room.monster ? { ...room.monster } : null,
    players: room.players.map(({ id, name, hp, maxHp, level, xp, xpNeeded, energy, coins, totalDamage }) =>
      ({ id, name, hp, maxHp, level, xp, xpNeeded, energy, coins, totalDamage })),
    log: room.log.slice(), winner: room.phase === 'finished'
  };
}
function makeServer() {
  const app = express();
  app.disable('x-powered-by');
  // Expose local Three.js ESM assets so Render needs no external browser CDN.
  app.use('/vendor/three', express.static(path.join(__dirname, 'node_modules', 'three'), { maxAge: '1d' }));
  app.use(express.static(path.join(__dirname, 'public')));
  app.get('/health', (_, res) => res.json({ ok: true, game: 'hsr-adventure', rooms: rooms.size }));
  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: false }, maxHttpBufferSize: 10000 });

  function emit(room) {
    room.touched = Date.now();
    io.to(room.code).emit('game:state', publicState(room));
  }
  function spawn(room) {
    if (!rooms.has(room.code) || room.phase !== 'transition') return;
    const spec = room.encounters[room.stage];
    if (!spec) {
      room.phase = 'finished';
      addLog(room, '🎉 恭喜抵達南港！雙人冒險成功！');
      emit(room);
      return;
    }
    room.monster = { name: spec.name, emoji: spec.emoji, hp: spec.maxHp, maxHp: spec.maxHp, damage: spec.damage, boss: spec.boss };
    room.phase = room.players.length === 2 ? 'battle' : 'paused';
    room.nextEnemyAttack = Date.now() + 4500;
    addLog(room, `🚄 抵達 ${spec.station}！${spec.boss ? '魔王出現：' : '遇到'}${spec.name}`);
    emit(room);
  }
  function grantXp(player, amount, room) {
    player.xp += amount;
    player.coins += Math.max(3, Math.floor(amount / 2));
    player.hp = Math.min(player.maxHp, player.hp + 8);
    while (player.xp >= player.xpNeeded) {
      player.xp -= player.xpNeeded;
      player.level += 1;
      player.xpNeeded = 50 + (player.level - 1) * 35;
      player.maxHp += 12;
      player.hp = Math.min(player.maxHp, player.hp + 36);
      addLog(room, `✨ ${player.name} 升到 Lv.${player.level}！`);
    }
  }
  function monsterDefeated(room) {
    const spec = room.encounters[room.stage];
    room.monster.hp = 0;
    room.phase = 'transition';
    for (const player of room.players) grantXp(player, spec.xp, room);
    addLog(room, `🏆 擊敗 ${spec.name}！每人獲得 ${spec.xp} EXP`);
    room.stage += 1;
    emit(room);
    setTimeout(() => spawn(room), 1700);
  }
  function leave(socket) {
    const code = socket.data.roomCode;
    if (!code) return;
    socket.leave(code);
    delete socket.data.roomCode;
    const role = socket.data.role;
    delete socket.data.role;
    const room = rooms.get(code);
    if (!room) return;
    if (role === 'teacher') {
      if (room.hostId === socket.id) {
        room.hostId = null;
        addLog(room, '👩‍🏫 老師暫時離線，學生可以繼續戰鬥。');
        emit(room);
      }
      return;
    }
    const before = room.players.length;
    room.players = room.players.filter(p => p.id !== socket.id);
    if (before === room.players.length) return;
    if (!room.players.length && room.hostMode !== 'teacher') {
      rooms.delete(code);
      return;
    }
    if (room.hostMode === 'player' && room.hostId === socket.id) {
      room.hostId = room.players[0]?.id || null;
      room.hostName = room.players[0]?.name || '';
    }
    if (room.phase === 'battle') room.phase = 'paused';
    addLog(room, '🚪 一位學生離線；等待兩位勇者集合。');
    emit(room);
  }
  function attach(socket, room, name) {
    leave(socket);
    socket.join(room.code);
    socket.data.roomCode = room.code;
    socket.data.role = 'player';
    room.players.push(freshPlayer(socket.id, cleanName(name)));
    if (room.players.length === 2 && room.phase === 'paused') {
      room.phase = 'battle';
      room.nextEnemyAttack = Date.now() + 4500;
      addLog(room, '🤝 兩位勇者就位！冒險繼續。');
    }
    emit(room);
  }
  function attachTeacher(socket, room) {
    leave(socket);
    if (room.hostId && room.hostId !== socket.id) {
      const old = io.sockets.sockets.get(room.hostId);
      if (old) {
        old.leave(room.code);
        delete old.data.roomCode;
        delete old.data.role;
        old.emit('room:teacherReplaced');
      }
    }
    socket.join(room.code);
    socket.data.roomCode = room.code;
    socket.data.role = 'teacher';
    room.hostId = socket.id;
    emit(room);
  }
  function withRoom(socket, ack, fn, playerOnly = false) {
    const room = rooms.get(socket.data.roomCode);
    const player = room?.players.find(p => p.id === socket.id);
    const teacher = room?.hostMode === 'teacher' && room.hostId === socket.id && socket.data.role === 'teacher';
    if (!room || (!player && !teacher) || (playerOnly && !player)) {
      return ack?.({ ok: false, error: playerOnly ? '只有學生玩家能進行戰鬥' : '請先加入房間' });
    }
    fn(room, player);
  }
  io.on('connection', socket => {
    socket.on('room:create', (payload = {}, ack) => {
      if (rooms.size >= MAX_ROOMS) return ack?.({ ok: false, error: '目前房間已滿，請稍後再試' });
      leave(socket);
      const code = codeForRoom();
      const room = { code, hostId: socket.id, hostMode: 'player', hostName: cleanName(payload.name), teacherToken: null,
        route: 'local', phase: 'lobby', players: [],
        stage: 0, encounters: buildEncounters('local'), monster: null, nextEnemyAttack: 0,
        log: ['🚄 歡迎來到高鐵勇者冒險！'], touched: Date.now() };
      rooms.set(code, room);
      attach(socket, room, payload.name);
      ack?.({ ok: true, code, role: 'player' });
    });
    socket.on('room:createTeacher', (payload = {}, ack) => {
      if (rooms.size >= MAX_ROOMS) return ack?.({ ok: false, error: '目前房間已滿，請稍後再試' });
      leave(socket);
      const code = codeForRoom();
      const teacherToken = crypto.randomBytes(32).toString('hex');
      const teacherName = cleanName(payload.name || '老師');
      const room = { code, hostId: null, hostMode: 'teacher', hostName: teacherName, teacherToken,
        route: 'local', phase: 'lobby', players: [],
        stage: 0, encounters: buildEncounters('local'), monster: null, nextEnemyAttack: 0,
        log: [`👩‍🏫 ${teacherName} 建立教室，老師不占學生名額。`], touched: Date.now() };
      rooms.set(code, room);
      attachTeacher(socket, room);
      ack?.({ ok: true, code, role: 'teacher', teacherToken });
    });
    socket.on('room:joinTeacher', (payload = {}, ack) => {
      const room = rooms.get(cleanCode(payload.code));
      if (!room || room.hostMode !== 'teacher') return ack?.({ ok: false, error: '找不到老師房間' });
      const token = payload.teacherToken;
      if (typeof token !== 'string' || !/^[0-9a-f]{64}$/.test(token) ||
        !crypto.timingSafeEqual(Buffer.from(token), Buffer.from(room.teacherToken))) {
        return ack?.({ ok: false, error: '老師管理憑證不正確' });
      }
      attachTeacher(socket, room);
      ack?.({ ok: true, code: room.code, role: 'teacher' });
    });
    socket.on('room:join', (payload = {}, ack) => {
      const code = cleanCode(payload.code);
      const room = rooms.get(code);
      if (!room) return ack?.({ ok: false, error: '找不到房間，請檢查房間代碼' });
      if (room.players.length >= 2) return ack?.({ ok: false, error: '房間已經有兩位玩家' });
      if (room.phase === 'finished' || room.phase === 'failed') return ack?.({ ok: false, error: '這場冒險已結束，請建立新房間' });
      attach(socket, room, payload.name);
      addLog(room, `👋 ${cleanName(payload.name)} 加入隊伍！`);
      emit(room);
      ack?.({ ok: true, code, role: 'player' });
    });
    socket.on('room:setRoute', (payload = {}, ack) => withRoom(socket, ack, room => {
      if (room.hostId !== socket.id || room.phase !== 'lobby') return ack?.({ ok: false, error: '只有房主能在出發前選擇路線' });
      if (!['express', 'local'].includes(payload.route)) return ack?.({ ok: false, error: '無效路線' });
      room.route = payload.route;
      room.encounters = buildEncounters(room.route);
      addLog(room, `🗺️ 路線改為${room.route === 'express' ? '直達快車' : '站站停靠'}`);
      emit(room);
      ack?.({ ok: true });
    }));
    socket.on('game:start', (_, ack) => withRoom(socket, ack, room => {
      if (room.hostId !== socket.id || room.phase !== 'lobby') return ack?.({ ok: false, error: '只有房主能開始遊戲' });
      if (room.players.length !== 2) return ack?.({ ok: false, error: '需要兩位玩家才能出發' });
      room.stage = 0;
      room.monster = null;
      room.encounters = buildEncounters(room.route);
      room.phase = 'transition';
      room.log = [`🚅 ${room.route === 'express' ? '直達快車' : '站站停靠'}出發！兩位勇者合作擊退怪物。`];
      for (const p of room.players) Object.assign(p, freshPlayer(p.id, p.name));
      emit(room);
      spawn(room);
      ack?.({ ok: true });
    }));
    socket.on('battle:action', (payload = {}, ack) => withRoom(socket, ack, (room, player) => {
      if (room.phase !== 'battle' || !room.monster) return ack?.({ ok: false, error: '目前無法行動' });
      if (player.hp <= 0) return ack?.({ ok: false, error: '體力耗盡，等待隊友完成戰鬥' });
      if (Date.now() - player.lastAction < ACTION_INTERVAL) return ack?.({ ok: false, error: '動作冷卻中' });
      const kind = payload.kind;
      if (!['attack', 'skill', 'heal'].includes(kind)) return ack?.({ ok: false, error: '無效動作' });
      if (kind === 'skill' && player.energy < 3) return ack?.({ ok: false, error: '能量不足，需要 3 格能量' });
      if (kind === 'heal' && player.energy < 2) return ack?.({ ok: false, error: '能量不足，需要 2 格能量' });
      player.lastAction = Date.now();
      if (kind === 'heal') {
        player.energy -= 2;
        const target = room.players.reduce((lowest, p) => p.hp / p.maxHp < lowest.hp / lowest.maxHp ? p : lowest);
        const amount = Math.min(target.maxHp - target.hp, 24 + player.level * 7);
        target.hp += amount;
        addLog(room, `💚 ${player.name} 為 ${target.name} 恢復 ${amount} HP`);
      } else {
        const damage = kind === 'skill'
          ? 32 + player.level * 9 + crypto.randomInt(5, 15)
          : 11 + player.level * 5 + crypto.randomInt(0, 8);
        if (kind === 'skill') player.energy -= 3;
        else player.energy = Math.min(3, player.energy + 1);
        const actual = Math.min(room.monster.hp, damage);
        room.monster.hp -= actual;
        player.totalDamage += actual;
        addLog(room, `${kind === 'skill' ? '⚡' : '⚔️'} ${player.name} ${kind === 'skill' ? '發動必殺技' : '攻擊'}，造成 ${actual} 傷害`);
      }
      if (room.monster.hp <= 0) monsterDefeated(room);
      else emit(room);
      ack?.({ ok: true });
    }, true));
    socket.on('game:restart', (_, ack) => withRoom(socket, ack, room => {
      if (room.hostId !== socket.id || !['finished', 'failed'].includes(room.phase)) return ack?.({ ok: false, error: '只有房主可以重新開始' });
      room.phase = 'lobby';
      room.stage = 0;
      room.monster = null;
      room.log = ['🔁 新冒險準備中，請再次選擇路線。'];
      for (const p of room.players) Object.assign(p, freshPlayer(p.id, p.name));
      emit(room);
      ack?.({ ok: true });
    }));
    socket.on('room:leave', (_, ack) => { leave(socket); ack?.({ ok: true }); });
    socket.on('disconnect', () => leave(socket));
  });
  const combatTick = setInterval(() => {
    const now = Date.now();
    for (const [code, room] of rooms) {
      if (now - room.touched > ROOM_TTL) { rooms.delete(code); io.to(code).emit('game:expired'); continue; }
      if (room.phase !== 'battle' || !room.monster || now < room.nextEnemyAttack) continue;
      room.nextEnemyAttack = now + 3900;
      const alive = room.players.filter(p => p.hp > 0);
      if (!alive.length) { room.phase = 'failed'; room.monster = null; emit(room); continue; }
      const target = alive[crypto.randomInt(alive.length)];
      const damage = Math.min(target.hp, room.monster.damage + crypto.randomInt(0, 5));
      target.hp -= damage;
      addLog(room, `💥 ${room.monster.name} 攻擊 ${target.name}，扣除 ${damage} HP`);
      if (room.players.every(p => p.hp <= 0)) {
        room.phase = 'failed';
        addLog(room, '💔 挑戰失敗！請重新整備，再次出發。');
      }
      emit(room);
    }
  }, 800);
  server.on('close', () => clearInterval(combatTick));
  return { app, server, io };
}

if (require.main === module) {
  const { server } = makeServer();
  const port = Number(process.env.PORT) || 3000;
  server.listen(port, '0.0.0.0', () => console.log(`HSR adventure listening on ${port}`));
}
module.exports = { makeServer, rooms, buildEncounters, STATIONS };