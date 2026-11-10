// 키커·펀터 실시간 킥 (키커 뒤에서 내려다본 시점).
// new KickPlay(host, cfg)로 골대와 바람을 먼저 보여 주고, snap()으로 스냅 → 손가락으로 위로 쓸어 올려 찹니다.
// 끈 길이 = 파워(오른쪽 막대의 초록 구간에서 놓기, 빨강은 너무 세서 휘어짐), 기울기 = 방향. 바람은 직접 계산해야 합니다.
// cfg: { mode: 'fg'|'punt', dist(필드골 거리), start(펀트 스크리미지 라인, 자기 진영 기준), wind(km/h, +는 오른쪽),
//        me: { attrs, ovr }, colors, oppColors, last(마지막 승부 킥), hint }
import { pixelText, bigText, vivid, shade, OUT } from './pixel.js';

const CW = 160, CH = 210, HOR = 50, F = 300, CAM_H = 6, CAM_BACK = 16;
const G = 10.7, HALF_W = 26.65, UPRIGHT = 3.08, BAR = 3.33, UP_H = 11.7;
const SWIPE_CSS = 190; // 화면 css 픽셀: 이만큼 끌면 파워 100% (화면 크기와 상관없이 같은 손 길이)
const R = Math.random;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const gauss = () => { let u = 0, v = 0; while (!u) u = R(); while (!v) v = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

// 9×11 뒷모습/앞모습 선수 (외곽선 포함 11×13)
const FIG = ['...HHH...', '..HHHHH..', '..HHHHH..', '.JJJJJJJ.', 'JJJJJJJJJ', 'JJJJJJJJJ', '.JJJJJJJ.', '..PPPPP..', '..PP.PP..', '..PP.PP..', '..BB.BB..'];
const figCache = new Map();
function figure(helmet, stripe, kit, front, kneel = false) {
  const key = [helmet, stripe, kit, front, kneel].join('|');
  if (figCache.has(key)) return figCache.get(key);
  const rows = kneel ? [...FIG.slice(0, 7), '.PPPPPPP.', '.BB...BB.'] : FIG;
  const w = 11, h = rows.length + 2, cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d');
  const col = ch => ch === 'H' ? helmet : ch === 'J' ? kit : ch === 'P' ? '#E9ECEF' : ch === 'B' ? '#22262B' : null;
  // 외곽선
  ctx.fillStyle = OUT;
  rows.forEach((r, y) => [...r].forEach((ch, x) => { if (col(ch)) ctx.fillRect(x, y, 3, 3); }));
  rows.forEach((r, y) => [...r].forEach((ch, x) => { const c = col(ch); if (c) { ctx.fillStyle = c; ctx.fillRect(x + 1, y + 1, 1, 1); } }));
  ctx.fillStyle = stripe; ctx.fillRect(5, 1, 1, 3);                       // 헬멧 줄무늬
  ctx.fillStyle = shade(kit, -.25); ctx.fillRect(2, 7, 7, 1);              // 저지 밑단
  ctx.fillStyle = shade(helmet, .35); ctx.fillRect(4, 2, 1, 1);            // 헬멧 광택
  if (front) { ctx.fillStyle = '#C9CED6'; ctx.fillRect(4, 3, 3, 1); ctx.fillStyle = shade(kit, .45); ctx.fillRect(5, 5, 1, 2); } // 페이스마스크·앞번호
  else { ctx.fillStyle = shade(kit, .45); ctx.fillRect(4, 5, 1, 2); ctx.fillRect(6, 5, 1, 2); } // 등번호
  figCache.set(key, cv);
  return cv;
}

export class KickPlay {
  constructor(host, cfg) {
    this.host = host; this.cfg = cfg;
    host.innerHTML = `<canvas class="lp-canvas" width="${CW}" height="${CH}" aria-label="킥 화면"></canvas><div class="lp-tip" hidden></div>`;
    this.canvas = host.querySelector('canvas'); this.ctx = this.canvas.getContext('2d'); this.ctx.imageSmoothingEnabled = false;
    this.tipEl = host.querySelector('.lp-tip'); this.scale = 2.4; this.ch = CH; this.hor = HOR; this.fit();
    if (typeof ResizeObserver !== 'undefined') { this.ro = new ResizeObserver(() => this.fit()); this.ro.observe(host); }
    this.fg = cfg.mode === 'fg';
    // 필드 좌표 Y(0 = 우리 골라인, 100 = 상대 골라인), 공은 z = 0, 화면 안쪽이 +z
    this.spotY = this.fg ? 110 - cfg.dist : cfg.start - 15;
    this.losZ = this.fg ? 7 : 15;
    this.camZ = -CAM_BACK; this.camX = 0;
    this.phase = 'idle'; this.t = 0; this.msg = ''; this.msgT = 0; this.fx = [];
    this.ball = { x: 0, z: 0, h: this.fg ? .35 : 1, vx: 0, vz: 0, vh: 0 }; this.trail = [];
    this.kickT = -1; this.drag = null;
    // 라인 (우리 7명 + 상대 러셔)
    this.line = [-4.2, -2.8, -1.4, 0, 1.4, 2.8, 4.2].map(x => ({ x, z: this.losZ - .6 }));
    this.rush = [-5, -2.2, 0.6, 3.3, 5.6].map(x => ({ x, z: this.losZ + .9, x0: x }));
    this.stands = this.makeStands();
    this.bind();
    this.last = performance.now();
    this.loopFn = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loopFn);
  }
  snap() {
    this.phase = 'pre'; this.t = -.9; this.msg = ''; this.msgT = 0;
    this.rushT = this.fg ? 3.2 : 2.8;
    return new Promise(res => { this.done = res; });
  }
  pop(text, color, burst = false) { this.msg = text; this.msgColor = color; this.msgT = 1.6; if (burst) this.burst(); }
  destroy() { this.closed = true; cancelAnimationFrame(this.raf); this.ro?.disconnect(); clearTimeout(this.tipTimer); }
  // 화면에 꽉 차게: 세로로 긴 화면이면 캔버스를 늘리고 지평선을 내려 앞쪽 잔디를 더 보여 줍니다
  fit() {
    const w = this.host.clientWidth, h = this.host.clientHeight; if (!w || !h) return;
    const ch0 = clamp(Math.round(CW * h / w), CH, 320);
    if (ch0 !== this.ch) { this.ch = ch0; this.hor = HOR + Math.round((ch0 - CH) * .55); this.canvas.height = ch0; this.ctx.imageSmoothingEnabled = false; if (this.stands) this.stands = this.makeStands(); }
    const cw = Math.min(w, h * CW / this.ch), chh = cw * this.ch / CW;
    this.canvas.style.width = `${Math.round(cw)}px`; this.canvas.style.height = `${Math.round(chh)}px`; this.scale = chh / this.ch;
  }
  setInset() {}
  tip(text, sec = 3) { const el = this.tipEl; clearTimeout(this.tipTimer); el.textContent = text; el.hidden = !text; if (text) this.tipTimer = setTimeout(() => { el.hidden = true; }, sec * 1000); }
  // ───────── 입력 ─────────
  pt(e) { const r = this.canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) * CW / r.width, y: (e.clientY - r.top) * this.ch / r.height }; }
  bind() {
    const cv = this.canvas;
    cv.addEventListener('pointerdown', e => { e.preventDefault(); if (this.phase !== 'live') return; cv.setPointerCapture?.(e.pointerId); const p = this.pt(e); this.drag = { sx: p.x, sy: p.y, x: p.x, y: p.y }; });
    cv.addEventListener('pointermove', e => { if (!this.drag) return; const p = this.pt(e); this.drag.x = p.x; this.drag.y = p.y; });
    cv.addEventListener('pointerup', () => { const d = this.drag; this.drag = null; if (!d || this.phase !== 'live') return; const s = this.swipe(d); if (s.up < 12) return; this.kick(s.p, s.phi); });
    cv.addEventListener('pointercancel', () => { this.drag = null; });
  }
  swipe(d) {
    const up = d.sy - d.y, dx = d.x - d.sx;
    return { up, p: clamp(up * this.scale / SWIPE_CSS, 0, 1.3), phi: Math.atan2(dx, Math.max(8, up)) * .36 };
  }
  // ───────── 킥 ─────────
  kick(p, phi) {
    const c = this.cfg, a = c.me.attrs, ovr = c.me.ovr;
    const kpow = a.kpow ?? ovr, kacc = a.kacc ?? ovr, pnt = a.pnt ?? ovr, cons = a.cons ?? kacc, poise = a.poise ?? 60;
    const over = Math.max(0, p - 1), pp = Math.min(1, p);
    const maxR = this.fg ? 47 + (kpow - 50) * .55 : 47 + (kpow - 50) * .45 + (pnt - 60) * .15;
    let err = this.fg ? clamp(1.75 - kacc * .013, .35, 1.6) : clamp(2.6 - pnt * .018, .6, 2.4);
    err *= (1 + over * 7) * (1.12 - cons * .0025) * (c.last ? clamp(1.35 - poise * .005, .85, 1.3) : 1);
    const ang = phi + gauss() * err * Math.PI / 180;
    const th = ((this.fg ? 34 : 55) - over * 14) * Math.PI / 180;
    const range = maxR * (.38 + .62 * pp) * (1 - over * .1);
    const v = Math.sqrt(range * G / Math.sin(2 * th));
    Object.assign(this.ball, { x: 0, z: 0, h: this.fg ? .35 : 1, vx: v * Math.cos(th) * Math.sin(ang), vz: v * Math.cos(th) * Math.cos(ang), vh: v * Math.sin(th) });
    this.phase = 'flight'; this.kickT = 0; this.hang = 0; this.crossed = false; this.outX = null;
    this.power = p;
  }
  // ───────── 업데이트 ─────────
  loop(now) {
    if (this.closed) return;
    const dt = clamp((now - this.last) / 1000, 0, .05); this.last = now;
    this.update(dt);
    this.draw(now);
    this.raf = requestAnimationFrame(this.loopFn);
  }
  update(dt) {
    if (this.msgT > 0) { this.msgT -= dt; if (this.msgT <= 0) this.msg = ''; }
    if (this.kickT >= 0) this.kickT += dt;
    if (this.phase === 'idle' || this.phase === 'done') return;
    this.t += dt;
    if (this.phase === 'pre') { if (this.t >= 0) { this.phase = 'live'; this.t = 0; this.pop(this.fg ? 'KICK!' : 'PUNT!', '#FFD84A'); this.msgT = .6; } return; }
    if (this.phase === 'over') { this.endT -= dt; if (this.endT <= 0) this.finish(); return; }
    // 러셔가 몰려옵니다 (킥을 하면 그 자리에서 멈춤)
    if (this.phase === 'live') this.rushK = clamp(this.t / this.rushT, 0, 1);
    const rushK = this.rushK || 0;
    for (const r of this.rush) { r.z = this.losZ + .9 - rushK * (this.losZ - 2.6) * (Math.abs(r.x0) < 3 ? .45 : 1); r.x = r.x0 * (1 - rushK * .45); }
    if (this.phase === 'live') {
      if (this.t >= this.rushT) { this.pop('BLOCKED!', '#E85A5A'); return this.end({ blocked: true }); }
      return;
    }
    // 공 비행
    const b = this.ball, wind = (this.cfg.wind || 0) * .035;
    const pz = b.z, ph = b.h, px = b.x;
    b.vx += wind * dt; b.x += b.vx * dt; b.z += b.vz * dt; b.h += b.vh * dt; b.vh -= G * dt; this.hang += dt;
    this.trail.push({ x: b.x, z: b.z, h: b.h }); if (this.trail.length > 10) this.trail.shift();
    if (this.fg) {
      const zP = this.cfg.dist;
      if (!this.crossed && b.z >= zP) {
        this.crossed = true;
        const k = (zP - pz) / Math.max(.001, b.z - pz), hx = px + (b.x - px) * k, hh = ph + (b.h - ph) * k, ax = Math.abs(hx);
        const postHit = Math.abs(ax - UPRIGHT) <= .2 && hh > BAR - .1 && hh < BAR + UP_H;
        const barHit = ax < UPRIGHT && Math.abs(hh - BAR) < .22;
        let good, why = '';
        if (hh <= 0) { good = false; why = 'short'; }
        else if (postHit || barHit) { good = barHit ? hh >= BAR && R() < .6 : R() < .45; why = 'doink'; this.pop('DOINK!', '#FFFFFF'); if (!good) { b.vz *= -.25; b.vx *= barHit ? .3 : -.6; } else b.vz *= .5; }
        else { good = ax < UPRIGHT && hh > BAR; why = good ? '' : hh < BAR ? 'short' : hx < 0 ? 'left' : 'right'; }
        this.result = { good, why, doink: why === 'doink', offset: +hx.toFixed(2) };
        this.endAfter = .9;
      }
      if (b.h <= 0 && !this.crossed) { b.h = 0; this.result = { good: false, why: 'short' }; this.crossed = true; this.endAfter = .5; }
      if (this.crossed) {
        if (b.h <= 0) { b.h = 0; b.vh = Math.abs(b.vh) * .35; b.vz *= .5; b.vx *= .5; }
        this.endAfter -= dt;
        if (this.endAfter <= 0) {
          const r = this.result;
          if (r.good) this.pop(this.cfg.last ? 'IT IS GOOD!' : 'GOOD!', '#F2C230', true);
          else this.pop(r.why === 'short' ? 'SHORT!' : r.why === 'left' ? 'WIDE LEFT' : r.why === 'right' ? 'WIDE RIGHT' : 'NO GOOD', '#E85A5A');
          return this.end(r);
        }
      }
    } else {
      // 펀트: 카메라가 공을 따라갑니다
      this.camZ += (Math.max(-CAM_BACK, b.z - 16) - this.camZ) * clamp(dt * 2.2, 0, 1);
      this.camX += (clamp(b.x * .6, -14, 14) - this.camX) * clamp(dt * 2, 0, 1);
      if (this.outX === null && Math.abs(b.x) > HALF_W) this.outX = { z: b.z };
      if (b.h <= 0) {
        b.h = 0;
        const oob = this.outX !== null, landZ = oob ? this.outX.z : b.z, landY = this.spotY + landZ, losY = this.cfg.start;
        let tb = landY >= 100, ret = 0, fair = false, final;
        if (!tb && !oob) {
          fair = this.hang >= 4.2 || landY >= 86 || R() < .3;
          if (landY > 95 && R() < .5) tb = true;
          else if (!fair) ret = Math.max(0, Math.round(2 + R() * 14 - (this.hang - 3.8) * 6));
        }
        final = tb ? 80 : clamp(Math.round(landY - ret), losY + 1, 99);
        const gross = Math.round(Math.min(100, landY) - losY), net = final - losY, in20 = !tb && final >= 80;
        this.result = { gross: Math.max(0, gross), net, final, tb, oob, fair, ret, in20, hang: +this.hang.toFixed(1) };
        if (in20) this.pop('INSIDE 20!', '#F2C230', true);
        else if (tb) this.pop('TOUCHBACK', '#FFFFFF');
        else if (oob) this.pop('OUT OF BOUNDS', '#FFFFFF');
        else this.pop(`${Math.max(0, gross)} YARDS`, '#FFFFFF');
        b.vz = 0; b.vx = 0; b.vh = 0;
        return this.end(this.result, 1.5);
      }
    }
  }
  end(res, wait = 1.3) { if (this.phase === 'over' || this.phase === 'done') return; this.result = res; this.phase = 'over'; this.endT = wait; }
  finish() { this.phase = 'done'; const d = this.done; this.done = null; d?.(this.result); }
  burst() { for (let i = 0; i < 50; i++) { const a = R() * Math.PI * 2, v = .5 + R() * 1.6; this.fx.push({ x: CW / 2, y: this.ch * .3, vx: Math.cos(a) * v, vy: Math.sin(a) * v - .5, life: 50 + R() * 30, c: ['#F2C230', '#FFFFFF', '#E85A5A', '#6BD88A'][i % 4] }); } }
  // ───────── 그리기 ─────────
  proj(x, z, h) { const d = z - this.camZ; if (d < .4) return null; return { x: CW / 2 + F * (x - this.camX) / d, y: this.hor + F * (CAM_H - h) / d, d }; }
  makeStands() {
    const cv = document.createElement('canvas'); cv.width = CW; cv.height = this.hor; const ctx = cv.getContext('2d');
    for (let y = 0; y < this.hor; y++) { const k = y / this.hor; ctx.fillStyle = `rgb(${Math.round(14 + 20 * k)},${Math.round(22 + 30 * k)},${Math.round(44 + 40 * k)})`; ctx.fillRect(0, y, CW, 1); }
    // 관중석
    const top = this.hor - 22, colors = this.cfg.colors.concat(this.cfg.oppColors, ['#F2F2F2', '#D9C27A', '#8A93A6']).map(vivid);
    ctx.fillStyle = '#20262E'; ctx.fillRect(0, top, CW, 22);
    for (let y = top + 1; y < this.hor - 3; y += 2) for (let x = (y % 4) / 2; x < CW; x += 2) if (R() < .78) { ctx.fillStyle = colors[Math.floor(R() * colors.length)]; ctx.fillRect(x, y, 1, 1); }
    ctx.fillStyle = '#3A424D'; ctx.fillRect(0, this.hor - 3, CW, 3);
    // 조명탑
    for (const lx of [14, CW - 22]) { ctx.fillStyle = '#5A6270'; ctx.fillRect(lx + 3, 8, 2, top - 8); ctx.fillStyle = '#FFF6C8'; ctx.fillRect(lx, 4, 8, 4); ctx.fillStyle = 'rgba(255,246,200,.18)'; ctx.fillRect(lx - 4, 0, 16, 12); }
    return cv;
  }
  draw(now) {
    const ctx = this.ctx, c = this.cfg;
    ctx.drawImage(this.stands, 0, 0);
    // 잔디 (줄마다 깊이를 계산)
    const ez = vivid(c.oppColors[0]), ez0 = vivid(c.colors[0]);
    for (let sy = this.hor; sy < this.ch; sy++) {
      const d = F * CAM_H / (sy - this.hor + .5), Y = this.spotY + this.camZ + d, hw = F * HALF_W / d, cx = CW / 2 - F * this.camX / d;
      ctx.fillStyle = '#2B5E37'; ctx.fillRect(0, sy, CW, 1);
      ctx.fillStyle = Y > 110 ? '#20262E' : Y > 100 ? ez : Y < 0 ? ez0 : Math.floor(Y / 5) % 2 ? '#3E9A52' : '#368A49';
      ctx.fillRect(Math.round(cx - hw), sy, Math.round(hw * 2), 1);
      if (!this.fg && Y >= 80 && Y <= 100) { ctx.fillStyle = 'rgba(242,194,48,.16)'; ctx.fillRect(Math.round(cx - hw), sy, Math.round(hw * 2), 1); }
    }
    // 야드 라인과 숫자
    ctx.fillStyle = '#FFFFFF';
    for (let Y = 0; Y <= 110; Y += 5) {
      if (Y > 100 && Y !== 110) continue;
      const a = this.proj(-HALF_W, Y - this.spotY, 0), b = this.proj(HALF_W, Y - this.spotY, 0);
      if (!a || a.y < this.hor || a.y > this.ch) continue;
      ctx.fillRect(Math.round(a.x), Math.round(a.y), Math.round(b.x - a.x), Y === 100 || Y === 0 ? 2 : 1);
      if (Y % 10 === 0 && Y > 0 && Y < 100 && a.y > this.hor + 10) { const n = String(Y <= 50 ? Y : 100 - Y), l = this.proj(-HALF_W + 7, Y - this.spotY, 0), r = this.proj(HALF_W - 7, Y - this.spotY, 0); pixelText(ctx, n, Math.round(l.x) - 3, Math.round(l.y) - 6, '#FFFFFF'); pixelText(ctx, n, Math.round(r.x) - 3, Math.round(r.y) - 6, '#FFFFFF'); ctx.fillStyle = '#FFFFFF'; }
    }
    // 스크리미지 라인
    { const a = this.proj(-HALF_W, this.losZ, 0), b = this.proj(HALF_W, this.losZ, 0); if (a) { ctx.fillStyle = '#4A8CFF'; ctx.fillRect(Math.round(a.x), Math.round(a.y), Math.round(b.x - a.x), 1); } }
    // 골대 (Y = 110)
    this.drawPosts(ctx);
    // 공 그림자·선수·공 (먼 것부터)
    const items = [];
    const my = c.colors.map(vivid), op = c.oppColors.map(vivid);
    for (const r of this.rush) items.push({ z: r.z, f: () => this.drawFig(ctx, r.x, r.z, op[0], op[1], op[0], true) });
    for (const l of this.line) items.push({ z: l.z, f: () => this.drawFig(ctx, l.x, l.z, my[0], my[1], my[0], false) });
    if (this.fg) items.push({ z: .25, f: () => this.drawFig(ctx, -.9, .25, my[0], my[1], my[0], false, true) });
    // 키커: 공 뒤에서 달려와 찹니다
    const kk = this.kickT < 0 ? 0 : clamp(this.kickT / .22, 0, 1);
    const kx = this.fg ? -1.1 + kk * .9 : 0, kz = this.fg ? -2.4 + kk * 2.1 : -.9 + kk * .5;
    items.push({ z: kz, f: () => this.drawFig(ctx, kx, kz, my[0], my[1], my[0], false, false, this.kickT >= 0 && this.kickT < .5) });
    const b = this.ball;
    items.push({ z: b.z, f: () => this.drawBall(ctx, now) });
    items.sort((a, b2) => b2.z - a.z).forEach(i => i.f());
    // 조준선
    if (this.drag && this.phase === 'live') this.drawAim(ctx);
    // 바람
    this.drawWind(ctx);
    // 남은 시간 (러셔)
    if (this.phase === 'live') { const k = 1 - this.t / this.rushT; ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(40, this.ch - 7, 80, 4); ctx.fillStyle = k < .35 ? '#E85A5A' : '#FFD84A'; ctx.fillRect(40, this.ch - 7, Math.round(80 * k), 4); }
    // 파티클·글자
    this.fx = this.fx.filter(p => p.life-- > 0);
    for (const p of this.fx) { p.x += p.vx; p.y += p.vy; p.vy += .03; ctx.fillStyle = p.c; ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 2); }
    if (this.phase === 'pre') bigText(ctx, this.t < -.45 ? 'READY' : 'SET', CW / 2, this.ch * .36, '#FFFFFF', 3);
    else if (this.msg) bigText(ctx, this.msg, CW / 2, this.ch * .36, this.msgColor || '#FFFFFF', this.msg.length > 10 ? 2 : 3);
    if (this.phase === 'idle') { const bob = Math.floor(now / 300) % 2; bigText(ctx, this.fg ? `${c.dist} YD FG` : 'PUNT', CW / 2, this.ch * .36 - bob, '#FFD84A', 2); }
  }
  drawPosts(ctx) {
    const z = 110 - this.spotY, base = this.proj(0, z, 0), bar = this.proj(0, z, BAR);
    if (!base || base.y < 0) return;
    const w = Math.max(1, Math.round(F * .12 / base.d)), l = this.proj(-UPRIGHT, z, BAR), r = this.proj(UPRIGHT, z, BAR), lt = this.proj(-UPRIGHT, z, BAR + UP_H), rt = this.proj(UPRIGHT, z, BAR + UP_H);
    ctx.fillStyle = '#C8961A';
    ctx.fillRect(Math.round(base.x) - Math.floor(w / 2), Math.round(bar.y), w, Math.round(base.y - bar.y));
    ctx.fillStyle = '#F2C230';
    ctx.fillRect(Math.round(l.x), Math.round(l.y), Math.round(r.x - l.x) + w, w);
    ctx.fillRect(Math.round(l.x), Math.round(lt.y), w, Math.round(l.y - lt.y));
    ctx.fillRect(Math.round(r.x), Math.round(rt.y), w, Math.round(r.y - rt.y));
  }
  drawFig(ctx, x, z, helmet, stripe, kit, front, kneel = false, kicking = false) {
    const p = this.proj(x, z, 0); if (!p || p.y < this.hor - 4) return;
    const cv = figure(helmet, stripe, kit, front, kneel), s = clamp(Math.round(F * 1.9 / p.d / 13), 1, 4);
    const w = cv.width * s, h = cv.height * s, dx = Math.round(p.x - w / 2), dy = Math.round(p.y - h);
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(dx + s, Math.round(p.y) - s, w - 2 * s, s);
    ctx.drawImage(cv, dx, dy, w, h);
    if (kicking) { ctx.fillStyle = OUT; ctx.fillRect(dx + 6 * s, dy + 5 * s, 3 * s, 5 * s); ctx.fillStyle = '#E9ECEF'; ctx.fillRect(dx + 7 * s, dy + 6 * s, s, 3 * s); ctx.fillStyle = '#22262B'; ctx.fillRect(dx + 7 * s, dy + 5 * s, s, s); }
  }
  drawBall(ctx, now) {
    const b = this.ball, g = this.proj(b.x, b.z, 0), p = this.proj(b.x, b.z, b.h);
    if (!p) return;
    if (g && g.y >= this.hor) { ctx.fillStyle = 'rgba(0,0,0,.3)'; const r = Math.max(1, Math.round(F * .25 / g.d)); ctx.fillRect(Math.round(g.x - r), Math.round(g.y), r * 2, Math.max(1, Math.round(r / 2))); }
    // 꼬리
    if (this.phase === 'flight' || this.phase === 'over') for (const [i, t] of this.trail.entries()) { const q = this.proj(t.x, t.z, t.h); if (q) { ctx.fillStyle = `rgba(255,255,255,${.06 + i * .03})`; ctx.fillRect(Math.round(q.x), Math.round(q.y), 1, 1); } }
    const r = clamp(Math.round(F * .2 / p.d), 1, 5), spin = Math.floor(now / 70) % 2;
    ctx.fillStyle = OUT; ctx.fillRect(Math.round(p.x - r - 1), Math.round(p.y - r * .7 - 1), r * 2 + 2, Math.round(r * 1.4) + 2);
    ctx.fillStyle = '#8A4B22'; ctx.fillRect(Math.round(p.x - r), Math.round(p.y - r * .7), r * 2, Math.round(r * 1.4));
    if (r >= 2) { ctx.fillStyle = '#FFFFFF'; ctx.fillRect(Math.round(p.x) - (spin ? 1 : 0), Math.round(p.y) - 1, 1, 2); }
  }
  drawAim(ctx) {
    const s = this.swipe(this.drag), p = Math.min(1, s.p), over = s.p > 1;
    // 파워 막대 (오른쪽)
    const bx = CW - 10, by = this.hor + 34, bh = 100;
    ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(bx - 1, by - 1, 6, bh + 2);
    ctx.fillStyle = 'rgba(107,216,138,.45)'; ctx.fillRect(bx, by + Math.round(bh * (1 - 1)), 4, Math.round(bh * .18));
    ctx.fillStyle = over ? '#E85A5A' : p >= .82 ? '#6BD88A' : '#FFD84A';
    const fill = Math.round(bh * Math.min(1, s.p / 1.0));
    ctx.fillRect(bx, by + bh - fill, 4, fill);
    if (over) { ctx.fillStyle = '#E85A5A'; ctx.fillRect(bx - 2, by - 4, 8, 2); }
    // 조준선 (바람 미반영)
    const zEnd = this.fg ? this.cfg.dist : 40 * (.38 + .62 * p) + 8;
    ctx.save(); ctx.setLineDash([2, 3]); ctx.strokeStyle = over ? '#E85A5A' : '#FFD84A'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= 16; i++) { const z = zEnd * i / 16, q = this.proj(Math.tan(s.phi) * z, z, Math.min(6, z * .25) * (1 - i / 20)); if (!q) continue; i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); }
    ctx.stroke(); ctx.restore();
    bigText(ctx, over ? 'TOO HARD' : p >= .82 ? 'GOOD' : 'POWER', bx - 18, by + bh + 8, over ? '#E85A5A' : p >= .82 ? '#6BD88A' : '#FFFFFF', 1);
  }
  drawWind(ctx) {
    const w = this.cfg.wind || 0, s = w === 0 ? 'WIND 0' : `WIND ${Math.abs(w)}`;
    ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(4, 4, 52, 13);
    pixelText(ctx, s, 7, 8, '#FFFFFF');
    if (w) { const dir = Math.sign(w), x0 = 44, y = 10; ctx.fillStyle = '#FFD84A'; ctx.fillRect(x0 - 4, y, 9, 1); ctx.fillRect(dir > 0 ? x0 + 3 : x0 - 4, y - 1, 2, 3); ctx.fillRect(dir > 0 ? x0 + 5 : x0 - 6, y, 1, 1); }
  }
}
