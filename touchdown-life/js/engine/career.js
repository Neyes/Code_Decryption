// 커리어 진행: 선수 생성 → 고교 → 리크루팅 → 대학 → 컴바인·드래프트 → NFL 계약·FA·트레이드 → 은퇴.
import { clamp, hash, rng, gauss, pick, weighted, round1, sum, clone, POSITIONS, ATTR, attrsOf, overall, convertAttrs, ovrAs, ARCHETYPES, archetypeOf, tierOf, TIERS, POS_ORDER, usd, josa } from './core.js';
const I = w => `${w}${josa(w, '이', '가')}`, WA = w => `${w}${josa(w, '과', '와')}`, RO = w => `${w}${josa(w, '으로', '로').replace(/^으로$/, /[가-힣]$/.test(w) && (w.at(-1).charCodeAt(0) - 0xac00) % 28 === 8 ? '로' : '으로')}`;
import { TEAMS, TEAM_BY_ID, CFL_TEAMS, RETIRED_NUMBERS } from '../data/teams.js';
import { COLLEGES, COLLEGE_BY_ID } from '../data/colleges.js';
import { HIGH_SCHOOLS, SCHOOL_BY_ID } from '../data/schools.js';
import { buildLeague, evolveLeague, depth, teamPower, contenderLabel, STARTER_SLOTS, displayName, START_YEAR } from './league.js';
import { startSeasonSim, playGame, reviewRole, planPostseason, nextPostGame, resolvePostGame, interactiveGame, levelOf, roleName, computeRole, ROLE_ORDER, injuryChance } from './sim.js';
import { seasonScore, nflAwards, collegeAwards, hsAwards, cflAwards, careerScore, hallOfFame, countAwards, totals, isPro } from './awards.js';
import { drawCard, resolveCard } from './events.js';
import { socialSeason, ensureSocial } from './social.js';
import { refreshStock, staffFees, growthBonus, declineFactor, agentBoost, expireStaff } from './shop.js';
import { applyProgram, interviewFor, runOlympics } from './extras.js';

export const SAVE_VERSION = 1;
const MIN_SALARY = 885000, PS_SALARY = 320000;

// ───────── 선수 생성 ─────────
// kickru식: 후보 3명은 모두 OVR 45, 보이는 능력치 합 240. 분포만 다릅니다.
export function makeCandidates(pos, seedText) {
  const r = rng({ rng: hash(seedText) });
  return ARCHETYPES[pos].map(([id, label, strong]) => {
    const keys = attrsOf(pos), w = POSITIONS[pos].w;
    const weight = Object.fromEntries(keys.map(k => [k, (strong.includes(k) ? 1.35 + (strong[0] === k ? .2 : 0) : .78) * (.9 + r() * .2)]));
    const total = sum(Object.values(weight));
    const a = Object.fromEntries(keys.map(k => [k, clamp(Math.round(240 * weight[k] / total + gauss(r) * 2), 18, 70)]));
    fixSum(a, 240);
    // OVR 45에 맞추기: 가중치가 큰 능력치와 작은 능력치 사이로 1점씩 옮깁니다.
    for (let guard = 0; guard < 200 && overall(pos, a) !== 45; guard++) {
      const up = overall(pos, a) < 45, byW = [...keys].sort((x, y) => w[y] - w[x]);
      const to = up ? byW.find(k => a[k] < 70) : [...byW].reverse().find(k => a[k] < 70);
      const from = up ? [...byW].reverse().find(k => a[k] > 18 && k !== to) : byW.find(k => a[k] > 18 && k !== to);
      a[to]++; a[from]--;
    }
    return { arch: id, label, strong, attrs: a, ovr: overall(pos, a) };
  });
}
function fixSum(a, target) {
  const keys = Object.keys(a);
  let diff = target - sum(Object.values(a)), i = 0;
  while (diff !== 0 && i < 500) { const k = keys[i % keys.length]; if (diff > 0 && a[k] < 70) { a[k]++; diff--; } else if (diff < 0 && a[k] > 18) { a[k]--; diff++; } i++; }
}
export function createCareer(cfg) {
  const name = String(cfg.name || '').trim();
  if (!name || name.length > 16) throw Error('선수 이름은 1~16자로 입력하세요.');
  if (!POSITIONS[cfg.pos]) throw Error('포지션을 선택하세요.');
  if (!SCHOOL_BY_ID[cfg.schoolId]) throw Error('고등학교를 선택하세요.');
  const number = Number(cfg.number);
  if (!Number.isInteger(number) || number < 0 || number > 99) throw Error('등번호는 0~99입니다.');
  if (!cfg.attrs || attrsOf(cfg.pos).some(k => typeof cfg.attrs[k] !== 'number')) throw Error('플레이 스타일 후보를 고르세요.');
  const seed = hash(cfg.seed ?? `${Date.now()}:${name}:${Math.random()}`);
  const s = { v: SAVE_VERSION, id: `career-${seed}`, seed, rng: seed, createdAt: new Date().toISOString(), startYear: START_YEAR, year: START_YEAR, phase: 'ready', stage: 'hs', grade: 10, collegeYear: 0, redshirtUsed: false, redshirt: false, proSeasons: 0 };
  const r = rng(s), school = SCHOOL_BY_ID[cfg.schoolId];
  const u = clamp(r(), .001, .999);
  const potential = clamp(Math.round(80 + 4.6 * Math.log(u / (1 - u))), 62, 97);
  s.player = {
    name, number, pos: cfg.pos, originalPos: cfg.pos, nat: cfg.nat === 'KR' ? 'KR' : 'US', avatar: cfg.avatar || { skin: 1, hair: 0, visor: 0 }, arch: cfg.arch,
    focus: (cfg.focus || []).filter(k => attrsOf(cfg.pos).includes(k)).slice(0, 2), attrs: { ...cfg.attrs }, ovr: overall(cfg.pos, cfg.attrs),
    potential, lateBloomer: hash(`${seed}:late`) % 100 < 16, wall: hash(`${seed}:wall`) % 100 < 9, injuryProne: hash(`${seed}:inj`) % 100 < 18,
    agingRate: round1(.8 + (hash(`${seed}:age`) % 45) / 100), born: START_YEAR - 15, age: 15, twoWay: null, peak: 45, hand: cfg.hand || '오른손',
  };
  if (!s.player.focus.length) s.player.focus = archetypeOf(cfg.pos, cfg.arch)[2].slice(0, 2);
  s.team = { kind: 'hs', id: school.id, name: school.ko, short: school.ko.replace(' 고교', ''), state: school.state };
  s.meters = { trust: 50, locker: 50, media: 50, front: 50, body: 0 };
  s.flags = []; s.seasonMods = { playing: 0, perf: 0, injury: 0 }; s.training = 'balanced'; s.program = 'ota';
  s.fanTeam = TEAM_BY_ID[cfg.fanTeam] ? cfg.fanTeam : null;
  s.money = 300; s.history = []; s.season = null; s.lastSeason = null; s.card = null; s.cardResult = null; s.path = null; s.todos = []; s.moments = []; s.firsts = {};
  s.recruiting = null; s.contract = null; s.draft = null; s.teamSeasons = {}; s.legacy = null; s.retiredYear = null;
  s.league = buildLeague(START_YEAR);
  s.shop = { stock: [], boughtYear: null, staff: {}, facilities: {}, owned: [] };
  ensureSocial(s);
  refreshStock(s, r);
  s.goal = goalFor(s);
  moment(s, 'start', `${school.ko} ${s.grade}학년. ${POSITIONS[cfg.pos].ko} ${name}의 풋볼 인생이 시작됩니다.`);
  if (s.player.nat === 'KR') moment(s, 'start', '한국에서 건너온 유학생. 영어 플레이북부터 다시 배웁니다.');
  return s;
}
export function moment(s, kind, text) { s.moments.push({ year: s.year, age: s.player.age, kind, text }); }
function first(s, key, text) { if (s.firsts[key]) return; s.firsts[key] = s.year; moment(s, 'first', text); }

// ───────── 이번 시즌 목표 ─────────
const GOALS = {
  hsStart: ['바시티 첫 시즌, 경기에 나서기', '4경기 이상 출전', rec => rec.stats.g >= 4],
  hsStar: ['대학 스카우트의 눈에 띄기', '시즌 평점 74 이상', rec => rec.score >= 74],
  hsSenior: ['마지막 고교 시즌, 플레이오프 진출', '주 플레이오프 진출', rec => !!rec.postRounds?.length],
  rs: ['레드셔트 시즌, 몸 만들기', '종합 능력치 +3', rec => rec.ovrAfter - rec.ovrBefore >= 3],
  colStart: ['대학 무대 첫 출전', '3경기 이상 출전', rec => rec.stats.g >= 3],
  colStar: ['올 컨퍼런스 팀 선정', '올 컨퍼런스 이상', rec => rec.awards.some(a => ['allConf', 'allAmerican', 'consensusAA', 'confPOY'].includes(a.kind))],
  rookie: ['NFL 루키 시즌 살아남기', '8경기 이상 출전', rec => rec.stats.g >= 8],
  starter: ['주전 자리 굳히기', '10경기 이상 선발', rec => rec.stats.gs >= 10],
  pb: ['첫 프로볼 선정', '프로볼', rec => rec.awards.some(a => a.kind === 'proBowl')],
  ring: ['롬바디 트로피를 향해', '플레이오프 진출', rec => !!rec.postRounds?.length],
  cfl: ['CFL에서 다시 증명하기', '시즌 평점 78 이상', rec => rec.score >= 78],
  military: ['무사히 복무 마치기', '전역', () => true],
};
export function goalFor(s) {
  const p = s.player;
  let id = 'cfl';
  if (s.stage === 'hs') id = s.grade === 10 ? 'hsStart' : s.grade === 11 ? 'hsStar' : 'hsSenior';
  else if (s.stage === 'college') id = s.redshirt ? 'rs' : s.collegeYear <= 1 ? 'colStart' : 'colStar';
  else if (s.stage === 'nfl') id = s.proSeasons === 0 ? 'rookie' : p.ovr < 80 ? 'starter' : !countAwards(s, 'proBowl') ? 'pb' : 'ring';
  else if (s.stage === 'military') id = 'military';
  return { id, title: GOALS[id][0], hint: GOALS[id][1] };
}
const goalDone = (goal, rec) => !!(goal && GOALS[goal.id]?.[2](rec));

// ───────── 시즌 진행 ─────────
export function startSeason(s) {
  if (s.phase !== 'ready') throw Error('지금은 시즌을 시작할 수 없습니다.');
  s.todos = s.todos.filter(t => t.id !== 'turning');
  s.cardResult = null;
  if (s.stage === 'military') { militarySeason(s); return s; }
  s.programLines = applyProgram(s);
  startSeasonSim(s);
  s.autoBig = false; s.lastBig = null;
  s.phase = 'season';
  return advance(s);
}
// 다음 멈출 곳(선택 카드 · 빅게임 · 시즌 끝)까지 진행합니다.
export function advance(s) {
  if (s.phase !== 'season') return s;
  s.cardResult = null;
  const r = rng(s), z = s.season;
  while (z.seg < z.segments.length) {
    const [a, b] = z.segments[z.seg];
    for (let i = z.next ?? a; i < b; i++) {
      if (z.games[i].featured && !z.games[i].played && !s.autoBig) { z.next = i; return pauseBig(s, { ...z.games[i], idx: i }); }
      z.games[i] = playGame(s, r, z.games[i]);
    }
    z.next = undefined;
    reviewRole(s, r);
    const segIdx = z.seg++;
    if (z.cardPoints.includes(segIdx)) {
      const card = drawCard(s, r, segIdx);
      if (card) { s.card = card; s.phase = 'card'; return s; }
    }
  }
  if (!z.post.plan && !z.post.done) planPostseason(s, r);
  while (!z.post.done) {
    const g = nextPostGame(s, r);
    if (!s.autoBig) return pauseBig(s, g);
    resolvePostGame(s, r, playGame(s, r, g, g.round));
  }
  finishSeason(s);
  return s;
}
// 빅게임: 직접 플레이하거나 빠르게 넘길 수 있게 멈춥니다. 출전하지 못하는 역할이면 그냥 진행합니다.
function pauseBig(s, g) {
  s.bigGame = { ...g, myStr: s.season.teamStrength };
  s.phase = 'bigGame';
  return s;
}
export const canPlayBig = s => s.phase === 'bigGame' && !(s.season.injury?.out > 0) && !['practice', 'redshirt'].includes(s.season.role) && !(s.season.role === 'special' && s.stage === 'nfl');
// res가 있으면 직접 플레이 결과, 없으면 자동 시뮬레이션.
export function playBigGame(s, res = null) {
  if (s.phase !== 'bigGame') throw Error('지금은 빅게임이 없습니다.');
  const r = rng(s), z = s.season, g = s.bigGame;
  const played = res && canPlayBig(s) ? interactiveGame(s, r, g, res, g.post ? g.round : null) : playGame(s, r, g, g.post ? g.round : null);
  if (g.post) resolvePostGame(s, r, { ...played, final: g.final, round: g.round });
  else { z.games[g.idx] = { ...played, featured: true, title: g.title }; z.next = g.idx + 1; }
  s.lastBig = { ...played, title: g.title, round: g.round, final: g.final, post: !!g.post, champion: g.post && z.champion && z.post.done };
  s.bigGame = null; s.phase = 'season';
  return s.lastBig;
}
// 남은 빅게임을 모두 자동으로 (이번 시즌만).
export function autoRestOfSeason(s) { s.autoBig = true; if (s.phase === 'bigGame') playBigGame(s, null); return s; }
export function chooseCard(s, choiceId) {
  if (s.phase !== 'card' || !s.card) throw Error('선택할 카드가 없습니다.');
  const r = rng(s);
  s.cardResult = resolveCard(s, r, s.card, choiceId);
  s.card = null; s.phase = 'season';
  return s;
}

// ───────── 성장 ─────────
const BASE = { 15: 7.4, 16: 7.4, 17: 7.2, 18: 7.0, 19: 6.6, 20: 6.0, 21: 5.4, 22: 4.5, 23: 3.6, 24: 2.7, 25: 1.8, 26: 1.1, 27: .55, 28: .2 };
const MENTAL = new Set(['vis', 'poise', 'acc', 'route', 'cov', 'hand', 'kacc', 'cons', 'pblk', 'carry']);
const baseAt = (age, k) => { const a = MENTAL.has(k) ? age - 2 : ['spd', 'agi'].includes(k) ? age + 1 : age; return BASE[a] ?? (a < 15 ? 7.4 : 0); };
export const talentSpeed = p => Math.exp(.034 * (p.potential - 80));
export const talentLabel = p => p.potential >= 90 ? '매우 빠름' : p.potential >= 84 ? '빠름' : p.potential >= 74 ? '보통' : '느림';
function grow(s, r, rec) {
  const p = s.player, age = p.age, before = { ...p.attrs }, keys = attrsOf(p.pos), w = POSITIONS[p.pos].w;
  const tg = Math.max(1, rec.totalGames), play = .45 + .55 * clamp((rec.stats.gs + .45 * (rec.stats.g - rec.stats.gs)) / tg, 0, 1);
  const perf = rec.stats.g ? clamp(.84 + (rec.grade - 62) / 60, .72, 1.15) : (s.redshirt ? 1 : .8);
  const env = s.stage === 'hs' ? .94 + SCHOOL_BY_ID[s.team.id].prestige * .0009 : s.stage === 'college' ? .93 + COLLEGE_BY_ID[s.team.id].prestige * .0011 : s.stage === 'nfl' ? 1.05 : .95;
  const plan = s.training === 'intense' ? 1.12 : s.training === 'recovery' ? .86 : 1;
  const pro = s.stage === 'nfl' || s.stage === 'cfl', wall = p.wall && pro ? .55 : 1;
  const bonus = growthBonus(s);
  const lateAge = p.lateBloomer && age >= 22 && age <= 27 ? 2.5 : 0;
  const gains = {};
  for (const k of keys) {
    const focus = p.focus.includes(k) ? 1.5 * (s.training === 'intense' ? 1.12 : 1) * bonus.focus : .85;
    const room = clamp((99 - p.attrs[k]) / 40, 0, 1);
    const stall = r() < .22 ? .2 : 1;
    let g = baseAt(Math.round(age - lateAge), k) * talentSpeed(p) * play * perf * env * plan * focus * room * wall * bonus.mult * stall * (.6 + r() * .8);
    gains[k] = g;
  }
  // 급등: 시즌당 최대 하나.
  const breakoutP = s.stage === 'hs' ? .45 : s.stage === 'college' ? .3 : s.proSeasons <= 3 ? .18 : age < 29 ? (p.lateBloomer ? .14 : .05) : 0;
  let breakout = null;
  if (r() < breakoutP * (p.wall && pro ? .5 : 1)) {
    const k = weighted(r, keys.map(k => [k, (p.focus.includes(k) ? 2 : 1) * w[k] * clamp((99 - p.attrs[k]) / 40, 0, 1)]));
    if (k) { gains[k] += 3.5 + r() * 3.5; breakout = k; }
  }
  // 노쇠: 포지션별 전성기 이후 신체 능력부터 떨어집니다.
  const peak = POSITIONS[p.pos].peak + (p.agingRate < .95 ? 1 : p.agingRate > 1.15 ? -1 : 0), yrs = age - peak + 1;
  if (yrs > 0) {
    const nut = declineFactor(s);
    for (const k of keys) {
      const loss = (.9 + r() * 1.6) * Math.pow(yrs, .72) * p.agingRate * nut * (MENTAL.has(k) ? .35 : 1) * (['K', 'P'].includes(p.pos) ? .6 : 1);
      gains[k] -= loss;
    }
  }
  for (const inj of rec.injuries || []) if (inj.major) for (const k of keys) if (!MENTAL.has(k)) gains[k] -= 1 + r() * 1.5;
  for (const k of keys) p.attrs[k] = clamp(Math.round(p.attrs[k] + gains[k]), 15, 99);
  // 투웨이 선수는 반대쪽 포지션도 조금 자랍니다.
  if (p.twoWay) {
    for (const k of attrsOf(p.twoWay.pos)) p.twoWay.attrs[k] = clamp(Math.round((p.attrs[k] ?? p.twoWay.attrs[k]) * .5 + p.twoWay.attrs[k] * .5 + (yrs > 0 ? -1 : 1.2)), 15, 99);
    p.twoWay.ovr = overall(p.twoWay.pos, p.twoWay.attrs);
  }
  const ovrBefore = p.ovr;
  p.ovr = overall(p.pos, p.attrs);
  p.peak = Math.max(p.peak, p.ovr);
  const changes = Object.fromEntries(keys.map(k => [k, p.attrs[k] - before[k]]));
  const crossed = TIERS.filter(([v]) => ovrBefore < v && p.ovr >= v).map(([, l]) => l);
  return { before, changes, breakout, crossed };
}

// ───────── 시즌 종료 ─────────
function finishSeason(s) {
  const r = rng(s), z = s.season, p = s.player;
  const totalGames = z.games.length + z.post.rounds.length;
  const L = z.line, grade = L.g ? round1(L.gradeSum / L.g) : 0;
  const rec = {
    year: s.year, age: p.age, stage: s.stage, level: z.level, label: seasonLabel(s), teamId: s.team.id, teamName: s.team.name, pos: p.pos,
    role: z.role, startRole: z.startRole, roleName: roleName(s, z.role), stats: { ...L }, grade, totalGames, team: { w: L.w, l: L.l },
    post: z.post.result, postRounds: z.post.rounds.map(g => ({ round: g.round, opp: g.oppName, res: g.res, pf: g.pf, pa: g.pa, grade: g.grade })),
    champion: !!z.champion, finalGrade: z.final?.grade ?? null, injuries: z.injuries, ovrBefore: p.ovr, attrsBefore: { ...p.attrs },
    redshirt: s.redshirt, twoWay: p.twoWay ? p.twoWay.pos : null, salary: s.contract?.aav || 0, seed: z.seed || null,
  };
  rec.score = seasonScore(p.pos, L, L.g, totalGames, L.w, s.stage);
  const A = s.stage === 'hs' ? hsAwards(s, r, rec) : s.stage === 'college' ? collegeAwards(s, r, rec) : s.stage === 'cfl' ? cflAwards(s, r, rec) : nflAwards(s, r, rec);
  rec.awards = [...A.awards, ...(s.pendingAwards || [])]; rec.race = A.race; s.pendingAwards = [];
  // 첫 기록들
  if (L.g) first(s, `g:${s.stage}`, s.stage === 'nfl' ? `${s.team.name} 소속으로 NFL 데뷔전을 치렀습니다.` : s.stage === 'college' ? `${s.team.name} 유니폼을 입고 대학 무대 데뷔.` : s.stage === 'cfl' ? 'CFL 데뷔전.' : '바시티 데뷔전을 치렀습니다.');
  const td = L.ptd + L.rtd + L.rectd + L.dtd;
  if (td && s.stage === 'nfl') first(s, 'nflTD', 'NFL 첫 터치다운.');
  if (L.sack && s.stage === 'nfl') first(s, 'nflSack', 'NFL 첫 색.');
  if (L.dint && s.stage === 'nfl') first(s, 'nflInt', 'NFL 첫 인터셉트.');
  if (L.gs >= 1 && s.stage === 'nfl') first(s, 'nflStart', 'NFL 첫 선발 출전.');
  if ((L.recyds >= 1000 || L.ryds >= 1000) && s.stage === 'nfl') first(s, 'nfl1000', '첫 1,000야드 시즌.');
  for (const a of rec.awards) if (['mvp', 'heisman', 'allPro1', 'dpoy', 'opoy', 'sbMVP', 'oroy', 'droy'].includes(a.kind) || (a.kind === 'proBowl' && !countAwards(s, 'proBowl'))) moment(s, 'award', a.name.replace(/^\d{4} /, ''));
  if (rec.champion) moment(s, 'title', `${rec.post}! ${s.team.name}의 정상.`);
  for (const inj of rec.injuries.filter(x => x.major)) moment(s, 'injury', `${inj.kind}. 긴 재활이 시작됩니다.`);
  if (rec.injuries.some(x => x.major)) s.flags.push('comeback'); else if (rec.stats.g >= 8) s.flags = s.flags.filter(f => f !== 'comeback');
  // 성장
  const gr = grow(s, r, rec);
  rec.ovrAfter = p.ovr; rec.attrsAfter = { ...p.attrs }; rec.changes = gr.changes; rec.breakout = gr.breakout; rec.crossed = gr.crossed;
  // 목표
  rec.goal = s.goal ? { title: s.goal.title, hint: s.goal.hint, done: goalDone(s.goal, rec) } : null;
  if (s.redshirt) { s.redshirtUsed = true; moment(s, 'redshirt', `${s.year}년 레드셔트 시즌. 출전 자격 1년을 아꼈습니다.`); }
  // 돈
  const income = seasonIncome(s, rec);
  rec.income = income; s.money += income.net;
  rec.fees = staffFees(s); s.money = Math.max(0, s.money - rec.fees);
  // 소셜
  rec.social = socialSeason(s, r, rec);
  // 팀별 시즌 수
  if (s.stage === 'nfl') { s.teamSeasons[s.team.id] = (s.teamSeasons[s.team.id] || 0) + 1; s.proSeasons++; }
  if (s.stage === 'cfl') s.proSeasons++;
  if (s.contract) s.contract.yearsLeft = Math.max(0, s.contract.yearsLeft - 1);
  // 관계 수치는 조금씩 중립으로.
  for (const k of ['trust', 'locker', 'media', 'front']) s.meters[k] = Math.round(50 + (s.meters[k] - 50) * .8);
  s.meters.body = clamp(s.meters.body - (s.training === 'recovery' ? 1 : 0), 0, 10);
  s.seasonMods = { playing: 0, perf: 0, injury: 0 };
  s.hot = rec.champion || rec.awards.some(a => a.pts >= 10) ? 1 : 0; // 좋은 시즌은 다음 시즌 자신감으로
  s.history.push(rec);
  s.lastSeason = { ...z, games: z.games.map(g => ({ wk: g.wk, oppName: g.oppName, home: g.home, res: g.res, pf: g.pf, pa: g.pa, grade: g.grade, injury: g.injury || null, line: g.line })) };
  s.season = null;
  s.todos = s.todos.filter(t => !['report', 'broadcast', 'turning', 'interview', 'olympics'].includes(t.id) || (t.id === 'olympics' && !t.seen));
  s.todos.unshift({ id: 'report', year: rec.year, seen: false });
  if (z.final) { s.todos.splice(1, 0, { id: 'broadcast', year: rec.year, seen: false }); rec.broadcast = z.final; }
  const iv = interviewFor(rec);
  if (iv && (rec.champion || rec.awards.some(a => a.pts >= 10) || r() < .55)) s.todos.push({ id: 'interview', year: rec.year, seen: false, ...iv });
  const turn = turningPoint(s, r, rec);
  if (turn) s.todos.push({ id: 'turning', year: rec.year, seen: false, ...turn });
  refreshStock(s, r);
  s.todos = s.todos.filter(t => t.id !== 'shop');
  s.todos.push({ id: 'shop', year: rec.year, seen: false });
  s.phase = 'offseason';
  s.path = offseasonPath(s, r, rec);
  return rec;
}
export function seasonLabel(s) {
  if (s.stage === 'hs') return `${s.grade}학년`;
  if (s.stage === 'college') return `대학 ${s.collegeYear}학년${s.redshirt ? ' (레드셔트)' : ''}`;
  if (s.stage === 'nfl') return `NFL ${s.proSeasons + 1}년 차`;
  if (s.stage === 'cfl') return 'CFL';
  return '';
}
function seasonIncome(s, rec) {
  if (s.stage === 'hs') return { kind: '용돈·아르바이트', gross: 300, net: 300 };
  if (s.stage === 'college') {
    const c = COLLEGE_BY_ID[s.team.id], stars = s.recruiting?.stars || 2;
    const nil = Math.round((s.followers / 1000 * 160 + [0, 2e3, 8e3, 25e3, 90e3, 300e3][stars] * (c.prestige / 80) + Math.max(0, rec.score - 70) * 9000 * (c.prestige / 80)) * (rec.awards.some(a => a.kind === 'heisman') ? 2.2 : 1));
    return { kind: 'NIL 수입', gross: clamp(nil, 1000, 4.5e6), net: Math.round(clamp(nil, 1000, 4.5e6) * .7) };
  }
  if (s.stage === 'military') return { kind: '병사 월급', gross: 6000, net: 6000 };
  const aav = s.contract?.aav || MIN_SALARY;
  const bonus = rec.awards.reduce((n, a) => n + (a.kind === 'proBowl' ? 250e3 : a.kind === 'allPro1' ? 500e3 : a.kind === 'mvp' ? 1e6 : a.kind === 'sbChamp' ? 178e3 : 0), 0);
  return { kind: s.stage === 'cfl' ? 'CFL 연봉' : '연봉', gross: aav + bonus, net: Math.round((aav + bonus) * .6) };
}

// ───────── 전환점 (시즌 뒤 가끔) ─────────
function turningPoint(s, r, rec) {
  const p = s.player;
  if (s.phase === 'retired' || s.stage === 'military') return null;
  const opts = [];
  // 포지션 전환: 같은 능력치로 OVR이 더 높은 자리.
  const alt = POS_ORDER.filter(x => x !== p.pos && !['K', 'P'].includes(x) && !['K', 'P'].includes(p.pos)).map(x => [x, ovrAs(p.attrs, x)]).sort((a, b) => b[1] - a[1])[0];
  if (alt && alt[1] >= p.ovr + 3 && r() < .45) opts.push({ kind: 'position', title: '더 잘 맞는 포지션을 찾았어요', body: `코치진이 회의 끝에 ${POSITIONS[alt[0]].ko}(${alt[0]}) 전환을 제안했습니다. 지금 능력치로 보면 그 자리의 OVR은 ${alt[1]}입니다.`, to: alt[0], toOvr: alt[1],
    options: [{ id: 'accept', label: `${RO(POSITIONS[alt[0]].ko)} 전환한다`, desc: `OVR ${p.ovr} → ${alt[1]}. 새 포지션의 경쟁 구도에서 다시 출발합니다.` }, { id: 'stay', label: `${POSITIONS[p.pos].ko}${josa(POSITIONS[p.pos].ko, '을', '를')} 지킨다`, desc: '익숙한 자리에서 신뢰를 쌓습니다. 감독 신뢰 +3' }] });
  // 투웨이 (오타니처럼 공수 겸업): WR↔CB, RB↔S
  const pair = { WR: 'CB', CB: 'WR', RB: 'S', S: 'RB' }[p.pos];
  if (pair && !p.twoWay && ['hs', 'college'].includes(s.stage) && (s.flags.includes('twoWayTry') || r() < .12)) {
    const o = ovrAs(p.attrs, pair);
    if (o >= p.ovr - 9) opts.push({ kind: 'twoWay', title: '공수 겸업, 해 볼래?', body: `수비·공격 코디네이터가 함께 찾아왔습니다. ${RO(POSITIONS[pair].ko)}도 뛸 수 있겠다는 겁니다. 반대쪽 OVR은 지금 ${o}. 출전 시간과 기록은 늘지만, 몸은 두 배로 힘듭니다.`, to: pair, toOvr: o,
      options: [{ id: 'accept', label: '투웨이 선수가 된다', desc: '양쪽에서 기록이 쌓이고 수상 경쟁에 유리합니다. 부상 위험 증가.' }, { id: 'stay', label: '한 포지션에 집중한다', desc: '집중 육성 능력치 성장 유지. 감독 신뢰 +2' }] });
  }
  // 숨은 재능 (잠재력 확장)
  if (p.age <= 24 && r() < .16) opts.push({ kind: 'potential', title: '코치가 본 숨은 재능', body: '오프시즌 개인 훈련을 지켜본 코치가 "아직 안 써 본 근육이 있다"며 새 훈련 프로그램을 권합니다.',
    options: [{ id: 'accept', label: '새 프로그램에 도전한다', desc: '성장 속도가 빨라질 수 있지만 몸에 부담이 남습니다.' }, { id: 'stay', label: '하던 대로 강점을 다진다', desc: '집중 육성 능력치 +1, 감독 신뢰 +3' }] });
  // 육성 방향 전환
  if (r() < .14) opts.push({ kind: 'focus', title: '육성 방향을 바꿔 볼까요?', body: '시즌을 돌아본 코치가 집중 육성 능력치를 다시 정해 보자고 합니다. 최대 2개까지 고를 수 있습니다.',
    options: [{ id: 'choose', label: '새로 고른다', desc: '고른 능력치가 다음 시즌부터 빨리 자랍니다.' }, { id: 'stay', label: '지금대로 간다', desc: '변화 없음' }] });
  return opts.length ? pick(r, opts) : null;
}
export function chooseTurning(s, optionId, extra = {}) {
  const t = s.todos.find(x => x.id === 'turning' && !x.done);
  if (!t) throw Error('전환점이 없습니다.');
  const p = s.player, r = rng(s);
  let text = '';
  if (t.kind === 'position' && optionId === 'accept') {
    const from = p.pos; p.attrs = convertAttrs(p.attrs, t.to); p.pos = t.to; p.ovr = overall(p.pos, p.attrs);
    p.focus = p.focus.filter(k => p.attrs[k] !== undefined); if (!p.focus.length) p.focus = ARCHETYPES[p.pos][0][2].slice(0, 2);
    text = `${POSITIONS[from].ko}에서 ${RO(POSITIONS[p.pos].ko)} 전환했습니다. 새 OVR ${p.ovr}.`; moment(s, 'turn', text);
  } else if (t.kind === 'twoWay' && optionId === 'accept') {
    const attrs = convertAttrs(p.attrs, t.to); p.twoWay = { pos: t.to, attrs, ovr: overall(t.to, attrs) };
    text = `${WA(POSITIONS[p.pos].ko)} ${POSITIONS[t.to].ko}${josa(POSITIONS[t.to].ko, '을', '를')} 오가는 투웨이 선수가 됐습니다.`; moment(s, 'turn', text);
  } else if (t.kind === 'potential' && optionId === 'accept') {
    const ok = r() < .65; p.potential = clamp(p.potential + (ok ? 4 : 1), 60, 99); s.meters.body = clamp(s.meters.body + 1, 0, 10);
    text = ok ? '새 프로그램이 몸에 맞았습니다. 성장 속도가 눈에 띄게 빨라질 것 같습니다.' : '적응이 쉽지 않았지만 조금은 얻은 것이 있습니다. 몸이 무겁습니다.';
  } else if (t.kind === 'focus' && optionId === 'choose') {
    const keys = (extra.focus || []).filter(k => p.attrs[k] !== undefined).slice(0, 2);
    if (!keys.length) throw Error('능력치를 하나 이상 고르세요.');
    p.focus = keys; text = `집중 육성: ${keys.map(k => ATTR[k][0]).join(', ')}`;
  } else {
    if (t.kind === 'potential') { const k = p.focus[0]; p.attrs[k] = clamp(p.attrs[k] + 1, 15, 99); p.ovr = overall(p.pos, p.attrs); }
    s.meters.trust = clamp(s.meters.trust + (t.kind === 'twoWay' ? 2 : 3), 0, 100);
    text = '지금의 방향을 지키기로 했습니다.';
  }
  t.done = true; t.seen = true; t.result = text;
  s.flags = s.flags.filter(f => f !== 'twoWayTry');
  return text;
}

// ───────── 리크루팅 ─────────
export function recruitProfile(s) {
  const p = s.player, sc = SCHOOL_BY_ID[s.team.id];
  const best = Math.max(0, ...s.history.filter(h => h.stage === 'hs').map(h => h.score));
  const exposure = (sc.prestige - 75) * .08 + (s.flags.includes('campStar') ? 2.5 : 0) + (s.flags.includes('exposure') ? 1.2 : 0) + (s.meters.media - 50) * .03;
  const v = p.ovr + (best - 70) * .18 + exposure + (p.pos === 'QB' ? .8 : 0) - (['K', 'P'].includes(p.pos) ? 6 : 0);
  const stars = v >= 64 ? 5 : v >= 58 ? 4 : v >= 51 ? 3 : v >= 45 ? 2 : 1;
  const rank = stars === 5 ? clamp(Math.round(33 - (v - 64) * 6), 1, 32) : stars === 4 ? clamp(Math.round(360 - (v - 58) * 54), 33, 360) : stars === 3 ? clamp(Math.round(1500 - (v - 51) * 160), 361, 1500) : null;
  return { stars, rank, value: round1(v) };
}
function collegeOffers(s, r, prof) {
  const v = prof.value;
  const fit = c => { const need = c.tier === 'P4' ? 47 + c.prestige * .14 : c.tier === 'G5' ? 44 + c.prestige * .09 : c.tier === 'FCS' ? 41 : 20; return v + gauss(r) * 2.2 - need; };
  let list = COLLEGES.filter(c => c.tier !== 'JUCO').map(c => [c, fit(c)]).filter(([, f]) => f >= 0).sort((a, b) => b[0].prestige - a[0].prestige);
  const max = prof.stars >= 5 ? 9 : prof.stars === 4 ? 7 : prof.stars === 3 ? 5 : 3;
  list = list.filter(() => r() < .75).slice(0, max).map(([c]) => c);
  if (s.recruiting?.committed && !list.find(c => c.id === s.recruiting.committed) && prof.stars >= (s.recruiting.starsAtCommit || 1) - 1) list.unshift(COLLEGE_BY_ID[s.recruiting.committed]);
  return list.map(c => ({ id: c.id, name: c.ko, conf: c.conf, tier: c.tier, prestige: c.prestige, depth: collegeDepthPreview(s, c) }));
}
function collegeDepthPreview(s, c) {
  const avg = 46 + c.prestige * .24, diff = s.player.ovr + 6 - avg; // 1년 성장 감안
  return diff >= 4 ? '1학년부터 주전 경쟁' : diff >= -1 ? '로테이션 출발' : diff >= -6 ? '백업에서 출발' : '레드셔트 가능성 높음';
}

// ───────── 오프시즌 진로 ─────────
function offseasonPath(s, r, rec) {
  const p = s.player;
  if (s.stage === 'hs') {
    if (s.grade === 10) {
      const opts = [{ id: 'advance', label: '11학년 진급', sub: s.team.name, desc: '같은 학교에서 주니어 시즌을 준비합니다. 리크루팅이 본격적으로 시작되는 해입니다.' }];
      const up = HIGH_SCHOOLS.filter(h => h.prestige > SCHOOL_BY_ID[s.team.id].prestige + 8 && h.prestige <= 50 + p.ovr * .8).sort(() => r() - .5).slice(0, s.flags.includes('transferOffer') ? 2 : p.ovr >= 54 ? 1 : 0);
      for (const h of up) opts.push({ id: `transfer:${h.id}`, label: `${RO(h.ko)} 전학`, sub: `${h.city} · 명문`, desc: '스카우트 노출이 크게 늘지만 주전 경쟁은 더 치열합니다.' });
      return { kind: 'hs', title: '다음 진로', desc: '시즌을 지켜본 코치와 주변 학교에서 연락이 왔어요.', options: opts };
    }
    if (s.grade === 11) {
      const prof = recruitProfile(s); s.recruiting = { ...(s.recruiting || {}), ...prof, offers: collegeOffers(s, r, prof) };
      moment(s, 'recruit', `리크루팅 평가 ${'★'.repeat(prof.stars)}${prof.rank ? ` · 전국 ${prof.rank}위` : ''}.`);
      const opts = s.recruiting.offers.map(o => ({ id: `commit:${o.id}`, label: `${o.name} 구두 커밋`, sub: `${o.conf} · ${o.depth}`, desc: '지금 마음을 정하면 12학년 시즌을 홀가분하게 치릅니다. 크게 부진하면 오퍼가 철회될 수도 있습니다.', college: o.id }));
      opts.push({ id: 'wait', label: '커밋하지 않고 12학년 시즌을 본다', sub: '더 큰 오퍼를 노린다', desc: '시니어 시즌 활약에 따라 오퍼가 늘 수도, 줄 수도 있습니다.' });
      return { kind: 'recruit', title: `장학금 오퍼 ${s.recruiting.offers.length}곳`, desc: `리크루팅 평가 ${'★'.repeat(prof.stars)}${prof.rank ? ` · 전국 ${prof.rank}위` : ''}. 대학 코치들이 연락을 시작했어요.`, options: opts };
    }
    // 12학년 끝: 사인
    const prof = recruitProfile(s), offers = collegeOffers(s, r, prof);
    s.recruiting = { ...(s.recruiting || {}), ...prof, offers };
    const opts = offers.map(o => ({ id: `sign:${o.id}`, label: `${o.name} 입학`, sub: `${o.conf} · ${o.depth}${s.recruiting.committed === o.id ? ' · 커밋한 학교' : ''}`, desc: '전액 장학금. 내셔널 사이닝 데이에 사인합니다.', college: o.id, badge: s.recruiting.committed === o.id ? '커밋' : null }));
    const walk = COLLEGES.filter(c => c.tier === 'P4' && !offers.find(o => o.id === c.id)).sort((a, b) => b.prestige - a.prestige).slice(0, 12);
    const w = pick(r, walk);
    if (w) opts.push({ id: `walkon:${w.id}`, label: `${w.ko} 워크온`, sub: '장학금 없이 입단 · 백업·스카우트 팀 출발', desc: '명문에서 바닥부터 시작합니다. 장학금은 활약하면 나중에 받을 수 있습니다.', college: w.id });
    opts.push({ id: 'sign:EMCC', label: '전문대(JUCO) 진학', sub: '이스트미시시피 · 1~2년 뒤 4년제 편입', desc: 'JUCO에서 기록을 쌓고 다시 리크루팅을 받습니다.', college: 'EMCC' });
    return { kind: 'signing', title: '내셔널 사이닝 데이', desc: `최종 평가 ${'★'.repeat(prof.stars)}${prof.rank ? ` · 전국 ${prof.rank}위` : ''}. 어디서 대학 풋볼을 할까요?`, options: opts };
  }
  if (s.stage === 'college') return collegePath(s, r);
  if (s.stage === 'nfl') return nflPath(s, r, rec);
  if (s.stage === 'cfl') return cflPath(s, r);
  return null;
}
function draftEligible(s) { return s.collegeYear >= 3 || s.player.age >= 20; }
function eligibilityLeft(s) { return (s.redshirtUsed ? 5 : 4) - s.collegeYear; }
function collegePath(s, r) {
  const left = eligibilityLeft(s), c = COLLEGE_BY_ID[s.team.id], proj = draftProjection(s);
  const opts = [];
  if (left > 0) opts.push({ id: 'stay', label: `${c.ko} 잔류`, sub: `대학 ${s.collegeYear + 1}학년 · 남은 출전 자격 ${left}년`, desc: '같은 팀에서 다음 시즌을 준비합니다.' });
  if (draftEligible(s) || left <= 0) opts.push({ id: 'declare', label: 'NFL 드래프트 참가 선언', sub: `예상: ${proj.label}`, desc: '컴바인을 거쳐 드래프트에 나갑니다. 지명받지 못하면 언드래프티 FA가 됩니다.', badge: proj.round && proj.round <= 2 ? '추천' : null });
  if (left > 0) {
    const offers = portalOffers(s, r);
    for (const o of offers) opts.push({ id: `portal:${o.id}`, label: `트랜스퍼 포털 → ${o.ko}`, sub: `${o.conf} · ${collegeDepthPreview(s, o)}`, desc: '바로 다음 시즌부터 뛸 수 있습니다. 새 팀에서 신뢰를 다시 쌓아야 합니다.', college: o.id });
  }
  if (left <= 0 && proj.round === null) opts.push({ id: 'cfl', label: 'CFL 도전', sub: '캐나다 프로풋볼', desc: 'NFL 문이 좁다면 캐나다에서 프로 생활을 시작합니다.' });
  if (left <= 0) opts.push({ id: 'retire', label: '풋볼을 내려놓는다', sub: '대학 졸업과 함께', desc: '학위를 들고 다른 인생을 시작합니다.' });
  return { kind: 'college', title: left > 0 ? '다음 진로' : '대학 생활의 끝', desc: left > 0 ? '시즌을 마친 지금, 남을지·떠날지·프로에 갈지 정할 때입니다.' : '출전 자격을 모두 썼습니다. 이제 프로에 도전할 차례입니다.', options: opts, proj };
}
function portalOffers(s, r) {
  const v = s.player.ovr + (s.history.at(-1)?.score - 70) * .15;
  const cur = COLLEGE_BY_ID[s.team.id];
  return COLLEGES.filter(c => c.id !== cur.id && c.tier !== 'JUCO' && (46 + c.prestige * .24) <= v + 2 && c.prestige >= cur.prestige - 10).sort(() => r() - .5).slice(0, s.history.at(-1)?.score >= 80 ? 3 : 2);
}
export function draftProjection(s) {
  const p = s.player, posAdj = { QB: 3, EDGE: 1.5, OL: 1, CB: 1, WR: .5, DT: .5, RB: -2, TE: -1, S: -1, LB: -1, K: -7, P: -8 }[p.pos];
  const col = s.history.filter(h => h.stage === 'college'), last = col.at(-1);
  const honor = col.reduce((n, h) => n + h.awards.reduce((m, a) => m + a.pts, 0), 0);
  const tierAdj = { P4: 0, G5: -1.5, FCS: -3, JUCO: -4 }[COLLEGE_BY_ID[s.team.id]?.tier] ?? 0;
  const v = p.ovr + posAdj + Math.min(4, honor * .12) + ((last?.score || 65) - 72) * .12 + tierAdj - Math.max(0, p.age - 22) * .8 + (s.flags.includes('seniorBowl') ? 1.5 : 0) + (s.flags.includes('interviewAce') ? 1 : 0);
  const pickN = v >= 84 ? 1 + Math.round((88 - Math.min(88, v)) * 1.2) : v >= 63 ? Math.round(5 + Math.pow(84 - v, 1.9) * .9) : 999;
  const pk = clamp(pickN, 1, 999);
  const round = pk <= 257 ? Math.min(7, Math.ceil(pk / 32)) : null;
  const label = round === null ? '지명 어려움 (언드래프티 예상)' : round === 1 ? (pk <= 10 ? '1라운드 톱10' : '1라운드') : `${round}라운드`;
  return { value: round1(v), pick: pk, round, label };
}
function combine(s, r) {
  const p = s.player, a = k => p.attrs[k] ?? p.ovr;
  const size = { QB: .22, RB: .05, WR: 0, TE: .28, OL: .7, DT: .62, EDGE: .25, LB: .18, CB: -.02, S: .05, K: .5, P: .55 }[p.pos];
  return {
    forty: Math.round(clamp(4.24 + (99 - (p.attrs.spd ?? p.attrs.agi ?? 55)) * .011 + size + gauss(r) * .04 - (s.flags.includes('combinePrep') ? .05 : 0), 4.21, 5.6) * 100) / 100,
    bench: Math.round(clamp(8 + ((p.attrs.str ?? 50) - 40) * .45 + (['OL', 'DT'].includes(p.pos) ? 8 : 0) + gauss(r) * 2, 4, 45)),
    vertical: round1(clamp(27 + ((p.attrs.agi ?? p.attrs.spd ?? 55) - 50) * .22 - size * 8 + gauss(r), 22, 44)),
    broad: Math.round(clamp(105 + ((p.attrs.spd ?? 55) - 50) * .5 - size * 16 + gauss(r) * 3, 90, 140)),
    cone: Math.round(clamp(7.4 - ((p.attrs.agi ?? 55) - 50) * .012 + size * .6 + gauss(r) * .05, 6.5, 8.2) * 100) / 100,
  };
}
// 드래프트 순서: 지난 시즌 전력 역순(+약간의 운).
function draftOrder(s, r) { return [...TEAMS].map(t => [t.id, teamPower(s.league, t.id) + gauss(r) * 6]).sort((a, b) => a[1] - b[1]).map(x => x[0]); }
function runDraft(s, r) {
  const proj = draftProjection(s), cmb = combine(s, r);
  const combineAdj = (4.6 - cmb.forty) * (['OL', 'DT', 'K', 'P'].includes(s.player.pos) ? 1 : 6) + (cmb.vertical - 33) * .08;
  let pk = proj.pick === 999 ? 999 : Math.round(proj.pick * Math.exp(-combineAdj * .12) * (.8 + r() * .45));
  if (proj.pick !== 999 && proj.value + combineAdj >= 62.5 && pk > 257) pk = 240 + Math.floor(r() * 17);
  const order = draftOrder(s, r);
  if (pk > 257) return { year: s.year + 1, combine: cmb, proj, drafted: false };
  pk = clamp(pk, 1, 257);
  const round = Math.min(7, Math.ceil(pk / 32)), team = order[(pk - 1) % 32];
  return { year: s.year + 1, combine: cmb, proj, drafted: true, pick: pk, round, inRound: pk - (round - 1) * 32, team };
}
export function rookieContract(pick) {
  const aav = Math.round(MIN_SALARY + 10.8e6 * Math.exp(-(pick - 1) / 20));
  return { years: 4, total: aav * 4, aav, guaranteed: pick <= 64 ? aav * 4 * (pick <= 32 ? 1 : .6) : aav * .3, option5: pick <= 32 };
}
const POS_MARKET = { QB: 56e6, WR: 41e6, EDGE: 41e6, DT: 36e6, OL: 30e6, CB: 30e6, S: 21e6, LB: 21e6, RB: 20e6, TE: 20e6, K: 6.5e6, P: 4.2e6 };
export function marketValue(s, ovr = s.player.ovr, age = s.player.age) {
  const pos = s.player.pos, f = Math.pow(clamp((ovr - 64) / 31, 0, 1.1), 1.8);
  const ageF = age > 30 ? Math.pow(.86, age - 30) : 1;
  return Math.round(Math.max(MIN_SALARY + 100e3 * Math.min(6, s.proSeasons), POS_MARKET[pos] * f * ageF));
}
const ROLE_PAY = { key: 1.12, starter: 1, rotation: .55, backup: .28, special: .14, practice: 0, redshirt: .14 };
function expectedRole(s, teamId) {
  const inc = depth(s.league, teamId, s.player.pos).map(x => x[2]);
  return computeRole({ ...s, redshirt: false, meters: { ...s.meters, trust: 50 }, seasonMods: { playing: 0 }, team: { id: teamId }, contract: null }, () => .5, inc);
}
function nflOffer(s, r, teamId, kind = 'fa') {
  const role = expectedRole(s, teamId), age = s.player.age, mv = marketValue(s) * agentBoost(s);
  const aav = Math.max(MIN_SALARY + 100e3 * Math.min(6, s.proSeasons), Math.round(mv * ROLE_PAY[role] * (.88 + r() * .25)));
  const years = age <= 27 ? 3 + Math.floor(r() * 3) : age <= 31 ? 2 + Math.floor(r() * 2) : 1 + Math.floor(r() * 2);
  const gtd = ['key', 'starter'].includes(role) ? .45 + r() * .2 : .15;
  const t = TEAM_BY_ID[teamId], pw = teamPower(s.league, teamId);
  return { teamId, teamName: t.ko, role, roleName: roleName({ stage: 'nfl' }, role), aav, years, total: aav * years, guaranteed: Math.round(aav * years * gtd), power: pw, contender: contenderLabel(pw), kind };
}
function offerOption(o, prefix = 'sign') {
  return { id: `${prefix}:${o.teamId}`, label: `${o.teamName}`, sub: `${o.roleName} 제안 · ${o.years}년 ${usd(o.total)} (연 ${usd(o.aav)})`, desc: `보장 ${usd(o.guaranteed)} · 팀 전력 ${o.contender}`, offer: o, badge: o.kind === 'resign' ? '재계약' : o.kind === 'tag' ? '프랜차이즈 태그' : null };
}
function faOffers(s, r, { exclude = [] } = {}) {
  const teams = TEAMS.map(t => t.id).filter(id => !exclude.includes(id)).sort(() => r() - .5);
  const p = s.player, interest = clamp((p.ovr - 66) / 20, .02, .85) * (p.age >= 34 ? .35 : p.age >= 31 ? .6 : 1);
  const out = [];
  for (const id of teams.slice(0, 16)) { if (out.length >= 5) break; if (r() < interest) { const o = nflOffer(s, r, id); if (o.role !== 'practice' && !(o.role === 'special' && p.age >= 30)) out.push(o); } }
  return out.sort((a, b) => b.aav - a.aav);
}
function nflPath(s, r, rec) {
  const p = s.player, c = s.contract, opts = [], mv = marketValue(s);
  const retireHint = p.age >= 36 || (p.ovr < 66 && p.age >= 30);
  // 방출 판정: 연습생·스페셜팀으로 시즌을 마쳤고 보장 금액이 없으면.
  const cut = c && c.yearsLeft > 0 && c.type !== 'tag' && (['practice', 'special'].includes(rec.role) || (rec.role === 'backup' && p.age >= 29)) && (c.type !== 'rookie' || c.round >= 4 || !c.round) && r() < (p.age >= 29 ? .6 : p.age >= 26 ? .5 : .3);
  if (cut) { moment(s, 'cut', `${s.team.name}에서 방출됐습니다.`); s.contract = null; return faPath(s, r, '방출 통보', `${I(s.team.name)} 로스터 정리 과정에서 방출을 알려 왔습니다.`); }
  if (s.flags.includes('enlist')) {
    s.flags = s.flags.filter(f => f !== 'enlist');
    return { kind: 'military', title: '입대 영장', desc: '귀국해 입대하기로 한 약속의 시간이 왔습니다. 구단은 계약을 정지합니다.', options: [{ id: 'military', label: '입대한다', sub: '현역 · 2시즌', desc: '복무를 마치면 FA로 돌아옵니다.' }] };
  }
  if (c && c.yearsLeft > 0) {
    opts.push({ id: 'stay', label: `${s.team.name}에서 다음 시즌`, sub: `계약 ${c.yearsLeft}년 남음 · 연 ${usd(c.aav)}`, desc: '계약대로 다음 시즌을 준비합니다.' });
    if (s.proSeasons >= 3 && p.ovr >= 76 && c.aav < mv * .8) opts.push({ id: 'extend', label: '연장 계약 협상 요청', sub: `시장 가치 약 연 ${usd(mv)}`, desc: '구단 관계와 최근 활약에 따라 성사 여부가 갈립니다.' });
    if (p.ovr >= 82 && c.aav < mv * .5) opts.push({ id: 'holdout', label: '홀드아웃', sub: '훈련 캠프 불참으로 압박', desc: '성공하면 큰 계약, 실패하면 벌금과 신뢰 하락. 시즌 초반을 날릴 수 있습니다.', badge: '위험' });
    if (p.ovr >= 72) opts.push({ id: 'trade', label: '트레이드 요청', sub: '새 팀에서 다시 시작', desc: '구단 관계가 나쁘면 거절당할 수 있습니다.' });
    if (retireHint) opts.push({ id: 'retire', label: '은퇴', sub: '여기서 마침표', desc: '커리어를 마무리하고 은퇴 기록을 남깁니다.' });
    return { kind: 'nfl', title: '오프시즌', desc: c.option5 && s.proSeasons === 3 ? `${I(s.team.name)} 5년 차 옵션 행사 여부를 검토 중입니다.` : '다음 시즌을 어떻게 준비할까요?', options: opts };
  }
  return faPath(s, r, '계약 만료', `${WA(s.team.name)}의 계약이 끝났습니다. FA 시장이 열렸어요.`);
}
function faPath(s, r, title, desc) {
  const p = s.player, opts = [], last = s.history.at(-1);
  const prevTeam = s.team?.kind === 'nfl' ? s.team.id : null;
  if (prevTeam && last && last.stats.g >= 8 && last.score >= 66 && p.age <= 35 && (!s.contract || s.contract.yearsLeft === 0) && title === '계약 만료') {
    const o = nflOffer(s, r, prevTeam, 'resign'); o.aav = Math.round(o.aav * (1 + (s.meters.front - 50) * .003)); o.total = o.aav * o.years; opts.push(offerOption(o));
    if (p.ovr >= 85 && r() < .5) { const tag = { ...o, kind: 'tag', years: 1, aav: Math.round(POS_MARKET[p.pos] * .82), roleName: o.roleName }; tag.total = tag.aav; tag.guaranteed = tag.aav; opts.push(offerOption(tag, 'tag')); }
  }
  for (const o of faOffers(s, r, { exclude: prevTeam ? [prevTeam] : [] })) opts.push(offerOption(o));
  if (opts.length < 2 && p.age <= 28) { const id = pick(r, TEAMS).id; opts.push({ id: `ps:${id}`, label: `${TEAM_BY_ID[id].ko} 연습생 계약`, sub: `프랙티스 스쿼드 · 주급 기준 시즌 약 ${usd(PS_SALARY)}`, desc: '53인 로스터 밖에서 기회를 노립니다. 부상자가 생기면 콜업될 수 있습니다.' }); }
  if (opts.length < 3 && p.ovr >= 58 && p.age <= 36) opts.push({ id: 'cfl', label: 'CFL 계약', sub: `${pick(r, CFL_TEAMS).ko} · 연 ${usd(120e3 + Math.max(0, p.ovr - 60) * 18e3)}`, desc: '캐나다에서 경기를 뛰며 다시 기회를 엿봅니다.' });
  opts.push({ id: 'retire', label: '은퇴', sub: '여기서 마침표', desc: '커리어를 마무리하고 은퇴 기록을 남깁니다.' });
  return { kind: 'fa', title, desc, options: opts };
}
function cflPath(s, r) {
  const p = s.player, done = p.ovr < 55 || p.age >= 39;
  const opts = done ? [] : [{ id: 'stay', label: `${s.team.name} 잔류`, sub: 'CFL 다음 시즌', desc: '캐나다에서 한 시즌 더 뜁니다.' }];
  if (p.ovr >= 69 && p.age <= 31) for (const o of faOffers(s, r).slice(0, 2)) opts.push(offerOption(o));
  opts.push({ id: 'retire', label: '은퇴', sub: '여기서 마침표', desc: '커리어를 마무리합니다.' });
  return { kind: 'cfl', title: done ? '마지막 시즌' : '오프시즌', desc: done ? '구단이 재계약 대신 은퇴식을 제안했습니다.' : 'NFL 구단들도 CFL 기록을 지켜보고 있습니다.', options: opts };
}

// 진로 선택 적용. 결과 문장을 돌려주고, 필요하면 다음 결정(s.path)을 새로 띄웁니다.
export function choosePath(s, optionId) {
  if (s.phase !== 'offseason' || !s.path) throw Error('지금은 진로를 정할 수 없습니다.');
  const r = rng(s), [kind, arg] = optionId.split(':'), p = s.player, opt = s.path.options.find(o => o.id === optionId);
  if (!opt) throw Error('없는 선택지입니다.');
  let text = '';
  if (kind === 'retire') { retireCareer(s, '스스로 은퇴를 결정했습니다.'); return '은퇴를 결정했습니다.'; }
  if (kind === 'advance') { text = '11학년으로 진급합니다.'; nextYear(s, () => { s.grade++; }); }
  else if (kind === 'transfer') { const h = SCHOOL_BY_ID[arg]; text = `${RO(h.ko)} 전학했습니다.`; moment(s, 'move', text); nextYear(s, () => { s.grade++; s.team = { kind: 'hs', id: h.id, name: h.ko, short: h.ko.replace(' 고교', ''), state: h.state }; s.meters.trust = 45; }); }
  else if (kind === 'commit') { s.recruiting.committed = arg; s.recruiting.starsAtCommit = s.recruiting.stars; text = `${COLLEGE_BY_ID[arg].ko}에 구두 커밋했습니다.`; moment(s, 'recruit', text); nextYear(s, () => { s.grade++; }); }
  else if (kind === 'wait') { text = '결정을 미루고 12학년 시즌에 집중합니다.'; nextYear(s, () => { s.grade++; }); }
  else if (opt.offer) {
    const o = opt.offer, moving = s.team?.id !== o.teamId;
    text = `${WA(o.teamName)} ${o.years}년 ${usd(o.total)} 계약.`; moment(s, 'contract', text + (moving && s.history.some(h => h.teamId === o.teamId && h.stage === 'nfl') ? ' 친정 복귀.' : ''));
    nextYear(s, () => joinNfl(s, o.teamId, { type: kind === 'tag' ? 'tag' : 'vet', years: o.years, yearsLeft: o.years, aav: o.aav, total: o.total, guaranteed: o.guaranteed }));
  }
  else if (kind === 'sign' || kind === 'walkon') {
    const c = COLLEGE_BY_ID[arg]; text = `${kind === 'walkon' ? `${c.ko}에 워크온으로 입단` : `${WA(c.ko)} 사인`}. 대학 풋볼이 시작됩니다.`; moment(s, 'move', text);
    nextYear(s, () => { s.stage = 'college'; s.collegeYear = 1; s.team = { kind: 'college', id: c.id, name: c.ko, short: c.ko.split(' ').slice(0, -2).join(' ') || c.ko, conf: c.conf }; s.meters.trust = kind === 'walkon' ? 38 : 48; s.walkon = kind === 'walkon'; });
  }
  else if (kind === 'stay') {
    text = '다음 시즌을 준비합니다.';
    nextYear(s, () => {
      if (s.stage === 'college') s.collegeYear++;
      if (s.stage === 'nfl' && s.contract?.option5 && s.proSeasons === 3) {
        s.contract.option5 = false;
        if (p.ovr >= 74) { s.contract.yearsLeft += 1; s.contract.aav = Math.max(s.contract.aav, Math.round(marketValue(s) * .8)); moment(s, 'contract', `${I(s.team.name)} 5년 차 옵션을 행사했습니다.`); }
        else moment(s, 'contract', `${I(s.team.name)} 5년 차 옵션을 행사하지 않았습니다.`);
      }
    });
  }
  else if (kind === 'portal') { const c = COLLEGE_BY_ID[arg]; text = `트랜스퍼 포털을 통해 ${RO(c.ko)} 옮깁니다.`; moment(s, 'move', text); nextYear(s, () => { s.collegeYear++; s.team = { kind: 'college', id: c.id, name: c.ko, short: c.ko, conf: c.conf }; s.meters.trust = 45; s.meters.locker = 48; }); }
  else if (kind === 'declare') {
    const d = runDraft(s, r); s.draft = d;
    s.todos.unshift({ id: 'draft', year: d.year, seen: false });
    if (d.drafted) {
      const t = TEAM_BY_ID[d.team], rc = rookieContract(d.pick);
      text = `${d.year} NFL 드래프트 ${d.round}라운드 ${d.inRound}순위(전체 ${d.pick}순위) · ${t.ko}`; moment(s, 'draft', text);
      nextYear(s, () => { joinNfl(s, d.team, { ...rc, type: 'rookie', round: d.round, pick: d.pick, yearsLeft: 4 }); });
    } else {
      text = '드래프트 사흘 동안 이름이 불리지 않았습니다.'; moment(s, 'draft', text);
      s.stage = 'fa'; s.team = { kind: 'none', id: null, name: '무소속', short: '무소속' }; s.contract = null;
      s.path = udfaPath(s, r);
      return text;
    }
  }
  if (kind === 'ps') { const t = TEAM_BY_ID[arg]; text = `${t.ko} 연습생 계약.`; moment(s, 'contract', text); nextYear(s, () => joinNfl(s, arg, { type: 'ps', years: 1, yearsLeft: 1, aav: PS_SALARY, total: PS_SALARY, guaranteed: 0 })); }
  if (kind === 'cfl') { const t = pick(r, CFL_TEAMS); text = `${WA(t.ko)} 계약. CFL에서 뜁니다.`; moment(s, 'move', text); nextYear(s, () => { s.stage = 'cfl'; s.team = { kind: 'cfl', id: t.id, name: t.ko, short: t.ko }; s.contract = { type: 'cfl', years: 2, yearsLeft: 2, aav: 120e3 + Math.max(0, p.ovr - 60) * 18e3, total: 0, guaranteed: 0 }; }); }
  if (kind === 'extend') {
    const mv = marketValue(s) * agentBoost(s), ch = clamp(.45 + (s.meters.front - 50) * .012 + (s.history.at(-1).score - 78) * .02, .1, .92);
    if (r() < ch) { const yrs = p.age <= 28 ? 4 : 2; s.contract = { ...s.contract, type: 'vet', aav: Math.round(mv * .96), years: yrs, yearsLeft: yrs, total: Math.round(mv * .96) * yrs, guaranteed: Math.round(mv * yrs * .55) }; text = `${WA(s.team.name)} ${yrs}년 연장 계약! 연 ${usd(s.contract.aav)}.`; moment(s, 'contract', text); s.meters.front = clamp(s.meters.front + 6, 0, 100); }
    else { text = '구단은 연장 계약을 서두르지 않겠다고 했습니다.'; s.meters.front = clamp(s.meters.front - 4, 0, 100); }
    s.path = { ...s.path, options: s.path.options.filter(o => o.id !== 'extend' && o.id !== 'holdout'), note: text };
    return text;
  }
  if (kind === 'holdout') {
    const mv = marketValue(s), ch = clamp(.42 + (p.ovr - 82) * .03 + (s.meters.front - 50) * .006, .15, .85);
    if (r() < ch) { const yrs = 4; s.contract = { ...s.contract, type: 'vet', aav: Math.round(mv * 1.02), years: yrs, yearsLeft: yrs, total: Math.round(mv * 1.02) * yrs, guaranteed: Math.round(mv * yrs * .6) }; text = `홀드아웃 끝에 연 ${usd(s.contract.aav)} 대형 계약을 따냈습니다.`; moment(s, 'contract', text); s.meters.locker = clamp(s.meters.locker - 4, 0, 100); }
    else { text = '구단이 물러서지 않았습니다. 벌금을 내고 캠프에 복귀합니다. 시즌 초반 출전이 줄어듭니다.'; s.money = Math.max(0, s.money - Math.round(s.contract.aav * .08)); s.meters.trust = clamp(s.meters.trust - 12, 0, 100); s.meters.media = clamp(s.meters.media - 6, 0, 100); s.flags.push('holdoutFail'); }
    s.path = { ...s.path, options: s.path.options.filter(o => o.id !== 'extend' && o.id !== 'holdout'), note: text };
    return text;
  }
  if (kind === 'trade') {
    const ch = clamp(.4 + (s.meters.front - 50) * .01 + (p.ovr - 75) * .015, .1, .85);
    if (r() < ch) {
      const targets = TEAMS.filter(t => t.id !== s.team.id).map(t => [t.id, expectedRole(s, t.id)]).filter(([, rl]) => ['key', 'starter'].includes(rl)).map(x => x[0]);
      const to = targets.length ? pick(r, targets) : pick(r, TEAMS.filter(t => t.id !== s.team.id)).id;
      text = `${RO(TEAM_BY_ID[to].ko)} 트레이드됐습니다.`; moment(s, 'move', text);
      nextYear(s, () => joinNfl(s, to, { ...s.contract }));
    } else {
      text = '구단이 트레이드 요청을 거절했습니다. 관계가 서먹해졌습니다.'; s.meters.front = clamp(s.meters.front - 10, 0, 100); s.meters.trust = clamp(s.meters.trust - 5, 0, 100);
      s.path = { ...s.path, options: s.path.options.filter(o => o.id !== 'trade'), note: text };
      return text;
    }
  }
  if (kind === 'military') { text = '귀국해 현역으로 입대합니다. 2시즌 동안 그라운드를 떠납니다.'; moment(s, 'military', text); nextYear(s, () => { s.stage = 'military'; s.military = { left: 2, from: s.team }; s.team = { kind: 'military', id: 'army', name: '대한민국 육군', short: '육군' }; s.contract = null; }); }
  return text;
}
function udfaPath(s, r) {
  const p = s.player, opts = [];
  const teams = TEAMS.map(t => t.id).sort(() => r() - .5).slice(0, p.ovr >= 64 ? 3 : 2);
  for (const id of teams) { const o = nflOffer(s, r, id, 'udfa'); o.aav = MIN_SALARY; o.years = 3; o.total = MIN_SALARY * 3; o.guaranteed = Math.round(10e3 + r() * 90e3); opts.push({ ...offerOption(o, 'udfa'), sub: `언드래프티 FA · 53인 로스터 경쟁 · 3년 최저 연봉`, desc: `사이닝 보너스 ${usd(o.guaranteed)} · 예상 역할 ${o.roleName}` }); }
  opts.push({ id: 'cfl', label: 'CFL 계약', sub: '캐나다에서 프로 시작', desc: '경기 출전 기회는 확실합니다.' });
  opts.push({ id: 'retire', label: '풋볼을 내려놓는다', sub: '다른 인생', desc: '여기서 선수 생활을 마칩니다.' });
  return { kind: 'udfa', title: '언드래프티 FA', desc: '드래프트가 끝나자마자 몇몇 구단에서 전화가 왔습니다.', options: opts };
}
function joinNfl(s, teamId, contract) {
  const t = TEAM_BY_ID[teamId];
  s.stage = 'nfl'; s.team = { kind: 'nfl', id: teamId, name: t.ko, short: t.short };
  s.contract = { ...contract, teamId, signedYear: s.year };
  s.meters.trust = contract.type === 'rookie' ? 50 + (contract.round === 1 ? 8 : 0) : 50;
  s.meters.locker = 50;
  // 등번호: 같은 번호를 쓰는 선수나 영구결번이면 다른 번호를 받습니다.
  const taken = new Set([...(RETIRED_NUMBERS[teamId] || []), ...(s.league.retiredNumbers[teamId] || []), ...s.league.teams[teamId].p.filter(x => x[5] === 0 && (x[6] || x[2] >= 82)).map(x => x[4])]);
  if (taken.has(s.player.number)) { const old = s.player.number; let n = old; for (let i = 1; i < 99 && taken.has(n); i++) n = (old + i) % 100; s.player.number = n; moment(s, 'number', `${t.ko}에서는 ${old}번을 쓸 수 없어 ${n}번을 받았습니다.`); }
}
function nextYear(s, mutate) {
  const r = rng(s);
  mutate?.();
  s.year++; s.player.age = s.year - s.player.born;
  evolveLeague(s.league, r);
  s.redshirt = false; s.walkon = s.walkon && s.stage === 'college';
  if (s.flags.includes('holdoutFail')) { s.seasonMods.playing = -.2; s.flags = s.flags.filter(f => f !== 'holdoutFail'); }
  s.path = null; s.phase = 'ready';
  s.todos = s.todos.filter(t => !t.seen || t.id === 'draft').filter(t => !['turning', 'interview'].includes(t.id));
  expireStaff(s);
  runOlympics(s);
  s.goal = goalFor(s);
}
export function setTraining(s, plan) { if (!['balanced', 'intense', 'recovery'].includes(plan)) throw Error('훈련 계획'); s.training = plan; return injuryChance(s, plan); }
export function setRedshirt(s, on) {
  if (s.stage !== 'college' || s.phase !== 'ready' || s.redshirtUsed) throw Error('레드셔트를 쓸 수 없습니다.');
  s.redshirt = !!on; s.goal = goalFor(s);
}
export const canRedshirt = s => s.stage === 'college' && s.phase === 'ready' && !s.redshirtUsed && s.collegeYear <= 4;

// ───────── 군 복무 (한국 국적) ─────────
function militarySeason(s) {
  const p = s.player, r = rng(s);
  for (const k of attrsOf(p.pos)) p.attrs[k] = clamp(p.attrs[k] - Math.round(r() * 2 + (PHYSICAL_SET.has(k) ? 1 : 0)), 15, 99);
  p.ovr = overall(p.pos, p.attrs);
  s.military.left--;
  s.history.push({ year: s.year, age: p.age, stage: 'military', level: '군 복무', label: '군 복무', teamId: 'army', teamName: '대한민국 육군', pos: p.pos, role: 'none', roleName: '복무', stats: {}, grade: 0, totalGames: 0, team: { w: 0, l: 0 }, awards: [], race: [], injuries: [], ovrBefore: p.ovr, ovrAfter: p.ovr, attrsAfter: { ...p.attrs }, changes: {}, score: 0, income: { kind: '병사 월급', gross: 6000, net: 6000 }, social: { delta: 0 } });
  s.money += 6000;
  s.todos = [{ id: 'report', year: s.year, seen: false }];
  s.phase = 'offseason';
  if (s.military.left > 0) s.path = { kind: 'military', title: '복무 중', desc: `전역까지 ${s.military.left}시즌 남았습니다.`, options: [{ id: 'stay', label: '복무를 이어 간다', sub: '다음 시즌도 군 복무', desc: '개인 정비 시간에 몸을 만듭니다.' }] };
  else { moment(s, 'military', '만기 전역했습니다. 다시 그라운드로.'); s.flags.push('militaryDone'); s.path = faPath(s, r, '전역', '병역을 마쳤습니다. NFL 구단들의 연락을 기다립니다.'); }
}
const PHYSICAL_SET = new Set(['spd', 'agi', 'str', 'mob', 'stam', 'kpow', 'ath']);

// ───────── 은퇴 ─────────
export function retireCareer(s, reason = '') {
  s.phase = 'retired'; s.retiredYear = s.year; s.path = null; s.season = null; s.card = null;
  const legacy = careerScore(s), hof = hallOfFame(s);
  const nflTeams = Object.entries(s.teamSeasons).sort((a, b) => b[1] - a[1]);
  const legend = [];
  for (const [id, n] of nflTeams) {
    const hist = s.history.filter(h => h.teamId === id), rings = hist.filter(h => h.champion).length;
    const big = hist.reduce((m, h) => m + h.awards.filter(a => ['mvp', 'allPro1', 'opoy', 'dpoy', 'sbMVP'].includes(a.kind)).length, 0);
    if (n >= 6 && (rings || big >= 2 || hof.first)) legend.push({ teamId: id, kind: 'ring', text: `${TEAM_BY_ID[id].ko} 링 오브 아너 헌액` });
    if (n >= 8 && (hof.first || (rings && big >= 3))) { legend.push({ teamId: id, kind: 'number', text: `${TEAM_BY_ID[id].ko} ${s.player.number}번 영구결번` }); (s.league.retiredNumbers[id] ||= []).push(s.player.number); }
  }
  const oneClub = nflTeams.length === 1 && nflTeams[0][1] >= 8;
  s.legacy = { ...legacy, hof, legend, oneClub, reason, totals: totals(s.history.filter(isPro)), allTotals: totals(s.history) };
  moment(s, 'retire', `${s.player.age}세에 은퇴. ${reason}`);
  return s.legacy;
}
export function checkRetirementNudge(s) {
  const p = s.player;
  return s.stage === 'nfl' && (p.age >= 36 || (p.ovr < 66 && p.age >= 31));
}
export { clone };
