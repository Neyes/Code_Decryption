// 시즌 수상, 개인 타이틀, 커리어 점수·명예의 전당 판정.
import { clamp, gauss, round1, POSITIONS, superBowlName } from './core.js';
import { COLLEGE_BY_ID, COLLEGE_POSITION_AWARDS } from '../data/colleges.js';
import { leagueTop, displayName, randomName } from './league.js';

const OFF = p => POSITIONS[p].side === 'O';
// 시즌 가치 점수: 평점(출전 비중 반영) + 포지션별 생산량 보너스. 리그 정상급 시즌 ≈ 95 이상.
// 포지션 보정: 같은 수준의 시즌이면 포지션과 관계없이 비슷한 점수가 나오도록(시뮬레이션 측정값으로 맞춤).
const POS_OFFSET = {
  hs: { QB: -12, RB: 0, WR: 0, TE: -14, OL: 4.5, DT: -1.5, EDGE: -2.4, LB: 4, CB: 0, S: 4.5, K: 2.5, P: -1.4 },
  college: { QB: -14, RB: 0, WR: -3, TE: -8, OL: 1.4, DT: 1.2, EDGE: -1.6, LB: .5, CB: 5, S: 5.5, K: .6, P: -9 },
  nfl: { QB: -11.5, RB: 1.4, WR: -.8, TE: .3, OL: .4, DT: 2.3, EDGE: -1.6, LB: .5, CB: 3.3, S: 5.8, K: .6, P: -4.3 },
};
export function seasonScore(pos, L, games, totalGames, wins = 0, stage = 'nfl') {
  if (!L.g) return 0;
  const off = (POS_OFFSET[stage] || POS_OFFSET.nfl)[pos] || 0;
  const grade = L.gradeSum / L.g, share = Math.min(1, L.g / totalGames);
  const f = totalGames / 17;
  let bonus = 0;
  if (pos === 'QB') bonus = L.pyds / (4800 * f) * 6 + L.ptd / (40 * f) * 6 - L.pint / (14 * f) * 2 + L.ryds / (600 * f) * 2 + wins / totalGames * 4;
  else if (pos === 'RB') bonus = (L.ryds + L.recyds) / (2000 * f) * 9 + (L.rtd + L.rectd) / (18 * f) * 5;
  else if (pos === 'WR') bonus = L.recyds / (1700 * f) * 9 + L.rectd / (14 * f) * 5;
  else if (pos === 'TE') bonus = L.recyds / (1200 * f) * 8 + L.rectd / (11 * f) * 4 + 1.5;
  else if (pos === 'OL') bonus = 6 - L.sa * .9 + L.pan / (40 * f) * 3;
  else if (pos === 'DT') bonus = L.sack / (12 * f) * 9 + L.tfl / (18 * f) * 3 + 1;
  else if (pos === 'EDGE') bonus = L.sack / (17 * f) * 10 + L.tfl / (22 * f) * 3 + L.ff / (5 * f) * 2;
  else if (pos === 'LB') bonus = L.tkl / (150 * f) * 6 + L.sack / (8 * f) * 2 + L.dint / (4 * f) * 3 + L.pd / (10 * f) * 1;
  else if (pos === 'CB') bonus = L.dint / (8 * f) * 7 + L.pd / (20 * f) * 4 + L.dtd * 1.5;
  else if (pos === 'S') bonus = L.dint / (7 * f) * 6 + L.tkl / (110 * f) * 3 + L.pd / (14 * f) * 2;
  else if (pos === 'K') bonus = (L.fga ? L.fgm / L.fga / .95 : 0) * 6 + (L.fglong >= 55 ? 2 : 0) + L.fgm / (34 * f) * 2;
  else if (pos === 'P') bonus = L.punts ? (L.puntyds / L.punts / 49) * 6 + L.in20 / (35 * f) * 2 : 0;
  return round1(grade * (.55 + .45 * share) + clamp(bonus, -4, 18) * share + off * share);
}
const TITLES = {
  pyds: ['패싱 야드 1위', 4700, 250, 'QB'], ptd: ['터치다운 패스 1위', 38, 4, 'QB'], ryds: ['러싱 야드 1위', 1650, 180, 'RB'],
  recyds: ['리시빙 야드 1위', 1650, 170, 'WR'], rec: ['리셉션 1위', 118, 10, 'WR'], sack: ['색 1위', 16.5, 2.3, 'EDGE'], dint: ['인터셉트 1위', 7.5, 1.5, 'CB'], tkl: ['태클 1위', 155, 12, 'LB'],
};
// NFL 수상. awards: [{name, kind, pts, note}], race: 투표 순위 설명.
export function nflAwards(s, r, rec) {
  const p = s.player, pos = p.pos, L = rec.stats, sc = rec.score, out = [], race = [];
  const games = L.g, rookie = s.proSeasons === 1, wins = rec.team?.w ?? 0;
  const award = (name, kind, pts, note = '') => out.push({ name, kind, pts, note });
  const noise = () => gauss(r) * 2.2;
  const rival = (ps, k = 0) => { const t = leagueTop(s.league, ps, 6, s.team.id); return t.length ? displayName(t[Math.min(k, t.length - 1)].name) : randomName(r); };
  if (games >= 8) {
    if (sc + noise() >= 80) award('프로볼', 'proBowl', 6);
    const ap = sc + noise();
    if (ap >= 93) award('올프로 퍼스트팀', 'allPro1', 12); else if (ap >= 88) award('올프로 세컨드팀', 'allPro2', 7);
    // MVP
    const prev = k => s.history.reduce((n, h) => n + (h.awards || []).filter(x => x.kind === k).length, 0) * 1.5; // 같은 상을 연달아 받기는 어렵게
    const mvpScore = sc + (pos === 'QB' ? 0 : -15) + (wins - 11) * .9 - prev('mvp') + noise();
    if (mvpScore >= 90 && wins >= 10) { award('정규시즌 MVP', 'mvp', 30); race.push('MVP 투표 1위'); }
    else if (mvpScore >= 85.5) race.push(`MVP 투표 ${mvpScore >= 88 ? 2 : 3}위 · 1위 ${rival('QB')}`);
    const opoy = OFF(pos) && !out.some(a => a.kind === 'mvp') && sc - prev('opoy') + noise() >= (pos === 'QB' ? 95 : 96);
    const dpoy = !OFF(pos) && POSITIONS[pos].side === 'D' && sc - prev('dpoy') + noise() >= 95;
    if (opoy) award('올해의 공격 선수', 'opoy', 18);
    if (dpoy) award('올해의 수비 선수', 'dpoy', 18);
    else if (POSITIONS[pos].side === 'D' && sc >= 90) race.push(`올해의 수비 선수 투표 ${sc >= 93 ? 2 : 4}위 · 1위 ${rival(pos === 'CB' || pos === 'S' ? 'EDGE' : pos)}`);
    if (rookie && sc + noise() >= 75) award(OFF(pos) || pos === 'K' || pos === 'P' ? '올해의 공격 신인' : '올해의 수비 신인', OFF(pos) ? 'oroy' : 'droy', 10);
    if (s.flags.includes('comeback') && sc >= 80) award('올해의 재기상', 'comeback', 6);
  }
  for (const [k, [label, mean, sd, ps]] of Object.entries(TITLES)) {
    if (L[k] === undefined || !L[k]) continue;
    if ((ps === 'WR' && !['WR', 'TE', 'RB'].includes(pos)) || (ps === 'EDGE' && !['EDGE', 'DT', 'LB'].includes(pos)) || (ps === 'CB' && !['CB', 'S', 'LB'].includes(pos)) || (ps === 'LB' && !['LB', 'S'].includes(pos)) || (ps === 'QB' && pos !== 'QB') || (ps === 'RB' && !['RB', 'QB'].includes(pos))) continue;
    if (L[k] >= mean + gauss(r) * sd) award(label, 'title', 5);
  }
  if (rec.champion) award(`${superBowlName(s.year)} 우승`, 'sbChamp', 15);
  if (rec.champion && rec.finalGrade >= 78 && r() < (rec.finalGrade - 70) / 18) award(`${superBowlName(s.year)} MVP`, 'sbMVP', 12);
  if (s.flags.includes('foundation') && sc >= 80 && r() < .15 && !s.history.some(h => h.awards?.some(a => a.kind === 'wpmoy'))) award('월터 페이턴 올해의 선수', 'wpmoy', 6);
  return { awards: out, race };
}
export function collegeAwards(s, r, rec) {
  const p = s.player, pos = p.pos, sc = rec.score, out = [], race = [], c = COLLEGE_BY_ID[s.team.id];
  const award = (name, kind, pts) => out.push({ name, kind, pts });
  const tierAdj = { P4: 0, G5: -4, FCS: -9, JUCO: -14 }[c.tier];
  const adj = sc + tierAdj + gauss(r) * 2;
  if (rec.stats.g >= 6) {
    if (adj >= 68) award(c.conf === 'JUCO' ? 'JUCO 올아메리칸' : `올 ${c.conf} 퍼스트팀`, 'allConf', 3);
    if (adj >= 79) award(`${c.conf} 올해의 ${OFF(pos) ? '공격' : '수비'} 선수`, 'confPOY', 5);
    if (adj >= 84 && c.tier !== 'JUCO') award(adj >= 89 ? '컨센서스 올아메리칸' : '올아메리칸 퍼스트팀', adj >= 89 ? 'consensusAA' : 'allAmerican', adj >= 89 ? 9 : 7);
    if (adj >= 88 && c.tier !== 'JUCO') award(COLLEGE_POSITION_AWARDS[pos], 'positionAward', 8);
    if (s.collegeYear === 1 && adj >= 70) award('프레시맨 올아메리칸', 'freshmanAA', 3);
    const h = adj + (['QB', 'RB', 'WR'].includes(pos) ? 0 : -8) + (rec.team.w - 10) * .9 + (pos === 'QB' ? 1 : 0);
    if (c.tier === 'P4' || c.tier === 'G5') {
      if (h >= 84) { award('하이즈먼 트로피', 'heisman', 25); race.push('하이즈먼 투표 1위'); }
      else if (h >= 79) { award('하이즈먼 최종 후보', 'heismanFinalist', 6); race.push(`하이즈먼 투표 ${h >= 81.5 ? 2 : 3}위`); }
    }
  }
  const post = rec.post || '';
  if (/챔피언십 (우승|승리)/.test(post) && !/CFP|FCS/.test(post)) award(post.replace(' 승리', ' 우승'), 'confChamp', 4);
  (rec.postRounds || []).forEach(x => { if (/챔피언십$/.test(x.round) && x.res === 'W' && !/CFP|FCS/.test(x.round)) award(`${x.round} 우승`, 'confChamp', 4); });
  if (rec.champion) award(`${s.year} ${post.replace(' 우승', '')} 우승`, 'nationalChamp', 12);
  const bowl = (rec.postRounds || []).find(x => /볼( 게임)?$/.test(x.round) && x.res === 'W');
  if (bowl && bowl.grade >= 78) award(`${bowl.round} MVP`, 'bowlMVP', 3);
  return { awards: dedupe(out), race };
}
export function hsAwards(s, r, rec) {
  const sc = rec.score + gauss(r) * 2, out = [], race = [], award = (name, kind, pts) => out.push({ name, kind, pts });
  if (rec.stats.g >= 5) {
    if (sc >= 70) award('올스테이트 퍼스트팀', 'allState', 4);
    if (sc >= 79) award(`${s.team.state} 올해의 선수`, 'statePOY', 6);
    if (sc >= 82 && s.grade >= 11) award('고교 올아메리칸', 'hsAA', 6);
    if (s.grade === 12 && sc >= 76) award('고교 올스타전 선발', 'allStarGame', 3);
  }
  if (rec.champion) award(`${s.team.state} 주 챔피언십 우승`, 'stateChamp', 6);
  return { awards: out, race };
}
export function cflAwards(s, r, rec) {
  const out = [], sc = rec.score + gauss(r) * 2;
  if (rec.stats.g >= 8 && sc >= 75) out.push({ name: 'CFL 올스타', kind: 'cflAllStar', pts: 3 });
  if (rec.stats.g >= 8 && sc >= 88) out.push({ name: 'CFL 최우수 선수', kind: 'cflMOP', pts: 8 });
  if (rec.champion) out.push({ name: `${s.year} 그레이컵 우승`, kind: 'greyCup', pts: 5 });
  return { awards: out, race: [] };
}
const dedupe = list => list.filter((x, i) => list.findIndex(y => y.name === x.name) === i);

// ───────── 통산 · 레거시 ─────────
export const STAT_KEYS = ['g', 'gs', 'att', 'cmp', 'pyds', 'ptd', 'pint', 'ratt', 'ryds', 'rtd', 'tgt', 'rec', 'recyds', 'rectd', 'tkl', 'sack', 'tfl', 'dint', 'pd', 'ff', 'dtd', 'sa', 'pan', 'fga', 'fgm', 'xpa', 'xpm', 'punts', 'puntyds', 'in20', 'sttkl'];
export function totals(history, filter = () => true) {
  const T = Object.fromEntries(STAT_KEYS.map(k => [k, 0])); T.fglong = 0;
  for (const h of history.filter(filter)) { for (const k of STAT_KEYS) T[k] += h.stats[k] || 0; T.fglong = Math.max(T.fglong, h.stats.fglong || 0); }
  return T;
}
export const isPro = h => h.stage === 'nfl';
const HONOR_POINTS = h => (h.awards || []).reduce((n, a) => n + (a.pts || 0), 0);
export function careerScore(s) {
  const nfl = s.history.filter(isPro), T = totals(nfl), pos = s.player.pos;
  const peak = Math.max(0, ...s.history.map(h => h.ovrAfter));
  const prod = T.pyds / 500 + T.ptd * 1.2 + (T.ryds + T.recyds) / 180 + (T.rtd + T.rectd) * 1.4 + T.rec / 25 + T.sack * 2.2 + T.dint * 3.5 + T.tkl / 14 + T.pd / 4 + T.fgm * .5 + T.in20 * .2
    + nfl.filter(h => ['starter', 'key'].includes(h.role)).length * (['OL', 'K', 'P'].includes(pos) ? 14 : 5);
  const honors = nfl.reduce((n, h) => n + HONOR_POINTS(h), 0), amateur = s.history.filter(h => !isPro(h)).reduce((n, h) => n + HONOR_POINTS(h), 0);
  const score = Math.round(peak * 4 + prod + honors * 2.2 + amateur * .6);
  const grade = score >= 1100 ? 'S' : score >= 800 ? 'A' : score >= 560 ? 'B' : score >= 400 ? 'C' : 'D';
  return { score, grade, peak, honors, amateur };
}
export function countAwards(s, kind) { return s.history.reduce((n, h) => n + (h.awards || []).filter(a => a.kind === kind || (Array.isArray(kind) && kind.includes(a.kind))).length, 0); }
// 명예의 전당: 은퇴 5년 뒤 자격. 수상 포인트·통산 생산량으로 1차 투표/몇 년 뒤/불가를 판정.
export function hallOfFame(s) {
  const nfl = s.history.filter(isPro);
  if (!nfl.length) return { eligible: false, verdict: 'NFL 경력이 없어 대상이 아닙니다.' };
  const { score } = careerScore(s), honors = nfl.reduce((n, h) => n + HONOR_POINTS(h), 0);
  const mvp = countAwards(s, 'mvp'), allPro = countAwards(s, 'allPro1'), rings = countAwards(s, 'sbChamp');
  const v = honors + mvp * 25 + allPro * 6 + rings * 4 + score * .05;
  const year = (s.retiredYear || s.year) + 5;
  if (v >= 190) return { eligible: true, first: true, year, chance: 99, verdict: `${year}년 첫 투표에서 헌액이 유력합니다 (퍼스트 밸럿).` };
  if (v >= 130) return { eligible: true, year: year + 2, chance: 80, verdict: `몇 차례 투표 끝에 ${year + 2}년 무렵 헌액될 가능성이 높습니다.` };
  if (v >= 95) return { eligible: true, year: year + 6, chance: 40, verdict: '경계선에 있는 후보입니다. 시니어 위원회 추천을 기다려야 할 수도 있습니다.' };
  return { eligible: false, chance: Math.round(clamp(v / 95 * 25, 0, 25)), verdict: '명예의 전당 기준에는 미치지 못합니다.' };
}
export const honorsLine = s => {
  const kinds = [['mvp', 'MVP'], ['sbChamp', '슈퍼볼 우승'], ['allPro1', '올프로 1팀'], ['proBowl', '프로볼'], ['heisman', '하이즈먼']];
  return kinds.map(([k, l]) => [l, countAwards(s, k)]).filter(x => x[1]).map(([l, n]) => `${l} ${n}회`).join(' · ');
};
export { round1 };
