// 연출: 시즌 진행 화면, 성장 공개, 수상 세리머니(픽셀 불꽃놀이), 새 시즌 타이틀, 드래프트 지명, 계약 서명,
// 부상, 은퇴식, 카드 뽑기, 빅게임 VS 화면. 모두 Promise를 돌려주고, 탭하거나 '건너뛰기'로 넘길 수 있습니다.
const esc = v => String(v ?? '').replace(/[&<>"']/g, x => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[x]));
const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = ms => new Promise(r => setTimeout(r, ms));
let root = null, active = null;
function host() { root ||= document.getElementById('fx-root'); return root; }

// 오버레이 하나를 띄우고, 닫힐 때 resolve.
function overlay(html, { cls = '', tapToClose = true, auto = 0, particles = null, skip = true } = {}) {
  const el = host();
  return new Promise(resolve => {
    let closed = false, timer = null, stopFx = null;
    const close = val => { if (closed) return; closed = true; clearTimeout(timer); stopFx?.(); el.innerHTML = ''; active = null; resolve(val); };
    el.innerHTML = `<div class="fx ${cls}" role="dialog" aria-modal="true">${particles ? '<canvas class="fx-canvas" width="160" height="240" aria-hidden="true"></canvas>' : ''}<div class="fx-body">${html}</div>${skip ? '<button class="fx-skip" data-fx="skip">건너뛰기</button>' : ''}</div>`;
    const box = el.firstElementChild;
    if (particles) stopFx = runParticles(box.querySelector('.fx-canvas'), particles);
    box.addEventListener('click', e => { if (e.target.closest('[data-fx="skip"]') || (tapToClose && !e.target.closest('button:not([data-fx])'))) close('skip'); if (e.target.closest('[data-fx="ok"]')) close('ok'); });
    if (auto) timer = setTimeout(() => close('auto'), auto);
    active = { close, box };
  });
}
export const fxBusy = () => !!active;
export function closeFx() { active?.close('skip'); }

// ───────── 픽셀 파티클 ─────────
function runParticles(canvas, kind) {
  const ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height, P = [];
  const colors = ['#F2C230', '#FFFFFF', '#E85A5A', '#5AB4F0', '#6BD88A', '#F08A24'];
  let raf = 0, t = 0;
  const firework = () => { const x = 20 + Math.random() * (W - 40), y = 30 + Math.random() * 80, c = colors[Math.floor(Math.random() * colors.length)]; for (let i = 0; i < 26; i++) { const a = i / 26 * Math.PI * 2, v = .6 + Math.random() * .9; P.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 40 + Math.random() * 20, c, g: .02 }); } };
  const frame = () => {
    t++;
    ctx.clearRect(0, 0, W, H);
    if (kind === 'fireworks' && t % 22 === 1) firework();
    if ((kind === 'confetti' || kind === 'fireworks') && t % 2 === 0) for (let i = 0; i < 2; i++) P.push({ x: Math.random() * W, y: -4, vx: (Math.random() - .5) * .4, vy: .7 + Math.random() * .8, life: 300, c: colors[Math.floor(Math.random() * colors.length)], g: 0, sway: Math.random() * 6 });
    if (kind === 'rain') for (let i = 0; i < 4; i++) P.push({ x: Math.random() * W, y: -6, vx: -.3, vy: 3 + Math.random() * 2, life: 120, c: '#8FB4E8', g: 0, len: 4 });
    for (let i = P.length - 1; i >= 0; i--) {
      const p = P[i]; p.life--; p.vy += p.g; p.x += p.vx + (p.sway ? Math.sin((t + p.sway * 10) / 10) * .3 : 0); p.y += p.vy;
      if (p.life <= 0 || p.y > H + 6) { P.splice(i, 1); continue; }
      ctx.fillStyle = p.c; ctx.fillRect(Math.round(p.x), Math.round(p.y), p.len ? 1 : 2, p.len || 2);
    }
    raf = requestAnimationFrame(frame);
  };
  if (!reduced()) raf = requestAnimationFrame(frame);
  return () => cancelAnimationFrame(raf);
}

// ───────── 시즌 진행 화면 (경기별 결과가 하나씩) ─────────
// games: [{tag, opp, res, pf, pa, line, grade, big}]
export async function seasonPlayback({ title, sub, sceneA, sceneB, games, w0 = 0, l0 = 0 }) {
  if (!games.length || reduced()) return;
  const rows = games.map((g, i) => `<li style="animation-delay:${i * 260}ms" class="${g.res === 'W' ? 'win' : 'loss'} ${g.big ? 'big' : ''}"><span class="tag">${esc(g.tag)}</span><span class="grow"><b>${g.res === 'W' ? '승' : '패'} ${g.pf}-${g.pa}</b> ${esc(g.opp)}<small>${esc(g.line)}</small></span><span class="gr">${g.grade ?? '-'}</span></li>`).join('');
  const dur = games.length * 260 + 900;
  const p = overlay(`<div class="fx-season">
    <div class="px-anim">${sceneA ? `<img class="px scene" src="${sceneA}" alt="">` : ''}${sceneB ? `<img class="px scene f2" src="${sceneB}" alt="">` : ''}</div>
    <p class="eyebrow" style="margin-top:12px">${esc(sub || '')}</p><h2>${esc(title)}</h2>
    <div class="fx-wl"><b id="fx-w">${w0}</b>승 <b id="fx-l">${l0}</b>패</div>
    <div class="fx-progress"><i style="animation-duration:${dur}ms"></i></div>
    <ul class="fx-games">${rows}</ul></div>`, { cls: 'dark', auto: dur + 700 });
  // 승패 카운터
  let w = w0, l = l0;
  games.forEach((g, i) => setTimeout(() => { if (!active) return; if (g.res === 'W') w++; else l++; const a = document.getElementById('fx-w'), b = document.getElementById('fx-l'); if (a) a.textContent = w; if (b) b.textContent = l; }, i * 260 + 200));
  return p;
}

// ───────── 성장 공개 ─────────
// items: [{label, before, after, focus}]
export async function growthReveal({ year, label, ovrBefore, ovrAfter, items, breakout, crossed = [] }) {
  if (reduced()) return;
  const tiles = items.map((x, i) => { const d = x.after - x.before; return `<div class="g ${x.focus ? 'focus' : ''}" style="animation-delay:${300 + i * 180}ms"><small>${esc(x.label)}</small><b data-count="${x.before}>${x.after}" data-delay="${300 + i * 180}">${x.before}</b><em class="${d > 0 ? 'up' : d < 0 ? 'down' : ''}">${d > 0 ? `▲${d}` : d < 0 ? `▼${-d}` : '유지'}</em></div>`; }).join('');
  const html = `<div class="fx-growth"><p class="eyebrow">${esc(year)} 시즌 성장</p><h2>종합 <b class="ovr-from">${ovrBefore}</b> → <b class="ovr-to" data-count="${ovrBefore}>${ovrAfter}" data-delay="${300 + items.length * 180}">${ovrBefore}</b></h2>
    <div class="growth-grid">${tiles}</div>
    ${breakout ? `<p class="fx-tag pop" style="animation-delay:${400 + items.length * 180}ms">⚡ ${esc(breakout)} 급성장!</p>` : ''}
    ${crossed.map(c => `<p class="fx-tag green pop" style="animation-delay:${500 + items.length * 180}ms">${esc(c)} 진입</p>`).join('')}
    <button class="primary" data-fx="ok" style="margin-top:16px">결과 보기</button></div>`;
  const p = overlay(html, { cls: 'light', tapToClose: false, particles: ovrAfter - ovrBefore >= 5 ? 'confetti' : null });
  countUp(host());
  return p;
}
function countUp(el) {
  el.querySelectorAll('[data-count]').forEach(b => {
    const [from, to] = b.dataset.count.split('>').map(Number), delay = +b.dataset.delay || 0, dur = 650;
    setTimeout(() => { const t0 = performance.now(); const step = now => { const k = Math.min(1, (now - t0) / dur); b.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3))); if (k < 1 && b.isConnected) requestAnimationFrame(step); else b.classList.add('done'); }; requestAnimationFrame(step); }, delay);
  });
}

// ───────── 수상 세리머니 ─────────
export async function ceremony({ eyebrow, title, sub, icon, sprite, colors = ['#157347', '#FFFFFF'] }) {
  if (reduced()) return;
  return overlay(`<div class="fx-ceremony" style="--team:${colors[0]}">
    <div class="spot"></div>
    ${icon ? `<img class="px fx-trophy" src="${icon}" alt="">` : ''}
    ${sprite ? `<img class="px fx-hero" src="${sprite}" alt="">` : ''}
    <p class="eyebrow">${esc(eyebrow || '')}</p><h2>${esc(title)}</h2>${sub ? `<p class="lead">${esc(sub)}</p>` : ''}
    <p class="tiny" style="opacity:.7;margin-top:14px">화면을 탭하면 계속</p></div>`, { cls: 'dark', particles: 'fireworks', skip: false });
}
// ───────── 새 시즌 타이틀 카드 ─────────
export async function titleCard({ year, label, sub, scene }) {
  if (reduced()) return;
  return overlay(`<div class="fx-title">${scene ? `<img class="px scene" src="${scene}" alt="">` : ''}<div class="year">${esc(year)}</div><h2>${esc(label)}</h2>${sub ? `<p class="lead">${esc(sub)}</p>` : ''}</div>`, { cls: 'dark', auto: 2100 });
}
// ───────── 드래프트 지명 ─────────
export async function draftReveal({ year, round, inRound, pick, team, colors, scene, drafted }) {
  if (reduced()) return;
  if (!drafted) return overlay(`<div class="fx-draft"><p class="eyebrow">${esc(year)} NFL 드래프트 · 3일째 밤</p><h2>이름이 불리지 않았다</h2><p class="lead">휴대폰이 울리기 시작한다. 언드래프티 FA로 기회를 찾자.</p>${scene ? `<img class="px scene" src="${scene}" alt="">` : ''}</div>`, { cls: 'dark', particles: 'rain' });
  const p = overlay(`<div class="fx-draft"><p class="eyebrow">${esc(year)} NFL 드래프트 · ${round}라운드</p>
    <div class="pick-in"><span>THE PICK IS IN</span></div>
    <div class="reveal" style="--team:${colors[0]}"><small>전체 ${pick}순위 · ${round}라운드 ${inRound}번째</small><h2>${esc(team)}</h2></div>
    ${scene ? `<img class="px scene reveal-scene" src="${scene}" alt="">` : ''}</div>`, { cls: 'dark', particles: 'fireworks', skip: false });
  return p;
}
// ───────── 계약 서명 ─────────
export async function signing({ team, years, total, aav, colors = ['#157347', '#fff'] }) {
  if (reduced()) return;
  return overlay(`<div class="fx-sign" style="--team:${colors[0]}"><div class="paper"><p class="eyebrow">선수 계약서</p><h3>${esc(team)}</h3>
    <div class="kv"><span>기간</span><b>${esc(years)}년</b></div><div class="kv"><span>총액</span><b>${esc(total)}</b></div><div class="kv"><span>연봉</span><b>${esc(aav)}</b></div>
    <svg class="sig" viewBox="0 0 200 50" aria-hidden="true"><path d="M8 34c12-22 20-24 22-6s8 10 16-6 14-8 12 6 10 12 20-6 18-14 18 2 12 14 30 0 22-12 40-6"/></svg>
    <div class="stamp">계약 완료</div></div></div>`, { cls: 'dark', auto: 3000 });
}
// ───────── 부상 ─────────
export async function injury({ kind, games, scene }) {
  if (reduced()) return;
  return overlay(`<div class="fx-injury"><div class="flash"></div>${scene ? `<img class="px scene" src="${scene}" alt="">` : ''}<p class="eyebrow">부상 발생</p><h2>${esc(kind)}</h2><p class="lead">${esc(games)}</p></div>`, { cls: 'dark', particles: 'rain', auto: 2600 });
}
// ───────── 은퇴식 ─────────
export async function retirement({ name, number, team, scene, retired }) {
  if (reduced()) return;
  return overlay(`<div class="fx-retire">${scene ? `<img class="px scene" src="${scene}" alt="">` : ''}
    <div class="banner"><b>${esc(number)}</b><span>${esc(name)}</span></div>
    <p class="eyebrow">${esc(team || '')}</p><h2>${retired ? `${esc(number)}번 영구결번` : '마지막 인사'}</h2><p class="lead">관중이 모두 일어나 박수를 보낸다.</p></div>`, { cls: 'dark', particles: 'fireworks', skip: false });
}
// ───────── 카드 뽑기 ─────────
export async function gachaReveal(cards) {
  if (reduced() || !cards.length) return;
  const html = `<div class="fx-gacha"><p class="eyebrow">훈련 카드 ${cards.length}장</p><div class="cards">${cards.map((c, i) => `<div class="gcard ${c.rarity}" style="animation-delay:${i * 380}ms"><div class="back"></div><div class="front"><small>${esc(c.rarityName)}</small><b>${esc(c.name)}</b><span>${esc(c.lines.join(' · '))}</span></div></div>`).join('')}</div><button class="primary" data-fx="ok" style="margin-top:16px">확인</button></div>`;
  return overlay(html, { cls: 'dark', tapToClose: false, particles: cards.some(c => c.rarity === 'legend' || c.rarity === 'epic') ? 'fireworks' : null });
}
// ───────── 빅게임 VS ─────────
export async function versus({ title, me, opp, myColors, oppColors, scene }) {
  if (reduced()) return;
  return overlay(`<div class="fx-vs">${scene ? `<img class="px scene" src="${scene}" alt="">` : ''}<p class="eyebrow">BIG GAME</p><h2>${esc(title)}</h2>
    <div class="vs-row"><span style="--team:${myColors[0]}">${esc(me)}</span><b>VS</b><span style="--team:${oppColors[0]}">${esc(opp)}</span></div></div>`, { cls: 'dark', auto: 1900 });
}
// ───────── 경기 결과 (빅게임 뒤) ─────────
export async function gameResult({ title, win, pf, pa, me, opp, line, grade, sprite, ot }) {
  if (reduced()) return;
  return overlay(`<div class="fx-result ${win ? 'win' : 'loss'}">${sprite ? `<img class="px fx-hero" src="${sprite}" alt="">` : ''}<p class="eyebrow">${esc(title)}${ot ? ' · 연장' : ''}</p><h2>${win ? '승리!' : '패배'}</h2>
    <div class="score"><span>${esc(me)}</span><b>${pf} : ${pa}</b><span>${esc(opp)}</span></div><p class="lead">${esc(line || '')}</p><p class="tiny">내 평점 ${grade}</p></div>`, { cls: 'dark', particles: win ? 'confetti' : 'rain', skip: false });
}
export { wait };
