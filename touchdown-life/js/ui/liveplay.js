// 실시간 플레이 (위에서 내려다본 필드, 공격은 위쪽으로 전진).
// new LivePlay(host, cfg)로 스냅 전 포메이션을 먼저 보여 주고, snap({ concept, defCall })로 한 플레이를 진행합니다.
// 플레이가 끝나도 마지막 장면과 글자 연출은 destroy() 전까지 계속 그려집니다.
// 조작: 손가락을 대고 끌면 내 선수가 그쪽으로 달립니다. 쿼터백이 공을 들고 있을 때 짧게 탭하면 그 지점으로 패스.
// 공을 든 채 짧게 탭하면 저크(순간 가속, 태클을 피할 확률 증가). 라인맨은 빨간 표시 러셔 앞을 막습니다.
// 키보드: 방향키로 이동, 스페이스로 가장 빈 리시버에게 패스.
import { pixelText, bigText, vivid, shade, OUT } from './pixel.js';

const FW = 53.3, CW = 160, CH = 210, PPY = CW / FW, EYE = .64;
const CX = FW / 2;
const R = Math.random;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const speedOf = rating => 4.7 + clamp(rating, 30, 99) * .052;

// 루트: [dx, dy] 경유점 (dx 양수 = 사이드라인 바깥쪽)
const ROUTES = {
  go: [[0, 32]], slant: [[0, 3], [-8, 12]], out: [[0, 9], [7, 9]], post: [[0, 11], [-8, 26]], curl: [[0, 12], [-1, 9]],
  corner: [[0, 10], [8, 21]], flat: [[5, 2], [11, 4]], drag: [[0, 2], [-22, 5]], seam: [[0, 26]], wheel: [[6, 1], [9, 6], [9, 30]], block: [],
};
// 공격 콘셉트: X(왼쪽 바깥), Z(오른쪽 바깥), SL(슬롯), TE, RB 루트 + 런 여부
export const CONCEPTS = [
  { id: 'flood', name: '플러드', note: '사이드라인 쪽 3단 루트', routes: { X: 'go', Z: 'out', SL: 'corner', TE: 'flat', RB: 'block' } },
  { id: 'verts', name: '포 버티컬', note: '네 명이 모두 깊게', routes: { X: 'go', Z: 'go', SL: 'seam', TE: 'seam', RB: 'block' } },
  { id: 'quick', name: '슬랜트-플랫', note: '빠르게 짧게', routes: { X: 'slant', Z: 'slant', SL: 'drag', TE: 'flat', RB: 'flat' } },
  { id: 'pa', name: '플레이 액션 딥', note: '런 페이크 뒤 한 방', routes: { X: 'post', Z: 'go', SL: 'curl', TE: 'drag', RB: 'block' }, fake: true },
  { id: 'run', name: '인사이드 런', note: '러닝백에게 핸드오프', routes: { X: 'block', Z: 'block', SL: 'block', TE: 'block', RB: 'run' }, run: true, hole: 0 },
  { id: 'sweep', name: '아웃사이드 스윕', note: '바깥으로 크게 돈다', routes: { X: 'block', Z: 'block', SL: 'block', TE: 'block', RB: 'run' }, run: true, hole: 1 },
  { id: 'screen', name: 'RB 스크린', note: '러닝백에게 짧게', routes: { X: 'go', Z: 'go', SL: 'curl', TE: 'block', RB: 'flat' }, screen: true },
  { id: 'wheel', name: 'RB 휠 루트', note: '러닝백이 사이드라인 딥', routes: { X: 'post', Z: 'curl', SL: 'drag', TE: 'flat', RB: 'wheel' } },
];
export const DEF_CALLS = [
  { id: 'man', name: '맨투맨 커버', note: '각자 마크맨을 따라간다' },
  { id: 'zone', name: '존 커버 3', note: '구역을 지키고 공에 반응' },
  { id: 'blitz', name: '블리츠', note: '라인배커가 쿼터백에게 돌진' },
];
export function conceptsFor(pos) {
  if (pos === 'QB') return CONCEPTS.filter(c => !['sweep', 'wheel'].includes(c.id));
  if (pos === 'OL') return ['run', 'sweep', 'quick', 'flood', 'pa', 'verts'].map(id => CONCEPTS.find(c => c.id === id));
  if (pos === 'RB') return CONCEPTS.filter(c => ['run', 'sweep', 'screen', 'wheel'].includes(c.id));
  return CONCEPTS.filter(c => !c.run && !['screen', 'wheel'].includes(c.id));
}
// 한 플레이만 돌리고 정리합니다 (개발 도구·밸런스 테스트용).
export function runLivePlay(host, cfg) { const lp = new LivePlay(host, cfg); return lp.snap({}).then(r => { lp.destroy(); return r; }); }

export class LivePlay {
  constructor(host, cfg) {
    this.host = host; this.cfg = { ...cfg };
    host.innerHTML = `<canvas class="lp-canvas" width="${CW}" height="${CH}" aria-label="실시간 플레이 필드"></canvas><p class="lp-hint">${cfg.hint || ''}</p>`;
    this.canvas = host.querySelector('canvas'); this.ctx = this.canvas.getContext('2d'); this.ctx.imageSmoothingEnabled = false;
    this.los = cfg.ball; this.first = Math.min(100, cfg.ball + cfg.toGo);
    this.t = 0; this.phase = 'idle'; this.ball = null; this.carrier = null; this.result = null; this.fx = []; this.msg = '';
    this.camY = this.los + 10; this.touch = null; this.keys = new Set(); this.juke = 0;
    this.stats = {}; this.setupTeams();
    this.bindInput();
    if (cfg.banner) { this.pop(cfg.banner, '#FFFFFF'); this.msgT = 1.4; }
    this.last = performance.now();
    this.loopFn = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loopFn);
  }
  // 작전이 정해지면 스냅. 결과는 Promise로 돌려줍니다.
  snap(opts = {}) {
    Object.assign(this.cfg, opts);
    this.assign();
    this.phase = 'pre'; this.t = this.cfg.side === 'O' ? -1.5 : -1.1; this.msg = ''; this.msgT = 0;
    return new Promise(res => { this.done = res; });
  }
  // ───────── 배치 ─────────
  setupTeams() {
    const c = this.cfg, L = this.los, P = [];
    const off = (role, x, y, rating, extra = {}) => P.push({ team: 'O', role, x, y, vx: 0, vy: 0, rating, spd: speedOf(rating), ...extra });
    const def = (role, x, y, rating, extra = {}) => P.push({ team: 'D', role, x, y, vx: 0, vy: 0, rating, spd: speedOf(rating), ...extra });
    const tr = c.teamRating, or = c.oppRating, j = () => (R() - .5) * 8;
    [-3.2, -1.6, 0, 1.6, 3.2].forEach((dx, i) => off('OL', CX + dx, L - 1, tr + j(), { ol: i }));
    off('QB', CX, L - 5, tr + j());
    off('RB', CX + 1.6, L - 7, tr + j());
    off('X', 4.5, L - 1, tr + j()); off('Z', FW - 4.5, L - 1, tr + j()); off('SL', FW - 13, L - 1.5, tr + j()); off('TE', CX + 5.4, L - 1, tr + j());
    [-6, -2, 2, 6].forEach((dx, i) => def('DL', CX + dx, L + 1, or + j(), { dl: i }));
    def('LB', CX - 8, L + 5, or + j()); def('LB', CX, L + 5.5, or + j(), { mike: true }); def('LB', CX + 8, L + 5, or + j());
    def('CB', 4.5, L + 6, or + j(), { man: 'X' }); def('CB', FW - 4.5, L + 6, or + j(), { man: 'Z' });
    def('S', CX - 9, L + 13, or + j(), { deep: -1 }); def('S', CX + 9, L + 13, or + j(), { deep: 1 });
    // 포지션별 몸놀림: 라인맨은 느리고 스킬 포지션은 빠르게
    const ROLE_SPD = { OL: .74, DL: .8, QB: .9, LB: .92, TE: .93, RB: 1, X: 1, Z: 1, SL: 1, CB: 1, S: .98 };
    for (const p of P) p.spd *= ROLE_SPD[p.role] ?? 1;
    this.P = P;
    // 내 선수
    const me = c.me, mine = this.pick(c.control);
    if (mine) { Object.assign(mine, { me: true, rating: me.ovr, attrs: me.attrs, spd: (speedOf(me.attrs.spd ?? me.attrs.mob ?? me.attrs.agi ?? me.ovr) + .3) * ({ OL: .74, DL: .8, QB: .9, LB: .92, TE: .93 }[mine.role] ?? 1) }); this.mine = mine; }
    // 라인맨: 맞상대 러셔(가장 바깥 DL)를 빨간 표시로
    if (c.control === 'OL') { const dl = P.filter(p => p.role === 'DL').sort((a, b) => a.x - b.x)[0]; if (dl) dl.vsMe = true; }
  }
  // 작전·수비 콜 배정 (스냅 직전)
  assign() {
    const c = this.cfg, P = this.P;
    const concept = c.concept || CONCEPTS[0];
    this.concept = concept;
    for (const p of P.filter(x => x.team === 'O' && ['X', 'Z', 'SL', 'TE', 'RB'].includes(x.role))) {
      const name = concept.routes[p.role] || 'block', side = p.x < CX ? -1 : 1;
      p.routeName = name;
      p.route = (ROUTES[name] || []).map(([dx, dy]) => ({ x: clamp(p.x + dx * side, 1.5, FW - 1.5), y: p.y + dy }));
      p.wp = 0;
    }
    // 수비 콜
    this.call = c.defCall || (R() < .5 ? 'man' : R() < .6 ? 'zone' : 'blitz');
    if (this.call === 'blitz') this.P.filter(p => p.role === 'LB' && !p.me).slice(0, 2).forEach(p => p.blitz = true);
    // 포켓 시간: 공격 라인이 버티는 시간 (라인 전력 차이 반영). 이 시간 전에는 AI 러셔가 포켓을 무너뜨리지 못합니다.
    this.pocket = clamp(3.1 + (c.teamRating - c.oppRating) * .04 + (R() - .5) * .8, 2.2, 4.6);
  }
  pick(role) {
    if (role === 'OL') return this.P.find(p => p.role === 'OL' && p.ol === 0);
    if (role === 'DL') return this.P.find(p => p.role === 'DL' && p.dl === (this.cfg.edge ? 3 : 1));
    if (role === 'LB') return this.P.find(p => p.mike);
    if (role === 'CB') return this.P.find(p => p.role === 'CB' && p.man === 'Z');
    if (role === 'S') return this.P.find(p => p.role === 'S' && p.deep === 1);
    if (role === 'TE') return this.P.find(p => p.role === 'TE');
    if (role === 'WR') return this.P.find(p => p.role === 'Z');
    return this.P.find(p => p.role === role);
  }
  // ───────── 입력 ─────────
  toField(e) {
    const r = this.canvas.getBoundingClientRect(), px = (e.clientX - r.left) * CW / r.width, py = (e.clientY - r.top) * CH / r.height;
    return { x: px / PPY, y: this.camY + (CH * EYE - py) / PPY, px, py };
  }
  bindInput() {
    const cv = this.canvas;
    cv.addEventListener('pointerdown', e => { e.preventDefault(); cv.setPointerCapture?.(e.pointerId); const f = this.toField(e); this.touch = { ...f, sx: f.px, sy: f.py, t: performance.now(), moved: false, down: true }; });
    cv.addEventListener('pointermove', e => { if (!this.touch?.down) return; const f = this.toField(e); Object.assign(this.touch, { x: f.x, y: f.y }); if (Math.hypot(f.px - this.touch.sx, f.py - this.touch.sy) > 5) this.touch.moved = true; });
    const up = e => { if (!this.touch) return; const quick = !this.touch.moved && performance.now() - this.touch.t < 320; const f = this.toField(e); this.touch.down = false; if (quick) this.tap(f); this.touch = null; };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', () => { this.touch = null; });
    this.onKey = e => { const k = e.key; if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(k)) { e.preventDefault(); if (e.type === 'keydown') { this.keys.add(k); if (k === ' ') this.autoThrow(); } else this.keys.delete(k); } };
    window.addEventListener('keydown', this.onKey); window.addEventListener('keyup', this.onKey);
  }
  tap(f) {
    if (this.phase !== 'live') return;
    const m = this.mine;
    if (m && m.role === 'QB' && this.carrier === m && !this.ball && m.y < this.los + .5) return this.throwTo(f.x, f.y, m);
    if (m && this.carrier === m) { this.juke = .45; m.vx += (f.x > m.x ? 1 : -1) * 4; }
  }
  autoThrow() {
    if (this.phase !== 'live' || !this.mine || this.mine.role !== 'QB' || this.carrier !== this.mine || this.ball) return;
    const t = this.bestTarget(); if (t) this.throwTo(t.x + t.vx * .8, t.y + t.vy * .8, this.mine);
  }
  // ───────── 패스 ─────────
  eligible() { return this.P.filter(p => p.team === 'O' && ['X', 'Z', 'SL', 'TE', 'RB'].includes(p.role) && p.routeName !== 'block'); }
  openness(p) { const d = Math.min(...this.P.filter(x => x.team === 'D').map(x => dist(x, p))); return d + Math.max(0, p.y - this.los) * .04; }
  bestTarget(prefer = null) {
    const list = this.eligible().map(p => ({ p, o: this.openness(p) + (p === prefer ? 1.2 : 0) })).sort((a, b) => b.o - a.o);
    return list[0]?.p || null;
  }
  flightTime(qb, p) { const arm = qb.me ? (this.cfg.me.attrs.arm ?? this.cfg.me.ovr) : this.cfg.teamRating, d = dist(qb, p) * 1.15; return .3 + d / (13 + arm * .15); }
  throwTo(tx, ty, qb) {
    const c = this.cfg, arm = qb.me ? (c.me.attrs.arm ?? c.me.ovr) : c.teamRating, acc = qb.me ? (c.me.attrs.acc ?? c.me.ovr) : c.teamRating;
    const d = Math.hypot(tx - qb.x, ty - qb.y), pressure = this.P.some(p => p.team === 'D' && dist(p, qb) < 2.4) ? 1.7 : 1;
    const err = Math.max(.15, (1.7 - acc * .013) * pressure * (d / 18)), a = R() * Math.PI * 2, e = Math.abs(gauss()) * err;
    const lx = clamp(tx + Math.cos(a) * e, -1, FW + 1), ly = ty + Math.sin(a) * e;
    const speed = 13 + arm * .15, T = .3 + d / speed;
    this.ball = { sx: qb.x, sy: qb.y, x: lx, y: ly, t: 0, T, h: 5 + d * .45, from: qb };
    this.carrier = null; this.thrown = true;
    if (qb.me) this.inc('att');
    this.target = this.eligible().reduce((b, p) => dist(p, { x: lx, y: ly }) < dist(b, { x: lx, y: ly }) ? p : b, this.eligible()[0]);
    if (this.target?.me) this.inc('tgt');
    this.msg = '';
  }
  inc(k, v = 1) { this.stats[k] = (this.stats[k] || 0) + v; }
  // ───────── 업데이트 ─────────
  loop(now) {
    if (this.closed) return;
    const dt = clamp((now - this.last) / 1000, 0, .05); this.last = now;
    for (let i = 0; i < (this.cfg.speedup || 1); i++) this.update(dt);
    this.draw(now);
    this.raf = requestAnimationFrame(this.loopFn);
  }
  seek(p, tx, ty, dt, k = 1, accel = 12) {
    const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy) || 1, v = p.spd * k * (p.engaged ? (p.y > this.los + 4 ? .42 : .16) : 1) * (p.stun > 0 ? .2 : 1);
    const want = d < .3 ? 0 : 1, vx = dx / d * v * want, vy = dy / d * v * want;
    if (p.engaged) { p.vx *= .5; p.vy *= .5; }
    p.vx += clamp(vx - p.vx, -accel * dt, accel * dt); p.vy += clamp(vy - p.vy, -accel * dt, accel * dt);
  }
  update(dt) {
    if (this.msgT > 0) { this.msgT -= dt; if (this.msgT <= 0) this.msg = ''; }
    if (this.phase === 'idle' || this.phase === 'done') return;
    this.t += dt;
    if (this.phase === 'pre') { if (this.t >= 0) { this.phase = 'live'; this.msg = 'HUT!'; this.msgT = .7; this.carrier = this.pick('QB'); } return; }
    if (this.phase === 'over') { this.endT -= dt; if (this.endT <= 0) this.finish(); return; }
    const c = this.cfg, P = this.P, qb = this.pick('QB'), car = this.carrier;
    // 핸드오프 / 스크린
    if (this.concept.run && car === qb && this.t > .45) {
      const rb = this.pick('RB'); this.carrier = rb;
      if (this.mine === qb) { qb.me = false; rb.me = true; this.mine = rb; this.switched = true; } else this.inc2(rb, 'ratt');
    }
    // AI 쿼터백 패스
    if (!this.ball && car === qb && !qb.me && !this.concept.run) {
      // 라인맨으로 뛸 때는 쿼터백이 공을 더 오래 들고 있어 블로킹이 결과를 가릅니다
      const olMode = this.cfg.control === 'OL' && !this.concept.screen;
      const wait = olMode ? 1.9 : this.concept.fake ? 1.2 : this.concept.screen ? 1.05 : 1.1;
      const prefer = this.mine && this.mine.team === 'O' ? this.mine : null;
      const best = this.concept.screen ? this.pick('RB') : this.bestTarget(prefer);
      if (best && this.t > wait && (this.openness(best) > 2.3 || this.t > (olMode ? Math.min(3.3, this.pocket) : 2.8))) {
        if (!this.concept.screen && this.t > 2.8 && this.openness(best) < 1.3 && R() < .6) { this.thrown = true; if (qb.me) this.inc('att'); this.pop('THROWN AWAY', '#FFFFFF'); return this.endPlay({ incomplete: true, text: '패스를 버렸다' }); }
        const lead = this.flightTime(qb, best); this.throwTo(best.x + best.vx * lead, best.y + best.vy * lead, qb);
      }
    }
    if (!this.ball && car === qb && this.t > 5.5) { this.endPlay({ incomplete: true, text: '패스를 버렸다' }); return; }
    // 블로킹 판정을 먼저: 공격 블로커 1.15야드 안의 수비는 묶입니다 (그 프레임 이동이 느려짐).
    for (const p of P) { if (p.stun > 0) p.stun -= dt; p.engaged = false; }
    for (const d of P.filter(p => p.team === 'D')) {
      const db = d.role === 'CB' || d.role === 'S';
      const near = P.filter(o => o.team === 'O' && (!d.vsMe || o.me || this.concept.run) && !(db && o.role === 'OL') && (o.role === 'OL' || (this.carrier && this.carrier !== o && ['TE', 'X', 'Z', 'SL', 'RB'].includes(o.role) && (o.routeName === 'block' || this.thrown))) && dist(o, d) < 1.1);
      const blocker = near.find(o => o.me) || near[0];
      if (!blocker || (d.me && this.juke > 0)) continue;
      // 묶여 있는 동안에도 초당 일정 확률로 떨쳐 냅니다 (능력치 차이·내 선수 보정)
      const open = d.y > this.los + 4;
      const bR = blocker.me ? (this.concept.run ? (c.me.attrs.rblk ?? c.me.ovr) : (c.me.attrs.pblk ?? c.me.ovr)) : blocker.rating;
      d.shed = (d.shed || 0) + dt * ((open ? 1.1 : .35) + Math.max(0, d.rating - bR) * .02 + (d.me ? .35 : 0) + (d.vsMe ? .15 : 0));
      if (d.shed > 1 + R() * .6) { d.shed = 0; d.stunFree = .45; continue; }
      if (!(d.stunFree > 0)) { d.engaged = true; if (blocker.me) this.myBlockT = (this.myBlockT || 0) + dt; }
    }
    for (const p of P) if (p.stunFree > 0) p.stunFree -= dt;
    // 이동
    for (const p of P) {
      if (p.me) { this.moveMe(p, dt); continue; }
      this.ai(p, dt, qb);
    }
    for (const p of P) { p.x += p.vx * dt; p.y += p.vy * dt; p.x = clamp(p.x, -1.5, FW + 1.5); }
    if (this.juke > 0) this.juke -= dt;
    // 공 비행
    if (this.ball) {
      const b = this.ball; b.t += dt;
      if (b.t >= b.T) return this.resolveCatch();
    }
    const carrier = this.carrier;
    if (carrier) {
      // 사이드라인 아웃
      if (carrier.x < 0 || carrier.x > FW) return this.endPlay({ gain: carrier.y - this.los, text: '사이드라인 밖으로' });
      if (carrier.y >= 100) return this.endPlay({ gain: 100 - this.los, td: true, text: '터치다운!' });
      // 태클
      for (const d of P.filter(x => x.team === 'D' && !(x.stun > 0) && !x.engaged)) {
        if (dist(d, carrier) < (carrier.y > this.los + 3 ? 1.05 : .8)) {
          const sackish = carrier === qb && carrier.y < this.los + .3 && !this.thrown;
          const elusive = carrier.me ? ((carrier.attrs?.agi ?? carrier.rating) + (carrier.attrs?.str ?? carrier.rating)) / 2 : carrier.rating;
          const tk = d.me ? (c.me.attrs.tkl ?? c.me.ovr) : d.rating;
          const pBreak = clamp((carrier.me ? .16 : .09) + (elusive - tk) * .006 + (carrier.me && this.juke > 0 ? .25 : 0) - (sackish ? .08 : 0), .03, .55);
          if (R() < pBreak) { d.stun = .55; this.pop('BROKEN TACKLE', '#FFFFFF'); continue; }
          if (sackish) { if (d.me) { this.inc('sack'); this.inc('tkl'); } return this.endPlay({ gain: carrier.y - this.los, sack: true, sacker: d, text: '색!' }); }
          const fumble = R() < clamp(.03 - ((carrier.attrs?.carry ?? 60) - 60) * .0006, .008, .05);
          if (d.me) { this.inc('tkl'); if (carrier.y < this.los) this.inc('tfl'); if (fumble) this.inc('ff'); }
          if (fumble) return this.endPlay({ gain: carrier.y - this.los, turnover: 'FUMBLE', text: '펌블!' });
          return this.endPlay({ gain: carrier.y - this.los, text: '태클' });
        }
      }
    }
    // 카메라
    const fy = this.ball ? this.ball.sy + (this.ball.y - this.ball.sy) * (this.ball.t / this.ball.T) : (carrier || qb).y;
    this.camY += (fy + 9 - this.camY) * clamp(dt * 3, 0, 1);
  }
  inc2(p, k, v = 1) { if (p?.me) this.inc(k, v); }
  moveMe(p, dt) {
    let tx = null, ty = null;
    if (this.touch?.down && (this.touch.moved || performance.now() - this.touch.t > 160)) { tx = this.touch.x; ty = this.touch.y; }
    const k = this.keys, kx = (k.has('ArrowRight') ? 1 : 0) - (k.has('ArrowLeft') ? 1 : 0), ky = (k.has('ArrowUp') ? 1 : 0) - (k.has('ArrowDown') ? 1 : 0);
    if (kx || ky) { tx = p.x + kx * 6; ty = p.y + ky * 6; }
    const boost = this.juke > 0 ? 1.25 : 1;
    if (tx !== null) return this.seek(p, tx, ty, dt, (this.carrier === p ? .97 : 1) * boost, 22);
    // 손을 떼면: 공을 들고 있으면 계속 앞으로, 아니면 AI가 느리게 도와줌
    if (this.carrier === p && p.role !== 'QB') return this.seek(p, p.x + p.vx * .2, p.y + 6, dt, .9, 10);
    if (p.role === 'QB' && this.carrier === p) return this.seek(p, p.x, p.y, dt, 1, 14);
    this.ai(p, dt, this.pick('QB'), this.cfg.assist ?? (p.role === 'OL' ? .3 : .6)); // assist: 개발 도구용 (손을 뗐을 때 AI가 돕는 정도)
  }
  ai(p, dt, qb, k = 1) {
    const car = this.carrier, ball = this.ball;
    if (p.team === 'O') {
      if (p === car) {
        if (p.role === 'QB' && !this.concept.run && !this.thrown) { const back = this.concept.fake ? this.los - 7 : this.los - 6.5; return this.seek(p, p.x, back, dt, .7 * k); }
        // 볼 캐리어 AI: 앞으로, 가까운 수비는 피해서
        const near = this.P.filter(d => d.team === 'D' && d.y > p.y - 1 && dist(d, p) < 5).sort((a, b) => dist(a, p) - dist(b, p))[0];
        this.holeX ??= this.concept.hole ? (R() < .5 ? CX - 7.5 : CX + 7.5) : CX + (R() < .5 ? -2.4 : 2.4);
        const hole = this.concept.run && p.y < this.los + 1.5 && this.t < 1.8 ? this.holeX : p.x;
        const avoid = near ? (p.x - near.x) * 1.4 : 0;
        return this.seek(p, clamp(hole + avoid, 1, FW - 1), p.y + 8, dt, (this.thrown ? .88 : .95) * k);
      }
      if (ball && p === this.target) return this.seek(p, ball.x, ball.y, dt, k, 22);
      const pocketPass = car === qb && !this.thrown && !this.concept.run;
      if (car && car !== p && !pocketPass) {
        // 블로커: 볼 캐리어 앞의 가장 가까운 수비에게
        const d = this.P.filter(x => x.team === 'D' && x.y > car.y - 2).sort((a, b) => dist(a, car) - dist(b, car))[p.role === 'OL' ? p.ol % 3 : 0];
        if (d && (p.role === 'OL' || p.routeName === 'block' || this.thrown)) return this.seek(p, d.x, Math.min(d.y - .6, p.role === 'OL' ? this.los + 5 : 999), dt, .85 * k);
      }
      if (p.role === 'OL' || (p.routeName === 'block' && ['RB', 'TE'].includes(p.role) && car === qb)) {
        // 패스 프로텍션: 맡은 러셔와 QB 사이를 막아섭니다. 태클(양 끝)은 바깥 러셔, 가운데는 안쪽 러셔, RB·TE는 남는 블리처
        const rushers = this.P.filter(x => x.team === 'D' && (x.role === 'DL' || x.blitz)).sort((a, b) => a.x - b.x);
        let r = null;
        if (p.role === 'OL') r = rushers.length ? rushers[Math.round(p.ol * (rushers.length - 1) / 4)] : null;
        else r = rushers.filter(x => !x.vsMe && !this.P.some(o => o.role === 'OL' && dist(o, x) < 1.3)).sort((a, b) => dist(a, qb) - dist(b, qb))[0];
        if (!r) return this.seek(p, p.x, Math.min(p.y, this.los - .8), dt, .6 * k);
        const d = dist(r, qb) || 1, tx = r.x + (qb.x - r.x) / d * .9, ty = r.y + (qb.y - r.y) / d * .9;
        return this.seek(p, tx, Math.min(ty, this.los - .3), dt, k, 16);
      }
      if (p.route && p.wp < p.route.length) { const w = p.route[p.wp]; if (dist(p, w) < 1) p.wp++; return this.seek(p, w.x, w.y, dt, k); }
      if (p.routeName === 'curl' || p.routeName === 'out') return this.seek(p, p.x, p.y, dt, k);
      return this.seek(p, p.x, p.y + 4, dt, .5 * k);
    }
    // 수비
    if (ball) { const lx = ball.x, ly = ball.y, deepBall = ly > this.los + 15, r = p.role === 'S' ? (deepBall ? 15 : 9) : 7; if (Math.hypot(lx - p.x, ly - p.y) < r && ball.t > .35) return this.seek(p, lx, ly, dt, k); }
    if (this.concept.run && this.t < .72 && p.role !== 'DL') return this.seek(p, p.x, p.y + (p.role === 'CB' ? .5 : 0), dt, k); // 런인지 읽는 시간
    // 라인맨 모드의 맞상대: 바깥으로 크게 돌아 쿼터백을 노립니다
    if (p.vsMe && car === qb && !this.thrown && !this.concept.run) {
      // 정해진 러시 레인(태클 바깥)으로 돌다가, 내 라인맨이 바깥을 막으면 가끔 안쪽으로 꺾습니다. 지나간 뒤에는 쿼터백에게 곧장.
      const m = this.mine;
      p.laneX ??= m.x - 2; p.counter ??= R() < .3;
      const past = p.y < m.y - .4 || p.y <= this.los - 3;
      const inside = p.counter && m.x < p.laneX + .6;
      return this.seek(p, past ? qb.x : inside ? m.x + 1.8 : p.laneX, past ? qb.y : this.los - 3.2, dt, 1.04 * k);
    }
    // 러셔는 쿼터백이 포켓에 있는 동안 포켓 시계를 따릅니다 (아래)
    const rushing = (p.role === 'DL' || p.blitz) && car === qb && !this.thrown && !this.concept.run && car.y <= this.los;
    if (car && !rushing && (car !== qb || this.concept.run || p.role === 'DL' || p.blitz || car.y > this.los)) {
      const lead = Math.min(.9, dist(p, car) / 9);
      return this.seek(p, car.x + car.vx * lead, car.y + car.vy * lead, dt, k);
    }
    if (p.role === 'DL' || p.blitz) {
      const pt = this.pocket * (p.blitz ? .78 : 1);
      if (this.t < pt && !this.thrown && car === qb) { const d = dist(p, qb), v = Math.max(0, d - 1.7) / Math.max(.25, pt - this.t); return this.seek(p, qb.x, qb.y, dt, Math.min(1, (v + .4) / p.spd) * k); }
      return this.seek(p, qb.x, qb.y, dt, .95 * k);
    }
    const man = p.man ? this.pick(p.man) : null;
    if (p.role === 'CB' && man && this.call !== 'zone') { const deep = man.y > this.los + 11; return this.seek(p, man.x - man.vx * (deep ? .1 : .22), man.y - man.vy * (deep ? 0 : .22) + (deep ? 1.4 : .6), dt, k); }
    if (p.role === 'S' || (p.role === 'CB' && this.call === 'zone')) {
      const zoneX = p.role === 'S' ? (this.call === 'zone' && p.deep === 1 ? CX : CX + p.deep * 12) : (p.x < CX ? 6 : FW - 6);
      const deepest = this.eligible().filter(o => Math.sign(o.x - CX) === Math.sign(zoneX - CX) || this.call === 'zone').sort((a, b) => b.y - a.y)[0];
      const ty = Math.max(this.los + (p.role === 'S' ? 14 : 8), (deepest?.y || 0) + (p.role === 'S' ? 4 : 2));
      return this.seek(p, deepest && deepest.y > this.los + 8 ? deepest.x : zoneX, ty, dt, .9 * k);
    }
    if (p.role === 'LB') { const te = this.pick(p.x < CX ? 'RB' : 'TE'); const zx = this.call === 'man' && te ? te.x : p.x, zy = this.call === 'man' && te ? te.y + 1 : this.los + 6; return this.seek(p, zx, zy, dt, .8 * k); }
    return this.seek(p, p.x, p.y, dt, k);
  }
  resolveCatch() {
    const b = this.ball, spot = { x: b.x, y: b.y }, c = this.cfg;
    this.ball = null;
    const near = this.P.filter(p => !(p.stun > 0)).map(p => ({ p, d: dist(p, spot) })).sort((a, b2) => a.d - b2.d);
    const off = near.find(x => x.p.team === 'O' && x.p.role !== 'OL' && x.p.role !== 'QB'), def = near.find(x => x.p.team === 'D');
    const reachO = off ? 1.6 + ((off.p.me ? c.me.attrs.hands ?? c.me.ovr : off.p.rating) - 60) * .012 : 0;
    const reachD = def ? 1.05 + ((def.p.me ? c.me.attrs.ball ?? c.me.attrs.cov ?? c.me.ovr : def.p.rating) - 60) * .008 : 0;
    const qbMe = b.from.me;
    this.dbg = { offD: off && +off.d.toFixed(2), defD: def && +def.d.toFixed(2), reachO: +reachO.toFixed(2), who: off?.p.role, T: +b.T.toFixed(2) };
    if (def && def.d < reachD && (!off || def.d < off.d - .2)) {
      const ball = def.p.me ? (c.me.attrs.ball ?? c.me.attrs.cov ?? c.me.ovr) : def.p.rating;
      if (R() < clamp(.17 + (ball - 60) * .006 + (def.p.me ? .2 : 0), .08, .7)) {
        if (qbMe) this.inc('pint');
        if (def.p.me) { this.inc('dint'); this.inc('pd'); }
        const six = def.p.me && R() < .22; if (six) this.inc('dtd');
        this.pop(six ? 'PICK SIX!' : 'INTERCEPTED', '#E85A5A');
        return this.endPlay({ gain: 0, turnover: 'INT', pickSix: six, text: six ? '픽식스!' : '인터셉트!' });
      }
      if (def.p.me) this.inc('pd');
      this.pop('BROKEN UP', '#FFFFFF');
      return this.endPlay({ incomplete: true, text: '패스 디펜스' });
    }
    if (off && off.d < reachO + .9) {
      const contested = def && def.d < 1.3, diving = off.d >= reachO;
      const hands = off.p.me ? (c.me.attrs.hands ?? c.me.ovr) : off.p.rating;
      if (R() < clamp(.84 + (hands - 60) * .005 - (contested ? .25 : 0), .3, .97) * (diving ? .45 : 1)) {
        if (diving) { off.p.stun = .5; this.divingCatch = true; }
        this.carrier = off.p; this.catchY = off.p.y;
        if (qbMe) this.inc('cmp');
        if (off.p.me) this.inc('rec');
        if (this.mine?.team === 'O' && !off.p.me) { /* 쿼터백이면 받은 선수를 조작합니다 */ if (this.mine.role === 'QB') { this.mine.me = false; off.p.me = true; this.mine = off.p; this.switched = true; } }
        this.pop(this.divingCatch ? 'DIVING CATCH!' : 'CATCH!', '#F2C230');
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
    const car = this.carrier, passPlay = this.thrown && !o.incomplete && !o.turnover && !o.sack;
    o.gain = Math.round(o.gain ?? 0);
    if (this.cfg.control === 'OL') {
      if (o.sack && o.sacker?.vsMe) this.inc('sa');
      else if (!o.sack && (this.myBlockT || 0) > 1.6 && R() < .45) this.inc('pan');
    }
    if (o.sacker) this.dbg = { ...(this.dbg || {}), sacker: `${o.sacker.role}${o.sacker.dl ?? ''}${o.sacker.vsMe ? '*' : ''}${o.sacker.blitz ? 'B' : ''}@${this.t.toFixed(1)}` };
    delete o.sacker;
    // 스탯 정리
    if (o.td && car?.team === 'O') { if (this.thrown) { if (this.cfg.control === 'QB') this.inc('ptd'); if (car.me && this.cfg.control !== 'QB') this.inc('rectd'); } else if ((car.me && !this.switched) || (this.cfg.control === 'QB' && car.role === 'QB')) this.inc('rtd'); }
    if (passPlay && this.cfg.control === 'QB') this.inc('pyds', o.gain);
    if (passPlay && car?.me && this.cfg.control !== 'QB') this.inc('recyds', o.gain);
    if (!this.thrown && car?.me && !o.sack && !this.switched) { this.inc('ryds', o.gain); if (!this.stats.ratt) this.inc('ratt'); }
    if (!this.thrown && this.cfg.control === 'QB' && car?.role === 'QB' && !o.sack && o.gain) { this.inc('ryds', o.gain); this.inc('ratt'); }
    if (o.td) { this.pop('TOUCHDOWN!', '#F2C230'); this.burst(); }
    else if (o.sack) this.pop('SACK!', this.cfg.side === 'D' ? '#F2C230' : '#E85A5A');
    else if (o.turnover === 'FUMBLE') this.pop('FUMBLE!', '#E85A5A');
    else if (!o.incomplete && !o.turnover && o.gain >= this.cfg.toGo) this.pop('FIRST DOWN', '#FFD84A');
    this.result = { ...o, stats: this.stats, thrown: this.thrown, myTouch: !!car?.me, dbg: this.dbg };
  }
  burst() { for (let i = 0; i < 50; i++) { const a = R() * Math.PI * 2, v = .5 + R() * 1.6; this.fx.push({ x: CW / 2, y: CH * .35, vx: Math.cos(a) * v, vy: Math.sin(a) * v - .5, life: 50 + R() * 30, c: ['#F2C230', '#FFFFFF', '#E85A5A', '#6BD88A'][i % 4] }); } }
  finish() {
    this.phase = 'done';
    const done = this.done; this.done = null;
    done?.(this.result || { gain: 0, incomplete: true, stats: this.stats });
  }
  destroy() {
    this.closed = true; cancelAnimationFrame(this.raf);
    window.removeEventListener('keydown', this.onKey); window.removeEventListener('keyup', this.onKey);
  }
  // ───────── 그리기 ─────────
  sy(y) { return CH * EYE - (y - this.camY) * PPY; }
  draw(now) {
    const ctx = this.ctx, c = this.cfg;
    for (let py = 0; py < CH; py++) {
      const Y = this.camY + (CH * EYE - py) / PPY;
      ctx.fillStyle = Y > 100 ? vivid(c.endzone[1]) : Y < 0 ? vivid(c.endzone[0]) : Math.floor(Y / 5) % 2 ? '#3E9A52' : '#368A49';
      ctx.fillRect(0, py, CW, 1);
    }
    ctx.fillStyle = '#FFFFFF';
    for (let y = 0; y <= 100; y += 5) { const py = Math.round(this.sy(y)); if (py < -2 || py > CH + 2) continue; ctx.fillRect(0, py, CW, 1); if (y % 10 === 0 && y > 0 && y < 100) { const n = y <= 50 ? y : 100 - y, s = String(n); pixelText(ctx, s, 8, py - 2, '#FFFFFF'); pixelText(ctx, s, CW - 8 - s.length * 4, py - 2, '#FFFFFF'); } }
    for (let y = 1; y < 100; y++) { const py = Math.round(this.sy(y)); if (py >= 0 && py < CH) { ctx.fillRect(Math.round(23.6 * PPY), py, 2, 1); ctx.fillRect(Math.round(29.7 * PPY), py, 2, 1); } }
    for (const [y, t] of [[105, 'ENDZONE'], [-5, 'ENDZONE']]) { const py = this.sy(y); if (py > -10 && py < CH + 10) pixelText(ctx, t, CW / 2 - 13, Math.round(py) - 2, '#FFFFFF'); }
    // 라인
    const los = Math.round(this.sy(this.los)), fd = Math.round(this.sy(this.first));
    ctx.fillStyle = '#4A8CFF'; ctx.fillRect(0, los, CW, 2);
    if (this.first < 100) { ctx.fillStyle = '#FFD84A'; ctx.fillRect(0, fd, CW, 2); }
    // 작전 그림: 스냅 전에는 우리 팀 루트를 보여 줍니다 (내 루트는 노랑)
    if (this.phase === 'pre' && c.side === 'O') this.drawRoutes(ctx);
    // 공 착지 지점
    if (this.ball) { const b = this.ball, px = b.x * PPY, py = this.sy(b.y), r = 3 + Math.sin(now / 90); ctx.strokeStyle = '#FFD84A'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(px, py, r + 2, r, 0, 0, Math.PI * 2); ctx.stroke(); }
    // 선수 (아래쪽부터)
    const order = [...this.P].sort((a, b) => b.y - a.y);
    for (const p of order) this.drawPlayer(ctx, p, now);
    // 공
    if (this.ball) {
      const b = this.ball, k = b.t / b.T, gx = b.sx + (b.x - b.sx) * k, gy = b.sy + (b.y - b.sy) * k, h = 4 * b.h * k * (1 - k);
      const px = Math.round(gx * PPY), py = Math.round(this.sy(gy));
      ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(px - 1, py, 3, 1);
      ctx.fillStyle = OUT; ctx.fillRect(px - 2, py - h - 1, 5, 3); ctx.fillStyle = '#8A4B22'; ctx.fillRect(px - 1, py - h, 3, 1);
    }
    // 파티클·글자
    this.fx = this.fx.filter(p => p.life-- > 0);
    for (const p of this.fx) { p.x += p.vx; p.y += p.vy; p.vy += .03; ctx.fillStyle = p.c; ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 2); }
    if (this.phase === 'pre') bigText(ctx, this.t < -.5 ? 'READY' : 'SET', CW / 2, CH * .3, '#FFFFFF', 3);
    else if (this.msg) bigText(ctx, this.msg, CW / 2, CH * .3, this.msgColor || '#FFFFFF', this.msg.length > 10 ? 2 : 3);
    if (this.phase === 'idle' && this.mine) {
      const m = this.mine, px = Math.round(m.x * PPY), py = Math.round(this.sy(m.y));
      const bob = Math.floor(now / 300) % 2;
      bigText(ctx, 'YOU', clamp(px, 10, CW - 10), py - 18 - bob, '#FFD84A', 1);
    }
  }
  drawRoutes(ctx) {
    ctx.save(); ctx.lineWidth = 1; ctx.setLineDash([2, 2]);
    for (const p of this.P.filter(x => x.team === 'O')) {
      let pts = null;
      if (p.route?.length) pts = [p, ...p.route];
      else if (p.role === 'RB' && this.concept.run) { const hx = this.concept.hole ? CX + (p.x < CX ? -9 : 9) : CX + 2.4; pts = [p, { x: hx, y: this.los + 1 }, { x: hx, y: this.los + 7 }]; }
      if (!pts) continue;
      ctx.strokeStyle = p.me ? '#FFD84A' : 'rgba(255,255,255,.6)';
      ctx.beginPath(); pts.forEach((q, i) => { const x = q.x * PPY, y = this.sy(q.y); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke();
      const a = pts.at(-1), b = pts.at(-2), ang = Math.atan2(this.sy(a.y) - this.sy(b.y), (a.x - b.x) * PPY), ax = a.x * PPY, ay = this.sy(a.y);
      ctx.setLineDash([]); ctx.beginPath(); ctx.moveTo(ax - Math.cos(ang - .5) * 4, ay - Math.sin(ang - .5) * 4); ctx.lineTo(ax, ay); ctx.lineTo(ax - Math.cos(ang + .5) * 4, ay - Math.sin(ang + .5) * 4); ctx.stroke(); ctx.setLineDash([2, 2]);
    }
    ctx.restore();
  }
  drawPlayer(ctx, p, now) {
    const c = this.cfg, colors = p.team === 'O' ? c.offColors : c.defColors, [c1, c2] = colors.map(vivid);
    const x = Math.round(p.x * PPY) - 3, y = Math.round(this.sy(p.y)) - 9, moving = Math.hypot(p.vx, p.vy) > .8, f = moving && Math.floor(now / 120 + p.x) % 2;
    if (p.me) { ctx.fillStyle = 'rgba(255,216,74,.55)'; ctx.fillRect(x - 1, y + 8, 9, 3); }
    ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fillRect(x, y + 9, 7, 1);
    // 다리
    ctx.fillStyle = '#ECEEF1';
    if (p.stun > 0) { ctx.fillRect(x, y + 7, 7, 2); } else if (f) { ctx.fillRect(x + 1, y + 7, 2, 2); ctx.fillRect(x + 4, y + 6, 2, 2); } else { ctx.fillRect(x + 1, y + 6, 2, 2); ctx.fillRect(x + 4, y + 7, 2, 2); }
    // 몸
    ctx.fillStyle = OUT; ctx.fillRect(x - 1, y + 3, 9, 4);
    // 원정 팀은 흰 유니폼(헬멧만 팀 색) — 초록 필드에서 두 팀이 잘 구분되게
    const kit = p.team === c.away ? '#F2F2F2' : c1, trim = p.team === c.away ? c1 : c2;
    ctx.fillStyle = kit; ctx.fillRect(x, y + 3, 7, 4); ctx.fillStyle = shade(kit, -.25); ctx.fillRect(x, y + 6, 7, 1); ctx.fillStyle = trim; ctx.fillRect(x + 3, y + 4, 1, 2);
    // 헬멧
    ctx.fillStyle = OUT; ctx.fillRect(x + 1, y - 1, 5, 5);
    ctx.fillStyle = c1; ctx.fillRect(x + 1, y, 5, 3); ctx.fillStyle = shade(c1, .3); ctx.fillRect(x + 2, y, 1, 1);
    ctx.fillStyle = c2; ctx.fillRect(x + 3, y - 1, 1, 3);
    if (p.team === 'D') { ctx.fillStyle = '#C9CED6'; ctx.fillRect(x + 2, y + 3, 3, 1); }
    // 공
    if (this.carrier === p && this.phase !== 'pre') { ctx.fillStyle = OUT; ctx.fillRect(x + 6, y + 3, 3, 3); ctx.fillStyle = '#8A4B22'; ctx.fillRect(x + 6, y + 4, 2, 1); }
    // 라인맨 모드: 막아야 할 러셔
    if (p.vsMe && this.phase !== 'done') { const bob = Math.floor(now / 200) % 2; ctx.fillStyle = OUT; ctx.fillRect(x - 1, y - 8 - bob, 9, 2); ctx.fillStyle = '#FF5A5A'; ctx.fillRect(x, y - 8 - bob, 7, 1); ctx.fillRect(x + 1, y - 7 - bob, 5, 1); ctx.fillRect(x + 2, y - 6 - bob, 3, 1); ctx.fillRect(x + 3, y - 5 - bob, 1, 1); }
    // 내 선수 표시
    if (p.me) { const bob = Math.floor(now / 250) % 2; ctx.fillStyle = '#FFD84A'; ctx.fillRect(x + 2, y - 5 - bob, 3, 1); ctx.fillRect(x + 3, y - 4 - bob, 1, 1); }
  }
}
function gauss() { let u = 0, v = 0; while (!u) u = R(); while (!v) v = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
