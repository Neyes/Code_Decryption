// 튜토리얼(선택): 게임 흐름, 조작(컴퓨터 키 / 모바일 터치), 포지션별로 어떤 키·버튼이 어떤 기술이고 어떤 능력치를 쓰는지.
// 강제로 뜨지 않습니다. 첫 커리어를 만든 뒤 한 번 물어보고(건너뛰기 가능), 설정·빅게임 카드·빅게임 화면의 '조작법'에서 언제든 다시 봅니다.
// '연습해 보기'는 기록에 남지 않는 연습 경기(clutch.js의 practice)를 엽니다.
// 여기 적힌 기술·키·능력치는 liveplay.js의 skills()/skill()과 맞춰 둡니다 (버튼 1~4 = Space·J·K·L, 터보는 Shift도).
import { ATTR, attrsOf } from '../engine/core.js';
import { keyLabel } from './input.js';

const esc = v => String(v ?? '').replace(/[&<>"']/g, x => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[x]));
const SLOT = ['space', 'j', 'k', 'l'];
// 모바일 버튼: 색과 자리 (css .lp-btn.b0~b3)
const TOUCH_BTN = [['#D9483B', '빨강 · 오른쪽 아래 큰 버튼'], ['#2F6FD6', '파랑 · 그 왼쪽'], ['#1F9A5C', '초록 · 그 위'], ['#7A54C7', '보라 · 왼쪽 위']];

// 포지션 묶음 → 연습할 때 쓸 대표 포지션
export const GUIDE_GROUPS = [['QB', '쿼터백', 'QB'], ['RB', '러닝백', 'RB'], ['WR', '리시버·타이트 엔드', 'WR'], ['OL', '라인맨', 'OL'], ['DL', '패스 러셔', 'EDGE'], ['DB', '라인배커·코너백·세이프티', 'CB'], ['K', '키커·펀터', 'K']];
export const guideGroupOf = pos => ({ QB: 'QB', RB: 'RB', WR: 'WR', TE: 'WR', OL: 'OL', EDGE: 'DL', DT: 'DL', LB: 'DB', CB: 'DB', S: 'DB', K: 'K', P: 'K' }[pos] || 'QB');
export const guidePos = group => GUIDE_GROUPS.find(g => g[0] === group)?.[2] || 'QB';

// k: 'move' 이동 · 'num' 리시버 번호 · 0~3 버튼 1~4 · 'aim'·'power' 킥. turbo: Shift도 됨. stats: 이 기술에 쓰이는 능력치
const CARRY = when => ({ when, rows: [
  { k: 'move', name: '달리기', desc: '위쪽이 상대 엔드존이에요. 블로커 뒤 빈틈을 찾아 달려요. 사이드라인 밖으로 나가면 거기서 끝.', stats: ['spd', 'mob'] },
  { k: 0, name: '스핀', desc: '0.5초 동안 태클을 떨칠 확률이 크게 올라요. 태클이 닿기 직전에.', stats: ['agi', 'str'] },
  { k: 1, name: '페이크 (주크)', desc: '옆으로 순간 이동해요. 가까운 수비가 민첩성 대결에 지면 "?"를 띄우며 멈칫.', stats: ['agi'] },
  { k: 2, turbo: true, name: '터보', desc: '1.3초 동안 질주해요. 빈 공간이 보일 때.', stats: ['spd', 'mob'] },
  { k: 3, name: '스티프 암', desc: '0.8초 안에 닿는 다음 태클을 팔로 밀어내요.', stats: ['str'] },
], note: '공을 흘릴(펌블) 확률은 볼캐리가 높을수록 줄어요.' });
const ROUTE = { when: '루트를 뛸 때 (쿼터백이 아직 공을 들고 있음)', rows: [
  { k: 'move', name: '루트 달리기', desc: '스냅 직전에 보이는 노란 점선이 내 루트예요. 그대로 뛰어도 되고 빈 곳으로 꺾어도 돼요.', stats: ['spd'] },
  { k: 0, name: '패스 콜', desc: '쿼터백이 잠깐 보고 나에게 던져요. 수비가 붙어 있어도 던지니 떨어진 순간에 불러요.', touch: '필드를 탭해도 불러요.', stats: [] },
  { k: 1, name: '페이크', desc: '3.8야드 안의 마크맨을 속여 0.6초 멈추게 해요.', stats: ['route'] },
  { k: 2, turbo: true, name: '터보', desc: '1.3초 동안 질주해요.', stats: ['spd'] },
] };
const CATCH = { when: '공이 나에게 날아올 때 (노란 원 = 공이 떨어질 곳)', rows: [
  { k: 'move', name: '낙하 지점으로', desc: '노란 원 안으로 들어가면 잡아요. 조금 못 미치면 다이빙 캐치(성공률 절반).', stats: ['hands', 'spd'] },
  { k: 0, name: '하이포인트', desc: '받는 범위가 넓고 수비와 경합할 때 강해요. 받은 뒤 잠깐 멈춰요.', stats: ['hands'] },
  { k: 1, name: '안전 캐치', desc: '놓칠 확률이 줄어요. 받은 뒤 느려져요. 사이드라인·퍼스트 다운용.', stats: ['hands'] },
  { k: 2, name: 'RAC 캐치', desc: '받자마자 가속해요. 범위가 좁고 경합에 약해요. 열려 있을 때.', stats: ['hands'] },
  { k: 3, turbo: true, name: '터보', desc: '공을 따라잡을 때.', stats: ['spd'] },
], note: '캐치 종류는 공 하나에 한 번만 고를 수 있어요. 안 고르면 기본 캐치.' };

export const GUIDE = {
  QB: [
    { when: '포켓에서 (스냅 뒤 공을 들고 있을 때)', rows: [
      { k: 'move', name: '포켓 이동', desc: '러셔를 피해 움직여요. 파란 선(스크리미지 라인)을 넘으면 던질 수 없고 직접 달려요.', stats: ['mob'] },
      { k: 'num', name: '리시버 지정 패스', desc: '리시버 머리 위 번호(왼쪽부터 1~5)를 고르면 그 리시버 앞으로 던져요. 번호 색: 초록 열림 · 노랑 보통 · 빨강 붙음.', touch: '필드 빈 곳을 탭하면 그 지점으로 던져요.', stats: ['acc', 'arm'] },
      { k: 0, name: '패스 (자동)', desc: '가장 열려 있는 리시버에게 던져요.', stats: ['acc', 'arm'] },
      { k: 1, name: '펌프 페이크', desc: '던지는 척해서 수비수들을 0.4초 멈칫하게 해요. 한 플레이에 2번.', stats: ['vis', 'poise'] },
      { k: 2, name: '스핀', desc: '0.5초 동안 색(태클)을 피할 확률이 올라요.', stats: ['str'] },
      { k: 3, name: '패스 종류', desc: '누를 때마다 터치(기본) → 불릿(빠르고 낮음, 수비 손에 걸릴 수 있음) → 로브(높고 느림, 깊은 공).', stats: [] },
    ], note: '정확도가 높을수록 공이 겨눈 곳에 가깝게 떨어지고, 어깨가 좋을수록 공이 빨라요. 러셔가 바로 앞이면 오차가 커져요. 런 작전은 핸드오프가 자동이에요.' },
    CARRY('파란 선을 넘어 직접 달릴 때'),
  ],
  RB: [CARRY('공을 들었을 때'), ROUTE, CATCH],
  WR: [ROUTE, CATCH, CARRY('공을 잡은 뒤')],
  OL: [
    { when: '패스 프로텍션 (레프트 태클)', rows: [
      { k: 'move', name: '막아서기', desc: '빨간 화살표가 붙은 러셔가 내 담당이에요. 그 러셔와 쿼터백 사이에 서요. 이 러셔는 다른 블로커가 도와주지 않아요.', stats: ['pblk', 'agi'] },
      { k: 0, name: '펀치', desc: '붙은 러셔를 밀쳐 0.6초 멈추고 뒤로 밀어내요.', stats: ['str'] },
      { k: 1, name: '버티기', desc: '1.4초 동안 러셔가 나를 떨쳐 내지 못해요.', stats: [] },
    ], note: '붙어서 버티는 힘은 패스블록(런 작전이면 런블록)이 정해요. 오래 막으면 팬케이크, 놓치면 색 허용이 기록돼요.' },
  ],
  DL: [
    { when: '패스 러시', rows: [
      { k: 'move', name: '쿼터백에게', desc: '블로커를 돌아 쿼터백에게 가요. 공을 든 쿼터백에게 닿으면 색.', stats: ['spd', 'rush'] },
      { k: 0, name: '스핀 무브', desc: '블로커에 묶였을 때 돌아 빠져나가요. 실패하면 잠깐 굳어요.', stats: ['rush', 'agi'] },
      { k: 1, name: '스윔', desc: '블로커 위로 팔을 넘겨 빠져나가요. 실패하면 잠깐 굳어요.', stats: ['rush', 'hand'] },
      { k: 2, turbo: true, name: '터보', desc: '1.3초 동안 질주해요.', stats: ['spd'] },
    ], note: '스핀 무브·스윔은 블로커에 묶여 있을 때만 켜져요. 런이면 볼 캐리어를 쫓아 태클해요.' },
  ],
  DB: [
    { when: '커버·태클', rows: [
      { k: 'move', name: '내 배정 지키기', desc: '스냅 전에 내 배정이 노랗게 보여요 (존 구역 · 맨 상대와 이은 선 · 블리츠 화살표). 볼 캐리어에 닿으면 태클.', stats: ['cov', 'spd', 'tkl'] },
      { k: 0, name: '잼', desc: '스냅 뒤 2.4초 안에, 1.9야드 안의 리시버를 밀어 0.6초 멈춰요.', stats: ['str', 'cov'] },
      { k: 1, name: '다이브 태클', desc: '볼 캐리어가 가까울 때 몸을 날려요. 태클 범위가 늘지만 빗나가면 넘어져요.', stats: ['tkl'] },
      { k: 2, turbo: true, name: '터보', desc: '1.3초 동안 질주해요.', stats: ['spd'] },
    ] },
    { when: '공이 근처로 날아올 때 (노란 원)', rows: [
      { k: 0, name: '가로채기', desc: '인터셉트를 노려요. 닿는 범위와 가로챌 확률이 올라요.', stats: ['ball', 'cov'] },
      { k: 1, name: '쳐내기', desc: '확실하게 패스를 끊어요. 인터셉트는 안 돼요.', stats: ['ball', 'cov'] },
      { k: 2, turbo: true, name: '터보', desc: '낙하 지점으로 빨리.', stats: ['spd'] },
    ], note: '블리츠 배정이면 패스 러셔 버튼(스핀 무브·스윔)이 나와요.' },
  ],
  K: [
    { when: '필드골·펀트 (스냅 뒤 러셔가 오기 전에)', rows: [
      { k: 'aim', name: '방향', desc: '조준선이 골대 가운데를 지나게. 바람(왼쪽 위 화살표)은 반대쪽으로 조금 겨눠 직접 계산해요.', stats: ['kacc', 'pnt'] },
      { k: 'power', name: '파워', desc: '오른쪽 막대의 초록 구간에서 놓아요. 너무 세면 빨강으로 넘어가 크게 휘어요.', stats: ['kpow', 'cons'] },
    ], note: '킥력이 사거리, 킥 정확도·펀트가 흔들림을 정해요. 마지막 승부 킥은 침착함이 낮으면 더 흔들려요. 펀트는 금색 구역(상대 20야드 안)을 노려요.' },
  ],
};

const kc = t => `<kbd class="kc">${esc(t)}</kbd>`;
function keyCell(row, mode) {
  const key = mode === 'key', k = row.k;
  if (k === 'move') return key ? `${kc('W')}${kc('A')}${kc('S')}${kc('D')}<small>또는 방향키</small>` : '<i class="gd-stick"></i><small>왼쪽 아래 스틱</small>';
  if (k === 'num') return key ? `${kc('1')}<i class="gd-sep">~</i>${kc('5')}<small>숫자 키</small>` : '<i class="gd-chip">1</i><small>위쪽 칩 · 리시버 탭</small>';
  if (k === 'aim') return key ? `${kc('A')}${kc('D')}<small>또는 ← →</small>` : '<small>쓸어 올리는 기울기</small>';
  if (k === 'power') return key ? `${kc('Space')}<small>꾹 → 떼기</small>` : '<small>공에서 위로 쓸어 올린 길이</small>';
  if (key) return kc(keyLabel(SLOT[k])) + (row.turbo ? `<small>또는</small>${kc('Shift')}` : '');
  return `<i class="gd-btn" style="background:${TOUCH_BTN[k][0]}"></i><small>${TOUCH_BTN[k][1]}</small>`;
}
// 포지션별 키·기술·능력치 표. pos가 있으면 그 포지션에 있는 능력치만 보여 줍니다.
export function guideKeysHtml(group, mode, pos = null) {
  const have = pos ? attrsOf(pos) : null;
  return (GUIDE[group] || GUIDE.QB).map(c => `<div class="gd-ctx"><h4>${esc(c.when)}</h4>${c.rows.map(r => {
    const st = (r.stats || []).filter(k => !have || have.includes(k));
    return `<div class="gd-row"><div class="gd-key">${keyCell(r, mode)}</div><div class="gd-what"><b>${esc(r.name)}</b><p>${esc(r.desc)}${mode === 'touch' && r.touch ? ' ' + esc(r.touch) : ''}</p>${st.length ? `<div class="gd-stats">${st.map(k => `<span class="pill">${esc(ATTR[k][0])}</span>`).join('')}</div>` : ''}</div></div>`;
  }).join('')}${c.note ? `<p class="gd-note">${esc(c.note)}</p>` : ''}</div>`).join('');
}
export const modeToggleHtml = (mode, btn) => `<div class="seg gd-mode">${btn('key', '컴퓨터 (키보드)', mode === 'key')}${btn('touch', '모바일 (터치)', mode === 'touch')}</div>`;

const PAGES = ['게임 흐름', '직접 플레이 기본', '포지션별 키와 능력', '작전 · 캐치 · 난이도'];
export const GUIDE_PAGES = PAGES.length;
// 튜토리얼 시트 안쪽. v: { page, mode, group }, o: { pos(내 포지션), diffName, canPractice }
export function tutorialHtml(v, o = {}) {
  const page = Math.max(0, Math.min(PAGES.length - 1, v.page || 0)), mode = v.mode === 'touch' ? 'touch' : 'key', group = GUIDE[v.group] ? v.group : 'QB', key = mode === 'key';
  const btn = (val, label, on) => `<button class="${on ? 'on' : ''}" data-action="tut-mode" data-v="${val}">${label}</button>`;
  const li = items => `<ul class="gd-list">${items.map(([a, b]) => `<li><b>${a}</b><span>${b}</span></li>`).join('')}</ul>`;
  let body = '';
  if (page === 0) body = li([
    ['시즌 준비', '훈련 계획(균형·집중·회복)과 이번 목표를 보고 시즌을 시작해요. 집중 훈련은 성장이 빠르지만 부상 확률이 올라요.'],
    ['시즌 진행', '시즌을 구간으로 나눠 진행해요. 구간 사이에 선택 카드가 나오고, 성공 확률이 보이는 그대로 굴려요. 감독 신뢰·라커룸·팬 같은 관계 수치가 확률을 바꿔요.'],
    ['빅게임', '라이벌전과 포스트시즌에서 멈춰요. "실시간 직접 플레이"로 내 선수를 직접 조작하거나 "빠르게 진행"으로 넘길 수 있어요.'],
    ['시즌 뒤', '능력치 성장이 공개되고, 수상과 다음 진로(진학·드래프트·계약)를 정해요.'],
    ['훈련장', '위쪽 가방 버튼. 상품·스태프·시설을 사고, 헬스장 회원권이 있으면 헬스장에서 직접 운동해 능력치를 조금씩 올려요.'],
    ['능력치', '능력치가 오를수록 직접 플레이가 쉬워져요 (속도, 캐치 범위, 패스 오차, 기술 성공률). 상대도 고교 → 대학 → NFL로 갈수록 강해져요.'],
  ]);
  else if (page === 1) body = `${modeToggleHtml(mode, btn)}<p class="gd-note">기기에 맞춰 자동으로 바뀌어요. 설정 → 조작 방식에서 고정할 수도 있어요. 화면 요소는 같고 조작만 달라요.</p>${li(key ? [
    ['이동', `${kc('W')}${kc('A')}${kc('S')}${kc('D')} 또는 방향키. 왼쪽 아래에 눌린 키가 표시돼요.`],
    ['기술 버튼', `오른쪽 아래 버튼 1~4 = ${kc('Space')} ${kc('J')} ${kc('K')} ${kc('L')}. 버튼마다 키가 적혀 있고 상황에 따라 바뀌어요. 터보는 ${kc('Shift')}도 돼요.`],
    ['작전 고르기', `작전 카드·선택지는 숫자 키 ${kc('1')}~${kc('9')}, 분류는 ${kc('Q')} ${kc('E')}, 스냅·다음은 ${kc('Enter')}. 조작법은 ${kc('H')}.`],
    ['마우스', '버튼, 리시버 칩, 필드의 리시버를 클릭해도 돼요.'],
  ] : [
    ['이동', '왼쪽 아래 어디든 누르면 그 자리에 스틱이 생겨요. 기울인 만큼 빨리 달려요.'],
    ['기술 버튼', '오른쪽 아래 색 버튼(최대 4개). 상황에 따라 바뀌고, 스틱을 잡은 채로 누를 수 있어요.'],
    ['작전 고르기', '작전 카드나 선택지를 탭해요. 분류 탭을 눌러 다른 작전을 봐요.'],
    ['필드 탭', '쿼터백은 리시버나 빈 곳을 탭해 패스, 리시버는 필드를 탭해 패스 콜.'],
  ])}<h4 class="gd-h">필드 읽기</h4>${li([
    ['파란 선 · 노란 선', '파란 선은 스크리미지 라인, 노란 선은 퍼스트 다운까지 가야 할 곳.'],
    ['내 선수', '발밑 노란 고리와 머리 위 노란 화살표. 스냅 전에는 "YOU"가 떠요.'],
    ['점선', '스냅 직전 우리 팀 루트. 내 루트는 노랑, 1순위 리시버는 주황, 런 길은 빨강.'],
    ['노란 원', '공이 떨어질 곳. 받으려면(수비면 끊으려면) 여기로.'],
    ['버튼 색과 게이지', '회색이면 지금은 못 써요. 버튼 위 어두운 부채꼴이 재사용 대기 시간.'],
  ])}`;
  else if (page === 2) body = `${modeToggleHtml(mode, btn)}<div class="seg gd-groups">${GUIDE_GROUPS.map(([id, name]) => `<button class="${group === id ? 'on' : ''}" data-action="tut-group" data-v="${id}">${esc(name)}</button>`).join('')}</div>
    <p class="gd-note">알약은 그 기술에 쓰이는 내 능력치예요. 능력치가 상대보다 높을수록 성공 확률이 올라요.</p>${guideKeysHtml(group, mode, o.pos && guideGroupOf(o.pos) === group ? o.pos : guidePos(group))}`;
  else body = li([
    ['플레이북', '추천 탭은 다운·거리·상대 정렬을 본 코치 추천이에요. 숏 패스·딥 패스·런 등 분류 탭에서 직접 골라도 돼요. 카드의 그림이 작전이에요.'],
    ['상대 읽기', '스냅 전 상대 정렬이 필드에 그대로 보여요. 깊은 수비(세이프티)가 2명이면 깊은 공이 어렵고 런이 쉬워요. 가끔 숨겨요.'],
    ['패스 종류', '터치(기본) · 불릿(빠른 공, 짧은 거리) · 로브(높은 공, 깊은 거리).'],
    ['캐치 결과', '공이 날아간 거리로 숏(8야드 미만) · 미디엄 · 롱(20야드+) 캐치로 나뉘고, 캐치 후 달린 거리가 따로 표시돼요.'],
    ['4번째 다운', '고(승부) · 필드골 · 펀트를 직접 정해요. 터치다운 뒤에는 PAT 또는 2점 컨버전.'],
    ['난이도', `지금 난이도: ${esc(o.diffName || '노말')}. 쉬움은 판정이 넉넉하고 상대가 느려요. 하드는 보정이 없고 리시버 열림 색도 안 보여요. 설정에서 바꿔요.`],
    ['헬스장', '운동마다 연타·타이밍·방향 미니게임이에요. 하루(시즌 한 단계)에 체력만큼만 할 수 있고, 운동 하나는 하루 2세트까지.'],
  ]);
  const last = page === PAGES.length - 1;
  return `<p class="eyebrow">튜토리얼 ${page + 1}/${PAGES.length} · 건너뛰어도 돼요</p><h2>${PAGES[page]}</h2>
    <div class="gd-dots">${PAGES.map((t, i) => `<button class="${i === page ? 'on' : ''}" data-action="tut-go" data-v="${i}" aria-label="${t}"></button>`).join('')}</div>
    <div class="gd-body">${body}</div>
    <div class="gd-nav"><button class="secondary" data-action="tut-page" data-v="-1" ${page === 0 ? 'disabled' : ''}>${key ? kc('←') + ' ' : ''}이전</button><button class="primary" data-action="${last ? 'close-sheet' : 'tut-page'}" data-v="1">${last ? '끝내기' : '다음'}${key ? ' ' + kc(last ? 'Enter' : '→') : ''}</button></div>
    ${o.canPractice ? `<button class="secondary gd-practice" data-action="tut-practice">${esc(GUIDE_GROUPS.find(g => g[0] === group)[1])} 연습해 보기 (기록에 안 남아요)${key ? ' ' + kc('P') : ''}</button>` : ''}
    <button class="ghost" data-action="close-sheet">${last ? '닫기' : '건너뛰기'}${key ? ' ' + kc('Esc') : ''}</button>`;
}
// 첫 커리어를 만든 뒤 한 번 물어보는 창 (선택)
export function tutorialAskHtml(key) {
  return `<p class="eyebrow">처음이신가요?</p><h2>튜토리얼을 볼까요?</h2><p class="lead">게임 흐름과 조작법(어떤 키·버튼이 어떤 기술인지)을 4쪽으로 알려 드려요. 연습 경기도 해 볼 수 있어요. 지금 안 봐도 설정 → 튜토리얼에서 언제든 볼 수 있어요.</p>
    <button class="primary" data-action="tutorial" style="margin-top:16px">튜토리얼 보기${key ? ' ' + kc('Enter') : ''}</button><button class="ghost" data-action="tut-skip">건너뛰기${key ? ' ' + kc('Esc') : ''}</button>`;
}
