// 빅게임 직접 플레이. 모든 포지션이 실시간으로 진행됩니다.
// 공격·수비: 플레이북(포메이션 8·플레이 50여 개 / 수비 포메이션 6·플레이 21개)에서 작전 카드를 고르면
// 위에서 내려다본 필드에서 내 선수를 직접 조작합니다 (liveplay.js · playbook.js). 코치 추천과 상대 정렬 읽기도 있습니다.
// 키커·펀터: 키커 뒤 시점에서 위로 쓸어 올려 찹니다 (kickplay.js). 4번째 다운·2점 컨버전도 직접 정합니다.
// ctx.practice면 연습 경기: 같은 화면으로 끝없이 해 볼 수 있고 결과는 돌려주지 않습니다(기록·성장에 반영 안 됨).
// 고르는 화면에는 '조작법' 버튼(H)이 있어 포지션별 키·기술·능력치 표(guide.js)를 띄웁니다.
import { POSITIONS, LEVEL_AVG, clamp } from '../engine/core.js';
import { DIFFICULTY } from '../engine/difficulty.js';
import { LivePlay } from './liveplay.js';
import { KickPlay } from './kickplay.js';
import { isKeyMode, onInputMode, keyName, typing, inputMode } from './input.js';
import { guideKeysHtml, guideGroupOf, modeToggleHtml } from './guide.js';
import { CX, OFF_CATS, DEF_CATS, FORMATIONS, DEF_FORMS, playsFor, defPlaysFor, suggestOff, suggestDef, offAdvice, defAdvice, whyOff, whyDef, aiOffPlay, aiDefPlay, playArt, defArt, CATCH_KIND_KO, CATCH_TYPE_KO, PASS_TYPE_KO } from './playbook.js';

// 내 포지션 → 필드에서 조작할 선수
const CONTROL = { QB: 'QB', RB: 'RB', WR: 'WR', TE: 'TE', OL: 'OL', CB: 'CB', S: 'S', LB: 'LB', EDGE: 'DL', DT: 'DL' };
// 수비 작전 그림에서 내 배정을 표시할 자리
const MINE_KEY = { CB: 'CBR', S: 'FS', LB: 'mike', EDGE: 'DL3', DT: 'DL1' };
// 스냅 전 공격 포메이션 기본값 (내 자리가 있는 포메이션)
const FORM0 = { TE: 'gun_trips' };
// 스냅 직후 필드 위에 잠깐 뜨는 조작 안내 (왼쪽 스틱 이동, 오른쪽 버튼 스킬)
const HINT = {
  QB: '리시버를 탭하면 패스 · 오른쪽 버튼으로 패스 종류(터치·불릿·로브) · 던진 뒤에는 리시버가 알아서 뛰어요',
  RB: '스틱: 달리기 · 루트를 뛸 땐 패스 콜(필드 탭)로 공 부르기 · 스핀·페이크·스티프 암',
  WR: '스틱: 루트 · 패스 콜 버튼이나 필드 탭으로 공을 불러요 · 공이 오면 하이포인트·안전·RAC 캐치',
  TE: '스틱: 루트 · 패스 콜 버튼이나 필드 탭으로 공을 불러요 · 공이 오면 하이포인트·안전·RAC 캐치',
  OL: '스틱: 빨간 화살표 러셔 앞을 막기 · 붙으면 펀치·버티기',
  DL: '스틱: 쿼터백에게 · 블로커에 걸리면 스핀 무브·스윔',
  LB: '스틱: 내 배정(노란 표시)대로 · 다이브 태클 · 공이 오면 가로채기·쳐내기',
  CB: '스틱: 내 배정(노란 표시)대로 · 잼으로 출발 방해 · 공이 오면 가로채기·쳐내기',
  S: '스틱: 깊은 곳 지키기 · 공이 오면 가로채기·쳐내기 · 다이브 태클',
};
// 컴퓨터(키보드)로 할 때의 안내: 같은 기능을 키로 (버튼 1~4 = Space·J·K·L, 버튼 위에 키가 적혀 있어요)
const HINT_KEY = {
  QB: 'WASD 이동 · 숫자 키 1~5: 그 번호 리시버에게 패스 · J 펌프 페이크 · L 패스 종류 · 던진 뒤에는 리시버가 알아서 뛰어요',
  RB: 'WASD 달리기 · Space·J·K·L 스핀·페이크·스티프 암 · Shift 터보 · 루트를 뛸 땐 Space 패스 콜',
  WR: 'WASD 루트 · Space 패스 콜 · J 페이크 · Shift 터보 · 공이 오면 Space·J·K 하이포인트·안전·RAC 캐치',
  TE: 'WASD 루트 · Space 패스 콜 · J 페이크 · Shift 터보 · 공이 오면 Space·J·K 하이포인트·안전·RAC 캐치',
  OL: 'WASD: 빨간 화살표 러셔 앞을 막기 · Space 펀치 · J 버티기',
  DL: 'WASD: 쿼터백에게 · 블로커에 걸리면 Space 스핀 무브 · J 스윔 · Shift 터보',
  LB: 'WASD: 내 배정(노란 표시)대로 · Space 잼 · J 다이브 태클 · 공이 오면 Space 가로채기 · J 쳐내기',
  CB: 'WASD: 내 배정(노란 표시)대로 · Space 잼 · J 다이브 · 공이 오면 Space 가로채기 · J 쳐내기',
  S: 'WASD: 깊은 곳 지키기 · J 다이브 태클 · 공이 오면 Space 가로채기 · J 쳐내기 · Shift 터보',
};
const SNAP_MSG_KEY = { QB: '스냅! 열린 리시버의 번호 키(1~5)를 누르세요.', WR: '스냅! 떨어졌다 싶으면 Space 패스 콜!', TE: '스냅! 떨어졌다 싶으면 Space 패스 콜!' };
const SNAP_MSG = {
  QB: '스냅! 열린 리시버를 탭하세요.', RB: '스냅! 구멍을 찾아 달리세요.', WR: '스냅! 떨어졌다 싶으면 패스 콜!', TE: '스냅! 떨어졌다 싶으면 패스 콜!',
  OL: '스냅! 빨간 표시 러셔를 막으세요.', DL: '스냅! 쿼터백을 향해!', LB: '상대가 스냅한다!', CB: '상대가 스냅한다!', S: '상대가 스냅한다!',
};
const RUN_KO = { zone: '존 런', power: '파워 런', counter: '카운터', toss: '토스 스윕', draw: '드로', sneak: 'QB 스닉', read: '존 리드', keep: 'QB 킵', qbdraw: 'QB 드로', jet: '젯 스윕', reverse: '엔드 어라운드' };
const ORD = ['', '1ST', '2ND', '3RD', '4TH'];
const R = Math.random;
const esc = v => String(v ?? '').replace(/[&<>"']/g, x => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[x]));

export function openClutch(root, ctx) {
  return new Promise(resolve => new Clutch(root, ctx, resolve));
}

class Clutch {
  constructor(root, c, done) {
    this.root = root; this.c = c; this.done = done;
    this.D = c.diff || DIFFICULTY.normal; // 난이도 (main.js에서 커리어의 난이도를 넘깁니다)
    const p = c.player, g = c.game;
    this.p = p; this.pos = p.pos; this.side = POSITIONS[p.pos].side; this.control = CONTROL[p.pos];
    this.mode = p.pos === 'K' ? 'kick' : p.pos === 'P' ? 'punt' : this.side === 'D' ? 'defense' : 'offense';
    this.final = !!g.final; this.practice = !!c.practice;
    this.drivesTotal = this.practice ? 999 : this.final ? 4 : 3;
    this.drive = 0;
    this.me = { colors: c.colors };
    this.oppColors = c.oppColors;
    this.lastForm = FORM0[this.pos] || 'gun_dbl'; this.lastDefForm = 'd43';
    // 미니게임 밖에서 쌓이는 양 팀 점수 (쿼터별로 나눠 전광판에 반영)
    const myStr = (g.myStr ?? 60) + this.D.live.edge, oppStr = g.oppStr ?? 60; // 직접 뛰지 않는 장면의 전력: 난이도 보정
    const td = x => Math.max(0, Math.round(x)) * 7;
    this.restFor = this.mode === 'offense' ? td(.5 + (myStr - oppStr) * .02 + R() * 1.2) : this.mode === 'kick' ? td(1.6 + (myStr - oppStr) * .03 + R() * 1.4) : td(1.8 + (myStr - oppStr) * .03 + R() * 1.6);
    this.restAgainst = this.mode === 'defense' ? td(.5 + (oppStr - myStr) * .02 + R() * 1.2) : td(1.6 + (oppStr - myStr) * .03 + R() * 1.6);
    if (this.practice) { this.restFor = 0; this.restAgainst = 0; }
    this.pf = 0; this.pa = 0;
    this.line = {}; this.snaps = []; this.log = [];
    this.build();
    // 키보드: 숫자 키로 작전 카드·선택지, Q·E로 플레이북 분류, Enter·Space로 스냅·다음 (화면에 키 표시)
    this.onKey = e => this.key(e); window.addEventListener('keydown', this.onKey);
    this.offMode = onInputMode(() => this.decorate());
    this.startDrive();
  }
  keyItems() { return [...this.$('cl-actions').querySelectorAll('.pb-card, .choice')].slice(0, 9); }
  key(e) {
    if (this.closed || typing(e) || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    const panel = this.$('cl-panel'); if (!panel || panel.hidden) return;
    const k = keyName(e), box = this.$('cl-actions'), tabs = [...box.querySelectorAll('[data-tab]')];
    if (!this.$('cl-help').hidden) { if (['h', 'esc', 'enter', 'space'].includes(k)) { e.preventDefault(); e.stopPropagation(); this.help(false); } return; }
    if (k === 'h') { e.preventDefault(); return this.help(true); }
    if (tabs.length && (k === 'q' || k === 'e')) { e.preventDefault(); const i = tabs.findIndex(b => b.classList.contains('on')); tabs[(i + (k === 'e' ? 1 : -1) + tabs.length) % tabs.length].click(); return; }
    if (/^[1-9]$/.test(k)) { const b = this.keyItems()[+k - 1]; if (b) { e.preventDefault(); b.click(); } return; }
    if (k === 'enter' || k === 'space') { const items = this.keyItems(), b = box.querySelector('button.primary') || (items.length === 1 ? items[0] : null); if (b) { e.preventDefault(); b.click(); } }
  }
  // 조작법 창: 내 포지션의 키·버튼 → 기술 → 능력치 (컴퓨터/모바일 전환). 고르는 화면에서만 열립니다.
  help(open, mode = this.helpMode || inputMode()) {
    const el = this.$('cl-help'); if (!el) return;
    this.helpMode = mode; el.hidden = !open;
    if (!open) { el.innerHTML = ''; return; }
    const btn = (v, label, on) => `<button class="${on ? 'on' : ''}" data-help-mode="${v}">${label}</button>`;
    el.innerHTML = `<div class="cl-help-card" role="dialog" aria-label="조작법"><div class="row between"><strong>조작법 · ${POSITIONS[this.pos].ko}</strong><button class="gym-x" data-help-close>닫기${isKeyMode() ? ' <kbd class="cl-key">H</kbd>' : ''}</button></div>
      ${modeToggleHtml(mode, btn)}<p class="gd-note">알약은 그 기술에 쓰이는 내 능력치예요. 버튼은 상황에 따라 바뀌어요.</p>${guideKeysHtml(guideGroupOf(this.pos), mode, this.pos)}</div>`;
    el.onclick = e => { const m = e.target.closest('[data-help-mode]'); if (m) return this.help(true, m.dataset.helpMode); if (e.target === el || e.target.closest('[data-help-close]')) this.help(false); };
  }
  // 키보드면 고를 수 있는 것마다 키를 붙입니다
  decorate() {
    const box = this.$('cl-actions'); if (!box) return;
    const kbd = isKeyMode();
    this.root.querySelector('.clutch')?.classList.toggle('kbd', kbd);
    this.root.querySelectorAll('#cl-panel .cl-key, #cl-panel .cl-key-hint').forEach(x => x.remove());
    if (!kbd) return;
    this.keyItems().forEach((b, i) => b.insertAdjacentHTML('afterbegin', `<kbd class="cl-key">${i + 1}</kbd>`));
    box.querySelector('button.primary')?.insertAdjacentHTML('beforeend', ' <kbd class="cl-key">Enter</kbd>');
    this.root.querySelector('[data-cl="help"]')?.insertAdjacentHTML('beforeend', ' <kbd class="cl-key">H</kbd>');
    box.querySelector('.pb-tabs')?.insertAdjacentHTML('afterbegin', '<span class="cl-key-hint" title="분류 바꾸기"><kbd class="cl-key">Q</kbd><kbd class="cl-key">E</kbd></span>');
  }
  // ───────── 화면 ─────────
  build() {
    const c = this.c;
    this.root.innerHTML = `<div class="clutch" role="dialog" aria-modal="true" aria-label="빅게임 직접 플레이">
      <div class="cl-top"><div class="cl-team"><b id="cl-pf">0</b><small>${esc(c.myName)}</small></div>
        <div class="cl-mid"><div class="cl-tags"><span class="cl-live-tag${this.practice ? ' practice' : ''}">${this.practice ? '연습' : 'LIVE'}</span><span id="cl-q" class="cl-q">1Q</span><span class="diff-badge" style="--dc:${this.D.color}">${this.D.tag}</span></div><small id="cl-dd"></small><em class="cl-title">${esc(c.game.title || c.game.round || '빅게임')}</em></div>
        <div class="cl-team opp"><b id="cl-pa">0</b><small>${esc(c.oppName)}</small></div></div>
      <div class="cl-stage"><div id="cl-live" class="cl-live"></div>
        <div id="cl-panel" class="cl-panel"><p id="cl-msg" class="cl-msg"></p><div id="cl-actions" class="cl-actions"></div><div class="cl-foot"><button class="cl-auto" data-cl="help">조작법</button><button class="cl-auto" data-cl="auto">${this.practice ? '연습 끝내기' : '자동으로 마무리'}</button></div></div>
        <div id="cl-help" class="cl-help" hidden></div></div></div>`;
    this.root.querySelector('[data-cl="auto"]').onclick = () => this.finish(true);
    this.root.querySelector('[data-cl="help"]').onclick = () => this.help(true);
  }
  $(id) { return this.root.querySelector('#' + id); }
  quarter() { return Math.min(4, 1 + Math.floor(this.drive * 4 / this.drivesTotal)); }
  restSoFar() { const q = (this.drive + 1) / this.drivesTotal; return [Math.round(this.restFor * q / 7) * 7, Math.round(this.restAgainst * q / 7) * 7]; }
  board(dd = '') {
    const [rf, ra] = this.restSoFar();
    this.$('cl-pf').textContent = rf + this.pf; this.$('cl-pa').textContent = ra + this.pa;
    this.$('cl-q').textContent = `${this.quarter()}Q`;
    this.$('cl-dd').textContent = dd;
  }
  msg(t) { this.$('cl-msg').innerHTML = t; }
  // 아래 패널(메시지·버튼)은 고를 것이 있을 때만 필드 위에 뜹니다. 플레이 중에는 숨기고 필드를 통째로 씁니다.
  actions(html) {
    this.$('cl-actions').innerHTML = html;
    this.decorate();
    const panel = this.$('cl-panel'); panel.hidden = !html;
    this.view?.setInset(html ? panel.offsetHeight : 0);
  }
  spot(y) { return y >= 50 ? `상대 진영 ${100 - y}` : y === 50 ? '미드필드' : `자기 진영 ${y}`; }
  dd() { const d = this.d; return d ? `${['', '1st', '2nd', '3rd', '4th'][d.down]} & ${d.goal ? 'Goal' : d.toGo} · ${this.spot(d.ball)}` : ''; }
  banner() { const d = this.d; return `${ORD[d.down]} & ${d.goal ? 'GOAL' : d.toGo}`; }
  pop(text, color, burst = false) { this.view?.pop(text, color, burst); }
  clearView() { this.view?.destroy(); this.view = null; }
  sit() { const d = this.d; return { down: d.down, toGo: d.goal ? 100 - d.ball : d.toGo, ball: d.ball, twoPt: !!d.twoPt }; }

  // ───────── 실시간 필드 ─────────
  liveCfg(extra = {}) {
    const c = this.c, g = c.game, d = this.d, offense = this.mode === 'offense';
    const lvl = c.levelAvg, L = this.D.live, myR = lvl + ((g.myStr ?? 60) - 60) * .12 + L.mate, oppR = lvl + ((g.oppStr ?? 60) - 60) * .12 + L.opp; // 우리 팀·상대 AI 수준: 난이도 보정
    return {
      ball: d.ball, toGo: d.goal ? 100 - d.ball : d.toGo, control: this.control, edge: this.pos === 'EDGE', side: offense ? 'O' : 'D',
      me: { attrs: this.p.attrs, ovr: this.p.ovr, number: this.p.number }, teamRating: offense ? myR : oppR, oppRating: offense ? oppR : myR,
      offColors: offense ? this.me.colors : this.oppColors, defColors: offense ? this.oppColors : this.me.colors,
      endzone: offense ? [this.me.colors[0], this.oppColors[0]] : [this.oppColors[0], this.me.colors[0]],
      away: (g.home === false) === offense ? 'O' : 'D', // 내가 원정이면 우리 팀이 흰 유니폼
      banner: this.banner(), diff: L, ...extra,
    };
  }
  // 스냅 전 양 팀 정렬을 바로 보여 줍니다.
  preview(extra) { this.clearView(); this.view = new LivePlay(this.$('cl-live'), this.liveCfg(extra)); this.view.setInset(this.$('cl-panel').hidden ? 0 : this.$('cl-panel').offsetHeight); }
  snapLive(opts) {
    this.actions('');
    this.snapCount = (this.snapCount || 0) + 1;
    const kbd = isKeyMode();
    if (this.practice) this.snapCount = 1; // 연습에서는 조작 안내를 매번 보여 줍니다
    this.view.tip(this.snapCount <= 3 ? (kbd ? HINT_KEY : HINT)[this.control] : (kbd && SNAP_MSG_KEY[this.control]) || SNAP_MSG[this.control] || '스냅!', this.snapCount <= 3 ? 4.5 : 2);
    return this.view.snap(opts);
  }
  boxCount() { const d = this.d; return this.view.P.filter(p => p.team === 'D' && Math.abs(p.home.x - CX) < 6.5 && p.home.y < d.ball + 7).length; }
  // 플레이북: 탭(추천·분류) + 작전 그림 카드
  showBook({ kind, list, rec, cats, advice, onPick }) {
    const tabs = [['rec', '추천'], ...cats.filter(([k]) => list.some(p => p.cat === k))];
    const recSet = new Set(rec.map(p => p.id));
    const card = p => {
      const art = kind === 'off' ? playArt(p) : defArt(p, MINE_KEY[this.pos]);
      const sub = kind === 'off' ? FORMATIONS[p.form].name : DEF_FORMS[p.form].name;
      const why = recSet.has(p.id) ? (kind === 'off' ? whyOff(p) : whyDef(p)) : '';
      return `<button class="pb-card${recSet.has(p.id) ? ' rec' : ''}" data-pid="${p.id}"><img src="${art}" alt="" width="110" height="66"><b>${esc(p.name)}</b><small>${esc(sub)}${why ? ` · ${esc(why)}` : ''}</small></button>`;
    };
    const render = tab => {
      const items = tab === 'rec' ? rec : list.filter(p => p.cat === tab);
      this.$('pb-cards').innerHTML = items.map(card).join('');
      this.$('pb-cards').scrollLeft = 0;
      this.root.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
      this.$('pb-advice').hidden = tab !== 'rec';
      this.root.querySelectorAll('[data-pid]').forEach(b => b.onclick = () => onPick(list.find(p => p.id === b.dataset.pid)));
      this.decorate();
    };
    this.actions(`<div class="pb"><div class="pb-tabs">${tabs.map(([k, n]) => `<button data-tab="${k}">${esc(n)}${k === 'rec' ? '' : ` <i>${list.filter(p => p.cat === k).length}</i>`}</button>`).join('')}</div>
      <p class="pb-advice" id="pb-advice">코치: ${esc(advice)}</p><div class="pb-cards" id="pb-cards"></div></div>`);
    this.root.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => render(b.dataset.tab));
    render('rec');
    this.view?.setInset(this.$('cl-panel').offsetHeight);
  }
  // 플레이 결과를 한 줄로: 캐치 분류(숏·미디엄·롱 + 캐치 종류), 패스 종류, 런 종류, 상대 작전
  describe(o, offense) {
    const parts = [];
    if (o.catch) { const k = o.catch; parts.push(`${CATCH_KIND_KO[k.kind]} ${o.gain}야드 (공중 ${k.air} + 캐치 후 ${k.yac})`); if (CATCH_TYPE_KO[k.type]) parts.push(CATCH_TYPE_KO[k.type]); if (o.pass) parts.push(PASS_TYPE_KO[o.pass]); }
    else if (o.turnover === 'INT') parts.push(`인터셉트${o.pass ? ` (${PASS_TYPE_KO[o.pass]})` : ''}`);
    else if (o.incomplete) parts.push(o.pass ? `${PASS_TYPE_KO[o.pass]} 인컴플리트` : '패스 인컴플리트');
    else if (o.sack) parts.push(`색 ${-o.gain}야드 손실`);
    else if (o.run) parts.push(`${RUN_KO[o.run.type] || '런'} ${o.gain >= 0 ? `${o.gain}야드` : `${-o.gain}야드 손실`}`);
    else parts.push(o.gain >= 0 ? `${o.gain}야드 전진` : `${-o.gain}야드 손실`);
    if (offense && o.def) parts.push(`상대 수비: ${o.def.cov} (${o.def.form})`);
    if (!offense && o.play) parts.push(`상대 작전: ${o.play.form} ${o.play.name}`);
    return parts.join(' · ');
  }

  // ───────── 드라이브 ─────────
  startDrive() {
    if (this.drive >= this.drivesTotal) return this.finish(false);
    const last = this.drive === this.drivesTotal - 1;
    const [rf, ra] = this.restSoFar(), me = rf + this.pf, op = ra + this.pa;
    const story = this.practice ? '연습 경기 · 기록에 남지 않아요. 마음껏 해 보세요' : last ? (me < op ? '역전이 필요하다! 마지막 드라이브' : me > op ? '승리를 굳힐 마지막 기회' : '동점, 운명의 마지막 드라이브') : ['1쿼터, 첫 번째 결정적 순간', '흐름을 가져올 때', '후반전, 승부처', '4쿼터'][this.quarter() - 1];
    if (this.mode === 'kick') return this.kickSetup(story, last);
    if (this.mode === 'punt') return this.puntSetup(story);
    const start = 20 + Math.floor(R() * 16);
    this.d = { ball: start, down: 1, toGo: 10, first: start + 10, snaps: 0, offense: this.mode === 'offense' };
    this.board(this.dd());
    this.storyLine = `<b>${esc(story)}</b><br>`;
    this.mode === 'offense' ? this.offensePick() : this.defensePick();
  }
  endDrive(text) {
    this.log.push(text);
    this.drive++;
    this.board(this.dd());
    this.msg(esc(text));
    this.actions(`<button class="primary" data-cl="next">${this.practice ? '한 번 더' : this.drive >= this.drivesTotal ? '경기 결과 보기' : '다음 장면'}</button>`);
    this.root.querySelector('[data-cl="next"]').onclick = () => this.startDrive();
  }
  // ───────── 공격 ─────────
  offensePick(note = '') {
    const d = this.d, intro = this.storyLine || ''; this.storyLine = '';
    this.board(this.dd());
    this.aiDef = aiDefPlay({ ...this.sit(), offForm: this.lastForm }); // 상대 수비 작전 (정렬이 필드에 그대로 보임)
    this.preview({ defPlay: this.aiDef.id, offForm: this.lastForm });
    const lead = `${intro}${note ? esc(note) + '<br>' : ''}`;
    if (d.down === 4) {
      const dist = 100 - d.ball + 17;
      const opts = [`<button class="choice" data-go="go"><strong>고! 4번째 다운 승부</strong><div class="hint">${d.toGo}야드를 가야 한다</div></button>`];
      if (dist <= 57) opts.push(`<button class="choice" data-go="fg"><strong>필드골 시도 (${dist}야드)</strong><div class="hint">팀 키커에게 맡긴다</div></button>`);
      opts.push(`<button class="choice" data-go="punt"><strong>펀트</strong><div class="hint">필드 포지션을 지킨다</div></button>`);
      this.msg(`${lead}<b>4th & ${d.toGo}</b> · 감독이 나를 본다. 어떻게 할까?`);
      this.actions(opts.join(''));
      this.root.querySelectorAll('[data-go]').forEach(b => b.onclick = () => {
        const v = b.dataset.go;
        if (v === 'go') { this.msg('승부! 작전을 고르세요.'); return this.callPlay(); }
        if (v === 'fg') { const ok = R() < clamp(.97 - (dist - 20) * .013, .3, .97); if (ok) this.pf += 3; this.pop(ok ? 'GOOD!' : 'NO GOOD', ok ? '#F2C230' : '#E85A5A'); return this.endDrive(ok ? `${dist}야드 필드골 성공` : `${dist}야드 필드골 실패`); }
        this.pop('PUNT', '#FFFFFF'); return this.endDrive('펀트로 공격권을 넘겼다');
      });
      return;
    }
    this.msg(`${lead}${intro ? '우리 공격. ' : ''}작전 카드를 고르면 바로 스냅합니다.`);
    this.callPlay();
  }
  callPlay(twoPt = false) {
    const sit = { ...this.sit(), shell: this.view.shellShown, box: this.boxCount() };
    let list = playsFor(this.pos);
    if (twoPt) list = list.filter(p => ['short', 'run', 'pa'].includes(p.cat) || p.form === 'goal');
    this.showBook({ kind: 'off', list, rec: suggestOff(list, sit), cats: OFF_CATS, advice: offAdvice(sit), onPick: p => { this.lastForm = p.form; this.snapLive({ play: p.id }).then(o => twoPt ? this.resolveTwo(o) : this.resolveLive(o)); } });
  }
  resolveLive(o) {
    const d = this.d;
    this.mergeStats(o.stats);
    let zone = o.td || o.gain >= 15 ? 'perfect' : (!o.incomplete && !o.turnover && !o.sack && (o.gain >= Math.min(d.toGo, 5))) ? 'good' : 'miss';
    if (this.pos === 'OL') zone = o.stats?.sa ? 'miss' : o.stats?.pan || o.td ? 'perfect' : o.turnover ? 'miss' : 'good';
    this.snap(zone, !!o.td, !!o.turnover);
    const text = this.describe(o, true);
    if (o.turnover) { this.pop(o.turnover === 'INT' ? 'INTERCEPTED' : 'FUMBLE', '#E85A5A'); return this.endDrive(`${o.turnover === 'INT' ? '공격권을 잃었다' : '펌블! 공격권을 잃었다'} · ${text}`); }
    if (o.td) { this.pf += 6; this.tdText = text; return this.afterTD(); }
    if (!o.incomplete) d.ball = clamp(d.ball + o.gain, 1, 99);
    d.snaps++;
    if (d.ball >= d.first) { d.down = 1; d.toGo = Math.min(10, 100 - d.ball); d.goal = 100 - d.ball <= 10; d.first = d.ball + d.toGo; }
    else { d.down++; d.toGo = d.first - d.ball; }
    if (d.down > 4) { this.pop('TURNOVER', '#E85A5A'); return this.endDrive(`4번째 다운 실패, 공격권 넘김 · ${text}`); }
    if (d.snaps >= 9) { const dist = 100 - d.ball + 17; if (dist <= 50 && R() < .8) { this.pf += 3; this.pop('FG GOOD', '#F2C230'); return this.endDrive(`시간에 쫓겨 ${dist}야드 필드골`); } return this.endDrive('시간이 다 됐다'); }
    this.offensePick(text);
  }
  afterTD() {
    this.board(this.dd());
    this.msg(`<b>터치다운!</b> ${esc(this.tdText || '')}<br>추가 득점은?`);
    this.actions(`<button class="choice" data-x="pat"><strong>PAT (1점)</strong><div class="hint">거의 확실하다</div></button><button class="choice" data-x="two"><strong>2점 컨버전</strong><div class="hint">2야드에서 한 번 더 승부</div></button>`);
    this.root.querySelector('[data-x="pat"]').onclick = () => { const ok = R() < .95; if (ok) this.pf += 1; this.pop(ok ? 'PAT GOOD' : 'PAT MISS', ok ? '#F2C230' : '#E85A5A'); this.endDrive(ok ? '터치다운 + PAT' : '터치다운, PAT 실패'); };
    this.root.querySelector('[data-x="two"]').onclick = () => {
      this.saveD = this.d; this.d = { ...this.d, ball: 98, down: 1, toGo: 2, first: 100, goal: true, twoPt: true };
      this.aiDef = aiDefPlay(this.sit());
      this.preview({ defPlay: this.aiDef.id, offForm: this.lastForm });
      this.msg('2점 컨버전! 골라인 작전을 고르세요.');
      this.callPlay(true);
    };
  }
  resolveTwo(o) {
    this.d = this.saveD; const ok = !!o.td; this.mergeStats(o.stats); if (ok) this.pf += 2; this.snap(ok ? 'perfect' : 'miss', ok, false);
    this.pop(ok ? '2 POINTS!' : 'NO GOOD', ok ? '#F2C230' : '#E85A5A', ok); this.endDrive(ok ? '터치다운 + 2점 컨버전 성공' : '터치다운, 2점 컨버전 실패');
  }
  // ───────── 수비 ─────────
  defensePick(note = '') {
    const d = this.d, intro = this.storyLine || ''; this.storyLine = '';
    const sit = this.sit();
    this.aiOff = aiOffPlay(sit); // 상대 공격 작전 (포메이션이 필드에 그대로 보임)
    sit.offForm = this.aiOff.form;
    this.board(this.dd());
    this.preview({ offPlay: this.aiOff.id, defForm: this.lastDefForm });
    this.msg(`${intro}${note ? esc(note) + '<br>' : ''}상대 포메이션: <b>${esc(FORMATIONS[this.aiOff.form].name)}</b>. 수비 작전을 고르면 스냅.`);
    const list = defPlaysFor(this.pos);
    this.showBook({ kind: 'def', list, rec: suggestDef(list, sit), cats: DEF_CATS, advice: defAdvice(sit), onPick: p => { this.lastDefForm = p.form; this.snapLive({ defPlay: p.id }).then(o => this.resolveLiveDefense(o)); } });
  }
  resolveLiveDefense(o) {
    const d = this.d;
    this.mergeStats(o.stats);
    const mine = o.stats || {}, big = mine.sack || mine.dint || mine.tfl || mine.ff;
    const zone = big || o.turnover ? 'perfect' : (o.incomplete || o.gain <= 3) ? 'good' : 'miss';
    this.snap(zone, !!big, !!o.td, !!o.turnover);
    const text = this.describe(o, false);
    if (o.turnover) { if (o.pickSix) this.pf += 7; this.pop(o.pickSix ? 'PICK SIX!' : 'TAKEAWAY!', '#F2C230', true); return this.endDrive(`${o.turnover === 'INT' ? (o.pickSix ? '픽식스!' : '인터셉트로 공격권을 빼앗았다') : '펌블을 유도해 공격권을 빼앗았다'} · ${text}`); }
    if (o.td) { this.pa += 7; return this.endDrive(`터치다운을 허용했다 · ${text}`); }
    if (!o.incomplete) d.ball = clamp(d.ball + o.gain, 1, 99);
    d.snaps++;
    if (d.ball >= d.first) { d.down = 1; d.toGo = Math.min(10, 100 - d.ball); d.goal = 100 - d.ball <= 10; d.first = d.ball + d.toGo; }
    else { d.down++; d.toGo = d.first - d.ball; }
    if (d.down === 4 || d.snaps >= 8) {
      const dist = 100 - d.ball + 17;
      if (dist <= 52) { const ok = R() < clamp(.95 - (dist - 20) * .012, .4, .95); if (ok) this.pa += 3; this.pop(ok ? 'FG GOOD' : 'FG MISS', ok ? '#E85A5A' : '#F2C230'); return this.endDrive(ok ? `상대 ${dist}야드 필드골` : `상대 ${dist}야드 필드골 실패`); }
      if (d.toGo <= 2 && d.ball >= 45 && R() < .5) return this.defensePick(`${text} · 상대가 4번째 다운에 승부를 건다!`);
      this.pop('STOP!', '#F2C230', true); return this.endDrive('수비 성공, 상대 펀트');
    }
    this.defensePick(text);
  }
  mergeStats(st = {}) { for (const [k, v] of Object.entries(st)) inc(this.line, k, v); }
  // ───────── 키커 ─────────
  kickSetup(story, last) {
    const dists = this.final ? [36, 44, 49, 53] : [33, 42, 48];
    const dist = dists[this.drive] ?? 45;
    const wind = Math.round((R() - .5) * 24 * this.D.kick.wind);
    this.d = { ball: 100 - (dist - 17), down: 4, toGo: 3, first: 103, goal: false };
    this.board(`${dist}야드 필드골`);
    this.clearView();
    this.view = new KickPlay(this.$('cl-live'), { mode: 'fg', dist, wind, last, me: { attrs: this.p.attrs, ovr: this.p.ovr }, colors: this.me.colors, oppColors: this.oppColors, diff: this.D.kick });
    this.msg(`<b>${esc(story)}</b><br>${dist}야드 필드골. 바람 ${wind === 0 ? '없음' : `${wind > 0 ? '오른쪽 →' : '← 왼쪽'} ${Math.abs(wind)}km/h`}. 스냅 뒤 러셔가 오기 전에 차세요.`);
    this.actions(`<button class="primary" data-cl="snap">스냅!</button>`);
    this.root.querySelector('[data-cl="snap"]').onclick = () => {
      this.actions(''); this.view.tip(isKeyMode() ? 'A·D로 방향 · Space를 꾹 눌러 힘을 모았다가 초록에서 떼기' : '공 근처에서 위로 쓸어 올리세요! 오른쪽 막대 초록에서 놓기', 3.5);
      this.view.snap().then(r => {
        const L = this.line, ok = !!r.good;
        inc(L, 'fga'); if (ok) { inc(L, 'fgm'); L.fglong = Math.max(L.fglong || 0, dist); this.pf += 3; }
        this.snap(ok ? (Math.abs(r.offset ?? 9) < 1.3 ? 'perfect' : 'good') : 'miss', ok, false);
        const why = r.blocked ? '블록당했다' : r.why === 'short' ? '짧았다' : r.why === 'left' ? '왼쪽으로 빗나갔다' : r.why === 'right' ? '오른쪽으로 빗나갔다' : '골대를 맞고 나왔다';
        this.endDrive(ok ? `${dist}야드 필드골 성공${r.doink ? ' (골대 맞고 들어갔다!)' : ''}` : `${dist}야드 필드골 실패 · ${why}`);
      });
    };
  }
  // ───────── 펀터 ─────────
  puntSetup(story) {
    const start = 22 + Math.floor(R() * 18), wind = Math.round((R() - .5) * 20 * this.D.kick.wind);
    this.d = { ball: start, down: 4, toGo: 6, first: start + 6, goal: false };
    this.board(`4th & 6 · ${this.spot(start)}`);
    this.clearView();
    this.view = new KickPlay(this.$('cl-live'), { mode: 'punt', start, wind, me: { attrs: this.p.attrs, ovr: this.p.ovr }, colors: this.me.colors, oppColors: this.oppColors, diff: this.D.kick });
    this.msg(`<b>${esc(story)}</b><br>펀트. 금색으로 칠한 상대 20야드 안쪽을 노리세요. 엔드존에 들어가면 터치백. 바람 ${wind === 0 ? '없음' : `${wind > 0 ? '→' : '←'} ${Math.abs(wind)}km/h`}.`);
    this.actions(`<button class="primary" data-cl="snap">스냅!</button>`);
    this.root.querySelector('[data-cl="snap"]').onclick = () => {
      this.actions(''); this.view.tip(isKeyMode() ? 'A·D로 방향 · Space 꾹 → 초록에서 떼면 펀트! 비스듬히 차면 사이드라인 쪽으로' : '위로 쓸어 올려 펀트! 비스듬히 차면 사이드라인 쪽으로', 3.5);
      this.view.snap().then(r => {
        const L = this.line;
        let land, text;
        if (r.blocked) { land = Math.max(1, start - 12); text = '펀트가 막혔다!'; }
        else { land = r.final; text = `${r.gross}야드 펀트${r.in20 ? ', 20야드 안쪽' : r.tb ? ', 터치백' : r.oob ? ', 사이드라인 밖' : r.fair ? ', 페어 캐치' : r.ret ? `, ${r.ret}야드 리턴` : ''}`; inc(L, 'punts'); inc(L, 'puntyds', r.gross); if (r.in20) inc(L, 'in20'); }
        // 상대 시작 위치(자기 진영 기준) → 그 드라이브의 실점 확률
        const oppStart = 100 - land, risk = oppStart >= 50 ? [.38, .22] : oppStart >= 30 ? [.22, .2] : oppStart >= 20 ? [.14, .16] : [.07, .1];
        const roll = R(), allowed = roll < risk[0] ? 7 : roll < risk[0] + risk[1] ? 3 : 0; this.pa += allowed;
        const net = r.blocked ? -99 : r.net;
        this.snap(r.in20 || net >= 42 ? 'perfect' : net >= 34 ? 'good' : 'miss', !!r.in20, !!r.blocked);
        this.endDrive(`${text}${allowed ? ` · 그 드라이브에서 ${allowed}점 실점` : ''}`);
      });
    };
  }
  snap(zone, good, bad, takeaway = false) { this.snaps.push({ zone, good, bad, takeaway }); }
  // ───────── 결과 ─────────
  grade() {
    if (!this.snaps.length) return 60;
    const v = { perfect: 92, good: 74, miss: 46 };
    const avg = this.snaps.reduce((n, x) => n + v[x.zone], 0) / this.snaps.length;
    const bonus = this.snaps.filter(x => x.good).length * 2.5 + this.snaps.filter(x => x.takeaway).length * 3 - this.snaps.filter(x => x.bad).length * 5;
    return Math.round(clamp(avg + bonus, 32, 99) * 10) / 10;
  }
  finish(auto) {
    if (this.closed) return;
    this.closed = true;
    window.removeEventListener('keydown', this.onKey); this.offMode?.();
    if (this.practice) { this.clearView(); this.root.innerHTML = ''; return this.done(null); }
    this.clearView();
    if (auto && this.drive === 0 && !this.snaps.length) { this.root.innerHTML = ''; return this.done(null); }
    // 아직 남은 장면은 자동으로: 공격·수비 각각 평범한 결과로 채웁니다.
    for (let i = this.drive; i < this.drivesTotal; i++) {
      if (this.mode === 'offense') this.pf += R() < .35 ? 7 : R() < .3 ? 3 : 0;
      else if (this.mode === 'defense') this.pa += R() < .3 ? 7 : R() < .25 ? 3 : 0;
      else if (this.mode === 'kick') { inc(this.line, 'fga'); if (R() < .8) { inc(this.line, 'fgm'); this.pf += 3; } }
    }
    const [rf, ra] = [this.restFor, this.restAgainst];
    if (this.mode === 'kick') { const tds = rf / 7; this.line.xpa = (this.line.xpa || 0) + tds; this.line.xpm = (this.line.xpm || 0) + tds; }
    const res = { pointsFor: this.pf, pointsAgainst: this.pa, restFor: rf, restAgainst: ra, line: this.line, grade: this.grade(), plays: this.log };
    this.root.innerHTML = '';
    this.done(res);
  }
}
function inc(L, k, v = 1) { L[k] = (L[k] || 0) + v; }
export const clutchLevelAvg = s => s.stage === 'hs' ? 48 : s.stage === 'college' ? 62 : s.stage === 'cfl' ? LEVEL_AVG.CFL : LEVEL_AVG.NFL;
