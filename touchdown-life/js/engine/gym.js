// 헬스장: 훈련장에서 헬스장 회원권(또는 개인 웨이트룸·차고 홈짐)을 사면 들어갈 수 있습니다.
// 운동마다 연타·타이밍 미니게임을 하고, 결과(0~1.25)만큼 그 운동의 능력치가 조금씩 오릅니다.
// 게임 속 '하루'(시즌 진행 한 단계, 오프시즌·시즌 준비도 각각 하루)마다 체력이 정해져 있고 운동 하나는 하루 2세트까지라
// 한 번에 많이 올릴 수는 없습니다. 소수점 진행도가 1이 되면 능력치가 1 오릅니다.
import { clamp, ATTR, attrsOf, overall } from './core.js';
import { diffOf } from './difficulty.js';

// 단계: 1 동네 헬스장 · 2 퍼포먼스 센터 · 3 엘리트 트레이닝 랩
export const GYM_TIERS = [
  null,
  { name: '동네 헬스장', energy: 100, mult: 1 },
  { name: '퍼포먼스 센터', energy: 120, mult: 1.15 },
  { name: '엘리트 트레이닝 랩', energy: 140, mult: 1.3 },
];
export const MAX_SETS = 2;
// kind: mash 연타 · timing 타이밍 탭 · alt 좌우 번갈아 연타 · arrows 방향 QTE · charge 모았다 떼기 · targets 표적 탭
// attrs: 앞에서부터 내 포지션에 있는 능력치 하나를 올립니다
export const EXERCISES = [
  { id: 'bench', name: '벤치프레스', kind: 'mash', cost: 30, tier: 1, attrs: ['str', 'tkl', 'rdef', 'kpow', 'ath'], how: '연타! 바를 끝까지 밀어 올리면 1회' },
  { id: 'squat', name: '스쿼트', kind: 'timing', cost: 30, tier: 1, attrs: ['kpow', 'rblk', 'rdef', 'rush', 'str', 'ath', 'mob', 'tkl', 'spd'], how: '바늘이 초록(깊이)에 왔을 때 탭 · 금색이면 완벽' },
  { id: 'sprint', name: '40야드 스프린트', kind: 'alt', cost: 25, tier: 1, attrs: ['spd', 'mob', 'ath', 'stam'], how: '왼발·오른발을 번갈아 연타 (같은 발 두 번은 손해)' },
  { id: 'cone', name: '콘 드릴', kind: 'arrows', cost: 25, tier: 2, attrs: ['agi', 'mob', 'ath', 'cov', 'hand', 'route', 'spd'], how: '화살표가 가리키는 콘으로! 같은 방향 버튼을 빨리' },
  { id: 'box', name: '박스 점프', kind: 'charge', cost: 25, tier: 2, attrs: ['ath', 'spd', 'rush', 'agi', 'mob', 'stam'], how: '꾹 눌러 힘을 모았다가 초록에서 떼기 · 넘치면 실패' },
  { id: 'drill', name: '포지션 드릴', kind: 'targets', cost: 30, tier: 3, attrs: null, how: '나타나는 표적을 사라지기 전에 탭' },
];
// 포지션 드릴: 포지션의 기술 능력치와 이름
export const POS_DRILL = { QB: ['acc', '타깃 패스'], RB: ['carry', '볼 시큐리티'], WR: ['hands', '캐치 머신'], TE: ['hands', '캐치 머신'], OL: ['pblk', '패스 프로 미러'], DT: ['hand', '손기술 패드'], EDGE: ['rush', '러시 백'], LB: ['tkl', '태클 링'], CB: ['cov', '미러 드릴'], S: ['ball', '볼 호크 드릴'], K: ['kacc', '킥 타깃'], P: ['pnt', '펀트 타깃'] };

export function gymTier(s) {
  const f = s.shop?.facilities || {};
  return Math.max(f.club || 0, f.gym || 0, s.shop?.owned?.some(o => o.id === 'homegym') ? 1 : 0);
}
// 게임 속 하루: 시즌 중에는 진행 단계마다, 시즌 밖에서는 오프시즌·시즌 준비가 각각 하루
export function gymDayKey(s) {
  if (['season', 'card', 'bigGame'].includes(s.phase) && s.season) return `${s.year}-S${s.season.seg}`;
  return `${s.year}-${s.phase}`;
}
export function gymDayLabel(s) {
  const z = s.season;
  if (['season', 'card', 'bigGame'].includes(s.phase) && z) return z.seg < z.segments.length ? `${s.year} 시즌 · ${z.segLabels?.[z.seg] || `${z.seg + 1}구간`}` : `${s.year} 포스트시즌`;
  return s.phase === 'offseason' ? `${s.year} 오프시즌` : s.phase === 'ready' ? `${s.year} 시즌 준비` : String(s.year);
}
// 헬스장 상태 (새 하루면 체력·세트를 채웁니다)
export function gymState(s) {
  const g = (s.gym ||= { day: null, energy: 0, sets: {}, prog: {}, best: {}, total: 0, fat: 0, log: [] });
  const key = gymDayKey(s), tier = GYM_TIERS[gymTier(s)];
  if (g.day !== key) { g.day = key; g.energy = tier?.energy ?? 0; g.cap = tier?.energy ?? 0; g.sets = {}; g.today = 0; }
  // 같은 날 회원권을 올리면 늘어난 만큼 체력을 바로 채워 줍니다
  if (tier && tier.energy > (g.cap ?? 0)) { g.energy += tier.energy - (g.cap ?? 0); g.cap = tier.energy; }
  if (tier && g.energy > tier.energy) g.energy = tier.energy;
  return g;
}
export function exerciseAttr(s, ex) {
  const keys = attrsOf(s.player.pos);
  if (!ex.attrs) { const d = POS_DRILL[s.player.pos]; return d && keys.includes(d[0]) ? d[0] : s.player.focus[0]; }
  return ex.attrs.find(k => keys.includes(k)) || null;
}
export const exerciseName = (s, ex) => ex.id === 'drill' ? `포지션 드릴 · ${POS_DRILL[s.player.pos]?.[1] || '기술'}` : ex.name;
export function canExercise(s, ex) {
  const tier = gymTier(s), g = gymState(s);
  if (!tier) return { ok: false, why: '헬스장 회원권이 필요해요' };
  if (s.phase === 'retired') return { ok: false, why: '은퇴했어요' };
  if (ex.tier > tier) return { ok: false, why: `${GYM_TIERS[ex.tier].name}부터` };
  if (!exerciseAttr(s, ex)) return { ok: false, why: '이 포지션엔 해당 없음' };
  if (s.season?.injury?.out > 0) return { ok: false, why: '부상 중에는 쉬어요' };
  if ((g.sets[ex.id] || 0) >= MAX_SETS) return { ok: false, why: '오늘은 끝 (하루 2세트)' };
  if (g.energy < ex.cost) return { ok: false, why: '체력 부족 · 다음 날에' };
  return { ok: true };
}
// 운동 결과 반영. perf: 0~1.25 (미니게임 점수)
export function finishExercise(s, exId, perf, detail = '') {
  const ex = EXERCISES.find(e => e.id === exId), can = canExercise(s, ex);
  if (!can.ok) throw Error(can.why);
  const p = s.player, g = gymState(s), tier = GYM_TIERS[gymTier(s)], k = exerciseAttr(s, ex);
  perf = clamp(perf, 0, 1.25);
  g.energy -= ex.cost; g.sets[ex.id] = (g.sets[ex.id] || 0) + 1;
  const ageF = p.age <= 21 ? 1.1 : p.age <= 25 ? 1 : p.age <= 29 ? .8 : .6;
  const room = clamp((99 - p.attrs[k]) / 40, .15, 1);
  const talent = Math.sqrt(Math.exp(.034 * (p.potential - 80)));
  const gain = Math.round(.24 * perf * tier.mult * ageF * room * talent * diffOf(s).gym * 100) / 100;
  g.prog[k] = (g.prog[k] || 0) + gain;
  let ups = 0;
  while (g.prog[k] >= 1 && p.attrs[k] < 99) { g.prog[k] -= 1; p.attrs[k] += 1; ups++; }
  if (p.attrs[k] >= 99) g.prog[k] = 0;
  const before = p.ovr;
  if (ups) { p.ovr = overall(p.pos, p.attrs); p.peak = Math.max(p.peak, p.ovr); }
  // 무리하면 누적 피로가 조금씩 쌓입니다
  g.fat = (g.fat || 0) + ex.cost / 320; let tired = false;
  if (g.fat >= 1) { g.fat -= 1; s.meters.body = clamp(s.meters.body + 1, 0, 10); tired = true; }
  g.best[ex.id] = Math.max(g.best[ex.id] || 0, perf);
  g.total = Math.round(((g.total || 0) + gain) * 100) / 100; g.today = Math.round(((g.today || 0) + gain) * 100) / 100;
  g.log = [{ day: g.day, ex: ex.id, attr: k, gain, perf: Math.round(perf * 100) / 100, detail }, ...(g.log || [])].slice(0, 30);
  return { attr: k, attrName: ATTR[k][0], gain, ups, value: p.attrs[k], prog: g.prog[k], ovrUp: p.ovr - before, ovr: p.ovr, energy: g.energy, tired };
}
export const gradeOf = perf => perf >= 1.05 ? 'PERFECT' : perf >= .85 ? 'GREAT' : perf >= .6 ? 'GOOD' : perf >= .3 ? 'OK' : 'MISS';
