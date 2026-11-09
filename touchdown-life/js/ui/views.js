// 화면 템플릿. 상태를 받아 HTML 문자열을 돌려줍니다 (이벤트는 main.js가 data-action으로 처리).
import { POSITIONS, POS_ORDER, ATTR, attrsOf, tierOf, usd, krw, signed, ovrAs, superBowlName, round1, LEVEL_AVG } from '../engine/core.js';
import { TEAM_BY_ID, TEAMS } from '../data/teams.js';
import { COLLEGE_BY_ID, TIER_LABEL } from '../data/colleges.js';
import { HIGH_SCHOOLS, SCHOOL_BY_ID, GRADE_LABEL, COLLEGE_YEAR_LABEL } from '../data/schools.js';
import { ALL_TIME } from '../data/stars.js';
import { ROSTER_SOURCE } from '../data/rosters.js';
import { roleName, depthNames, injuryChance } from '../engine/sim.js';
import { METERS, formOf } from '../engine/events.js';
import { careerScore, countAwards, totals, isPro, hallOfFame, honorsLine } from '../engine/awards.js';
import { talentLabel, marketValue, canRedshirt, seasonLabel, makeCandidates, draftProjection, checkRetirementNudge } from '../engine/career.js';
import { fmtFollowers } from '../engine/social.js';
import { ITEMS, STAFF, FACILITIES, canBuy } from '../engine/shop.js';
import { avatarSvg, fieldBanner, icon, sparkline, esc, AVATAR_OPTIONS, STYLE_NAMES, VISOR_NAMES } from './art.js';

export const TABS = [['home', '홈', 'home'], ['season', '시즌', 'season'], ['player', '선수', 'player'], ['records', '기록', 'records'], ['social', '반응', 'social']];
const nameTag = n => `<span translate="no">${esc(n)}</span>`;
export const teamColors = s => s.team?.kind === 'nfl' ? TEAM_BY_ID[s.team.id].colors : s.team?.kind === 'college' ? COLLEGE_BY_ID[s.team.id].colors : ['#157347', '#FFFFFF'];
const num = n => (Math.round(n * 10) / 10).toLocaleString('ko-KR');
// 숫자 뒤 조사: 0(십)·3(삼)·6(육)은 받침, 1·7·8은 ㄹ받침(로).
const numBatchim = n => [0, 1, 3, 6, 7, 8].includes(Math.abs(n) % 10);
const numRo = n => [0, 3, 6].includes(Math.abs(n) % 10) ? '으로' : '로';
export const passerRating = L => { if (!L.att) return 0; const c = x => Math.max(0, Math.min(2.375, x)); return round1((c((L.cmp / L.att - .3) * 5) + c((L.pyds / L.att - 3) * .25) + c(L.ptd / L.att * 20) + c(2.375 - L.pint / L.att * 25)) / 6 * 100); };

// 포지션별 핵심 기록 (타일·표에 공통으로 씀).
export function keyStats(pos, L, twoPos = null) {
  const g = L || {}, v = k => g[k] || 0, out = [];
  const add = (label, value) => out.push([label, value]);
  const side = p => {
    if (p === 'QB') { add('패싱 야드', num(v('pyds'))); add('TD 패스', v('ptd')); add('INT', v('pint')); add('완성률', v('att') ? `${Math.round(v('cmp') / v('att') * 100)}%` : '-'); add('패서 레이팅', passerRating(g) || '-'); add('러싱 야드', num(v('ryds'))); }
    else if (p === 'RB') { add('러싱 야드', num(v('ryds'))); add('캐리당', v('ratt') ? round1(v('ryds') / v('ratt')) : '-'); add('러싱 TD', v('rtd')); add('리셉션', v('rec')); add('리시빙 야드', num(v('recyds'))); add('리시빙 TD', v('rectd')); }
    else if (p === 'WR' || p === 'TE') { add('리셉션', v('rec')); add('리시빙 야드', num(v('recyds'))); add('리시빙 TD', v('rectd')); add('캐치당', v('rec') ? round1(v('recyds') / v('rec')) : '-'); add('타깃', v('tgt')); if (p === 'TE') add('팬케이크', v('pan')); else add('러싱 야드', num(v('ryds'))); }
    else if (p === 'OL') { add('선발', v('gs')); add('허용 색', v('sa')); add('팬케이크', v('pan')); }
    else if (p === 'DT' || p === 'EDGE') { add('색', v('sack')); add('태클', v('tkl')); add('TFL', v('tfl')); add('강제 펌블', v('ff')); add('패스 디펜스', v('pd')); }
    else if (p === 'LB') { add('태클', v('tkl')); add('색', v('sack')); add('INT', v('dint')); add('패스 디펜스', v('pd')); add('TFL', v('tfl')); }
    else if (p === 'CB' || p === 'S') { add('INT', v('dint')); add('패스 디펜스', v('pd')); add('태클', v('tkl')); add('수비 TD', v('dtd')); }
    else if (p === 'K') { add('필드골', `${v('fgm')}/${v('fga')}`); add('성공률', v('fga') ? `${Math.round(v('fgm') / v('fga') * 100)}%` : '-'); add('최장', v('fglong') ? `${v('fglong')}야드` : '-'); add('PAT', `${v('xpm')}/${v('xpa')}`); }
    else if (p === 'P') { add('펀트', v('punts')); add('평균', v('punts') ? `${round1(v('puntyds') / v('punts'))}야드` : '-'); add('20야드 안쪽', v('in20')); }
  };
  side(pos);
  if (twoPos) side(twoPos);
  return out;
}
const tiles = (list, cls = '') => `<div class="stat-grid ${cls}">${list.map(([l, v]) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`).join('')}</div>`;
function stageText(s) {
  if (s.stage === 'hs') return `${GRADE_LABEL[s.grade]}`;
  if (s.stage === 'college') return `${COLLEGE_YEAR_LABEL[s.collegeYear] || '대학'}${s.redshirt ? ' · 레드셔트' : ''}${s.walkon ? ' · 워크온' : ''}`;
  if (s.stage === 'nfl') return `NFL ${s.proSeasons + (s.phase === 'offseason' ? 0 : 1)}년 차`;
  if (s.stage === 'cfl') return 'CFL';
  if (s.stage === 'military') return '군 복무';
  if (s.stage === 'fa') return 'FA (무소속)';
  return '';
}
export function profileCard(s, compact = false) {
  const p = s.player, last = s.history.at(-1), delta = last ? last.ovrAfter - last.ovrBefore : 0;
  return `<section class="card"><div class="hero">${avatarSvg(p.avatar, teamColors(s), p.number, 64)}
    <div class="grow"><div class="name">${nameTag(p.name)} <span class="muted small">#${p.number}</span></div>
    <div class="small muted">${esc(s.team?.name || '')} · ${POSITIONS[p.pos].ko}${p.twoWay ? `·${POSITIONS[p.twoWay.pos].ko}` : ''} · ${p.age}세</div>
    <div class="tiny faint">${stageText(s)}${p.nat === 'KR' ? ' · 🇰🇷 대한민국' : ' · 🇺🇸 미국'}</div></div>
    <div class="ovr"><small>OVR</small><b>${p.ovr}</b><span class="tier">${tierOf(p.ovr)}</span>${last && !compact ? `<div class="tiny ${delta > 0 ? 'up' : delta < 0 ? 'down' : 'faint'}">지난 시즌 ${delta > 0 ? '▲' : delta < 0 ? '▼' : ''}${Math.abs(delta) || '유지'}</div>` : ''}</div></div></section>`;
}

// ───────── 생성 화면 ─────────
export function setupPage(st) {
  const steps = `<div class="steps">${[0, 1, 2, 3].map(i => `<i class="${i <= st.step ? 'on' : ''}"></i>`).join('')}</div>`;
  const head = `<header class="appbar"><h1><span class="logo">${icon('ball')}</span>터치다운 인생</h1><div class="spacer"></div><button class="icon-btn" data-action="theme" aria-label="다크 모드">${icon('moon')}</button><button class="icon-btn" data-action="archive" aria-label="은퇴 기록">${icon('records')}</button></header>`;
  let body = '';
  if (st.step === 0) {
    const opts = (key, n, labels) => `<div class="seg">${Array.from({ length: n }, (_, i) => `<button data-action="setup-av" data-k="${key}" data-v="${i}" class="${st.avatar[key] === i ? 'on' : ''}">${labels ? labels[i] : `${i + 1}`}</button>`).join('')}</div>`;
    body = `<p class="eyebrow">10학년, 15세. 풋볼부 라커룸에서 시작해요</p><h2>내 선수의 모습을<br>골라 주세요</h2>
      <div class="card flat" style="display:grid;place-items:center">${avatarSvg(st.avatar, ['#157347', '#FFFFFF'], st.number || 0, 132)}</div>
      <div class="field-row"><label>피부 톤</label>${opts('skin', AVATAR_OPTIONS.skin)}</div>
      <div class="field-row"><label>머리 모양</label>${opts('style', AVATAR_OPTIONS.style, STYLE_NAMES)}</div>
      <div class="field-row"><label>머리 색</label>${opts('hair', AVATAR_OPTIONS.hair)}</div>
      <div class="field-row"><label>헬멧 바이저</label>${opts('visor', AVATAR_OPTIONS.visor, VISOR_NAMES)}</div>
      <div class="dock"><button class="primary" data-action="setup-next">이 모습으로 할게요 ${icon('arrow')}</button></div>`;
  } else if (st.step === 1) {
    const school = SCHOOL_BY_ID[st.schoolId];
    body = `<p class="eyebrow">고교 10학년부터 시작해요</p><h2>어떤 선수로<br>살아볼까요?</h2>
      <div class="field-row"><label for="f-name">이름</label><input id="f-name" type="text" maxlength="16" placeholder="닉네임을 추천해요" value="${esc(st.name)}" data-input="name" autocomplete="off"></div>
      <div class="field-row"><label for="f-num">등번호</label><input id="f-num" type="number" min="0" max="99" inputmode="numeric" value="${esc(st.number)}" data-input="number"></div>
      <div class="field-row"><label>포지션</label><div class="pos-grid">${POS_ORDER.map(k => `<button data-action="setup-pos" data-v="${k}" class="${st.pos === k ? 'on' : ''}"><b>${k}</b><span>${POSITIONS[k].ko}</span></button>`).join('')}</div></div>
      <div class="field-row"><label>국적</label><div class="seg"><button data-action="setup-nat" data-v="US" class="${st.nat === 'US' ? 'on' : ''}">🇺🇸 미국</button><button data-action="setup-nat" data-v="KR" class="${st.nat === 'KR' ? 'on' : ''}">🇰🇷 대한민국 (유학)</button></div>
        <p class="tiny muted" style="margin-top:6px">${st.nat === 'KR' ? '한국 국적이면 언론 반응이 커지고, NFL에서 병역 결정을 내려야 하는 순간이 옵니다.' : '미국에서 나고 자란 선수로 시작합니다.'}</p></div>
      <div class="field-row"><label for="f-school">고등학교</label><select id="f-school" data-input="schoolId">${HIGH_SCHOOLS.map(h => `<option value="${h.id}" ${h.id === st.schoolId ? 'selected' : ''}>${esc(h.ko)} · ${esc(h.city)}</option>`).join('')}</select>
        <p class="tiny muted" style="margin-top:6px">${esc(school.note)} · 명문일수록 스카우트 노출이 크지만 주전 경쟁이 치열해요.</p></div>
      <div class="dock"><button class="primary" data-action="setup-next" ${st.name.trim() && st.number !== '' ? '' : 'disabled'}>다음 ${icon('arrow')}</button><button class="ghost" data-action="setup-back">이전 단계</button></div>`;
  } else if (st.step === 2) {
    const cands = makeCandidates(st.pos, `${st.name}:${st.pos}:${st.seedN}`);
    body = `<p class="eyebrow">${nameTag(st.name)} · ${POSITIONS[st.pos].ko}</p><h2>플레이 스타일을<br>골라 주세요</h2>
      <p class="muted small" style="margin-top:6px">세 후보 모두 OVR 45, 능력치 합 240이에요. 분포만 달라요.</p>
      ${cands.map((c, i) => `<button class="cand ${st.cand === i ? 'on' : ''}" data-action="setup-cand" data-v="${i}"><div class="row between"><strong>${esc(c.label)}</strong><span class="pill green">OVR ${c.ovr}</span></div>
        <div class="tiny muted">${c.strong.filter(k => ATTR[k] && c.attrs[k] !== undefined).map(k => ATTR[k][0]).join(' · ')}</div>
        <div class="mini">${attrsOf(st.pos).map(k => `<div><b class="${c.strong.includes(k) ? 'accent' : ''}">${c.attrs[k]}</b><span>${ATTR[k][0]}</span></div>`).join('')}</div></button>`).join('')}
      <button class="ghost" data-action="setup-reroll">다른 후보 보기</button>
      <div class="dock"><button class="primary" data-action="setup-next" ${st.cand === null ? 'disabled' : ''}>이 스타일로 할게요 ${icon('arrow')}</button><button class="ghost" data-action="setup-back">이전 단계</button></div>`;
  } else {
    const c = makeCandidates(st.pos, `${st.name}:${st.pos}:${st.seedN}`)[st.cand];
    body = `<p class="eyebrow">${esc(c.label)} · OVR ${c.ovr}</p><h2>집중해서 키울 능력치를<br>골라 주세요</h2>
      <p class="muted small" style="margin-top:6px">최대 2개. 고른 능력치가 훨씬 빨리 자라고, 커리어 중 전환점에서 바꿀 수 있어요.</p>
      <div class="card flat">${attrsOf(st.pos).map(k => `<button class="option ${st.focus.includes(k) ? 'sel' : ''}" data-action="setup-focus" data-v="${k}" style="margin-top:8px"><div class="row between"><strong>${ATTR[k][0]}</strong><b>${c.attrs[k]}</b></div><div class="sub">${ATTR[k][1]} · OVR 비중 ${Math.round(POSITIONS[st.pos].w[k] * 100)}%</div></button>`).join('')}</div>
      <div class="card"><div class="hero">${avatarSvg(st.avatar, ['#157347', '#FFFFFF'], st.number, 56)}<div class="grow"><div class="name">${nameTag(st.name)}</div><div class="small muted">${esc(SCHOOL_BY_ID[st.schoolId].ko)} · ${POSITIONS[st.pos].ko} · #${esc(st.number)}</div><div class="tiny faint">${esc(c.label)} · 능력치 합 240 · 집중 육성 ${st.focus.map(k => ATTR[k][0]).join(', ') || '-'}</div></div></div></div>
      <div class="dock"><button class="primary" data-action="setup-create" ${st.focus.length ? '' : 'disabled'}>10학년 시즌 시작 ${icon('arrow')}</button><button class="ghost" data-action="setup-back">이전 단계</button></div>`;
  }
  return `<div class="shell setup">${head}${steps}${body}<p class="footer">가입 없이 플레이 · 이 브라우저에 자동 저장<br>실제 구단·선수 이름은 위키백과 로스터(2026-11) 기준, 능력치와 결과는 게임 속 가상의 값입니다.</p></div>`;
}

// ───────── 홈 ─────────
export function appBar(s) {
  return `<header class="appbar"><h1><span class="logo">${icon('ball')}</span>터치다운 인생</h1><div class="spacer"></div>
    ${s.phase !== 'retired' ? `<button class="money-chip" data-action="open-shop" aria-label="훈련장">${icon('shop')}${usd(s.money)}</button>` : ''}
    <button class="icon-btn" data-action="theme" aria-label="다크 모드">${icon('moon')}</button><button class="icon-btn" data-action="settings" aria-label="설정">${icon('settings')}</button></header>`;
}
export function tabBar(tab, s) {
  const fresh = s.todos.some(t => !t.seen);
  return `<div class="tabbar"><nav>${TABS.map(([id, label, ic]) => `<button class="tab ${tab === id ? 'active' : ''}" data-tab="${id}">${icon(ic)}<span>${label}</span>${id === 'home' && fresh && tab !== 'home' ? '<i class="dot"></i>' : ''}</button>`).join('')}</nav></div>`;
}
function soFar(s) {
  const z = s.season, p = s.player, L = z.line, played = z.games.filter(g => g.played).length;
  const pace = played ? z.games.length / played : 0, form = formOf(s);
  const key = keyStats(p.pos, L, p.twoWay?.pos).slice(0, 4);
  const paceLine = (() => {
    if (!played || !L.g) return '아직 출전 기록이 없어요.';
    const k = { QB: ['pyds', '패싱 야드'], RB: ['ryds', '러싱 야드'], WR: ['recyds', '리시빙 야드'], TE: ['recyds', '리시빙 야드'], DT: ['sack', '색'], EDGE: ['sack', '색'], LB: ['tkl', '태클'], CB: ['dint', 'INT'], S: ['dint', 'INT'], K: ['fgm', '필드골'], P: ['in20', '20야드 안쪽 펀트'], OL: ['pan', '팬케이크'] }[p.pos];
    return `이 페이스면 시즌 ${num(Math.round((L[k[0]] || 0) * pace))} ${k[1]}`;
  })();
  return `<section class="card"><div class="row between"><h3>지금까지 성적</h3><span class="tiny muted">${esc(z.segLabels[Math.max(0, z.seg - 1)] || '개막 전')}</span></div>
    <div class="row" style="gap:8px;margin:8px 0"><span class="pill">${L.w}승 ${L.l}패</span><span class="pill green">${roleName(s, z.role)}</span><span class="pill">${L.g}경기${L.gs ? ` · 선발 ${L.gs}` : ''}</span>${L.g ? `<span class="pill ${form === 'hot' ? 'red' : form === 'slump' ? 'blue' : ''}">평점 ${round1(L.gradeSum / L.g)}${form === 'hot' ? ' 🔥' : form === 'slump' ? ' ❄️' : ''}</span>` : ''}</div>
    ${tiles(key, 'four')}<p class="small muted" style="margin-top:8px">${paceLine}${z.injury?.out > 0 ? ` · <span class="up">${esc(z.injury.kind)} (${z.injury.out >= 90 ? '시즌 아웃' : `${z.injury.out}경기 결장 예정`})</span>` : ''}</p></section>`;
}
function progress(s) {
  const z = s.season, labels = [...z.segLabels, '포스트시즌'];
  return `<div class="segments">${labels.map((_, i) => `<i class="${i < z.seg ? 'done' : i === z.seg ? 'now' : ''}"></i>`).join('')}</div><div class="seg-labels">${labels.map(l => `<span>${esc(l)}</span>`).join('')}</div>`;
}
function cardView(s) {
  const c = s.card, def = CARD_INDEX[c.id];
  return `<section class="card">${fieldBanner(teamColors(s), def.title, s.stage === 'nfl' ? 'helmet' : 'ball')}
    <p class="eyebrow" style="margin-top:12px">${esc(c.label)} · ${esc(def.eyebrow)}</p><h2 style="margin-top:2px">${esc(def.title)}</h2>
    <p class="muted" style="margin-top:6px">${esc(def.body)}</p>
    ${c.choices.map(x => `<button class="choice" data-action="choose-card" data-v="${x.i}"><strong>${esc(x.label)}</strong>${x.hint ? `<div class="hint">${esc(x.hint)}</div>` : ''}<div class="chance">성공 확률 ${x.chance}%</div></button>`).join('')}
    <p class="tiny faint" style="margin-top:10px">선택하면 바로 반영됩니다. 확률은 보이는 그대로 굴려요.</p></section>`;
}
let CARD_INDEX = {};
export const setCardIndex = idx => { CARD_INDEX = idx; };
function cardResultView(s) {
  const r = s.cardResult;
  return `<section class="card"><p class="eyebrow">선택 결과 · ${esc(r.title)}</p>
    <div class="roll" aria-hidden="true"><span style="width:${r.chance}%"></span><i style="left:${Math.min(99, r.roll)}%"></i></div>
    <div class="tiny faint">성공 ${r.chance}% · 주사위 ${r.roll}</div>
    <div class="result-box ${r.ok ? '' : 'fail'}" style="margin-top:10px"><div class="verdict ${r.ok ? 'accent' : 'up'}">${r.ok ? '성공' : '실패'}</div><div class="small" style="margin-top:2px">"${esc(r.choice)}"</div><p style="margin-top:6px">${esc(r.text)}</p>
    ${r.lines.length ? `<div class="lines">${r.lines.map(l => `<span class="pill">${esc(l)}</span>`).join('')}</div>` : ''}</div></section>`;
}
function prepView(s) {
  const plans = [['balanced', '균형 훈련', '모든 능력치를 고르게'], ['intense', '집중 훈련', '집중 육성 능력치 성장 ↑'], ['recovery', '회복 중심', '부상·누적 피로 관리']];
  return `<section class="card"><div class="row between"><h3>${s.year} 시즌 준비</h3><span class="pill">${stageText(s)}</span></div>
    ${s.goal ? `<div class="result-box" style="margin-top:10px"><div class="tiny muted">이번 목표</div><b>${esc(s.goal.title)}</b><div class="tiny muted">${esc(s.goal.hint)}</div></div>` : ''}
    <div class="field-row"><label>훈련 계획</label>${plans.map(([id, l, d]) => `<button class="option ${s.training === id ? 'sel' : ''}" data-action="training" data-v="${id}"><div class="row between"><strong>${l}</strong><span class="pill ${id === 'intense' ? 'red' : id === 'recovery' ? 'green' : ''}">부상 확률 약 ${Math.round(injuryChance(s, id) * 100)}%</span></div><div class="sub">${d}</div></button>`).join('')}</div>
    ${canRedshirt(s) ? `<div class="field-row"><label>레드셔트</label><button class="option ${s.redshirt ? 'sel' : ''}" data-action="redshirt"><strong>${s.redshirt ? '레드셔트 시즌으로 보내기 (켜짐)' : '레드셔트 시즌으로 보내기'}</strong><div class="sub">최대 4경기만 뛰고 출전 자격 1년을 아낍니다. 대학 생활 중 한 번만 쓸 수 있어요.</div></button></div>` : ''}
    ${s.stage === 'nfl' ? depthCard(s) : ''}</section>`;
}
function depthCard(s) {
  const d = depthNames(s);
  if (!d.length) return '';
  return `<div class="field-row"><label>${s.team.name} ${POSITIONS[s.player.pos].ko} 뎁스 차트 경쟁자</label><div class="table-wrap"><table><tbody>${d.map((x, i) => `<tr><td class="l">${i + 1}. ${nameTag(x.name)}</td><td>${x.age}세</td><td><b>${x.ovr}</b></td></tr>`).join('')}<tr class="mine"><td class="l">나 · ${nameTag(s.player.name)}</td><td>${s.player.age}세</td><td><b>${s.player.ovr}</b></td></tr></tbody></table></div></div>`;
}
const TODO_META = {
  report: (s, t) => ['시즌 결과가 나왔어요', `${t.year} 시즌 · ${s.history.find(h => h.year === t.year)?.teamName || ''}`, 'records', ''],
  broadcast: (s, t) => ['결승전 중계가 준비됐어요', s.history.find(h => h.year === t.year)?.broadcast?.title || '', 'tv', 'gold'],
  draft: (s) => [s.draft?.drafted ? '드래프트 결과가 나왔어요' : '드래프트가 끝났어요', s.draft?.drafted ? `${s.draft.round}라운드 ${s.draft.inRound}순위` : '언드래프티 FA', 'draft', 'blue'],
  turning: (s, t) => ['전환점이 찾아왔어요', t.title, 'bolt', 'gold'],
  shop: () => ['새 상품이 입고됐어요', '번 돈으로 한 시즌에 하나를 살 수 있어요.', 'shop', ''],
};
function todoList(s) {
  const items = s.todos.filter(t => !t.done || t.id !== 'turning').filter(t => TODO_META[t.id]);
  const path = s.phase === 'offseason' && s.path;
  const rows = [
    ...(path ? [`<button class="todo" data-action="open-path"><span class="badge red">${icon('door')}</span><span class="grow"><strong>${esc(path.title)}</strong><small>다음 진로를 정할 차례예요 · ${path.options.length}개의 길</small></span><i class="new"></i>${icon('chevron', 'chev')}</button>`] : []),
    ...items.map(t => { const [a, b, ic, tone] = TODO_META[t.id](s, t); return `<button class="todo" data-action="open-todo" data-v="${t.id}"><span class="badge ${tone}">${icon(ic)}</span><span class="grow"><strong>${esc(a)}</strong><small>${esc(b)}</small></span>${t.seen ? '' : '<i class="new"></i>'}${icon('chevron', 'chev')}</button>`; }),
    `<button class="todo" data-action="tab" data-v="player"><span class="badge">${icon('star')}</span><span class="grow"><strong>집중 육성 중</strong><small>${s.player.focus.map(k => ATTR[k]?.[0]).join(', ')}</small></span>${icon('chevron', 'chev')}</button>`,
  ];
  return `<section class="card"><h3>확인할 일</h3><div style="margin-top:4px">${rows.join('')}</div></section>`;
}
export function homePage(s) {
  const p = s.player, T = totals(s.history.filter(isPro)), A = totals(s.history);
  if (s.phase === 'retired') return retiredPage(s);
  const career = s.history.some(isPro) ? [['NFL 경기', T.g], ['NFL TD', T.ptd + T.rtd + T.rectd + T.dtd], ['NFL 수상', s.history.filter(isPro).reduce((n, h) => n + h.awards.length, 0)]] : [['통산 경기', A.g], ['총 TD', A.ptd + A.rtd + A.rectd + A.dtd], ['수상', s.history.reduce((n, h) => n + h.awards.length, 0)]];
  let main = '', dock = '';
  if (s.phase === 'ready') { main = prepView(s); dock = `<button class="primary" data-action="start-season">${s.year} ${s.stage === 'military' ? '복무 시즌 보내기' : `${seasonLabel(s)} 시즌 시작`} ${icon('arrow')}</button>`; }
  else if (s.phase === 'season') { main = `<section class="card"><div class="row between"><h3>${s.year} 시즌 진행 중</h3><span class="tiny muted">${esc(s.team.name)}</span></div>${progress(s)}</section>${s.cardResult ? cardResultView(s) : ''}${soFar(s)}`; dock = `<button class="primary" data-action="advance">${s.season.seg >= s.season.segments.length ? '포스트시즌으로' : '계속하기'} ${icon('arrow')}</button>`; }
  else if (s.phase === 'card') { main = `<section class="card"><div class="row between"><h3>${s.year} 시즌 · 선택의 순간</h3><span class="tiny muted">${esc(s.team.name)}</span></div>${progress(s)}</section>${cardView(s)}${soFar(s)}`; }
  else if (s.phase === 'offseason') { main = todoList(s); dock = s.path ? `<button class="primary" data-action="open-path">다음 진로 정하기 ${icon('arrow')}</button>` : ''; }
  const nudge = s.phase === 'offseason' && checkRetirementNudge(s) ? `<p class="small muted" style="text-align:center;margin-top:6px">구단이 조심스럽게 은퇴 이야기를 꺼냈어요.</p>` : '';
  return `${profileCard(s)}<section class="card"><div class="stat-grid">${career.map(([l, v]) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`).join('')}</div></section>${main}
    ${dock ? `<div class="dock">${dock}</div>` : ''}${nudge}
    ${['ready', 'offseason'].includes(s.phase) ? `<button class="ghost" data-action="retire-ask">지금 은퇴하기</button>` : ''}`;
}

// ───────── 시즌 탭 ─────────
export function seasonPage(s) {
  const z = s.season || s.lastSeason, p = s.player;
  if (!z) return `${profileCard(s, true)}<section class="card"><h3>아직 치른 시즌이 없어요</h3><p class="muted small">홈에서 첫 시즌을 시작하세요.</p></section>`;
  const live = !!s.season;
  const games = z.games.filter(g => g.played !== false && g.res);
  const rows = games.map(g => `<tr><td class="l">${g.wk > 99 ? '포스트' : `${g.wk}주`}</td><td class="l">${g.home ? 'vs' : '@'} ${esc(g.oppName)}</td><td class="${g.res === 'W' ? 'res-w' : 'res-l'}">${g.res === 'W' ? '승' : '패'} ${g.pf}-${g.pa}</td><td>${g.grade ?? '-'}</td><td class="l small">${g.injury ? `<span class="up">${esc(g.injury)}</span>` : esc(lineText(p.pos, g.line))}</td></tr>`).join('');
  const post = (z.post?.rounds || []).map(g => `<tr><td class="l">${esc(g.round)}</td><td class="l">${esc(g.oppName)}</td><td class="${g.res === 'W' ? 'res-w' : 'res-l'}">${g.res === 'W' ? '승' : '패'} ${g.pf}-${g.pa}</td><td>${g.grade ?? '-'}</td><td class="l small">${esc(lineText(p.pos, g.line))}</td></tr>`).join('');
  return `${profileCard(s, true)}<section class="card"><div class="row between"><h3>${z.year} 시즌 일정 ${live ? '' : '(지난 시즌)'}</h3><span class="pill">${z.line.w}승 ${z.line.l}패</span></div>
    ${z.post?.result ? `<p class="small muted" style="margin-top:4px">포스트시즌: ${esc(z.post.result)}</p>` : ''}
    <div class="table-wrap" style="margin-top:8px"><table><thead><tr><th class="l">주차</th><th class="l">상대</th><th>결과</th><th>평점</th><th class="l">내 기록</th></tr></thead><tbody>${rows}${post}</tbody></table></div></section>
    ${z.standings ? standingsCard(s, z) : ''}
    ${s.stage === 'nfl' ? `<section class="card">${depthCard(s)}</section>` : ''}
    <section class="card"><h3>시즌별 요약</h3><div style="margin-top:8px">${[...s.history].reverse().map(h => `<div class="kv"><span>${h.year} · ${esc(h.teamName)} · ${esc(h.label || '')}</span><b>${h.stage === 'military' ? '복무' : `${h.stats.g || 0}경기 · 평점 ${h.grade || '-'}`}</b></div>`).join('')}</div></section>`;
}
function lineText(pos, L) {
  if (!L || !Object.keys(L).length) return '출전 안 함';
  return keyStats(pos, L).slice(0, 3).filter(([, v]) => v && v !== '-' && v !== '0/0').map(([l, v]) => `${l} ${v}`).join(' · ') || '출전';
}
function standingsCard(s, z) {
  const me = TEAM_BY_ID[s.team.id], rows = z.standings.rows.filter(r => TEAM_BY_ID[r.id].div === me.div).sort((a, b) => b.w - a.w);
  const seeds = z.standings.seeds[me.conf];
  return `<section class="card"><h3>${esc(me.div)} 순위</h3><div class="table-wrap" style="margin-top:6px"><table><thead><tr><th class="l">팀</th><th>승</th><th>패</th><th>시드</th></tr></thead><tbody>${rows.map(r => `<tr class="${r.id === me.id ? 'mine' : ''}"><td class="l">${esc(TEAM_BY_ID[r.id].ko)}</td><td>${r.w}</td><td>${r.l}</td><td>${seeds.indexOf(r.id) + 1 || '-'}</td></tr>`).join('')}</tbody></table></div>
    <p class="tiny faint" style="margin-top:6px">${esc(me.conf)} 플레이오프 시드: ${seeds.map((id, i) => `${i + 1}.${TEAM_BY_ID[id].short}`).join(' ')}</p></section>`;
}

// ───────── 선수 탭 ─────────
export function playerPage(s) {
  const p = s.player, last = s.history.at(-1), keys = attrsOf(p.pos);
  const alts = POS_ORDER.filter(x => x !== p.pos && !['K', 'P'].includes(x) && !['K', 'P'].includes(p.pos)).map(x => [x, ovrAs(p.attrs, x)]).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const c = s.contract, mv = s.stage === 'nfl' ? marketValue(s) : null;
  const scouted = s.history.length >= 1;
  return `${profileCard(s, true)}
    <section class="card"><div class="row between"><h3>능력치</h3><span class="tiny muted">초록색은 집중 육성</span></div>
      ${keys.map(k => { const d = last?.changes?.[k] || 0; return `<div class="attr ${p.focus.includes(k) ? 'focus' : ''}"><label title="${esc(ATTR[k][1])}">${ATTR[k][0]}</label><div class="bar"><span style="width:${p.attrs[k]}%"></span></div><div class="v">${p.attrs[k]}${d ? `<small class="${d > 0 ? 'up' : 'down'}">${d > 0 ? '+' : ''}${d}</small>` : ''}</div></div>`; }).join('')}
      ${p.twoWay ? `<p class="small" style="margin-top:8px"><span class="pill gold">투웨이</span> ${POSITIONS[p.twoWay.pos].ko} OVR <b>${p.twoWay.ovr}</b></p>` : ''}
      <p class="tiny muted" style="margin-top:8px">OVR은 포지션별 능력치 가중평균입니다. 같은 능력치로 본 다른 포지션: ${alts.map(([x, o]) => `${POSITIONS[x].ko} ${o}`).join(' · ') || '-'}</p></section>
    <section class="card"><h3>스카우트 리포트</h3>
      <div class="kv"><span>성장 속도</span><b>${scouted ? talentLabel(p) : '첫 시즌 뒤 공개'}</b></div>
      <div class="kv"><span>전성기 예상</span><b>${POSITIONS[p.pos].peak - 2}~${POSITIONS[p.pos].peak + 1}세</b></div>
      <div class="kv"><span>몸 상태</span><b>${s.meters.body >= 6 ? '피로 누적 (부상 주의)' : s.meters.body >= 3 ? '약간 무거움' : '양호'}</b></div>
      ${s.stage === 'college' && s.history.some(h => h.stage === 'college') ? `<div class="kv"><span>드래프트 예상</span><b>${s.flags.includes('advisory') || s.collegeYear >= 3 ? draftProjection(s).label : '자문 위원회 평가 전'}</b></div>` : ''}
      ${s.recruiting ? `<div class="kv"><span>리크루팅</span><b>${'★'.repeat(s.recruiting.stars)}${s.recruiting.rank ? ` · 전국 ${s.recruiting.rank}위` : ''}</b></div>` : ''}</section>
    <section class="card"><h3>관계</h3>${Object.entries(METERS).map(([k, l]) => `<div class="meter"><span>${l}</span><div class="bar"><span style="width:${k === 'body' ? s.meters[k] * 10 : s.meters[k]}%;${k === 'body' ? 'background:var(--red)' : ''}"></span></div><b>${k === 'body' ? s.meters[k] : Math.round(s.meters[k])}</b></div>`).join('')}</section>
    <section class="card"><h3>선수 정보</h3>
      <div class="kv"><span>소속</span><b>${esc(s.team?.name || '-')}</b></div>
      <div class="kv"><span>단계</span><b>${stageText(s)}</b></div>
      ${c ? `<div class="kv"><span>계약</span><b>${c.type === 'rookie' ? `루키 계약 (${c.round}라운드)` : c.type === 'ps' ? '연습생' : c.type === 'tag' ? '프랜차이즈 태그' : c.type === 'cfl' ? 'CFL 계약' : '베테랑 계약'} · 남은 ${c.yearsLeft}년</b></div><div class="kv"><span>연봉</span><b>${usd(c.aav)} <span class="tiny muted">(${krw(c.aav)})</span></b></div>` : ''}
      ${mv ? `<div class="kv"><span>추정 시장 가치</span><b>연 ${usd(mv)}</b></div>` : ''}
      <div class="kv"><span>보유 자금</span><b>${usd(s.money)}</b></div>
      ${p.nat === 'KR' ? `<div class="kv"><span>병역</span><b>${s.flags.includes('militaryDone') ? '해결' : s.stage === 'military' ? '복무 중' : '미필'}</b></div>` : ''}
      <div class="kv"><span>팔로워</span><b>${fmtFollowers(s.followers)}</b></div></section>`;
}

// ───────── 기록 탭 ─────────
const KIND_LABEL = [['mvp', 'MVP'], ['sbChamp', '슈퍼볼 우승'], ['sbMVP', '슈퍼볼 MVP'], ['opoy', '올해의 공격'], ['dpoy', '올해의 수비'], ['allPro1', '올프로 1팀'], ['allPro2', '올프로 2팀'], ['proBowl', '프로볼'], ['oroy', '공격 신인왕'], ['droy', '수비 신인왕'], ['title', '개인 타이틀'], ['comeback', '재기상'], ['wpmoy', '월터 페이턴'], ['heisman', '하이즈먼'], ['nationalChamp', '전국 우승'], ['positionAward', '포지션상'], ['consensusAA', '컨센서스 AA'], ['allAmerican', '올아메리칸'], ['confPOY', '컨퍼런스 POY'], ['allConf', '올 컨퍼런스'], ['stateChamp', '주 우승'], ['statePOY', '주 올해의 선수'], ['hsAA', '고교 AA'], ['allState', '올스테이트'], ['greyCup', '그레이컵'], ['cflMOP', 'CFL MOP']];
export function trophyShelf(s) {
  const items = KIND_LABEL.map(([k, l]) => [l, countAwards(s, k)]).filter(x => x[1]);
  return items.length ? `<div class="shelf">${items.map(([l, n]) => `<div class="trophy">${icon('trophy')}<b>${n}</b><span>${l}</span></div>`).join('')}</div>` : '<p class="muted small">아직 트로피가 없어요. 첫 트로피를 향해!</p>';
}
function totalsTable(s) {
  const groups = [['NFL', h => h.stage === 'nfl'], ['대학', h => h.stage === 'college'], ['고교', h => h.stage === 'hs'], ['CFL', h => h.stage === 'cfl']].filter(([, f]) => s.history.some(f));
  return groups.map(([label, f]) => { const T = totals(s.history, f); return `<div style="margin-top:10px"><div class="eyebrow">${label} 통산 · ${T.g}경기</div>${tiles(keyStats(s.player.pos, T, s.player.twoWay?.pos).slice(0, 6), '')}</div>`; }).join('');
}
export function recordsPage(s) {
  const p = s.player;
  const head = keyStats(p.pos, {}).slice(0, 3).map(([l]) => l);
  return `${profileCard(s, true)}<section class="card"><div class="row between"><h3>트로피 진열장</h3><span class="tiny muted">${honorsLine(s) || ''}</span></div><div style="margin-top:10px">${trophyShelf(s)}</div></section>
    <section class="card"><h3>시즌 기록</h3><div class="table-wrap" style="margin-top:8px"><table><thead><tr><th class="l">연도</th><th class="l">팀</th><th>G</th>${head.map(h => `<th>${h}</th>`).join('')}<th>평점</th><th>OVR</th></tr></thead><tbody>
      ${s.history.map(h => `<tr><td class="l">${h.year}</td><td class="l">${esc(shortTeam(h))}<div class="tiny faint">${esc(h.roleName || '')}</div></td><td>${h.stats.g || 0}</td>${keyStats(h.pos, h.stats).slice(0, 3).map(([, v]) => `<td>${v}</td>`).join('')}<td>${h.grade || '-'}</td><td>${h.ovrAfter}</td></tr>${h.awards?.length ? `<tr><td></td><td class="l tiny gold" colspan="${head.length + 4}">${h.awards.map(a => esc(a.name)).join(' · ')}</td></tr>` : ''}`).join('')}</tbody></table></div></section>
    <section class="card"><h3>통산 기록</h3>${totalsTable(s) || '<p class="muted small">기록이 쌓이면 여기에 보여요.</p>'}</section>
    <section class="card"><h3>커리어의 순간</h3><ul class="timeline" style="margin-top:6px">${[...s.moments].reverse().slice(0, 40).map(m => `<li><b>${m.year}</b><span>${esc(m.text)}</span></li>`).join('')}</ul></section>`;
}
const shortTeam = h => h.stage === 'nfl' ? (TEAM_BY_ID[h.teamId]?.short || h.teamName) : h.teamName;

// ───────── 반응 탭 ─────────
export function socialPage(s) {
  return `${profileCard(s, true)}<section class="card"><div class="row between"><h3>팔로워</h3><b class="big" style="font-size:26px">${fmtFollowers(s.followers)}</b></div>${sparkline(s.followerHistory)}</section>
    <section class="card"><h3>언론 · 팬 반응</h3>${s.feed.length ? s.feed.map(f => `<div class="post"><div class="eyebrow">${f.year} 시즌 · ${esc(f.outlet)}</div><div class="headline">${esc(f.headline)}</div>
      ${f.comments.map(c => `<div class="comment"><span class="face">${esc(c.who[0].toUpperCase())}</span><div><div class="meta">${esc(c.who)} · <span class="pill">${esc(c.tag)}</span></div><div>${esc(c.text)}</div><div class="meta">${esc(c.where)} · ${esc(c.ago)}</div></div><span class="likes">♥ ${c.likes.toLocaleString('ko-KR')}</span></div>`).join('')}
      <p class="tiny ${f.delta >= 0 ? 'accent' : 'down'}">팔로워 ${f.delta >= 0 ? '▲' : '▼'}${Math.abs(f.delta).toLocaleString('ko-KR')}</p></div>`).join('') : '<p class="muted small">시즌을 마치면 기사와 팬 반응이 올라와요.</p>'}
      <p class="tiny faint" style="margin-top:8px">매체·커뮤니티·닉네임은 모두 게임 속 가상의 반응이에요.</p></section>`;
}

// ───────── 은퇴 ─────────
export function retiredPage(s) {
  const L = s.legacy || {}, T = L.totals || totals(s.history.filter(isPro)), p = s.player, hof = L.hof || hallOfFame(s);
  const cmp = Object.entries(ALL_TIME).filter(([k]) => ({ passYds: 'pyds', passTD: 'ptd', rushYds: 'ryds', rushTD: 'rtd', rec: 'rec', recYds: 'recyds', recTD: 'rectd', sacks: 'sack', int: 'dint', points: null })[k] !== undefined)
    .map(([k, v]) => { const key = { passYds: 'pyds', passTD: 'ptd', rushYds: 'ryds', rushTD: 'rtd', rec: 'rec', recYds: 'recyds', recTD: 'rectd', sacks: 'sack', int: 'dint', points: 'pts' }[k]; const mine = key === 'pts' ? (T.fgm * 3 + T.xpm + (T.ptd ? 0 : 0) + (T.rtd + T.rectd + T.dtd) * 6) : T[key] || 0; return [v, mine]; })
    .filter(([, mine]) => mine > 0).sort((a, b) => b[1] / b[0].value - a[1] / a[0].value).slice(0, 4);
  return `<section class="card" style="text-align:center">${avatarSvg(p.avatar, teamColors(s), p.number, 96, true)}
    <p class="eyebrow" style="margin-top:10px">${s.startYear}–${s.retiredYear} · ${POSITIONS[p.pos].ko}</p><h2 style="font-size:24px">${nameTag(p.name)}의 풋볼 인생</h2>
    <div class="row" style="justify-content:center;gap:8px;margin-top:10px"><span class="pill gold">커리어 등급 ${L.grade}</span><span class="pill green">점수 ${L.score}</span><span class="pill">최고 OVR ${L.peak}</span></div>
    <p class="small" style="margin-top:10px">${esc(honorsLine(s) || '수상 기록 없음')}</p></section>
    <section class="card"><h3>명예의 전당</h3><p style="margin-top:6px">${esc(hof.verdict)}</p>${(L.legend || []).map(x => `<p class="small" style="margin-top:6px"><span class="pill gold">${x.kind === 'number' ? '영구결번' : '링 오브 아너'}</span> ${esc(x.text)}</p>`).join('')}${L.oneClub ? '<p class="small" style="margin-top:6px"><span class="pill green">원클럽맨</span> 한 팀에서만 NFL 커리어를 보냈습니다.</p>' : ''}</section>
    ${cmp.length ? `<section class="card"><h3>역대 기록과 비교</h3>${cmp.map(([v, mine]) => `<div class="kv"><span>${esc(v.label)}<div class="tiny faint">역대 1위 ${esc(v.holder)} ${v.value.toLocaleString('ko-KR')}</div></span><b>${num(mine)} <span class="tiny muted">(${Math.round(mine / v.value * 100)}%)</span></b></div>`).join('')}</section>` : ''}
    <section class="card"><h3>트로피</h3><div style="margin-top:10px">${trophyShelf(s)}</div></section>
    <section class="card"><h3>인생 이야기</h3><ul class="timeline" style="margin-top:6px">${s.moments.map(m => `<li><b>${m.year}</b><span>${esc(m.text)}</span></li>`).join('')}</ul></section>
    <div class="dock"><button class="primary" data-action="share-card">${icon('download')} 커리어 카드 저장</button><button class="secondary" data-action="new-career" style="margin-top:8px">${icon('plus')} 새로운 인생 시작하기</button></div>`;
}

// ───────── 시트 ─────────
export function sheet(content) { return `<div class="backdrop" data-action="sheet-bg"><div class="sheet" role="dialog" aria-modal="true"><button class="icon-btn close" data-action="close-sheet" aria-label="닫기">${icon('close')}</button>${content}</div></div>`; }
export function reportSheet(s, year) {
  const h = s.history.find(x => x.year === year) || s.history.at(-1), p = s.player;
  if (h.stage === 'military') return sheet(`<p class="eyebrow">${h.year} · 군 복무</p><h2>복무 시즌을 보냈어요</h2><p class="lead">개인 정비 시간에 틈틈이 몸을 만들었습니다. OVR ${h.ovrAfter}.</p><button class="primary" data-action="close-sheet" style="margin-top:16px">확인</button>`);
  const d = h.ovrAfter - h.ovrBefore, keys = Object.keys(h.changes || {});
  return sheet(`<p class="eyebrow">${h.year} · ${esc(h.teamName)} · ${esc(h.label || '')}</p><h2>${esc(h.label || '')} 시즌이 끝났어요<br>종합 능력치가 <span class="accent">${h.ovrAfter}</span>${d ? `${numRo(h.ovrAfter)} ${d > 0 ? '올랐어요' : '내려갔어요'}` : `${numBatchim(h.ovrAfter) ? '을' : '를'} 유지했어요`}</h2>
    <div class="growth-grid">${keys.map(k => `<div class="g ${p.focus.includes(k) ? 'focus' : ''} pop"><small class="muted">${ATTR[k]?.[0]}</small><b>${h.attrsAfter[k]}</b><small class="${h.changes[k] > 0 ? 'up' : h.changes[k] < 0 ? 'down' : 'faint'}">${h.changes[k] > 0 ? `▲${h.changes[k]}` : h.changes[k] < 0 ? `▼${-h.changes[k]}` : '유지'}</small></div>`).join('')}</div>
    ${h.breakout ? `<p class="small" style="margin-top:8px"><span class="pill red">급성장</span> ${ATTR[h.breakout][0]}, 한 단계 올라섰어요.</p>` : ''}
    ${(h.crossed || []).map(t => `<p class="small" style="margin-top:6px"><span class="pill green">${esc(t)} 진입</span></p>`).join('')}
    <div style="margin-top:14px"><div class="kv"><span>역할</span><b>${esc(h.roleName)}${h.startRole !== h.role ? ` <span class="tiny muted">(시작: ${esc(roleName(s, h.startRole))})</span>` : ''}</b></div>
    <div class="kv"><span>출전</span><b>${h.stats.g || 0}경기 · 선발 ${h.stats.gs || 0}</b></div>
    <div class="kv"><span>팀 성적</span><b>${h.team.w}승 ${h.team.l}패${h.post ? ` · ${esc(h.post)}` : ''}</b></div>
    <div class="kv"><span>평균 평점</span><b>${h.grade || '-'}</b></div>
    <div class="kv"><span>종합 능력치</span><b>${h.ovrBefore} → ${h.ovrAfter} <span class="${d > 0 ? 'up' : d < 0 ? 'down' : 'faint'}">${d ? signed(d) : ''}</span></b></div></div>
    <div style="margin-top:12px">${tiles(keyStats(h.pos, h.stats, h.twoWay).slice(0, 6))}</div>
    ${h.awards.length ? `<h3 style="margin-top:16px">수상</h3>${h.awards.map(a => `<div class="kv"><span>${icon('trophy', 'gold')}</span><b>${esc(a.name)}</b></div>`).join('')}` : ''}
    ${h.race?.length ? `<p class="small muted" style="margin-top:8px">${h.race.map(esc).join(' · ')}</p>` : ''}
    ${h.injuries?.length ? `<p class="small" style="margin-top:8px"><span class="pill red">부상</span> ${h.injuries.map(i => `${esc(i.kind)} (${esc(i.games)})`).join(', ')}</p>` : ''}
    ${h.goal ? `<div class="result-box ${h.goal.done ? '' : 'fail'}" style="margin-top:12px"><div class="tiny muted">이번 목표 · ${esc(h.goal.hint)}</div><b>${esc(h.goal.title)}</b> ${h.goal.done ? '<span class="pill green">달성</span>' : '<span class="pill red">미달성</span>'}</div>` : ''}
    <div class="kv" style="margin-top:8px"><span>${esc(h.income?.kind || '수입')}</span><b>${usd(h.income?.net || 0)}${h.fees ? ` <span class="tiny muted">(스태프 비용 −${usd(h.fees)})</span>` : ''}</b></div>
    <div class="kv"><span>팔로워</span><b>${h.social?.delta >= 0 ? '▲' : '▼'}${Math.abs(h.social?.delta || 0).toLocaleString('ko-KR')}</b></div>
    <button class="primary" data-action="close-sheet" style="margin-top:16px">확인</button>`);
}
export function pathSheet(s, selected) {
  const P = s.path;
  return sheet(`<p class="eyebrow">다음 이야기 · ${s.year} 오프시즌</p><h2>${esc(P.title)}</h2><p class="lead">${esc(P.desc)}</p>${P.note ? `<div class="result-box" style="margin-top:10px">${esc(P.note)}</div>` : ''}
    ${P.options.map(o => `<button class="option ${selected === o.id ? 'sel' : ''}" data-action="path-pick" data-v="${esc(o.id)}"><div class="row between"><strong>${esc(o.label)}</strong>${o.badge ? `<span class="pill ${o.badge === '위험' ? 'red' : 'gold'}">${esc(o.badge)}</span>` : ''}</div><div class="sub">${esc(o.sub || '')}</div>${selected === o.id ? `<div class="desc">${esc(o.desc || '')}</div>${o.offer ? offerDetail(o.offer) : ''}` : ''}</button>`).join('')}
    <div class="dock" style="bottom:0"><button class="primary" data-action="path-confirm" ${selected ? '' : 'disabled'}>선택하기</button></div>`);
}
function offerDetail(o) {
  return `<div style="margin-top:8px"><div class="kv"><span>역할</span><b>${esc(o.roleName)}</b></div><div class="kv"><span>계약</span><b>${o.years}년 ${usd(o.total)}</b></div><div class="kv"><span>연봉</span><b>${usd(o.aav)} <span class="tiny muted">${krw(o.aav)}</span></b></div><div class="kv"><span>보장</span><b>${usd(o.guaranteed)}</b></div><div class="kv"><span>팀 전력</span><b>${esc(o.contender)}</b></div></div>`;
}
export function turningSheet(s, focusDraft = []) {
  const t = s.todos.find(x => x.id === 'turning' && !x.done);
  if (!t) return sheet('<h2>지나간 전환점</h2>');
  const focus = t.kind === 'focus';
  return sheet(`${fieldBanner(teamColors(s), t.title, 'helmet')}<p class="eyebrow" style="margin-top:12px">${nameTag(s.player.name)} · 전환점</p><h2>${esc(t.title)}</h2><p class="lead">${esc(t.body)}</p>
    ${focus ? `<div style="margin-top:10px">${attrsOf(s.player.pos).map(k => `<button class="option ${focusDraft.includes(k) ? 'sel' : ''}" data-action="focus-pick" data-v="${k}" style="margin-top:6px"><div class="row between"><strong>${ATTR[k][0]}</strong><b>${s.player.attrs[k]}</b></div></button>`).join('')}</div>` : ''}
    ${t.options.map(o => `<button class="choice" data-action="turning" data-v="${o.id}"><strong>${esc(o.label)}</strong><div class="hint">${esc(o.desc)}</div></button>`).join('')}
    <p class="tiny faint" style="margin-top:10px">다음 시즌을 시작하면 이번 전환점은 지나가요.</p><button class="ghost" data-action="close-sheet">나중에 생각하기</button>`);
}
export function draftSheet(s) {
  const d = s.draft; if (!d) return sheet('<h2>드래프트 정보가 없어요</h2>');
  const c = d.combine, t = d.drafted ? TEAM_BY_ID[d.team] : null;
  return sheet(`${fieldBanner(t ? t.colors : ['#2b2f33', '#fff'], 'NFL 드래프트', t ? 'helmet' : 'ball')}<p class="eyebrow" style="margin-top:12px">${d.year} NFL 드래프트 · 사전 예상 ${esc(d.proj.label)}</p>
    <h2>${d.drafted ? `${d.round}라운드 ${d.inRound}순위<br><span class="accent">${esc(t.ko)}</span>` : '이름이 불리지 않았어요'}</h2>
    <p class="lead">${d.drafted ? `전체 ${d.pick}순위. 커미셔너가 연단에서 내 이름을 불렀습니다. 감독 ${esc(t.coach)}가 전화를 걸어 왔어요.` : '사흘 동안 휴대폰만 바라봤습니다. 이제 언드래프티 FA로 기회를 찾아야 해요.'}</p>
    <h3 style="margin-top:16px">NFL 컴바인</h3>${tiles([['40야드', `${c.forty}초`], ['벤치프레스', `${c.bench}회`], ['버티컬', `${c.vertical}인치`], ['브로드 점프', `${c.broad}인치`], ['3콘', `${c.cone}초`], ['드래프트 평가', d.proj.value]])}
    ${d.drafted ? `<div style="margin-top:12px"><div class="kv"><span>루키 계약</span><b>4년 ${usd(s.contract?.total || 0)}</b></div><div class="kv"><span>연봉</span><b>${usd(s.contract?.aav || 0)} <span class="tiny muted">${krw(s.contract?.aav || 0)}</span></b></div><div class="kv"><span>구장</span><b>${esc(t.stadium)}</b></div><div class="kv"><span>디비전</span><b>${esc(t.div)}</b></div></div>` : ''}
    <button class="primary" data-action="close-sheet" style="margin-top:16px">확인</button>`);
}
export function broadcastSheet(s, year, shown) {
  const h = s.history.find(x => x.year === year), b = h?.broadcast;
  if (!b) return sheet('<h2>중계가 없어요</h2>');
  const plays = b.plays.slice(0, shown), cur = plays.at(-1) || { a: 0, b: 0, q: 1 }, done = shown >= b.plays.length;
  return sheet(`<p class="eyebrow">${icon('tv')} 생중계 · ${esc(b.title)}</p>
    <div class="scoreboard" style="margin-top:10px"><div><small>${esc(b.me)}</small><b>${cur.a}</b></div><div><span class="q">${done ? 'FINAL' : `${cur.q}Q`}</span></div><div><small>${esc(b.them)}</small><b>${cur.b}</b></div></div>
    <ul class="pbp" id="pbp">${plays.map(x => `<li class="${x.score ? 'score' : ''} ${x.mine ? 'mine' : ''}"><time>${x.q}Q ${esc(x.t)}</time><span>${esc(x.text)}</span></li>`).join('')}</ul>
    ${done ? `<div class="result-box ${b.win ? '' : 'fail'}" style="margin-top:12px"><b>${b.win ? '우승!' : '준우승'}</b> · 내 평점 ${b.grade ?? '-'}<div class="small">${esc(lineText(s.player.pos, b.line))}</div></div><button class="primary" data-action="close-sheet" style="margin-top:12px">확인</button>` : `<button class="secondary" data-action="bc-skip" style="margin-top:12px">건너뛰기</button>`}`);
}
export function shopSheet(s) {
  const stock = s.shop.stock.map(id => ITEMS.find(i => i.id === id)).filter(Boolean), bought = s.shop.boughtYear === s.year;
  return sheet(`<p class="eyebrow">훈련장 · 상점</p><h2>이번 시즌 입고</h2><p class="lead">보유 자금 <b>${usd(s.money)}</b> <span class="tiny">(${krw(s.money)})</span></p>
    ${stock.map(it => `<button class="option" data-action="buy" data-v="${it.id}" ${canBuy(s, it) ? '' : 'disabled'} style="${canBuy(s, it) ? '' : 'opacity:.55'}"><div class="row between"><strong>${esc(it.name)}</strong><b>${usd(it.price)}</b></div><div class="sub">${esc(it.note)} · ${it.attr ? `${it.attr === 'main' ? '집중 육성 능력치' : ATTR[it.attr]?.[0] || '능력치'} +${it.up}` : ''}${it.body ? ` 누적 피로 −${it.body}` : ''}</div></button>`).join('')}
    <p class="tiny muted" style="margin-top:8px">${bought ? '이번 시즌에는 이미 하나를 샀어요. 다음 시즌에 새 상품 3개가 들어와요.' : '한 시즌에 하나만 살 수 있고, 다음 시즌에 새 상품 3개가 들어와요.'}</p>
    <h3 style="margin-top:18px">스태프 (시즌마다 비용)</h3>${STAFF.map(st => { const on = !!s.shop.staff[st.id]; return `<button class="option ${on ? 'sel' : ''}" data-action="staff" data-v="${st.id}"><div class="row between"><strong>${esc(st.name)}</strong><span class="pill ${on ? 'green' : ''}">${on ? '계약 중 · 해지' : st.fee ? `${usd(st.fee)}/시즌` : '수수료 3%'}</span></div><div class="sub">${esc(st.desc)}</div></button>`; }).join('')}
    <h3 style="margin-top:18px">개인 시설</h3>${FACILITIES.map(f => { const lvl = s.shop.facilities[f.id] || 0, max = lvl >= f.prices.length; return `<button class="option" data-action="facility" data-v="${f.id}" ${max ? 'disabled' : ''}><div class="row between"><strong>${esc(f.name)} Lv.${lvl}</strong><b>${max ? '최고 단계' : usd(f.prices[lvl])}</b></div><div class="sub">${esc(f.desc)}</div></button>`; }).join('')}`);
}
const STORAGE_TEXT = { synced: '내 Claude 계정에 자동 저장 중이에요. 휴대폰·PC 어디서 열어도 이어집니다.', connecting: '계정 저장소에 연결하는 중이에요.', offline: '계정 저장소에 잠시 닿지 않아요. 이 브라우저에는 저장되고 있어요.', quota: '계정 저장 공간이 가득 찼어요. 저장 데이터를 내보내 두세요.', local: '이 브라우저에 자동 저장돼요. 브라우저 데이터를 지우면 사라지니 중요한 커리어는 내보내 두세요.' };
export function settingsSheet(s, status = 'local') {
  return sheet(`<h2>설정</h2><p class="lead">${STORAGE_TEXT[status] || STORAGE_TEXT.local}</p>
    <button class="option" data-action="export"><strong>${icon('download')} 저장 파일 내보내기</strong><div class="sub">커리어와 은퇴 기록을 JSON 파일로 받아요.</div></button>
    <label class="option" style="cursor:pointer"><strong>${icon('upload')} 저장 파일 가져오기</strong><div class="sub">내보낸 파일로 커리어를 이어 가요.</div><input type="file" accept="application/json,.json" data-input="import" hidden></label>
    <div class="option"><strong>${icon('upload')} 저장 데이터 붙여넣기</strong><div class="sub">내보낸 글자를 붙여 넣어 불러와요.</div><textarea id="import-text" rows="3" placeholder='{"app":"touchdown-life",...}' style="width:100%;margin-top:8px;border:1.5px solid var(--line);border-radius:10px;padding:8px;background:var(--surface);color:var(--ink);font-size:12px"></textarea><button class="secondary" data-action="import-text" style="margin-top:8px;padding:10px">불러오기</button></div>
    <button class="option" data-action="archive"><strong>${icon('records')} 내 은퇴 기록</strong><div class="sub">은퇴한 선수들의 순위와 베스트 라인업</div></button>
    ${s ? `<button class="option" data-action="new-career-ask"><strong>${icon('plus')} 새 커리어 시작</strong><div class="sub">지금 커리어는 사라져요 (은퇴하면 기록이 남아요).</div></button>` : ''}
    <p class="tiny faint" style="margin-top:14px">로스터: ${esc(ROSTER_SOURCE)}. 2026 시즌 감독은 위키백과 'List of current NFL head coaches' 기준입니다. 구단·대회 명칭의 권리는 각 권리자에게 있으며, 이 게임은 NFL·NCAA와 관계가 없습니다. 선수 능력치와 결과는 실제 평가나 예측이 아닙니다.</p>`);
}
export function archiveSheet(list) {
  const sorted = [...list].sort((a, b) => b.mvp - a.mvp || b.sb - a.sb || b.peak - a.peak || b.awards - a.awards || b.score - a.score);
  const best = {};
  for (const e of sorted) { const g = { DT: 'DL', EDGE: 'DL' }[e.pos] || e.pos; if (!best[g] || best[g].score < e.score) best[g] = e; }
  return sheet(`<h2>내 은퇴 기록</h2><p class="lead">MVP → 슈퍼볼 우승 → 최고 OVR → 수상 수 → 커리어 점수 순으로 비교해요.</p>
    ${sorted.length ? `<div class="table-wrap" style="margin-top:10px"><table><thead><tr><th class="l">#</th><th class="l">선수</th><th>MVP</th><th>반지</th><th>최고</th><th>등급</th></tr></thead><tbody>${sorted.map((e, i) => `<tr><td class="l">${i + 1}</td><td class="l">${nameTag(e.name)} <span class="tiny faint">${e.pos} · ${e.years}</span></td><td>${e.mvp}</td><td>${e.sb}</td><td>${e.peak}</td><td><b>${e.grade}</b></td></tr>`).join('')}</tbody></table></div>
    <h3 style="margin-top:16px">나의 베스트 라인업</h3>${Object.entries(best).map(([g, e]) => `<div class="kv"><span>${g}</span><b>${nameTag(e.name)} · OVR ${e.peak}</b></div>`).join('')}` : '<p class="muted" style="margin-top:12px">아직 은퇴한 선수가 없어요.</p>'}`);
}
export function imageSheet(url) {
  return sheet(`<h2>커리어 카드</h2><p class="lead">이미지를 길게 누르거나 오른쪽 클릭해서 저장하세요.</p><img src="${url}" alt="커리어 카드" style="width:100%;border-radius:16px;margin-top:12px"><button class="primary" data-action="close-sheet" style="margin-top:14px">닫기</button>`);
}
export function textSheet(text) {
  return sheet(`<h2>저장 데이터</h2><p class="lead">이 글자를 복사해 두었다가 설정의 '저장 데이터 붙여넣기'로 불러올 수 있어요.</p><textarea id="export-text" rows="8" readonly style="width:100%;margin-top:12px;border:1.5px solid var(--line);border-radius:12px;padding:10px;background:var(--surface-2);color:var(--ink);font-size:11px">${esc(text)}</textarea><button class="primary" data-action="copy-text" style="margin-top:12px">복사하기</button>`);
}
export function confirmSheet(title, body, action, label = '확인') {
  return sheet(`<h2>${esc(title)}</h2><p class="lead">${esc(body)}</p><button class="primary" data-action="${action}" style="margin-top:16px">${esc(label)}</button><button class="ghost" data-action="close-sheet">취소</button>`);
}
export { TEAMS, LEVEL_AVG, superBowlName, TIER_LABEL };
