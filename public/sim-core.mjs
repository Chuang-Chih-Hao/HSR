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
// 304-unit train and 334-unit platform must not overlap adjacent stations.
export const LEG_DISTANCE = 950; // gameplay render units, not real kilometers
export const PLATFORM_LENGTH = 334;
export const TRAIN_FRONT_Z = -152;
export const STOP_EARLY = 13;
export const STOP_LATE = 8;
export const PLATFORM_ENTRY_DISTANCE = PLATFORM_LENGTH/2 - TRAIN_FRONT_Z;
export function stationApproach(distance,speed,rain=false){
 const remaining=LEG_DISTANCE-distance;
 const braking=estimateBrakingDistance(speed,rain);
 const phase=remaining < -STOP_LATE?'overrun':remaining<=STOP_EARLY?'stop':remaining<=PLATFORM_ENTRY_DISTANCE?'platform':remaining<=Math.max(420,braking+65)?'approach':'cruise';
 return {remaining,braking,phase,brakeNow:remaining>=-STOP_LATE&&speed>3.2&&remaining<=braking+35,progress:Math.max(0,Math.min(1, distance/LEG_DISTANCE))};
}
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

/** Manual, frame-rate-independent power/brake dynamics; distances are compressed game units. */
export function stepManualDrive(state,seconds,{rain=false}={}) {
  const dt=Math.max(0,Math.min(.1,Number(seconds)||0));
  const speed=Math.max(0,Math.min(MAX_SPEED,Number(state.speed)||0));
  const distance=Math.max(0,Number(state.distance)||0);
  const power=Math.min(5,Math.max(0,Math.trunc(Number(state.power)||0)));
  const brake=Math.min(7,Math.max(0,Math.trunc(Number(state.brake)||0)));
  // Braking takes precedence. Wet rail reduces the available service deceleration.
  const traction=brake>0?0:power*(rain?2.25:2.9)*Math.max(.4,1-speed/490);
  const deceleration=brake*(rain?2.1:2.85);
  const resistance=speed>0?.35+speed*.002:0;
  const nextSpeed=Math.max(0,Math.min(MAX_SPEED,speed+(traction-deceleration-resistance)*dt));
  const moved=(speed+nextSpeed)/2*.11*dt;
  return {speed:nextSpeed,distance:distance+moved,moved};
}
export function estimateBrakingDistance(speed,rain=false) {
  const s=Math.max(0,Math.min(MAX_SPEED,Number(speed)||0));
  const b=rain?13:18; // approx B5, with conservative margin
  return s*s/(2*b)*.11;
}
export function canOperateDoors(speed,power) {
  return Math.abs(Number(speed)||0)<.1 && (Number(power)||0)===0;
}
export function withinStopZone(distance,speed) {
  return Number(distance)>=LEG_DISTANCE-STOP_EARLY && Number(distance)<=LEG_DISTANCE+STOP_LATE && Number(speed)<=3.2;
}

/** Optional game-only automatic train operation. Uses the same power/brake physics. */
export function automaticNotches(state,{rain=false}={}){
 const remaining=LEG_DISTANCE-state.distance,speed=Math.max(0,state.speed);
 const target=Math.min(260,Math.sqrt(Math.max(0,2*(rain?8:11)*(remaining-5)/.11)));
 if(remaining<=5)return {power:0,brake:7,target};
 if(speed>target+1)return {power:0,brake:Math.min(7,Math.max(2,Math.ceil((speed-target)*.65))),target};
 if(speed<target-1)return {power:Math.min(5,Math.max(1,Math.ceil((target-speed)*.45))),brake:0,target};
 return {power:speed<target?1:0,brake:0,target};
}
