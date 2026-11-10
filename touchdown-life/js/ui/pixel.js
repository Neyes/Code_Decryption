// 픽셀 아트: 문자열 격자로 그린 스프라이트와 절차적으로 그린 배경을 캔버스에 찍어 data URL로 돌려줍니다.
// 모두 이 게임을 위해 새로 그린 그림입니다. 결과는 키별로 캐시합니다.
const cache = new Map();
const has = () => typeof document !== 'undefined';

// ───────── 색 ─────────
const hex = c => { const n = parseInt(c.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const toHex = ([r, g, b]) => '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const shade = (c, k) => toHex(hex(c).map(v => k < 0 ? v * (1 + k) : v + (255 - v) * k));
const lum = c => { const [r, g, b] = hex(c); return (r * .299 + g * .587 + b * .114) / 255; };
// 너무 어두운 팀 색은 헬멧이 검은 덩어리로 보이지 않게 살짝 밝힙니다.
const vivid = c => lum(c) < .12 ? shade(c, .18) : c;
const SKIN = ['#F6D3B3', '#E8B48C', '#C98B5E', '#8D5A3B', '#5E3A26'];
const HAIR = ['#2A211C', '#5A3824', '#8B5A2B', '#D8B35A', '#A33A1E', '#BFBFBF'];
const OUT = '#1B1A22';

// ───────── 3x5 글꼴 ─────────
const FONT = {
  0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001111001111', 4: '101101111001001', 5: '111100111001111', 6: '111100111101111', 7: '111001010010010', 8: '111101111101111', 9: '111101111001111',
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111', F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', K: '101101110101101', L: '100100100100111',
  M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100', R: '110101110101101', S: '011100010001110', T: '111010010010010', U: '101101101101111', V: '101101101101010', W: '101101111111101', Y: '101101010010010', X: '101101010101101', '!': '010010010000010', J: '001001001101010', Q: '010101101110011', Z: '111001010100111', '.': '000000000000010', ' ': '000000000000000', '-': '000000111000000', ':': '000010000010000', '&': '010101010101011', '%': '101001010100101', '+': '000010111010000', '?': '111001011000010', '/': '001001010100100',
};
function text(ctx, str, x, y, color) {
  ctx.fillStyle = color;
  let cx = x;
  for (const ch of String(str).toUpperCase()) {
    const g = FONT[ch] || FONT[' '];
    for (let i = 0; i < 15; i++) if (g[i] === '1') ctx.fillRect(cx + i % 3, y + Math.floor(i / 3), 1, 1);
    cx += 4;
  }
  return cx - x - 1;
}
const textWidth = str => String(str).length * 4 - 1;

// ───────── 선수 스프라이트 (16×24, 정면 2등신) ─────────
// K 외곽선 · H 헬멧 · h 헬멧 하이라이트 · S 헬멧 줄무늬 · M 페이스마스크 · F 피부 · E 눈 · J 유니폼 · j 유니폼 그늘 · W 바지 · w 바지 그늘 · B 신발 · L 공 · l 공 끈 · V 바이저
const HELMET = [
  '.....KKKKKK.....',
  '...KKhhHSHHKK...',
  '..KhhHHHSHHHHK..',
  '.KhHHHHHSHHHHHK.',
  '.KHHHHHHSHHHHHK.',
  'KHHHHHHHSHHHHHHK',
  'KHHKKKKKKKKKKHHK',
  'KHKFFFFFFFFFFKHK',
  'KHKFEEFFFFEEFKHK',
  'KHKMMMMMMMMMMKHK',
  'KHKFFFMFFMFFFKHK',
  '.KKKMMMMMMMMKKK.',
];
const HELMET_SAD = HELMET.map((r, i) => i === 8 ? 'KHKFFFFFFFFFFKHK' : i === 7 ? 'KHKFKKFFFFKKFKHK' : r);
const HELMET_HAPPY = HELMET.map((r, i) => i === 8 ? 'KHKFEFEFFEFEFKHK' : i === 7 ? 'KHKFFEFFFFEFFKHK' : r);
const TORSO = [
  'KJJJJKKKKKKJJJJK',
  'KJJJJJJJJJJJJJJK',
  'KjJJJJJJJJJJJJjK',
  '.KjJJJJJJJJJJjK.',
  '.KjJJJJJJJJJJjK.',
  '.KjJJJJJJJJJJjK.',
  '..KKKKKKKKKKKK..',
];
const LEGS = {
  stand: ['..KWWWWWWWWWWK..', '..KWWWwKKwWWWK..', '..KWWWK..KWWWK..', '..KwWWK..KWWwK..', '..KBBBK..KBBBK..'],
  run1: ['..KWWWWWWWWWWK..', '.KWWWwK..KwWWK..', 'KWWWK......KWWK.', 'KBBBK......KWWK.', '...........KBBK.'],
  run2: ['..KWWWWWWWWWWK..', '..KWWwK..KwWWWK.', '.KWWK......KWWWK', '.KWWK......KBBBK', '.KBBK...........'],
  crouch: ['.KWWWWWWWWWWWWK.', 'KWWWwKKKKKKwWWWK', 'KBBBK......KBBBK', '................', '................'],
  kick: ['..KWWWWWWWWWWK..', '..KWWWwKKwWWWWKK', '..KWWWK..KWWWWBB', '..KwWWK...KKKKK.', '..KBBBK.........'],
};
const BALL = ['.KKK.', 'KLlLK', 'KLLLK', '.KKK.'];
// al/ar: 왼팔·오른팔 모양 (down 아래 · up 위로 · out 옆으로 · ground 땅 짚기) · ball: 공 위치 (hold 옆구리 · high 머리 위)
const POSES = {
  stand: { legs: 'stand', al: 'down', ar: 'down', ball: 'hold' },
  idle: { legs: 'stand', al: 'down', ar: 'down' },
  cheer: { legs: 'stand', al: 'up', ar: 'up', ball: 'high', face: 'happy' },
  throw: { legs: 'stand', al: 'out', ar: 'up', ball: 'high' },
  run: { legs: 'run1', al: 'out', ar: 'down', ball: 'hold' },
  run2: { legs: 'run2', al: 'down', ar: 'down', ball: 'hold' },
  stance: { legs: 'crouch', al: 'ground', ar: 'down', drop: 2 },
  kick: { legs: 'kick', al: 'out', ar: 'out' },
  sad: { legs: 'stand', al: 'down', ar: 'down', face: 'sad', drop: 1 },
};
export const SPRITE_W = 22, SPRITE_H = 28;
function playerGrid(pose = 'stand', hairStyle = 0) {
  const P = POSES[pose] || POSES.stand, W = SPRITE_W, H = SPRITE_H;
  const g = Array.from({ length: H }, () => Array(W).fill('.'));
  const put = (rows, y0, x0) => rows.forEach((r, i) => r.split('').forEach((v, j) => { if (v !== '.' && g[y0 + i] && x0 + j >= 0 && x0 + j < W) g[y0 + i][x0 + j] = v; }));
  const fill = (x, y, w, h, v) => { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (g[yy] && xx >= 0 && xx < W) g[yy][xx] = v; };
  const head = P.face === 'sad' ? HELMET_SAD : P.face === 'happy' ? HELMET_HAPPY : HELMET;
  const hy = 1 + (P.drop || 0), ty = hy + 12, ly = ty + 7;
  put(head, hy, 3); put(TORSO, ty, 3); put(LEGS[P.legs], ly, 3);
  const arm = (left, kind) => {
    const x = left ? 1 : 19;
    if (kind === 'down') { fill(x, ty, 2, 2, 'J'); fill(x, ty + 2, 2, 3, 'F'); }
    if (kind === 'up') { fill(x, ty - 3, 2, 3, 'J'); fill(x, ty - 6, 2, 3, 'F'); fill(left ? 2 : 19, ty, 2, 1, 'J'); }
    if (kind === 'out') { fill(left ? 0 : 19, ty, 3, 2, 'J'); fill(left ? 0 : 20, ty + 2, 2, 2, 'F'); }
    if (kind === 'ground') { fill(x, ty, 2, 2, 'J'); fill(left ? 2 : 18, ty + 2, 2, 7, 'F'); }
  };
  arm(true, P.al); arm(false, P.ar);
  if (hairStyle === 2 || hairStyle === 4) for (const r of [9, 10, 11]) { g[hy + r][3] = 'R'; g[hy + r][18] = 'R'; }
  if (P.ball === 'hold') put(BALL, ty + 2, 17);
  if (P.ball === 'high') put(BALL, ty - 9, 17);
  // 외곽선: 색이 칠해진 칸 옆의 빈칸을 K로.
  const filled = (y, x) => g[y]?.[x] && g[y][x] !== '.' && g[y][x] !== 'K';
  const edge = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (g[y][x] === '.' && (filled(y - 1, x) || filled(y + 1, x) || filled(y, x - 1) || filled(y, x + 1))) edge.push([y, x]);
  for (const [y, x] of edge) g[y][x] = 'K';
  return { grid: g, numberAt: [ty + 1, 7] };
}
function palette({ colors = ['#1F6B3B', '#FFFFFF'], skin = 1, hair = 0, visor = 0, pants }) {
  const c1 = vivid(colors[0]), c2 = colors[1] && colors[1] !== colors[0] ? colors[1] : '#FFFFFF', pw = pants || '#ECEEF1';
  return { K: OUT, H: c1, h: shade(c1, .35), S: c2, M: '#C9CED6', F: SKIN[skin] || SKIN[1], E: visor ? (visor === 2 ? '#D9A531' : '#2B2F33') : OUT, J: c1, j: shade(c1, -.28),
    W: pw, w: shade(pw, -.18), B: '#26262E', L: '#8A4B22', l: '#FFFFFF', R: HAIR[hair] || HAIR[0], N: lum(c1) > .6 ? OUT : (lum(c2) > .4 ? c2 : '#FFFFFF') };
}
function drawGrid(ctx, grid, pal, x0, y0, flip = false) {
  const w = grid[0].length;
  grid.forEach((row, y) => row.forEach((v, x) => { if (v === '.' || !pal[v]) return; ctx.fillStyle = pal[v]; ctx.fillRect(x0 + (flip ? w - 1 - x : x), y0 + y, 1, 1); }));
}
function drawNumber(ctx, n, x, y, color) {
  const s = String(n ?? 0).slice(-2);
  const w = s.length === 1 ? 3 : 7, sx = x + Math.floor((7 - w) / 2);
  text(ctx, s.length === 1 ? s : `${s[0]}${s[1]}`, sx, y, color);
}
function drawPlayer(ctx, x, y, o = {}) {
  const { grid, numberAt } = playerGrid(o.pose, o.avatar?.style ?? 0);
  const pal = palette({ colors: o.colors, skin: o.avatar?.skin, hair: o.avatar?.hair, visor: o.avatar?.visor, pants: o.pants });
  drawGrid(ctx, grid, pal, x, y, o.flip);
  if (o.number !== undefined && o.number !== null && !o.noNumber) {
    const [ny, nx] = numberAt;
    // 숫자는 좌우 반전하지 않습니다.
    const w = grid[0].length, fx = o.flip ? w - nx - 7 : nx;
    drawNumber(ctx, o.number, x + fx, y + ny, pal.N);
  }
}

// ───────── 얼굴 초상 (20×20, 헬멧을 벗은 모습) ─────────
const FACE = [
  '....................',
  '....................',
  '......KKKKKKKK......',
  '.....KFFFFFFFFK.....',
  '....KFFFFFFFFFFK....',
  '....KFFFFFFFFFFK....',
  '...KFFFFFFFFFFFFK...',
  '...KFFEEFFFFEEFFK...',
  '...KFFEEFFFFEEFFK...',
  '..KfFFFFFFFFFFFFfK..',
  '...KFFFFFKKFFFFFK...',
  '...KFFFFFFFFFFFFK...',
  '....KFFFKKKKFFFK....',
  '.....KFFFFFFFFK.....',
  '......KKFFFFKK......',
  '....KKKKFFFFKKKK....',
  '..KJJJJJKKKKJJJJJK..',
  '.KJJJJJJJJJJJJJJJJK.',
  'KJJJJJJJJJJJJJJJJJJK',
  'KJJJJJJJJJJJJJJJJJJK',
];
const HAIRS = [
  // 짧은 머리
  ['......RRRRRRRR......', '.....RRRRRRRRRR.....', '....RRRRRRRRRRRR....', '....RRRFFFFFFRRR....', '...RRFFFFFFFFFFRR...'],
  // 버즈컷
  ['......KKKKKKKK......', '.....KRRRRRRRRK.....', '....KRRRRRRRRRRK....', '....KFFFFFFFFFFK....', '...KFFFFFFFFFFFFK...'],
  // 드레드
  ['....R.RRRRRRRR.R....', '...RRRRRRRRRRRRRR...', '..RRRRRRRRRRRRRRRR..', '..RRRRFFFFFFFFRRRR..', '..RRKFFFFFFFFFFKRR..', '..R.............R...', '..R.............R...', '..R..............R..', '..R..............R..'],
  // 곱슬(아프로)
  ['....RRRRRRRRRRRR....', '...RRRRRRRRRRRRRR...', '..RRRRRRRRRRRRRRRR..', '..RRRRRRRRRRRRRRRR..', '..RRRFFFFFFFFFFRRR..', '...RRFFFFFFFFFFRR...'],
  // 긴 머리
  ['......RRRRRRRR......', '.....RRRRRRRRRR.....', '....RRRRRRRRRRRR....', '...RRRRFFFFFFRRRR...', '...RRFFFFFFFFFFRR...', '...R............R...', '...R............R...', '..RR............RR..', '..RR............RR..', '..RR............RR..', '..R..............R..'],
  // 삭발
  [],
];
function portraitGrid(style) {
  const g = FACE.map(r => r.split(''));
  const hair = HAIRS[style] || [];
  hair.forEach((row, i) => row.split('').forEach((v, x) => { if (v === '.') return; const y = i + 2; if (v === 'R' && g[y][x] !== 'K' || v === 'K' || v === 'F' && g[y][x] === '.') g[y][x] = v; else if (v === 'R') g[y][x] = 'R'; }));
  return g;
}

// ───────── 배경 ─────────
function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 10000) / 10000; }; }
function field(ctx, W, H, top, colors, opp, { night = false, snow = false } = {}) {
  const g1 = night ? '#2F7D45' : '#3E9A52', g2 = night ? '#2A7040' : '#368A49';
  for (let x = 0; x < W; x++) { ctx.fillStyle = Math.floor(x / 10) % 2 ? g1 : g2; ctx.fillRect(x, top, 1, H - top); }
  // 엔드존
  ctx.fillStyle = vivid(colors[0]); ctx.fillRect(0, top, 14, H - top);
  ctx.fillStyle = vivid((opp || colors)[0]); ctx.fillRect(W - 14, top, 14, H - top);
  ctx.fillStyle = '#FFFFFF';
  for (let x = 14; x <= W - 14; x += 12) ctx.fillRect(x, top, 1, H - top);
  for (let x = 14; x < W - 14; x += 3) { ctx.fillRect(x, top + Math.round((H - top) * .3), 1, 1); ctx.fillRect(x, top + Math.round((H - top) * .7), 1, 1); }
  ctx.fillStyle = '#FFFFFF'; ctx.globalAlpha = .9;
  if (H - top > 24) { text(ctx, '50', Math.round(W / 2) - 3, top + Math.round((H - top) * .5) - 2, '#FFFFFF'); }
  ctx.globalAlpha = 1;
  if (snow) { const r = rng(7); ctx.fillStyle = '#F4F8FF'; for (let i = 0; i < 90; i++) ctx.fillRect(Math.floor(r() * W), top + Math.floor(r() * (H - top)), 2, 1); }
}
function goalpost(ctx, x, top) {
  ctx.fillStyle = '#F2C230';
  ctx.fillRect(x, top - 12, 1, 12); ctx.fillRect(x - 5, top - 12, 11, 1); ctx.fillRect(x - 5, top - 26, 1, 14); ctx.fillRect(x + 5, top - 26, 1, 14);
}
function stands(ctx, W, top, bottom, colors, r, dense = true) {
  ctx.fillStyle = '#2B3346'; ctx.fillRect(0, top, W, bottom - top);
  const pal = [vivid(colors[0]), colors[1] || '#FFFFFF', '#E8E2D0', '#C94A3A', '#3A6FC9', '#F0C24A', '#FFFFFF'];
  for (let y = top + 1; y < bottom - 1; y += 2) for (let x = (y % 4 ? 0 : 1); x < W; x += 2) if (r() < (dense ? .78 : .45)) { ctx.fillStyle = pal[Math.floor(r() * (r() < .5 ? 2 : pal.length))]; ctx.fillRect(x, y, 1, 1); }
  ctx.fillStyle = '#1B2130'; ctx.fillRect(0, bottom - 2, W, 2);
}
function lights(ctx, x, y) { ctx.fillStyle = '#4B5366'; ctx.fillRect(x + 3, y + 5, 1, 14); ctx.fillStyle = '#FFF6C8'; ctx.fillRect(x, y, 7, 4); ctx.fillStyle = '#FFFFFF'; ctx.fillRect(x + 1, y + 1, 5, 2); }
const SCENES = {
  stadium(ctx, W, H, o) {
    const r = rng(o.seed || 3);
    ctx.fillStyle = '#141B33'; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 18; i++) { ctx.fillStyle = '#C8D2FF'; ctx.fillRect(Math.floor(r() * W), Math.floor(r() * 10), 1, 1); }
    lights(ctx, 6, 2); lights(ctx, W - 13, 2);
    stands(ctx, W, 12, 38, o.colors, r);
    // 전광판
    ctx.fillStyle = '#0B0F18'; ctx.fillRect(W / 2 - 22, 3, 44, 9); ctx.fillStyle = '#F2C230';
    text(ctx, o.board || 'TOUCHDOWN', W / 2 - Math.floor(textWidth(o.board || 'TOUCHDOWN') / 2), 5, '#F2C230');
    field(ctx, W, H, 38, o.colors, o.opp, { night: true, snow: o.snow });
    goalpost(ctx, 7, 38); goalpost(ctx, W - 8, 38);
  },
  snow(ctx, W, H, o) { SCENES.stadium(ctx, W, H, { ...o, snow: true, board: 'COLD GAME' }); const r = rng(11); ctx.fillStyle = '#FFFFFF'; for (let i = 0; i < 60; i++) ctx.fillRect(Math.floor(r() * W), Math.floor(r() * H), 1, 1); },
  hs(ctx, W, H, o) {
    const r = rng(o.seed || 5);
    ctx.fillStyle = '#21304F'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#E57B3A'; ctx.fillRect(0, 22, W, 4); ctx.fillStyle = '#F2A65A'; ctx.fillRect(0, 26, W, 3);
    lights(ctx, 10, 4); lights(ctx, W - 17, 4);
    ctx.fillStyle = '#9AA3B2'; for (let y = 29; y < 40; y += 3) ctx.fillRect(20, y, W - 40, 1);
    for (let y = 30; y < 40; y += 3) for (let x = 22; x < W - 22; x += 3) if (r() < .5) { ctx.fillStyle = r() < .5 ? vivid(o.colors[0]) : '#F2E8D0'; ctx.fillRect(x, y - 1, 1, 1); }
    field(ctx, W, H, 40, o.colors, o.opp, { night: true });
    goalpost(ctx, 7, 40);
  },
  practice(ctx, W, H, o) {
    ctx.fillStyle = '#9ED3F2'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#FFFFFF'; for (const [x, y] of [[20, 6], [90, 4], [130, 9]]) { ctx.fillRect(x, y, 14, 3); ctx.fillRect(x + 3, y - 2, 8, 2); }
    ctx.fillStyle = '#3F7D4A'; for (let x = 0; x < W; x += 6) ctx.fillRect(x, 22 - (x % 12 ? 2 : 4), 6, 12);
    ctx.fillStyle = '#7A848F'; ctx.fillRect(0, 30, W, 1); for (let x = 0; x < W; x += 8) ctx.fillRect(x, 26, 1, 6);
    ctx.fillStyle = '#3E9A52'; ctx.fillRect(0, 32, W, H - 32);
    ctx.fillStyle = '#4BA85E'; for (let x = 0; x < W; x += 20) ctx.fillRect(x, 32, 10, H - 32);
    ctx.fillStyle = '#FFFFFF'; for (let x = 8; x < W; x += 24) ctx.fillRect(x, 32, 1, H - 32);
    // 태클 더미 · 콘
    for (const [x, c] of [[W - 34, '#C83A3A'], [W - 22, '#2F5FC8']]) { ctx.fillStyle = OUT; ctx.fillRect(x - 1, 33, 8, 20); ctx.fillStyle = c; ctx.fillRect(x, 34, 6, 18); ctx.fillStyle = '#FFFFFF'; ctx.fillRect(x, 40, 6, 2); }
    for (const x of [18, 34, 50]) { ctx.fillStyle = '#F08A24'; ctx.fillRect(x, H - 12, 3, 1); ctx.fillRect(x - 1, H - 11, 5, 2); }
  },
  locker(ctx, W, H, o) {
    ctx.fillStyle = '#2E3440'; ctx.fillRect(0, 0, W, H);
    for (let x = 4; x < W - 4; x += 16) {
      ctx.fillStyle = '#5B6475'; ctx.fillRect(x, 6, 14, 42); ctx.fillStyle = '#4A5262'; ctx.fillRect(x + 1, 7, 12, 40);
      ctx.fillStyle = vivid(o.colors[0]); ctx.fillRect(x + 3, 18, 8, 10); ctx.fillStyle = shade(vivid(o.colors[0]), -.3); ctx.fillRect(x + 3, 26, 8, 2);
      ctx.fillStyle = '#3A4150'; for (let v = 9; v < 15; v += 2) ctx.fillRect(x + 3, v, 8, 1);
    }
    ctx.fillStyle = '#7A5A3A'; ctx.fillRect(0, H - 20, W, 3); ctx.fillStyle = '#5A412A'; ctx.fillRect(6, H - 17, 2, 6); ctx.fillRect(W - 8, H - 17, 2, 6);
    ctx.fillStyle = '#3A3F4A'; ctx.fillRect(0, H - 11, W, 11);
    ctx.fillStyle = vivid(o.colors[0]); ctx.fillRect(W - 30, H - 26, 9, 6); ctx.fillStyle = '#C9CED6'; ctx.fillRect(W - 22, H - 23, 2, 2);
  },
  press(ctx, W, H, o) {
    ctx.fillStyle = '#E9ECF2'; ctx.fillRect(0, 0, W, H);
    for (let y = 2; y < H - 22; y += 10) for (let x = (y / 10 % 2) * 10 + 2; x < W; x += 20) { ctx.fillStyle = vivid(o.colors[0]); ctx.fillRect(x, y, 7, 4); ctx.fillStyle = '#8A4B22'; ctx.fillRect(x + 2, y + 1, 3, 2); }
    ctx.fillStyle = '#2B3346'; ctx.fillRect(0, H - 22, W, 22);
    ctx.fillStyle = '#1B2130'; ctx.fillRect(0, H - 22, W, 2);
    for (const x of [W / 2 - 14, W / 2 - 4, W / 2 + 8]) { ctx.fillStyle = '#1B1A22'; ctx.fillRect(x, H - 34, 1, 12); ctx.fillStyle = ['#C83A3A', '#2F5FC8', '#F0C24A'][Math.round(x) % 3]; ctx.fillRect(x - 1, H - 36, 3, 3); }
  },
  film(ctx, W, H, o) {
    ctx.fillStyle = '#151A24'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#E8EEF6'; ctx.fillRect(18, 5, W - 36, 40); ctx.fillStyle = '#2C6E44'; ctx.fillRect(20, 7, W - 40, 36);
    ctx.fillStyle = '#FFFFFF';
    const os = [[40, 25], [52, 25], [64, 25], [76, 25], [88, 25], [64, 31]], xs = [[44, 16], [60, 14], [80, 16], [96, 18], [70, 20]];
    for (const [x, y] of os) { ctx.fillRect(x, y, 3, 1); ctx.fillRect(x, y + 2, 3, 1); ctx.fillRect(x, y + 1, 1, 1); ctx.fillRect(x + 2, y + 1, 1, 1); }
    ctx.fillStyle = '#F2C230'; for (const [x, y] of xs) { ctx.fillRect(x, y, 1, 1); ctx.fillRect(x + 2, y, 1, 1); ctx.fillRect(x + 1, y + 1, 1, 1); ctx.fillRect(x, y + 2, 1, 1); ctx.fillRect(x + 2, y + 2, 1, 1); }
    ctx.fillStyle = '#FFFFFF'; for (let i = 0; i < 14; i++) ctx.fillRect(66 + i, 24 - Math.floor(i / 2), 1, 1);
    ctx.fillStyle = '#0D1018'; for (let x = 4; x < W; x += 14) ctx.fillRect(x, H - 12, 10, 12);
  },
  medical(ctx, W, H, o) {
    ctx.fillStyle = '#EEF3F6'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#D5DEE5'; ctx.fillRect(0, H - 18, W, 18);
    ctx.fillStyle = '#2FA36B'; ctx.fillRect(18, 8, 4, 12); ctx.fillRect(14, 12, 12, 4);
    ctx.fillStyle = '#9AA6B2'; ctx.fillRect(W - 50, H - 30, 40, 4); ctx.fillRect(W - 48, H - 26, 2, 10); ctx.fillRect(W - 14, H - 26, 2, 10);
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(W - 50, H - 32, 40, 2);
    ctx.fillStyle = '#7FC4E8'; ctx.fillRect(W - 70, H - 24, 8, 5);
  },
  school(ctx, W, H, o) {
    ctx.fillStyle = '#E8DCC4'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#7A5A3A'; ctx.fillRect(14, 5, W - 28, 32); ctx.fillStyle = '#2F5544'; ctx.fillRect(16, 7, W - 32, 28);
    text(ctx, 'GPA 2.0', 24, 12, '#F4F4F4'); text(ctx, 'MATH', 24, 21, '#F4F4F4');
    ctx.fillStyle = '#F4F4F4'; ctx.fillRect(W - 48, 26, 20, 1);
    ctx.fillStyle = '#A07A50'; for (let x = 6; x < W; x += 30) ctx.fillRect(x, H - 16, 20, 3);
    ctx.fillStyle = '#7A5A3A'; for (let x = 8; x < W; x += 30) { ctx.fillRect(x, H - 13, 2, 8); ctx.fillRect(x + 16, H - 13, 2, 8); }
  },
  draft(ctx, W, H, o) {
    ctx.fillStyle = '#0E1530'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#1B2A5C'; for (let x = 0; x < W; x += 12) ctx.fillRect(x, 0, 6, H - 24);
    ctx.fillStyle = '#05070F'; ctx.fillRect(W / 2 - 34, 4, 68, 22); ctx.fillStyle = vivid(o.colors[0]); ctx.fillRect(W / 2 - 32, 6, 64, 18);
    text(ctx, o.board || 'DRAFT', W / 2 - Math.floor(textWidth(o.board || 'DRAFT') / 2), 9, o.colors[1] && lum(o.colors[1]) > .3 ? o.colors[1] : '#FFFFFF');
    text(ctx, 'THE PICK IS IN', W / 2 - Math.floor(textWidth('THE PICK IS IN') / 2), 16, '#FFFFFF');
    ctx.fillStyle = '#FFF6C8'; ctx.globalAlpha = .18; ctx.beginPath(); ctx.moveTo(W / 2 - 6, 0); ctx.lineTo(W / 2 + 6, 0); ctx.lineTo(W / 2 + 26, H); ctx.lineTo(W / 2 - 26, H); ctx.fill(); ctx.globalAlpha = 1;
    ctx.fillStyle = '#2B3346'; ctx.fillRect(0, H - 24, W, 24); ctx.fillStyle = '#3A4560'; ctx.fillRect(0, H - 24, W, 2);
    ctx.fillStyle = '#5A412A'; ctx.fillRect(18, H - 38, 14, 16); ctx.fillStyle = '#7A5A3A'; ctx.fillRect(17, H - 39, 16, 3);
  },
  trophy(ctx, W, H, o) {
    ctx.fillStyle = '#2A2320'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#3A302B'; for (let x = 0; x < W; x += 8) ctx.fillRect(x, 0, 4, H);
    for (const y of [20, 42]) { ctx.fillStyle = '#8A6A44'; ctx.fillRect(6, y, W - 12, 3); ctx.fillStyle = '#5A412A'; ctx.fillRect(6, y + 3, W - 12, 1); }
    const n = Math.min(o.count ?? 0, 14);
    for (let i = 0; i < n; i++) { const row = i < 7 ? 0 : 1, x = 12 + (i % 7) * 20, y = row ? 30 : 8; drawIcon(ctx, i % 3 === 2 ? 'ring' : 'trophy', x, y); }
  },
};
// 작은 아이콘 (12×12)
const ICONS = {
  trophy: ['..KKKKKKKK..', '.KGGGgGGGGK.', 'KKGGGgGGGGKK', 'KGKGGgGGGKGK', 'KGKGGgGGGKGK', '.KKGGgGGGKK.', '...KGGGGK...', '....KGGK....', '....KGGK....', '...KGGGGK...', '..KBBBBBBK..', '..KKKKKKKK..'],
  ring: ['....KKKK....', '...KDDDDK...', '..KDdDDdDK..', '...KDDDDK...', '..KGGGGGGK..', '.KGK....KGK.', 'KGK......KGK', 'KGK......KGK', 'KGK......KGK', '.KGK....KGK.', '..KGGGGGGK..', '...KKKKKK...'],
  star: ['.....KK.....', '....KGGK....', '....KGGK....', 'KKKKGGGGKKKK', 'KGGGGGGGGGGK', '.KGGGGGGGGK.', '..KGGGGGGK..', '..KGGKKGGK..', '.KGGK..KGGK.', '.KGK....KGK.', 'KKK......KKK', '............'],
  ball: ['............', '....KKKK....', '..KKLLLLKK..', '.KLLLLLLLLK.', 'KLLlLlLlLLLK', 'KLLlllllLLLK', 'KLLlLlLlLLLK', '.KLLLLLLLLK.', '..KKLLLLKK..', '....KKKK....', '............', '............'],
};
const ICON_PAL = { K: OUT, G: '#E5B53C', g: '#FFF0B0', B: '#7A5A3A', D: '#9FD9FF', d: '#FFFFFF', L: '#8A4B22', l: '#FFFFFF' };
function drawIcon(ctx, name, x, y) { drawGrid(ctx, ICONS[name].map(r => r.split('')), ICON_PAL, x, y); }

// ───────── 공개 API ─────────
function render(key, w, h, draw, scale = 1) {
  if (!has()) return '';
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas'); c.width = w * scale; c.height = h * scale;
  const ctx = c.getContext('2d'); ctx.imageSmoothingEnabled = false;
  if (scale !== 1) ctx.scale(scale, scale);
  draw(ctx);
  const url = c.toDataURL('image/png');
  cache.set(key, url);
  if (cache.size > 300) cache.delete(cache.keys().next().value);
  return url;
}
export const SCENE_W = 160, SCENE_H = 84;
// 배경 + 선수들. players: [{pose, colors, avatar, number, flip, x}]
export function sceneUrl(o) {
  const key = 'scene:' + JSON.stringify(o);
  return render(key, SCENE_W, SCENE_H, ctx => {
    (SCENES[o.scene] || SCENES.stadium)(ctx, SCENE_W, SCENE_H, o);
    for (const p of o.players || []) {
      const x = p.x ?? (SCENE_W / 2 - SPRITE_W / 2), y = SCENE_H - SPRITE_H - (p.y ?? 3);
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(x + 4, y + SPRITE_H - 2, 14, 2);
      drawPlayer(ctx, x, y, p);
    }
    if (o.confetti) { const r = rng(9); for (let i = 0; i < 70; i++) { ctx.fillStyle = ['#F2C230', '#FFFFFF', vivid(o.colors[0]), '#E85A5A'][i % 4]; ctx.fillRect(Math.floor(r() * SCENE_W), Math.floor(r() * (SCENE_H - 10)), 1, 2); } }
  });
}
export function spriteUrl(o, scale = 1) {
  return render('sprite:' + scale + JSON.stringify(o), SPRITE_W, SPRITE_H, ctx => drawPlayer(ctx, 0, 0, o), scale);
}
export function portraitUrl(avatar = {}, colors = ['#1F6B3B', '#FFFFFF'], number = 0) {
  return render('portrait:' + JSON.stringify([avatar, colors, number]), 20, 20, ctx => {
    const pal = palette({ colors, skin: avatar.skin, hair: avatar.hair });
    pal.f = shade(pal.F, -.12);
    drawGrid(ctx, portraitGrid(avatar.style ?? 0), pal, 0, 0);
    drawNumber(ctx, number, 6, 15, pal.N);
  });
}
export function iconUrl(name) { return render('icon:' + name, 12, 12, ctx => drawIcon(ctx, name, 0, 0)); }
export const PIXEL_READY = has;

// ───────── 캔버스용 도구 (미니게임·연출) ─────────
const spriteCache = new Map();
// 미리 그려 둔 스프라이트 캔버스 (drawImage로 빠르게 찍기).
export function spriteCanvas(o) {
  if (!has()) return null;
  const key = JSON.stringify(o);
  if (spriteCache.has(key)) return spriteCache.get(key);
  const c = document.createElement('canvas'); c.width = SPRITE_W; c.height = SPRITE_H;
  drawPlayer(c.getContext('2d'), 0, 0, o);
  spriteCache.set(key, c);
  if (spriteCache.size > 200) spriteCache.delete(spriteCache.keys().next().value);
  return c;
}
// 큰 글자: 3x5 글꼴을 scale배로, 외곽선과 함께.
export function bigText(ctx, str, cx, cy, color, scale = 2, outline = OUT) {
  const w = textWidth(str) * scale, x0 = Math.round(cx - w / 2), y0 = Math.round(cy - 5 * scale / 2);
  let x = x0;
  for (const ch of String(str).toUpperCase()) {
    const g = FONT[ch] || FONT[' '];
    for (let i = 0; i < 15; i++) if (g[i] === '1') {
      const px = x + (i % 3) * scale, py = y0 + Math.floor(i / 3) * scale;
      ctx.fillStyle = outline; ctx.fillRect(px - 1, py - 1, scale + 2, scale + 2);
    }
    x += 4 * scale;
  }
  x = x0;
  for (const ch of String(str).toUpperCase()) {
    const g = FONT[ch] || FONT[' '];
    ctx.fillStyle = color;
    for (let i = 0; i < 15; i++) if (g[i] === '1') ctx.fillRect(x + (i % 3) * scale, y0 + Math.floor(i / 3) * scale, scale, scale);
    x += 4 * scale;
  }
}
export { text as pixelText, textWidth, vivid, shade, lum, drawPlayer, OUT };
