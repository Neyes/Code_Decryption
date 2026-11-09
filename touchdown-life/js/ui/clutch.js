// 빅게임 직접 플레이 (터치 미니게임).
// 공격: 플레이 콜 → 타이밍 미터를 탭 → 결과가 필드에서 움직입니다. 4번째 다운·2점 컨버전도 직접 정합니다.
// 수비: 상대 포메이션을 읽고 수비 콜 → 타이밍. 키커: 파워·정확도 두 번 탭. 펀터: 비거리·방향.
import { POSITIONS, LEVEL_AVG, clamp } from '../engine/core.js';
import { spriteCanvas, bigText, pixelText, vivid, shade, OUT } from './pixel.js';
import { runLivePlay, conceptsFor, CONCEPTS, DEF_CALLS } from './liveplay.js';
const LIVE_POS = new Set(['QB', 'RB', 'WR', 'TE', 'CB', 'S', 'LB', 'EDGE', 'DT']);
const LIVE_TELLS = { run: TELLS_RUN(), pass: ['샷건, 리시버 넷이 넓게', '트립스 오른쪽', '엠티 백필드, 리시버 다섯', '쿼터백이 세이프티를 오래 본다'] };
function TELLS_RUN() { return ['I 포메이션, 풀백이 보인다', '타이트 엔드 둘, 헤비 세트', '러닝백이 쿼터백 바로 뒤에']; }

const W = 192, H = 96, YARDS = 48, PPY = W / YARDS;
const R = Math.random;
const pick = a => a[Math.floor(R() * a.length)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, x => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[x]));

// 포지션별 플레이 콜. base·spread 야드, attr 관련 능력치, speed 바늘 속도, risk 실패 시 위험, w 성공 구간 배율
const PLAYS = {
  QB: [
    { id: 'slant', name: '퀵 슬랜트', note: '안전 · 짧게', base: 6, spread: 4, attr: 'acc', speed: 1, w: 1.15, kind: 'pass', fail: { int: .05 } },
    { id: 'pa', name: '플레이 액션 아웃', note: '보통 · 중거리', base: 13, spread: 6, attr: 'vis', speed: 1.25, w: 1, kind: 'pass', fail: { int: .09, sack: .3 } },
    { id: 'post', name: '딥 포스트', note: '모험 · 한 방', base: 30, spread: 18, attr: 'arm', speed: 1.6, w: .78, kind: 'deep', fail: { int: .22 } },
    { id: 'scramble', name: 'QB 스크램블', note: '기동력', base: 7, spread: 9, attr: 'mob', speed: 1.15, w: 1, kind: 'run', fail: { sack: .5 }, need: p => (p.attrs.mob ?? 0) >= 55 },
  ],
  RB: [
    { id: 'inside', name: '인사이드 존', note: '안전 · 힘으로', base: 4, spread: 3, attr: 'carry', speed: 1, w: 1.15, kind: 'run', fail: { fumble: .03 } },
    { id: 'sweep', name: '아웃사이드 스윕', note: '보통 · 바깥으로', base: 7, spread: 10, attr: 'spd', speed: 1.35, w: .95, kind: 'run', fail: { loss: 3 } },
    { id: 'screen', name: '스크린 패스', note: '보통 · 받아서 달리기', base: 8, spread: 10, attr: 'hands', speed: 1.2, w: 1, kind: 'pass', fail: {} },
    { id: 'wildcat', name: '와일드캣 다이렉트 스냅', note: '모험 · 트릭', base: 13, spread: 16, attr: 'vis', speed: 1.7, w: .75, kind: 'run', fail: { fumble: .15 } },
  ],
  WR: [
    { id: 'slant', name: '슬랜트', note: '안전 · 짧게', base: 7, spread: 4, attr: 'hands', speed: 1, w: 1.15, kind: 'pass', fail: { int: .04 } },
    { id: 'comeback', name: '컴백 루트', note: '보통 · 끊어 받기', base: 12, spread: 5, attr: 'route', speed: 1.25, w: 1, kind: 'pass', fail: { int: .07 } },
    { id: 'go', name: '고 루트', note: '모험 · 직선 승부', base: 32, spread: 16, attr: 'spd', speed: 1.6, w: .78, kind: 'deep', fail: { int: .12 } },
    { id: 'reverse', name: '엔드 어라운드', note: '트릭 · 직접 달리기', base: 9, spread: 14, attr: 'agi', speed: 1.5, w: .85, kind: 'run', fail: { loss: 5, fumble: .05 } },
  ],
  TE: [
    { id: 'flat', name: '블로킹 후 플랫', note: '안전', base: 5, spread: 6, attr: 'hands', speed: 1, w: 1.15, kind: 'pass', fail: {} },
    { id: 'seam', name: '시엄 루트', note: '보통 · 가운데 돌파', base: 15, spread: 8, attr: 'route', speed: 1.3, w: .95, kind: 'pass', fail: { int: .08 } },
    { id: 'wheel', name: '휠 루트', note: '모험 · 사이드라인 딥', base: 26, spread: 14, attr: 'spd', speed: 1.55, w: .8, kind: 'deep', fail: { int: .1 } },
  ],
  OL: [
    { id: 'pass', name: '패스 프로텍션', note: 'QB를 지켜라', base: 11, spread: 12, attr: 'pblk', speed: 1.2, w: 1, kind: 'pass', fail: { sack: .7 } },
    { id: 'double', name: '더블팀 런 블록', note: '안전 · 힘으로', base: 5, spread: 4, attr: 'rblk', speed: 1, w: 1.15, kind: 'run', fail: { loss: 1 } },
    { id: 'pull', name: '풀링 블록 (스윕 리드)', note: '모험 · 바깥으로 길을 연다', base: 9, spread: 12, attr: 'agi', speed: 1.45, w: .85, kind: 'run', fail: { loss: 3 } },
  ],
};
// 수비 콜: 상대 플레이(run/short/deep)에 맞으면 성공 구간이 넓어집니다.
const DCALLS = {
  front: [{ id: 'speed', name: '스피드 러시', note: '패스에 강함', beats: ['short', 'deep'], attr: 'spd' }, { id: 'bull', name: '불 러시 (힘으로 밀기)', note: '모두 무난', beats: ['run', 'short', 'deep'], weak: true, attr: 'str' }, { id: 'gap', name: '런 갭 지키기', note: '런에 강함', beats: ['run'], attr: 'rdef' }],
  lb: [{ id: 'blitz', name: 'A갭 블리츠', note: '패스에 강함', beats: ['short', 'deep'], attr: 'rush' }, { id: 'fill', name: '런 갭 메우기', note: '런에 강함', beats: ['run'], attr: 'tkl' }, { id: 'zone', name: '존 드롭', note: '짧은 패스에 강함', beats: ['short'], attr: 'cov' }],
  db: [{ id: 'press', name: '프레스 맨투맨', note: '짧은 패스에 강함', beats: ['short'], attr: 'cov' }, { id: 'cover2', name: '딥 존 (커버 2)', note: '긴 패스에 강함', beats: ['deep'], attr: 'vis' }, { id: 'nickel', name: '나켈 블리츠', note: '런·짧은 패스', beats: ['run', 'short'], attr: 'tkl' }],
};
const TELLS = { run: ['I 포메이션, 풀백이 보인다', '타이트 엔드 둘, 헤비 세트', '러닝백이 QB 바로 뒤에'], short: ['샷건, 리시버 셋이 가까이', '트립스 오른쪽, 짧은 간격', '버블 스크린 냄새'], deep: ['엠티 백필드, 리시버 다섯', '와이드 리시버가 넓게 벌어졌다', 'QB가 세이프티를 오래 본다'] };

export function openClutch(root, ctx) {
  return new Promise(resolve => new Clutch(root, ctx, resolve));
}

class Clutch {
  constructor(root, c, done) {
    this.root = root; this.c = c; this.done = done;
    const p = c.player, g = c.game;
    this.p = p; this.pos = p.pos; this.side = POSITIONS[p.pos].side; this.live = LIVE_POS.has(p.pos);
    this.mode = p.pos === 'K' ? 'kick' : p.pos === 'P' ? 'punt' : this.side === 'D' ? 'defense' : 'offense';
    this.final = !!g.final;
    this.drivesTotal = this.mode === 'kick' || this.mode === 'punt' ? (this.final ? 4 : 3) : (this.final ? 4 : 3);
    this.drive = 0;
    this.me = { colors: c.colors, avatar: p.avatar, number: p.number };
    this.oppColors = c.oppColors;
    // 미니게임 밖에서 쌓이는 양 팀 점수 (쿼터별로 나눠 전광판에 반영)
    const lvl = c.levelAvg, myStr = g.myStr ?? 60, oppStr = g.oppStr ?? 60;
    const td = x => Math.max(0, Math.round(x)) * 7;
    this.restFor = this.mode === 'offense' ? td(.5 + (myStr - oppStr) * .02 + R() * 1.2) : this.mode === 'kick' ? td(1.6 + (myStr - oppStr) * .03 + R() * 1.4) : td(1.8 + (myStr - oppStr) * .03 + R() * 1.6);
    this.restAgainst = this.mode === 'defense' ? td(.5 + (oppStr - myStr) * .02 + R() * 1.2) : td(1.6 + (oppStr - myStr) * .03 + R() * 1.6);
    this.pf = 0; this.pa = 0;
    this.line = {}; this.snaps = []; this.log = [];
    this.rel = p.ovr - (lvl + (oppStr - 60) * .1);
    this.cam = 25; this.anim = null; this.fx = [];
    this.build();
    this.startDrive();
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
  }
  // ───────── 화면 ─────────
  build() {
    const c = this.c;
    this.root.innerHTML = `<div class="clutch" role="dialog" aria-modal="true" aria-label="빅게임 직접 플레이">
      <div class="cl-board"><div class="cl-team"><small>${esc(c.myName)}</small><b id="cl-pf">0</b></div><div class="cl-mid"><span id="cl-q" class="cl-q">1Q</span><small id="cl-dd"></small></div><div class="cl-team"><small>${esc(c.oppName)}</small><b id="cl-pa">0</b></div></div>
      <div class="cl-title">${esc(c.game.title || c.game.round || '빅게임')}</div>
      <canvas id="cl-field" width="${W}" height="${H}" class="cl-field" aria-label="필드"></canvas><div id="cl-live" class="cl-live" hidden></div>
      <p id="cl-msg" class="cl-msg"></p>
      <div id="cl-actions" class="cl-actions"></div>
      <div class="cl-foot"><button class="ghost" data-cl="auto">자동으로 마무리</button></div></div>`;
    this.canvas = this.root.querySelector('#cl-field');
    this.ctx = this.canvas.getContext('2d'); this.ctx.imageSmoothingEnabled = false;
    this.root.querySelector('[data-cl="auto"]').onclick = () => this.finish(true);
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
  actions(html) { this.$('cl-actions').innerHTML = html; }
  spot(y) { return y >= 50 ? `상대 진영 ${100 - y}` : y === 50 ? '미드필드' : `자기 진영 ${y}`; }
  dd() { const d = this.d; return d ? `${['', '1st', '2nd', '3rd', '4th'][d.down]} & ${d.goal ? 'Goal' : d.toGo} · ${this.spot(d.ball)}` : ''; }

  // ───────── 드라이브 ─────────
  startDrive() {
    if (this.drive >= this.drivesTotal) return this.finish(false);
    const last = this.drive === this.drivesTotal - 1;
    const [rf, ra] = this.restSoFar(), me = rf + this.pf, op = ra + this.pa;
    const story = last ? (me < op ? '역전이 필요하다! 마지막 드라이브' : me > op ? '승리를 굳힐 마지막 기회' : '동점, 운명의 마지막 드라이브') : ['1쿼터, 첫 번째 결정적 순간', '흐름을 가져올 때', '후반전, 승부처', '4쿼터'][this.quarter() - 1];
    if (this.mode === 'kick') return this.kickSetup(story, last);
    if (this.mode === 'punt') return this.puntSetup(story);
    const start = 20 + Math.floor(R() * 16);
    this.d = { ball: start, down: 1, toGo: 10, first: start + 10, snaps: 0, offense: this.mode === 'offense' };
    this.cam = clamp(start + 10, 24, 76);
    this.board(this.dd());
    this.msg(`<b>${esc(story)}</b><br>${this.mode === 'offense' ? '우리 공격. 플레이를 고르세요.' : '상대 공격. 포메이션을 읽고 수비를 고르세요.'}`);
    this.mode === 'offense' ? this.offensePick() : this.defensePick();
  }
  endDrive(text) {
    this.log.push(text);
    this.drive++;
    this.board(this.dd());
    this.actions(`<button class="primary" data-cl="next">${this.drive >= this.drivesTotal ? '경기 결과 보기' : '다음 장면'}</button>`);
    this.root.querySelector('[data-cl="next"]').onclick = () => this.startDrive();
  }
  // ───────── 공격 ─────────
  offensePick() {
    const d = this.d, plays = (PLAYS[this.pos] || PLAYS.WR).filter(x => !x.need || x.need(this.p));
    if (d.down === 4) {
      const dist = 100 - d.ball + 17;
      const opts = [`<button class="choice" data-go="go"><strong>고! 4번째 다운 승부</strong><div class="hint">${d.toGo}야드를 가야 한다</div></button>`];
      if (dist <= 57) opts.push(`<button class="choice" data-go="fg"><strong>필드골 시도 (${dist}야드)</strong><div class="hint">팀 키커에게 맡긴다</div></button>`);
      opts.push(`<button class="choice" data-go="punt"><strong>펀트</strong><div class="hint">필드 포지션을 지킨다</div></button>`);
      this.msg(`<b>4th & ${d.toGo}</b> · 감독이 나를 본다. 어떻게 할까?`);
      this.actions(opts.join(''));
      this.root.querySelectorAll('[data-go]').forEach(b => b.onclick = () => {
        const v = b.dataset.go;
        if (v === 'go') return this.showPlays(plays);
        if (v === 'fg') { const ok = R() < clamp(.97 - (dist - 20) * .013, .3, .97); if (ok) this.pf += 3; this.pop(ok ? 'GOOD!' : 'NO GOOD', ok ? '#F2C230' : '#E85A5A'); return this.endDrive(ok ? `${dist}야드 필드골 성공` : `${dist}야드 필드골 실패`); }
        this.pop('PUNT', '#FFFFFF'); return this.endDrive('펀트로 공격권을 넘겼다');
      });
      return;
    }
    this.showPlays(plays);
  }
  showPlays(plays) {
    this.board(this.dd());
    if (this.live) return this.showConcepts(c => this.runLive({ concept: c }).then(o => this.resolveLive(o)));
    this.actions(plays.map((x, i) => `<button class="choice" data-play="${i}"><strong>${esc(x.name)}</strong><div class="hint">${esc(x.note)}</div></button>`).join(''));
    this.root.querySelectorAll('[data-play]').forEach(b => b.onclick = () => this.meter(plays[+b.dataset.play], zone => this.resolveOffense(plays[+b.dataset.play], zone)));
  }
  resolveOffense(play, zone) {
    const d = this.d, P = this.pos, L = this.line, f = play.fail || {};
    let yards = 0, text = '', turnover = null, sack = false, incomplete = false;
    const big = zone === 'perfect' && R() < (play.kind === 'deep' ? .45 : .16);
    if (zone === 'perfect') yards = Math.round(play.base + play.spread * (.6 + R() * .6) + (big ? 15 + R() * 25 : 0));
    else if (zone === 'good') yards = Math.round(play.base + play.spread * (R() - .35));
    else {
      if (f.int && R() < f.int * 2.2) turnover = 'INT';
      else if (f.fumble && R() < f.fumble * 3) turnover = 'FUMBLE';
      else if (f.sack && R() < f.sack) { sack = true; yards = -6 - Math.floor(R() * 4); }
      else if (play.kind !== 'run') incomplete = true;
      else yards = -(f.loss || 1) + Math.floor(R() * 2);
    }
    const target = Math.min(100, d.ball + yards);
    // 스탯
    const passer = P === 'QB', receiver = ['WR', 'TE', 'RB'].includes(P) && play.kind !== 'run', runner = play.kind === 'run' && P !== 'OL' && P !== 'QB' || (P === 'QB' && play.id === 'scramble');
    const gain = target - d.ball, td = target >= 100;
    if (passer && play.kind !== 'run') { inc(L, 'att'); if (!incomplete && !turnover && !sack) { inc(L, 'cmp'); inc(L, 'pyds', gain); if (td) inc(L, 'ptd'); } if (turnover === 'INT') inc(L, 'pint'); }
    if (receiver) { inc(L, 'tgt'); if (!incomplete && !turnover) { inc(L, 'rec'); inc(L, 'recyds', gain); if (td) inc(L, 'rectd'); } }
    if (runner) { inc(L, 'ratt'); if (!turnover) { inc(L, 'ryds', gain); if (td) inc(L, 'rtd'); } if (turnover === 'FUMBLE') inc(L, 'fum'); }
    if (P === 'OL') { if (sack) inc(L, 'sa'); if (zone === 'perfect') inc(L, 'pan'); }
    this.snap(zone, td, !!turnover);
    // 애니메이션
    const from = d.ball;
    const carrierPose = turnover ? 'sad' : td ? 'cheer' : 'run';
    if (turnover) text = turnover === 'INT' ? '인터셉트! 공격권을 잃었다.' : '펌블! 상대가 공을 덮쳤다.';
    else if (sack) text = `색. ${-yards}야드 손실.`;
    else if (incomplete) text = '패스 인컴플리트.';
    else text = td ? '터치다운!' : `${gain >= 0 ? `${gain}야드 전진` : `${-gain}야드 손실`}${big ? ' · 빅 플레이!' : ''}`;
    this.animate(from, turnover || incomplete ? from : target, carrierPose, () => {
      if (turnover) { this.pop(turnover === 'INT' ? 'INTERCEPTED' : 'FUMBLE', '#E85A5A'); return this.endDrive(text); }
      if (td) { this.pop('TOUCHDOWN!', '#F2C230', true); this.pf += 6; return this.afterTD(); }
      if (!incomplete) d.ball = target;
      d.snaps++;
      if (d.ball >= d.first) { d.down = 1; d.toGo = Math.min(10, 100 - d.ball); d.goal = 100 - d.ball <= 10; d.first = d.ball + d.toGo; this.pop('FIRST DOWN', '#FFFFFF'); }
      else { d.down++; d.toGo = d.first - d.ball; }
      if (d.down > 4) { this.pop('TURNOVER', '#E85A5A'); return this.endDrive('4번째 다운 실패, 공격권 넘김'); }
      if (d.snaps >= 9) { const dist = 100 - d.ball + 17; if (dist <= 50 && R() < .8) { this.pf += 3; return this.endDrive(`시간에 쫓겨 ${dist}야드 필드골`); } return this.endDrive('시간이 다 됐다'); }
      this.msg(`${esc(text)}`);
      this.offensePick();
    });
  }
  afterTD() {
    this.board(this.dd());
    this.msg('<b>터치다운!</b> 추가 득점은?');
    this.actions(`<button class="choice" data-x="pat"><strong>PAT (1점)</strong><div class="hint">거의 확실하다</div></button><button class="choice" data-x="two"><strong>2점 컨버전</strong><div class="hint">2야드에서 한 번 더 승부</div></button>`);
    this.root.querySelector('[data-x="pat"]').onclick = () => { const ok = R() < .95; if (ok) this.pf += 1; this.endDrive(ok ? '터치다운 + PAT' : '터치다운, PAT 실패'); };
    this.root.querySelector('[data-x="two"]').onclick = () => {
      if (this.live) {
        this.msg('2점 컨버전! 플레이를 고르세요.');
        const save = this.d; this.d = { ...save, ball: 98, toGo: 2, first: 100, goal: true };
        return this.showConcepts(c => this.runLive({ concept: c }).then(o => {
          this.d = save; const ok = !!o.td; this.mergeStats(o.stats); if (ok) this.pf += 2; this.snap(ok ? 'perfect' : 'miss', ok, false);
          this.pop(ok ? '2 POINTS!' : 'NO GOOD', ok ? '#F2C230' : '#E85A5A', ok); this.endDrive(ok ? '터치다운 + 2점 컨버전 성공' : '터치다운, 2점 컨버전 실패');
        }));
      }
      const plays = (PLAYS[this.pos] || PLAYS.WR).filter(x => !x.need || x.need(this.p));
      this.msg('2점 컨버전! 플레이를 고르세요.');
      this.actions(plays.map((x, i) => `<button class="choice" data-two="${i}"><strong>${esc(x.name)}</strong></button>`).join(''));
      this.root.querySelectorAll('[data-two]').forEach(b => b.onclick = () => this.meter(plays[+b.dataset.two], zone => {
        const ok = zone !== 'miss'; if (ok) this.pf += 2; this.snap(zone, ok, false);
        this.pop(ok ? '2 POINTS!' : 'NO GOOD', ok ? '#F2C230' : '#E85A5A', ok);
        this.endDrive(ok ? '터치다운 + 2점 컨버전 성공' : '터치다운, 2점 컨버전 실패');
      }));
    };
  }
  // ───────── 수비 ─────────
  defensePick() {
    if (this.live) return this.defenseLive();
    const d = this.d, group = ['DT', 'EDGE'].includes(this.pos) ? 'front' : this.pos === 'LB' ? 'lb' : 'db';
    // 상대 플레이 (상황에 맞게) + 70% 맞는 힌트
    const toGoal = 100 - d.ball;
    const w = d.toGo >= 8 ? { run: .25, short: .45, deep: .3 } : d.toGo <= 2 ? { run: .6, short: .3, deep: .1 } : { run: .4, short: .4, deep: .2 };
    if (toGoal < 20) { w.deep = .05; w.short += .1; }
    let roll = R(), playType = 'run';
    for (const [k, v] of Object.entries(w)) { if (roll < v) { playType = k; break; } roll -= v; }
    const tellType = R() < .7 ? playType : pick(Object.keys(TELLS).filter(k => k !== playType));
    this.oppPlay = playType;
    this.board(this.dd());
    this.msg(`상대 포메이션: <b>${esc(pick(TELLS[tellType]))}</b>`);
    const calls = DCALLS[group];
    this.actions(calls.map((x, i) => `<button class="choice" data-call="${i}"><strong>${esc(x.name)}</strong><div class="hint">${esc(x.note)}</div></button>`).join(''));
    this.root.querySelectorAll('[data-call]').forEach(b => b.onclick = () => {
      const call = calls[+b.dataset.call], match = call.beats.includes(playType);
      this.meter({ ...call, speed: playType === 'deep' ? 1.45 : 1.2, w: match ? (call.weak ? 1.05 : 1.4) : .62 }, zone => this.resolveDefense(call, match, zone));
    });
  }
  resolveDefense(call, match, zone) {
    const d = this.d, P = this.pos, L = this.line, t = this.oppPlay;
    let gain = 0, text = '', takeaway = null, big = '';
    if (zone === 'perfect' && match) {
      if (t === 'run') { gain = -2 - Math.floor(R() * 3); inc(L, 'tkl'); inc(L, 'tfl'); big = 'TFL'; text = '백필드에서 러닝백을 잡았다!'; if (R() < .18) { takeaway = 'FF'; inc(L, 'ff'); } }
      else if (['DT', 'EDGE', 'LB'].includes(P) && call.id !== 'zone') { gain = -7 - Math.floor(R() * 4); inc(L, 'sack'); inc(L, 'tkl'); big = 'SACK!'; text = '쿼터백을 쓰러뜨렸다! 색!'; if (R() < .2) { takeaway = 'FF'; inc(L, 'ff'); } }
      else { takeaway = 'INT'; inc(L, 'dint'); inc(L, 'pd'); big = 'INTERCEPTION!'; text = '공을 낚아챘다! 인터셉트!'; if (R() < .25) { this.pf += 7; inc(L, 'dtd'); text = '인터셉트 후 엔드존까지! 픽식스!'; big = 'PICK SIX!'; } }
    } else if (zone === 'perfect' || (zone === 'good' && match)) {
      gain = t === 'run' ? Math.floor(R() * 3) : 0; inc(L, gain ? 'tkl' : 'pd');
      text = t === 'run' ? `${gain}야드에서 막았다.` : '패스를 쳐 냈다!';
    } else if (zone === 'good') {
      gain = t === 'run' ? 3 + Math.floor(R() * 4) : t === 'short' ? 5 + Math.floor(R() * 5) : 12 + Math.floor(R() * 10); inc(L, 'tkl');
      text = `${gain}야드를 내줬다.`;
    } else {
      gain = t === 'run' ? 8 + Math.floor(R() * 10) : t === 'short' ? 10 + Math.floor(R() * 8) : 25 + Math.floor(R() * 25);
      text = t === 'deep' ? '뚫렸다! 긴 패스를 허용했다.' : `${gain}야드 돌파를 허용했다.`;
    }
    this.snap(zone, !!takeaway, false, !!takeaway);
    const from = d.ball, target = Math.min(100, d.ball + gain);
    this.animate(from, takeaway === 'INT' ? from : target, takeaway ? 'cheer' : zone === 'miss' ? 'sad' : 'stance', () => {
      if (big) this.pop(big, '#F2C230', big === 'PICK SIX!' || big === 'SACK!');
      if (takeaway) return this.endDrive(takeaway === 'INT' ? (this.line.dtd ? '픽식스!' : '인터셉트로 공격권을 빼앗았다') : '강제 펌블로 공격권을 빼앗았다');
      if (target >= 100) { this.pa += 7; this.pop('TOUCHDOWN', '#E85A5A'); return this.endDrive('터치다운을 허용했다'); }
      d.ball = target; d.snaps++;
      if (d.ball >= d.first) { d.down = 1; d.toGo = Math.min(10, 100 - d.ball); d.goal = 100 - d.ball <= 10; d.first = d.ball + d.toGo; }
      else { d.down++; d.toGo = d.first - d.ball; }
      if (d.down === 4 || d.snaps >= 8) {
        const dist = 100 - d.ball + 17;
        if (dist <= 52) { const ok = R() < clamp(.95 - (dist - 20) * .012, .4, .95); if (ok) this.pa += 3; this.pop(ok ? 'FG GOOD' : 'FG MISS', ok ? '#E85A5A' : '#F2C230'); return this.endDrive(ok ? `상대 ${dist}야드 필드골` : `상대 ${dist}야드 필드골 실패`); }
        if (d.toGo <= 2 && d.ball >= 45 && R() < .5) { this.msg(`${esc(text)} 상대가 4번째 다운에 승부를 건다!`); return this.defensePick(); }
        this.pop('STOP!', '#F2C230'); return this.endDrive('수비 성공, 상대 펀트');
      }
      this.msg(esc(text));
      this.defensePick();
    });
  }
  // ───────── 실시간 플레이 ─────────
  showConcepts(cb) {
    const list = conceptsFor(this.pos);
    this.actions(`<p class="tiny" style="opacity:.75">${this.pos === 'QB' ? '스냅 뒤 원하는 곳을 탭하면 패스 · 끌면 스크램블 · 공을 넘기면 볼 캐리어를 조작' : '손가락을 대고 끌면 내 선수(노란 표시)가 달려요 · 공이 오면 노란 원으로'}</p>` + list.map((x, i) => `<button class="choice" data-cc="${i}"><strong>${esc(x.name)}</strong><div class="hint">${esc(x.note)}</div></button>`).join(''));
    this.root.querySelectorAll('[data-cc]').forEach(b => b.onclick = () => cb(list[+b.dataset.cc]));
  }
  async runLive({ concept, defCall = null }) {
    const c = this.c, g = c.game, d = this.d, offense = this.mode === 'offense';
    const lvl = c.levelAvg, myR = lvl + ((g.myStr ?? 60) - 60) * .12, oppR = lvl + ((g.oppStr ?? 60) - 60) * .12;
    const control = { QB: 'QB', RB: 'RB', WR: 'WR', TE: 'TE', CB: 'CB', S: 'S', LB: 'LB', EDGE: 'DL', DT: 'DL' }[this.pos];
    this.actions(''); this.msg(offense ? '스냅! 내 선수는 노란 표시예요.' : '상대가 스냅한다. 내 수비수(노란 표시)를 움직이세요.');
    const field = this.$('cl-field'), host = this.$('cl-live');
    field.hidden = true; host.hidden = false; this.liveActive = true;
    const out = await runLivePlay(host, {
      ball: d.ball, toGo: d.goal ? 100 - d.ball : d.toGo, concept, defCall, control, edge: this.pos === 'EDGE', side: offense ? 'O' : 'D',
      me: { attrs: this.p.attrs, ovr: this.p.ovr }, teamRating: offense ? myR : oppR, oppRating: offense ? oppR : myR,
      offColors: offense ? this.me.colors : this.oppColors, defColors: offense ? this.oppColors : this.me.colors,
      endzone: offense ? [this.me.colors[0], this.oppColors[0]] : [this.oppColors[0], this.me.colors[0]],
      away: (g.home === false) === offense ? 'O' : 'D', // 내가 원정이면 우리 팀이 흰 유니폼
      hint: offense ? (this.pos === 'QB' ? '탭: 패스 · 끌기: 이동 · 스페이스: 가장 빈 리시버' : '끌기: 이동 · 공을 들고 탭: 저크') : '끌기: 이동 · 볼 캐리어에 닿으면 태클',
    });
    host.hidden = true; host.innerHTML = ''; field.hidden = false; this.liveActive = false;
    return out;
  }
  mergeStats(st = {}) { for (const [k, v] of Object.entries(st)) inc(this.line, k, v); }
  resolveLive(o) {
    const d = this.d;
    this.mergeStats(o.stats);
    const zone = o.td || o.gain >= 15 ? 'perfect' : (!o.incomplete && !o.turnover && !o.sack && (o.gain >= Math.min(d.toGo, 5))) ? 'good' : 'miss';
    this.snap(zone, !!o.td, !!o.turnover);
    if (o.turnover) return this.endDrive(o.turnover === 'INT' ? '인터셉트! 공격권을 잃었다.' : '펌블! 공격권을 잃었다.');
    if (o.td) { this.pf += 6; this.pop('TOUCHDOWN!', '#F2C230', true); return this.afterTD(); }
    if (!o.incomplete) d.ball = clamp(d.ball + o.gain, 1, 99);
    d.snaps++;
    const text = o.incomplete ? '패스 인컴플리트.' : o.sack ? `색. ${-o.gain}야드 손실.` : o.gain >= 0 ? `${o.gain}야드 전진.` : `${-o.gain}야드 손실.`;
    if (d.ball >= d.first) { d.down = 1; d.toGo = Math.min(10, 100 - d.ball); d.goal = 100 - d.ball <= 10; d.first = d.ball + d.toGo; this.pop('FIRST DOWN', '#FFFFFF'); }
    else { d.down++; d.toGo = d.first - d.ball; }
    if (d.down > 4) { this.pop('TURNOVER', '#E85A5A'); return this.endDrive('4번째 다운 실패, 공격권 넘김'); }
    if (d.snaps >= 9) { const dist = 100 - d.ball + 17; if (dist <= 50 && R() < .8) { this.pf += 3; return this.endDrive(`시간에 쫓겨 ${dist}야드 필드골`); } return this.endDrive('시간이 다 됐다'); }
    this.cam = clamp(d.ball + 8, 24, 76);
    this.msg(esc(text));
    this.offensePick();
  }
  defenseLive() {
    const d = this.d, toGoal = 100 - d.ball;
    const pool = CONCEPTS.filter(c => !(toGoal < 20 && c.id === 'verts'));
    const runBias = d.toGo <= 2 ? .6 : d.toGo >= 8 ? .2 : .4;
    const runs = pool.filter(c => c.run), passes = pool.filter(c => !c.run);
    const concept = R() < runBias ? pick(runs) : pick(passes);
    const tellRun = R() < .7 ? !!concept.run : !concept.run;
    this.board(this.dd());
    this.msg(`상대 포메이션: <b>${esc(pick(tellRun ? LIVE_TELLS.run : LIVE_TELLS.pass))}</b>`);
    this.actions(`<p class="tiny" style="opacity:.75">수비 콜을 고르면 스냅. 손가락으로 내 수비수를 움직여 커버하고, 공이 떨어지는 노란 원으로 가면 인터셉트를 노릴 수 있어요.</p>` + DEF_CALLS.map((x, i) => `<button class="choice" data-dc="${i}"><strong>${esc(x.name)}</strong><div class="hint">${esc(x.note)}</div></button>`).join(''));
    this.root.querySelectorAll('[data-dc]').forEach(b => b.onclick = () => this.runLive({ concept, defCall: DEF_CALLS[+b.dataset.dc].id }).then(o => this.resolveLiveDefense(o)));
  }
  resolveLiveDefense(o) {
    const d = this.d;
    this.mergeStats(o.stats);
    const mine = o.stats || {}, big = mine.sack || mine.dint || mine.tfl || mine.ff;
    const zone = big || o.turnover ? 'perfect' : (o.incomplete || o.gain <= 3) ? 'good' : 'miss';
    this.snap(zone, !!big, !!o.td, !!o.turnover);
    if (o.turnover) { if (o.pickSix) this.pf += 7; return this.endDrive(o.turnover === 'INT' ? (o.pickSix ? '픽식스!' : '인터셉트로 공격권을 빼앗았다') : '펌블을 유도해 공격권을 빼앗았다'); }
    if (o.td) { this.pa += 7; return this.endDrive('터치다운을 허용했다'); }
    if (!o.incomplete) d.ball = clamp(d.ball + o.gain, 1, 99);
    d.snaps++;
    if (d.ball >= d.first) { d.down = 1; d.toGo = Math.min(10, 100 - d.ball); d.goal = 100 - d.ball <= 10; d.first = d.ball + d.toGo; }
    else { d.down++; d.toGo = d.first - d.ball; }
    if (d.down === 4 || d.snaps >= 8) {
      const dist = 100 - d.ball + 17;
      if (dist <= 52) { const ok = R() < clamp(.95 - (dist - 20) * .012, .4, .95); if (ok) this.pa += 3; this.pop(ok ? 'FG GOOD' : 'FG MISS', ok ? '#E85A5A' : '#F2C230'); return this.endDrive(ok ? `상대 ${dist}야드 필드골` : `상대 ${dist}야드 필드골 실패`); }
      if (d.toGo <= 2 && d.ball >= 45 && R() < .5) { this.msg('상대가 4번째 다운에 승부를 건다!'); return this.defenseLive(); }
      this.pop('STOP!', '#F2C230'); return this.endDrive('수비 성공, 상대 펀트');
    }
    this.cam = clamp(d.ball - 4, 24, 76);
    this.msg(o.incomplete ? '패스 인컴플리트!' : o.gain <= 0 ? '막아 냈다!' : `${o.gain}야드를 내줬다.`);
    this.defensePick();
  }
  // ───────── 키커 ─────────
  kickSetup(story, last) {
    const dists = this.final ? [36, 44, 49, 53] : [33, 42, 48];
    const dist = dists[this.drive] ?? 45;
    const wind = Math.round((R() - .5) * 20);
    this.kick = { dist, wind, last };
    this.d = { ball: 100 - (dist - 17), down: 4, toGo: 3, first: 103, goal: false };
    this.cam = clamp(this.d.ball, 24, 76);
    this.board(`${dist}야드 필드골`);
    this.msg(`<b>${esc(story)}</b><br>${dist}야드 필드골. 바람 ${wind === 0 ? '없음' : `${wind > 0 ? '→' : '←'} ${Math.abs(wind)}km/h`}. 먼저 파워, 다음 방향을 탭하세요.`);
    const need = clamp(30 + (dist - 20) * 1.7, 30, 96);
    this.meter({ name: '파워', attr: 'kpow', speed: 1.2, w: 1, power: need }, z1 => {
      const powerOk = z1.power >= need;
      this.meter({ name: '정확도', attr: last ? 'poise' : 'kacc', speed: 1.35 + Math.abs(wind) / 40, w: 1, shift: wind / 100 }, z2 => {
        const ok = powerOk && z2 !== 'miss', L = this.line;
        inc(L, 'fga'); if (ok) { inc(L, 'fgm'); L.fglong = Math.max(L.fglong || 0, dist); this.pf += 3; }
        this.snap(ok ? (z2 === 'perfect' ? 'perfect' : 'good') : 'miss', ok, false);
        this.kickAnim(ok, () => { this.pop(ok ? 'IT IS GOOD!' : powerOk ? 'NO GOOD' : 'SHORT!', ok ? '#F2C230' : '#E85A5A', ok); this.endDrive(ok ? `${dist}야드 필드골 성공` : `${dist}야드 필드골 실패`); });
      });
    });
  }
  // ───────── 펀터 ─────────
  puntSetup(story) {
    const start = 22 + Math.floor(R() * 18);
    this.d = { ball: start, down: 4, toGo: 6, first: start + 6, goal: false };
    this.cam = clamp(start + 15, 24, 76);
    this.board(`4th & 6 · ${this.spot(start)}`);
    this.msg(`<b>${esc(story)}</b><br>펀트. 비거리를 먼저, 다음 방향(코너)을 탭하세요.`);
    this.meter({ name: '비거리', attr: 'kpow', speed: 1.15, w: 1, power: 60 }, z1 => {
      this.meter({ name: '방향', attr: 'pnt', speed: 1.3, w: 1 }, z2 => {
        const dist = Math.round(32 + z1.power * .28 + (z2 === 'perfect' ? 3 : 0));
        let land = start + dist; const tb = land >= 100;
        if (tb) land = 80;
        const in20 = !tb && land >= 80 && z2 !== 'miss';
        const L = this.line; inc(L, 'punts'); inc(L, 'puntyds', tb ? 100 - start : dist); if (in20) inc(L, 'in20');
        // 상대 시작 위치(자기 진영 기준) → 실점 확률
        const oppStart = 100 - land, risk = oppStart >= 50 ? [.38, .22] : oppStart >= 30 ? [.22, .2] : oppStart >= 20 ? [.14, .16] : [.07, .1];
        const roll = R(); const allowed = roll < risk[0] ? 7 : roll < risk[0] + risk[1] ? 3 : 0; this.pa += allowed;
        this.snap(z2 === 'perfect' && in20 ? 'perfect' : z2 === 'miss' ? 'miss' : 'good', in20, false);
        this.kickAnim(true, () => { this.pop(in20 ? 'INSIDE 20!' : tb ? 'TOUCHBACK' : `${dist} YARDS`, in20 ? '#F2C230' : '#FFFFFF', in20); this.endDrive(`${dist}야드 펀트${in20 ? ', 20야드 안쪽' : tb ? ', 터치백' : ''}${allowed ? ` · 그 드라이브에서 ${allowed}점 실점` : ''}`); }, land);
      });
    });
  }
  // ───────── 타이밍 미터 ─────────
  meter(play, cb) {
    const a = this.p.attrs[play.attr] ?? this.p.ovr;
    let good = clamp((.2 + (a - 55) * .004 + this.rel * .006) * (play.w ?? 1), .08, .48);
    if (play.power) good = .28;
    const perfect = good * .3, center = clamp(.5 + (play.shift || 0), .25, .75);
    const period = 1500 / (play.speed || 1);
    this.actions(`<div class="cl-meter" id="cl-meter" role="button" tabindex="0" aria-label="타이밍 미터, 탭해서 멈추기">
      ${play.power ? `<div class="zone need" style="left:${play.power}%;right:0"></div>` : `<div class="zone good" style="left:${(center - good / 2) * 100}%;width:${good * 100}%"></div><div class="zone perfect" style="left:${(center - perfect / 2) * 100}%;width:${perfect * 100}%"></div>`}
      <i id="cl-needle"></i></div><button class="primary cl-tap" id="cl-tap">${play.power ? '탭! (파워)' : '탭! 스냅!'}</button><p class="tiny muted" style="text-align:center;margin-top:6px">${esc(play.name)} · ${play.power ? '초록 구간 오른쪽에서 멈추세요' : '금색이 퍼펙트, 초록이 성공'}</p>`);
    const needle = this.$('cl-needle'), t0 = performance.now();
    let stopped = false, pos = 0;
    const tick = now => { if (stopped) return; const ph = ((now - t0) % period) / period; pos = ph < .5 ? ph * 2 : 2 - ph * 2; needle.style.left = `${pos * 100}%`; this.meterRaf = requestAnimationFrame(tick); };
    this.meterRaf = requestAnimationFrame(tick);
    const stop = () => {
      if (stopped) return; stopped = true; cancelAnimationFrame(this.meterRaf);
      const dz = Math.abs(pos - center);
      const zone = play.power ? { power: Math.round(pos * 100) } : dz <= perfect / 2 ? 'perfect' : dz <= good / 2 ? 'good' : 'miss';
      const label = play.power ? `파워 ${Math.round(pos * 100)}` : ({ perfect: 'PERFECT', good: 'GOOD', miss: 'MISS' })[zone];
      this.$('cl-meter').classList.add('stopped', play.power ? (pos * 100 >= play.power ? 'ok' : 'bad') : zone);
      const tag = document.createElement('b'); tag.className = 'cl-zone'; tag.textContent = label; this.$('cl-meter').appendChild(tag);
      this.$('cl-tap').disabled = true;
      setTimeout(() => cb(zone), 380);
    };
    this.$('cl-tap').onclick = stop; this.$('cl-meter').onclick = stop;
    this.$('cl-meter').onkeydown = e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); stop(); } };
  }
  snap(zone, good, bad, takeaway = false) { this.snaps.push({ zone, good, bad, takeaway }); }
  // ───────── 연출 ─────────
  pop(text, color, burst = false) { this.popup = { text, color, t: performance.now() }; if (burst) this.burst(); }
  burst() { for (let i = 0; i < 46; i++) { const a = R() * Math.PI * 2, v = .4 + R() * 1.4; this.fx.push({ x: W / 2 + (R() - .5) * 40, y: 30 + R() * 20, vx: Math.cos(a) * v, vy: Math.sin(a) * v - .6, life: 40 + R() * 30, c: pick(['#F2C230', '#FFFFFF', vivid(this.me.colors[0]), '#E85A5A']) }); } }
  animate(from, to, pose, done) { this.anim = { from, to, pose, t0: performance.now(), dur: 420 + Math.min(900, Math.abs(to - from) * 26), done }; this.actions('<p class="tiny muted" style="text-align:center">플레이 진행 중…</p>'); }
  kickAnim(ok, done, land = null) { this.anim = { kick: true, ok, land, t0: performance.now(), dur: 900, done, from: this.d.ball }; this.actions(''); }
  loop(now) {
    if (this.closed) return;
    this.draw(now);
    this.raf = requestAnimationFrame(this.loop);
  }
  yx(y) { return (y - (this.cam - YARDS / 2)) * PPY; }
  draw(now) {
    if (this.liveActive) return;
    const ctx = this.ctx, d = this.d || { ball: 25, first: 35 };
    let ballY = d.ball, carrierX = null, pose = 'stand';
    const a = this.anim;
    if (a) {
      const k = clamp((now - a.t0) / a.dur, 0, 1), e = 1 - Math.pow(1 - k, 2);
      if (!a.kick) { ballY = a.from + (a.to - a.from) * e; pose = k < 1 ? (Math.floor(now / 110) % 2 ? 'run' : 'run2') : a.pose; }
      this.cam += (clamp(ballY + (this.mode === 'defense' ? -4 : 8), 24, 76) - this.cam) * .08;
      if (k >= 1) { const done = a.done; this.anim = null; if (!a.kick) d.ball = a.to; done(); }
    } else this.cam += (clamp(ballY + (this.mode === 'defense' ? -4 : 8), 24, 76) - this.cam) * .05;
    // 필드
    for (let x = 0; x < W; x++) { const y = (this.cam - YARDS / 2) + x / PPY; ctx.fillStyle = y < 0 || y > 100 ? vivid(y < 0 ? (this.mode === 'defense' ? this.oppColors[0] : this.me.colors[0]) : (this.mode === 'defense' ? this.me.colors[0] : this.oppColors[0])) : Math.floor(y / 5) % 2 ? '#3E9A52' : '#368A49'; ctx.fillRect(x, 0, 1, H); }
    ctx.fillStyle = '#FFFFFF';
    for (let y = 0; y <= 100; y += 5) { const x = Math.round(this.yx(y)); if (x < -2 || x > W + 2) continue; ctx.fillRect(x, 0, 1, H); if (y % 10 === 0 && y > 0 && y < 100) { const n = y <= 50 ? y : 100 - y; pixelText(ctx, String(n), x - (n >= 10 ? 3 : 1), H - 9, '#FFFFFF'); pixelText(ctx, String(n), x - (n >= 10 ? 3 : 1), 4, '#FFFFFF'); } }
    for (let y = 1; y < 100; y++) { const x = Math.round(this.yx(y)); if (x >= 0 && x < W) { ctx.fillRect(x, 30, 1, 2); ctx.fillRect(x, H - 32, 1, 2); } }
    // 골포스트
    for (const gy of [-10, 110]) { const x = Math.round(this.yx(gy)); if (x > -10 && x < W + 10) { ctx.fillStyle = '#F2C230'; ctx.fillRect(x, 14, 1, 30); ctx.fillRect(x - 1, 14, 3, 1); } }
    if (this.mode !== 'kick' && this.mode !== 'punt' || !a) {
      // 스크리미지 라인(파랑)·퍼스트 다운 라인(노랑)
      const los = Math.round(this.yx(d.ball)), fd = Math.round(this.yx(Math.min(100, d.first)));
      ctx.fillStyle = '#4A8CFF'; ctx.fillRect(los, 0, 2, H);
      if (!d.goal && this.mode !== 'kick' && this.mode !== 'punt') { ctx.fillStyle = '#FFD84A'; ctx.fillRect(fd, 0, 2, H); }
    }
    // 선수들
    const off = this.mode === 'defense' ? { colors: this.oppColors, avatar: { skin: 2 }, number: 12 } : this.me;
    const def = this.mode === 'defense' ? this.me : { colors: this.oppColors, avatar: { skin: 3 }, number: 55 };
    const los = this.yx(d.ball);
    const put = (o, x, y, ps, flip = false) => { const c = spriteCanvas({ ...o, pose: ps, flip }); if (c) { ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(Math.round(x) + 4, y + 26, 14, 2); ctx.drawImage(c, Math.round(x), y); } };
    if (!a || !a.kick) {
      if (this.mode === 'offense') {
        put({ ...def, number: 54 }, los + 6, 16, a ? 'stance' : 'stance', true);
        put({ ...def, number: 21 }, los + 30, 52, 'idle', true);
        put({ ...off, number: 77 }, los - 22, 50, 'stance');
        carrierX = this.yx(ballY) - 20;
        put(this.me, carrierX, 34, a ? pose : (this.pos === 'QB' ? 'throw' : this.pos === 'OL' ? 'stance' : 'stand'));
      } else {
        put({ ...off, number: 12 }, this.yx(ballY) - 20, 34, a ? pose : 'stand');
        put({ ...off, number: 77 }, los - 22, 52, 'stance');
        put({ ...def, number: 31 }, los + 34, 16, 'idle', true);
        put(this.me, los + 6 + (a ? Math.min(14, (now - a.t0) / 30) : 0) * -1 + 4, 40, a ? (a.pose === 'cheer' || a.pose === 'sad' ? a.pose : 'stance') : 'stance', true);
      }
    } else {
      // 킥 연출: 공이 포물선을 그리며 날아갑니다.
      const k = clamp((now - a.t0) / a.dur, 0, 1), x0 = los - 10, target = this.mode === 'punt' ? this.yx(a.land ?? d.ball + 45) : this.yx(110);
      put(this.me, x0 - 14, 40, k < .2 ? 'kick' : a.ok ? 'cheer' : 'sad');
      const bx = x0 + (target - x0) * k, by = 52 - Math.sin(k * Math.PI) * 40 + (this.mode !== 'punt' && !a.ok ? k * 10 : 0);
      ctx.fillStyle = OUT; ctx.fillRect(bx - 2, by - 1, 5, 3); ctx.fillStyle = '#8A4B22'; ctx.fillRect(bx - 1, by, 3, 1);
    }
    // 파티클
    this.fx = this.fx.filter(p => p.life-- > 0);
    for (const p of this.fx) { p.x += p.vx; p.y += p.vy; p.vy += .03; ctx.fillStyle = p.c; ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 2); }
    // 큰 글자
    if (this.popup) {
      const k = (now - this.popup.t0 || now - this.popup.t) / 1400, t = (now - this.popup.t) / 1400;
      if (t < 1) { const sc = t < .15 ? 2 + (1 - t / .15) : 2; bigText(ctx, this.popup.text, W / 2, 24, this.popup.color, Math.round(sc)); }
      else this.popup = null;
      void k;
    }
  }
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
    cancelAnimationFrame(this.raf); cancelAnimationFrame(this.meterRaf);
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
export { shade };
