// 플레이북: 공격 포메이션 8개·플레이 50여 개, 수비 포메이션 6개·플레이 21개, 루트 트리, 커버리지 배정,
// 상황별 코치 추천, AI 작전 선택, 작전 그림(플레이 아트). 실시간 플레이(liveplay.js)와 작전 선택 화면(clutch.js)이 함께 씁니다.
// 좌표: x는 왼쪽 사이드라인부터 야드(0~53.3), y는 스크리미지 라인 기준(+는 앞으로).
export const FW = 53.3, CX = FW / 2;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const R = Math.random;

// ───────── 루트 트리 ─────────
// pts: [dx, dy] 경유점 (dx 양수 = 그 선수 쪽 사이드라인 방향). depth: 공이 가는 깊이(야드), delay: 출발 전 대기(초)
export const ROUTES = {
  block: { name: '블록', pts: [], depth: 0 },
  flat: { name: '플랫', pts: [[4, 1.5], [10, 3]], depth: 2 },
  arrow: { name: '애로', pts: [[7, 4], [10, 5]], depth: 4 },
  swing: { name: '스윙', pts: [[4, -1], [10, 1], [12, 4]], depth: 2 },
  bubble: { name: '버블', pts: [[3, -1.2], [7, -.6], [9, 0]], depth: 0 },
  screen: { name: '스크린', pts: [[-1, -.8], [4, -.4], [7, .6]], depth: 0, delay: .8 },
  quickout: { name: '퀵 아웃', pts: [[0, 5], [6, 5]], depth: 5 },
  slant: { name: '슬랜트', pts: [[0, 2.5], [-8, 10]], depth: 6 },
  hitch: { name: '히치', pts: [[0, 6], [.4, 5]], depth: 5 },
  sit: { name: '싯', pts: [[0, 7], [-.3, 6.5]], depth: 6 },
  whip: { name: '휩', pts: [[0, 4], [-3, 5], [3, 5.2]], depth: 5 },
  drag: { name: '드래그', pts: [[0, 2], [-22, 5]], depth: 4 },
  drag2: { name: '드래그', pts: [[0, 3], [-22, 7]], depth: 6 },
  angle: { name: '앵글', pts: [[3, 1.5], [-4, 6]], depth: 5 },
  curl: { name: '컬', pts: [[0, 11], [-1.2, 9.5]], depth: 10 },
  out: { name: '아웃', pts: [[0, 10], [8, 10]], depth: 10 },
  dig: { name: '딥 인', pts: [[0, 12], [-15, 12]], depth: 12 },
  comeback: { name: '컴백', pts: [[0, 15], [3, 12.5]], depth: 13 },
  cross: { name: '크로스', pts: [[0, 7], [-24, 14]], depth: 12 },
  corner: { name: '코너', pts: [[0, 10], [8, 21]], depth: 18 },
  post: { name: '포스트', pts: [[0, 11], [-8, 26]], depth: 22 },
  go: { name: '고', pts: [[0, 34]], depth: 30 },
  fade: { name: '페이드', pts: [[1.6, 10], [3, 34]], depth: 26 },
  seam: { name: '시엄', pts: [[0, 30]], depth: 26 },
  wheel: { name: '휠', pts: [[5, 1], [9, 5], [9, 30]], depth: 24 },
  postcorner: { name: '포스트 코너', pts: [[0, 10], [-3, 15], [7, 26]], depth: 24 },
  slantgo: { name: '슬랜트 앤 고', pts: [[0, 3], [-2.5, 6], [-2.5, 34]], depth: 28 },
  outup: { name: '아웃 앤 업', pts: [[0, 6], [3, 6], [4, 34]], depth: 28 },
  deepcross: { name: '딥 크로스', pts: [[0, 10], [-26, 22]], depth: 20 },
};
// 이름 끝 '<' 또는 '>'는 방향 고정 (화면 왼쪽/오른쪽)
export function routePath(name, spot) {
  let force = 0;
  if (name.endsWith('<')) { force = -1; name = name.slice(0, -1); } else if (name.endsWith('>')) { force = 1; name = name.slice(0, -1); }
  const r = ROUTES[name]; if (!r) return [];
  const side = force || (spot.x < CX ? -1 : 1);
  return r.pts.map(([dx, dy]) => ({ x: clamp(spot.x + dx * side, 1.2, FW - 1.2), y: spot.y + dy }));
}
export const routeInfo = name => ROUTES[name.replace(/[<>]$/, '')] || ROUTES.block;

// ───────── 공격 포메이션 ─────────
// qb: 쿼터백 깊이(-5 샷건, -4 피스톨, -1.2 언더 센터). spots: 슬롯 → [x, 스크리미지 라인 기준 깊이]
export const SLOT_KIND = { X: 'WR', Z: 'WR', SL: 'WR', SL2: 'WR', TE: 'TE', TE2: 'TE', RB: 'RB', FB: 'FB' };
export const FORMATIONS = {
  gun_dbl: { name: '샷건 더블', qb: -5, spots: { X: [4.5, -.8], SL: [13, -1.6], SL2: [FW - 13, -1.6], Z: [FW - 4.5, -.8], RB: [CX + 2, -5.2] } },
  gun_trips: { name: '샷건 트립스', qb: -5, spots: { X: [4.5, -.8], TE: [CX + 5.2, -1], SL: [FW - 13.5, -1.6], Z: [FW - 4.5, -.8], RB: [CX - 2, -5.2] } },
  gun_bunch: { name: '샷건 번치', qb: -5, spots: { X: [4.5, -.8], Z: [FW - 10, -.8], SL: [FW - 11.6, -2.4], TE: [FW - 8.4, -2.4], RB: [CX - 2, -5.2] } },
  gun_empty: { name: '샷건 엠티', qb: -5, spots: { X: [4.5, -.8], SL: [11.5, -1.6], TE: [CX + 5.2, -1], SL2: [FW - 12, -1.6], Z: [FW - 4.5, -.8] } },
  ace: { name: '싱글백 에이스', qb: -1.2, spots: { X: [4.5, -.8], TE2: [CX - 5.2, -1], TE: [CX + 5.2, -1], Z: [FW - 4.5, -.8], RB: [CX, -7] } },
  iform: { name: 'I 포메이션', qb: -1.2, spots: { X: [4.5, -.8], TE: [CX + 5.2, -1], Z: [FW - 7, -1.6], FB: [CX, -4.5], RB: [CX, -7] } },
  pistol: { name: '피스톨', qb: -4, spots: { X: [4.5, -.8], TE: [CX + 5.2, -1], SL: [FW - 13, -1.6], Z: [FW - 4.5, -.8], RB: [CX, -7.2] } },
  goal: { name: '골라인', qb: -1.2, spots: { TE2: [CX - 5.2, -1], TE: [CX + 5.2, -1], Z: [FW - 9, -1.6], FB: [CX - 1.6, -4.5], RB: [CX, -7] } },
};
export function offenseSpots(formId, los) {
  const F = FORMATIONS[formId] || FORMATIONS.gun_dbl;
  const slots = {};
  for (const [k, [x, dy]] of Object.entries(F.spots)) slots[k] = { slot: k, kind: SLOT_KIND[k], x, y: los + dy };
  return { QB: { x: CX, y: los + F.qb }, OL: [-3.2, -1.6, 0, 1.6, 3.2].map(dx => ({ x: CX + dx, y: los - 1 })), slots };
}

// ───────── 공격 플레이 ─────────
// cat: short 숏 패스 · mid 미디엄 · deep 딥 · pa 플레이 액션 · screen 스크린 · run 런 · trick 트릭
// run: { hole(중앙 기준 x), carrier, type(zone·power·counter·toss·draw·sneak·read·qbdraw·jet·reverse), lead, hand(핸드오프 시각) }
// read: 쿼터백이 보는 순서(앞이 1순위). boot: 롤아웃 방향(+1 오른쪽). pa: 플레이 액션 페이크. rpo: 런·패스 옵션 대상
export const OFF_CATS = [['short', '숏 패스'], ['mid', '미디엄'], ['deep', '딥 패스'], ['pa', '플레이 액션'], ['screen', '스크린'], ['run', '런'], ['trick', '트릭']];
const B5 = { X: 'block', Z: 'block', SL: 'block', SL2: 'block', TE: 'block', TE2: 'block', RB: 'block', FB: 'block' };
const P = (id, name, form, cat, routes, o = {}) => ({ id, name, form, cat, routes: { ...B5, ...routes }, ...o });
export const OFF_PLAYS = [
  // 샷건 더블
  P('slant_flat', '슬랜트 플랫', 'gun_dbl', 'short', { X: 'slant', SL: 'flat', SL2: 'flat', Z: 'slant' }, { read: ['Z', 'X', 'SL2', 'SL'] }),
  P('stick', '스틱', 'gun_dbl', 'short', { X: 'go', SL: 'sit', SL2: 'sit', Z: 'hitch', RB: 'flat' }, { read: ['SL2', 'SL', 'RB', 'Z'] }),
  P('mesh', '메시', 'gun_dbl', 'short', { X: 'go', SL: 'drag', SL2: 'drag2', Z: 'curl', RB: 'swing' }, { read: ['SL', 'SL2', 'RB', 'Z'] }),
  P('smash', '스매시', 'gun_dbl', 'mid', { X: 'hitch', SL: 'corner', SL2: 'corner', Z: 'hitch' }, { read: ['SL2', 'Z', 'SL', 'X'] }),
  P('levels', '레벨스', 'gun_dbl', 'mid', { X: 'post', SL: 'whip', SL2: 'sit', Z: 'dig', RB: 'flat' }, { read: ['Z', 'SL2', 'X', 'RB'] }),
  P('verts', '포 버티컬', 'gun_dbl', 'deep', { X: 'go', SL: 'seam', SL2: 'seam', Z: 'go' }, { read: ['SL2', 'SL', 'Z', 'X'] }),
  P('dagger', '대거', 'gun_dbl', 'deep', { X: 'post', SL: 'seam', SL2: 'dig', Z: 'go' }, { read: ['SL2', 'Z', 'X', 'SL'] }),
  P('bubble', '버블 스크린', 'gun_dbl', 'screen', { SL: 'bubble', SL2: 'go' }, { read: ['SL'], quick: true }),
  P('dbl_zone', '인사이드 존', 'gun_dbl', 'run', {}, { run: { hole: 1, carrier: 'RB', type: 'zone' } }),
  P('draw', '샷건 드로', 'gun_dbl', 'run', {}, { run: { hole: -1, carrier: 'RB', type: 'draw', hand: 1 } }),
  P('jet', '젯 스윕', 'gun_dbl', 'trick', {}, { run: { hole: -9, carrier: 'SL2', type: 'jet', hand: .55 } }),
  // 샷건 트립스
  P('flood', '플러드', 'gun_trips', 'mid', { X: 'post', TE: 'flat', SL: 'out', Z: 'go' }, { read: ['SL', 'TE', 'Z', 'X'] }),
  P('y_cross', 'Y 크로스', 'gun_trips', 'mid', { X: 'post', TE: 'cross', SL: 'curl', Z: 'go', RB: 'flat<' }, { read: ['TE', 'SL', 'RB', 'Z'] }),
  P('trips_verts', '트립스 버티컬', 'gun_trips', 'deep', { X: 'go', TE: 'seam', SL: 'seam', Z: 'go' }, { read: ['TE', 'SL', 'Z', 'X'] }),
  P('snag', '스내그', 'gun_trips', 'short', { X: 'slant', TE: 'flat', SL: 'sit', Z: 'corner' }, { read: ['SL', 'TE', 'Z', 'X'] }),
  P('trips_power', '파워 리드', 'gun_trips', 'run', {}, { run: { hole: 2.4, carrier: 'RB', type: 'power', lead: 'TE' } }),
  P('rpo_bubble', 'RPO 버블', 'gun_trips', 'screen', { SL: 'bubble' }, { run: { hole: -1, carrier: 'RB', type: 'zone' }, rpo: 'SL' }),
  // 샷건 번치
  P('bunch_corner', '번치 코너', 'gun_bunch', 'mid', { X: 'slant', Z: 'corner', SL: 'sit', TE: 'flat' }, { read: ['Z', 'TE', 'SL', 'X'] }),
  P('bunch_wheel', '번치 휠', 'gun_bunch', 'deep', { X: 'go', Z: 'post', SL: 'drag', TE: 'wheel' }, { read: ['TE', 'Z', 'SL', 'X'] }),
  P('bunch_slant', '번치 슬랜트', 'gun_bunch', 'short', { X: 'hitch', Z: 'slant', SL: 'whip', TE: 'flat' }, { read: ['Z', 'SL', 'TE', 'X'] }),
  P('bunch_screen', '번치 스크린', 'gun_bunch', 'screen', { X: 'go', Z: 'bubble' }, { read: ['Z'], quick: true }),
  // 샷건 엠티
  P('em_quick', '퀵 아웃', 'gun_empty', 'short', { X: 'quickout', SL: 'hitch', TE: 'sit', SL2: 'hitch', Z: 'quickout' }, { read: ['Z', 'X', 'SL2', 'TE'] }),
  P('em_spacing', '스페이싱', 'gun_empty', 'short', { X: 'hitch', SL: 'sit', TE: 'seam', SL2: 'sit', Z: 'curl' }, { read: ['SL2', 'SL', 'Z', 'TE'] }),
  P('em_mills', '밀스', 'gun_empty', 'mid', { X: 'dig', SL: 'post', TE: 'flat', SL2: 'sit', Z: 'hitch' }, { read: ['X', 'SL', 'SL2', 'Z'] }),
  P('em_seams', '엠티 시엄', 'gun_empty', 'deep', { X: 'go', SL: 'seam', TE: 'seam', SL2: 'seam', Z: 'go' }, { read: ['TE', 'SL', 'SL2', 'Z'] }),
  P('em_qbdraw', 'QB 드로', 'gun_empty', 'run', { X: 'go', Z: 'go' }, { run: { hole: 0, carrier: 'QB', type: 'qbdraw', hand: .7 } }),
  // 싱글백 에이스
  P('ace_zone', '인사이드 존', 'ace', 'run', {}, { run: { hole: 1, carrier: 'RB', type: 'zone' } }),
  P('ace_stretch', '아웃사이드 존', 'ace', 'run', {}, { run: { hole: 7, carrier: 'RB', type: 'zone' } }),
  P('ace_curls', '컬 플랫', 'ace', 'short', { X: 'curl', TE2: 'flat', TE: 'flat', Z: 'curl' }, { read: ['Z', 'TE', 'X', 'TE2'] }),
  P('ace_seams', '듀얼 시엄', 'ace', 'deep', { X: 'go', TE2: 'seam', TE: 'seam', Z: 'go' }, { read: ['TE', 'TE2', 'Z', 'X'] }),
  P('ace_pa_post', 'PA 포스트', 'ace', 'pa', { X: 'post', TE: 'seam', Z: 'dig' }, { pa: true, read: ['X', 'Z', 'TE'] }),
  P('ace_boot', 'PA 부트렉', 'ace', 'pa', { X: 'post', TE2: 'drag', TE: 'flat', Z: 'corner' }, { pa: true, boot: 1, read: ['TE2', 'Z', 'TE', 'X'] }),
  P('flea', '플리 플리커', 'ace', 'trick', { X: 'post', TE: 'seam', Z: 'go' }, { flea: true, pa: true, read: ['Z', 'X', 'TE'] }),
  P('end_around', '엔드 어라운드', 'ace', 'trick', {}, { run: { hole: -10, carrier: 'Z', type: 'reverse', hand: .9 } }),
  // I 포메이션
  P('i_power', '파워 오', 'iform', 'run', {}, { run: { hole: 2.4, carrier: 'RB', type: 'power', lead: 'FB' } }),
  P('i_iso', '아이소', 'iform', 'run', {}, { run: { hole: -1, carrier: 'RB', type: 'zone', lead: 'FB' } }),
  P('i_toss', '토스 스윕', 'iform', 'run', {}, { run: { hole: 8, carrier: 'RB', type: 'toss', lead: 'FB', hand: .3 } }),
  P('i_counter', '카운터 트레이', 'iform', 'run', {}, { run: { hole: -2.4, carrier: 'RB', type: 'counter', lead: 'FB' } }),
  P('i_pa_cross', 'PA 딥 크로스', 'iform', 'pa', { X: 'go', TE: 'flat', Z: 'deepcross', FB: 'flat<' }, { pa: true, read: ['Z', 'X', 'TE', 'FB'] }),
  P('i_pa_shot', 'PA 샷', 'iform', 'pa', { X: 'post', TE: 'seam', Z: 'go' }, { pa: true, read: ['X', 'Z', 'TE'] }),
  P('i_hb_screen', 'HB 스크린', 'iform', 'screen', { X: 'go', Z: 'go', RB: 'screen' }, { read: ['RB'] }),
  // 피스톨
  P('p_read', '존 리드', 'pistol', 'run', {}, { run: { hole: 1, carrier: 'RB', type: 'read' } }),
  P('p_counter', '피스톨 카운터', 'pistol', 'run', {}, { run: { hole: 2.4, carrier: 'RB', type: 'counter', lead: 'TE' } }),
  P('p_slants', '슬랜트 앵글', 'pistol', 'short', { X: 'slant', TE: 'sit', SL: 'slant', Z: 'slant', RB: 'angle' }, { read: ['SL', 'RB', 'Z', 'X'] }),
  P('p_post_wheel', '포스트 휠', 'pistol', 'deep', { X: 'go', TE: 'drag', SL: 'post', Z: 'curl', RB: 'wheel' }, { read: ['SL', 'RB', 'Z', 'TE'] }),
  P('p_boot', '피스톨 PA 부트', 'pistol', 'pa', { X: 'post', TE: 'drag', SL: 'corner', Z: 'go', RB: 'flat' }, { pa: true, boot: 1, read: ['TE', 'SL', 'RB', 'X'] }),
  // 골라인
  P('gl_sneak', 'QB 스닉', 'goal', 'run', {}, { run: { hole: 0, carrier: 'QB', type: 'sneak' } }),
  P('gl_dive', '다이브', 'goal', 'run', {}, { run: { hole: 1, carrier: 'RB', type: 'zone', lead: 'FB' } }),
  P('gl_power', '골라인 파워', 'goal', 'run', {}, { run: { hole: -2.4, carrier: 'RB', type: 'power', lead: 'FB' } }),
  P('gl_pa', '골라인 PA 플랫', 'goal', 'pa', { TE2: 'drag', TE: 'flat', Z: 'fade', FB: 'flat<' }, { pa: true, read: ['TE', 'FB', 'TE2', 'Z'] }),
  P('gl_fade', '페이드', 'goal', 'deep', { TE2: 'flat', TE: 'slant', Z: 'fade' }, { read: ['Z', 'TE', 'TE2'] }),
];
export const playById = id => OFF_PLAYS.find(p => p.id === id) || OFF_PLAYS[0];
export const playDepth = p => p.run ? 0 : Math.max(...Object.values(p.routes).map(r => routeInfo(r).depth));

// 내 포지션이 뛸 수 있는 플레이 (내 슬롯이 그 포메이션에 있어야 함)
const MY_SLOT = { WR: 'Z', TE: 'TE', RB: 'RB' };
export function playsFor(pos) {
  const slot = MY_SLOT[pos];
  return OFF_PLAYS.filter(p => {
    const F = FORMATIONS[p.form];
    if (!slot) return true; // QB·OL: 전부
    if (!F.spots[slot]) return false;
    if (pos === 'RB') return p.run?.carrier === 'RB' || p.routes.RB !== 'block' || p.pa;
    return p.routes[slot] !== 'block' || p.run?.carrier === slot;
  });
}

// ───────── 수비 ─────────
// 수비 포메이션: dl(다운 라인맨 4명 x), lb([x, 깊이]), cb·s 숫자
export const DEF_FORMS = {
  d43: { name: '4-3', dl: [-5.2, -1.7, 1.7, 5.2], lb: [[-5, 4.5], [0, 5], [5, 4.5]], cb: 2, s: 2 },
  d43u: { name: '4-3 언더', dl: [-5.6, -2.4, 1, 4.8], lb: [[-4.5, 4.5], [.5, 5], [5.5, 2.5]], cb: 2, s: 2 },
  nickel: { name: '니켈 4-2-5', dl: [-5.4, -1.7, 1.7, 5.4], lb: [[-2.6, 5], [2.6, 5]], cb: 3, s: 2 },
  dime: { name: '다임 4-1-6', dl: [-5.6, -1.7, 1.7, 5.6], lb: [[0, 5.5]], cb: 4, s: 2 },
  bear: { name: '46 베어', dl: [-4.6, -1.6, 1.6, 4.6], lb: [[-6.5, 3], [-2.8, 4.2], [2.8, 4.2]], cb: 2, s: 2 },
  goal: { name: '골라인', dl: [-4.2, -1.4, 1.4, 4.2], lb: [[-5.5, 2.5], [-1.8, 3], [1.8, 3], [5.5, 2.5]], cb: 2, s: 1 },
};
// 존 지점: [x, 깊이]. 13야드 이상은 딥 존
export const ZONES = {
  deepL3: [8.5, 16], deepM3: [CX, 18], deepR3: [FW - 8.5, 16], deepL2: [CX - 11, 17], deepR2: [CX + 11, 17], deepMid: [CX, 13],
  q1: [7, 15], q2: [CX - 6, 16], q3: [CX + 6, 16], q4: [FW - 7, 15],
  flatL: [6, 3.5], flatR: [FW - 6, 3.5], curlL: [12, 8], curlR: [FW - 12, 8], hookL: [CX - 6, 7], hookM: [CX, 7], hookR: [CX + 6, 7],
};
export const isDeepZone = z => (ZONES[z]?.[1] ?? 0) >= 13;
export const COV_NAME = { c0: '커버 0', c1: '커버 1', c2: '커버 2', c2m: '투 맨 언더', t2: '탬파 2', c3: '커버 3', c4: '커버 4', c6: '커버 6' };
export const DEF_CATS = [['man', '맨'], ['zone', '존'], ['blitz', '블리츠'], ['run', '런 저지']];
// shell: 스냅 전 딥 세이프티 수(0·1·2). blitz: 돌진하는 선수(mike·will·sam·nickel·ss·fs), drop: 존으로 빠지는 DL, spy: QB 스파이
const D = (id, name, form, cat, o) => ({ id, name, form, cat, ...o });
export const DEF_PLAYS = [
  D('c3', '커버 3', 'd43', 'zone', { cov: 'c3', shell: 1 }),
  D('c2', '커버 2', 'd43', 'zone', { cov: 'c2', shell: 2 }),
  D('t2', '탬파 2', 'd43', 'zone', { cov: 't2', shell: 2 }),
  D('c4', '쿼터스', 'd43', 'zone', { cov: 'c4', shell: 2 }),
  D('c1', '커버 1 맨', 'd43', 'man', { cov: 'c1', shell: 1 }),
  D('mike_blitz', '마이크 블리츠', 'd43', 'blitz', { cov: 'c1', shell: 1, blitz: ['mike'] }),
  D('under_c3', '언더 커버 3', 'd43u', 'zone', { cov: 'c3', shell: 1 }),
  D('run_stop', '런 스톱 (8인 박스)', 'd43u', 'run', { cov: 'c1', shell: 1, box: true }),
  D('nk_c3', '니켈 커버 3', 'nickel', 'zone', { cov: 'c3', shell: 1 }),
  D('nk_2man', '투 맨 언더', 'nickel', 'man', { cov: 'c2m', shell: 2 }),
  D('nk_c6', '커버 6', 'nickel', 'zone', { cov: 'c6', shell: 2 }),
  D('nk_blitz', '니켈 코너 블리츠', 'nickel', 'blitz', { cov: 'c3', shell: 1, blitz: ['nickel'] }),
  D('nk_fire', '파이어 존', 'nickel', 'blitz', { cov: 'c3', shell: 2, blitz: ['mike', 'will'], drop: ['DL0'] }),
  D('dm_c4', '다임 쿼터스', 'dime', 'zone', { cov: 'c4', shell: 2 }),
  D('dm_c2', '다임 커버 2', 'dime', 'zone', { cov: 'c2', shell: 2 }),
  D('dm_c0', '커버 0 올아웃', 'dime', 'blitz', { cov: 'c0', shell: 0, blitz: ['mike', 'ss'] }),
  D('dm_spy', 'QB 스파이', 'dime', 'man', { cov: 'c1', shell: 1, spy: 'mike' }),
  D('bear_c1', '46 커버 1', 'bear', 'run', { cov: 'c1', shell: 1, box: true }),
  D('bear_blitz', '46 블리츠', 'bear', 'blitz', { cov: 'c0', shell: 0, blitz: ['will', 'sam'] }),
  D('gl_man', '골라인 맨', 'goal', 'run', { cov: 'c0', shell: 0, box: true }),
  D('gl_blitz', '골라인 블리츠', 'goal', 'blitz', { cov: 'c0', shell: 0, blitz: ['mike', 'will'] }),
];
export const defById = id => DEF_PLAYS.find(p => p.id === id) || DEF_PLAYS[0];
export const defPlaysFor = pos => DEF_PLAYS.filter(p => !(pos === 'S' && DEF_FORMS[p.form].s < 2));

// 리시버가 많은(또는 TE가 있는) 쪽 = 스트롱 사이드 (+1 오른쪽)
export function strongSide(recvs) {
  const tes = recvs.filter(r => r.kind === 'TE');
  if (tes.length === 1) return tes[0].x < CX ? -1 : 1;
  const l = recvs.filter(r => r.x < CX - 1).length, r = recvs.filter(r => r.x > CX + 1).length;
  return l > r ? -1 : 1;
}
// 수비 정렬(스냅 전). recvs: 공격 리시버 위치 목록
export function defenseSpots(formId, recvs, los, shell = 2, man = false) {
  const F = DEF_FORMS[formId] || DEF_FORMS.d43, out = [], strong = strongSide(recvs);
  F.dl.forEach((dx, i) => out.push({ key: 'DL' + i, role: 'DL', dl: i, x: CX + dx, y: los + 1 }));
  const lbs = F.lb.map(([dx, d], i) => ({ key: 'LB' + i, role: 'LB', x: CX + dx * (formId === 'd43u' ? strong : 1), y: los + d })).sort((a, b) => a.x - b.x);
  lbs.forEach((l, i) => { l.key = 'LB' + i; });
  const mike = lbs.slice().sort((a, b) => Math.abs(a.x - CX) - Math.abs(b.x - CX))[0];
  if (mike) mike.tag = 'mike';
  for (const l of lbs) if (!l.tag) l.tag = Math.sign(l.x - CX) === strong ? 'sam' : 'will';
  out.push(...lbs);
  const rs = recvs.slice().sort((a, b) => a.x - b.x), depth = man ? 1.8 : 6;
  out.push({ key: 'CBL', role: 'CB', x: rs[0] ? Math.min(rs[0].x, CX - 8) : 5, y: los + depth });
  out.push({ key: 'CBR', role: 'CB', x: rs.at(-1) ? Math.max(rs.at(-1).x, CX + 8) : FW - 5, y: los + depth });
  if (F.cb >= 3) { const s = strong > 0 ? rs.at(-2) : rs[1]; out.push({ key: 'NB', role: 'CB', x: s ? s.x : CX + strong * 9, y: los + (man ? 2.2 : 5) }); }
  if (F.cb >= 4) { const s = strong > 0 ? rs[1] : rs.at(-2); out.push({ key: 'DB', role: 'CB', x: s ? s.x : CX - strong * 9, y: los + (man ? 2.2 : 5) }); }
  if (F.s === 1) out.push({ key: 'FS', role: 'S', x: CX, y: los + (shell ? 12 : 7) });
  else if (shell === 2) { out.push({ key: strong > 0 ? 'FS' : 'SS', role: 'S', x: CX - 9, y: los + 12 }); out.push({ key: strong > 0 ? 'SS' : 'FS', role: 'S', x: CX + 9, y: los + 12 }); }
  else if (shell === 1) { out.push({ key: 'FS', role: 'S', x: CX, y: los + 13 }); out.push({ key: 'SS', role: 'S', x: CX + strong * 7, y: los + 6.5 }); }
  else { out.push({ key: 'FS', role: 'S', x: CX - strong * 6, y: los + 7 }); out.push({ key: 'SS', role: 'S', x: CX + strong * 6, y: los + 6 }); }
  return out;
}
// 커버리지 배정: 수비 선수 key → { t: rush|man|zone|spy, z(존), who(맨 상대 슬롯), blitz }
export function assignCoverage(play, defs, recvs) {
  const asg = {}, by = k => defs.find(d => d.key === k);
  const named = n => n === 'mike' || n === 'will' || n === 'sam' ? defs.find(d => d.tag === n) : n === 'nickel' ? by('NB') : n === 'ss' ? by('SS') : n === 'fs' ? by('FS') : by(n);
  for (const d of defs) if (d.role === 'DL') asg[d.key] = { t: 'rush' };
  for (const n of play.blitz || []) { const d = named(n); if (d) asg[d.key] = { t: 'rush', blitz: true }; }
  for (const n of play.drop || []) { const d = by(n); if (d) asg[d.key] = { t: 'zone', z: d.x < CX ? 'flatL' : 'flatR' }; }
  if (play.spy) { const d = named(play.spy); if (d && !asg[d.key]) asg[d.key] = { t: 'spy' }; }
  const free = () => defs.filter(d => !asg[d.key]);
  const zone = (d, z) => { if (d && !asg[d.key]) asg[d.key] = { t: 'zone', z }; };
  const SETS = {
    under: [[], ['hookM'], ['hookL', 'hookR'], ['flatL', 'hookM', 'flatR'], ['flatL', 'hookL', 'hookR', 'flatR'], ['flatL', 'hookL', 'hookM', 'hookR', 'flatR']],
    curl: [[], ['hookM'], ['hookL', 'hookR'], ['curlL', 'hookM', 'curlR'], ['curlL', 'hookL', 'hookR', 'curlR'], ['curlL', 'hookL', 'hookM', 'hookR', 'curlR']],
    c6: [[], ['hookM'], ['hookL', 'curlR'], ['curlL', 'hookM', 'curlR'], ['flatL', 'hookL', 'hookR', 'curlR'], ['flatL', 'curlL', 'hookM', 'hookR', 'curlR']],
  };
  const under = (set = 'under') => { const ds = free().sort((a, b) => a.x - b.x), zs = SETS[set][Math.min(5, ds.length)]; ds.forEach((d, i) => zone(d, zs[i] || 'hookM')); };
  const safeties = () => defs.filter(d => d.role === 'S' && !asg[d.key]).sort((a, b) => a.x - b.x);
  const twoDeep = () => { const s = safeties(); if (s.length >= 2) { zone(s[0], 'deepL2'); zone(s.at(-1), 'deepR2'); } else if (s[0]) zone(s[0], 'deepM3'); };
  const manAll = ds => {
    const rs = recvs.slice().sort((a, b) => a.x - b.x), left = [];
    const take = (d, r) => { asg[d.key] = { t: 'man', who: r.slot }; rs.splice(rs.indexOf(r), 1); };
    const cbl = ds.find(d => d.key === 'CBL'), cbr = ds.find(d => d.key === 'CBR');
    if (cbl && rs.length) take(cbl, rs[0]);
    if (cbr && rs.length) take(cbr, rs.at(-1));
    // 나머지는 거리 합이 가장 작은 짝으로 (최대 6명이라 모든 순열을 봅니다)
    const rest = ds.filter(d => !asg[d.key]), dd = (d, r) => Math.hypot(r.x - d.x, (r.y - d.y) * .6);
    let best = null;
    const perm = (i, used, cost, pairs) => {
      if (best && cost >= best.cost) return;
      if (i === rest.length || pairs.length === rs.length) { best = { cost, pairs: pairs.slice() }; return; }
      perm(i + 1, used, cost + 100, pairs); // 이 수비수는 비워 둠(로버·돌진) — 리시버가 남아 있으면 피합니다
      for (let j = 0; j < rs.length; j++) if (!used.has(j)) { used.add(j); pairs.push([rest[i], rs[j]]); perm(i + 1, used, cost + dd(rest[i], rs[j]), pairs); pairs.pop(); used.delete(j); }
    };
    perm(0, new Set(), 0, []);
    const paired = new Set();
    for (const [d, r] of best?.pairs || []) { asg[d.key] = { t: 'man', who: r.slot }; paired.add(d); }
    for (const d of rest) if (!paired.has(d)) left.push(d);
    return left;
  };
  switch (play.cov) {
    case 'c3': zone(by('CBL'), 'deepL3'); zone(by('CBR'), 'deepR3'); zone(by('FS') || by('SS'), 'deepM3'); under(); break;
    case 'c2': zone(by('CBL'), 'flatL'); zone(by('CBR'), 'flatR'); twoDeep(); under('curl'); break;
    case 't2': zone(by('CBL'), 'flatL'); zone(by('CBR'), 'flatR'); twoDeep(); zone(defs.find(d => d.tag === 'mike'), 'deepMid'); under('curl'); break;
    case 'c4': { zone(by('CBL'), 'q1'); zone(by('CBR'), 'q4'); const s = safeties(); zone(s[0], 'q2'); zone(s[1], 'q3'); under(); break; }
    case 'c6': { zone(by('CBL'), 'q1'); const s = safeties(); zone(s[0], 'q2'); zone(s[1], 'deepR2'); zone(by('CBR'), 'flatR'); under('c6'); break; }
    case 'c1': zone(by('FS'), 'deepM3'); for (const d of manAll(free())) zone(d, 'hookM'); break;
    case 'c2m': twoDeep(); for (const d of manAll(free())) zone(d, 'hookM'); break;
    default: for (const d of manAll(free())) asg[d.key] = { t: 'rush', blitz: true }; // c0: 남는 선수는 모두 돌진
  }
  for (const d of free()) asg[d.key] = { t: 'zone', z: 'hookM' };
  return asg;
}

// ───────── 상황 판단 · 추천 · AI ─────────
// sit: { down, toGo, ball, twoPt, shell(수비 딥 세이프티), box(박스 인원), offForm(상대 포메이션) }
function offScore(p, sit) {
  const W = sit.twoPt || 100 - sit.ball <= 5 ? { run: 3, pa: 2.2, short: 2, screen: .6, mid: .8, deep: 1.2, trick: .4 }
    : sit.toGo <= 2 ? { run: 3, short: 2, pa: 1.6, screen: .6, mid: .6, deep: .5, trick: .3 }
    : sit.toGo >= 8 ? { mid: 3, deep: 2.2, screen: 1.4, short: 1.1, pa: .9, run: .45, trick: .5 }
    : sit.down === 1 ? { run: 2, pa: 2, short: 1.5, mid: 1.5, deep: 1.2, screen: 1, trick: .45 }
    : { short: 2, mid: 2, run: 1.8, pa: 1.3, screen: 1, deep: 1, trick: .35 };
  let s = W[p.cat] ?? 1;
  const toGoal = 100 - sit.ball;
  if (toGoal <= 20 && ['verts', 'trips_verts', 'em_seams', 'ace_seams', 'flea'].includes(p.id)) s *= .3;
  if (toGoal <= 12 && (p.form === 'goal' || p.id === 'gl_fade' || p.id === 'snag' || p.id === 'slant_flat')) s *= 1.6;
  if (toGoal > 12 && p.form === 'goal') s *= .15;
  if (sit.shell === 2 && (p.cat === 'run' || p.cat === 'short')) s *= 1.25;
  if (sit.shell === 1 && (p.cat === 'deep' || ['dagger', 'y_cross', 'levels'].includes(p.id))) s *= 1.25;
  if (sit.shell === 0 && (p.cat === 'screen' || p.cat === 'short' || p.quick)) s *= 1.4;
  if (sit.box >= 7 && p.cat === 'run') s *= .7;
  return s;
}
const WHY_OFF = { run: '짧은 거리엔 런', short: '빠르게 짧게', mid: '퍼스트 다운까지 한 번에', deep: '한 방을 노릴 때', pa: '런을 의식한 수비를 속이기', screen: '블리츠를 역이용', trick: '허를 찌르기' };
export function suggestOff(list, sit, n = 4) {
  const scored = list.map(p => ({ p, s: offScore(p, sit) * (.85 + R() * .3) })).sort((a, b) => b.s - a.s);
  const out = [], cats = new Set();
  for (const x of scored) { if (out.length >= n) break; if (cats.has(x.p.cat) && scored.length > n * 2) continue; cats.add(x.p.cat); out.push(x.p); }
  for (const x of scored) { if (out.length >= n) break; if (!out.includes(x.p)) out.push(x.p); }
  return out;
}
export function offAdvice(sit) {
  const shell = sit.shell === 2 ? '투 하이(딥 세이프티 둘)라 가운데 런과 짧은 패스가 열려요' : sit.shell === 1 ? '원 하이(딥 세이프티 하나)라 시엄·포스트를 노려 볼 만해요' : '딥 세이프티가 없어요. 블리츠 조심, 스크린·퀵 패스!';
  const dd = sit.twoPt ? '2점 컨버전' : sit.toGo <= 2 ? '짧은 거리' : sit.toGo >= 8 ? '긴 거리' : '중간 거리';
  return `${dd} · ${shell}`;
}
export const whyOff = p => WHY_OFF[p.cat] || '';
function defScore(p, sit) {
  const F = FORMATIONS[sit.offForm] || FORMATIONS.gun_dbl, wide = Object.keys(F.spots).filter(k => SLOT_KIND[k] === 'WR').length, heavy = ['goal', 'iform', 'ace'].includes(sit.offForm);
  const W = sit.twoPt || 100 - sit.ball <= 5 ? { run: 3, man: 2, blitz: 1.6, zone: .8 } : sit.toGo <= 2 ? { run: 2.6, blitz: 1.8, man: 1.6, zone: .8 } : sit.toGo >= 8 ? { zone: 3, man: 1.6, blitz: 1.1, run: .3 } : { zone: 2, man: 1.8, blitz: 1.3, run: 1 };
  let s = W[p.cat] ?? 1;
  const f = p.form;
  if (wide >= 3 && (f === 'nickel' || f === 'dime')) s *= 1.6;
  if (wide >= 4 && f === 'dime') s *= 1.4;
  if (heavy && (f === 'd43' || f === 'd43u' || f === 'bear' || f === 'goal')) s *= 1.5;
  if (heavy && (f === 'dime')) s *= .4;
  if (f === 'goal' && 100 - sit.ball > 6 && !sit.twoPt) s *= .1;
  return s;
}
const WHY_DEF = { zone: '구역을 지키며 공을 본다', man: '마크맨을 끝까지 따라간다', blitz: '쿼터백을 빨리 무너뜨린다', run: '박스에 사람을 더 넣는다' };
export const whyDef = p => WHY_DEF[p.cat] || '';
export function suggestDef(list, sit, n = 4) {
  const scored = list.map(p => ({ p, s: defScore(p, sit) * (.85 + R() * .3) })).sort((a, b) => b.s - a.s);
  const out = [], cats = new Set();
  for (const x of scored) { if (out.length >= n) break; if (cats.has(x.p.cat) && cats.size < 3) continue; cats.add(x.p.cat); out.push(x.p); }
  for (const x of scored) { if (out.length >= n) break; if (!out.includes(x.p)) out.push(x.p); }
  return out;
}
export function defAdvice(sit) {
  const F = FORMATIONS[sit.offForm];
  const wide = F ? Object.keys(F.spots).filter(k => SLOT_KIND[k] === 'WR').length : 2;
  return `상대 ${F?.name || ''} · 리시버 ${wide}명${sit.toGo <= 2 ? ' · 짧은 거리, 런 경계' : sit.toGo >= 8 ? ' · 긴 거리, 패스 경계' : ''}`;
}
const wpick = (list, w) => { const tot = list.reduce((n, x) => n + w(x), 0); let r = R() * tot; for (const x of list) { r -= w(x); if (r <= 0) return x; } return list.at(-1); };
export const aiOffPlay = sit => wpick(OFF_PLAYS, p => offScore(p, sit) ** 2);
export const aiDefPlay = sit => wpick(DEF_PLAYS, p => defScore(p, sit) ** 2);

// 캐치 분류 (공이 날아간 거리 기준)
export function catchKind(air) { return air >= 20 ? 'long' : air >= 8 ? 'mid' : 'short'; }
export const CATCH_KIND_KO = { short: '숏 캐치', mid: '미디엄 캐치', long: '롱 캐치' };
export const CATCH_TYPE_KO = { high: '하이포인트 캐치', poss: '안전 캐치', rac: 'RAC 캐치', dive: '다이빙 캐치', toe: '사이드라인 토 탭', norm: '' };
export const PASS_TYPE_KO = { touch: '터치 패스', bullet: '불릿 패스', lob: '로브 패스' };

// ───────── 작전 그림 ─────────
const artCache = new Map();
const AW = 220, AH = 132;
const ax = x => 8 + x * (AW - 16) / FW, ay = y => 98 - y * 3.1;
function artBase(ctx) {
  ctx.fillStyle = '#1E5B34'; ctx.fillRect(0, 0, AW, AH);
  ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 1;
  for (let y = -5; y <= 30; y += 5) { ctx.beginPath(); ctx.moveTo(0, ay(y) + .5); ctx.lineTo(AW, ay(y) + .5); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, ay(0)); ctx.lineTo(AW, ay(0)); ctx.stroke();
}
function arrowLine(ctx, pts, color, w = 2.4, dash = null, head = true) {
  if (pts.length < 2) return;
  ctx.save(); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = w; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; if (dash) ctx.setLineDash(dash);
  ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(ax(p.x), ay(p.y)) : ctx.moveTo(ax(p.x), ay(p.y))); ctx.stroke(); ctx.setLineDash([]);
  if (head) { const a = pts.at(-1), b = pts.at(-2), ang = Math.atan2(ay(a.y) - ay(b.y), ax(a.x) - ax(b.x)), hx = ax(a.x), hy = ay(a.y); ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx - Math.cos(ang - .45) * 7, hy - Math.sin(ang - .45) * 7); ctx.lineTo(hx - Math.cos(ang + .45) * 7, hy - Math.sin(ang + .45) * 7); ctx.closePath(); ctx.fill(); }
  ctx.restore();
}
const dot = (ctx, x, y, r, fill, stroke = '#0B1A10') => { ctx.beginPath(); ctx.arc(ax(x), ay(y), r, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = 1.4; ctx.strokeStyle = stroke; ctx.stroke(); };
export function playArt(p) {
  const key = 'o:' + p.id; if (artCache.has(key)) return artCache.get(key);
  if (typeof document === 'undefined') return '';
  const cv = document.createElement('canvas'); cv.width = AW; cv.height = AH; const ctx = cv.getContext('2d');
  artBase(ctx);
  const sp = offenseSpots(p.form, 0), read0 = p.read?.[0];
  // 블록 표시
  for (const [k, s] of Object.entries(sp.slots)) if (p.routes[k] === 'block' && p.run?.carrier !== k) { ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(ax(s.x) - 4, ay(s.y + 1.4)); ctx.lineTo(ax(s.x) + 4, ay(s.y + 1.4)); ctx.moveTo(ax(s.x), ay(s.y + .4)); ctx.lineTo(ax(s.x), ay(s.y + 1.4)); ctx.stroke(); }
  // 루트
  for (const [k, s] of Object.entries(sp.slots)) {
    const r = p.routes[k]; if (r === 'block') continue;
    const info = routeInfo(r), pts = [s, ...routePath(r, s)];
    arrowLine(ctx, pts, k === read0 ? '#FF7A45' : info.depth === 0 ? '#5BC0FF' : '#F2C230');
  }
  // 런
  if (p.run) {
    const ru = p.run, c = ru.carrier === 'QB' ? sp.QB : sp.slots[ru.carrier] || sp.slots.RB;
    const hole = CX + ru.hole;
    if (ru.type === 'jet' || ru.type === 'reverse') arrowLine(ctx, [c, { x: CX, y: c.y - (ru.type === 'jet' ? 1 : 4) }, { x: hole, y: -1 }, { x: hole, y: 7 }], '#FF4D4D');
    else if (ru.type === 'counter') arrowLine(ctx, [c, { x: CX - Math.sign(ru.hole) * 2.5, y: c.y + 1 }, { x: hole, y: 1 }, { x: hole, y: 8 }], '#FF4D4D');
    else arrowLine(ctx, [c, { x: hole, y: 1 }, { x: hole + Math.sign(ru.hole || 1) * (Math.abs(ru.hole) > 5 ? 2 : .5), y: 8 }], '#FF4D4D');
    if (ru.lead && sp.slots[ru.lead]) { const l = sp.slots[ru.lead]; arrowLine(ctx, [l, { x: hole, y: 2.5 }], 'rgba(255,255,255,.7)', 1.6, [3, 3]); }
    if (ru.type === 'read') arrowLine(ctx, [sp.QB, { x: CX - 7, y: 0 }, { x: CX - 8, y: 5 }], 'rgba(255,120,120,.75)', 1.6, [3, 3]);
  }
  if (p.pa && sp.slots.RB) arrowLine(ctx, [sp.slots.RB, { x: CX + 1.5, y: -1.2 }], 'rgba(255,255,255,.6)', 1.6, [2, 3], false);
  if (p.boot) arrowLine(ctx, [sp.QB, { x: CX + 8 * p.boot, y: -4.5 }], '#7FB2FF', 1.8, [3, 3]);
  // 선수
  for (let i = 0; i < 5; i++) { const o = sp.OL[i]; ctx.fillStyle = '#E9EDF2'; ctx.fillRect(ax(o.x) - 4, ay(o.y) - 4, 8, 8); ctx.strokeStyle = '#0B1A10'; ctx.lineWidth = 1.2; ctx.strokeRect(ax(o.x) - 4, ay(o.y) - 4, 8, 8); }
  dot(ctx, sp.QB.x, sp.QB.y, 4.5, '#FFFFFF');
  for (const [k, s] of Object.entries(sp.slots)) dot(ctx, s.x, s.y, 4.5, k === read0 ? '#FF7A45' : '#FFFFFF');
  const url = cv.toDataURL();
  artCache.set(key, url);
  return url;
}
const ZONE_COLOR = z => isDeepZone(z) ? 'rgba(70,130,235,.55)' : z.startsWith('flat') ? 'rgba(110,200,255,.55)' : z.startsWith('curl') ? 'rgba(170,110,235,.55)' : 'rgba(242,194,48,.55)';
export function defArt(p, mineKey = null) {
  const key = 'd:' + p.id + ':' + (mineKey || ''); if (artCache.has(key)) return artCache.get(key);
  if (typeof document === 'undefined') return '';
  const cv = document.createElement('canvas'); cv.width = AW; cv.height = AH; const ctx = cv.getContext('2d');
  artBase(ctx);
  const off = offenseSpots('gun_trips', 0), recvs = Object.values(off.slots);
  const defs = defenseSpots(p.form, recvs, 0, p.shell, p.cov === 'c0' || p.cov === 'c1' || p.cov === 'c2m');
  const asg = assignCoverage(p, defs, recvs);
  mineKey = defs.find(d => d.key === mineKey || d.tag === mineKey)?.key || null; // 'CBR'·'FS'·'mike'·'DL3' 등
  // 존 (색: 딥 파랑, 훅 노랑, 플랫 하늘, 컬 보라)
  for (const d of defs) { const a = asg[d.key]; if (a?.t !== 'zone') continue; const [zx, zd] = ZONES[a.z]; ctx.fillStyle = ZONE_COLOR(a.z); ctx.beginPath(); ctx.ellipse(ax(zx), ay(zd), isDeepZone(a.z) ? 20 : 15, isDeepZone(a.z) ? 10 : 8, 0, 0, Math.PI * 2); ctx.fill(); if (d.key === mineKey) { ctx.strokeStyle = '#FFD84A'; ctx.lineWidth = 2; ctx.stroke(); } ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 1; ctx.setLineDash([2, 2]); ctx.beginPath(); ctx.moveTo(ax(d.x), ay(d.y)); ctx.lineTo(ax(zx), ay(zd)); ctx.stroke(); ctx.setLineDash([]); }
  // 공격(회색)
  for (const o of off.OL) { ctx.fillStyle = 'rgba(200,205,212,.5)'; ctx.fillRect(ax(o.x) - 3.5, ay(o.y) - 3.5, 7, 7); }
  dot(ctx, off.QB.x, off.QB.y, 3.5, 'rgba(200,205,212,.6)', 'rgba(0,0,0,.4)');
  for (const r of recvs) dot(ctx, r.x, r.y, 3.5, 'rgba(200,205,212,.6)', 'rgba(0,0,0,.4)');
  // 맨·블리츠·스파이
  for (const d of defs) {
    const a = asg[d.key];
    if (a?.t === 'man') { const r = recvs.find(x => x.slot === a.who); if (r) arrowLine(ctx, [d, { x: r.x, y: r.y + 1 }], d.key === mineKey ? '#FFD84A' : '#FF5A5A', 1.6, null, false); }
    if (a?.t === 'rush' && (a.blitz || d.key === mineKey)) arrowLine(ctx, [d, { x: CX + (d.x - CX) * .3, y: -4 }], d.key === mineKey ? '#FFD84A' : '#FF5A5A', a.blitz ? 2.2 : 1.6);
    if (a?.t === 'spy') { ctx.strokeStyle = '#FF9F43'; ctx.lineWidth = 2; ctx.setLineDash([3, 2]); ctx.beginPath(); ctx.arc(ax(CX), ay(-5), 9, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
  }
  for (const d of defs) { const mine = d.key === mineKey; ctx.save(); ctx.translate(ax(d.x), ay(d.y)); ctx.strokeStyle = mine ? '#FFD84A' : '#FFFFFF'; ctx.lineWidth = mine ? 3 : 2.2; ctx.beginPath(); ctx.moveTo(-4, -4); ctx.lineTo(4, 4); ctx.moveTo(4, -4); ctx.lineTo(-4, 4); ctx.stroke(); ctx.restore(); }
  const url = cv.toDataURL();
  artCache.set(key, url);
  return url;
}
