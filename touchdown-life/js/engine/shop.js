// 훈련장 · 상점: 시즌마다 상품 3개 입고(한 시즌에 하나만 구매), 스태프 계약, 개인 시설.
import { clamp, pick, ATTR, attrsOf, overall, usd } from './core.js';

// 상품: 값이 비쌀수록 많이 오릅니다. attr: 'main'(집중 육성 1순위) / 능력치 키 / null. body: 누적 피로 감소.
export const ITEMS = [
  { id: 'cleats', name: '맞춤 스파이크', price: 250, attr: 'spd', up: 1, note: '발에 꼭 맞는 첫 맞춤 스파이크' },
  { id: 'gloves', name: '리시버 장갑 세트', price: 400, attr: 'hands', up: 1, note: '끈적한 그립' },
  { id: 'lesson', name: '개인 레슨 10회', price: 1200, attr: 'main', up: 1, note: '은퇴한 대학 선수의 원포인트 레슨' },
  { id: 'homegym', name: '차고 홈짐 세트', price: 3000, attr: 'str', up: 1, note: '스쿼트 랙과 원판' },
  { id: 'mattress', name: '프리미엄 매트리스', price: 6000, attr: null, body: 2, note: '잘 자는 것도 훈련' },
  { id: 'vrfilm', name: 'VR 필름 분석 장비', price: 18000, attr: 'vis', up: 2, note: '쿼터백의 시야로 보는 연습' },
  { id: 'cryo', name: '크라이오 챔버', price: 45000, attr: null, body: 3, note: '영하 110도의 회복' },
  { id: 'chef', name: '개인 셰프 1년', price: 180000, attr: 'str', up: 2, body: 1, note: '하루 5끼 맞춤 식단' },
  { id: 'supercar', name: '슈퍼카', price: 350000, attr: 'spd', up: 1, followers: 1.08, note: '주차장에서 찍힌 사진이 화제' },
  { id: 'lab', name: '개인 바이오메카닉 랩', price: 900000, attr: 'main', up: 3, note: '동작 하나하나를 데이터로' },
  { id: 'mansion', name: '교외 저택', price: 6e6, attr: 'poise', up: 2, body: 2, note: '마음의 평화' },
  { id: 'center', name: '전용 훈련 센터', price: 15e6, attr: 'main', up: 4, note: '나만을 위한 실내 필드' },
  { id: 'island', name: '오프시즌 섬 별장', price: 32e6, attr: null, body: 5, followers: 1.1, note: '완벽한 휴식' },
  { id: 'jet', name: '전용기', price: 65e6, attr: 'agi', up: 4, body: 3, note: '원정 피로가 사라진다' },
];
// 스태프: 시즌마다 비용이 빠져나갑니다 (해고 가능).
export const STAFF = [
  { id: 'trainer', name: '개인 트레이너', fee: 40000, desc: '부상 확률 ×0.75' },
  { id: 'coach', name: '포지션 코치', fee: 70000, desc: '집중 육성 능력치 성장 +20%' },
  { id: 'agent', name: '에이전트', fee: 0, desc: '계약 제안 +8% (계약금의 3% 수수료)' },
  { id: 'nutrition', name: '영양사', fee: 30000, desc: '노쇠 하락 −25%' },
  { id: 'mental', name: '멘탈 코치', fee: 50000, desc: '경기력 소폭 상승, 감독 신뢰 유지' },
  { id: 'pr', name: '홍보 매니저', fee: 40000, desc: '팔로워 증가 +25%' },
];
export const FACILITIES = [
  { id: 'gym', name: '개인 웨이트룸', prices: [20000, 150000, 1e6], desc: '모든 성장 +5% / 단계' },
  { id: 'recovery', name: '회복실', prices: [15000, 120000, 800000], desc: '부상 확률 −10% / 단계' },
];
export function refreshStock(s, r) {
  const m = s.money;
  const cheap = ITEMS.filter(i => i.price <= Math.max(400, m * .6));
  const mid = ITEMS.filter(i => i.price > m * .6 && i.price <= Math.max(1500, m * 2.5));
  const dream = ITEMS.filter(i => i.price > Math.max(1500, m * 2.5));
  const out = [];
  for (const pool of [cheap, mid, dream, ITEMS]) { const c = pool.filter(i => !out.includes(i.id)); if (c.length && out.length < 3) out.push(pick(r, c).id); }
  s.shop.stock = out;
}
export const canBuy = (s, item) => s.phase !== 'retired' && s.shop.boughtYear !== s.year && s.money >= item.price && s.shop.stock.includes(item.id);
export function buyItem(s, id) {
  const it = ITEMS.find(i => i.id === id);
  if (!it) throw Error('없는 상품');
  if (s.shop.boughtYear === s.year) throw Error('이번 시즌에는 이미 하나를 샀습니다.');
  if (s.money < it.price) throw Error('보유 자금이 모자랍니다.');
  s.money -= it.price; s.shop.boughtYear = s.year; s.shop.owned.push({ id, year: s.year });
  const p = s.player, lines = [];
  if (it.attr) {
    const keys = attrsOf(p.pos), key = it.attr === 'main' ? p.focus[0] : keys.includes(it.attr) ? it.attr : p.focus[0];
    p.attrs[key] = clamp(p.attrs[key] + it.up, 15, 99); p.ovr = overall(p.pos, p.attrs); p.peak = Math.max(p.peak, p.ovr);
    lines.push(`${ATTR[key][0]} +${it.up}`);
  }
  if (it.body) { s.meters.body = clamp(s.meters.body - it.body, 0, 10); lines.push(`누적 피로 −${it.body}`); }
  if (it.followers) { s.followers = Math.round(s.followers * it.followers); lines.push('팔로워 증가'); }
  return lines;
}
export function hireStaff(s, id, on = true) {
  const st = STAFF.find(x => x.id === id);
  if (!st) throw Error('없는 스태프');
  if (on && s.money < st.fee) throw Error('보유 자금이 모자랍니다.');
  if (on) s.shop.staff[id] = { since: s.year }; else delete s.shop.staff[id];
}
export function buyFacility(s, id) {
  const f = FACILITIES.find(x => x.id === id), lvl = s.shop.facilities[id] || 0;
  if (!f || lvl >= f.prices.length) throw Error('더 올릴 수 없습니다.');
  if (s.money < f.prices[lvl]) throw Error('보유 자금이 모자랍니다.');
  s.money -= f.prices[lvl]; s.shop.facilities[id] = lvl + 1;
}
export const staffFees = s => Object.keys(s.shop?.staff || {}).reduce((n, id) => n + (STAFF.find(x => x.id === id)?.fee || 0), 0) + (s.shop?.staff?.agent && s.contract ? Math.round((s.contract.aav || 0) * .03) : 0);
export const growthBonus = s => ({ mult: 1 + .05 * (s.shop?.facilities?.gym || 0), focus: s.shop?.staff?.coach ? 1.2 : 1 });
export const declineFactor = s => s.shop?.staff?.nutrition ? .75 : 1;
export const agentBoost = s => s.shop?.staff?.agent ? 1.08 : 1;
export { usd };
