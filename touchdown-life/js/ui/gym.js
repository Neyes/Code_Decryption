// 헬스장 화면: 도트 체육관 장면 + 운동 목록 + 운동별 미니게임(연타·타이밍·좌우 연타·방향 QTE·모았다 떼기·표적 탭).
// 결과 점수(0~1.25)를 engine/gym.js의 finishExercise에 넘겨 능력치 진행도를 올립니다.
// 조작: 모바일은 화면 버튼 터치, 컴퓨터는 같은 버튼을 키로(버튼마다 키 표시). Space 연타·탭·꾹, F·J(A·D) 좌우 발,
// WASD(방향키) 콘, Q·W·E / A·S·D / Z·X·C 표적 9칸. 목록에서 숫자 키로 운동 고르기, Enter 다른 운동, Esc 나가기.
import { bigText, pixelText, vivid, shade, lum, OUT } from './pixel.js';
import { playerSprite, SKINS } from './sprites.js';
import { ATTR } from '../engine/core.js';
import { isKeyMode, onInputMode, keyName, typing } from './input.js';
import { diffOf } from '../engine/difficulty.js';
import { EXERCISES, GYM_TIERS, MAX_SETS, gymTier, gymState, gymDayLabel, exerciseAttr, exerciseName, canExercise, finishExercise, gradeOf } from '../engine/gym.js';

const W = 240, H = 124, R = Math.random, clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const esc = v => String(v ?? '').replace(/[&<>"']/g, x => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[x]));
const KIND_KO = { mash: '연타', timing: '타이밍', alt: '좌우 연타', arrows: '방향 QTE', charge: '모았다 떼기', targets: '표적 탭' };
const TIER_SIGN = ['', 'TOWN GYM', 'PERFORMANCE', 'ELITE LAB'];
const DIRS = { up: '↑', left: '←', right: '→', down: '↓' };
// 키보드: 운동 종류별 키 → 버튼, 버튼에 적을 키
const PAD_KEYS = {
  mash: { space: 'push' }, timing: { space: 'tap' }, charge: { space: 'hold' },
  alt: { f: 'L', a: 'L', left: 'L', j: 'R', d: 'R', right: 'R' },
  arrows: { w: 'up', up: 'up', a: 'left', left: 'left', s: 'down', down: 'down', d: 'right', right: 'right' },
  targets: Object.fromEntries([...'qweasdzxc'].map((k, i) => [k, 'c' + i])),
};
const KEY_HOW = {
  bench: 'Space 연타! 바를 끝까지 밀어 올리면 1회', squat: '바늘이 초록(깊이)에 왔을 때 Space · 금색이면 완벽', sprint: 'F·J(또는 A·D)를 번갈아 연타 (같은 발 두 번은 손해)',
  cone: '화살표가 가리키는 쪽 키(W·A·S·D)를 빨리', box: 'Space를 꾹 눌러 힘을 모았다가 초록에서 떼기 · 넘치면 실패', drill: '불이 들어온 칸의 키(Q·W·E / A·S·D / Z·X·C)를 사라지기 전에',
};
const howOf = ex => (isKeyMode() && KEY_HOW[ex.id]) || ex.how;
const PAD_LABEL = { push: 'Space', tap: 'Space', hold: 'Space', L: 'F', R: 'J', up: 'W', left: 'A', down: 'S', right: 'D', ...Object.fromEntries([...'QWEASDZXC'].map((k, i) => ['c' + i, k])) };

export function openGym(root, s, hooks) { return new Promise(res => new Gym(root, s, hooks, res)); }

class Gym {
  constructor(root, s, hooks, done) {
    this.root = root; this.s = s; this.hooks = hooks; this.done = done;
    const [c1, c2] = hooks.colors.map(vivid);
    this.kit = { jersey: c1, num: lum(c1) > .6 ? shade(c1, -.6) : '#FFFFFF', helmet: c1, stripe: c2, pants: '#2B3038', socks: c1 };
    this.c1 = c1; this.c2 = c2; this.game = null; this.result = null;
    root.innerHTML = `<div class="clutch gym" role="dialog" aria-modal="true" aria-label="헬스장">
      <div class="gym-top"><div><b id="gy-title"></b><small id="gy-day"></small></div><button class="gym-x" data-gy="close" aria-label="나가기">나가기</button></div>
      <div class="gym-energy"><i id="gy-en"></i><span id="gy-ent"></span></div>
      <canvas class="gym-scene" id="gy-cv" width="${W * 2}" height="${H * 2}" aria-label="체육관"></canvas>
      <div class="gym-body" id="gy-body"></div></div>`;
    this.cv = root.querySelector('#gy-cv'); this.ctx = this.cv.getContext('2d'); this.ctx.imageSmoothingEnabled = false;
    root.querySelector('[data-gy="close"]').onclick = () => this.close();
    this.onKey = e => this.key(e); window.addEventListener('keydown', this.onKey); window.addEventListener('keyup', this.onKey);
    this.offMode = onInputMode(() => this.decorate());
    this.last = performance.now(); this.loopFn = this.loop.bind(this); this.raf = requestAnimationFrame(this.loopFn);
    this.list();
  }
  $(id) { return this.root.querySelector('#' + id); }
  head() {
    const s = this.s, g = gymState(s), tier = GYM_TIERS[gymTier(s)];
    this.$('gy-title').textContent = `헬스장 · ${tier.name}`;
    this.$('gy-day').textContent = `${gymDayLabel(s)} · 오늘 +${(g.today || 0).toFixed(2)}`;
    this.$('gy-en').style.width = `${Math.round(g.energy / tier.energy * 100)}%`;
    this.$('gy-ent').textContent = `오늘 체력 ${g.energy}/${tier.energy}`;
  }
  // ───────── 운동 목록 ─────────
  list() {
    this.game = null; this.result = null; this.head();
    const s = this.s, g = gymState(s), p = s.player;
    const rows = EXERCISES.map(ex => {
      const k = exerciseAttr(s, ex), can = canExercise(s, ex), sets = g.sets[ex.id] || 0, prog = k ? g.prog[k] || 0 : 0;
      return `<button class="gym-ex" data-ex="${ex.id}" ${can.ok ? '' : 'disabled'}>
        <div class="row between"><strong>${esc(exerciseName(s, ex))}</strong><span class="pill ${can.ok ? 'green' : ''}">${can.ok ? `체력 ${ex.cost} · ${sets}/${MAX_SETS}세트` : esc(can.why)}</span></div>
        ${k ? `<div class="gym-prog"><span>${esc(ATTR[k][0])} <b>${p.attrs[k]}</b></span><i><b style="width:${Math.round(prog * 100)}%"></b></i><small>${prog.toFixed(2)}</small></div>` : ''}
        <small class="gym-how" data-how="${ex.id}" data-pre="${KIND_KO[ex.kind]} · ">${KIND_KO[ex.kind]} · ${esc(howOf(ex))}</small></button>`;
    }).join('');
    this.$('gy-body').innerHTML = `<p class="gym-note">운동 결과만큼 능력치 진행도가 차고, 1이 되면 능력치가 1 올라요. 게임 속 하루(시즌 진행 한 단계)마다 체력이 다시 차고, 운동 하나는 하루 ${MAX_SETS}세트까지예요. 무리하면 누적 피로가 조금씩 쌓여요.</p><div class="gym-list">${rows}</div>`;
    this.root.querySelectorAll('[data-ex]').forEach(b => b.onclick = () => this.start(b.dataset.ex));
    this.decorate();
  }
  // 키보드면 버튼마다 누를 키를 붙입니다
  decorate() {
    const kbd = isKeyMode();
    this.root.querySelectorAll('kbd.gk').forEach(x => x.remove());
    this.root.querySelectorAll('[data-how]').forEach(el => { el.textContent = el.dataset.pre + howOf(EXERCISES.find(e => e.id === el.dataset.how)); });
    this.root.querySelector('.clutch')?.classList.toggle('kbd', kbd);
    if (!kbd) return;
    const add = (el, t, where = 'beforeend') => el?.insertAdjacentHTML(where, `<kbd class="kc gk">${t}</kbd>`);
    add(this.root.querySelector('[data-gy="close"]'), 'Esc');
    this.root.querySelectorAll('.gym-ex').forEach((b, i) => add(b.querySelector('strong'), i + 1, 'afterbegin'));
    this.root.querySelectorAll('[data-pad]').forEach(b => add(b, PAD_LABEL[b.dataset.pad]));
    add(this.root.querySelector('[data-gy="back"]'), 'Enter');
  }
  // ───────── 미니게임 ─────────
  start(id) {
    const ex = EXERCISES.find(e => e.id === id), s = this.s, k = exerciseAttr(s, ex), a = s.player.attrs[k] ?? 60;
    if (!canExercise(s, ex).ok) return;
    const boost = 1 + (a - 60) * .004; // 능력치가 높을수록 조금 쉬워짐
    const dw = diffOf(s).gymWin; // 난이도: 판정 구간·제한 시간 배율 (쉬움 1.2 · 노말 1 · 하드 0.85)
    const g = this.game = { ex, kind: ex.kind, t: 0, phase: 'ready', ready: 1.2, boost, dw, score: 0, n: 0, dir: null };
    if (g.kind === 'mash') Object.assign(g, { dur: 5, meter: 0, reps: 0 });
    if (g.kind === 'timing') Object.assign(g, { total: 5, rep: 0, needle: 0, nt: 0, pause: 0, scores: [] });
    if (g.kind === 'alt') Object.assign(g, { dist: 0, lastFoot: null, cap: 9 });
    if (g.kind === 'arrows') Object.assign(g, { total: 10, i: -1, win: 0, left: 0, gap: .25, hits: 0 });
    if (g.kind === 'charge') Object.assign(g, { total: 3, jump: 0, charge: 0, holding: false, scores: [], hop: 0 });
    if (g.kind === 'targets') Object.assign(g, { total: 12, i: -1, cell: -1, left: 0, gap: .2, hits: 0 });
    const pads = {
      mash: `<button class="gym-pad big" data-pad="push">밀어!</button>`,
      timing: `<div class="gym-gauge"><div class="z green" style="bottom:${(76 - 10 * dw).toFixed(1)}%;height:${(20 * dw).toFixed(1)}%"></div><div class="z gold" style="bottom:${(77 - 3 * dw).toFixed(1)}%;height:${(6 * dw).toFixed(1)}%"></div><i id="gy-needle"></i></div><button class="gym-pad big" data-pad="tap">앉았다 일어나기!</button>`,
      alt: `<div class="row"><button class="gym-pad" data-pad="L">왼발</button><button class="gym-pad" data-pad="R">오른발</button></div>`,
      arrows: `<p class="gym-prompt" id="gy-prompt">…</p><div class="gym-cross"><span></span><button class="gym-pad" data-pad="up">↑</button><span></span><button class="gym-pad" data-pad="left">←</button><span></span><button class="gym-pad" data-pad="right">→</button><span></span><button class="gym-pad" data-pad="down">↓</button><span></span></div>`,
      charge: `<div class="gym-bar"><div class="z green" style="left:${((.85 - .1 * dw) / 1.2 * 100).toFixed(1)}%;width:${((.1 * dw + .1 + (dw - 1) * .1) / 1.2 * 100).toFixed(1)}%"></div><div class="z gold" style="left:${((.85 - .03 * dw) / 1.2 * 100).toFixed(1)}%;width:${(.06 * dw / 1.2 * 100).toFixed(1)}%"></div><i id="gy-charge"></i></div><button class="gym-pad big" data-pad="hold">꾹 눌렀다 떼기</button>`,
      targets: `<div class="gym-grid">${Array.from({ length: 9 }, (_, i) => `<button class="gym-cell" data-pad="c${i}"></button>`).join('')}</div>`,
    }[g.kind];
    this.$('gy-body').innerHTML = `<div class="gym-game"><div class="row between"><strong>${esc(exerciseName(s, ex))}</strong><span class="pill">${esc(ATTR[k][0])}</span></div><p class="gym-how" data-how="${ex.id}" data-pre="">${esc(howOf(ex))}</p><p class="gym-stat" id="gy-stat">준비…</p>${pads}</div>`;
    this.root.querySelectorAll('[data-pad]').forEach(b => {
      b.addEventListener('pointerdown', e => { e.preventDefault(); b.classList.add('press'); this.press(b.dataset.pad, true); });
      const up = e => { b.classList.remove('press'); this.press(b.dataset.pad, false); };
      b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', e => { if (e.buttons) up(e); });
    });
    this.decorate();
  }
  key(e) {
    if (this.closed || typing(e) || e.ctrlKey || e.metaKey || e.altKey) return;
    const g = this.game, k = keyName(e), down = e.type === 'keydown';
    if (down && e.repeat) { if (k === 'space') e.preventDefault(); return; }
    // 목록·결과 화면: 숫자 키로 운동, Enter·Space 다른 운동, Esc 나가기
    if (!g || g.phase === 'end') {
      if (!down) return;
      if (k === 'esc') { e.preventDefault(); return this.close(); }
      if (this.result && (k === 'enter' || k === 'space')) { e.preventDefault(); return this.list(); }
      if (!g && /^[1-9]$/.test(k)) { const b = this.root.querySelectorAll('.gym-ex')[+k - 1]; if (b && !b.disabled) { e.preventDefault(); this.start(b.dataset.ex); } }
      return;
    }
    if (k === 'esc' && down) { e.preventDefault(); return this.list(); }
    const pad = PAD_KEYS[g.kind]?.[k]; if (!pad) return;
    e.preventDefault();
    const el = this.root.querySelector(`[data-pad="${pad}"]`); el?.classList.toggle('press', down);
    this.press(pad, down);
  }
  press(pad, down) {
    const g = this.game; if (!g || g.phase !== 'play') return;
    if (g.kind === 'charge' && pad === 'hold') { if (g.scores.length >= g.total) return; if (down && !g.holding && g.hop <= 0) { g.holding = true; g.charge = 0; } else if (!down && g.holding) this.releaseJump(); return; }
    if (!down) return;
    if (g.kind === 'mash' && pad === 'push') g.meter += .18 * g.boost * g.dw;
    if (g.kind === 'timing' && pad === 'tap' && g.pause <= 0) {
      const v = g.needle, off = Math.abs(v - .77) / g.dw, sc = off <= .03 ? 1.25 : Math.abs(v - .76) / g.dw <= .1 ? .95 : Math.abs(v - .75) / g.dw <= .17 ? .5 : .15;
      g.scores.push(sc); g.pause = .5; g.flash = sc >= 1.2 ? 'PERFECT' : sc >= .9 ? 'GOOD' : sc >= .5 ? 'OK' : 'MISS';
      if (g.scores.length >= g.total) this.end(g.scores.reduce((a, b) => a + b, 0) / g.total, `${g.scores.filter(x => x >= 1.2).length}회 완벽`);
    }
    if (g.kind === 'alt' && (pad === 'L' || pad === 'R')) { g.dist += (pad !== g.lastFoot ? 1.05 : .25) * g.boost * g.dw; g.lastFoot = pad; g.step = .12; }
    if (g.kind === 'arrows' && DIRS[pad] && g.dir) { if (pad === g.dir) { g.hits++; g.score += 1 + .3 * (g.left / g.win); g.flash = 'GOOD'; } else g.flash = 'MISS'; g.dir = null; g.left = g.gap; }
    if (g.kind === 'targets' && pad.startsWith('c') && g.cell >= 0) { if (+pad.slice(1) === g.cell) { g.hits++; g.flash = 'HIT'; } else g.flash = 'MISS'; this.setCell(-1); g.left = g.gap; }
  }
  releaseJump() {
    const g = this.game, v = g.charge; g.holding = false;
    const over = .95 + (g.dw - 1) * .1, sc = v > over ? .2 : Math.abs(v - .85) <= .03 * g.dw ? 1.25 : v >= .85 - .1 * g.dw ? 1 - Math.abs(v - .85) * 2 : v * .8;
    g.scores.push(sc); g.hop = .7; g.hopH = clamp(v, 0, over); g.flash = sc >= 1.2 ? 'PERFECT' : sc >= .85 ? 'GOOD' : v > over ? 'OVER!' : 'LOW';
    if (g.scores.length >= g.total) setTimeout(() => this.end(g.scores.reduce((a, b) => a + b, 0) / g.total, `${g.scores.filter(x => x >= 1.2).length}번 완벽`), 650);
  }
  setCell(i) { const g = this.game; g.cell = i; this.root.querySelectorAll('.gym-cell').forEach((b, j) => b.classList.toggle('on', j === i)); }
  update(dt) {
    const g = this.game; if (!g) return;
    if (g.flashT > 0) g.flashT -= dt;
    if (g.phase === 'ready') { g.ready -= dt; this.$('gy-stat').textContent = g.ready > .6 ? '준비…' : '시작!'; if (g.ready <= 0) g.phase = 'play'; return; }
    if (g.phase !== 'play') return;
    g.t += dt;
    const stat = this.$('gy-stat');
    if (g.kind === 'mash') {
      g.meter = Math.max(0, g.meter - dt * .4);
      if (g.meter >= 1) { g.reps++; g.meter = 0; g.flash = 'REP!'; }
      stat.textContent = `${g.reps}회 · 남은 시간 ${Math.max(0, g.dur - g.t).toFixed(1)}초`;
      if (g.t >= g.dur) this.end(g.reps / 4, `5초에 ${g.reps}회`);
    }
    if (g.kind === 'timing') {
      if (g.pause > 0) { g.pause -= dt; if (g.pause <= 0) g.nt = 0; }
      else { g.nt += dt; const period = 1.3 - g.scores.length * .08, ph = (g.nt % period) / period; g.needle = ph < .5 ? ph * 2 : 2 - ph * 2; }
      const nd = this.$('gy-needle'); if (nd) nd.style.bottom = `${Math.round(g.needle * 100)}%`;
      stat.textContent = `${g.scores.length}/${g.total}회`;
    }
    if (g.kind === 'alt') {
      if (g.step > 0) g.step -= dt;
      stat.textContent = `${Math.min(40, g.dist).toFixed(1)}야드 · ${g.t.toFixed(2)}초`;
      if (g.dist >= 40 || g.t >= g.cap) { const time = g.dist >= 40 ? g.t : g.cap + (40 - g.dist) * .2; this.end(clamp((8.2 - time) / 3, .05, 1.25), `40야드 ${time.toFixed(2)}초`); }
    }
    if (g.kind === 'arrows') {
      g.left -= dt;
      if (g.left <= 0) {
        if (g.dir) { g.dir = null; g.flash = 'SLOW'; g.left = g.gap; }
        else if (g.i + 1 >= g.total) return this.end(g.score / g.total, `${g.hits}/${g.total} 성공`);
        else { g.i++; g.dir = ['up', 'left', 'right', 'down'][Math.floor(R() * 4)]; g.win = g.left = (1.15 - g.i * .05) * (g.boost > 1 ? 1.05 : 1) * g.dw; }
      }
      stat.textContent = `${Math.max(0, g.i + 1)}/${g.total} · 성공 ${g.hits}`;
      const pr = this.$('gy-prompt'); if (pr) { const v = g.dir ? DIRS[g.dir] : '·'; if (pr.textContent !== v) { pr.textContent = v; pr.dataset.dir = g.dir || ''; } }
    }
    if (g.kind === 'charge') {
      if (g.holding) { g.charge += dt / 1.1; if (g.charge >= 1.2) this.releaseJump(); }
      if (g.hop > 0) g.hop -= dt;
      const ch = this.$('gy-charge'); if (ch) ch.style.width = `${Math.round(clamp(g.charge, 0, 1.2) / 1.2 * 100)}%`;
      stat.textContent = `점프 ${g.scores.length}/${g.total}`;
    }
    if (g.kind === 'targets') {
      g.left -= dt;
      if (g.left <= 0) {
        if (g.cell >= 0) { this.setCell(-1); g.flash = 'SLOW'; g.left = g.gap; }
        else if (g.i + 1 >= g.total) return this.end(g.hits / g.total * 1.15, `${g.hits}/${g.total} 명중`);
        else { g.i++; let c; do c = Math.floor(R() * 9); while (c === g.prev); g.prev = c; this.setCell(c); g.left = (1 - g.i * .04) * (g.boost > 1 ? 1.05 : 1) * g.dw; }
      }
      stat.textContent = `${Math.max(0, g.i + 1)}/${g.total} · 명중 ${g.hits}`;
    }
    if (g.flash && !g.flashT) g.flashT = .55;
    if (g.flashT <= 0) { g.flash = null; g.flashT = 0; }
  }
  end(perf, detail) {
    const g = this.game; if (!g || g.phase === 'end') return;
    g.phase = 'end';
    let res;
    try { res = finishExercise(this.s, g.ex.id, perf, detail); } catch (err) { this.hooks.toast?.(err.message); return this.list(); }
    this.hooks.persist?.();
    this.result = { ...res, grade: gradeOf(perf), perf, detail, t: 0 };
    this.head();
    const p = this.s.player;
    this.$('gy-body').innerHTML = `<div class="gym-result"><b class="gym-grade g-${this.result.grade.toLowerCase()}">${this.result.grade}</b><p>${esc(detail)}</p>
      <p class="gym-gain">${esc(res.attrName)} <b>+${res.gain.toFixed(2)}</b></p>
      <div class="gym-prog big"><span>${esc(res.attrName)} <b>${res.value}</b></span><i><b style="width:${Math.round(res.prog * 100)}%"></b></i><small>${res.prog.toFixed(2)}</small></div>
      ${res.ups ? `<p class="gym-up">${esc(res.attrName)} ${res.value - res.ups} → ${res.value}!${res.ovrUp ? ` 종합 ${p.ovr - res.ovrUp} → ${p.ovr}` : ''}</p>` : ''}
      ${res.tired ? '<p class="tiny" style="opacity:.75">땀을 많이 흘렸어요. 누적 피로 +1</p>' : ''}
      <button class="primary" data-gy="back">다른 운동</button></div>`;
    this.root.querySelector('[data-gy="back"]').onclick = () => this.list();
    this.decorate();
    if (res.ups) this.burst();
  }
  close() {
    this.closed = true; cancelAnimationFrame(this.raf); this.offMode?.();
    window.removeEventListener('keydown', this.onKey); window.removeEventListener('keyup', this.onKey);
    this.root.innerHTML = ''; this.done();
  }
  burst() { this.fx = Array.from({ length: 60 }, (_, i) => { const a = R() * Math.PI * 2, v = .6 + R() * 2; return { x: W / 2, y: H * .45, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1, life: 50 + R() * 30, c: ['#F2C230', '#FFFFFF', this.c1, '#6BD88A'][i % 4] }; }); }
  loop(now) {
    if (this.closed) return;
    const dt = clamp((now - this.last) / 1000, 0, .05); this.last = now;
    this.update(dt); this.draw(now);
    this.raf = requestAnimationFrame(this.loopFn);
  }
  // ───────── 장면 (논리 240×124, 2배 해상도) ─────────
  sprite(frame, view = 'front', flip = false) { const s = this.s; return playerSprite({ ...this.kit, skin: SKINS[(s.player.avatar?.skin ?? 1) % SKINS.length], number: s.player.number, view, frame, big: ['OL', 'DT'].includes(s.player.pos), flip }); }
  put(spr, x, yFeet, k = 2) { const ctx = this.ctx, w = spr.width * k / 2, h = spr.height * k / 2; ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(x - w * .35, yFeet - 1, w * .7, 2); ctx.drawImage(spr, Math.round((x - w / 2) * 2) / 2, Math.round((yFeet - h + 1) * 2) / 2, w, h); }
  draw(now) {
    const ctx = this.ctx, g = this.game, t = now / 1000;
    ctx.setTransform(2, 0, 0, 2, 0, 0); ctx.imageSmoothingEnabled = false;
    // 벽·거울·바닥
    ctx.fillStyle = '#222A33'; ctx.fillRect(0, 0, W, 70);
    ctx.fillStyle = this.c1; ctx.fillRect(0, 10, W, 4); ctx.fillStyle = this.c2; ctx.fillRect(0, 14, W, 1);
    ctx.fillStyle = '#8FB8CC'; ctx.fillRect(70, 20, 100, 46); ctx.fillStyle = '#A9D0E0'; for (let i = 0; i < 4; i++) ctx.fillRect(78 + i * 24, 22 + i * 3, 3, 40 - i * 6); ctx.fillStyle = '#3A4654'; ctx.fillRect(68, 18, 104, 2); ctx.fillRect(68, 66, 104, 2);
    bigText(ctx, TIER_SIGN[gymTier(this.s)] || 'GYM', W / 2, 5, '#F2C230', 1);
    // 덤벨 랙
    ctx.fillStyle = '#4A525E'; ctx.fillRect(8, 48, 52, 3); ctx.fillRect(180, 48, 52, 3);
    for (let i = 0; i < 6; i++) { ctx.fillStyle = '#9AA4B0'; ctx.fillRect(10 + i * 8, 44, 6, 4); ctx.fillRect(182 + i * 8, 44, 6, 4); ctx.fillStyle = '#2B3038'; ctx.fillRect(11 + i * 8, 45, 1, 2); ctx.fillRect(183 + i * 8, 45, 1, 2); }
    for (let y = 70; y < H; y++) { ctx.fillStyle = Math.floor((y - 70) / 6) % 2 ? '#6E4C30' : '#7A5536'; ctx.fillRect(0, y, W, 1); }
    ctx.fillStyle = '#5E3F27'; for (let x = 0; x < W; x += 30) ctx.fillRect(x + ((Math.floor(x / 30) % 2) * 12), 70, 1, H - 70);
    ctx.fillStyle = '#2A2F35'; ctx.fillRect(50, 82, 140, 34);
    const kind = g?.kind || 'idle', cx = W / 2, floor = 106;
    if (kind === 'idle') { // 대기: 가볍게 몸 풀기
      ctx.fillStyle = '#5A6270'; ctx.fillRect(cx + 34, 64, 3, 42); ctx.fillRect(cx + 58, 64, 3, 42); ctx.fillStyle = '#9AA4B0'; ctx.fillRect(cx + 30, 72, 36, 2); ctx.fillStyle = '#20242A'; ctx.fillRect(cx + 28, 68, 4, 10); ctx.fillRect(cx + 64, 68, 4, 10);
      this.put(this.sprite(Math.floor(t * 2) % 2 ? 'stand' : 'catch'), cx - 14, floor);
    } else if (kind === 'mash') { // 벤치프레스: 누워서 바벨을 밀어 올림
      ctx.fillStyle = '#20242A'; ctx.fillRect(cx - 30, 92, 60, 6); ctx.fillStyle = '#3A3F46'; ctx.fillRect(cx - 26, 98, 4, 8); ctx.fillRect(cx + 22, 98, 4, 8);
      ctx.fillStyle = '#5A6270'; ctx.fillRect(cx - 40, 66, 3, 40); ctx.fillRect(cx + 37, 66, 3, 40);
      this.put(this.sprite('dive', 'front'), cx, 96, 2);
      const up = clamp(g.meter, 0, 1), by = 88 - up * 16 - (g.flash === 'REP!' ? 2 : 0);
      ctx.fillStyle = '#B9C2CC'; ctx.fillRect(cx - 44, by, 88, 2); ctx.fillStyle = '#20242A'; ctx.fillRect(cx - 44, by - 6, 6, 14); ctx.fillRect(cx + 38, by - 6, 6, 14); ctx.fillStyle = '#C8323A'; ctx.fillRect(cx - 38, by - 4, 3, 10); ctx.fillRect(cx + 35, by - 4, 3, 10);
    } else if (kind === 'timing') { // 스쿼트
      ctx.fillStyle = '#5A6270'; ctx.fillRect(cx - 34, 50, 3, 56); ctx.fillRect(cx + 31, 50, 3, 56);
      const down = g.pause > 0 ? g.pause > .25 : g.needle > .5, spr = this.sprite(down ? 'stance' : 'stand');
      this.put(spr, cx, floor);
      const by = floor - spr.height + 8 + (down ? 4 : 0);
      ctx.fillStyle = '#B9C2CC'; ctx.fillRect(cx - 40, by, 80, 2); ctx.fillStyle = '#20242A'; ctx.fillRect(cx - 40, by - 5, 6, 12); ctx.fillRect(cx + 34, by - 5, 6, 12);
    } else if (kind === 'alt') { // 스프린트 트랙 (앞으로 달려 나감)
      ctx.fillStyle = '#B5553A'; ctx.beginPath(); ctx.moveTo(cx - 70, H); ctx.lineTo(cx - 14, 70); ctx.lineTo(cx + 14, 70); ctx.lineTo(cx + 70, H); ctx.fill();
      ctx.fillStyle = '#F1E7DA'; for (let i = 0; i < 6; i++) { const k = ((i * 8 + g.dist * 2) % 48) / 48, y = 70 + k * k * (H - 70), w = 28 + k * 112; ctx.fillRect(cx - w / 2, Math.round(y), w, 1); }
      this.put(this.sprite(g.step > 0 ? (g.lastFoot === 'L' ? 'run0' : 'run1') : 'stand', 'back'), cx, floor + 6, 3);
      bigText(ctx, `${Math.min(40, Math.floor(g.dist))} YD`, cx, 30, '#FFFFFF', 2);
    } else if (kind === 'arrows') { // 콘 드릴
      const spots = { up: [cx, 80], left: [cx - 46, 96], right: [cx + 46, 96], down: [cx, 114] };
      for (const [d, [x, y]] of Object.entries(spots)) { ctx.fillStyle = d === g.dir ? '#FFD84A' : '#FF7A1A'; ctx.beginPath(); ctx.moveTo(x - 5, y); ctx.lineTo(x, y - 9); ctx.lineTo(x + 5, y); ctx.fill(); }
      const tgt = g.dir ? spots[g.dir] : [cx, 98]; g.px = (g.px ?? cx) + (tgt[0] - (g.px ?? cx)) * .18; g.py = (g.py ?? 98) + (tgt[1] - (g.py ?? 98)) * .18;
      this.put(this.sprite(g.dir ? (Math.floor(t * 9) % 2 ? 'run0' : 'run1') : 'stand'), g.px, g.py);
      if (g.dir) bigText(ctx, DIRS[g.dir] === '↑' ? 'UP' : DIRS[g.dir] === '↓' ? 'DOWN' : DIRS[g.dir] === '←' ? 'LEFT' : 'RIGHT', cx, 36, '#FFD84A', 3);
    } else if (kind === 'charge') { // 박스 점프
      ctx.fillStyle = '#8A5A33'; ctx.fillRect(cx + 10, 84, 34, 22); ctx.fillStyle = '#6E4526'; ctx.fillRect(cx + 10, 84, 34, 3); ctx.fillStyle = '#A06A3E'; ctx.fillRect(cx + 14, 90, 26, 1);
      const k = g.hop > 0 ? 1 - g.hop / .7 : 0, lift = g.hop > 0 ? Math.sin(k * Math.PI) * (12 + g.hopH * 34) : 0, onBox = g.hop > 0 && k > .5 && g.hopH >= .75;
      this.put(this.sprite(g.holding ? 'stance' : g.hop > 0 ? 'catch' : 'stand'), cx - 14 + (onBox ? 40 * (k - .5) * 2 : 0), floor - lift - (onBox ? 22 * Math.min(1, (k - .5) * 4) : 0));
    } else if (kind === 'targets') { // 포지션 드릴: 표적 판
      ctx.fillStyle = '#1C232B'; ctx.fillRect(cx - 4, 26, 56, 56);
      for (let i = 0; i < 9; i++) { const x = cx + 2 + (i % 3) * 18, y = 32 + Math.floor(i / 3) * 18; ctx.fillStyle = i === g.cell ? '#FFD84A' : '#3A4654'; ctx.fillRect(x, y, 12, 12); if (i === g.cell) { ctx.fillStyle = '#E85A5A'; ctx.fillRect(x + 4, y + 4, 4, 4); } }
      const pos = this.s.player.pos;
      this.put(this.sprite(g.cell >= 0 ? (pos === 'QB' ? 'throw' : ['K', 'P'].includes(pos) ? 'run0' : 'catch') : 'stand'), cx - 40, floor);
    }
    if (g?.phase === 'ready') bigText(ctx, g.ready > .6 ? 'READY' : 'GO!', W / 2, 40, '#FFFFFF', 4);
    if (g?.flash && g.phase === 'play') bigText(ctx, g.flash, W / 2, 52, g.flash === 'MISS' || g.flash === 'SLOW' || g.flash === 'OVER!' ? '#E85A5A' : '#F2C230', 2);
    if (this.result) bigText(ctx, this.result.grade, W / 2, 56, this.result.grade === 'MISS' ? '#E85A5A' : '#F2C230', 3);
    if (this.fx) { this.fx = this.fx.filter(p => p.life-- > 0); for (const p of this.fx) { p.x += p.vx; p.y += p.vy; p.vy += .05; ctx.fillStyle = p.c; ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 2); } }
    void pixelText; void OUT;
  }
}
