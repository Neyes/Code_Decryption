// 시즌 시뮬레이션: 팀 전력, 뎁스 차트 역할, 경기별 스탯 라인, 포스트시즌, 결승 중계 대본.
import { diffOf } from './difficulty.js';
import { clamp, gauss, pick, rng, round1, sum, POSITIONS, overall, LEVEL_AVG, superBowlName, hash01 } from './core.js';
import { TEAMS, TEAM_BY_ID, CFL_TEAMS } from '../data/teams.js';
import { COLLEGES, COLLEGE_BY_ID } from '../data/colleges.js';
import { SCHOOL_BY_ID } from '../data/schools.js';
import { depth, teamPower, STARTER_SLOTS, displayName, seasonInjuries } from './league.js';

export const ROLE_LABEL = {
  HS: { key: '핵심 선수', starter: '주전', rotation: '로테이션', backup: '백업', special: 'JV(2군)', redshirt: 'JV(2군)', practice: 'JV(2군)' },
  COL: { key: '핵심 선수', starter: '주전', rotation: '로테이션', backup: '백업', special: '스카우트 팀', redshirt: '레드셔트', practice: '스카우트 팀' },
  PRO: { key: '프랜차이즈', starter: '주전', rotation: '로테이션', backup: '백업', special: '스페셜팀', redshirt: '스페셜팀', practice: '연습생' },
};
export const ROLE_ORDER = ['practice', 'redshirt', 'special', 'backup', 'rotation', 'starter', 'key'];
const SNAP = { key: 1, starter: .95, rotation: .55, backup: .16, special: .08, redshirt: .1, practice: 0 };
const IMPACT = { QB: .9, RB: .28, WR: .3, TE: .2, OL: .22, DT: .24, EDGE: .3, LB: .24, CB: .28, S: .22, K: .14, P: .08 };

export const levelOf = s => s.stage === 'hs' ? 'HS' : s.stage === 'college' ? COLLEGE_BY_ID[s.team.id].tier : s.stage === 'cfl' ? 'CFL' : 'NFL';
export const roleLabels = s => s.stage === 'hs' ? ROLE_LABEL.HS : s.stage === 'college' ? ROLE_LABEL.COL : ROLE_LABEL.PRO;
export const roleName = (s, role) => roleLabels(s)[role] || role;

// 고교·대학 팀의 같은 포지션 경쟁자 (가상의 선수들).
function amateurDepth(s, r) {
  const pos = s.player.pos, n = STARTER_SLOTS[pos];
  const avg = s.stage === 'hs' ? 36 + SCHOOL_BY_ID[s.team.id].prestige * .2 : 46 + COLLEGE_BY_ID[s.team.id].prestige * .24;
  return Array.from({ length: n + 3 }, (_, i) => Math.round(avg + 3 - i * 1.6 + gauss(r) * 3.5)).sort((a, b) => b - a);
}
// 역할: 내 OVR(감독 신뢰 보정)과 경쟁자 비교. kickru식 '차이 → 역할'에 순위 개념을 더했습니다.
export function computeRole(s, r, incumbents) {
  const p = s.player, n = STARTER_SLOTS[p.pos];
  const eff = p.ovr + (s.meters.trust - 50) * .08 + (s.seasonMods?.playing || 0) * 20 + diffOf(s).role;
  const better = incumbents.filter(v => v > eff).length;
  if (s.redshirt) return 'redshirt';
  if (better === 0 && eff >= (incumbents[0] ?? 0) + 3 && p.ovr >= (s.stage === 'nfl' ? 84 : 0)) return 'key';
  if (better < n) return 'starter';
  if (better < n + 1 + (n >= 3 ? 1 : 0)) return 'rotation';
  if (better < n + 3) return 'backup';
  return s.stage === 'nfl' && s.contract?.type === 'ps' ? 'practice' : 'special';
}
function proIncumbents(s) {
  const league = s.league, pos = s.player.pos;
  return depth(league, s.team.id, pos).map(x => x[2]);
}
export function depthNames(s) {
  if (s.stage !== 'nfl') return [];
  return depth(s.league, s.team.id, s.player.pos).slice(0, STARTER_SLOTS[s.player.pos] + 2).map(x => ({ name: displayName(x[0]), ovr: x[2], age: x[3] }));
}

// ───────── 일정 ─────────
const HS_OPP = ['링컨', '센트럴', '노스사이드', '웨스트필드', '루스벨트', '이스트레이크', '리버사이드', '하이랜드', '사우스뷰', '오크우드', '레이크우드', '밸리 크리스천', '메모리얼', '파크뷰', '그랜트', '에디슨'];
const BOWLS = ['로즈볼', '슈거볼', '오렌지볼', '코튼볼', '피치볼', '피에스타볼', '시트러스볼', '게이터볼', '알라모볼', '홀리데이볼', '선볼', '뮤직시티볼'];
export const SEGMENT_LABEL = {
  HS: ['8월 개막전', '9월', '10월', '정규시즌 마무리'], COL: ['9월 개막', '10월 초', '10월 말', '11월 라이벌 주간'],
  NFL: ['1~4주차', '5~8주차', '9~13주차', '14~18주차'], CFL: ['6~7월', '8월', '9월', '10월'],
};
function seasonTeam(s, r) {
  const p = s.player;
  if (s.stage === 'hs') { const sc = SCHOOL_BY_ID[s.team.id]; return { strength: 30 + sc.prestige * .55 + gauss(r) * 5, avg: 36 + sc.prestige * .2 }; }
  if (s.stage === 'college') { const c = COLLEGE_BY_ID[s.team.id]; return { strength: c.prestige + gauss(r) * 6, avg: 46 + c.prestige * .24 }; }
  if (s.stage === 'cfl') return { strength: 50 + gauss(r) * 12, avg: LEVEL_AVG.CFL };
  return { strength: teamPower(s.league, s.team.id, p.ovr >= 60 ? { pos: p.pos, ovr: p.ovr } : null) + gauss(r) * 3, avg: LEVEL_AVG.NFL };
}
function schedule(s, r) {
  const games = [];
  if (s.stage === 'hs') {
    const names = [...HS_OPP].sort(() => r() - .5).slice(0, 10);
    names.forEach((n, i) => games.push({ wk: i + 1, oppName: `${n} 고교`, oppStr: clamp(55 + gauss(r) * 13 + (i >= 6 ? 3 : 0), 20, 95), home: i % 2 === 0 }));
  } else if (s.stage === 'college') {
    const me = COLLEGE_BY_ID[s.team.id];
    const conf = COLLEGES.filter(c => c.conf === me.conf && c.id !== me.id).sort(() => r() - .5);
    const others = COLLEGES.filter(c => c.conf !== me.conf && c.id !== me.id).sort(() => r() - .5);
    const list = [...others.slice(0, 3), ...conf.slice(0, 9)];
    while (list.length < 12) list.push(others[list.length]);
    list.forEach((c, i) => games.push({ wk: i + 1, oppId: c.id, oppName: c.ko, oppStr: clamp(c.prestige + gauss(r) * 6, 20, 99), home: i % 2 === 0, conf: c.conf === me.conf }));
  } else if (s.stage === 'cfl') {
    for (let i = 0; i < 18; i++) { const t = pick(r, CFL_TEAMS.filter(x => x.id !== s.team.id)); games.push({ wk: i + 1, oppId: t.id, oppName: t.ko, oppStr: clamp(50 + gauss(r) * 12, 20, 90), home: i % 2 === 0 }); }
  } else {
    const me = TEAM_BY_ID[s.team.id];
    const div = TEAMS.filter(t => t.div === me.div && t.id !== me.id);
    const rest = TEAMS.filter(t => t.div !== me.div).sort(() => r() - .5).slice(0, 11);
    const list = [...div, ...div, ...rest].sort(() => r() - .5);
    list.forEach((t, i) => games.push({ wk: i + 1 + (i >= 8 ? 1 : 0), oppId: t.id, oppName: t.ko, oppStr: teamPower(s.league, t.id) + gauss(r) * 3, home: i % 2 === 0, div: t.div === me.div }));
  }
  return games;
}
const segmentsFor = n => n === 10 ? [[0, 3], [3, 5], [5, 8], [8, 10]] : n === 12 ? [[0, 3], [3, 6], [6, 9], [9, 12]] : n === 17 ? [[0, 4], [4, 8], [8, 13], [13, 17]] : [[0, 5], [5, 9], [9, 14], [14, n]];

// 시즌 부상 확률 (훈련 계획, 만성 부상, 스태프, 체질).
export function injuryChance(s, plan = s.training) {
  const base = plan === 'intense' ? .2 : plan === 'recovery' ? .055 : .11;
  const staff = s.shop?.staff?.trainer ? .75 : 1;
  const facility = 1 - .1 * (s.shop?.facilities?.recovery || 0);
  const prone = s.player.injuryProne ? 1.35 : 1;
  const age = s.player.age >= 31 ? 1 + (s.player.age - 30) * .06 : 1;
  return clamp(base * (1 + (s.meters.body || 0) * .08) * staff * facility * prone * age * diffOf(s).injury + (s.seasonMods?.injury || 0), .02, .6);
}

export function startSeasonSim(s) {
  const r = rng(s), level = levelOf(s);
  if (s.stage === 'nfl') seasonInjuries(s.league, r);
  const team = seasonTeam(s, r);
  const incumbents = s.stage === 'nfl' ? proIncumbents(s) : s.stage === 'cfl' ? [68, 66, 64, 62, 60].slice(0, STARTER_SLOTS[s.player.pos] + 2) : amateurDepth(s, r);
  const role = computeRole(s, r, incumbents);
  const games = schedule(s, r);
  const key = s.stage === 'hs' ? 'HS' : s.stage === 'college' ? 'COL' : s.stage === 'cfl' ? 'CFL' : 'NFL';
  s.season = {
    year: s.year, level, key, teamStrength: team.strength, teamAvg: team.avg, incumbents, role, startRole: role, roleChanges: [],
    games, segments: segmentsFor(games.length), segLabels: SEGMENT_LABEL[key], seg: 0, line: emptyLine(), post: { rounds: [], result: null, done: false },
    injury: null, injuries: [], injuryChance: injuryChance(s), training: s.training, cards: [], cardPoints: cardPoints(s), final: null, standings: null, depthRank: null,
  };
  markFeatured(s, r);
  return s.season;
}
// 대학 라이벌전 (실제 이름). 시즌 마지막 정규 경기를 라이벌전으로 바꿉니다.
export const RIVALRIES = [['OSU', 'MICH', '더 게임'], ['BAMA', 'AUB', '아이언 볼'], ['TEX', 'OU', '레드 리버 라이벌리'], ['UGA', 'UF', '플로리다-조지아전'], ['CLEM', 'SC', '팰머토 볼'],
  ['USC', 'ND', '주얼드 셜레일러'], ['LSU', 'MISS', '매그놀리아 볼'], ['IOWA', 'NEB', '히어로즈 게임'], ['UTAH', 'BYU', '홀리 워'], ['ORE', 'UW', '북서부 라이벌전'], ['FSU', 'MIA', '선샤인 스테이트 라이벌전']];
// 시즌마다 직접 플레이할 수 있는 '빅게임' 하나: 고교 홈커밍 라이벌전, 대학 라이벌전, NFL 디비전 라이벌 나이트 경기.
function markFeatured(s, r) {
  const z = s.season, last = z.games.length - 1;
  let idx = last, title = s.stage === 'hs' ? '홈커밍 라이벌전' : s.stage === 'cfl' ? '노동절 클래식' : '시즌 마지막 라이벌전';
  if (s.stage === 'college') {
    const rv = RIVALRIES.find(x => x.includes(s.team.id));
    if (rv) { const oid = rv[0] === s.team.id ? rv[1] : rv[0], c = COLLEGE_BY_ID[oid]; z.games[last] = { ...z.games[last], oppId: oid, oppName: c.ko, oppStr: clamp(c.prestige + gauss(r) * 4, 20, 99), conf: c.conf === COLLEGE_BY_ID[s.team.id].conf }; title = rv[2]; }
  } else if (s.stage === 'nfl') {
    const div = z.games.map((g, i) => [g, i]).filter(([g]) => g.div).map(x => x[1]);
    idx = div.length ? div.at(-1) : last; title = '선데이 나이트 디비전 라이벌전';
  }
  z.games[idx] = { ...z.games[idx], featured: true, title };
  z.featured = idx;
}
// 시즌 중 선택 카드가 나오는 구간 (나이가 어릴수록 많이). 첫 시즌은 한 번만 멈춥니다.
function cardPoints(s) {
  const first = !s.history.length, age = s.player.age;
  const n = first ? 1 : age <= 22 ? 3 : age <= 30 ? 2 : 1;
  return ({ 1: [1], 2: [0, 2], 3: [0, 1, 2] })[n];
}

// ───────── 경기 ─────────
export const emptyLine = () => ({ g: 0, gs: 0, gradeSum: 0, att: 0, cmp: 0, pyds: 0, ptd: 0, pint: 0, ratt: 0, ryds: 0, rtd: 0, fum: 0, tgt: 0, rec: 0, recyds: 0, rectd: 0,
  tkl: 0, sack: 0, tfl: 0, dint: 0, pd: 0, ff: 0, dtd: 0, sa: 0, pan: 0, fga: 0, fgm: 0, fglong: 0, xpa: 0, xpm: 0, punts: 0, puntyds: 0, in20: 0, sttkl: 0, w: 0, l: 0 });
const binom = (r, n, p) => { let k = 0; for (let i = 0; i < n; i++) if (r() < p) k++; return k; };
const A = (p, k) => p.attrs[k] ?? p.ovr;

function wrRank(s) { // WR1/WR2/WR3: 경쟁자 중 몇 번째인가
  const better = s.season.incumbents.filter(v => v > s.player.ovr).length;
  return clamp(better, 0, 3);
}
// 한 포지션의 경기 라인. rr = 상대 수준 대비 내 실력, snap = 출전 비율.
function positionLine(s, r, rr, snap, two = null) {
  const p = two ? { pos: two.pos, attrs: two.attrs, ovr: two.ovr } : s.player, L = {}, pos = p.pos, j = () => .85 + r() * .3;
  const d = k => (A(p, k) - p.ovr);
  if (snap <= 0) return L;
  if (pos === 'QB') {
    L.att = Math.round(33 * snap * j());
    const cp = clamp(.635 + rr * .0045 + d('acc') * .003 + gauss(r) * .05, .42, .84);
    L.cmp = Math.round(L.att * cp);
    L.pyds = Math.round(L.cmp * clamp(11 + rr * .05 + d('arm') * .04 + gauss(r) * 1.4, 7, 17));
    L.ptd = binom(r, L.att, clamp(.046 + rr * .0012 + d('vis') * .0004, .01, .11));
    L.pint = binom(r, L.att, clamp(.024 - rr * .0005 - d('vis') * .0003, .005, .06));
    L.ratt = Math.round((2 + Math.max(0, A(p, 'mob') - 55) * .12) * snap * j());
    L.ryds = Math.round(L.ratt * clamp(3 + (A(p, 'mob') - 60) * .06 + gauss(r) * 1.5, -1, 9));
    L.rtd = binom(r, L.ratt, .03 + Math.max(0, A(p, 'mob') - 70) * .002);
    L.fum = binom(r, 1, .08);
  } else if (pos === 'RB') {
    L.ratt = Math.round(17 * snap * j());
    L.ryds = Math.round(L.ratt * clamp(4.3 + rr * .045 + d('spd') * .012 + gauss(r) * 1.2, 1, 10));
    L.rtd = binom(r, L.ratt, clamp(.032 + rr * .0008, .01, .08));
    L.tgt = Math.round(3.4 * snap * (1 + d('hands') * .02) * j());
    L.rec = binom(r, L.tgt, clamp(.78 + d('hands') * .004, .5, .95));
    L.recyds = Math.round(L.rec * clamp(7.8 + rr * .04 + gauss(r) * 2, 2, 16));
    L.rectd = binom(r, L.rec, .04);
    L.fum = binom(r, L.ratt, clamp(.006 - d('carry') * .0002, .001, .015));
  } else if (pos === 'WR' || pos === 'TE') {
    const share = pos === 'TE' ? 5.6 : [8.6, 7, 5.6, 4.4][wrRank(s)];
    L.tgt = Math.round(share * snap * (1 + rr * .008) * j());
    L.rec = binom(r, L.tgt, clamp((pos === 'TE' ? .7 : .63) + rr * .004 + d('hands') * .003, .4, .9));
    L.recyds = Math.round(L.rec * clamp((pos === 'TE' ? 10.8 : 12.8) + rr * .05 + d('spd') * .05 + gauss(r) * 2.5, 4, 24));
    L.rectd = binom(r, L.rec, clamp((pos === 'TE' ? .085 : .075) + rr * .002, .02, .2));
    if (pos === 'WR' && A(p, 'spd') >= 70 && r() < .12) { L.ratt = 1; L.ryds = Math.round(4 + r() * 15); }
    L.fum = binom(r, L.rec, .005);
  } else if (pos === 'OL') {
    L.sa = binom(r, Math.round(38 * snap), clamp(.011 - rr * .0004 - d('pblk') * .0003, .001, .03));
    L.pan = Math.max(0, Math.round((A(p, 'rblk') - 50) / 14 * snap + gauss(r)));
  } else if (pos === 'DT' || pos === 'EDGE') {
    const edge = pos === 'EDGE';
    L.tkl = Math.max(0, Math.round((edge ? 3.4 : 2.9) * snap * (1 + rr * .01) + gauss(r)));
    const sackP = clamp((edge ? .0135 : .008) + rr * (edge ? .0007 : .0005) + d('rush') * .0003, .001, .05);
    L.sack = binom(r, Math.round(32 * snap), sackP) + (r() < .15 ? .5 : 0);
    L.tfl = Math.max(L.sack ? 1 : 0, binom(r, Math.round(18 * snap), clamp(.03 + rr * .001 + d('rdef') * .0005, .005, .08)));
    L.ff = binom(r, 1, edge ? .07 : .04);
    L.pd = binom(r, 1, .12);
  } else if (pos === 'LB') {
    L.tkl = Math.max(0, Math.round(7.3 * snap * (1 + rr * .008 + d('tkl') * .006) + gauss(r) * 2));
    L.sack = binom(r, Math.round(6 * snap), clamp(.02 + d('rush') * .001 + rr * .0005, .002, .06));
    L.tfl = binom(r, Math.round(10 * snap), .05 + rr * .001);
    L.dint = binom(r, 1, clamp(.04 + d('cov') * .002 + rr * .001, .005, .15));
    L.pd = binom(r, 3, clamp(.1 + d('cov') * .004, .02, .3));
    L.ff = binom(r, 1, .04);
  } else if (pos === 'CB' || pos === 'S') {
    const cb = pos === 'CB';
    L.tkl = Math.max(0, Math.round((cb ? 3.9 : 5.6) * snap + gauss(r) * 1.5));
    L.dint = binom(r, 1, clamp((cb ? .1 : .09) + rr * .004 + d('ball') * .003, .01, .35));
    L.pd = binom(r, cb ? 5 : 3, clamp((cb ? .16 : .15) + rr * .004 + d('cov') * .003, .03, .45));
    L.ff = binom(r, 1, .03);
    if (L.dint && r() < .12) L.dtd = 1;
  } else if (pos === 'K') {
    L.fga = binom(r, 4, .45 * snap);
    L.fgm = 0; L.fglong = 0;
    for (let i = 0; i < L.fga; i++) {
      const dist = Math.round(20 + r() * (A(p, 'kpow') >= 75 ? 40 : 33));
      if (r() < clamp(.98 - (dist - 20) * .0095 + rr * .004 + (A(p, 'kpow') - 70) * .002, .25, .995)) { L.fgm++; L.fglong = Math.max(L.fglong, dist); }
    }
    L.xpa = binom(r, 5, .5); L.xpm = binom(r, L.xpa, clamp(.95 + rr * .002, .85, .995));
  } else if (pos === 'P') {
    L.punts = Math.max(1, Math.round(4.2 * snap + gauss(r)));
    L.puntyds = Math.round(L.punts * clamp(45 + (A(p, 'kpow') - 65) * .18 + rr * .1 + gauss(r) * 2.5, 36, 56));
    L.in20 = binom(r, L.punts, clamp(.38 + d('pnt') * .006, .15, .7));
  }
  return L;
}
// 경기 평점 (0~100, 리그 평균 주전 ≈ 65).
function gameGrade(pos, L0, rr, r) {
  const L = new Proxy(L0, { get: (o, k) => o[k] || 0 });
  let g = 65 + rr * .65 + gauss(r) * 5;
  if (pos === 'QB') { const rate = L.att ? (L.cmp / L.att * 100 - 30) * .05 + (L.pyds / L.att - 3) * .25 + L.ptd / L.att * 20 - L.pint / L.att * 25 : 0; g += (clamp(rate, 0, 2.375 * 4) / 4 * 158.3 - 90) * .22 + L.rtd * 3; }
  else if (pos === 'RB') g += (L.ryds + L.recyds - 80) * .1 + (L.rtd + L.rectd) * 5 - L.fum * 6;
  else if (pos === 'WR' || pos === 'TE') g += (L.recyds - 55) * .12 + L.rectd * 6 - L.fum * 6 + (pos === 'TE' ? 2 : 0);
  else if (pos === 'OL') g += 4 - L.sa * 7 + L.pan * 1.2;
  else if (pos === 'DT' || pos === 'EDGE') g += L.sack * 8 + L.tfl * 2.5 + L.ff * 4 - 3;
  else if (pos === 'LB') g += (L.tkl - 7) * 1.2 + L.sack * 6 + L.dint * 9 + L.pd * 2;
  else if (pos === 'CB' || pos === 'S') g += L.dint * 10 + L.pd * 3 + L.dtd * 6 - 3;
  else if (pos === 'K') g += L.fgm * 3 - (L.fga - L.fgm) * 9 - (L.xpa - L.xpm) * 5 + (L.fglong >= 50 ? 3 : 0);
  else if (pos === 'P') g += L.punts ? (L.puntyds / L.punts - 45) * 1.2 + L.in20 * 2 : 0;
  return clamp(round1(Number.isFinite(g) ? g : 60), 25, 99);
}
const add = (T, L) => { for (const [k, v] of Object.entries(L)) if (typeof v === 'number' && k in T) T[k] = k === 'fglong' ? Math.max(T[k], v) : T[k] + v; };
function footballScore(x) { x = Math.max(0, Math.round(x)); const td = Math.floor(x / 7), rem = x - td * 7; return td * 7 + (rem >= 5 ? 6 : rem >= 3 ? 3 : 0); }

// 한 경기. 결과(승패)와 내 라인, 평점.
export function playGame(s, r, g, round = null) {
  const z = s.season, p = s.player, pos = p.pos;
  const out = z.injury && z.injury.out > 0;
  let snap = out ? 0 : SNAP[z.role] ?? 0;
  if (z.role === 'redshirt' && z.redshirtGames >= 4) snap = 0;
  // 백업도 가끔 기회: 주전 부상, 가비지 타임.
  if (!out && ['backup', 'special', 'redshirt'].includes(z.role) && r() < .12) snap = Math.max(snap, .5);
  const oppAdj = (g.oppStr - 50) * .12;
  const levelAvg = (z.key === 'NFL' ? LEVEL_AVG.NFL : z.key === 'CFL' ? LEVEL_AVG.CFL : z.teamAvg) + oppAdj;
  const form = gauss(r) * 2.2 + (s.seasonMods?.perf || 0) * 1.5 + (s.hot || 0) + (s.shop?.staff?.mental ? .6 : 0) + diffOf(s).form;
  const rr = p.ovr + form - levelAvg;
  let L = snap > 0 ? positionLine(s, r, rr, snap) : {};
  // 투웨이 선수: 반대쪽 포지션 라인도 함께.
  if (snap > 0 && p.twoWay) { const L2 = positionLine(s, r, p.twoWay.ovr + form - levelAvg, snap * .6, p.twoWay); for (const [k, v] of Object.entries(L2)) L[k] = (L[k] || 0) + v; }
  const played = snap > 0 && (Object.keys(L).length > 0 || ['OL'].includes(pos));
  if (snap > 0 && ['special', 'backup', 'redshirt'].includes(z.role) && snap < .3) L.sttkl = binom(r, 2, .3);
  if (z.role === 'redshirt' && played) z.redshirtGames = (z.redshirtGames || 0) + 1;
  // 팀 결과
  const myEdge = played ? (p.ovr - z.teamAvg) * IMPACT[pos] * snap * .5 : 0;
  const str = z.teamStrength + myEdge, home = g.home ? 2.5 : -1;
  const winP = 1 / (1 + Math.exp(-(str - g.oppStr + home) / 9));
  const win = r() < winP;
  let pf = footballScore(21 + (str - g.oppStr) * .22 + gauss(r) * 8), pa = footballScore(21 + (g.oppStr - str) * .22 + gauss(r) * 8);
  const myTd = (L.ptd || 0) + (L.rtd || 0) + (L.rectd || 0);
  pf = Math.max(pf, footballScore(myTd * 7 + (L.fgm || 0) * 3));
  if (win && pf <= pa) pf = pa + (r() < .5 ? 3 : 7);
  if (!win && pa <= pf) pa = pf + (r() < .5 ? 3 : 4);
  if (pos === 'K' && L.xpa) { L.xpa = Math.min(L.xpa, Math.floor(pf / 7)); L.xpm = Math.min(L.xpm, L.xpa); }
  const grade = played ? gameGrade(pos, L, rr, r) : null;
  const res = { ...g, played: true, round, res: win ? 'W' : 'L', pf, pa, line: L, grade, snap, onField: played };
  if (played) { L.g = 1; L.gs = snap >= .9 ? 1 : 0; L.gradeSum = grade; add(z.line, L); }
  if (!round) { if (win) z.line.w++; else z.line.l++; }
  // 부상 판정 (뛴 경기만).
  if (out) z.injury.out--;
  else if (played && r() < z.injuryChance / Math.max(8, z.games.length) * (snap + .2)) {
    const roll = r(), major = roll > .88, mid = roll > .6;
    const kind = major ? pick(r, ['전방십자인대 파열', '아킬레스건 파열', '발목 골절']) : mid ? pick(r, ['햄스트링 부상', '고관절 염좌', '뇌진탕', '어깨 탈구']) : pick(r, ['발목 염좌', '타박상', '종아리 경련']);
    const outGames = major ? 99 : mid ? 2 + Math.floor(r() * 4) : 1;
    z.injury = { kind, out: outGames, major, week: g.wk };
    z.injuries.push({ kind, major, games: major ? '시즌 아웃' : `${outGames}경기 결장` });
    res.injury = kind;
  }
  return res;
}

// 구간 사이 역할 재평가 (신뢰, 활약, 경쟁자 부상).
export function reviewRole(s, r) {
  const z = s.season, p = s.player;
  if (z.role === 'redshirt') return;
  const g = z.line.g ? z.line.gradeSum / z.line.g : 0;
  if (z.line.g >= 2) s.meters.trust = clamp(s.meters.trust + (g - 66) * .35, 0, 100);
  if (s.stage === 'nfl' && r() < .14) z.incumbents = z.incumbents.slice(1); // 주전 경쟁자 부상
  const next = computeRole(s, r, z.incumbents);
  if (next !== z.role) {
    const up = ROLE_ORDER.indexOf(next) > ROLE_ORDER.indexOf(z.role);
    const step = ROLE_ORDER[ROLE_ORDER.indexOf(z.role) + (up ? 1 : -1)];
    if (step && !(z.role === 'practice' && !up)) { z.roleChanges.push({ seg: z.seg, from: z.role, to: step }); z.role = step; }
  }
}

// ───────── 포스트시즌 ─────────
function nflStandings(s, r, myWins) {
  const rows = TEAMS.map(t => {
    if (t.id === s.team.id) return { id: t.id, w: myWins, l: 17 - myWins };
    const pw = teamPower(s.league, t.id) + gauss(r) * 4;
    const w = clamp(Math.round(8.5 + (pw - 62) * .21 + gauss(r) * 1.8), 1, 16);
    return { id: t.id, w, l: 17 - w };
  });
  const seeds = {};
  for (const conf of ['AFC', 'NFC']) {
    const list = rows.filter(x => TEAM_BY_ID[x.id].conf === conf).map(x => ({ ...x, tie: r() }));
    const divs = [...new Set(list.map(x => TEAM_BY_ID[x.id].div))];
    const winners = divs.map(d => list.filter(x => TEAM_BY_ID[x.id].div === d).sort((a, b) => b.w - a.w || b.tie - a.tie)[0]).sort((a, b) => b.w - a.w || b.tie - a.tie);
    const wild = list.filter(x => !winners.includes(x)).sort((a, b) => b.w - a.w || b.tie - a.tie).slice(0, 3);
    seeds[conf] = [...winners, ...wild].map(x => x.id);
  }
  return { rows: rows.sort((a, b) => b.w - a.w), seeds };
}
export function postseasonPlan(s, r) {
  const z = s.season, w = z.line.w, games = z.games.length, level = z.level;
  if (z.key === 'HS') return w >= 6 ? { kind: 'hs', rounds: ['지역 1라운드', '지역 준결승', '지역 결승', '주 준결승', '주 챔피언십'].slice(w >= 9 ? 1 : 0), finalName: '주 챔피언십' } : null;
  if (z.key === 'CFL') return w >= 10 ? { kind: 'cfl', rounds: ['디비전 준결승', '디비전 결승', '그레이컵'], finalName: '그레이컵' } : null;
  if (z.key === 'NFL') {
    const st = nflStandings(s, r, w); z.standings = st;
    const conf = TEAM_BY_ID[s.team.id].conf, seed = st.seeds[conf].indexOf(s.team.id) + 1;
    z.seed = seed || null;
    if (!seed) return null;
    return { kind: 'nfl', seed, rounds: [...(seed === 1 ? [] : ['와일드카드']), '디비저널 라운드', `${conf} 챔피언십`, superBowlName(s.year)], finalName: superBowlName(s.year) };
  }
  // 대학
  const c = COLLEGE_BY_ID[s.team.id];
  if (level === 'FCS') return w >= 8 ? { kind: 'fcs', rounds: ['FCS 1라운드', 'FCS 2라운드', 'FCS 8강', 'FCS 4강', 'FCS 내셔널 챔피언십'].slice(w >= 10 ? 1 : 0), finalName: 'FCS 내셔널 챔피언십' } : null;
  if (level === 'JUCO') return w >= 7 ? { kind: 'bowl', rounds: ['JUCO 볼 게임'], finalName: null } : null;
  const confChamp = level === 'P4' && c.conf !== '독립' && w >= 10 && r() < (w >= 11 ? .75 : .4);
  const cfpScore = w * 10 + c.prestige * .3 + gauss(r) * 4 + (confChamp ? 6 : 0);
  const cfp = cfpScore >= (level === 'P4' ? 132 : 140) || (level === 'G5' && w >= 12);
  const rounds = [];
  if (confChamp) rounds.push(`${c.conf} 챔피언십`);
  if (cfp) rounds.push(...(cfpScore >= 146 ? [] : ['CFP 1라운드']), 'CFP 8강', 'CFP 4강', 'CFP 내셔널 챔피언십');
  else if (w >= 6) rounds.push(pick(r, BOWLS));
  return rounds.length ? { kind: 'college', cfp, rounds, finalName: cfp ? 'CFP 내셔널 챔피언십' : null } : null;
}
function postOpponent(s, r, roundIdx, total) {
  const z = s.season, depthFactor = (roundIdx + 1) / total;
  if (z.key === 'NFL') {
    const conf = TEAM_BY_ID[s.team.id].conf, last = roundIdx === total - 1;
    const pool = last ? z.standings.seeds[conf === 'AFC' ? 'NFC' : 'AFC'].slice(0, 4) : z.standings.seeds[conf].filter(id => id !== s.team.id).slice(0, 6);
    const id = pick(r, pool);
    return { oppId: id, oppName: TEAM_BY_ID[id].ko, oppStr: teamPower(s.league, id) + 3 + gauss(r) * 3 };
  }
  if (z.key === 'HS') return { oppName: `${pick(r, HS_OPP)} 고교`, oppStr: 60 + depthFactor * 18 + gauss(r) * 5 };
  if (z.key === 'CFL') { const t = pick(r, CFL_TEAMS.filter(x => x.id !== s.team.id)); return { oppId: t.id, oppName: t.ko, oppStr: 58 + depthFactor * 10 + gauss(r) * 5 }; }
  const pool = COLLEGES.filter(c => c.id !== s.team.id && c.tier === (z.level === 'FCS' ? 'FCS' : z.level === 'JUCO' ? 'JUCO' : 'P4'));
  const strong = pool.filter(c => c.prestige >= (z.level === 'P4' || z.level === 'G5' ? 78 : 0));
  const c = pick(r, strong.length ? strong : pool);
  return { oppId: c.id, oppName: c.ko, oppStr: c.prestige + 2 + depthFactor * 4 + gauss(r) * 4 };
}
// 한 라운드씩 진행하는 포스트시즌 (빅게임으로 멈출 수 있게).
export function planPostseason(s, r) {
  const z = s.season, plan = postseasonPlan(s, r);
  z.post = { rounds: [], result: plan ? null : '포스트시즌 진출 실패', done: !plan, plan, idx: 0 };
  return z.post;
}
export function nextPostGame(s, r) {
  const z = s.season, plan = z.post.plan, i = z.post.idx, name = plan.rounds[i];
  const opp = postOpponent(s, r, i, plan.rounds.length);
  return { wk: 100 + i, home: i < plan.rounds.length - 1 && r() < .6, ...opp, round: name, title: name, final: !!plan.finalName && name === plan.finalName, post: true };
}
export function resolvePostGame(s, r, g) {
  const z = s.season, plan = z.post.plan;
  z.post.rounds.push(g);
  if (g.final && g.onField && !g.interactive) z.final = buildBroadcast(s, r, g);
  if (g.res === 'L') { z.post.result = `${g.round} 탈락`; z.post.done = true; }
  else if (z.post.idx >= plan.rounds.length - 1) { z.post.result = plan.finalName ? `${g.round} 우승` : `${g.round} 승리`; z.post.done = true; }
  else z.post.idx++;
  z.champion = !!(plan.finalName && z.post.result === `${plan.finalName} 우승`);
}
// 직접 플레이 결과를 경기 결과로. res: { pointsFor, pointsAgainst, line, grade, ot }
export function interactiveGame(s, r, g, res, round = null) {
  const z = s.season, p = s.player, side = POSITIONS[p.pos].side, str = z.teamStrength;
  const rest = (a, b, base) => footballScore(Math.max(0, base + (a - b) * .16 + gauss(r) * 4));
  let pf = res.pointsFor + (res.restFor ?? rest(str, g.oppStr, side === 'O' ? 6 : side === 'ST' ? 13 : 17));
  let pa = res.pointsAgainst + (res.restAgainst ?? rest(g.oppStr, str, side === 'D' ? 6 : 17));
  let ot = false;
  if (pf === pa) { ot = true; if (r() < clamp(.5 + (res.grade - 65) * .02 + (str - g.oppStr) * .01, .15, .85)) pf += 3; else pa += 3; }
  // 미니게임 밖의 나머지 경기 기록(가볍게)
  const levelAvg = (z.key === 'NFL' ? LEVEL_AVG.NFL : z.key === 'CFL' ? LEVEL_AVG.CFL : z.teamAvg) + (g.oppStr - 50) * .12;
  const bg = ['K', 'P'].includes(p.pos) ? {} : positionLine(s, r, p.ovr - levelAvg, .4);
  const merged = { ...bg };
  for (const [k, v] of Object.entries(res.line || {})) merged[k] = k === 'fglong' ? Math.max(merged[k] || 0, v) : (merged[k] || 0) + v;
  for (const k of ['ptd', 'rtd', 'rectd']) merged[k] = res.line?.[k] || 0; // 득점 기록은 직접 플레이한 것만
  const win = pf > pa, L = { ...merged, g: 1, gs: 1, gradeSum: res.grade };
  add(z.line, L);
  if (!round) { if (win) z.line.w++; else z.line.l++; }
  return { ...g, played: true, round, res: win ? 'W' : 'L', pf, pa, line: L, grade: res.grade, snap: 1, onField: true, interactive: true, ot, plays: res.plays || [] };
}
export function playPostseason(s, r) {
  const z = s.season, plan = postseasonPlan(s, r);
  z.post = { rounds: [], result: plan ? null : '포스트시즌 진출 실패', done: true, plan };
  if (!plan) return z.post;
  for (let i = 0; i < plan.rounds.length; i++) {
    const name = plan.rounds[i], opp = postOpponent(s, r, i, plan.rounds.length);
    const g = playGame(s, r, { wk: 100 + i, home: i < plan.rounds.length - 1 && r() < .6, ...opp }, name);
    z.post.rounds.push(g);
    if (plan.finalName && name === plan.finalName && g.onField) z.final = buildBroadcast(s, r, g); // 내가 뛴 결승만 중계
    if (g.res === 'L') { z.post.result = `${name} 탈락`; break; }
    if (i === plan.rounds.length - 1) z.post.result = plan.finalName ? `${name} 우승` : `${name} 승리`;
  }
  z.champion = !!(plan.finalName && z.post.result === `${plan.finalName} 우승`);
  return z.post;
}

// ───────── 결승 문자 중계 ─────────
// 최종 점수와 내 스탯 라인에 맞춰 득점 장면을 만들고, 사이사이 수비·펀트 장면을 섞습니다.
export function buildBroadcast(s, r, g) {
  const p = s.player, me = s.team.name, them = g.oppName, L = g.line || {};
  const scores = [];
  const split = (pts) => { const out = []; let x = pts; while (x >= 7) { out.push(7); x -= 7; } if (x === 6) out.push(6); else if (x >= 3) out.push(3); return out; };
  const mine = split(g.pf).map(v => ({ team: 'me', v })), theirs = split(g.pa).map(v => ({ team: 'opp', v }));
  // 내 터치다운을 우리 팀 득점에 배정.
  const myTds = [];
  for (let i = 0; i < (L.ptd || 0); i++) myTds.push(`${p.name}의 ${Math.round(8 + r() * 40)}야드 터치다운 패스!`);
  for (let i = 0; i < (L.rtd || 0); i++) myTds.push(`${p.name}${p.pos === 'QB' ? '이 직접 달려' : ''} ${Math.round(1 + r() * 25)}야드 러싱 터치다운!`);
  for (let i = 0; i < (L.rectd || 0); i++) myTds.push(`${p.name}, ${Math.round(5 + r() * 45)}야드 터치다운 캐치!`);
  if (L.dtd) myTds.push(`${p.name}의 픽식스! 인터셉트 리턴 터치다운!`);
  const all = [...mine, ...theirs].sort(() => r() - .5);
  let a = 0, b = 0, tdIdx = 0;
  const plays = [{ q: 1, t: '15:00', text: `${g.round} 킥오프. ${me}${josaWa(me)} ${them}의 맞대결이 시작됩니다.`, a, b }];
  all.forEach((x, i) => {
    const q = Math.min(4, 1 + Math.floor(i / Math.max(1, all.length / 4)));
    const clock = `${String(Math.floor(r() * 14) + 1).padStart(2, '0')}:${String(Math.floor(r() * 60)).padStart(2, '0')}`;
    if (r() < .5) plays.push({ q, t: clock, text: filler(s, r, L, x.team), a, b });
    if (x.team === 'me') a += x.v; else b += x.v;
    const text = x.team === 'me'
      ? (x.v >= 6 ? (tdIdx < myTds.length && (r() < .7 || all.length - i <= myTds.length - tdIdx) ? myTds[tdIdx++] : `${me}, ${Math.round(1 + r() * 30)}야드 터치다운!`) : p.pos === 'K' ? `${p.name}의 ${Math.round(25 + r() * 25)}야드 필드골 성공!` : `${me} 필드골 성공.`)
      : (x.v >= 6 ? `${them}, 터치다운. 점수 차가 좁혀집니다.` : `${them} 필드골.`);
    plays.push({ q, t: clock, text, a, b, score: true, mine: x.team === 'me' });
  });
  while (tdIdx < myTds.length) plays.push({ q: 4, t: '02:00', text: myTds[tdIdx++].replace('터치다운', '터치다운 (2점 컨버전 실패 후 리드 유지)'), a, b });
  plays.push({ q: 4, t: '00:00', text: g.res === 'W' ? `경기 종료! ${me} 우승! ${p.name}${josaI(p.name)} 두 팔을 번쩍 듭니다.` : `경기 종료. ${them}의 우승. ${p.name}${josaWa2(p.name)} 동료들이 고개를 숙입니다.`, a: g.pf, b: g.pa, end: true });
  return { title: g.round, me, them, pf: g.pf, pa: g.pa, win: g.res === 'W', plays, line: L, grade: g.grade };
}
const josaWa = w => /[가-힣]$/.test(w) && (w.at(-1).charCodeAt(0) - 0xac00) % 28 ? '과' : '와';
const josaI = w => /[가-힣]$/.test(w) && (w.at(-1).charCodeAt(0) - 0xac00) % 28 ? '이' : '가';
const josaWa2 = w => josaWa(w);
function filler(s, r, L, team) {
  const p = s.player;
  if (team === 'opp' && p.pos !== 'QB' && POSITIONS[p.pos].side === 'D') {
    if (L.sack && r() < .6) return `${p.name}의 색! 상대 QB를 쓰러뜨립니다.`;
    if (L.dint && r() < .6) return `${p.name}, 인터셉트! 공격권을 되찾습니다.`;
    if (L.pd && r() < .5) return `${p.name}의 패스 디플렉션. 상대 3rd 다운 실패.`;
    return `${p.name}${josaI(p.name)} 러닝백을 막아 냅니다. 상대 펀트.`;
  }
  if (team === 'me' && p.pos === 'OL') return `${p.name}의 블록이 길을 엽니다. 퍼스트 다운.`;
  if (p.pos === 'P') return `${p.name}의 펀트가 상대 진영 깊숙이 떨어집니다.`;
  return pick(r, ['서드 다운 컨버전 성공. 체인이 움직입니다.', '양 팀 수비가 버팁니다. 펀트.', '긴 패스가 손끝을 스칩니다. 인컴플리트.', '타임아웃. 관중석이 술렁입니다.', '스크린 패스로 10야드 전진.']);
}

// ───────── 시즌 요약 ─────────
export function seasonSummary(s) {
  const z = s.season, L = z.line, gp = L.g || 0;
  return { games: gp, starts: L.gs, grade: gp ? round1(L.gradeSum / gp) : 0, w: L.w, l: L.l };
}
export function teamName(s) { return s.team.name; }
export { footballScore };
export { hash01 };
