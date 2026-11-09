// 공통 도구: 시드 난수, 포지션·능력치 정의, OVR 계산, 표시용 포맷.
export const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
export const round1 = n => Math.round(n * 10) / 10;
export const sum = a => a.reduce((n, x) => n + x, 0);
export const clone = v => JSON.parse(JSON.stringify(v));

// FNV-1a + murmur3 finalizer: 같은 키는 언제나 같은 값.
export function hash(text) {
  let h = 2166136261;
  for (const c of String(text)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
  return h >>> 0;
}
export const hash01 = text => hash(text) / 4294967296;

// 커리어 상태(s.rng)에 저장되는 mulberry32. 저장·불러오기 후에도 같은 흐름을 이어 갑니다.
export function rng(s) {
  return () => {
    let t = (s.rng = (s.rng + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const pick = (r, list) => list[Math.floor(r() * list.length) % list.length];
export const gauss = r => { let u = 0, v = 0; while (!u) u = r(); while (!v) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
export function weighted(r, entries) {
  const total = sum(entries.map(e => Math.max(0, e[1])));
  let d = r() * total;
  for (const e of entries) { d -= Math.max(0, e[1]); if (d < 0) return e[0]; }
  return entries.at(-1)?.[0];
}

// ───────── 포지션과 능력치 ─────────
export const ATTR = {
  arm: ['어깨', '패스 비거리와 구속'], acc: ['정확도', '원하는 곳에 공을 넣는 능력'], vis: ['판단', '수비·공격을 읽는 눈과 시야'],
  poise: ['침착함', '압박 속에서도 흔들리지 않는 멘털'], mob: ['기동력', '포켓을 벗어나 달리는 능력'], str: ['피지컬', '힘과 몸싸움'],
  spd: ['스피드', '직선 주력'], agi: ['민첩성', '방향 전환과 첫발'], carry: ['볼캐리', '공을 지키며 달리는 기술'],
  hands: ['캐치', '공을 확실히 잡는 손'], route: ['루트', '루트 러닝과 수비 떼어 내기'], rblk: ['런블록', '러닝 플레이 블로킹'],
  pblk: ['패스블록', '패스 보호'], stam: ['지구력', '한 경기 내내 버티는 체력'], rush: ['패스러시', 'QB를 향한 돌파'],
  rdef: ['런저지', '러닝 플레이를 막는 힘'], hand: ['손기술', '블로커를 떼어 내는 손 기술'], tkl: ['태클', '정확하게 넘어뜨리는 능력'],
  cov: ['커버리지', '리시버를 따라붙는 능력'], ball: ['볼호크', '공을 낚아채는 감각'], kpow: ['킥력', '킥 비거리'],
  kacc: ['킥 정확도', '골대 사이로 넣는 정확도'], pnt: ['펀트', '펀트 기술과 체공 시간'], cons: ['일관성', '매 경기 같은 킥을 하는 능력'],
  ath: ['운동능력', '페이크 플레이·커버 태클'],
};
// 포지션마다 화면에 보이는 6개 능력치와 OVR 가중치(합 1).
export const POSITIONS = {
  QB: { ko: '쿼터백', side: 'O', w: { arm: .2, acc: .26, vis: .22, poise: .14, mob: .1, str: .08 }, peak: 32 },
  RB: { ko: '러닝백', side: 'O', w: { spd: .22, agi: .2, carry: .2, vis: .16, str: .12, hands: .1 }, peak: 26 },
  WR: { ko: '와이드 리시버', side: 'O', w: { spd: .22, route: .24, hands: .24, agi: .14, vis: .08, str: .08 }, peak: 28 },
  TE: { ko: '타이트 엔드', side: 'O', w: { hands: .22, route: .16, rblk: .22, str: .16, spd: .12, vis: .12 }, peak: 29 },
  OL: { ko: '오펜시브 라인맨', side: 'O', w: { pblk: .26, rblk: .24, str: .2, agi: .12, vis: .1, stam: .08 }, peak: 30 },
  DT: { ko: '디펜시브 태클', side: 'D', w: { str: .24, rdef: .22, rush: .22, hand: .14, spd: .08, vis: .1 }, peak: 29 },
  EDGE: { ko: '엣지 러셔', side: 'D', w: { rush: .28, spd: .2, str: .14, rdef: .14, agi: .14, vis: .1 }, peak: 28 },
  LB: { ko: '라인배커', side: 'D', w: { tkl: .24, vis: .22, cov: .14, spd: .16, str: .12, rush: .12 }, peak: 28 },
  CB: { ko: '코너백', side: 'D', w: { cov: .28, spd: .22, agi: .18, ball: .12, vis: .12, tkl: .08 }, peak: 28 },
  S: { ko: '세이프티', side: 'D', w: { cov: .2, vis: .2, tkl: .18, spd: .18, ball: .14, str: .1 }, peak: 29 },
  K: { ko: '키커', side: 'ST', w: { kacc: .36, kpow: .3, poise: .16, cons: .12, pnt: .03, ath: .03 }, peak: 34 },
  P: { ko: '펀터', side: 'ST', w: { pnt: .38, kpow: .3, cons: .14, poise: .1, kacc: .05, ath: .03 }, peak: 34 },
};
export const POS_ORDER = ['QB', 'RB', 'WR', 'TE', 'OL', 'DT', 'EDGE', 'LB', 'CB', 'S', 'K', 'P'];
export const attrsOf = pos => Object.keys(POSITIONS[pos].w);
export const PHYSICAL = new Set(['spd', 'agi', 'str', 'mob', 'stam', 'kpow', 'ath', 'arm']);
// 포지션 전환 시 없는 능력치를 채우는 근거.
const RELATED = {
  arm: ['str', 'kpow'], acc: ['vis', 'hands'], vis: ['acc', 'route', 'cov'], poise: ['vis', 'cons'], mob: ['spd', 'agi'], str: ['rblk', 'tkl', 'rdef'],
  spd: ['agi', 'mob'], agi: ['spd', 'mob'], carry: ['hands', 'str'], hands: ['ball', 'carry'], route: ['agi', 'cov'], rblk: ['str', 'pblk'],
  pblk: ['rblk', 'str'], stam: ['str'], rush: ['hand', 'spd', 'str'], rdef: ['str', 'tkl'], hand: ['rush', 'str'], tkl: ['str', 'rdef'],
  cov: ['route', 'agi'], ball: ['hands', 'vis'], kpow: ['pnt'], kacc: ['cons'], pnt: ['kpow'], cons: ['kacc'], ath: ['spd', 'agi'],
};
export function overall(pos, attrs) {
  const w = POSITIONS[pos].w;
  return clamp(Math.round(Object.entries(w).reduce((n, [k, x]) => n + x * (attrs[k] ?? 30), 0)), 1, 99);
}
export function convertAttrs(fromAttrs, toPos) {
  const out = {};
  for (const k of attrsOf(toPos)) {
    if (fromAttrs[k] !== undefined) { out[k] = fromAttrs[k]; continue; }
    const rel = (RELATED[k] || []).map(x => fromAttrs[x]).filter(v => v !== undefined);
    out[k] = clamp(Math.round((rel.length ? sum(rel) / rel.length : 35) - 6), 15, 99);
  }
  return out;
}
// 같은 능력치로 다른 포지션을 봤을 때의 OVR (포지션 전환 제안용).
export const ovrAs = (attrs, pos) => overall(pos, convertAttrs(attrs, pos));

// 시작 후보 아키타입 (포지션마다 3개 이상). focus: 이 스타일이 강한 능력치.
export const ARCHETYPES = {
  QB: [['pocket', '포켓 패서', ['arm', 'acc', 'poise']], ['dual', '듀얼 스레트', ['mob', 'arm', 'spd']], ['general', '필드 제너럴', ['vis', 'acc', 'poise']]],
  RB: [['power', '파워 백', ['str', 'carry', 'vis']], ['speed', '스피드 백', ['spd', 'agi', 'carry']], ['allround', '스리다운 백', ['hands', 'vis', 'agi']]],
  WR: [['deep', '딥 스레트', ['spd', 'hands', 'route']], ['slot', '슬롯 리시버', ['agi', 'route', 'hands']], ['x', 'X 리시버', ['str', 'hands', 'route']]],
  TE: [['block', '블로킹 TE', ['rblk', 'str', 'vis']], ['move', '무브 TE', ['hands', 'route', 'spd']], ['hybrid', '하이브리드 TE', ['hands', 'rblk', 'route']]],
  OL: [['protector', '패스 프로텍터', ['pblk', 'agi', 'vis']], ['mauler', '로드 그레이더', ['rblk', 'str', 'stam']], ['tech', '테크니션', ['pblk', 'rblk', 'vis']]],
  DT: [['nose', '노즈 태클', ['str', 'rdef', 'stam']], ['penetrator', '패스러싱 DT', ['rush', 'hand', 'spd']], ['anchor', '투갭 앵커', ['rdef', 'str', 'vis']]],
  EDGE: [['speedrush', '스피드 러셔', ['spd', 'rush', 'agi']], ['powerrush', '파워 러셔', ['str', 'rush', 'rdef']], ['threedown', '스리다운 엣지', ['rdef', 'vis', 'rush']]],
  LB: [['thumper', '런 스토퍼', ['tkl', 'str', 'vis']], ['coverage', '커버리지 LB', ['cov', 'spd', 'vis']], ['blitzer', '블리처', ['rush', 'spd', 'tkl']]],
  CB: [['man', '맨투맨 CB', ['cov', 'spd', 'agi']], ['hawk', '볼호크 CB', ['ball', 'vis', 'cov']], ['press', '프레스 CB', ['tkl', 'cov', 'spd']]],
  S: [['center', '센터필더', ['cov', 'spd', 'ball']], ['box', '박스 세이프티', ['tkl', 'str', 'vis']], ['hybridS', '하이브리드 세이프티', ['cov', 'tkl', 'vis']]],
  K: [['big', '파워 키커', ['kpow', 'kacc', 'ath']], ['precise', '정밀 키커', ['kacc', 'cons', 'poise']], ['ice', '강심장 키커', ['poise', 'kacc', 'cons']]],
  P: [['boomer', '롱 펀터', ['kpow', 'pnt', 'cons']], ['coffin', '코핀 코너 펀터', ['pnt', 'cons', 'kacc']], ['athlete', '운동능력 펀터', ['ath', 'pnt', 'kpow']]],
};
export const archetypeOf = (pos, id) => ARCHETYPES[pos].find(a => a[0] === id) || ARCHETYPES[pos][0];

// OVR 구간 이름 (화면의 '○○ 진입' 알림).
export const TIERS = [[93, '역대급'], [87, '올프로급'], [81, '프로볼급'], [75, 'NFL 주전급'], [69, 'NFL 로스터급'], [62, '대학 주전급'], [55, '대학 유망주'], [48, '고교 주전급'], [0, '고교 유망주']];
export const tierOf = ovr => TIERS.find(t => ovr >= t[0])[1];
// 레벨별 평균 주전 OVR (스탯 계산의 기준선).
export const LEVEL_AVG = { HS: 47, JUCO: 54, FCS: 57, G5: 61, P4: 66, NFL: 75, CFL: 68 };

// ───────── 표시 ─────────
export const USD_KRW = 1400;
export function usd(n) {
  if (n >= 1e6) return `$${round1(n / 1e6).toLocaleString('en-US')}M`;
  if (n >= 1e3) return `$${Math.round(n / 1e3).toLocaleString('en-US')}K`;
  return `$${Math.round(n).toLocaleString('en-US')}`;
}
export function krw(nUsd) {
  const won = nUsd * USD_KRW;
  if (won >= 1e8) return `약 ${round1(won / 1e8).toLocaleString('ko-KR')}억 원`;
  if (won >= 1e4) return `약 ${Math.round(won / 1e4).toLocaleString('ko-KR')}만 원`;
  return `약 ${Math.round(won).toLocaleString('ko-KR')}원`;
}
export const signed = n => (n > 0 ? `+${n}` : `${n}`);
export const pct = n => `${Math.round(n * 100)}%`;
export const ROMAN = n => { const m = [[50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]; let s = ''; for (const [v, r] of m) while (n >= v) { s += r; n -= v; } return s; };
export const superBowlName = seasonYear => `슈퍼볼 ${ROMAN(seasonYear - 1965)}`;
export const josa = (word, a, b) => { const c = String(word).trim().at(-1)?.charCodeAt(0) ?? 0; if (c < 0xac00 || c > 0xd7a3) return b; return (c - 0xac00) % 28 ? a : b; };
