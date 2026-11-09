// 앱 진입점: 상태 보관, 렌더링, 이벤트 위임, 저장.
import { createCareer, makeCandidates, startSeason, advance, chooseCard, choosePath, chooseTurning, retireCareer, setTraining, setRedshirt } from './engine/career.js';
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
const setup = { step: 0, avatar: { skin: 1, hair: 0, style: 0, visor: 0 }, name: '', number: '7', pos: 'WR', nat: 'US', schoolId: 'img', seedN: 0, cand: null, focus: [] };
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
        state = createCareer({ name: setup.name, number: +setup.number, pos: setup.pos, nat: setup.nat, schoolId: setup.schoolId, avatar: { ...setup.avatar }, arch: c.arch, attrs: c.attrs, focus: setup.focus });
        persist(); tab = 'home'; render(); window.scrollTo(0, 0); toast('첫 시즌이 준비됐어요.');
      } catch (err) { toast(err.message); }
      break;
    }
    // 진행
    case 'training': mutate(() => setTraining(state, v)); break;
    case 'redshirt': mutate(() => setRedshirt(state, !state.redshirt)); break;
    case 'start-season': mutate(() => startSeason(state), () => { window.scrollTo(0, 0); if (state.phase === 'offseason') { markSeen('report'); openSheet({ kind: 'report', year: state.history.at(-1).year }); } }); break;
    case 'advance': mutate(() => advance(state), () => { if (state.phase === 'offseason') { markSeen('report'); openSheet({ kind: 'report', year: state.history.at(-1).year }); } else window.scrollTo(0, 0); }); break;
    case 'choose-card': mutate(() => chooseCard(state, +v), () => window.scrollTo(0, 0)); break;
    case 'open-todo': {
      const t = state.todos.find(x => x.id === v); if (!t) break;
      markSeen(v);
      if (v === 'report') openSheet({ kind: 'report', year: t.year });
      else if (v === 'broadcast') playBroadcast(t.year);
      else if (v === 'draft') openSheet({ kind: 'draft' });
      else if (v === 'turning') { focusDraft = [...state.player.focus]; openSheet({ kind: 'turning' }); }
      else if (v === 'shop') openSheet({ kind: 'shop' });
      render(); renderSheet();
      break;
    }
    case 'bc-skip': clearInterval(bcTimer); sheetView.shown = 999; renderSheet(); break;
    case 'open-path': pathSel = null; openSheet({ kind: 'path' }); break;
    case 'path-pick': pathSel = v; renderSheet(); break;
    case 'path-confirm': {
      const id = pathSel; if (!id) break;
      const before = state.phase;
      const text = mutate(() => choosePath(state, id));
      if (text === undefined) break;
      pathSel = null;
      if (state.phase === 'retired') { closeSheet(); afterRetire(); toast('은퇴했습니다. 수고 많았어요.'); break; }
      if (state.phase === 'offseason' && state.path) { toast(text); renderSheet(); if (state.todos.some(t => t.id === 'draft' && !t.seen)) { markSeen('draft'); openSheet({ kind: 'draft' }); } break; }
      closeSheet(); toast(text);
      if (state.todos.some(t => t.id === 'draft' && !t.seen)) { markSeen('draft'); openSheet({ kind: 'draft' }); }
      void before;
      break;
    }
    case 'focus-pick': focusDraft = focusDraft.includes(v) ? focusDraft.filter(x => x !== v) : [...focusDraft, v].slice(-2); renderSheet(); break;
    case 'turning': mutate(() => chooseTurning(state, v, { focus: focusDraft }), text => { closeSheet(); toast(text); }); break;
    case 'open-shop': markSeen('shop'); openSheet({ kind: 'shop' }); break;
    case 'buy': mutate(() => buyItem(state, v), lines => { toast(`구매 완료 · ${lines.join(', ')}`); renderSheet(); }); break;
    case 'staff': { const on = !state.shop.staff[v]; mutate(() => hireStaff(state, v, on), () => { toast(on ? `${STAFF.find(x => x.id === v).name}와 계약했어요.` : '계약을 해지했어요.'); renderSheet(); }); break; }
    case 'facility': mutate(() => buyFacility(state, v), () => { toast('시설을 업그레이드했어요.'); renderSheet(); }); break;
    case 'retire-ask': openSheet({ kind: 'confirm', title: '지금 은퇴할까요?', body: '은퇴하면 이 커리어는 끝나고, 은퇴 기록과 커리어 카드가 남아요.', action: 'retire-now', label: '은퇴하기' }); break;
    case 'retire-now': mutate(() => retireCareer(state, '스스로 은퇴를 결정했습니다.'), () => { closeSheet(); afterRetire(); }); break;
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
  if (!k || k === 'import') return;
  setup[k] = e.target.value;
  const btn = document.querySelector('[data-action="setup-next"]');
  if (btn && setup.step === 1) btn.disabled = !(setup.name.trim() && setup.number !== '' && +setup.number >= 0 && +setup.number <= 99);
});
document.addEventListener('change', async e => {
  const k = e.target.dataset?.input;
  if (k === 'schoolId') { setup.schoolId = e.target.value; render(); }
  if (k === 'import' && e.target.files?.[0]) {
    try { state = await importFile(e.target.files[0]); persist(); tab = 'home'; closeSheet(); toast('저장 파일을 불러왔어요.'); }
    catch (err) { toast(err.message); }
  }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && sheetView) closeSheet(); });
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
