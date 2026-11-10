// 실시간 플레이 (위에서 내려다본 필드, 공격은 위쪽으로 전진). 고해상도 도트: 1야드 = 6픽셀, 선수 15×19.
// new LivePlay(host, cfg)로 스냅 전 양 팀 포메이션을 먼저 보여 주고, snap({ play, defPlay })로 한 플레이를 진행합니다.
// 작전은 playbook.js(포메이션·루트·커버리지)를 따릅니다: 공격 리시버는 루트를, 쿼터백 AI는 읽는 순서를,
// 수비는 맨·존(딥/훅/컬/플랫)·블리츠·스파이 배정을 그대로 수행합니다.
// cfg: ball, toGo, control(QB|RB|WR|TE|OL|DL|LB|CB|S), edge, side('O'|'D'), me{attrs, ovr, number}, teamRating, oppRating,
//      offColors, defColors, endzone[2], away('O'|'D'), banner, offForm·offPlay(공격), defForm·defPlay(수비), speedup·assist·zoom(개발용),
//      diff(난이도의 live 값: 캐치 범위·확률, 패스 오차, 포켓 시간, 기술 성공률·대기, 태클·인터셉트, AI 도움·힌트. 없으면 노말)
// 조작은 입력 방식(input.js)에 따라 바뀌고 화면 요소는 같습니다.
//  · 모바일(터치): 왼쪽 아래 아날로그 스틱, 오른쪽 아래 상황별 스킬 버튼(최대 4개), 쿼터백은 리시버나 위쪽 리시버 칩을 탭하면 패스.
//  · 컴퓨터(키보드): WASD·방향키 이동(왼쪽 아래 키 표시), 버튼 1~4 = Space·J·K·L(버튼에 키 표시), Shift 터보,
//    쿼터백은 숫자 키 1~5로 그 번호의 리시버에게 패스(리시버 머리 위 번호·위쪽 칩). 마우스로 버튼·칩·리시버를 눌러도 됩니다.
// 패스 종류(터치·불릿·로브)와 캐치 종류(하이포인트·안전·RAC)를 고르고, 캐치는 공이 날아간 거리로 숏·미디엄·롱으로 나눕니다.
import { bigText, vivid, shade, lum, OUT } from './pixel.js';
import { isKeyMode, onInputMode, keyName, keyLabel, MOVE_KEYS, typing } from './input.js';
import { DIFFICULTY } from '../engine/difficulty.js';
import { playerSprite, ballSprite, fieldCanvas, SKINS, PPY, SIDE, Y_TOP, FIELD_W, FIELD_H } from './sprites.js';
import { FW, CX, FORMATIONS, DEF_FORMS, OFF_PLAYS, DEF_PLAYS, isDeepZone, ZONES, offenseSpots, defenseSpots, assignCoverage, routePath, routeInfo, playById, defById, catchKind, COV_NAME } from './playbook.js';

const WW = FIELD_W, VW_NEAR = 192, VW_QB = 344;
const R = Math.random;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const speedOf = rating => 4.7 + clamp(rating, 30, 99) * .052;
const ROLE_SPD = { OL: .74, DL: .8, QB: .9, LB: .92, TE: .93, FB: .88, RB: 1, WR: 1, CB: 1, S: .98 };
const NUMS = { QB: [[1, 19]], RB: [[20, 39]], FB: [[40, 49]], WR: [[10, 19], [80, 89]], TE: [[80, 89]], OL: [[60, 79]], DL: [[90, 99], [50, 59]], LB: [[40, 59]], CB: [[20, 39]], S: [[20, 49]] };
const PASS_TYPES = ['touch', 'bullet', 'lob'];
const PASS_BTN = { touch: '터치 패스', bullet: '불릿 패스', lob: '로브 패스' };
const SLOT_KEYS = ['space', 'j', 'k', 'l'], LEGACY_KEYS = { z: 0, x: 1, c: 2, v: 3 }; // 버튼 1~4 키 (Z·X·C·V는 예전 키)
const OPEN_COLOR = { open: '#3BB273', mid: '#F2C230', tight: '#E85A5A', pre: '#E9EEF3' };

// 한 플레이만 돌리고 정리합니다 (개발 도구·밸런스 테스트용). cfg.play·cfg.defPlay는 id(없으면 무작위).
export function runLivePlay(host, cfg) {
  const lp = new LivePlay(host, cfg);
  return lp.snap({ play: cfg.play, defPlay: cfg.defPlay }).then(r => { lp.destroy(); return r; });
}

export class LivePlay {
  constructor(host, cfg) {
    this.host = host; this.cfg = { ...cfg };
    this.dif = { ...DIFFICULTY.normal.live, ...(cfg.diff || {}) }; // 난이도 (engine/difficulty.js)
    host.innerHTML = `<canvas class="lp-canvas" width="${VW_NEAR}" height="360" aria-label="실시간 플레이 필드"></canvas><div class="lp-tip" hidden></div>
      <div class="lp-ctrl" hidden><div class="lp-zone" aria-label="이동 스틱"><div class="lp-stick"><i></i></div></div>
      <div class="lp-keys" aria-hidden="true"><kbd data-k="U">W</kbd><kbd data-k="L">A</kbd><kbd data-k="D">S</kbd><kbd data-k="R">D</kbd></div>
      <div class="lp-targets" hidden aria-label="패스할 리시버"></div><div class="lp-btns"></div></div>`;
    this.canvas = host.querySelector('canvas'); this.ctx = this.canvas.getContext('2d'); this.ctx.imageSmoothingEnabled = false;
    this.ctrl = host.querySelector('.lp-ctrl'); this.btns = host.querySelector('.lp-btns'); this.tipEl = host.querySelector('.lp-tip'); this.tgEl = host.querySelector('.lp-targets');
    this.kbd = isKeyMode(); this.offMode = onInputMode(m => { this.kbd = m === 'key'; this.applyMode(); });
    this.H = 360; this.VW = VW_NEAR; this.scale = 2; this.inset = 0; this.camX = 0; this.oy = 0;
    this.stick = { x: 0, y: 0 }; this.sk = { cd: {}, pumps: 0 }; this.floats = []; this.ghosts = [];
    this.los = cfg.ball; this.first = Math.min(100, cfg.ball + cfg.toGo);
    this.t = 0; this.phase = 'idle'; this.ball = null; this.carrier = null; this.result = null; this.fx = []; this.msg = '';
    this.touch = null; this.keys = new Set(); this.juke = 0; this.stats = {}; this.passType = 'touch';
    this.play = cfg.offPlay ? playById(cfg.offPlay) : null;
    this.defPlay = cfg.defPlay ? defById(cfg.defPlay) : null;
    this.kits = { O: this.kitFor('O'), D: this.kitFor('D') };
    const homeColors = cfg.away === 'O' ? cfg.defColors : cfg.offColors;
    this.field = fieldCanvas({ endzone: cfg.endzone, home: homeColors, benchL: cfg.offColors, benchR: cfg.defColors });
    this.setupTeams();
    this.formOffense(this.play?.form || cfg.offForm || 'gun_dbl', true);
    this.shellShown = this.defPlay ? this.shownShell(this.defPlay) : 2; // 스냅 전에 보이는 딥 세이프티 수
    this.formDefense(this.defPlay?.form || cfg.defForm || 'd43', this.shellShown, true);
    this.pickMine();
    this.vwF = this.VW = this.vwTarget(); this.fit();
    this.camX = this.camXTarget(); this.eye = this.eyeTarget(); this.camY = this.camYTarget(); this.oy = Math.round((Y_TOP - this.camY) * PPY - this.eye);
    if (typeof ResizeObserver !== 'undefined') { this.ro = new ResizeObserver(() => this.fit()); this.ro.observe(host); }
    this.bindInput(); this.applyMode();
    if (cfg.banner) { this.pop(cfg.banner, '#FFFFFF'); this.msgT = 1.4; }
    this.last = performance.now();
    this.loopFn = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loopFn);
  }
  // ───────── 화면 크기·카메라 ─────────
  fit() {
    const w = this.host.clientWidth, h = this.host.clientHeight, VW = this.VW;
    if (!w || !h) { if (this.canvas.width !== VW) { this.canvas.width = VW; this.ctx.imageSmoothingEnabled = false; } return; }
    let H = Math.round(VW * h / w), cw = w, ch = h;
    if (H < VW * .9) { H = Math.round(VW * .9); cw = Math.round(h * VW / H); }
    else if (H > VW * 2.6) { H = Math.round(VW * 2.6); ch = Math.round(w * H / VW); }
    if (H !== this.H || this.canvas.width !== VW) { this.H = H; this.canvas.width = VW; this.canvas.height = H; this.ctx.imageSmoothingEnabled = false; }
    this.canvas.style.width = cw + 'px'; this.canvas.style.height = ch + 'px';
    this.scale = ch / H;
  }
  // 줌: 패스 전 쿼터백은 필드 전체를, 나머지는 내 선수를 크게
  vwTarget() {
    if (this.cfg.zoom === false) return VW_QB;
    const m = this.mine;
    if (m && m === this.qb && (this.phase === 'idle' || this.phase === 'pre' || this.inPocket())) return VW_QB;
    return VW_NEAR;
  }
  inPocket() { const q = this.qb; return this.carrier === q && !this.thrown && !this.qbRunning && q.y < this.los + .5 && (!this.run || this.fleaPhase === 2); }
  focusX() {
    const m = this.mine, b = this.ball, car = this.carrier, qb = this.qb;
    if (!m || this.vwTarget() === VW_QB) return CX;
    if (b) return (b.x * 2 + m.x) / 3;
    if (m.role === 'OL') return (m.x + qb.x) / 2;
    if (m.team === 'D') return car && car !== qb ? (m.x + car.x) / 2 : m.x * .7 + CX * .3;
    return m.x;
  }
  camXTarget() { return clamp((this.focusX() + SIDE) * PPY - this.VW / 2, 0, WW - this.VW); }
  setInset(px) { this.inset = px || 0; if (this.phase === 'idle') { this.eye = this.eyeTarget(); this.camY = this.camYTarget(); } }
  // 스냅 전에는 스크리미지 라인 바로 뒤를 패널 위에, 플레이 중에는 공을 화면 60% 높이에
  eyeTarget() {
    const pad = (this.phase === 'idle' ? Math.max(150, this.inset + 60) : 150) / this.scale;
    return clamp(this.phase === 'idle' ? this.H - pad - 16 : Math.min(this.H * .6, this.H - pad), this.H * .35, this.H * .8);
  }
  camYTarget() {
    if (this.phase === 'idle' || this.phase === 'pre') return this.los - 3;
    const b = this.ball; if (b) return b.sy + (b.y - b.sy) * (b.t / b.T);
    return (this.carrier || this.qb).y;
  }
  tip(text, sec = 3) {
    const el = this.tipEl; if (!el) return;
    clearTimeout(this.tipTimer); el.textContent = text; el.hidden = !text;
    if (text) this.tipTimer = setTimeout(() => { el.hidden = true; }, sec * 1000);
  }
  // ───────── 팀 구성·포메이션 ─────────
  kitFor(team) {
    const c = this.cfg, [c1, c2] = (team === 'O' ? c.offColors : c.defColors).map(vivid), away = team === c.away, light = lum(c1) > .62;
    if (away) return { jersey: '#F2F2EE', num: light ? shade(c1, -.5) : c1, helmet: c1, stripe: lum(c2) > .9 ? shade(c1, .45) : c2, pants: lum(c2) > .85 ? shade(c1, -.1) : c2, socks: c1 };
    return { jersey: c1, num: light ? shade(c1, -.6) : '#FFFFFF', helmet: c1, stripe: c2, pants: '#ECEAE4', socks: c1 };
  }
  setupTeams() {
    const c = this.cfg, P = [];
    this.used = { O: new Set(), D: new Set() };
    const mk = (team, role, extra = {}) => { const rating = (team === 'O' ? c.teamRating : c.oppRating) + (R() - .5) * 8; const p = { team, role, x: CX, y: this.los, vx: 0, vy: 0, rating, spd: speedOf(rating) * (ROLE_SPD[role] ?? 1), num: null, skin: Math.floor(R() * SKINS.length), big: role === 'OL' || role === 'DL', ...extra }; P.push(p); return p; };
    for (let i = 0; i < 5; i++) mk('O', 'OL', { ol: i, slot: 'OL' + i });
    this.qb = mk('O', 'QB', { slot: 'QB' });
    for (let i = 0; i < 5; i++) mk('O', 'WR', { skill: true });
    for (let i = 0; i < 4; i++) mk('D', 'DL', { dl: i, key: 'DL' + i });
    for (let i = 0; i < 7; i++) mk('D', 'LB', { def7: true });
    this.P = P;
    for (const p of P) if (!p.skill && !p.def7) this.number(p);
  }
  number(p) {
    const used = this.used[p.team];
    if (p.num != null) used.delete(p.num);
    for (let k = 0; k < 60; k++) { const segs = NUMS[p.role], [a, b] = segs[Math.floor(R() * segs.length)], n = a + Math.floor(R() * (b - a + 1)); if (!used.has(n)) { used.add(n); p.num = n; return; } }
    p.num = 0;
  }
  setRole(p, role) { if (p.role === role && p.num != null) return; p.role = role; p.big = role === 'OL' || role === 'DL'; if (!p.me) { p.spd = speedOf(p.rating) * (ROLE_SPD[role] ?? 1); this.number(p); } }
  home(p, s, instant) { p.home = { x: s.x, y: s.y }; if (instant) { p.x = s.x; p.y = s.y; p.vx = p.vy = 0; } }
  slotP(slot) { return this.P.find(p => p.team === 'O' && p.slot === slot) || null; }
  formOffense(formId, instant) {
    this.offForm = formId;
    const sp = offenseSpots(formId, this.los);
    this.P.filter(p => p.role === 'OL').forEach(p => this.home(p, sp.OL[p.ol], instant));
    this.home(this.qb, sp.QB, instant);
    const pool = this.P.filter(p => p.skill), need = Object.values(sp.slots), taken = new Set();
    const take = (p, s) => { taken.add(p); p.slot = s.slot; this.setRole(p, s.kind); this.home(p, s, instant); p.route = null; p.routeName = 'block'; };
    const near = s => (a, b) => Math.hypot(a.x - s.x, a.y - s.y) - Math.hypot(b.x - s.x, b.y - s.y);
    const done = new Set();
    if (this.mine?.skill) { const s = need.find(n => n.slot === this.mine.slot) || need.find(n => n.kind === this.mine.role) || need[0]; take(this.mine, s); done.add(s.slot); }
    for (const s of need) {
      if (done.has(s.slot)) continue;
      const free = pool.filter(q => !taken.has(q));
      const p = free.find(q => q.slot === s.slot && q.role === s.kind) || free.filter(q => q.role === s.kind).sort(near(s))[0] || free.sort(near(s))[0];
      take(p, s);
    }
  }
  shownShell(dp) { return R() < this.dif.disguise && dp.shell !== 0 ? 3 - dp.shell : dp.shell; } // 가끔 셸을 숨깁니다(디스가이즈)
  formDefense(formId, shell, instant) {
    this.defForm = formId;
    const recvs = this.P.filter(p => p.skill).map(p => ({ slot: p.slot, kind: p.role, x: p.home.x, y: p.home.y }));
    const man = this.defPlay && ['c0', 'c1', 'c2m'].includes(this.defPlay.cov);
    const spots = defenseSpots(formId, recvs, this.los, shell, man);
    for (const s of spots.filter(s => s.role === 'DL')) { const p = this.P.find(q => q.role === 'DL' && q.dl === s.dl); p.key = s.key; this.home(p, s, instant); }
    const pool = this.P.filter(p => p.def7), need = spots.filter(s => s.role !== 'DL'), taken = new Set();
    const take = (p, s) => { taken.add(p); p.key = s.key; p.tag = s.tag || null; this.setRole(p, s.role); this.home(p, s, instant); };
    const near = s => (a, b) => Math.hypot(a.x - s.x, a.y - s.y) - Math.hypot(b.x - s.x, b.y - s.y);
    const done = new Set();
    if (this.mine?.def7) { const k = this.myDefKey(need), s = need.find(n => n.key === k) || need.find(n => n.role === this.mine.role); if (s) { take(this.mine, s); done.add(s.key); } }
    for (const s of need) {
      if (done.has(s.key)) continue;
      const free = pool.filter(q => !taken.has(q) && !q.me);
      const p = free.find(q => q.key === s.key && q.role === s.role) || free.filter(q => q.role === s.role).sort(near(s))[0] || free.sort(near(s))[0];
      if (p) take(p, s);
    }
  }
  myDefKey(need) {
    const c = this.cfg.control;
    if (c === 'CB') return 'CBR';
    if (c === 'S') return need.some(n => n.key === 'FS') ? 'FS' : 'SS';
    if (c === 'LB') return need.find(n => n.tag === 'mike')?.key;
    return null;
  }
  pickMine() {
    const c = this.cfg, D = this.P.filter(p => p.team === 'D');
    const m = { QB: () => this.qb, OL: () => this.P.find(p => p.role === 'OL' && p.ol === 0), WR: () => this.slotP('Z'), TE: () => this.slotP('TE') || this.slotP('TE2'), RB: () => this.slotP('RB'),
      DL: () => D.find(p => p.role === 'DL' && p.dl === (c.edge ? 3 : 1)), LB: () => D.find(p => p.tag === 'mike') || D.find(p => p.role === 'LB'), CB: () => D.find(p => p.key === 'CBR'), S: () => D.find(p => p.key === 'FS') || D.find(p => p.role === 'S') }[c.control]?.();
    if (!m) return;
    const a = c.me.attrs;
    Object.assign(m, { me: true, rating: c.me.ovr, attrs: a, spd: (speedOf(a.spd ?? a.mob ?? a.agi ?? c.me.ovr) + .3) * (ROLE_SPD[m.role] ?? 1) });
    if (c.me.number != null) { const dup = this.P.find(q => q.team === m.team && q !== m && q.num === c.me.number); if (dup) dup.num = m.num; m.num = c.me.number; }
    this.mine = m;
    if (c.control === 'OL') { const dl = D.filter(p => p.role === 'DL').sort((a, b) => a.x - b.x)[0]; if (dl) dl.vsMe = true; }
  }
  // 작전이 정해지면 스냅. 결과는 Promise로 돌려줍니다.
  snap(opts = {}) {
    if (opts.play) this.play = typeof opts.play === 'string' ? playById(opts.play) : opts.play;
    if (opts.defPlay) this.defPlay = typeof opts.defPlay === 'string' ? defById(opts.defPlay) : opts.defPlay;
    if (!this.play) this.play = OFF_PLAYS[Math.floor(R() * OFF_PLAYS.length)];
    if (!this.defPlay) this.defPlay = DEF_PLAYS[Math.floor(R() * DEF_PLAYS.length)];
    if (this.play.form !== this.offForm) this.formOffense(this.play.form, false);
    this.formDefense(this.defPlay.form, this.defPlay.shell, false);
    this.assign();
    this.phase = 'pre'; this.t = this.cfg.side === 'O' ? -1.5 : -1.2; this.msg = ''; this.msgT = 0;
    return new Promise(res => { this.done = res; });
  }
  assign() {
    const c = this.cfg, play = this.play, skill = this.P.filter(p => p.skill);
    for (const p of skill) { const r = play.routes[p.slot] || 'block'; p.routeName = r; p.route = routePath(r, p.home); p.wp = 0; p.delay = routeInfo(r).delay || 0; }
    this.run = play.run || null; this.handed = false; this.qbRunning = false; this.fleaPhase = play.flea ? 0 : null;
    this.handT = this.run ? (this.run.hand ?? .45) : .45;
    this.runCarrier = this.run ? (this.run.carrier === 'QB' ? this.qb : this.slotP(this.run.carrier) || this.slotP('RB')) : null;
    this.leadP = this.run?.lead ? this.slotP(this.run.lead) : null;
    const D = this.P.filter(p => p.team === 'D');
    const asg = assignCoverage(this.defPlay, D.map(p => ({ key: p.key, role: p.role, tag: p.tag, x: p.home.x, y: p.home.y })), skill.map(p => ({ slot: p.slot, kind: p.role, x: p.home.x, y: p.home.y })));
    for (const p of D) { p.asg = asg[p.key] || { t: 'rush' }; p.blitz = !!p.asg.blitz; p.shed = 0; p.stunFree = 0; }
    // 맨 수비는 스냅 전에 마크맨 앞으로 걸어 나가 정렬합니다 (안쪽 지렛대)
    for (const p of D) if (p.asg.t === 'man') { const o = this.slotP(p.asg.who); if (o) p.home = { x: clamp(o.home.x + (o.home.x < CX ? 1 : -1) * .8, 1, FW - 1), y: this.los + (p.role === 'CB' ? (this.defPlay.cov === 'c0' ? 1.6 : 2.4) : p.role === 'S' ? 4.5 : 3.5) }; }
    // 런 블로킹 배정: 수비 라인맨마다 가장 가까운 라인맨, 남는 라인맨은 2선(라인배커)으로
    if (this.run) {
      const OL = this.P.filter(p => p.role === 'OL'), free = new Set(OL);
      for (const p of OL) p.runTarget = null;
      for (const d of D.filter(p => p.role === 'DL' || (p.blitz && p.home.y < this.los + 3))) { const o = [...free].sort((a, b) => Math.abs(a.home.x - d.home.x) - Math.abs(b.home.x - d.home.x))[0]; if (o) { o.runTarget = d; free.delete(o); } }
      const spot = { x: CX + this.run.hole, y: this.los + 4 }, lbs = D.filter(p => p.role === 'LB' && !p.blitz).sort((a, b) => dist(a.home, spot) - dist(b.home, spot));
      [...free].forEach((o, i) => { o.runTarget = lbs[i] || lbs[0] || null; o.climb = true; });
    }
    const blitzers = D.filter(p => p.blitz).length;
    this.pocket = clamp(2.75 + (c.teamRating - c.oppRating) * .04 + (R() - .5) * 1.1 - blitzers * .15 + (c.side === 'O' ? 1 : -1) * this.dif.pocket, 1.7, 4.9);
    this.qbDeadline = 2.5 + R() * 1.4; this.heatRoll = null; this.rushWon = false; // 공을 오래 끄는 날도 있습니다 (색이 나올 수 있게)
    this.qbFrozen = R() < clamp(.16 - (c.teamRating - 60) * .004, .05, .2) ? 1.6 : 0; // 가끔은 아무도 못 보고 공을 오래 끕니다
    // 쿼터백이 고를 리시버 번호: 루트를 뛰는 선수를 정렬 위치 왼쪽부터 1~5
    this.tnum = skill.filter(p => p.routeName !== 'block').sort((a, b) => a.home.x - b.home.x).slice(0, 5);
    this.readOrder = (play.read || skill.filter(p => p.routeName !== 'block').sort((a, b) => routeInfo(b.routeName).depth - routeInfo(a.routeName).depth).map(p => p.slot)).map(s => this.slotP(s)).filter(Boolean);
  }
  pick(role) {
    if (role === 'QB') return this.qb;
    if (role === 'WR') return this.slotP('Z');
    return this.P.find(p => p.role === role) || null;
  }
  // ───────── 입력 ─────────
  toField(e) {
    const r = this.canvas.getBoundingClientRect(), px = (e.clientX - r.left) * this.VW / r.width + Math.round(this.camX), py = (e.clientY - r.top) * this.H / r.height;
    return { x: px / PPY - SIDE, y: Y_TOP - (py + this.oy) / PPY };
  }
  bindInput() {
    const cv = this.canvas;
    cv.addEventListener('pointerdown', e => { e.preventDefault(); this.touch = { t: performance.now(), sx: e.clientX, sy: e.clientY }; });
    cv.addEventListener('pointerup', e => { const t = this.touch; this.touch = null; if (t && performance.now() - t.t < 400 && Math.hypot(e.clientX - t.sx, e.clientY - t.sy) < 14) this.tap(this.toField(e)); });
    cv.addEventListener('pointercancel', () => { this.touch = null; });
    const zone = this.host.querySelector('.lp-zone'), base = zone.querySelector('.lp-stick'), knob = base.querySelector('i'), R0 = 44;
    const move = e => {
      if (e.pointerId !== this.stickId) return;
      let dx = e.clientX - this.stickC.x, dy = e.clientY - this.stickC.y; const d = Math.hypot(dx, dy);
      if (d > R0) { dx = dx / d * R0; dy = dy / d * R0; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      this.stick = { x: dx / R0, y: -dy / R0 };
    };
    zone.addEventListener('pointerdown', e => {
      e.preventDefault(); if (this.stickId != null) return;
      this.stickId = e.pointerId; zone.setPointerCapture?.(e.pointerId);
      const zr = zone.getBoundingClientRect(), bw = base.offsetWidth || 112;
      const cx = clamp(e.clientX - zr.left, bw / 2, Math.max(bw / 2, zr.width - bw / 2)), cy = clamp(e.clientY - zr.top, bw / 2, Math.max(bw / 2, zr.height - bw / 2));
      Object.assign(base.style, { left: `${cx - bw / 2}px`, top: `${cy - bw / 2}px`, bottom: 'auto' }); base.classList.add('on');
      this.stickC = { x: zr.left + cx, y: zr.top + cy }; move(e);
    });
    zone.addEventListener('pointermove', move);
    const end = e => { if (e.pointerId !== this.stickId) return; this.stickId = null; this.stick = { x: 0, y: 0 }; knob.style.transform = ''; Object.assign(base.style, { left: '', top: '', bottom: '' }); base.classList.remove('on'); };
    zone.addEventListener('pointerup', end); zone.addEventListener('pointercancel', end);
    this.btns.addEventListener('pointerdown', e => { const b = e.target.closest('[data-sk]'); if (!b) return; e.preventDefault(); b.classList.add('press'); setTimeout(() => b.classList.remove('press'), 140); this.skill(b.dataset.sk); });
    this.tgEl.addEventListener('pointerdown', e => { const b = e.target.closest('[data-tn]'); if (!b) return; e.preventDefault(); this.throwToNum(+b.dataset.tn); });
    // 키보드: WASD·방향키 이동, Space·J·K·L = 버튼 1~4, Shift 터보, 숫자 1~5 = 그 리시버에게 패스
    this.onKey = e => {
      if (typing(e) || e.ctrlKey || e.metaKey || e.altKey) return;
      const k = keyName(e), down = e.type === 'keydown', dir = MOVE_KEYS[k];
      if (dir) { e.preventDefault(); down ? this.keys.add(dir) : this.keys.delete(dir); this.syncKeys(); return; }
      if (!down) return;
      if (k === 'space') e.preventDefault();
      if (e.repeat) return;
      if (/^[1-5]$/.test(k)) { if (this.throwToNum(+k)) e.preventDefault(); return; }
      if (k === 'shift') { if (this.skills().some(x => x.id === 'turbo')) this.skill('turbo', true); return; }
      const slot = SLOT_KEYS.includes(k) ? SLOT_KEYS.indexOf(k) : LEGACY_KEYS[k] ?? -1;
      if (slot >= 0) { e.preventDefault(); const x = this.skills()[slot]; if (x) this.skill(x.id, true); }
    };
    this.onBlur = () => { this.keys.clear(); this.syncKeys(); };
    window.addEventListener('keydown', this.onKey); window.addEventListener('keyup', this.onKey); window.addEventListener('blur', this.onBlur);
  }
  // 입력 방식이 바뀌면: 스틱 ↔ 키 표시, 버튼·칩 위 키 글자
  applyMode() {
    this.ctrl.classList.toggle('kbd', this.kbd); this.host.classList.toggle('lp-kbd', this.kbd);
    this.btnKey = null; this.tgKey = null; this.keys.clear(); this.syncKeys();
    if (!this.ctrl.hidden) this.syncButtons();
  }
  syncKeys() { for (const el of this.ctrl.querySelectorAll('.lp-keys kbd')) el.classList.toggle('on', this.keys.has(el.dataset.k)); }
  // 쿼터백(나)이 지금 던질 수 있나: 공을 들고 스크리미지 라인 뒤에 있을 때
  qbThrowable() { const m = this.mine; return this.phase === 'live' && !!m && m === this.qb && this.carrier === m && !this.ball && m.y < this.los + .5; }
  // 리시버 번호(왼쪽부터 1~5)를 보여 줄 때: 패스 작전에서 내가 쿼터백이면 스냅 직전부터 던지기 전까지
  showTargets() { return !!this.tnum?.length && this.mine === this.qb && (!this.run || !!this.play?.rpo) && (this.phase === 'pre' || this.qbThrowable()); }
  openLevel(r) { const d = Math.min(99, ...this.P.filter(p => p.team === 'D' && !(p.stun > 0)).map(p => dist(p, r))); return d >= 3 ? 'open' : d >= 1.6 ? 'mid' : 'tight'; }
  throwToNum(n) {
    const r = this.tnum?.[n - 1];
    if (!r || !this.showTargets() || !this.qbThrowable() || !this.eligible().includes(r)) return false;
    this.throwAt(this.qb, r, this.passType); this.syncButtons(); return true;
  }
  syncTargets() {
    const show = this.showTargets(), el = this.tgEl;
    if (el.hidden === show) { el.hidden = !show; this.host.classList.toggle('lp-qbt', show); }
    if (!show) return;
    const key = this.tnum.map(p => p.slot).join(',') + this.kbd;
    if (key !== this.tgKey) {
      this.tgKey = key;
      el.innerHTML = this.tnum.map((p, i) => `<button class="lp-tg" data-tn="${i + 1}" aria-label="${i + 1}번 ${p.role} ${p.num}에게 패스"><b>${i + 1}</b><span>${p.role} ${p.num}</span></button>`).join('');
    }
    this.tnum.forEach((p, i) => { const b = el.children[i]; if (!b) return; const o = this.phase === 'pre' ? 'pre' : !this.eligible().includes(p) ? 'gone' : this.dif.openHint ? this.openLevel(p) : 'pre'; if (b.dataset.o !== o) b.dataset.o = o; });
  }
  tap(f) {
    if (this.phase !== 'live') return;
    const m = this.mine;
    if (m && m === this.qb && this.carrier === m && !this.ball && m.y < this.los + .5) {
      // 리시버 근처를 탭하면 그 리시버의 움직임을 읽어 리드 패스
      const r = this.eligible().map(p => ({ p, d: Math.hypot(p.x - f.x, p.y - f.y) })).sort((a, b) => a.d - b.d)[0];
      if (r && r.d < 3.4) return this.throwAt(m, r.p, this.passType);
      return this.throwTo(f.x, f.y, m, this.passType);
    }
    if (m && this.carrier === m) return this.skill('juke');
    if (m && m.team === 'O' && this.canCall()) this.skill('call'); // 리시버: 필드를 탭해도 패스 콜
  }
  // ───────── 스킬 ─────────
  nearestD(m, r) { return this.P.filter(d => d.team !== m.team && !(d.stun > 0) && dist(d, m) < r).sort((a, b) => dist(a, m) - dist(b, m))[0] || null; }
  skills() {
    const m = this.mine; if (!m) return [];
    const live = this.phase === 'live', sk = this.sk, car = this.carrier === m, b = this.ball;
    const S = (id, label, cd, ok = true) => ({ id, label, cd, left: sk.cd[id] > 0 ? Math.min(1, sk.cd[id] / cd) : 0, ready: live && ok && !(sk.cd[id] > 0) && !(m.stun > 0 && id !== 'pass' && id !== 'ptype') });
    const nearBall = b && Math.hypot(m.x - b.x, m.y - b.y) < 7;
    if (m.team === 'O') {
      if (m.role === 'OL') return [S('punch', '펀치', 2.4, !!this.myMan), S('anchor', '버티기', 4)];
      if (m === this.qb && (this.phase === 'pre' || (car && this.inPocket()))) return [S('pass', '패스', .4), S('pump', '펌프 페이크', 2.5, sk.pumps < 2), S('spin', '스핀', 2.6), S('ptype', PASS_BTN[this.passType], .15)];
      if (car) return [S('spin', '스핀', 2.6), S('juke', '페이크', 2), S('turbo', '터보', 4), S('stiff', '스티프 암', 3)];
      if (nearBall) return [S('c_high', '하이포인트', 9, !sk.catchType), S('c_poss', '안전 캐치', 9, !sk.catchType), S('c_rac', 'RAC 캐치', 9, !sk.catchType), S('turbo', '터보', 4)];
      return [S('call', sk.callT > 0 ? '부르는 중' : '패스 콜', 1.5, this.canCall()), S('fake', '페이크', 3, !!this.nearestD(m, 3.8)), S('turbo', '터보', 4)];
    }
    if (m.role === 'DL' || m.blitz) return [S('spinmove', '스핀 무브', 2.4, !!this.myBlocker), S('swim', '스윔', 2.4, !!this.myBlocker), S('turbo', '터보', 4)];
    if (nearBall) return [S('d_int', '가로채기', 9, !sk.defBall), S('d_swat', '쳐내기', 9, !sk.defBall), S('turbo', '터보', 4)];
    const near = this.carrier && this.carrier.team !== m.team && dist(this.carrier, m) < 5.5;
    return [S('jam', '잼', 4, this.t < 2.4 && !this.ball && !!this.nearestD(m, 1.9)), S('dive', '다이브', 2.5, !!near), S('turbo', '터보', 4)];
  }
  // 패스 콜을 할 수 있나: 내가 루트를 뛰는 리시버이고, AI 쿼터백이 아직 공을 들고 있을 때
  canCall() {
    const m = this.mine, qb = this.qb, sk = this.sk, play = this.play;
    if (!m || m.team !== 'O' || m === qb || qb.me || this.thrown || this.ball || this.carrier !== qb || this.qbRunning || sk.callT > 0) return false;
    if (!this.eligible().includes(m)) return false;
    const rpoMe = play.rpo === m.slot && !this.handed;
    return (!this.run || this.fleaPhase === 2 || rpoMe) && (!play.flea || this.fleaPhase === 2);
  }
  skill(id, fromKey = false) {
    const m = this.mine; if (!m) return;
    const list = this.skills(), def = list.find(x => x.id === id); if (!def || !def.ready) return;
    if (fromKey) { const b = this.btns.children[list.indexOf(def)]; if (b) { b.classList.add('press'); setTimeout(() => b.classList.remove('press'), 140); } }
    const sk = this.sk, a = this.cfg.me.attrs, A = k => a[k] ?? this.cfg.me.ovr;
    sk.cd[id] = def.cd * this.dif.cd;
    if (id === 'pass') return this.autoThrow();
    if (id === 'ptype') { this.passType = PASS_TYPES[(PASS_TYPES.indexOf(this.passType) + 1) % 3]; this.float(m, { touch: 'TOUCH', bullet: 'BULLET', lob: 'LOB' }[this.passType], '#FFFFFF'); }
    else if (id === 'spin') { sk.spinT = .5; this.ghost(m); this.float(m, 'SPIN', '#FFFFFF'); }
    else if (id === 'juke') {
      const near = this.nearestD(m, 5), dir = Math.abs(this.stick.x) > .2 ? Math.sign(this.stick.x) : near ? (Math.sign(m.x - near.x) || 1) : (R() < .5 ? -1 : 1);
      this.ghost(m); m.vx = dir * m.spd * 1.05; m.vy *= .55; this.juke = .45;
      let bit = 0;
      for (const d of this.P.filter(d => d.team !== m.team && !(d.stun > 0) && dist(d, m) < 4.5)) if (R() < clamp(.38 + this.dif.skill + (A('agi') - d.rating) * .015, .15, .8)) { d.stun = .55; d.vx *= .2; d.vy *= .2; this.float(d, '?', '#FFD84A'); bit++; }
      this.float(m, bit ? 'JUKE!' : 'JUKE', bit ? '#FFD84A' : '#FFFFFF');
    }
    else if (id === 'turbo') { sk.turboT = 1.3; this.float(m, 'TURBO', '#FFD84A'); }
    else if (id === 'stiff') { sk.stiffT = .8; this.float(m, 'STIFF ARM', '#FFFFFF'); }
    else if (id === 'fake') {
      const d = this.nearestD(m, 3.8); this.ghost(m); m.vx += (R() < .5 ? -1 : 1) * 3;
      if (d && R() < clamp(.42 + this.dif.skill + (A('route') - d.rating) * .016, .15, .85)) { d.stun = .6; d.vx = 0; d.vy = 0; this.float(d, '?', '#FFD84A'); this.float(m, 'FAKED OUT!', '#FFD84A'); }
      else this.float(m, 'FAKE', '#FFFFFF');
    }
    else if (id === 'call') { sk.callT = 3; sk.callWait = null; sk.callPose = .55; this.float(m, 'HERE!', '#FFD84A'); }
    else if (id.startsWith('c_')) { sk.catchType = id.slice(2); this.float(m, { high: 'HIGH POINT', poss: 'SECURE', rac: 'RAC' }[sk.catchType], '#FFD84A'); }
    else if (id.startsWith('d_')) { sk.defBall = id.slice(2); this.float(m, sk.defBall === 'int' ? 'PLAY BALL' : 'SWAT', '#FFD84A'); }
    else if (id === 'pump') {
      sk.pumps++; this.float(m, 'PUMP!', '#FFFFFF'); m.throwT = .25;
      const read = (A('vis') + A('poise')) / 2;
      for (const d of this.P.filter(d => d.team === 'D' && ['CB', 'S', 'LB'].includes(d.role) && dist(d, m) < 26)) if (R() < clamp(.45 + this.dif.skill + (read - d.rating) * .012, .2, .8)) { d.stun = .4; d.vx *= .2; d.vy *= .2; this.float(d, '?', '#FFD84A'); }
    }
    else if (id === 'dive') {
      const t = this.carrier; let dx = t.x + t.vx * .2 - m.x, dy = t.y + t.vy * .2 - m.y; const n = Math.hypot(dx, dy) || 1;
      m.vx = dx / n * m.spd * 1.55; m.vy = dy / n * m.spd * 1.55; sk.diveT = .38; sk.diving = true; this.float(m, 'DIVE!', '#FFFFFF');
    }
    else if (id === 'jam') {
      const o = this.nearestD(m, 1.9);
      if (o && R() < clamp(.45 + this.dif.skill + ((A('str') + A('cov')) / 2 - o.rating) * .012, .2, .85)) { o.stun = .6; o.vx *= .2; o.vy *= .2; this.float(o, 'JAM!', '#FFD84A'); this.spark(o); }
      else this.float(m, 'MISS', '#FFFFFF');
    }
    else if (id === 'spinmove' || id === 'swim') {
      const b = this.myBlocker, move = id === 'spinmove' ? (A('agi') + A('rush')) / 2 : (A('hand') + A('rush')) / 2;
      if (b && R() < clamp(.42 + this.dif.skill + (move - b.rating) * .013, .18, .85)) { m.shed = 0; m.stunFree = .8; b.stun = .45; if (id === 'spinmove') sk.spinT = .4; this.ghost(m); this.float(m, id === 'spinmove' ? 'SPIN!' : 'SWIM!', '#FFD84A'); }
      else { m.stun = .25; this.float(m, 'STUCK', '#FFFFFF'); }
    }
    else if (id === 'punch') {
      const d = this.myMan, qb = this.qb;
      if (d && R() < clamp(.5 + this.dif.skill + (A('str') - d.rating) * .012, .2, .88)) { d.stun = .6; d.shed = 0; const n = dist(d, qb) || 1; d.x += (d.x - qb.x) / n * .9; d.y += (d.y - qb.y) / n * .9; this.float(d, 'POW!', '#FFD84A'); this.spark(d); }
      else this.float(m, 'MISS', '#FFFFFF');
    }
    else if (id === 'anchor') { sk.anchorT = 1.4; this.float(m, 'ANCHOR', '#FFD84A'); }
    this.syncButtons();
  }
  float(p, text, color) { this.floats.push({ x: p.x, y: p.y, text, color, life: 1 }); }
  ghost(p) { this.ghosts.push({ p, x: p.x, y: p.y, life: .3 }); }
  spark(p) { const x = (p.x + SIDE) * PPY - Math.round(this.camX), y = this.sy(p.y) - 10; for (let i = 0; i < 12; i++) { const a = R() * Math.PI * 2, v = .6 + R() * 1.4; this.fx.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - .4, life: 16 + R() * 8, c: i % 2 ? '#FFFFFF' : '#FFD84A' }); } }
  syncButtons() {
    const show = this.phase === 'pre' || this.phase === 'live' || this.phase === 'over';
    if (this.ctrl.hidden === show) this.ctrl.hidden = !show;
    if (!show) return;
    const list = this.skills(), key = list.map(x => x.id + x.label).join(',') + this.kbd;
    const keyOf = (x, i) => keyLabel(x.id === 'turbo' ? 'shift' : SLOT_KEYS[i]);
    if (key !== this.btnKey) { this.btnKey = key; this.btns.innerHTML = list.map((x, i) => `<button class="lp-btn b${i}" data-sk="${x.id}" aria-label="${x.label}${this.kbd ? ` (${keyOf(x, i)})` : ''}"><span>${x.label}</span>${this.kbd ? `<kbd>${keyOf(x, i)}</kbd>` : ''}</button>`).join(''); }
    list.forEach((x, i) => {
      const el = this.btns.children[i]; if (!el) return;
      const v = x.left.toFixed(2); if (el.dataset.cd !== v) { el.dataset.cd = v; el.style.setProperty('--cd', v); }
      if (el.classList.contains('off') === x.ready) el.classList.toggle('off', !x.ready);
    });
  }
  // ───────── 패스 ─────────
  autoThrow() {
    if (this.phase !== 'live' || this.mine !== this.qb || this.carrier !== this.qb || this.ball) return;
    const t = this.bestTarget(); if (t) this.throwAt(this.qb, t, this.passType);
  }
  eligible() { return this.P.filter(p => p.skill && p.routeName !== 'block' && p !== this.carrier); }
  openness(p) { const d = Math.min(...this.P.filter(x => x.team === 'D' && !(x.stun > 0)).map(x => dist(x, p))); return d + Math.max(0, p.y - this.los) * .04; }
  bestTarget(prefer = null) {
    const list = this.eligible().map(p => ({ p, o: this.openness(p) + (p === prefer ? 1.2 : 0) })).sort((a, b) => b.o - a.o);
    return list[0]?.p || null;
  }
  // 읽는 순서대로 열린 리시버를 찾습니다. 아무도 없으면 체크다운 또는 버리기('away')
  qbRead(base, olMode) {
    const prefer = this.mine?.team === 'O' && this.mine !== this.qb ? this.mine : null;
    for (let i = 0; i < this.readOrder.length; i++) {
      const r = this.readOrder[i]; if (r.routeName === 'block' || r.stun > 0 || r === this.carrier) continue;
      if (this.t < base + i * .55) return null;
      const need = routeInfo(r.routeName).depth >= 15 ? 2.8 : 2.2;
      if (this.openness(r) + (r === prefer ? .8 : 0) > need) return r;
    }
    const deadline = olMode ? Math.min(3.3, this.pocket) : this.qbDeadline + this.qbFrozen;
    if (this.t > deadline) { const b = this.bestTarget(prefer); if (b && this.openness(b) > 1.3) return b; return R() < .6 ? 'away' : b; }
    return null;
  }
  aiPassType(qb, r) { const d = dist(qb, r); return d > 24 ? (R() < .65 ? 'lob' : 'touch') : d < 11 ? (R() < .5 ? 'bullet' : 'touch') : (R() < .25 ? 'bullet' : 'touch'); }
  passSpeed(qb, type) { const arm = qb.me ? (this.cfg.me.attrs.arm ?? this.cfg.me.ovr) : this.cfg.teamRating; return (13 + arm * .15) * ({ bullet: 1.35, touch: 1, lob: .72 }[type] || 1); }
  flightTime(qb, p, type = 'touch') { return .3 + dist(qb, p) * 1.15 / this.passSpeed(qb, type); }
  // 던질 곳: 스크린·버블은 루트 끝(받을 자리)으로, 나머지는 리시버의 움직임을 앞질러
  aimPoint(qb, r, type) {
    if ((r.routeName === 'bubble' || r.routeName.startsWith('screen')) && r.route?.length) { const e = r.route.at(-1); return { x: e.x, y: e.y }; }
    const lead = this.flightTime(qb, r, type); return { x: r.x + r.vx * lead, y: r.y + r.vy * lead };
  }
  // 내가 쿼터백이면 고른 리시버가 공을 받으러 갑니다 (AI 쿼터백은 떨어지는 곳에서 가장 가까운 리시버)
  throwAt(qb, r, type) { const a = this.aimPoint(qb, r, type); this.throwTo(a.x, a.y, qb, type, qb.me ? r : null); }
  throwTo(tx, ty, qb, type = 'touch', want = null) {
    const c = this.cfg, acc = qb.me ? (c.me.attrs.acc ?? c.me.ovr) : c.teamRating;
    const d = Math.hypot(tx - qb.x, ty - qb.y), pressure = this.P.some(p => p.team === 'D' && dist(p, qb) < 2.4) ? 1.7 : 1;
    const err = Math.max(.15, (1.7 - acc * .013) * pressure * (d / 18)) * (type === 'touch' ? 1 : 1.15) * (qb.me ? this.dif.throwErr : 1), a = R() * Math.PI * 2, e = Math.abs(gauss()) * err;
    const lx = clamp(tx + Math.cos(a) * e, -1, FW + 1), ly = ty + Math.sin(a) * e;
    const T = .3 + d / this.passSpeed(qb, type), peak = type === 'bullet' ? 1.6 + d * .05 : type === 'lob' ? 5 + d * .25 : 2.8 + d * .13;
    this.ball = { sx: qb.x, sy: qb.y, x: lx, y: ly, t: 0, T, peak, type, from: qb, tipped: new Set() };
    this.carrier = null; this.thrown = true; this.passUsed = type; qb.throwT = .3;
    if (qb.me) this.inc('att');
    const el = this.eligible();
    this.target = want && el.includes(want) ? want : el.reduce((b, p) => dist(p, { x: lx, y: ly }) < dist(b, { x: lx, y: ly }) ? p : b, el[0]);
    if (this.target?.me) this.inc('tgt');
    this.msg = '';
  }
  inc(k, v = 1) { this.stats[k] = (this.stats[k] || 0) + v; }
  // ───────── 업데이트 ─────────
  loop(now) {
    if (this.closed) return;
    const dt = clamp((now - this.last) / 1000, 0, .05); this.last = now;
    for (let i = 0; i < (this.cfg.speedup || 1); i++) this.update(dt);
    const vt = this.vwTarget(); this.vwF += clamp(vt - this.vwF, -160 * dt, 160 * dt);
    const vw = Math.round(this.vwF / 2) * 2; if (vw !== this.VW) { const cx = this.camX + this.VW / 2; this.VW = vw; this.fit(); this.camX = clamp(cx - vw / 2, 0, WW - vw); }
    this.camX += (this.camXTarget() - this.camX) * clamp(dt * 3.5, 0, 1);
    this.eye += (this.eyeTarget() - this.eye) * clamp(dt * 4, 0, 1);
    if (this.phase !== 'over' && this.phase !== 'done') this.camY += (this.camYTarget() - this.camY) * clamp(dt * 3, 0, 1);
    this.syncTargets();
    this.syncButtons();
    this.draw(now);
    this.raf = requestAnimationFrame(this.loopFn);
  }
  seek(p, tx, ty, dt, k = 1, accel = 12) {
    // 블록에 걸린 패스 러셔는 블로커를 조금씩 밀고 들어갑니다 (포켓이 좁아짐)
    const push = p.engaged && p.team === 'D' && p.asg?.t === 'rush' && !this.run && !this.thrown && this.carrier === this.qb ? (this.t > this.pocket ? .55 : .3) : .16;
    const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy) || 1, v = p.spd * k * (p.engaged ? (p.y > this.los + 4 ? .55 : push) : 1) * (p.stun > 0 ? .2 : 1) * (p.racT > 0 ? 1.06 : 1);
    const want = d < .3 ? 0 : 1, vx = dx / d * v * want, vy = dy / d * v * want;
    if (p.engaged) { p.vx *= .5; p.vy *= .5; }
    p.vx += clamp(vx - p.vx, -accel * dt, accel * dt); p.vy += clamp(vy - p.vy, -accel * dt, accel * dt);
  }
  give(to) {
    const qb = this.qb; this.carrier = to; this.handed = true;
    if (this.mine === qb && to !== qb) { qb.me = false; to.me = true; this.mine = to; this.switched = true; }
    else if (to.me) this.inc('ratt');
  }
  update(dt) {
    if (this.msgT > 0) { this.msgT -= dt; if (this.msgT <= 0) this.msg = ''; }
    for (const p of this.P) { if (p.throwT > 0) p.throwT -= dt; if (p.blocking > 0) p.blocking -= dt; }
    if (this.phase === 'idle' || this.phase === 'done') return;
    this.t += dt;
    if (this.phase === 'pre') {
      // 새 포메이션으로 이동 (헛 소리 전)
      for (const p of this.P) if (p.home) { const k = clamp(dt * 6, 0, 1); p.vx = (p.home.x - p.x) * 6; p.vy = (p.home.y - p.y) * 6; p.x += (p.home.x - p.x) * k; p.y += (p.home.y - p.y) * k; }
      if (this.t >= 0) { for (const p of this.P) if (p.home) { p.x = p.home.x; p.y = p.home.y; p.vx = p.vy = 0; } this.phase = 'live'; this.msg = 'HUT!'; this.msgT = .7; this.carrier = this.qb; }
      return;
    }
    if (this.phase === 'over') { this.endT -= dt; if (this.endT <= 0) this.finish(); return; }
    const c = this.cfg, P = this.P, qb = this.qb, sk = this.sk, play = this.play, ru = this.run;
    for (const k in sk.cd) if (sk.cd[k] > 0) sk.cd[k] -= dt;
    for (const k of ['spinT', 'turboT', 'diveT', 'jumpT', 'anchorT', 'callT', 'stiffT', 'callPose']) if (sk[k] > 0) sk[k] -= dt;
    if (sk.diving && !(sk.diveT > 0)) { sk.diving = false; if (this.mine) { this.mine.stun = .7; this.mine.prone = .7; } }
    for (const p of P) { if (p.prone > 0) p.prone -= dt; if (p.racT > 0) p.racT -= dt; if (p.diveT > 0) { p.diveT -= dt; if (p.diveT <= 0) { p.prone = .7; p.stun = .7; } } }
    // 핸드오프·RPO·리드 옵션·플리 플리커 (RPO 대상인 내가 공을 부르는 중이면 핸드오프하지 않음)
    const me = this.mine, rpoCall = !!play.rpo && me?.slot === play.rpo && sk.callT > 0;
    if (ru && !this.handed && !this.thrown && this.carrier === qb && !rpoCall) {
      if (ru.carrier === 'QB') { if (this.t >= (ru.type === 'qbdraw' ? ru.hand : 0)) { this.handed = true; this.qbRunning = true; } }
      else if (play.rpo && !qb.me && this.t > .35 && !this.rpoRead) {
        this.rpoRead = true;
        const box = P.filter(p => p.team === 'D' && Math.abs(p.x - CX) < 7 && p.y < this.los + 7).length, t = this.slotP(play.rpo);
        if (box >= 7 && t) { this.throwAt(qb, t, 'bullet'); this.float(qb, 'RPO PASS', '#FFFFFF'); }
      }
      else if (ru.type === 'read' && this.t > this.handT) {
        const end = P.find(p => p.role === 'DL' && p.dl === (ru.hole > 0 ? 0 : 3)), rb = this.runCarrier;
        if (end && rb && dist(end, rb) < 4.2) { this.handed = true; this.qbRunning = true; this.keepX = CX - Math.sign(ru.hole || 1) * 8; this.float(qb, 'KEEP!', '#FFD84A'); }
        else this.give(rb);
      }
      else if (this.t > this.handT) {
        const rc = this.runCarrier;
        if (rc && (ru.type !== 'jet' && ru.type !== 'reverse' || dist(rc, qb) < 2.4 || this.t > this.handT + .7)) this.give(rc);
      }
    }
    if (play.flea && !this.thrown) {
      if (this.fleaPhase === 0 && this.t > .45) { this.fleaPhase = 1; this.carrier = this.slotP('RB'); }
      else if (this.fleaPhase === 1 && this.t > 1.2) { this.fleaPhase = 2; this.carrier = qb; this.float(qb, 'PITCH!', '#FFD84A'); }
    }
    // 패스 콜: 내가 공을 부르면 쿼터백이 잠깐(쿼터백 능력에 따라 0.2~0.55초) 보고 나에게 던집니다. 커버가 붙어 있어도 던지니 타이밍은 내 몫!
    const passing = !ru || this.fleaPhase === 2;
    const calling = sk.callT > 0 && me && me.team === 'O' && me !== qb && !qb.me && this.eligible().includes(me) && !this.ball && this.carrier === qb && !this.qbRunning && qb.y < this.los + .5 && (passing || rpoCall) && (!play.flea || this.fleaPhase === 2);
    if (calling) {
      sk.callWait = (sk.callWait ?? clamp(.42 - (c.teamRating - 60) * .006, .2, .55) * this.dif.callWait) - dt;
      if (sk.callWait <= 0 && this.t > .3) { sk.callT = 0; sk.callWait = null; this.float(qb, 'GOT IT!', '#FFFFFF'); this.throwAt(qb, me, this.aiPassType(qb, me)); }
    }
    // AI 쿼터백 패스
    if (!calling && !this.ball && this.carrier === qb && !qb.me && passing && (!play.flea || this.fleaPhase === 2) && !this.qbRunning && qb.y < this.los + .5) {
      // 내가 리시버로 루트를 뛰면 쿼터백이 조금 더 기다려 패스 콜할 틈을 줍니다
      const myRoute = me && me.team === 'O' && me !== qb && this.eligible().includes(me) ? .35 : 0;
      const olMode = c.control === 'OL' && play.cat !== 'screen', base = (olMode ? 1.9 : play.quick ? .35 : play.cat === 'screen' ? (this.readOrder[0]?.delay || 0) + .45 : play.pa ? (play.flea ? 1.6 : 1.25) : .95) + (play.quick || play.cat === 'screen' ? 0 : this.qbFrozen + myRoute);
      const prefer = this.mine && this.mine.team === 'O' && this.mine !== qb ? this.mine : null;
      {
        // 블리츠가 뚫려 들어오면 빨리 던집니다 (핫 리드)
        const heat = P.some(d => d.team === 'D' && d.asg?.t === 'rush' && (d.engaged ? dist(d, qb) < 1.8 : dist(d, qb) < 3.2));
        if (heat && !this.heatRoll) this.heatRoll = R() < .62 ? 'throw' : 'hold';
        const t = heat && this.t > .5 ? (this.heatRoll === 'throw' ? (this.bestTarget(prefer) || 'away') : null) : this.qbRead(base, olMode);
        if (t === 'away') { this.thrown = true; if (qb.me) this.inc('att'); this.pop('THROWN AWAY', '#FFFFFF'); return this.endPlay({ incomplete: true, text: '패스를 버렸다' }); }
        if (t) this.throwAt(qb, t, this.aiPassType(qb, t));
      }
    }
    if (!this.ball && this.carrier === qb && passing && !this.qbRunning && this.t > 5.5) return this.endPlay({ incomplete: true, text: '패스를 버렸다' });
    // 블로킹 판정을 먼저: 블로커 1.1야드 안의 수비는 묶입니다
    for (const p of P) { if (p.stun > 0) p.stun -= dt; p.engaged = false; }
    this.myBlocker = null; this.myMan = null;
    const runShown = !!ru && (this.handed || this.qbRunning);
    for (const d of P.filter(p => p.team === 'D')) {
      if (d.me && sk.spinT > 0) continue;
      const db = d.role === 'CB' || d.role === 'S';
      const near = P.filter(o => o.team === 'O' && !(o.stun > 0) && (!d.vsMe || o.me || runShown) && !(db && o.role === 'OL') && (o.role === 'OL' || (this.carrier && this.carrier !== o && o !== qb && (o.routeName === 'block' || this.thrown || runShown))) && dist(o, d) < 1.1);
      const blocker = near.find(o => o.me) || near[0];
      if (!blocker || (d.me && this.juke > 0)) continue;
      const open = d.y > this.los + 4;
      const bR = blocker.me ? (ru ? (c.me.attrs.rblk ?? c.me.ovr) : (c.me.attrs.pblk ?? c.me.ovr)) : blocker.rating;
      if (blocker.me && sk.anchorT > 0) d.shed = Math.max(0, (d.shed || 0) - dt * .5);
      else d.shed = (d.shed || 0) + dt * ((open ? 2 : .35) + Math.max(0, d.rating - bR) * .02 + (d.me ? .35 : 0) + (d.vsMe ? .15 : 0) + (!this.thrown && this.carrier === qb && !ru && this.t > this.pocket ? 2 : 0));
      if (d.shed > 1 + R() * .6) { d.shed = 0; d.stunFree = .45; continue; }
      if (!(d.stunFree > 0)) { d.engaged = true; blocker.blocking = .15; if (blocker.me) { this.myBlockT = (this.myBlockT || 0) + dt; this.myMan = d; } if (d.me) this.myBlocker = blocker; }
    }
    for (const p of P) if (p.stunFree > 0) p.stunFree -= dt;
    // 공을 오래 끌면 가장 가까운 러셔가 블록을 이깁니다
    if (this.qbFrozen && !this.thrown && this.carrier === qb && !ru && this.t > this.pocket && !this.rushWon) {
      const w = P.filter(d => d.team === 'D' && d.asg?.t === 'rush' && d.engaged).sort((a, b) => dist(a, qb) - dist(b, qb))[0];
      if (w) { this.rushWon = true; w.engaged = false; w.shed = 0; w.stunFree = 1.2; this.float(w, 'BEAT!', '#FFFFFF'); }
    }
    // 이동
    for (const p of P) { if (p.me) this.moveMe(p, dt); else if (p.team === 'O') this.aiO(p, dt); else this.aiD(p, dt); }
    for (const p of P) { p.x += p.vx * dt; p.y += p.vy * dt; p.x = clamp(p.x, -1.5, FW + 1.5); }
    if (this.juke > 0) this.juke -= dt;
    this.ghosts = this.ghosts.filter(g => (g.life -= dt) > 0);
    this.floats = this.floats.filter(f => (f.life -= dt * .9) > 0);
    // 공 비행 (낮은 공은 수비 손에 걸릴 수 있음)
    if (this.ball) {
      const b = this.ball; b.t += dt;
      if (b.type !== 'lob' && b.t > .15 && b.t < b.T - .15) {
        const k = b.t / b.T, gx = b.sx + (b.x - b.sx) * k, gy = b.sy + (b.y - b.sy) * k, h = 4 * b.peak * k * (1 - k);
        if (h < 2.6) for (const d of P) {
          if (d.team !== 'D' || d.stun > 0 || b.tipped.has(d) || Math.hypot(d.x - gx, d.y - gy) > .8) continue;
          b.tipped.add(d);
          if (R() < (d.me ? (sk.defBall ? .6 : .4) : .2 * (c.side === 'O' ? this.dif.aiInt : 1)) * (b.type === 'bullet' ? 1 : .7)) return this.tipBall(d);
        }
      }
      if (b.t >= b.T) return this.resolveCatch();
    }
    const carrier = this.carrier;
    if (carrier && !(play.flea && this.fleaPhase === 1)) {
      if (carrier.x < 0 || carrier.x > FW) return this.endPlay({ gain: carrier.y - this.los, text: '사이드라인 밖으로' });
      if (carrier.y >= 100) return this.endPlay({ gain: 100 - this.los, td: true, text: '터치다운!' });
      for (const d of P.filter(x => x.team === 'D' && !(x.stun > 0) && !x.engaged)) {
        const diving = (d.me && sk.diveT > 0) || d.diveT > 0;
        if (dist(d, carrier) < (carrier.y > this.los + 3 ? 1.15 : .8) + (diving ? .85 : 0) + (d.me ? this.dif.myTackle : 0)) {
          if (d.me) sk.diving = false;
          d.diveT = 0;
          const sackish = carrier === qb && carrier.y < this.los + .3 && !this.thrown && !this.qbRunning;
          const elusive = carrier.me ? ((carrier.attrs?.agi ?? carrier.rating) + (carrier.attrs?.str ?? carrier.rating)) / 2 : carrier.rating;
          const tk = d.me ? (c.me.attrs.tkl ?? c.me.ovr) : d.rating, spinning = carrier.me && sk.spinT > 0, stiff = carrier.me && sk.stiffT > 0;
          const pBreak = clamp((carrier.me ? .16 : .09) + (elusive - tk) * .006 + (carrier.me && this.juke > 0 ? .25 : 0) + (spinning ? .4 : 0) + (stiff ? .3 + ((c.me.attrs.str ?? 60) - 60) * .004 : 0) - (sackish ? .08 : 0) + (diving && !d.me ? .12 : 0) + (carrier.me ? this.dif.breakP : 0) - (d.me ? this.dif.breakP : 0), .03, spinning || stiff ? .85 : .55);
          if (R() < pBreak) { d.stun = spinning || stiff ? .9 : .55; if (stiff) { d.prone = .8; sk.stiffT = 0; } this.pop(spinning ? 'SPIN MOVE!' : stiff ? 'STIFF ARM!' : 'BROKEN TACKLE', spinning || stiff ? '#FFD84A' : '#FFFFFF'); continue; }
          if (sackish) { if (d.me) { this.inc('sack'); this.inc('tkl'); } return this.endPlay({ gain: carrier.y - this.los, sack: true, sacker: d, text: '색!' }); }
          const fumble = R() < clamp(.016 - ((carrier.attrs?.carry ?? 60) - 60) * .0004, .005, .03) * (sackish ? 2 : 1) * (carrier.me ? this.dif.fumble : 1);
          if (d.me) { this.inc('tkl'); if (carrier.y < this.los) this.inc('tfl'); if (fumble) this.inc('ff'); }
          d.prone = .6; carrier.prone = .6;
          if (fumble) return this.endPlay({ gain: carrier.y - this.los, turnover: 'FUMBLE', text: '펌블!' });
          return this.endPlay({ gain: carrier.y - this.los, text: '태클' });
        }
      }
    }
  }
  moveMe(p, dt) {
    const sk = this.sk;
    if (sk.diveT > 0) return;
    let sx = this.stick.x, sy = this.stick.y;
    const k = this.keys, kx = (k.has('R') ? 1 : 0) - (k.has('L') ? 1 : 0), ky = (k.has('U') ? 1 : 0) - (k.has('D') ? 1 : 0);
    if (kx || ky) { const n = Math.hypot(kx, ky); sx = kx / n; sy = ky / n; }
    const mag = Math.min(1, Math.hypot(sx, sy));
    const boost = (this.juke > 0 ? 1.25 : 1) * (sk.turboT > 0 ? 1.22 : 1) * (sk.spinT > 0 ? .9 : 1);
    if (mag > .14) { const sp = .3 + .7 * clamp((mag - .14) / .6, 0, 1); return this.seek(p, p.x + sx / mag * 6, p.y + sy / mag * 6, dt, sp * (this.carrier === p ? .97 : 1) * boost, 22); }
    if (this.carrier === p && p !== this.qb) return this.seek(p, p.x + p.vx * .2, p.y + 6, dt, .9 * boost, 10);
    if (p === this.qb && this.carrier === p) return this.seek(p, p.x, p.y, dt, 1, 14);
    const help = this.cfg.assist ?? Math.min(1, (p.team === 'O' && p.role === 'OL' ? .3 : .6) * this.dif.assist); // 손을 떼면 AI가 이만큼 대신 뜁니다
    p.team === 'O' ? this.aiO(p, dt, help) : this.aiD(p, dt, help);
  }
  // ───────── 공격 AI ─────────
  aiO(p, dt, k = 1) {
    const car = this.carrier, ball = this.ball, qb = this.qb, play = this.play, ru = this.run;
    if (p === car) {
      if (p === qb && !this.thrown && !this.qbRunning && (!ru || this.fleaPhase === 2)) {
        if (play.boot) return this.seek(p, CX + 8 * play.boot, this.los - 4.5, dt, .85 * k);
        return this.seek(p, p.x, play.pa ? this.los - 7 : this.los - 6.5, dt, .7 * k);
      }
      if (p === qb && ru && !this.handed && !this.thrown) return this.seek(p, CX + Math.sign(ru.hole || 1) * .6, p.y - .4, dt, .5 * k); // 핸드오프 준비
      if (play.flea && this.fleaPhase === 1) return this.seek(p, CX + 1, this.los - 2, dt, .6 * k);
      // 설계된 런 길: 구멍까지
      if (ru && !this.thrown && p.y < this.los + 1.5 && this.t < 2.2) {
        const hole = this.qbRunning && this.keepX != null ? this.keepX : CX + ru.hole;
        // 러닝백의 시야: 0.2초마다 설계된 구멍 ±3야드에서 수비(블록에 걸린 선수 포함)와 가장 먼 틈을 고릅니다
        if (this.gapT == null || this.t - this.gapT > .2) {
          this.gapT = this.t; let best = hole, bs = -1e9;
          const line = this.P.filter(d => d.team === 'D' && Math.abs(d.y - this.los) < 3.5 && !(d.stun > 0));
          for (let x = hole - 3; x <= hole + 3; x += .5) { const m = line.length ? Math.min(...line.map(d => Math.hypot(d.x - x, (d.y - this.los) * .7))) : 3; const sc = Math.min(m, 3) - Math.abs(x - hole) * .25; if (sc > bs) { bs = sc; best = x; } }
          this.gapX = best;
        }
        const tx = ru.type === 'counter' && this.t < .8 ? CX - Math.sign(ru.hole) * 2.5 : ru.type === 'sneak' ? CX : this.gapX;
        return this.seek(p, tx, this.los + 2, dt, .95 * k);
      }
      const near = this.P.filter(d => d.team === 'D' && d.y > p.y - 1 && dist(d, p) < 5).sort((a, b) => dist(a, p) - dist(b, p))[0];
      const avoid = near ? (p.x - near.x) * 1.4 : 0;
      return this.seek(p, clamp(p.x + avoid, 1, FW - 1), p.y + 8, dt, (this.thrown ? .88 : .95) * k);
    }
    if (ball && p === this.target) return this.seek(p, ball.x, ball.y, dt, k, 22);
    // 핸드오프 전 런 캐리어의 움직임
    if (ru && !this.handed && p === this.runCarrier) {
      if (ru.type === 'jet') return this.seek(p, qb.x + 1, this.los - 1.6, dt, k);
      if (ru.type === 'reverse') return this.seek(p, CX + 2, this.los - 4.5, dt, k);
      if (ru.type === 'draw') return this.seek(p, p.x, p.y, dt, k);
      if (ru.type === 'toss') return this.seek(p, CX + ru.hole, this.los - 3.5, dt, k);
      if (ru.type === 'counter') return this.seek(p, CX - Math.sign(ru.hole) * 2, this.los - 3, dt, .8 * k);
      return this.seek(p, CX + ru.hole * .5, this.los - 2.4, dt, .85 * k);
    }
    // 플레이 액션 페이크
    if (play.pa && p.slot === 'RB' && p.routeName === 'block' && this.t < .7 && !play.flea) return this.seek(p, CX + 1.5, this.los - .5, dt, .8 * k);
    const pocketPass = car === qb && !this.thrown && !this.qbRunning && (!ru || this.fleaPhase === 2);
    // 리드 블로커: 구멍 앞의 라인배커·세이프티에게
    if (ru && p === this.leadP && !this.thrown) {
      const spot = { x: CX + ru.hole, y: this.los + 3 }, d = this.P.filter(x => x.team === 'D' && (x.role === 'LB' || x.role === 'S') && x.y > this.los).sort((a, b) => dist(a, spot) - dist(b, spot))[0];
      if (d) return this.seek(p, d.x, d.y - .6, dt, k);
    }
    // 스크린: 와이드 리시버는 처음부터 코너를 막고, 라인맨은 1초 뒤 앞으로 나가 길을 엽니다
    if (play.cat === 'screen' && !this.thrown && !ru) {
      if (p.role === 'WR' && p.routeName === 'block') { const d = this.P.filter(x => x.team === 'D' && (x.role === 'CB' || x.role === 'S') && dist(x, p) < 9).sort((a, b) => dist(a, p) - dist(b, p))[0]; if (d) return this.seek(p, d.x, d.y - .7, dt, k); }
      const tgt = this.readOrder[0];
      if (p.role === 'OL' && p.ol >= 1 && this.t > 1 && tgt) return this.seek(p, (p.x + tgt.x) / 2, this.los + 2, dt, .9 * k);
    }
    if (car && car !== p && !pocketPass && !(play.flea && this.fleaPhase === 1)) {
      // 런: 배정된 상대를 끝까지 (남는 라인맨은 라인배커에게 올라감)
      if (ru && p.role === 'OL' && p.runTarget && !(p.runTarget.prone > 0) && dist(p, p.runTarget) < 7) { const d = p.runTarget; return this.seek(p, d.x + (CX + ru.hole - d.x) * -.15, d.y - .6, dt, p.climb ? .95 * k : .85 * k); }
      if (p.role === 'OL') {
        const d = this.P.filter(x => x.team === 'D' && x.y > car.y - 2).sort((a, b) => dist(a, car) - dist(b, car))[p.ol % 3];
        if (d) return this.seek(p, d.x, Math.min(d.y - .6, this.los + 5), dt, .85 * k);
      } else if (p.routeName === 'block' || this.thrown || ru) {
        // 스토크 블록: 내 근처의 수비
        const d = this.P.filter(x => x.team === 'D' && x.y > car.y - 2 && dist(x, p) < 6).sort((a, b) => dist(a, p) - dist(b, p))[0];
        if (d) return this.seek(p, d.x, d.y - .6, dt, .85 * k);
      }
    }
    if (p.role === 'OL' || (p.routeName === 'block' && (p.role === 'RB' || p.role === 'TE' || p.role === 'FB') && car === qb) || (p.delay && this.t < p.delay)) {
      const rushers = this.P.filter(x => x.team === 'D' && x.asg?.t === 'rush').sort((a, b) => a.x - b.x);
      let r = null;
      if (p.role === 'OL') r = rushers.length ? rushers[Math.round(p.ol * (rushers.length - 1) / 4)] : null;
      else r = rushers.filter(x => !x.vsMe && !this.P.some(o => o.role === 'OL' && dist(o, x) < 1.3)).sort((a, b) => dist(a, qb) - dist(b, qb))[0];
      if (!r) return this.seek(p, p.x, Math.min(p.y, this.los - .8), dt, .6 * k);
      const d = dist(r, qb) || 1, tx = r.x + (qb.x - r.x) / d * .9, ty = r.y + (qb.y - r.y) / d * .9;
      return this.seek(p, tx, Math.min(ty, this.los - .3), dt, k, 16);
    }
    if (p.route && p.wp < p.route.length) { const w = p.route[p.wp]; if (dist(p, w) < 1) p.wp++; return this.seek(p, w.x, w.y, dt, k); }
    if (['curl', 'out', 'sit', 'hitch', 'comeback', 'quickout'].includes(p.routeName)) return this.seek(p, p.x, p.y, dt, k);
    return this.seek(p, p.x, p.y + 4, dt, .5 * k);
  }
  // ───────── 수비 AI ─────────
  aiD(p, dt, k = 1) {
    const car = this.carrier, ball = this.ball, qb = this.qb, a = p.asg || { t: 'rush' }, ru = this.run, play = this.play;
    const runLike = !!ru || (play.flea && this.fleaPhase === 1);
    // 난이도: 내가 공격일 때 상대 수비 AI의 커버 속도·맨 반응 지연·공 반응·추격 속도
    const hd = this.cfg.side === 'O' ? this.dif : null, cs = hd ? hd.coverSpd : 1, cl = hd ? hd.coverLag : 1, rc = hd ? hd.react : 1, pu = hd ? hd.pursue : 1;
    if (ball) {
      const deep = a.t === 'zone' && isDeepZone(a.z), r = a.t === 'zone' ? (deep ? 17 : 12) : a.t === 'man' ? 7 : 3.5;
      if (Math.hypot(ball.x - p.x, ball.y - p.y) < r && ball.t > (a.t === 'man' ? .45 : .3) * rc) return this.seek(p, ball.x, ball.y, dt, .97 * k * cs, 14);
    }
    if (runLike && this.t < .9 && p.role !== 'DL' && !p.blitz) return this.seek(p, p.x, p.y + (p.role === 'CB' ? .5 : 0), dt, k); // 런인지 읽는 시간
    if (play.pa && !p.blitz && this.t < .7 - (p.rating - 60) * .01 && (p.role === 'LB' || (p.role === 'S' && !(a.t === 'zone' && isDeepZone(a.z))))) return this.seek(p, p.x, Math.max(this.los + 1.5, p.y - 3), dt, .7 * k); // 페이크에 끌려 나옴
    if (p.vsMe && car === qb && !this.thrown && !ru) {
      const m = this.mine;
      p.laneX ??= m.x - 2; p.counter ??= R() < .3;
      const past = p.y < m.y - .4 || p.y <= this.los - 3, inside = p.counter && m.x < p.laneX + .6;
      return this.seek(p, past ? qb.x : inside ? m.x + 1.8 : p.laneX, past ? qb.y : this.los - 3.2, dt, 1.04 * k);
    }
    const rushing = a.t === 'rush' && car === qb && !this.thrown && !runLike && !this.qbRunning && car.y <= this.los;
    if (car && !rushing && (car !== qb || runLike || this.qbRunning || car.y > this.los || a.t === 'rush')) {
      if (p.diveT > 0) return; // 몸을 날린 중에는 그대로
      const dd = dist(p, car);
      // 가까이 붙으면 다이브 태클 (빗나가면 잠시 넘어져 있음)
      if (dd < 1.9 && dd > 1.15 && !(p.prone > 0) && !p.engaged && R() < dt * 3 * (this.cfg.side === 'O' ? this.dif.aiDive : 1)) { p.vx = (car.x + car.vx * .15 - p.x) / dd * p.spd * 1.45; p.vy = (car.y + car.vy * .15 - p.y) / dd * p.spd * 1.45; p.diveT = .35; return; }
      const lead = Math.min(.9, dd / 9);
      return this.seek(p, car.x + car.vx * lead, car.y + car.vy * lead, dt, (dd < 4 ? 1.06 : 1) * k * pu);
    }
    if (a.t === 'rush') {
      // 막는 사람이 없는 블리처는 포켓 시계를 기다리지 않고 곧장 들어갑니다
      if (p.blitz && !p.engaged && !this.P.some(o => o.team === 'O' && (o.role === 'OL' || o.routeName === 'block') && dist(o, p) < 2.2) && dist(p, qb) < 9) return this.seek(p, qb.x, qb.y, dt, k);
      const pt = this.pocket * (p.blitz ? .78 : 1);
      if (this.t < pt && !this.thrown && car === qb) { const d = dist(p, qb), v = Math.max(0, d - 1.7) / Math.max(.25, pt - this.t); return this.seek(p, qb.x, qb.y, dt, Math.min(1, (v + .4) / p.spd) * k); }
      return this.seek(p, qb.x, qb.y, dt, .95 * k);
    }
    if (a.t === 'spy') return this.seek(p, qb.x, this.los + 4.5, dt, .9 * k);
    if (a.t === 'man') {
      const o = this.slotP(a.who);
      if (o && o.routeName === 'block' && this.t > .9) { p.asg = R() < .5 ? { t: 'rush', blitz: true } : { t: 'zone', z: 'hookM' }; return this.seek(p, p.x, p.y, dt, k); }
      // 맨: 마크맨의 x를 따라가며 위쪽 쿠션을 지킵니다 (스크리미지 라인 뒤로 쫓아 들어가지 않음)
      if (o) {
        const deep = o.y > this.los + 11, lag = ((deep ? .08 : .15) + Math.max(0, o.rating - p.rating) * .004) * cl;
        let ty = Math.max(o.y - o.vy * lag + (deep ? 1 : .6), this.los + 1);
        if (o.y < p.y && o.vy > 1) ty = Math.max(ty, p.y); // 리시버가 올라오는 동안은 물러서기만
        return this.seek(p, o.x - o.vx * lag, ty, dt, k * cs, 16);
      }
    }
    if (a.t === 'zone') return this.zoneMove(p, a.z, dt, k * cs);
    return this.seek(p, p.x, p.y, dt, k);
  }
  // 존: 지점으로 물러나 내 구역에 들어온 리시버를 따라 움직입니다 (딥은 가장 깊은 리시버 위, 언더는 앞을 막음)
  zoneMove(p, z, dt, k) {
    const [zx, zd] = ZONES[z], hy = this.los + zd, deep = zd >= 13, el = this.eligible();
    let tx = zx, ty = hy;
    if (deep) {
      // 딥: 내 구역에서 가장 깊은 리시버의 위(오버 더 톱)에 붙습니다
      const w = z.startsWith('q') ? 8 : z.endsWith('2') ? 14 : 10;
      const t = el.filter(o => Math.abs(o.x - zx) < w && o.y > this.los + 6).sort((a, b) => b.y - a.y)[0];
      if (t) { tx = t.x * .85 + zx * .15 + t.vx * .2; ty = Math.max(hy - 3, t.y + 2.2); }
    } else {
      // 언더: 구역에 들어온 리시버에게 바짝 붙고(존 매치), 구역을 벗어나면 넘깁니다
      const w = z.startsWith('flat') ? 8 : 7, home = { x: zx, y: hy };
      const t = el.filter(o => Math.abs(o.x - zx) < w && o.y < hy + 6 && o.y > this.los - 2).sort((a, b) => dist(a, home) - dist(b, home))[0];
      if (t) { tx = t.x + t.vx * .25; ty = clamp(t.y + .9, this.los + 1, hy + 4); }
      else if (this.carrier === this.qb) tx = zx + (this.qb.x - CX) * .25;
    }
    return this.seek(p, tx, ty, dt, (deep ? .97 : .95) * k);
  }
  // ───────── 공 결과 ─────────
  tipBall(d) {
    const b = this.ball, qbMe = b.from.me; this.ball = null;
    if (R() < (d.me ? .3 + this.dif.myInt : .15 * (this.cfg.side === 'O' ? this.dif.aiInt : 1))) {
      if (qbMe) this.inc('pint'); if (d.me) { this.inc('dint'); this.inc('pd'); }
      this.pop('TIPPED · INT!', '#E85A5A');
      return this.endPlay({ gain: 0, turnover: 'INT', text: '공이 튀어 인터셉트!' });
    }
    if (d.me) this.inc('pd');
    this.pop(d.role === 'DL' ? 'BATTED DOWN!' : 'TIPPED!', '#FFFFFF');
    return this.endPlay({ incomplete: true, text: '패스가 손에 걸렸다' });
  }
  aiCatchType(p, def) { if (def && def.d < 1.3) return 'high'; if (p.x < 2 || p.x > FW - 2) return 'poss'; return R() < .6 ? 'rac' : 'norm'; }
  resolveCatch() {
    const b = this.ball, spot = { x: b.x, y: b.y }, c = this.cfg, sk = this.sk;
    this.ball = null;
    const near = this.P.filter(p => !(p.stun > 0)).map(p => ({ p, d: dist(p, spot) })).sort((a, b2) => a.d - b2.d);
    // 내가 직접 잡는 리시버면 팔이 조금 더 닿는 것처럼 계산합니다 (난이도 reach: 쉬움 0.5 · 노말 0.25 · 하드 0야드, 잡는 범위·수비와의 거리 비교 모두)
    const off = near.filter(x => x.p.team === 'O' && x.p.role !== 'OL' && x.p !== this.qb).map(x => x.p.me ? { p: x.p, d: Math.max(0, x.d - this.dif.reach) } : x).sort((a, b2) => a.d - b2.d)[0], def = near.find(x => x.p.team === 'D');
    const ct = off ? (off.p.me ? sk.catchType || 'norm' : this.aiCatchType(off.p, def)) : 'norm';
    const REACH = { high: .7, poss: -.1, rac: -.25, norm: 0 }, CONTEST = { high: .08, poss: .18, rac: .32, norm: .25 };
    const hands = off ? (off.p.me ? c.me.attrs.hands ?? c.me.ovr : off.p.rating) : 0;
    const reachO = off ? 1.6 + (hands - 60) * .012 + REACH[ct] : 0;
    const dMode = def?.p.me ? sk.defBall : null;
    const reachD = def ? .95 + ((def.p.me ? c.me.attrs.ball ?? c.me.attrs.cov ?? c.me.ovr : def.p.rating) - 60) * .008 + (dMode === 'int' ? .6 : dMode === 'swat' ? .45 : 0) : 0;
    const qbMe = b.from.me;
    this.dbg = { offD: off && +off.d.toFixed(2), defD: def && +def.d.toFixed(2), reachO: +reachO.toFixed(2), who: off?.p.slot, T: +b.T.toFixed(2), type: b.type, ct };
    if (def && def.d < reachD && (!off || def.d < off.d - .2 || (dMode && def.d < off.d + .3))) {
      const skill = def.p.me ? (c.me.attrs.ball ?? c.me.attrs.cov ?? c.me.ovr) : def.p.rating;
      const pInt = dMode === 'swat' ? 0 : clamp((.1 + (skill - 60) * .005 + (def.p.me ? .22 + this.dif.myInt : 0) + (dMode === 'int' ? .15 : 0) + (b.type === 'lob' ? .05 : 0)) * (!def.p.me && c.side === 'O' ? this.dif.aiInt : 1), .03, .8);
      if (R() < pInt) {
        if (qbMe) this.inc('pint');
        if (def.p.me) { this.inc('dint'); this.inc('pd'); }
        const six = def.p.me && R() < .22; if (six) this.inc('dtd');
        this.pop(six ? 'PICK SIX!' : 'INTERCEPTED', '#E85A5A');
        return this.endPlay({ gain: 0, turnover: 'INT', pickSix: six, text: six ? '픽식스!' : '인터셉트!' });
      }
      if (def.p.me) this.inc('pd');
      this.pop(dMode === 'swat' ? 'SWATTED!' : 'BROKEN UP', '#FFFFFF');
      return this.endPlay({ incomplete: true, text: '패스 디펜스' });
    }
    if (off && off.d < reachO + .9) {
      const contested = def && def.d < 1.3, diving = off.d >= reachO;
      const swat = def?.p.me && dMode === 'swat' && def.d < 1.6 ? .3 : 0;
      if (R() < clamp(.84 + (hands - 60) * .005 + (ct === 'poss' ? .08 : 0) - (contested ? CONTEST[ct] : 0) - swat + (off.p.me ? this.dif.catchP : 0), .3, .97) * (diving ? .45 : 1)) {
        const rc = off.p, air = Math.round(rc.y - this.los), toe = rc.x < 1.3 || rc.x > FW - 1.3;
        const type = diving ? 'dive' : toe ? 'toe' : ct;
        this.catchInfo = { air, kind: catchKind(air), type, y: rc.y };
        if (diving) { rc.stun = .5; rc.prone = .5; }
        else if (ct === 'high') rc.stun = .3;
        else if (ct === 'poss') { rc.vx *= .3; rc.vy *= .3; }
        else if (ct === 'rac') { if (rc.me) sk.turboT = .9; else rc.racT = .6; }
        this.carrier = rc;
        if (qbMe) this.inc('cmp');
        if (rc.me) this.inc('rec');
        if (this.mine === this.qb && !rc.me) { this.qb.me = false; rc.me = true; this.mine = rc; this.switched = true; }
        const label = { short: 'SHORT CATCH', mid: 'MID CATCH', long: 'LONG CATCH!' }[this.catchInfo.kind];
        this.pop(diving ? 'DIVING CATCH!' : label, '#F2C230');
        const tag = { high: 'HIGH POINT', poss: 'SECURE', rac: 'IN STRIDE', toe: 'TOE TAP' }[type];
        if (tag) this.float(rc, tag, '#FFFFFF');
        return;
      }
      if (def?.p.me && contested) this.inc('pd');
    }
    this.pop('INCOMPLETE', '#FFFFFF');
    return this.endPlay({ incomplete: true, text: '인컴플리트' });
  }
  pop(text, color) { this.msg = text; this.msgColor = color; this.msgT = 1; }
  endPlay(o) {
    if (this.phase !== 'live') return;
    this.phase = 'over'; this.endT = o.td ? 1.6 : 1.1;
    const car = this.carrier, passPlay = this.thrown && !o.incomplete && !o.turnover && !o.sack, c = this.cfg;
    o.gain = Math.round(o.gain ?? 0);
    if (c.control === 'OL') {
      if (o.sack && o.sacker?.vsMe) this.inc('sa');
      else if (!o.sack && (this.myBlockT || 0) > 1.6 && R() < .45) this.inc('pan');
    }
    if (o.sacker) this.dbg = { ...(this.dbg || {}), sacker: `${o.sacker.key}${o.sacker.vsMe ? '*' : ''}${o.sacker.blitz ? 'B' : ''}@${this.t.toFixed(1)}` };
    delete o.sacker;
    if (o.td && car?.team === 'O') { this.celebrate = car; if (this.thrown) { if (c.control === 'QB') this.inc('ptd'); if (car.me && c.control !== 'QB') this.inc('rectd'); } else if ((car.me && !this.switched) || (c.control === 'QB' && car === this.qb)) this.inc('rtd'); }
    if (passPlay && c.control === 'QB') this.inc('pyds', o.gain);
    if (passPlay && car?.me && c.control !== 'QB') this.inc('recyds', o.gain);
    if (!this.thrown && car?.me && !o.sack && !this.switched) { this.inc('ryds', o.gain); if (!this.stats.ratt) this.inc('ratt'); }
    if (!this.thrown && c.control === 'QB' && car === this.qb && !car.me && !o.sack && o.gain) { this.inc('ryds', o.gain); this.inc('ratt'); }
    if (o.td) { this.pop('TOUCHDOWN!', '#F2C230'); this.burst(); }
    else if (o.sack) this.pop('SACK!', c.side === 'D' ? '#F2C230' : '#E85A5A');
    else if (o.turnover === 'FUMBLE') this.pop('FUMBLE!', '#E85A5A');
    else if (!o.incomplete && !o.turnover && o.gain >= c.toGo && !this.catchInfo) this.pop('FIRST DOWN', '#FFD84A');
    const ci = passPlay ? this.catchInfo : null, endY = o.td ? 100 : car?.y;
    const ru = this.run, carKind = !this.thrown && car ? (car === this.qb ? 'qb' : car.role) : null;
    this.result = {
      ...o, stats: this.stats, thrown: this.thrown, myTouch: !!car?.me, dbg: this.dbg,
      catch: ci ? { ...ci, yac: Math.max(0, Math.round(endY - ci.y)) } : null, pass: this.thrown ? this.passUsed : null,
      run: ru && !this.thrown ? { type: this.qbRunning ? (ru.type === 'read' ? 'keep' : ru.type) : ru.type, carrier: carKind } : null,
      play: { id: this.play.id, name: this.play.name, form: FORMATIONS[this.play.form]?.name, cat: this.play.cat },
      def: { id: this.defPlay.id, name: this.defPlay.name, form: DEF_FORMS[this.defPlay.form]?.name, cov: COV_NAME[this.defPlay.cov], cat: this.defPlay.cat },
    };
  }
  burst() { for (let i = 0; i < 70; i++) { const a = R() * Math.PI * 2, v = 1 + R() * 2.6; this.fx.push({ x: this.VW / 2, y: this.H * .3, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1, life: 50 + R() * 30, c: ['#F2C230', '#FFFFFF', '#E85A5A', '#6BD88A'][i % 4] }); } }
  finish() {
    this.phase = 'done';
    const done = this.done; this.done = null;
    done?.(this.result || { gain: 0, incomplete: true, stats: this.stats });
  }
  destroy() {
    this.closed = true; cancelAnimationFrame(this.raf); this.ro?.disconnect(); clearTimeout(this.tipTimer);
    window.removeEventListener('keydown', this.onKey); window.removeEventListener('keyup', this.onKey); window.removeEventListener('blur', this.onBlur);
    this.offMode?.();
  }
  // ───────── 그리기 ─────────
  sy(Y) { return (Y_TOP - Y) * PPY - this.oy; }
  draw(now) {
    const ctx = this.ctx, H = this.H, VW = this.VW, ox = Math.round(this.camX), c = this.cfg;
    this.oy = Math.round((Y_TOP - this.camY) * PPY - this.eye);
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#1B2129'; ctx.fillRect(0, 0, VW, H);
    const s0 = clamp(this.oy, 0, FIELD_H), s1 = clamp(this.oy + H, 0, FIELD_H);
    if (s1 > s0) ctx.drawImage(this.field, ox, s0, VW, s1 - s0, 0, s0 - this.oy, VW, s1 - s0);
    ctx.translate(SIDE * PPY - ox, 0); // 여기부터 필드 좌표 (x야드 × PPY)
    // 스크리미지 라인(파랑)·퍼스트 다운 라인(노랑)
    const los = Math.round(this.sy(this.los)), fd = Math.round(this.sy(this.first)), FWP = Math.round(FW * PPY);
    ctx.fillStyle = 'rgba(74,140,255,.92)'; ctx.fillRect(0, los - 1, FWP, 2);
    if (this.first < 100) { ctx.fillStyle = 'rgba(255,216,74,.95)'; ctx.fillRect(0, fd - 1, FWP, 2); }
    if (this.phase === 'pre') c.side === 'O' ? this.drawRoutes(ctx) : this.drawAssignment(ctx);
    // 패스 콜 중: 쿼터백 → 나 점선
    if (this.sk.callT > 0 && this.mine && this.carrier === this.qb && !this.ball) { const q = this.qb, m = this.mine; ctx.save(); ctx.strokeStyle = 'rgba(255,216,74,.85)'; ctx.lineWidth = 2; ctx.setLineDash([5, 4]); ctx.lineDashOffset = -now / 40; ctx.beginPath(); ctx.moveTo(q.x * PPY, this.sy(q.y) - 12); ctx.lineTo(m.x * PPY, this.sy(m.y) - 12); ctx.stroke(); ctx.restore(); }
    if (this.ball) { const b = this.ball, px = b.x * PPY, py = this.sy(b.y), r = (b.type === 'lob' ? 8 : 6) + Math.sin(now / 90) * 1.2; ctx.strokeStyle = '#FFD84A'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(px, py, r + 3, r * .55, 0, 0, Math.PI * 2); ctx.stroke(); }
    for (const g of this.ghosts) { ctx.globalAlpha = g.life * 1.6; const spr = this.spriteOf(g.p, now); ctx.drawImage(spr, Math.round(g.x * PPY - spr.width / 2), Math.round(this.sy(g.y)) - spr.height + 2); ctx.globalAlpha = 1; }
    const order = [...this.P].sort((a, b) => b.y - a.y);
    for (const p of order) this.drawPlayer(ctx, p, now);
    if (this.showTargets()) this.drawTargets(ctx, now);
    if (this.ball) {
      const b = this.ball, k = b.t / b.T, gx = b.sx + (b.x - b.sx) * k, gy = b.sy + (b.y - b.sy) * k, h = 4 * b.peak * k * (1 - k) + 1.2;
      const px = Math.round(gx * PPY), py = Math.round(this.sy(gy));
      ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(px - 2, py - 1, 5, 2);
      const spr = ballSprite(Math.floor(now / 70) % 2); ctx.drawImage(spr, px - 4, Math.round(py - h * PPY) - 3);
    }
    for (const f of this.floats) { const fx = clamp(Math.round(f.x * PPY), ox - SIDE * PPY + 28, ox - SIDE * PPY + VW - 28), fy = Math.round(this.sy(f.y)) - 30 - Math.round((1 - f.life) * 14); bigText(ctx, f.text, fx, fy, f.color, 2); }
    if (this.phase === 'idle' && this.mine) { const m = this.mine, bob = Math.floor(now / 300) % 2; bigText(ctx, 'YOU', clamp(Math.round(m.x * PPY), ox - SIDE * PPY + 16, ox - SIDE * PPY + VW - 16), Math.round(this.sy(m.y)) - 34 - bob, '#FFD84A', 2); }
    ctx.setTransform(1, 0, 0, 1, 0, 0); // 화면 좌표
    this.fx = this.fx.filter(p => p.life-- > 0);
    for (const p of this.fx) { p.x += p.vx; p.y += p.vy; p.vy += .05; ctx.fillStyle = p.c; ctx.fillRect(Math.round(p.x), Math.round(p.y), 3, 3); }
    const ty = Math.round(clamp(this.eye - 150, 40, H * .3));
    const big = t => { for (const s of [5, 4, 3]) if (t.length * 4 * s <= VW - 14) return s; return 2; };
    if (this.phase === 'pre') bigText(ctx, this.t < -.5 ? 'READY' : 'SET', VW / 2, ty, '#FFFFFF', 5);
    else if (this.msg) bigText(ctx, this.msg, VW / 2, ty, this.msgColor || '#FFFFFF', big(this.msg));
  }
  // 리시버 머리 위 번호 (색 = 열린 정도: 초록 열림 · 노랑 보통 · 빨강 붙음)
  drawTargets(ctx, now) {
    const pre = this.phase === 'pre', el = this.eligible();
    this.tnum.forEach((p, i) => {
      if (!pre && !el.includes(p)) return;
      const x = Math.round(p.x * PPY), y = Math.round(this.sy(p.y)) - 31 - (Math.floor(now / 260 + i) % 2);
      ctx.fillStyle = OUT; ctx.beginPath(); ctx.arc(x, y, 6.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = OPEN_COLOR[pre || !this.dif.openHint ? 'pre' : this.openLevel(p)]; ctx.beginPath(); ctx.arc(x, y, 5.5, 0, Math.PI * 2); ctx.fill();
      bigText(ctx, String(i + 1), x, y, '#FFFFFF', 1);
    });
  }
  // 스냅 직전 우리 팀 작전 그림 (내 루트는 노랑, 1순위는 주황, 런은 빨강)
  drawRoutes(ctx) {
    const play = this.play, read0 = this.readOrder[0];
    ctx.save(); ctx.lineWidth = 2; ctx.lineJoin = 'round';
    const line = (pts, color, dash) => { ctx.strokeStyle = color; ctx.setLineDash(dash); ctx.beginPath(); pts.forEach((q, i) => { const x = q.x * PPY, y = this.sy(q.y); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke(); const a = pts.at(-1), b = pts.at(-2); if (!b) return; const ang = Math.atan2(this.sy(a.y) - this.sy(b.y), (a.x - b.x) * PPY), x = a.x * PPY, y = this.sy(a.y); ctx.setLineDash([]); ctx.beginPath(); ctx.moveTo(x - Math.cos(ang - .5) * 7, y - Math.sin(ang - .5) * 7); ctx.lineTo(x, y); ctx.lineTo(x - Math.cos(ang + .5) * 7, y - Math.sin(ang + .5) * 7); ctx.stroke(); };
    for (const p of this.P.filter(x => x.skill && x.route?.length)) line([p.home, ...p.route], p.me ? '#FFD84A' : p === read0 ? 'rgba(255,140,80,.85)' : 'rgba(255,255,255,.6)', [4, 3]);
    if (this.run) { const ru = this.run, cx = CX + ru.hole, from = this.runCarrier?.home || this.qb.home; line([from, { x: cx, y: this.los + 1 }, { x: cx, y: this.los + 7 }], this.runCarrier?.me || this.mine === this.qb ? '#FFD84A' : 'rgba(255,90,90,.85)', [4, 3]); }
    if (play.boot) line([this.qb.home, { x: CX + 8 * play.boot, y: this.los - 4.5 }], 'rgba(120,170,255,.8)', [3, 3]);
    ctx.restore();
  }
  // 수비일 때: 내 배정(존·맨·러시)을 보여 줍니다
  drawAssignment(ctx) {
    const m = this.mine; if (!m?.asg) return;
    const a = m.asg, mx = m.home.x * PPY, my = this.sy(m.home.y);
    ctx.save(); ctx.lineWidth = 2;
    if (a.t === 'zone') {
      const [zx, zd] = ZONES[a.z], x = zx * PPY, y = this.sy(this.los + zd), deep = zd >= 13;
      ctx.fillStyle = deep ? 'rgba(70,130,235,.32)' : a.z.startsWith('flat') ? 'rgba(110,200,255,.32)' : a.z.startsWith('curl') ? 'rgba(170,110,235,.32)' : 'rgba(242,194,48,.32)';
      ctx.beginPath(); ctx.ellipse(x, y, deep ? 60 : 42, deep ? 26 : 20, 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#FFD84A'; ctx.stroke();
      ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(x, y); ctx.stroke();
    } else if (a.t === 'man') { const o = this.slotP(a.who); if (o) { ctx.strokeStyle = '#FFD84A'; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(o.home.x * PPY, this.sy(o.home.y) - 10); ctx.stroke(); } }
    else if (a.t === 'rush') { ctx.strokeStyle = '#FFD84A'; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(this.qb.home.x * PPY, this.sy(this.qb.home.y)); ctx.stroke(); }
    else if (a.t === 'spy') { ctx.strokeStyle = '#FF9F43'; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.arc(this.qb.home.x * PPY, this.sy(this.qb.home.y) - 8, 16, 0, Math.PI * 2); ctx.stroke(); }
    ctx.restore();
  }
  frameOf(p, now) {
    if (p.prone > 0 || p.diveT > 0 || (p.me && this.sk.diveT > 0)) return 'dive';
    if ((this.phase === 'idle' || this.phase === 'pre') && (p.role === 'OL' || p.role === 'DL')) return 'stance';
    if (p.throwT > 0) return 'throw';
    if (p.me && this.sk.callPose > 0) return 'catch'; // 손을 들고 공을 부르는 자세
    if (this.celebrate === p && this.phase !== 'live') return 'catch';
    const b = this.ball;
    if (b && b.T - b.t < .4 && p.role !== 'OL' && p.role !== 'DL' && Math.hypot(p.x - b.x, p.y - b.y) < 2.4) return 'catch';
    if (p.engaged || p.blocking > 0) return 'block';
    if (Math.hypot(p.vx, p.vy) < .8) return 'stand';
    return Math.floor(now / 110 + p.num) % 2 ? 'run0' : 'run1';
  }
  spriteOf(p, now, frame = this.frameOf(p, now)) {
    return playerSprite({ ...this.kits[p.team], skin: SKINS[p.skin], number: p.num, view: p.team === 'O' ? 'back' : 'front', frame, big: p.big, ball: this.carrier === p && this.phase !== 'idle' && this.phase !== 'pre', flip: frame === 'dive' && p.vx < 0 });
  }
  drawPlayer(ctx, p, now) {
    const sk = this.sk, frame = this.frameOf(p, now), spr = this.spriteOf(p, now, frame);
    const lift = p.me && (sk.jumpT > 0 || ((sk.catchType === 'high' || sk.defBall === 'int') && this.ball && this.ball.T - this.ball.t < .45)) ? 5 : 0;
    const fx = Math.round(p.x * PPY), fy = Math.round(this.sy(p.y));
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(fx - 6, fy - 1, 12, 2); ctx.fillRect(fx - 4, fy + 1, 8, 1);
    if (p.me) { ctx.strokeStyle = '#FFD84A'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(fx, fy, 10, 4, 0, 0, Math.PI * 2); ctx.stroke(); }
    const dx = fx - Math.floor(spr.width / 2), dy = fy - spr.height + 2 - lift;
    // 터보: 뒤로 흐르는 속도선
    if (p.me && sk.turboT > 0 && Math.hypot(p.vx, p.vy) > .8) { const n = Math.hypot(p.vx, p.vy), ux = -p.vx / n, uy = p.vy / n; ctx.fillStyle = 'rgba(255,216,74,.8)'; for (let i = 0; i < 4; i++) { const ox = fx + ux * (12 + i * 3) + (i - 1.5) * 3 * uy, oy = fy - 10 + uy * (12 + i * 3) - (i - 1.5) * 3 * ux; ctx.fillRect(Math.round(ox), Math.round(oy), 4, 1); } }
    ctx.drawImage(spr, dx, dy);
    if (p.me && sk.spinT > 0) { ctx.fillStyle = '#FFFFFF'; for (let i = 0; i < 6; i++) { const a = now / 45 + i * 1.05; ctx.fillRect(Math.round(fx + Math.cos(a) * 11), Math.round(fy - 10 + Math.sin(a) * 6), 2, 2); } }
    if (p.stun > 0 && !p.prone && p.team !== this.mine?.team) { ctx.fillStyle = '#FFD84A'; for (let i = 0; i < 3; i++) { const a = now / 120 + i * 2.1; ctx.fillRect(Math.round(fx + Math.cos(a) * 6), Math.round(dy - 3 + Math.sin(a) * 2), 2, 2); } }
    if (p.vsMe && this.phase !== 'done') { const bob = Math.floor(now / 200) % 2, y = dy - 9 - bob; ctx.fillStyle = OUT; ctx.fillRect(fx - 6, y - 1, 13, 3); ctx.fillStyle = '#FF5A5A'; for (let i = 0; i < 4; i++) ctx.fillRect(fx - 5 + i, y + i, 11 - i * 2, 1); }
    if (p.me) { const bob = Math.floor(now / 250) % 2, y = dy - 8 - bob; ctx.fillStyle = OUT; ctx.fillRect(fx - 5, y - 1, 11, 2); ctx.fillStyle = '#FFD84A'; for (let i = 0; i < 4; i++) ctx.fillRect(fx - 4 + i, y + i, 9 - i * 2, 1); }
  }
}
function gauss() { let u = 0, v = 0; while (!u) u = R(); while (!v) v = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
