// 실시간 플레이용 고해상도 도트: 선수 15×19(외곽선 포함 17×21, 라인맨은 어깨가 더 넓음)와 6픽셀/야드 필드.
// 공격은 등(등번호), 수비는 앞(페이스마스크·앞번호)을 보입니다. 모든 그림은 한 번 그려 캐시합니다.
import { bigText, vivid, shade, lum, OUT } from './pixel.js';

// ───────── 선수 ─────────
const DIG = { 0: '111101101111', 1: '010110010111', 2: '111001110111', 3: '111011001111', 4: '101101111001', 5: '111110001110', 6: '100111101111', 7: '111001010010', 8: '111111101111', 9: '111101111001' };
export const SKINS = ['#F1C9A5', '#E3B086', '#C98E62', '#9E6C45', '#70492D'];
const BALL = '#8A4B22', LACE = '#F4F1EA', MASK = '#C4CAD2', CLEAT = '#1E2126', EYE = '#23262B';
const cache = new Map();

function grid(w, h) { return { w, h, d: new Array(w * h).fill(null) }; }
function put(g, x, y, c) { if (c && x >= 0 && y >= 0 && x < g.w && y < g.h) g.d[y * g.w + x] = c; }
function rect(g, x0, y0, x1, y1, c) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) put(g, x, y, c); }
const at = (g, x, y) => x >= 0 && y >= 0 && x < g.w && y < g.h && g.d[y * g.w + x];
// 칸 그림 → 캔버스 (바깥 1픽셀 외곽선 자동)
function toCanvas(g, flip = false) {
  const cv = document.createElement('canvas'); cv.width = g.w + 2; cv.height = g.h + 2;
  const ctx = cv.getContext('2d');
  const X = x => flip ? g.w - 1 - x : x;
  ctx.fillStyle = OUT;
  for (let y = -1; y <= g.h; y++) for (let x = -1; x <= g.w; x++) if (!at(g, x, y) && (at(g, x - 1, y) || at(g, x + 1, y) || at(g, x, y - 1) || at(g, x, y + 1))) ctx.fillRect(X(x) + 1, y + 1, 1, 1);
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) { const c = g.d[y * g.w + x]; if (c) { ctx.fillStyle = c; ctx.fillRect(X(x) + 1, y + 1, 1, 1); } }
  return cv;
}
function digits(g, n, cx, y, color) {
  const s = String(n ?? '').slice(-2); if (!s) return;
  const xs = s.length === 1 ? [cx - 1] : [cx - 3, cx + 1];
  [...s].forEach((ch, i) => { const m = DIG[ch]; if (!m) return; for (let k = 0; k < 12; k++) if (m[k] === '1') put(g, xs[i] + k % 3, y + Math.floor(k / 3), color); });
}
// frame: stand · run0 · run1 · stance · throw · catch · block · dive
export function playerSprite(o) {
  const key = [o.jersey, o.num, o.helmet, o.stripe, o.pants, o.socks, o.skin, o.number, o.view, o.frame, o.big ? 1 : 0, o.ball ? 1 : 0, o.flip ? 1 : 0].join('|');
  let cv = cache.get(key); if (cv) return cv;
  cv = o.frame === 'dive' ? divePic(o) : bodyPic(o);
  cache.set(key, cv);
  return cv;
}
function bodyPic(o) {
  const g = grid(15, 19), cx = 7, f = o.frame, front = o.view === 'front';
  const sh = o.big ? 6 : 5, tw = sh - 1, hp = o.big ? 4 : 3;
  const J = o.jersey, Js = shade(J, -.22), Jh = shade(J, .2), H = o.helmet, Hs = shade(H, -.32), Hh = shade(H, .4), P = o.pants, Ps = shade(P, -.22), K = o.socks, S = o.skin, Sd = shade(S, -.2);
  const st = f === 'stance', y0 = st ? 2 : 0;
  // 다리
  const leg = (x0, x1, top, len) => { rect(g, x0, top, x1, top, P); for (let i = 1; i < len - 1; i++) rect(g, x0, top + i, x1, top + i, K); rect(g, x0, top + len - 1, x1, top + len - 1, CLEAT); };
  if (st) { leg(cx - hp - 1, cx - 2, 16, 3); leg(cx + 2, cx + hp + 1, 16, 3); }
  else if (f === 'run0') { leg(cx - hp, cx - 1, 16, 2); leg(cx + 1, cx + hp, 16, 3); }
  else if (f === 'run1') { leg(cx - hp, cx - 1, 16, 3); leg(cx + 1, cx + hp, 16, 2); }
  else { leg(cx - hp, cx - 1, 16, 3); leg(cx + 1, cx + hp, 16, 3); }
  // 바지
  rect(g, cx - hp, 13 + (st ? 1 : 0), cx + hp, 15, P); rect(g, cx - hp, 13 + (st ? 1 : 0), cx + hp, 13 + (st ? 1 : 0), Ps); put(g, cx, 15, Ps);
  put(g, cx - hp, 14, o.stripe); put(g, cx + hp, 14, o.stripe);
  // 몸통·어깨
  rect(g, cx - tw, 9 + y0, cx + tw, 12 + y0 - (st ? 1 : 0), J); rect(g, cx + tw, 9 + y0, cx + tw, 12 + y0 - (st ? 1 : 0), Js); rect(g, cx - tw, 12 + y0 - (st ? 1 : 0), cx + tw, 12 + y0 - (st ? 1 : 0), Js);
  rect(g, cx - sh + 1, 7 + y0, cx + sh - 1, 7 + y0, J); rect(g, cx - sh, 8 + y0, cx + sh, 8 + y0, J);
  rect(g, cx - sh + 1, 7 + y0, cx - 2, 7 + y0, Jh);
  put(g, cx - sh, 8 + y0, o.stripe); put(g, cx + sh, 8 + y0, o.stripe);
  digits(g, o.number, cx, 9 + y0, o.num);
  // 목
  rect(g, cx - 1, 6 + y0, cx + 1, 6 + y0, front ? Sd : Js);
  // 헬멧
  rect(g, cx - 2, y0, cx + 2, y0, H); rect(g, cx - 3, 1 + y0, cx + 3, 4 + y0, H); rect(g, cx - 2, 5 + y0, cx + 2, 5 + y0, Hs);
  rect(g, cx + 3, 2 + y0, cx + 3, 4 + y0, Hs); put(g, cx - 2, 1 + y0, Hh); put(g, cx - 1, 1 + y0, Hh); put(g, cx - 3, 2 + y0, Hh);
  for (let y = 0; y <= (front ? 2 : 4); y++) put(g, cx, y + y0, o.stripe);
  if (front) { put(g, cx - 2, 3 + y0, MASK); put(g, cx - 1, 3 + y0, EYE); put(g, cx, 3 + y0, S); put(g, cx + 1, 3 + y0, EYE); put(g, cx + 2, 3 + y0, MASK); rect(g, cx - 2, 4 + y0, cx + 2, 4 + y0, MASK); rect(g, cx - 1, 5 + y0, cx + 1, 5 + y0, MASK); }
  else { put(g, cx - 3, 4 + y0, Hs); put(g, cx + 3, 4 + y0, Hs); }
  // 팔
  const arm = (x, top, len) => { put(g, x, top, J); for (let i = 1; i < len; i++) put(g, x, top + i, i === len - 1 ? Sd : S); };
  const L = cx - sh, Rr = cx + sh;
  if (f === 'throw') { arm(L, 9 + y0, 3); put(g, Rr, 7, J); put(g, Rr, 6, J); rect(g, Rr, 2, Rr, 5, S); put(g, Rr, 1, Sd); }
  else if (f === 'catch') { for (const x of [L, Rr]) { put(g, x, 7, J); put(g, x, 6, J); rect(g, x, 2, x, 5, S); put(g, x, 1, '#F2F2F2'); } }
  else if (f === 'block') { if (front) { arm(L, 8 + y0, 2); arm(Rr, 8 + y0, 2); rect(g, cx - 3, 10 + y0, cx - 2, 10 + y0, S); rect(g, cx + 2, 10 + y0, cx + 3, 10 + y0, S); } else { arm(L, 8 + y0, 3); arm(Rr, 8 + y0, 3); } }
  else if (f === 'run0') { arm(L, 8 + y0, 3); arm(Rr, 10 + y0, 3); }
  else if (f === 'run1') { arm(L, 10 + y0, 3); arm(Rr, 8 + y0, 3); }
  else if (st) { arm(L, 9 + y0, 3); put(g, Rr - 1, 11 + y0, J); rect(g, Rr - 1, 12 + y0, Rr - 1, 17, S); }
  else { arm(L, 9 + y0, 3); arm(Rr, 9 + y0, 3); }
  // 공 들기
  if (o.ball && f !== 'throw' && f !== 'catch') { rect(g, cx + tw - 1, 10 + y0, cx + tw + 1, 11 + y0, BALL); put(g, cx + tw, 10 + y0, LACE); put(g, Rr, 11 + y0, S); }
  if (o.ball && f === 'catch') { rect(g, cx - 1, 0, cx + 1, 1, BALL); put(g, cx, 0, LACE); }
  return toCanvas(g);
}
// 다이브·넘어짐: 가로로 누운 모습 (기본 오른쪽을 향함)
function divePic(o) {
  const g = grid(21, 11), J = o.jersey, Js = shade(J, -.22), H = o.helmet, Hs = shade(H, -.32), P = o.pants, S = o.skin;
  rect(g, 0, 4, 0, 6, CLEAT); rect(g, 1, 4, 2, 6, o.socks); rect(g, 3, 3, 6, 7, P); rect(g, 7, 2, 14, 8, J); rect(g, 7, 8, 14, 8, Js);
  digits(g, o.number, 11, 3, o.num);
  rect(g, 15, 2, 19, 7, H); rect(g, 15, 7, 19, 7, Hs); rect(g, 17, 2, 17, 4, o.stripe);
  if (o.view === 'front') rect(g, 20, 4, 20, 6, MASK);
  rect(g, 14, 0, 19, 0, S); rect(g, 14, 10, 18, 10, S);
  if (o.ball) { rect(g, 18, 8, 20, 9, BALL); put(g, 19, 8, LACE); }
  return toCanvas(g, o.flip);
}
// 공 (회전 2프레임)
export function ballSprite(frame = 0) {
  const key = 'ball' + frame; let cv = cache.get(key); if (cv) return cv;
  const g = grid(6, 4); rect(g, 1, 0, 4, 3, BALL); rect(g, 0, 1, 5, 2, BALL);
  if (frame) { put(g, 2, 1, LACE); put(g, 3, 1, LACE); } else { put(g, 2, 2, LACE); put(g, 3, 1, LACE); }
  cv = toCanvas(g); cache.set(key, cv); return cv;
}

// ───────── 필드 ─────────
// 필드 그림은 Y_TOP(150야드)~Y_BOT(-40야드), 가로는 사이드라인 바깥 SIDE야드까지. 1야드 = PPY 픽셀
export const PPY = 6, SIDE = 4, FW = 53.3, Y_TOP = 150, Y_BOT = -40;
export const FIELD_W = Math.round((FW + SIDE * 2) * PPY), FIELD_H = (Y_TOP - Y_BOT) * PPY;
const hex = c => { const n = parseInt(c.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
export function fieldCanvas(o) {
  const key = 'field|' + [o.endzone, o.home, o.benchL, o.benchR].flat().join('|');
  let cv = cache.get(key); if (cv) return cv;
  cv = document.createElement('canvas'); cv.width = FIELD_W; cv.height = FIELD_H;
  const ctx = cv.getContext('2d');
  const fx = x => Math.round((x + SIDE) * PPY), fy = Y => Math.round((Y_TOP - Y) * PPY);
  // 1) 바탕: 잔디 무늬 + 작은 노이즈 (픽셀 단위)
  const img = ctx.createImageData(FIELD_W, FIELD_H), d = img.data;
  const ez0 = hex(vivid(o.endzone[0])), ez1 = hex(vivid(o.endzone[1]));
  const stripeA = [63, 155, 81], stripeB = [56, 142, 73], apron = [44, 108, 60], wall = [27, 33, 41];
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let py = 0; py < FIELD_H; py++) {
    const Y = Y_TOP - (py + .5) / PPY;
    for (let px = 0; px < FIELD_W; px++) {
      const x = (px + .5) / PPY - SIDE, i = (py * FIELD_W + px) * 4;
      let c;
      const inX = x >= 0 && x <= FW;
      if (Y > 113 || Y < -13) c = wall;
      else if (!inX || Y > 110 || Y < -10) c = apron;
      else if (Y > 100) c = (Math.floor((px + py) / 6) % 2) ? ez1 : ez1.map(v => v * .88);
      else if (Y < 0) c = (Math.floor((px - py) / 6) % 2) ? ez0 : ez0.map(v => v * .88);
      else c = Math.floor(Y / 5) % 2 ? stripeA : stripeB;
      const n = c === wall ? 0 : (rnd() - .5) * 12;
      d[i] = c[0] + n; d[i + 1] = c[1] + n; d[i + 2] = c[2] + n; d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  // 2) 관중석 (엔드라인 뒤) — 팀 색 점들
  const crowd = [...o.endzone, ...(o.benchL || []), ...(o.benchR || []), '#F2F2F2', '#D9C27A', '#8A93A6', '#C25B5B'].map(vivid);
  for (const [a, b] of [[113.5, Y_TOP], [Y_BOT, -13.5]]) {
    for (let Y = a; Y < b; Y += .34) for (let x = -SIDE; x < FW + SIDE; x += .34) if (rnd() < .62) { ctx.fillStyle = crowd[Math.floor(rnd() * crowd.length)]; ctx.fillRect(fx(x), fy(Y), 1, 1); }
    // 좌석 줄
    ctx.fillStyle = 'rgba(0,0,0,.25)'; for (let Y = a; Y < b; Y += 1.5) ctx.fillRect(0, fy(Y), FIELD_W, 1);
  }
  ctx.fillStyle = '#3A424D'; ctx.fillRect(0, fy(113.5), FIELD_W, 3); ctx.fillRect(0, fy(-13.5) - 3, FIELD_W, 3);
  // 3) 흰 선: 사이드라인·엔드라인·골라인·5야드 라인·해시
  const W = '#F4F4F0';
  ctx.fillStyle = W;
  ctx.fillRect(fx(0) - 2, fy(110), 2, fy(-10) - fy(110)); ctx.fillRect(fx(FW), fy(110), 2, fy(-10) - fy(110));
  for (const Y of [110, -10]) ctx.fillRect(fx(0) - 2, fy(Y) - 1, fx(FW) - fx(0) + 4, 2);
  for (const Y of [100, 0]) ctx.fillRect(fx(0), fy(Y) - 1, fx(FW) - fx(0), 2);
  ctx.globalAlpha = .92;
  for (let Y = 5; Y < 100; Y += 5) ctx.fillRect(fx(0), fy(Y), fx(FW) - fx(0), 1);
  for (let Y = 1; Y < 100; Y++) { if (Y % 5 === 0) continue; for (const x of [.6, 23.6, 29.1, FW - 1.1]) ctx.fillRect(fx(x), fy(Y), 3, 1); }
  ctx.globalAlpha = 1;
  // 4) 야드 숫자와 방향 화살표
  for (let Y = 10; Y <= 90; Y += 10) {
    const n = String(Y <= 50 ? Y : 100 - Y), py = fy(Y);
    for (const x of [8.5, FW - 8.5]) {
      bigText(ctx, n, fx(x), py, 'rgba(244,244,240,.92)', 2, null);
      if (Y !== 50) { // 가까운 골라인 쪽을 가리키는 삼각형
        const down = Y < 50, ax = fx(x) - 15; ctx.fillStyle = 'rgba(244,244,240,.92)';
        for (let i = 0; i < 3; i++) ctx.fillRect(ax - 2 + i, py + (down ? i - 1 : 1 - i), 5 - i * 2, 1);
      }
    }
  }
  // 5) 미드필드 로고: 홈 팀 색 원 + 별
  { const c1 = vivid(o.home[0]), c2 = vivid(o.home[1]), cx = fx(FW / 2), cy = fy(50), r = 4.2 * PPY;
    ctx.fillStyle = c2; ctx.beginPath(); ctx.arc(cx, cy, r + 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = c1; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = lum(c1) > .6 ? shade(c1, -.5) : '#FFFFFF'; ctx.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * .38 : r * .82; ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
    ctx.closePath(); ctx.fill(); }
  // 6) 엔드존 글씨 줄무늬 테두리 + 파일론
  for (const [Y, c] of [[105, o.endzone[1]], [-5, o.endzone[0]]]) { const t = vivid(c); bigText(ctx, 'END ZONE', fx(FW / 2), fy(Y), lum(t) > .6 ? shade(t, -.55) : '#FFFFFF', 3, null); }
  ctx.fillStyle = '#FF7A1A';
  for (const Y of [110, 100, 0, -10]) for (const x of [0, FW]) ctx.fillRect(fx(x) - 2, fy(Y) - 2, 4, 4);
  // 7) 골대 (엔드라인 뒤, 화면 위쪽으로 세워 그림)
  for (const Y of [110, -10]) {
    const by = fy(Y + (Y > 0 ? 1 : -1)), cx = fx(FW / 2), half = Math.round(3.08 * PPY);
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(cx - half + 4, by + 2, half * 2, 2);
    ctx.fillStyle = '#C8961A'; ctx.fillRect(cx - 1, by - 18, 3, 18);
    ctx.fillStyle = '#F2C230'; ctx.fillRect(cx - half, by - 20, half * 2 + 1, 3); ctx.fillRect(cx - half, by - 64, 3, 46); ctx.fillRect(cx + half - 2, by - 64, 3, 46);
  }
  // 8) 팀 벤치 (30야드 라인 사이, 사이드라인 바깥)
  for (const [x0, colors] of [[-3.6, o.benchL], [FW + 1.7, o.benchR]]) {
    if (!colors) continue;
    ctx.fillStyle = 'rgba(20,26,32,.55)'; ctx.fillRect(fx(x0), fy(68), Math.round(1.9 * PPY), fy(32) - fy(68));
    const [a, b] = colors.map(vivid);
    for (let Y = 33; Y < 67; Y += .9) { const px = fx(x0) + 2 + Math.floor(rnd() * 7), py = fy(Y); ctx.fillStyle = OUT; ctx.fillRect(px - 1, py - 1, 5, 6); ctx.fillStyle = a; ctx.fillRect(px, py, 3, 2); ctx.fillStyle = rnd() < .5 ? b : a; ctx.fillRect(px, py + 2, 3, 2); ctx.fillStyle = '#ECEAE4'; ctx.fillRect(px, py + 4, 3, 1); }
  }
  // 코치 박스 노란 선
  ctx.fillStyle = '#E5B53C'; for (const x of [-1.6, FW + 1.3]) ctx.fillRect(fx(x), fy(68), 2, fy(32) - fy(68));
  cache.set(key, cv);
  return cv;
}
