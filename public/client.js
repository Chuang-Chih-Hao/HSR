'use strict';

const $ = id => document.getElementById(id);
const socket = io({ reconnectionAttempts: 12, timeout: 12000 });
let state = null;
let lastMonsterHp = null;
let toastTimer = null;

const rememberedName = sessionStorage.getItem('hsr-name') || '';
$('playerName').value = rememberedName;
const queryRoom = new URLSearchParams(location.search).get('room');
if (queryRoom) $('roomCodeInput').value = queryRoom.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);

function show(id, visible) { $(id).classList.toggle('hidden', !visible); }
function toast(message, error = false) {
  const wrap = $('toastWrap');
  const item = document.createElement('div');
  item.className = `toast${error ? ' error' : ''}`;
  item.textContent = message;
  wrap.replaceChildren(item);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => wrap.replaceChildren(), 3100);
}
function getName() { return $('playerName').value.trim().slice(0, 14) || '小小勇者'; }
function remember(code, role = 'player', token = '') {
  sessionStorage.setItem('hsr-name', getName());
  sessionStorage.setItem('hsr-room', code);
  sessionStorage.setItem('hsr-role', role);
  if (role === 'teacher' && token) sessionStorage.setItem('hsr-teacher-token', token);
  else sessionStorage.removeItem('hsr-teacher-token');
}
function disconnectLocal() {
  state = null;
  sessionStorage.removeItem('hsr-room');
  sessionStorage.removeItem('hsr-role');
  sessionStorage.removeItem('hsr-teacher-token');
  show('entryView', true); show('roomView', false); show('gameView', false);
  show('intro', true); show('endOverlay', false);
}
function request(event, data, onSuccess) {
  if (!socket.connected) return toast('尚未連線到伺服器，請稍後再試', true);
  socket.timeout(10000).emit(event, data, (err, result) => {
    if (err) return toast('伺服器未回應，請稍後重試', true);
    if (!result?.ok) return toast(result?.error || '操作失敗', true);
    if (onSuccess) onSuccess(result);
  });
}
function createRoom() {
  request('room:create', { name: getName() }, r => {
    remember(r.code, 'player');
    toast('玩家房間建立成功！邀請第二位勇者加入');
  });
}
function createTeacherRoom() {
  const name = $('playerName').value.trim().slice(0, 14) || '老師';
  request('room:createTeacher', { name }, r => {
    remember(r.code, 'teacher', r.teacherToken);
    toast('老師房間已建立！分享代碼給兩位學生');
  });
}
function joinRoom() {
  const code = $('roomCodeInput').value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (code.length !== 6) return toast('請輸入六位房間代碼', true);
  request('room:join', { code, name: getName() }, r => { remember(r.code); toast('成功加入隊伍！'); });
}
function currentPlayer() { return state?.players.find(p => p.id === socket.id); }
function isHost() { return state?.hostId === socket.id; }
function isTeacher() { return state?.hostMode === 'teacher' && isHost(); }
function appendText(parent, tag, value, className) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  el.textContent = value;
  parent.append(el);
  return el;
}
function percent(a, b) { return Math.max(0, Math.min(100, Math.round((a / (b || 1)) * 100))); }
function renderLobby() {
  $('roomCode').textContent = state.code;
  $('roomCount').textContent = `${state.players.length} / 2`;
  const teacherRoom = state.hostMode === 'teacher';
  show('teacherHostPanel', teacherRoom);
  if (teacherRoom) {
    $('teacherHostName').textContent = `${state.hostName || '老師'}${isTeacher() ? '（你）' : ''}`;
    $('teacherHostStatus').textContent = state.hostConnected ? '🟢 老師已連線 · 不占學生名額' : '🟠 老師暫時離線';
  }
  const area = $('lobbyPlayers'); area.replaceChildren();
  for (const p of state.players) {
    const div = appendText(area, 'div', '', 'lobby-player');
    appendText(div, 'span', '🧑‍🚀', 'lobby-avatar');
    const info = appendText(div, 'div', '');
    appendText(info, 'strong', p.name + (p.id === socket.id ? '（你）' : ''));
    appendText(info, 'small', p.id === state.hostId ? '👑 玩家房主' : '🎒 學生勇者');
  }
  for (let i = state.players.length; i < 2; i++) {
    const div = appendText(area, 'div', '', 'lobby-player waiting');
    appendText(div, 'span', '❔', 'lobby-avatar');
    const info = appendText(div, 'div', '');
    appendText(info, 'strong', '等待勇者加入'); appendText(info, 'small', '分享代碼邀請朋友');
  }
  document.querySelectorAll('.route-choice').forEach(btn => {
    const selected = btn.dataset.route === state.route;
    btn.classList.toggle('selected', selected);
    btn.disabled = !isHost();
    btn.querySelector('.choose-indicator').textContent = selected ? '已選擇' : isHost() ? '選擇此路線' : '房主選擇路線';
  });
  $('hostHint').textContent = isHost() ? teacherRoom ? '👩‍🏫 老師可選擇路線' : '👑 你是房主' : teacherRoom ? '由老師決定' : '由房主決定';
  $('startBtn').disabled = !isHost() || state.players.length !== 2;
  $('startBtn').textContent = isHost() ? state.players.length === 2 ? '🚄 開始冒險！' : '等待兩位學生加入' : teacherRoom ? '等待老師開始' : '等待房主開始';
  $('roomMessage').textContent = state.players.length === 2 ? '✅ 兩位勇者已集合，可以出發！' : `⏳ 已有 ${state.players.length} / 2 位學生，等待加入...`;
}
function renderRoute() {
  $('trainModeLabel').textContent = state.route === 'express' ? '⚡ 直達快車' : '🚉 站站停靠';
  const count = state.totalStages;
  $('missionStage').textContent = `第 ${Math.min(count, state.stage + 1)} / ${count} 關`;
  $('journeyFill').style.width = `${percent(state.stage, count)}%`;
  $('missionTitle').textContent = state.phase === 'finished' ? '抵達南港，任務完成！' : `下一站：${state.station}`;
  const track = $('stationTrack'); track.replaceChildren();
  const stationIndex = state.route === 'express'
    ? Math.round(state.stage / count * 11)
    : Math.min(11, state.stage + 1);
  state.stationNames.forEach((name, i) => {
    const node = appendText(track, 'div', '', `station${i < stationIndex ? ' passed' : ''}${i === stationIndex ? ' active' : ''}`);
    appendText(node, 'div', '', 'station-dot');
    appendText(node, 'div', name, 'station-label');
  });
}
function renderMonster() {
  const mon = state.monster;
  $('battleTag').textContent = state.phase === 'paused' ? '⏸ 等待隊友重連' :
    state.phase === 'transition' ? '✨ 擊敗怪物！前往下一關' : mon?.boss ? '🔥 終點 BOSS 戰' : '⚔️ 野外遭遇戰';
  $('currentStation').textContent = `📍 ${state.station}`;
  $('monsterName').textContent = mon?.name || '勇者列車前進中';
  $('monsterEmoji').textContent = mon?.emoji || '🚄';
  $('monsterEmoji').setAttribute('aria-label', mon?.name || '列車');
  $('monsterHpText').textContent = mon ? `${mon.hp} / ${mon.maxHp}` : '—';
  $('monsterHpFill').style.width = mon ? `${percent(mon.hp, mon.maxHp)}%` : '0%';
  if (mon && lastMonsterHp !== null && mon.hp < lastMonsterHp && state.phase === 'battle') {
    const emoji = $('monsterEmoji'); emoji.classList.remove('hit'); void emoji.offsetWidth; emoji.classList.add('hit');
  }
  lastMonsterHp = mon?.hp ?? null;
}
function renderParty() {
  const root = $('battlePlayers'); root.replaceChildren();
  state.players.forEach((p, i) => {
    const mem = appendText(root, 'div', '', 'party-member');
    const title = appendText(mem, 'div', '', 'party-title');
    appendText(title, 'strong', `${i === 0 ? '🚀' : '🛡️'} ${p.name}${p.id === socket.id ? '（你）' : ''}`);
    appendText(title, 'small', `Lv.${p.level}`);
    const meters = appendText(mem, 'div', '', 'party-meters');
    for (const [icon, amount, cap, type] of [['❤️', p.hp, p.maxHp, 'life'], ['✨', p.xp, p.xpNeeded, 'xp']]) {
      const line = appendText(meters, 'div', '', 'party-line');
      appendText(line, 'span', icon);
      const bar = appendText(line, 'div', '', 'bar');
      const fill = appendText(bar, 'div', '', `bar-fill ${type}`); fill.style.width = `${percent(amount, cap)}%`;
      appendText(line, 'span', `${amount}/${cap}`);
    }
    const extra = appendText(mem, 'div', '', 'party-extra');
    appendText(extra, 'span', `🪙 ${p.coins} 金幣`);
    appendText(extra, 'span', `⚔️ ${p.totalDamage} 傷害`);
  });
  const me = currentPlayer();
  const teacherViewing = isTeacher();
  show('teacherWatchingNotice', teacherViewing);
  show('actionControls', !teacherViewing);
  show('energyBar', !teacherViewing);
  if (teacherViewing) $('teacherWatchingNotice').textContent = `👩‍🏫 老師觀戰中：${state.players.length} / 2 位勇者，可查看血量、等級與戰鬥紀錄。`;
  const energy = me?.energy || 0;
  document.querySelectorAll('#energyDots span').forEach((dot, i) => dot.classList.toggle('full', i < energy));
  $('energyText').textContent = `${energy} / 3`;
  const canAct = state.phase === 'battle' && (me?.hp || 0) > 0;
  $('attackBtn').disabled = !canAct;
  $('skillBtn').disabled = !canAct || energy < 3;
  $('healBtn').disabled = !canAct || energy < 2;
}
function renderLog() {
  const root = $('battleLog'); root.replaceChildren();
  state.log.slice().reverse().forEach(line => appendText(root, 'div', line, 'log-entry'));
}
function renderEnd() {
  const won = state.phase === 'finished';
  show('endOverlay', won || state.phase === 'failed');
  if (!won && state.phase !== 'failed') return;
  $('endEmoji').textContent = won ? '🏆' : '💔';
  $('endTitle').textContent = won ? '順利抵達南港！' : '隊伍全滅！';
  $('endMessage').textContent = won ? '兩位勇者合作打敗終點魔王，完成高鐵冒險！' : '別灰心，重新集結再試一次！';
  $('endStats').replaceChildren();
  state.players.forEach(p => {
    const item = appendText($('endStats'), 'div', '', 'end-stat');
    appendText(item, 'strong', `Lv.${p.level}`);
    appendText(item, 'small', `${p.name} · ${p.totalDamage} 傷害`);
  });
  $('restartBtn').disabled = !isHost();
  $('restartBtn').textContent = isHost() ? '🔁 再次出發' : state.hostMode === 'teacher' ? '等待老師重新開始' : '等待房主重新開始';
  $('restartHint').textContent = isHost() ? '重新回到準備室，可改選路線' : state.hostMode === 'teacher' ? '只有老師可以重新開始遊戲' : '只有房主可以重新開始遊戲';
}
function render() {
  if (!state) return;
  const lobby = state.phase === 'lobby';
  show('entryView', false); show('roomView', lobby); show('gameView', !lobby); show('intro', false);
  if (lobby) { show('endOverlay', false); renderLobby(); }
  else { renderRoute(); renderMonster(); renderParty(); renderLog(); renderEnd(); }
}
function copyText(text) {
  if (!navigator.clipboard?.writeText) { toast('瀏覽器不支援自動複製，請手動選取代碼', true); return; }
  navigator.clipboard.writeText(text).then(() => toast('已複製到剪貼簿！')).catch(() => toast('複製失敗，請手動複製代碼', true));
}

$('createBtn').addEventListener('click', createRoom);
$('createTeacherBtn').addEventListener('click', createTeacherRoom);
$('joinBtn').addEventListener('click', joinRoom);
$('roomCodeInput').addEventListener('keydown', e => { if (e.key === 'Enter') joinRoom(); });
$('copyCodeBtn').addEventListener('click', () => state && copyText(state.code));
$('copyLinkBtn').addEventListener('click', () => state && copyText(`${location.origin}/?room=${state.code}`));
$('leaveBtn').addEventListener('click', () => request('room:leave', {}, () => { disconnectLocal(); toast('已離開房間'); }));
$('startBtn').addEventListener('click', () => request('game:start', {}));
$('restartBtn').addEventListener('click', () => request('game:restart', {}));
document.querySelectorAll('.route-choice').forEach(button => button.addEventListener('click', () => request('room:setRoute', { route: button.dataset.route })));
function battleAction(kind) { request('battle:action', { kind }); }
$('attackBtn').addEventListener('click', () => battleAction('attack'));
$('skillBtn').addEventListener('click', () => battleAction('skill'));
$('healBtn').addEventListener('click', () => battleAction('heal'));
document.addEventListener('keydown', e => {
  if (e.repeat || ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
  const keyMap = { a: 'attack', s: 'skill', d: 'heal' };
  const kind = keyMap[e.key.toLowerCase()];
  if (kind && state?.phase === 'battle') {
    const button = $(kind === 'attack' ? 'attackBtn' : kind === 'skill' ? 'skillBtn' : 'healBtn');
    if (!button.disabled) battleAction(kind);
  }
});
socket.on('connect', () => {
  $('onlineStatus').classList.remove('offline'); $('onlineStatus').lastChild.textContent = '已連線';
  const code = sessionStorage.getItem('hsr-room');
  if (code) {
    const teacher = sessionStorage.getItem('hsr-role') === 'teacher';
    const event = teacher ? 'room:joinTeacher' : 'room:join';
    const payload = teacher
      ? { code, teacherToken: sessionStorage.getItem('hsr-teacher-token') }
      : { code, name: sessionStorage.getItem('hsr-name') || getName() };
    request(event, payload, () => toast(teacher ? '老師已重新連上教室' : '已重新連上冒險房間'));
  }
});
socket.on('disconnect', () => { $('onlineStatus').classList.add('offline'); $('onlineStatus').lastChild.textContent = '連線中斷'; });
socket.on('game:state', newState => { state = newState; render(); });
socket.on('game:expired', () => { disconnectLocal(); toast('房間已逾時，請重新建立', true); });
socket.on('room:teacherReplaced', () => { disconnectLocal(); toast('老師管理頁面已在其他裝置重新連線', true); });
