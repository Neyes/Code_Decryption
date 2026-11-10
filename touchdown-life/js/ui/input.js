// 입력 방식: 컴퓨터는 'key'(키보드·마우스), 모바일은 'touch'(터치).
// 모든 직접 플레이 화면(실시간 필드·킥·헬스장·작전 고르기)은 같은 요소를 보여 주고 조작만 이 값에 따라 바꿉니다.
// 설정에서 자동/컴퓨터/모바일을 고를 수 있습니다. 자동이면 기기 특성(주 포인터가 손가락인지)으로 먼저 정하고,
// 실제로 화면을 터치하거나 게임 키를 누르면 그 방식으로 바로 바꿉니다 (터치 노트북·키보드를 연결한 태블릿).
// 키는 e.code(물리 키 위치)로 읽어서 한글 입력 상태에서도 WASD·J·K·L이 그대로 동작합니다.
const W = typeof window !== 'undefined' ? window : null;
const PREF_KEY = 'tdlife.input.v1';
let pref = 'auto';
try { pref = W?.localStorage.getItem(PREF_KEY) || 'auto'; } catch { /* 저장소를 못 쓰면 자동 */ }
let seen = null; // 자동일 때 실제 사용으로 정해진 방식
const subs = new Set();

function detect() {
  if (!W?.matchMedia) return 'key';
  if (W.matchMedia('(pointer: coarse)').matches) return 'touch';
  if (!W.matchMedia('(any-pointer: fine)').matches && (W.navigator?.maxTouchPoints || 0) > 0) return 'touch';
  return 'key';
}
export const inputMode = () => (pref === 'key' || pref === 'touch' ? pref : seen || detect());
export const isKeyMode = () => inputMode() === 'key';
export const inputPref = () => pref;
export const INPUT_PREFS = [['auto', '자동'], ['key', '컴퓨터 (키보드)'], ['touch', '모바일 (터치)']];
export function setInputPref(v) {
  pref = v === 'key' || v === 'touch' ? v : 'auto';
  try { W?.localStorage.setItem(PREF_KEY, pref); } catch { /* 무시 */ }
  emit();
}
// 방식이 바뀔 때 알림. 해제 함수를 돌려줍니다.
export function onInputMode(fn) { subs.add(fn); return () => subs.delete(fn); }
let lastMode = null;
function emit() {
  const m = inputMode();
  W?.document?.documentElement?.setAttribute('data-input', m);
  if (m === lastMode) return;
  lastMode = m;
  for (const f of [...subs]) { try { f(m); } catch (err) { console.error(err); } }
}

// 물리 키 이름 (소문자): 'w' 'a' '1' 'space' 'shift' 'enter' 'tab' 'esc' 'up' 'down' 'left' 'right' ';'
export function keyName(e) {
  const c = e.code || '';
  if (c.startsWith('Key')) return c.slice(3).toLowerCase();
  if (c.startsWith('Digit')) return c.slice(5);
  if (/^Numpad\d$/.test(c)) return c.slice(6);
  if (c.startsWith('Arrow')) return c.slice(5).toLowerCase();
  const map = { Space: 'space', ShiftLeft: 'shift', ShiftRight: 'shift', Enter: 'enter', NumpadEnter: 'enter', Tab: 'tab', Escape: 'esc', Semicolon: ';', Comma: ',', Period: '.', Slash: '/', Backspace: 'backspace' };
  if (map[c]) return map[c];
  const k = e.key || '';
  return k === ' ' ? 'space' : k.length === 1 ? k.toLowerCase() : k.toLowerCase();
}
// 화면에 보여 줄 키 글자
export function keyLabel(name) {
  return { space: 'Space', shift: 'Shift', enter: 'Enter', tab: 'Tab', esc: 'Esc', up: '↑', down: '↓', left: '←', right: '→' }[name] || String(name).toUpperCase();
}
export const kbd = name => `<kbd class="kc">${keyLabel(name)}</kbd>`;
// 이동 키: WASD와 방향키
export const MOVE_KEYS = { w: 'U', up: 'U', s: 'D', down: 'D', a: 'L', left: 'L', d: 'R', right: 'R' };
// 입력 칸에 글을 쓰는 중이면 게임 키로 보지 않습니다
export const typing = e => { const t = e.target; return !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName || '')); };

const GAME_KEYS = new Set(['w', 'a', 's', 'd', 'up', 'down', 'left', 'right', 'space', 'j', 'k', 'l', 'shift', '1', '2', '3', '4', '5', 'f', 'enter']);
if (W) {
  W.addEventListener('pointerdown', e => { if (pref === 'auto' && e.pointerType === 'touch' && seen !== 'touch') { seen = 'touch'; emit(); } }, { capture: true, passive: true });
  W.addEventListener('keydown', e => { if (pref === 'auto' && seen !== 'key' && !typing(e) && GAME_KEYS.has(keyName(e))) { seen = 'key'; emit(); } }, true);
  const mq = W.matchMedia?.('(pointer: coarse)');
  mq?.addEventListener?.('change', () => { if (!seen) emit(); });
  if (W.document?.documentElement) emit();
}
