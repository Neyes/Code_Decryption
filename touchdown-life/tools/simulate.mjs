// 밸런스 점검: 자동 플레이어로 커리어 N개를 끝까지 돌려 분포를 출력합니다.
// node tools/simulate.mjs [N] [포지션]
import { createCareer, makeCandidates, startSeason, advance, chooseCard, choosePath, chooseTurning, retireCareer } from '../js/engine/career.js';
import { careerScore, countAwards, hallOfFame } from '../js/engine/awards.js';
import { HIGH_SCHOOLS } from '../js/data/schools.js';
import { POS_ORDER } from '../js/engine/core.js';
import { COLLEGE_BY_ID } from '../js/data/colleges.js';

const N = +process.argv[2] || 60, ONLY = process.argv[3];
const out = [];
const pickBest = (opts, score) => opts.reduce((b, o) => (score(o) > score(b) ? o : b), opts[0]);
function autoPath(s) {
  const P = s.path, o = P.options;
  if (P.kind === 'hs') return o.find(x => x.id.startsWith('transfer')) && s.player.ovr >= 52 ? o.find(x => x.id.startsWith('transfer')) : o[0];
  if (P.kind === 'recruit') return o.find(x => x.id === 'wait');
  if (P.kind === 'signing') return pickBest(o.filter(x => x.college), x => (COLLEGE_BY_ID[x.college]?.prestige || 0) - (x.id.startsWith('walkon') ? 30 : 0));
  if (P.kind === 'college') {
    const d = o.find(x => x.id === 'declare');
    if (d && (P.proj.round && P.proj.round <= 2 || !o.find(x => x.id === 'stay'))) return d;
    return o.find(x => x.id === 'stay') || d || o[0];
  }
  if (P.kind === 'nfl') return o.find(x => x.id === 'extend') || o.find(x => x.id === 'stay') || o[0];
  if (P.kind === 'military') return o[0];
  const offers = o.filter(x => x.offer);
  if (offers.length) return pickBest(offers, x => x.offer.aav * (x.offer.role === 'starter' || x.offer.role === 'key' ? 1.5 : 1));
  return o.find(x => x.id.startsWith('ps')) || o.find(x => x.id === 'cfl') || o.find(x => x.id === 'retire');
}
for (let i = 0; i < N; i++) {
  const pos = ONLY || POS_ORDER[i % POS_ORDER.length];
  const c = makeCandidates(pos, `sim:${i}`)[i % 3];
  const school = HIGH_SCHOOLS[i % HIGH_SCHOOLS.length];
  const s = createCareer({ name: `선수${i}`, number: 10 + (i % 80), pos, nat: i % 4 === 0 ? 'KR' : 'US', schoolId: school.id, arch: c.arch, attrs: c.attrs, focus: c.strong.slice(0, 2), seed: `sim-${i}` });
  let guard = 0;
  try {
    while (s.phase !== 'retired' && guard++ < 400) {
      if (s.phase === 'ready') { if (s.player.age >= 41) { retireCareer(s, '나이'); break; } startSeason(s); }
      else if (s.phase === 'card') { const best = s.card.choices.reduce((b, x) => x.chance > b.chance ? x : b); chooseCard(s, best.i); }
      else if (s.phase === 'season') advance(s);
      else if (s.phase === 'offseason') {
        const t = s.todos.find(x => x.id === 'turning' && !x.done);
        if (t) chooseTurning(s, t.kind === 'position' || t.kind === 'potential' ? 'accept' : 'stay');
        const opt = autoPath(s); choosePath(s, opt.id);
      }
    }
  } catch (e) { console.error('CRASH', i, pos, s.year, s.stage, s.phase, e.stack); process.exit(1); }
  const L = careerScore(s), nfl = s.history.filter(h => h.stage === 'nfl');
  out.push({ i, pos, school: school.id, pot: s.player.potential, peak: L.peak, grade: L.grade, score: L.score, nflSeasons: nfl.length, draft: s.draft ? (s.draft.drafted ? s.draft.pick : 'UDFA') : '-', college: s.history.find(h => h.stage === 'college')?.teamId || '-', mvp: countAwards(s, 'mvp'), pb: countAwards(s, 'proBowl'), ap1: countAwards(s, 'allPro1'), sb: countAwards(s, 'sbChamp'), heis: countAwards(s, 'heisman'), hof: hallOfFame(s).chance ?? 0, retAge: s.player.age, ovr18: s.history.find(h => h.age === 17)?.ovrAfter, ovr21: s.history.find(h => h.age === 21)?.ovrAfter });
}
if (process.env.TABLE) console.table(out.slice(0, 40));
const avg = k => (out.reduce((n, x) => n + (+x[k] || 0), 0) / out.length).toFixed(2);
const share = f => (out.filter(f).length / out.length * 100).toFixed(0) + '%';
console.log({ retAge: avg('retAge'), peak: avg('peak'), nflSeasons: avg('nflSeasons'), ovr18: avg('ovr18'), ovr21: avg('ovr21'), drafted: share(x => typeof x.draft === 'number'), round1: share(x => typeof x.draft === 'number' && x.draft <= 32), mvpAny: share(x => x.mvp > 0), pbAny: share(x => x.pb > 0), sbAny: share(x => x.sb > 0), heis: share(x => x.heis > 0), hofLikely: share(x => x.hof >= 80), S: share(x => x.grade === 'S'), A: share(x => x.grade === 'A'), D: share(x => x.grade === 'D') });
