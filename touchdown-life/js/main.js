// 앱 진입점: 상태 보관, 렌더링, 이벤트 위임, 저장.
import { createCareer, makeCandidates, startSeason, advance, chooseCard, choosePath, chooseTurning, retireCareer, setTraining, setRedshirt, playBigGame, autoRestOfSeason, canPlayBig, seasonLabel } from './engine/career.js';
import { setProgram, answerInterview } from './engine/extras.js';
import { pull } from './engine/shop.js';
import { ATTR, attrsOf } from './engine/core.js';
import * as FX from './ui/fx.js';
import { openClutch, clutchLevelAvg } from './ui/clutch.js';
import { openGym } from './ui/gym.js';
import { sceneUrl, iconUrl } from './ui/pixel.js';
import { TEAM_BY_ID } from './data/teams.js';
import { CARD_BY_ID } from './engine/events.js';
import { buyItem, hireStaff, buyFacility, STAFF } from './engine/shop.js';
import { careerScore, countAwards, honorsLine, totals, isPro } from './engine/awards.js';
import { POSITIONS, usd } from './engine/core.js';
import { loadCareer, saveCareer, listArchive, archiveCareer, exportData, offerFile, importFile, importText, getTheme, setTheme, connectCloud, cloudLoad, mergeArchive, storageStatus, flush } from './storage.js';
import * as V from './ui/views.js';
import { spriteUrl, portraitUrl } from './ui/pixel.js';

const $ = sel => document.querySelector(sel);
let state = loadCareer();
let tab = 'home', sheetView = null, pathSel = null, focusDraft = [], bcTimer = null;
const setup = { step: 0, avatar: { skin: 1, hair: 0, style: 0, visor: 0 }, name: '', number: '7', pos: 'WR', nat: 'US', schoolId: 'img', fanTeam: '', seedN: 0, cand: null, focus: [] };
let busy = false;
V.setCardIndex(CARD_BY_ID);
if (state && !state.player) state = null;

function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2400); }
function persist() { if (!state) return; state.savedAt = Date.now(); if (!saveCareer(state)) toast('이 브라우저에 저장하지 못했어요. 설정에서 저장 데이터를 내보내 두세요.'); }
function render() {
  const app = $('#app');
  if (!state) { app.innerHTML = V.setupPage(setup); renderSheet(); return; }
  const page = { home: V.homePage, season: V.seasonPage, player: V.playerPage, records: V.recordsPage, social: V.socialPage }[tab] || V.homePage;
  app.innerHTML = `<div class="shell">${V.appBar(state)}<main>${page(state)}</main><p class="footer">터치다운 인생 · 실제 로스터는 위키백과(2026-11) 기준, 능력치·결과는 게임 속 가상의 값</p></div>${V.tabBar(tab, state)}`;
  renderSheet();
}
function renderSheet() {
  const root = $('#sheet-root');
  if (!sheetView) { root.innerHTML = ''; document.body.style.overflow = ''; return; }
  document.body.style.overflow = 'hidden';
  const s = state, v = sheetView;
  if ((v.kind === 'path' && !s?.path) || (v.kind === 'turning' && !s?.todos.some(t => t.id === 'turning' && !t.done))) { sheetView = null; root.innerHTML = ''; document.body.style.overflow = ''; return; }
  root.innerHTML = v.kind === 'report' ? V.reportSheet(s, v.year) : v.kind === 'path' ? V.pathSheet(s, pathSel) : v.kind === 'turning' ? V.turningSheet(s, focusDraft)
    : v.kind === 'draft' ? V.draftSheet(s) : v.kind === 'broadcast' ? V.broadcastSheet(s, v.year, v.shown) : v.kind === 'shop' ? V.shopSheet(s)
    : v.kind === 'interview' ? V.interviewSheet(s, v.year) : v.kind === 'olympics' ? V.olympicsSheet(s, v.year) : v.kind === 'patch' ? V.patchSheet()
    : v.kind === 'settings' ? V.settingsSheet(s, storageStatus()) : v.kind === 'image' ? V.imageSheet(v.url) : v.kind === 'text' ? V.textSheet(v.text) : v.kind === 'archive' ? V.archiveSheet(listArchive()) : v.kind === 'confirm' ? V.confirmSheet(v.title, v.body, v.action, v.label) : '';
  const pbp = $('#pbp'); if (pbp) pbp.scrollTop = pbp.scrollHeight;
}
function openSheet(v) { sheetView = v; if (v.kind !== 'path') pathSel = null; renderSheet(); }
function closeSheet() { clearInterval(bcTimer); bcTimer = null; sheetView = null; renderSheet(); render(); }
function mutate(fn, after) {
  try { const out = fn(); persist(); render(); after?.(out); return out; }
  catch (e) { console.error(e); toast(e.message || '문제가 생겼어요.'); }
}
function markSeen(id) { const t = state.todos.find(x => x.id === id && !x.seen); if (t) { t.seen = true; persist(); } }
function playBroadcast(year) {
  openSheet({ kind: 'broadcast', year, shown: 1 });
  const total = state.history.find(h => h.year === year)?.broadcast?.plays.length || 0;
  clearInterval(bcTimer);
  bcTimer = setInterval(() => { if (!sheetView || sheetView.kind !== 'broadcast') { clearInterval(bcTimer); return; } sheetView.shown++; renderSheet(); if (sheetView.shown >= total) clearInterval(bcTimer); }, 900);
}
// 은퇴 기록 보관함 항목.
function archiveEntry(s) {
  const L = careerScore(s);
  return { id: s.id, name: s.player.name, pos: s.player.pos, years: `${s.startYear}–${s.retiredYear}`, peak: L.peak, score: L.score, grade: L.grade,
    mvp: countAwards(s, 'mvp'), sb: countAwards(s, 'sbChamp'), awards: s.history.reduce((n, h) => n + (h.awards?.length || 0), 0), honors: honorsLine(s), hof: s.legacy?.hof?.chance ?? 0 };
}
function afterRetire() { archiveCareer(archiveEntry(state)); tab = 'home'; persist(); render(); window.scrollTo(0, 0); }
async function retireShow() {
  const L = state.legacy, num = (L?.legend || []).find(x => x.kind === 'number');
  await FX.retirement({ name: state.player.name, number: state.player.number, team: num ? TEAM_BY_ID[num.teamId]?.ko : state.team?.name, retired: !!num, scene: stageScene('stadium', 'cheer', { confetti: true, board: 'THANK YOU' }) });
  afterRetire(); toast('은퇴했습니다. 수고 많았어요.');
}

// ───────── 연출과 함께 진행 ─────────
const playedList = z => z ? [...z.games.filter(g => g.played), ...(z.post?.rounds || [])] : [];
const look = () => ({ colors: V.teamColors(state), avatar: state.player.avatar, number: state.player.number });
const stageScene = (name, pose, extra = {}) => sceneUrl({ scene: name === 'stadium' && state.stage === 'hs' ? 'hs' : name, colors: V.teamColors(state), players: [{ pose, ...look() }], ...extra });
function badge(text) { const b = document.createElement('div'); b.className = 'badge-pop'; b.textContent = text; document.body.appendChild(b); setTimeout(() => b.remove(), 3000); }
const AWARD_ICON = k => ['sbChamp', 'nationalChamp', 'stateChamp', 'greyCup', 'confChamp'].includes(k) ? 'ring' : ['proBowl', 'allPro1', 'allPro2', 'allAmerican', 'consensusAA', 'allConf', 'allState', 'hsAA', 'olympicMedal', 'olympicGold'].includes(k) ? 'star' : 'trophy';
// 엔진 한 걸음(fn) 뒤에 새로 치른 경기·부상·시즌 종료를 연출합니다.
async function step(fn) {
  if (busy) return;
  busy = true;
  const s0 = state, z0 = s0.season, before = playedList(z0).length, histLen = s0.history.length, moments = s0.moments.length;
  const wl0 = playedList(z0).filter(g => !g.round);
  let ok = true;
  try { fn(); persist(); } catch (e) { console.error(e); toast(e.message || '문제가 생겼어요.'); ok = false; }
  if (ok) {
    try {
      const z = state.season || state.lastSeason, all = playedList(z), fresh = all.slice(before);
      if (fresh.length) {
        const pose = ['K', 'P'].includes(state.player.pos) ? 'kick' : 'run';
        await FX.seasonPlayback({ title: `${z.year} 시즌`, sub: state.history.length > histLen ? state.history.at(-1).teamName : state.team.name, sceneA: stageScene('stadium', pose), sceneB: stageScene('stadium', pose === 'run' ? 'run2' : 'stand'),
          games: fresh.map(g => ({ tag: g.round || (g.featured ? '빅게임' : `${g.wk}주차`), opp: `${g.home ? 'vs' : '@'} ${g.oppName}`, res: g.res, pf: g.pf, pa: g.pa, line: g.injury ? `부상: ${g.injury}` : V.lineSummary(state.player.pos, g.line), grade: g.grade, big: !!(g.featured || g.round) })),
          w0: wl0.filter(g => g.res === 'W').length, l0: wl0.filter(g => g.res === 'L').length });
        const inj = fresh.find(g => g.injury);
        if (inj) await FX.injury({ kind: inj.injury, games: (z.injuries.at(-1) || {}).games || '', scene: stageScene('medical', 'sad') });
      }
      if (state.history.length > histLen) await seasonEnd(state.history.at(-1));
      else if (state.phase === 'bigGame') { const g = state.bigGame; await FX.versus({ title: g.title || g.round, me: state.team.name, opp: g.oppName, myColors: V.teamColors(state), oppColors: V.colorsByName(g.oppName), scene: sceneUrl({ scene: state.stage === 'hs' ? 'hs' : 'stadium', colors: V.teamColors(state), opp: V.colorsByName(g.oppName), board: 'BIG GAME', players: [{ pose: 'stance', ...look(), x: 46 }, { pose: 'stance', colors: V.colorsByName(g.oppName), avatar: { skin: 3 }, number: 55, x: 94, flip: true }] }) }); }
      for (const m of state.moments.slice(moments)) if (m.kind === 'first') badge(`🏈 ${m.text}`);
    } catch (e) { console.error(e); }
  }
  busy = false;
  render(); window.scrollTo(0, 0);
  if (state?.phase === 'offseason' && state.history.length > histLen) { markSeen('report'); openSheet({ kind: 'report', year: state.history.at(-1).year }); }
}
async function seasonEnd(rec) {
  if (!rec || rec.stage === 'military') return;
  const p = state.player, keys = Object.keys(rec.changes || {});
  await FX.growthReveal({ year: rec.year, ovrBefore: rec.ovrBefore, ovrAfter: rec.ovrAfter, items: keys.map(k => ({ label: ATTR[k]?.[0] || k, before: rec.attrsBefore?.[k] ?? rec.attrsAfter[k] - rec.changes[k], after: rec.attrsAfter[k], focus: p.focus.includes(k) })), breakout: rec.breakout ? ATTR[rec.breakout]?.[0] : null, crossed: rec.crossed });
  const big = [...rec.awards].filter(a => a.pts >= 5).sort((a, b) => b.pts - a.pts).slice(0, 4);
  for (const a of big) await FX.ceremony({ eyebrow: `${rec.year} 시즌 · ${rec.teamName}`, title: a.name, sub: a.kind === 'sbChamp' ? '롬바디 트로피를 들어 올렸다!' : a.kind === 'mvp' ? '리그 최고의 선수로 뽑혔다.' : a.kind === 'heisman' ? '대학 풋볼 최고의 영예.' : '', icon: iconUrl(AWARD_ICON(a.kind)), sprite: spriteUrl({ pose: 'cheer', ...look() }), colors: V.teamColors(state) });
}
async function afterPath(text, kind, yearBefore, contractBefore) {
  const s = state;
  if (kind === 'declare' && s.draft) {
    const d = s.draft, t = d.drafted ? TEAM_BY_ID[d.team] : null;
    await FX.draftReveal({ year: d.year, round: d.round, inRound: d.inRound, pick: d.pick, team: t?.ko, colors: t?.colors || ['#3A4560'], drafted: d.drafted, scene: sceneUrl({ scene: 'draft', colors: t ? t.colors : ['#3A4560', '#FFFFFF'], board: t ? t.id : 'DRAFT', players: [{ pose: d.drafted ? 'cheer' : 'sad', colors: t ? t.colors : ['#5A6372', '#FFFFFF'], avatar: s.player.avatar, number: s.player.number }] }) });
    markSeen('draft');
  }
  const c = s.contract;
  if (c && c !== contractBefore && s.stage !== 'hs' && (!contractBefore || c.aav !== contractBefore.aav || c.teamId !== contractBefore.teamId) && ['nfl', 'cfl'].includes(s.stage)) {
    await FX.signing({ team: s.team.name, years: c.years, total: usd(c.total || c.aav * c.years), aav: usd(c.aav), colors: V.teamColors(s) });
  }
  if (s.phase === 'ready' && s.year !== yearBefore) {
    const stageNames = { hs: `고교 ${s.grade}학년`, college: `대학 ${s.collegeYear}학년`, nfl: `NFL ${s.proSeasons + 1}년 차`, cfl: 'CFL', military: '군 복무' };
    await FX.titleCard({ year: s.year, label: stageNames[s.stage] || '', sub: s.team.name, scene: stageScene(s.stage === 'military' ? 'school' : 'practice', 'cheer') });
  }
}
async function playBig(direct) {
  if (busy || state.phase !== 'bigGame') return;
  const g = state.bigGame;
  let res = null;
  if (direct && canPlayBig(state)) {
    busy = true;
    res = await openClutch(document.getElementById('clutch-root'), { player: state.player, game: g, colors: V.teamColors(state), oppColors: V.colorsByName(g.oppName), myName: state.team.short || state.team.name, oppName: g.oppName, levelAvg: clutchLevelAvg(state) });
    busy = false;
  }
  let played;
  try { played = playBigGame(state, res); persist(); } catch (e) { toast(e.message); return; }
  render();
  await FX.gameResult({ title: played.title || played.round, win: played.res === 'W', pf: played.pf, pa: played.pa, me: state.team.short || state.team.name, opp: played.oppName, line: V.lineSummary(state.player.pos, played.line), grade: played.grade ?? '-', ot: played.ot, sprite: spriteUrl({ pose: played.res === 'W' ? 'cheer' : 'sad', ...look() }) });
  await step(() => advance(state));
}

// 커리어 카드 PNG
function shareCard() {
  const s = state, p = s.player, L = careerScore(s), T = totals(s.history.filter(isPro)), c = document.createElement('canvas');
  c.width = 1080; c.height = 1350; const g = c.getContext('2d');
  const colors = V.teamColors(s);
  g.fillStyle = '#0F1612'; g.fillRect(0, 0, 1080, 1350);
  g.fillStyle = '#1F6B3B'; g.fillRect(0, 0, 1080, 520);
  g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 3; for (let x = 90; x < 1080; x += 90) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 520); g.stroke(); }
  g.fillStyle = colors[0]; g.fillRect(0, 0, 90, 520); g.fillRect(990, 0, 90, 520);
  g.fillStyle = '#fff'; g.font = '900 88px system-ui, sans-serif'; g.fillText(p.name, 120, 650);
  g.font = '700 40px system-ui, sans-serif'; g.fillStyle = '#A9C7B4'; g.fillText(`${POSITIONS[p.pos].ko} · #${p.number} · ${s.startYear}–${s.retiredYear || s.year}`, 120, 715);
  g.fillStyle = '#E5B53C'; g.font = '900 150px system-ui, sans-serif'; g.fillText(L.grade, 820, 690);
  const rows = [['최고 OVR', L.peak], ['커리어 점수', L.score], ['NFL 경기', T.g], ['총 터치다운', T.ptd + T.rtd + T.rectd + T.dtd], ['색 / 인터셉트', `${T.sack} / ${T.dint}`]];
  g.font = '700 42px system-ui, sans-serif'; rows.forEach(([k, v], i) => { g.fillStyle = '#8FA699'; g.fillText(k, 120, 830 + i * 76); g.fillStyle = '#fff'; g.textAlign = 'right'; g.fillText(String(v), 960, 830 + i * 76); g.textAlign = 'left'; });
  g.fillStyle = '#E5B53C'; g.font = '800 38px system-ui, sans-serif'; g.fillText(honorsLine(s) || '수상 기록 없음', 120, 1240, 840);
  g.fillStyle = '#6E8577'; g.font = '700 30px system-ui, sans-serif'; g.fillText('터치다운 인생', 120, 1300);
  const img = new Image();
  g.imageSmoothingEnabled = false;
  img.onload = () => { g.drawImage(img, 386, 40, 308, 392); download(); };
  img.onerror = download;
  img.src = spriteUrl({ pose: 'cheer', colors, avatar: p.avatar, number: p.number });
  void portraitUrl;
  function download() {
    c.toBlob(async b => {
      const res = await offerFile(`touchdown-life-${p.name}.png`, b);
      if (res === 'saved') toast('커리어 카드를 저장했어요.');
      else if (res === 'fallback') openSheet({ kind: 'image', url: c.toDataURL('image/png') });
    });
  }
}
function cycleTheme() {
  const now = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const next = now === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next; setTheme(next);
}

// ───────── 이벤트 ─────────
document.addEventListener('click', e => {
  const tabBtn = e.target.closest('[data-tab]');
  if (tabBtn) { tab = tabBtn.dataset.tab; render(); window.scrollTo(0, 0); return; }
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const a = el.dataset.action, v = el.dataset.v;
  if (a === 'sheet-bg') { if (e.target === el) closeSheet(); return; }
  switch (a) {
    case 'close-sheet': closeSheet(); break;
    case 'theme': cycleTheme(); break;
    case 'settings': openSheet({ kind: 'settings' }); break;
    case 'archive': openSheet({ kind: 'archive' }); break;
    // 생성
    case 'setup-av': setup.avatar[el.dataset.k] = +v; render(); break;
    case 'setup-pos': setup.pos = v; setup.cand = null; setup.focus = []; render(); break;
    case 'setup-nat': setup.nat = v; render(); break;
    case 'setup-next': setup.step = Math.min(3, setup.step + 1); if (setup.step === 3 && !setup.focus.length) { const c = makeCandidates(setup.pos, `${setup.name}:${setup.pos}:${setup.seedN}`)[setup.cand]; setup.focus = c.strong.filter(k => c.attrs[k] !== undefined).slice(0, 2); } render(); window.scrollTo(0, 0); break;
    case 'setup-back': setup.step = Math.max(0, setup.step - 1); render(); window.scrollTo(0, 0); break;
    case 'setup-cand': setup.cand = +v; setup.focus = []; render(); break;
    case 'setup-reroll': setup.seedN++; setup.cand = null; render(); break;
    case 'setup-focus': setup.focus = setup.focus.includes(v) ? setup.focus.filter(x => x !== v) : [...setup.focus, v].slice(-2); render(); break;
    case 'setup-create': {
      const c = makeCandidates(setup.pos, `${setup.name}:${setup.pos}:${setup.seedN}`)[setup.cand];
      try {
        state = createCareer({ name: setup.name, number: +setup.number, pos: setup.pos, nat: setup.nat, schoolId: setup.schoolId, fanTeam: setup.fanTeam, avatar: { ...setup.avatar }, arch: c.arch, attrs: c.attrs, focus: setup.focus });
        persist(); tab = 'home'; render(); window.scrollTo(0, 0); toast('첫 시즌이 준비됐어요.');
      } catch (err) { toast(err.message); }
      break;
    }
    // 진행
    case 'training': mutate(() => setTraining(state, v)); break;
    case 'redshirt': mutate(() => setRedshirt(state, !state.redshirt)); break;
    case 'start-season': step(() => startSeason(state)); break;
    case 'advance': step(() => advance(state)); break;
    case 'choose-card': V.markRollFresh(true); mutate(() => chooseCard(state, +v), () => { window.scrollTo(0, 0); setTimeout(() => V.markRollFresh(false), 50); }); break;
    case 'big-play': playBig(true); break;
    case 'big-auto': playBig(false); break;
    case 'big-auto-all': step(() => autoRestOfSeason(state)); break;
    case 'program': mutate(() => setProgram(state, v)); break;
    case 'social-pane': V.setSocialPane(v); render(); break;
    case 'interview': { const t = state.todos.find(x => x.id === 'interview' && x.year === sheetView?.year); if (t) mutate(() => answerInterview(state, t, v), ans => { toast(ans.lines.join(' · ')); renderSheet(); }); break; }
    case 'pull': { if (busy) break; let cards; try { cards = pull(state, +v); persist(); } catch (err) { toast(err.message); break; } busy = true; FX.gachaReveal(cards).then(() => { busy = false; renderSheet(); render(); toast(cards.map(c => `${c.rarityName} ${c.name}`).join(' · ')); }); break; }
    case 'open-todo': {
      const t = state.todos.find(x => x.id === v); if (!t) break;
      markSeen(v);
      if (v === 'report') openSheet({ kind: 'report', year: t.year });
      else if (v === 'broadcast') playBroadcast(t.year);
      else if (v === 'draft') openSheet({ kind: 'draft' });
      else if (v === 'turning') { focusDraft = [...state.player.focus]; openSheet({ kind: 'turning' }); }
      else if (v === 'shop') openSheet({ kind: 'shop' });
      else if (v === 'interview') openSheet({ kind: 'interview', year: t.year });
      else if (v === 'olympics') { const o = state.olympics?.[t.year]; (o?.medal ? FX.ceremony({ eyebrow: `${o.year} ${o.city} 올림픽`, title: o.name, sub: o.exemption ? '병역 특례 대상이 됐다!' : `${o.country} 국가대표`, icon: iconUrl('star'), sprite: spriteUrl({ pose: 'cheer', colors: o.country === '대한민국' ? ['#003478', '#C60C30'] : ['#0A3161', '#B31942'], avatar: state.player.avatar, number: state.player.number }) }) : Promise.resolve()).then(() => openSheet({ kind: 'olympics', year: t.year })); }
      render(); renderSheet();
      break;
    }
    case 'bc-skip': clearInterval(bcTimer); sheetView.shown = 999; renderSheet(); break;
    case 'open-path': pathSel = null; openSheet({ kind: 'path' }); break;
    case 'path-pick': pathSel = v; renderSheet(); break;
    case 'path-confirm': {
      const id = pathSel; if (!id || busy) break;
      const yearBefore = state.year, contractBefore = state.contract, kind = id.split(':')[0];
      let text;
      try { text = choosePath(state, id); persist(); } catch (err) { toast(err.message); break; }
      pathSel = null;
      if (state.phase === 'retired') { closeSheet(); retireShow(); break; }
      busy = true; sheetView = null; renderSheet();
      afterPath(text, kind, yearBefore, contractBefore).then(() => {
        busy = false; render(); window.scrollTo(0, 0);
        if (state.phase === 'offseason' && state.path) { toast(text); openSheet({ kind: 'path' }); }
        else toast(text);
      });
      break;
    }
    case 'focus-pick': focusDraft = focusDraft.includes(v) ? focusDraft.filter(x => x !== v) : [...focusDraft, v].slice(-2); renderSheet(); break;
    case 'turning': mutate(() => chooseTurning(state, v, { focus: focusDraft }), text => { closeSheet(); toast(text); }); break;
    case 'open-shop': markSeen('shop'); openSheet({ kind: 'shop' }); break;
    case 'gym-open': { if (busy || !state) break; busy = true; closeSheet(); openGym(document.getElementById('clutch-root'), state, { colors: V.teamColors(state), persist, toast }).then(() => { busy = false; persist(); render(); }); break; }
    case 'buy': mutate(() => buyItem(state, v), lines => { toast(`구매 완료 · ${lines.join(', ')}`); renderSheet(); }); break;
    case 'staff': { const on = !state.shop.staff[v]; mutate(() => hireStaff(state, v, on), () => { toast(on ? `${STAFF.find(x => x.id === v).name}와 계약했어요.` : '계약을 해지했어요.'); renderSheet(); }); break; }
    case 'facility': mutate(() => buyFacility(state, v), () => { toast(v === 'club' ? '헬스장 회원권을 샀어요. 헬스장에 들어가 운동해 보세요!' : '시설을 업그레이드했어요.'); renderSheet(); }); break;
    case 'retire-ask': openSheet({ kind: 'confirm', title: '지금 은퇴할까요?', body: '은퇴하면 이 커리어는 끝나고, 은퇴 기록과 커리어 카드가 남아요.', action: 'retire-now', label: '은퇴하기' }); break;
    case 'retire-now': mutate(() => retireCareer(state, '스스로 은퇴를 결정했습니다.'), () => { closeSheet(); retireShow(); }); break;
    case 'share-card': shareCard(); break;
    case 'new-career-ask': openSheet({ kind: 'confirm', title: '새 커리어를 시작할까요?', body: '지금 진행 중인 커리어는 지워져요. 필요하면 먼저 저장 파일을 내보내세요.', action: 'new-career', label: '새로 시작' }); break;
    case 'new-career': state = null; saveCareer(null); Object.assign(setup, { step: 0, cand: null, focus: [], seedN: setup.seedN + 1, name: '' }); closeSheet(); window.scrollTo(0, 0); break;
    case 'export': { const json = exportData(state); offerFile(`touchdown-life-${(state?.player?.name || 'save').replace(/\s+/g, '')}.json`, json).then(r => { if (r === 'saved') toast('저장 파일을 내보냈어요.'); else if (r === 'fallback') openSheet({ kind: 'text', text: json }); }); break; }
    case 'copy-text': { const ta = document.getElementById('export-text'); navigator.clipboard?.writeText(ta.value).then(() => toast('복사했어요. 다른 기기의 설정에서 붙여 넣으세요.'), () => { ta.focus(); ta.select(); toast('글자를 길게 눌러 복사하세요.'); }) ?? (ta.select(), toast('글자를 길게 눌러 복사하세요.')); break; }
    case 'import-text': { const ta = document.getElementById('import-text'); try { state = importText(ta.value.trim()); persist(); tab = 'home'; closeSheet(); toast('저장 데이터를 불러왔어요.'); } catch (err) { toast(err.message || '저장 데이터를 읽지 못했어요.'); } break; }
    case 'tab': tab = v; render(); break;
  }
});
document.addEventListener('input', e => {
  const k = e.target.dataset?.input;
  if (!k || k === 'import' || k === 'schoolId' || k === 'fanTeam') return;
  setup[k] = e.target.value;
  const btn = document.querySelector('[data-action="setup-next"]');
  if (btn && setup.step === 1) btn.disabled = !(setup.name.trim() && setup.number !== '' && +setup.number >= 0 && +setup.number <= 99);
});
document.addEventListener('change', async e => {
  const k = e.target.dataset?.input;
  if (k === 'schoolId') { setup.schoolId = e.target.value; render(); }
  if (k === 'fanTeam') { setup.fanTeam = e.target.value; render(); }
  if (k === 'import' && e.target.files?.[0]) {
    try { state = await importFile(e.target.files[0]); persist(); tab = 'home'; closeSheet(); toast('저장 파일을 불러왔어요.'); }
    catch (err) { toast(err.message); }
  }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') { if (FX.fxBusy()) FX.closeFx(); else if (sheetView) closeSheet(); } });
void getTheme; void usd;
// 업데이트가 배포돼도 진행 중인 화면을 잃지 않도록(아티팩트 뷰어의 핫 리로드 훅).
const hot = typeof window !== 'undefined' ? window.claude?.hot : null;
hot?.snapshot?.(() => ({ tab, setup: { ...setup }, state }));
function start(data = {}) {
  if (data.state?.player) state = data.state;
  if (data.tab) tab = data.tab;
  if (data.setup) Object.assign(setup, data.setup);
  render();
}
hot?.ready ? hot.ready(start) : start(hot?.data ?? {});
try { if (state && localStorage.getItem('tdlife.patch') !== V.PATCH.id) { localStorage.setItem('tdlife.patch', V.PATCH.id); openSheet({ kind: 'patch' }); } } catch {}
// 내 Claude 계정 저장소: 더 최근 저장이 있으면 그걸로 이어 갑니다.
connectCloud().then(async c => {
  if (!c) return;
  const data = await cloudLoad();
  if (!data) return;
  mergeArchive(data.archive);
  const localAt = state?.savedAt || 0;
  if (data.career && (!state || data.savedAt > localAt)) { state = data.career; saveCareer(state); tab = 'home'; render(); toast('계정에 저장된 커리어를 불러왔어요.'); }
  else if (state && data.savedAt < localAt) saveCareer(state);
  else if (!state && data.empty) render();
});
window.addEventListener('pagehide', () => flush());
