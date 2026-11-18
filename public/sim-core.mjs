/** Shared, dependency-free simulation configuration. Distances/time are gameplay-compressed. */
export const SOUTH_TO_NORTH = Object.freeze([
  { zh: '左營', en: 'Zuoying' },
  { zh: '台南', en: 'Tainan' },
  { zh: '嘉義', en: 'Chiayi' },
  { zh: '雲林', en: 'Yunlin' },
  { zh: '彰化', en: 'Changhua' },
  { zh: '台中', en: 'Taichung' },
  { zh: '苗栗', en: 'Miaoli' },
  { zh: '新竹', en: 'Hsinchu' },
  { zh: '桃園', en: 'Taoyuan' },
  { zh: '板橋', en: 'Banqiao' },
  { zh: '台北', en: 'Taipei' },
  { zh: '南港', en: 'Nangang' }
]);
export const DIRECTION = Object.freeze({ north: '北上', south: '南下' });
export const ROUTE = Object.freeze({ local: '站站停靠', express: '直達快車' });
export const LEG_DISTANCE = 265; // render units, deliberately not real kilometers
export const MAX_SPEED = 300;

export function createItinerary(direction = 'north', route = 'local') {
  if (!Object.hasOwn(DIRECTION, direction)) throw new Error('無效行駛方向');
  if (!Object.hasOwn(ROUTE, route)) throw new Error('無效停靠模式');
  const stations = direction === 'north' ? [...SOUTH_TO_NORTH] : [...SOUTH_TO_NORTH].reverse();
  // Express is a game design, NOT an actual Taiwan HSR timetable.
  const stops = route === 'local'
    ? stations.map((station, index) => ({ ...station, index }))
    : stations.filter((_, index) => [0, 1, 2, 5, 11].includes(index)).map(station => ({ ...station, index: stations.indexOf(station) }));
  return { stations, stops, direction, route };
}
export function clampSpeed(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(MAX_SPEED, Math.max(0, Math.round(number))) : 0;
}
export function approachingSpeed(distance, selectedSpeed) {
  const remaining = Math.max(0, Number(distance) || 0);
  const requested = clampSpeed(selectedSpeed);
  if (remaining >= 95) return requested;
  if (remaining === 0) return 0;
  return Math.min(requested, Math.max(12, 23 * Math.sqrt(remaining)));
}
export function speakableAnnouncement(station, direction, phase) {
  if (!station || !Object.hasOwn(DIRECTION, direction)) throw new Error('無效車站或方向');
  const directionName = DIRECTION[direction];
  if (phase === 'approach') return `各位旅客您好，列車即將抵達${station.zh}站。請準備下車。`;
  if (phase === 'arrive') return `${station.zh}站到了。請留意月台與列車間隙，祝您旅途愉快。`;
  if (phase === 'depart') return `歡迎搭乘本次${directionName}高鐵模擬列車。車門即將關閉，請注意安全。`;
  throw new Error('無效廣播類型');
}