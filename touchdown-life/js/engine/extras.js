// 오프시즌 프로그램, 시즌 뒤 인터뷰, 국가대표(올림픽 플래그 풋볼), 칭호 컬렉션.
import { clamp, rng, gauss, POSITIONS, attrsOf, overall, usd } from './core.js';
import { countAwards, totals, isPro } from './awards.js';

// ───────── 오프시즌 프로그램 (시즌 시작 때 적용) ─────────
export const PROGRAMS = [
  { id: 'ota', name: '팀 훈련 성실 참석', desc: 'OTA·미니캠프 개근. 감독 신뢰 +6' },
  { id: 'camp', name: '개인 트레이너 합숙 캠프', desc: '집중 육성 능력치 +1씩. 비용이 듭니다.', cost: s => ({ hs: 300, college: 3000, nfl: 75000, cfl: 8000 })[s.stage] ?? 0 },
  { id: 'rest', name: '휴식과 가족', desc: '누적 피로 −2, 이번 시즌 부상 위험 감소' },
  { id: 'tour', name: '팬 사인회·홍보 투어', desc: '팔로워 +12%, 팬·언론 +5, 감독 신뢰 −2' },
  { id: 'korea', name: '한국 유소년 풋볼 캠프 개최', desc: '한국 팬·언론 +8, 팔로워 +15%', nat: 'KR', cost: s => ({ hs: 0, college: 1500, nfl: 40000, cfl: 4000 })[s.stage] ?? 0 },
];
export const programsFor = s => PROGRAMS.filter(p => !p.nat || p.nat === s.player.nat).filter(() => s.stage !== 'military');
export const programCost = (s, id) => PROGRAMS.find(p => p.id === id)?.cost?.(s) ?? 0;
export function setProgram(s, id) {
  if (!PROGRAMS.some(p => p.id === id)) throw Error('없는 프로그램');
  if (programCost(s, id) > s.money) throw Error('보유 자금이 모자랍니다.');
  s.program = id;
}
export function applyProgram(s) {
  let id = s.program || 'ota';
  if (programCost(s, id) > s.money || (PROGRAMS.find(x => x.id === id)?.nat && PROGRAMS.find(x => x.id === id).nat !== s.player.nat)) id = 'ota';
  const p = s.player, lines = [], cost = programCost(s, id);
  s.money -= cost;
  if (id === 'ota') { s.meters.trust = clamp(s.meters.trust + 6, 0, 100); lines.push('감독 신뢰 +6'); }
  if (id === 'camp') { for (const k of p.focus) p.attrs[k] = clamp(p.attrs[k] + 1, 15, 99); p.ovr = overall(p.pos, p.attrs); p.peak = Math.max(p.peak, p.ovr); lines.push('집중 육성 능력치 +1'); }
  if (id === 'rest') { s.meters.body = clamp(s.meters.body - 2, 0, 10); s.seasonMods.injury = (s.seasonMods.injury || 0) - .02; lines.push('누적 피로 −2'); }
  if (id === 'tour') { s.followers = Math.round(s.followers * 1.12); s.meters.media = clamp(s.meters.media + 5, 0, 100); s.meters.trust = clamp(s.meters.trust - 2, 0, 100); lines.push('팔로워 +12%'); }
  if (id === 'korea') { s.followers = Math.round(s.followers * 1.15); s.meters.media = clamp(s.meters.media + 8, 0, 100); lines.push('한국 팬 반응 상승'); }
  s.lastProgram = { id, lines, cost };
  return lines;
}

// ───────── 시즌 뒤 인터뷰 ─────────
export function interviewFor(rec) {
  const big = rec.champion || rec.awards.some(a => a.pts >= 10);
  const hurt = rec.injuries?.some(i => i.major);
  const slump = rec.stats.g >= 6 && rec.score < 60;
  if (big) return { kind: 'win', q: `"${rec.champion ? '우승' : '수상'} 소감 한마디 부탁드립니다."` };
  if (hurt) return { kind: 'hurt', q: '"부상 회복은 어떻게 하고 계신가요? 복귀 시점은요?"' };
  if (slump) return { kind: 'slump', q: '"이번 시즌 부진의 원인을 무엇이라고 보시나요?"' };
  if (rec.awards.length || rec.score >= 80) return { kind: 'good', q: '"다음 시즌 목표가 궁금합니다."' };
  return null;
}
export const INTERVIEW_TONES = [
  { id: 'humble', label: '겸손하게', line: { win: '"동료들과 코치님 덕분입니다. 저는 제 몫을 했을 뿐이에요."', hurt: '"서두르지 않겠습니다. 더 단단해져서 돌아올게요."', slump: '"제 준비가 부족했습니다. 변명하지 않겠습니다."', good: '"팀이 이기는 데 보탬이 되고 싶습니다."' } },
  { id: 'confident', label: '자신 있게', line: { win: '"이게 끝이 아닙니다. 매년 이 자리에 서겠습니다."', hurt: '"개막전에 맞춰 돌아옵니다. 약속하죠."', slump: '"걱정 마세요. 내년엔 다른 선수를 보게 될 겁니다."', good: '"리그 최고가 되는 게 목표입니다."' } },
  { id: 'spicy', label: '도발적으로', line: { win: '"다른 팀들은 내년에도 2등 싸움이나 하면 됩니다."', hurt: '"제가 없는 동안 다들 즐기세요. 곧 돌아갑니다."', slump: '"감독님이 저를 제대로 쓰셨으면 달랐을 겁니다."', good: '"저를 막을 수비수는 아직 못 봤습니다."' } },
];
export function answerInterview(s, todo, toneId) {
  const r = rng(s), tone = INTERVIEW_TONES.find(t => t.id === toneId), k = todo.kind, lines = [];
  const m = (key, v) => { s.meters[key] = clamp(s.meters[key] + v, 0, 100); lines.push(`${({ trust: '감독 신뢰', locker: '라커룸', media: '팬·언론', front: '구단 관계' })[key]} ${v > 0 ? '+' : ''}${v}`); };
  if (toneId === 'humble') { m('locker', 6); m(k === 'slump' ? 'trust' : 'media', k === 'slump' ? 4 : 2); }
  if (toneId === 'confident') { m('media', 6); s.followers = Math.round(s.followers * 1.08); lines.push('팔로워 +8%'); if (k === 'slump') m('trust', -2); }
  if (toneId === 'spicy') {
    const viral = r() < .55;
    s.followers = Math.round(s.followers * (viral ? 1.22 : 1.05)); lines.push(viral ? '발언이 화제 · 팔로워 +22%' : '팔로워 +5%');
    m('media', viral ? 7 : -6); m('locker', -3); if (k === 'slump') m('trust', -7);
  }
  todo.done = true; todo.seen = true; todo.answer = { tone: tone.label, line: tone.line[k], lines };
  (s.interviews ||= []).push({ year: todo.year, tone: tone.label, q: todo.q, line: tone.line[k] });
  s.interviews = s.interviews.slice(-30);
  return todo.answer;
}

// ───────── 국가대표: 올림픽 플래그 풋볼 ─────────
// 2028 LA 올림픽 플래그 풋볼은 실제 채택 종목입니다. 2032년 이후는 게임 속 가정입니다.
export const OLYMPICS = [{ year: 2028, city: '로스앤젤레스', real: true }, { year: 2032, city: '브리즈번' }, { year: 2036, city: '미정' }, { year: 2040, city: '미정' }];
export const FLAG_POS = new Set(['QB', 'RB', 'WR', 'TE', 'CB', 'S', 'LB', 'EDGE']);
export function nextOlympics(year) { return OLYMPICS.find(o => o.year >= year) || null; }
// 올림픽은 그해 여름(시즌 전)에 열립니다. 새 해로 넘어갈 때 한 번 판정합니다.
export function runOlympics(s) {
  const o = OLYMPICS.find(x => x.year === s.year);
  if (!o || s.olympics?.[o.year]) return null;
  const p = s.player, r = rng(s);
  s.olympics ||= {};
  const country = p.nat === 'KR' ? '대한민국' : '미국';
  const eligible = FLAG_POS.has(p.pos) && p.age >= 18 && ['college', 'nfl', 'cfl'].includes(s.stage);
  const need = p.nat === 'KR' ? 58 : (s.stage === 'nfl' ? 84 : 86);
  if (!eligible || p.ovr + gauss(r) * 2 < need) { s.olympics[o.year] = { selected: false }; return null; }
  const edge = (p.ovr - need) * .01;
  const roll = r();
  const table = p.nat === 'KR' ? [['gold', .03 + edge], ['silver', .09 + edge], ['bronze', .22 + edge * 1.5]] : [['gold', .6 + edge], ['silver', .82 + edge], ['bronze', .92]];
  const medal = (table.find(([, c]) => roll < c) || [null])[0];
  const name = medal ? `${o.year} 올림픽 플래그 풋볼 ${({ gold: '금메달', silver: '은메달', bronze: '동메달' })[medal]}` : null;
  const res = { selected: true, year: o.year, city: o.city, real: !!o.real, country, medal, name };
  s.olympics[o.year] = res;
  if (medal) {
    (s.pendingAwards ||= []).push({ name, kind: medal === 'gold' ? 'olympicGold' : 'olympicMedal', pts: medal === 'gold' ? 8 : 5 });
    if (p.nat === 'KR' && !s.flags.includes('militaryDone')) { s.flags.push('militaryDone'); res.exemption = true; }
  }
  s.followers = Math.round(s.followers * (medal ? (p.nat === 'KR' ? 1.6 : 1.2) : 1.05));
  s.todos.unshift({ id: 'olympics', year: o.year, seen: false });
  return res;
}

// ───────── 칭호 ─────────
export function titlesOf(s) {
  const h = s.history, nfl = h.filter(isPro), T = totals(nfl), aw = k => countAwards(s, k);
  const maxSeason = k => Math.max(0, ...h.map(x => x.stats?.[k] || 0));
  const teamsN = new Set(nfl.map(x => x.teamId)).size;
  const earned = nfl.reduce((n, x) => n + (x.salary || 0), 0);
  const list = [
    ['rookie', '루키 돌풍', 'NFL 올해의 신인', aw('oroy') + aw('droy') > 0],
    ['mvp', '리그의 지배자', '정규시즌 MVP', aw('mvp') > 0],
    ['ring', '반지의 제왕', '슈퍼볼 우승', aw('sbChamp') > 0],
    ['triple', '트리플 크라운', '주 챔피언십·대학 전국 우승·슈퍼볼 우승을 모두', aw('stateChamp') > 0 && aw('nationalChamp') > 0 && aw('sbChamp') > 0],
    ['heisman', '하이즈먼 위너', '하이즈먼 트로피', aw('heisman') > 0],
    ['thousand', '천 야드 클럽', '한 시즌 1,000야드 (러싱 또는 리시빙)', maxSeason('ryds') >= 1000 || maxSeason('recyds') >= 1000],
    ['air', '에어 레이드', '한 시즌 패싱 4,500야드', maxSeason('pyds') >= 4500],
    ['sack', '색 마스터', '한 시즌 색 15개', maxSeason('sack') >= 15],
    ['hawk', '볼 호크', '한 시즌 인터셉트 7개', maxSeason('dint') >= 7],
    ['iron', '철인', 'NFL 16경기 이상 출전 시즌 5번', nfl.filter(x => x.stats.g >= 16).length >= 5],
    ['franchise', '프랜차이즈 스타', 'NFL 프랜차이즈 역할로 5시즌', nfl.filter(x => x.role === 'key').length >= 5],
    ['walkon', '워크온 신화', '워크온으로 입학해 NFL 주전까지', s.moments.some(m => /워크온/.test(m.text)) && nfl.some(x => ['starter', 'key'].includes(x.role))],
    ['udfa', '언드래프티의 반란', '드래프트 미지명에서 프로볼까지', s.draft && !s.draft.drafted && aw('proBowl') > 0],
    ['twoway', '투웨이 스타', '투웨이로 뛰며 올아메리칸 이상', h.some(x => x.twoWay && x.awards.some(a => ['allAmerican', 'consensusAA', 'proBowl', 'allPro1', 'allPro2'].includes(a.kind)))],
    ['comeback', '불사조', '올해의 재기상', aw('comeback') > 0],
    ['journey', '저니맨', 'NFL 5개 팀 이상', teamsN >= 5],
    ['oneclub', '원클럽맨', '한 팀에서 NFL 8시즌 이상', Object.values(s.teamSeasons || {}).some(n => n >= 8) && teamsN === 1],
    ['olympian', '국가대표', '올림픽 플래그 풋볼 대표 선발', Object.values(s.olympics || {}).some(o => o.selected)],
    ['pioneer', '태극 전사', '한국 국적으로 NFL 프로볼', s.player.nat === 'KR' && aw('proBowl') > 0],
    ['money', '센추리 클럽', 'NFL 통산 연봉 1억 달러', earned >= 1e8],
    ['goat', '역대급', '최고 OVR 93 이상', Math.max(0, ...h.map(x => x.ovrAfter || 0)) >= 93],
    ['td100', '센추리 터치다운', 'NFL 통산 터치다운 100개 (패스 포함)', T.ptd + T.rtd + T.rectd >= 100],
  ];
  return list.map(([id, name, desc, got]) => ({ id, name, desc, got: !!got }));
}
export { usd, POSITIONS, attrsOf };
