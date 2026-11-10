// 시즌 중 선택 카드. 선택지마다 성공 확률이 보이고, 그 확률 그대로 굴립니다.
// when: stage, pos(포지션 목록) / side(O·D·ST), ageMin/ageMax, roleIn(역할 목록), seg(구간), nat, flagsAll/flagsNone, minOvr, form, first(첫 시즌)
// 효과 fx: meters{trust,locker,media,front,body}, attrs{키:증감 | main/phys/mental}, season{playing,perf,injury}, money, followers(배수), flags/unflags
import { diffOf } from './difficulty.js';
import { clamp, pick, POSITIONS, attrsOf, overall, ATTR, usd } from './core.js';

export const METERS = { trust: '감독 신뢰', locker: '라커룸', media: '팬·언론', front: '구단 관계', body: '누적 피로' };
const C = (base, meter, per) => ({ base, meter, per });

export const CARDS = [
  // ── 고교 ──
  { id: 'hs-oklahoma', when: { stage: ['hs'], first: true }, eyebrow: '고교 · 첫 풀패드 훈련', title: '오클라호마 드릴',
    body: '코치가 호루라기를 분다. 두 줄로 마주 선 선수들, 맞은편엔 덩치가 한참 큰 12학년 선배. 라커룸이 숨을 죽이고 지켜본다.',
    choices: [
      { label: '피하지 않고 정면으로 부딪친다', hint: '이기든 지든 존재감은 남는다', chance: C(52, 'trust', .4), ok: { text: '선배가 엉덩방아를 찧었다. 라커룸에서 처음으로 내 이름이 불렸다.', fx: { meters: { trust: 7, locker: 4 }, attrs: { str: 1 } } }, ng: { text: '하늘이 보였다. 그래도 끝까지 일어나 다시 줄을 섰다.', fx: { meters: { trust: 2, body: 1 } } } },
      { label: '각도를 바꿔 기술로 빠져나간다', chance: C(68, 'trust', .2), ok: { text: '코치가 "머리 좋은데?" 하고 웃었다.', fx: { meters: { trust: 4 }, attrs: { mental: 1 } } }, ng: { text: '"피하지 마!" 코치의 고함이 운동장에 울렸다.', fx: { meters: { trust: -3 } } } },
    ] },
  { id: 'hs-korean', when: { stage: ['hs'], nat: 'KR', first: true }, eyebrow: '유학 첫 시즌', title: '낯선 언어, 낯선 라커룸',
    body: '플레이북의 약어가 하나도 들어오지 않는다. "Cover 3 Buzz, Mike Fire…" 허들 안에서 나만 반 박자 늦다.',
    choices: [
      { label: '동료에게 먼저 다가가 같이 밥을 먹는다', chance: C(62, 'locker', .4), ok: { text: '쿼터백이 콜 사인을 손짓으로 따로 알려 주기 시작했다.', fx: { meters: { locker: 9 }, attrs: { mental: 1 } } }, ng: { text: '어색한 웃음만 오갔다. 그래도 내일 또 앉아 보기로 했다.', fx: { meters: { locker: 1 } } } },
      { label: '밤마다 플레이북을 한국어로 옮겨 적는다', chance: C(75), ok: { text: '노트 세 권. 이제 콜을 듣는 순간 몸이 먼저 움직인다.', fx: { attrs: { mental: 2 }, meters: { trust: 2 } } }, ng: { text: '잠이 모자라 연습 때 다리가 무겁다.', fx: { meters: { body: 1 }, season: { perf: -.5 } } } },
    ] },
  { id: 'hs-film', when: { stage: ['hs', 'college'] }, eyebrow: '주중 훈련', title: '새벽 필름 세션',
    body: '코치가 아침 6시 필름 세션에 오라고 한다. 상대 팀의 지난 세 경기를 함께 보자는 것이다.',
    choices: [
      { label: '매일 아침 필름룸에 간다', chance: C(78), ok: { text: '상대의 버릇이 보이기 시작했다. 금요일 밤, 그 장면이 그대로 나왔다.', fx: { attrs: { vis: 2 }, meters: { trust: 3 } } }, ng: { text: '1교시 수업에서 졸다 선생님께 혼났다.', fx: { meters: { trust: -1 } } } },
      { label: '그 시간에 웨이트룸에 간다', chance: C(72), ok: { text: '스쿼트 기록이 20파운드 늘었다.', fx: { attrs: { str: 2 } } }, ng: { text: '무게 욕심을 냈다가 허리가 뻐근하다.', fx: { meters: { body: 2 }, season: { injury: .02 } } } },
    ] },
  { id: 'hs-7on7', when: { stage: ['hs'], pos: ['QB', 'WR', 'TE', 'RB', 'CB', 'S', 'LB'], seg: [0] }, eyebrow: '여름 끝자락', title: '7on7 토너먼트 초청',
    body: '지역 7on7 클럽이 주말 토너먼트에 같이 나가자고 한다. 대학 스카우트들이 자주 오는 대회다.',
    choices: [
      { label: '나간다. 눈에 띌 기회다', chance: C(60, 'media', .3), ok: { text: '대회 MVP. 대학 코치 두 명이 명함을 건넸다.', fx: { meters: { media: 6 }, followers: 1.25, flags: ['exposure'] } }, ng: { text: '팀 호흡이 맞지 않아 조별 탈락. 발목도 살짝 접질렸다.', fx: { season: { injury: .03 } } } },
      { label: '학교 팀 훈련에 집중한다', chance: C(85), ok: { text: '코치가 "팀을 먼저 생각하는 녀석"이라며 믿음을 보였다.', fx: { meters: { trust: 5, locker: 3 } } }, ng: { text: '훈련은 평범하게 지나갔다.', fx: {} } },
    ] },
  { id: 'hs-camp', when: { stage: ['hs'], grade: [11], seg: [0, 1] }, eyebrow: '리크루팅', title: '대학 캠프 초청장',
    body: '여름 동안 다녀온 대학 캠프에서 40야드 대시와 1대1 드릴을 했다. 결과를 보고 한 대학이 주말 공식 방문을 제안한다.',
    choices: [
      { label: '공식 방문에서 내 기록을 직접 어필한다', chance: C(55, 'media', .3), ok: { text: '헤드코치가 "우리가 찾던 선수"라고 말했다. 리크루팅 사이트에 내 이름이 올라갔다.', fx: { flags: ['campStar'], followers: 1.4, meters: { media: 5 } } }, ng: { text: '긴장해서 말이 꼬였다. 반응은 미지근했다.', fx: { meters: { media: -2 } } } },
      { label: '시즌이 끝난 뒤로 미룬다', chance: C(88), ok: { text: '지금은 금요일 밤에 집중한다.', fx: { meters: { trust: 3 }, season: { perf: .5 } } }, ng: { text: '아쉬움이 남는다.', fx: {} } },
    ] },
  { id: 'hs-audible', when: { stage: ['hs', 'college'], pos: ['QB'] }, eyebrow: '경기 중', title: '사이드라인 콜과 다른 수비',
    body: '스냅 직전, 세이프티 둘이 박스 안으로 내려온다. 사이드라인에서 받은 콜은 인사이드 런. 이대로면 막힌다.',
    choices: [
      { label: '오디블로 바깥 패스로 바꾼다', chance: C(50, 'trust', .4), ok: { text: '1대1로 남은 리시버에게 던졌다. 62야드 터치다운.', fx: { attrs: { vis: 2 }, meters: { trust: 4, media: 3 } } }, ng: { text: '리시버가 사인을 못 봤다. 인터셉트. 감독이 헤드셋을 집어던졌다.', fx: { meters: { trust: -6 }, season: { perf: -.5 } } } },
      { label: '콜대로 간다', chance: C(80), ok: { text: '러닝백이 2야드를 짜냈다. 다음 다운으로.', fx: { meters: { trust: 2 } } }, ng: { text: '로스 오브 야드. 다음엔 내 판단을 믿어 볼까.', fx: {} } },
    ] },
  { id: 'hs-rival', when: { stage: ['hs'], seg: [2] }, eyebrow: '금요일 밤의 라이벌전', title: '지역 신문의 인터뷰',
    body: '라이벌전을 앞두고 지역 신문 기자가 찾아왔다. "상대 팀에 한마디 해 달라"며 녹음기를 내민다.',
    choices: [
      { label: '"이번엔 우리가 이긴다" 도발한다', chance: C(45, 'media', .4), ok: { text: '말한 대로 됐다. 신문 1면에 내 사진이 실렸다.', fx: { meters: { media: 9, locker: 3 }, followers: 1.3 } }, ng: { text: '상대 라커룸 게시판에 내 기사가 붙었다고 한다. 그날 밤 집중 마크를 당했다.', fx: { meters: { media: -4, locker: -3 }, season: { perf: -.5 } } } },
      { label: '"좋은 경기를 하겠다" 겸손하게', chance: C(88), ok: { text: '코치가 기사를 오려 게시판에 붙였다.', fx: { meters: { trust: 3, locker: 3 } } }, ng: { text: '기사는 3면 구석에 작게 실렸다.', fx: {} } },
    ] },
  { id: 'hs-grades', when: { stage: ['hs', 'college'], ageMax: 21 }, eyebrow: '학업', title: '성적 경고장',
    body: '평점이 출전 자격 기준선에 걸렸다. 다음 주까지 과제를 내지 못하면 경기에 못 나간다.',
    choices: [
      { label: '튜터링을 받으며 밤새 과제를 한다', chance: C(76), ok: { text: '기준선을 넘겼다. 담임 선생님이 처음으로 칭찬했다.', fx: { meters: { trust: 3 }, flags: ['academic'] } }, ng: { text: '한 과목이 모자랐다. 한 경기 출전 정지.', fx: { season: { playing: -.06 }, meters: { trust: -2 } } } },
      { label: '훈련이 먼저다. 어떻게든 되겠지', chance: C(38), ok: { text: '운 좋게 넘어갔다.', fx: {} }, ng: { text: '출전 자격 정지 2경기. 감독의 실망한 표정이 오래 남았다.', fx: { season: { playing: -.14 }, meters: { trust: -6 } } } },
    ] },
  { id: 'hs-ankle', when: { stage: ['hs', 'college'], seg: [2] }, eyebrow: '플레이오프를 앞두고', title: '부은 발목',
    body: '목요일 훈련 뒤 발목이 부어올랐다. 트레이너는 이번 주는 쉬라고 하지만, 내일은 시즌 마지막 정규 경기다.',
    choices: [
      { label: '테이핑하고 뛴다', chance: C(50, 'body', -3), ok: { text: '절뚝이면서도 끝까지 뛰었다. 팀이 이겼다.', fx: { meters: { trust: 5, locker: 4 } } }, ng: { text: '2쿼터에 다시 접질렸다. 플레이오프 출전이 불투명하다.', fx: { meters: { body: 3 }, season: { injury: .08, perf: -1 } } } },
      { label: '쉰다. 플레이오프가 더 중요하다', chance: C(86), ok: { text: '부기가 빠졌다. 몸이 가볍다.', fx: { meters: { body: -1 } } }, ng: { text: '대신 들어간 후배가 잘했다. 묘한 기분이다.', fx: { meters: { trust: -3 } } } },
    ] },
  { id: 'hs-transfer', when: { stage: ['hs'], grade: [10], minOvr: 50 }, eyebrow: '시즌 중반', title: '명문고 코치의 전화',
    body: '전국 랭킹에 드는 학교의 코치가 연락해 왔다. "우리 학교로 오면 대학 스카우트가 매주 온다"고 한다.',
    choices: [
      { label: '관심 있다고 답한다', chance: C(72), ok: { text: '시즌이 끝나면 다시 이야기하자고 했다.', fx: { flags: ['transferOffer'], meters: { locker: -3 } } }, ng: { text: '소문이 팀에 퍼졌다. 동료들의 눈빛이 달라졌다.', fx: { meters: { locker: -8, trust: -3 } } } },
      { label: '지금 팀에 남겠다고 한다', chance: C(90), ok: { text: '코치가 그 얘기를 듣고 어깨를 두드려 줬다.', fx: { meters: { locker: 7, trust: 4 } } }, ng: { text: '', fx: {} } },
    ] },
  { id: 'twoway-ask', when: { stage: ['hs', 'college'], pos: ['WR', 'CB', 'RB', 'S'], noTwoWay: true, minOvr: 50 }, eyebrow: '수비·공격 코디네이터', title: '반대쪽에서도 뛰어 볼래?',
    body: '부상자가 겹친 팀. 반대편 코디네이터가 훈련 뒤 조용히 부른다. "너라면 우리 쪽에서도 통할 것 같은데."',
    choices: [
      { label: '해 보겠다고 한다', hint: '시즌이 끝나면 투웨이 전환점이 열릴 수 있다', chance: C(70, 'trust', .3), ok: { text: '스카우트 팀 훈련에서 몇 번 막아 냈다. 코치들이 눈빛을 주고받았다.', fx: { flags: ['twoWayTry'], meters: { trust: 3 } } }, ng: { text: '익숙하지 않은 자리에서 몇 번 뚫렸다. 그래도 가능성은 봤다.', fx: { flags: ['twoWayTry'], meters: { body: 1 } } } },
      { label: '내 포지션에 집중하겠다고 한다', chance: C(90), ok: { text: '코디네이터가 고개를 끄덕였다.', fx: { meters: { trust: 2 } } }, ng: { text: '', fx: {} } },
    ] },
  { id: 'hs-slump', when: { stage: ['hs', 'college', 'nfl'], form: 'slump' }, eyebrow: '부진', title: '감독실에 불려 갔다',
    body: '최근 몇 경기 평점이 바닥이다. 감독이 문을 닫고 앉으라고 한다. "무슨 일 있나?"',
    choices: [
      { label: '추가 훈련을 자청한다', chance: C(66, 'trust', .3), ok: { text: '매일 한 시간 더. 주말 경기에서 감각이 돌아왔다.', fx: { season: { perf: 1.2 }, meters: { trust: 4 } } }, ng: { text: '몸만 더 지쳤다.', fx: { meters: { body: 1 } } } },
      { label: '"시간을 좀 주세요" 솔직하게 말한다', chance: C(70, 'trust', .3), ok: { text: '감독이 한 주는 부담 없는 역할을 맡겼다. 머리가 맑아졌다.', fx: { season: { perf: .6 }, meters: { locker: 2 } } }, ng: { text: '감독은 대답 대신 뎁스 차트를 고쳤다.', fx: { meters: { trust: -4 }, season: { playing: -.06 } } } },
    ] },
  // ── 대학 ──
  { id: 'col-redshirt', when: { stage: ['college'], collegeYear: [1, 2], roleIn: ['backup', 'special'], seg: [0], noRedshirt: true }, eyebrow: '대학 1학년 · 시즌 초반', title: '레드셔트 제안',
    body: '포지션 코치가 "올해는 4경기만 뛰고 레드셔트하자"고 한다. 출전 자격 1년을 아끼고 몸을 만들 수 있다.',
    choices: [
      { label: '레드셔트한다', hint: '남은 시즌 출전은 최대 4경기, 출전 자격 1년 보존', chance: C(95), ok: { text: '이번 시즌은 스카우트 팀에서 1군 공격을 상대한다. 웨이트 프로그램이 두 배로 늘었다.', fx: { redshirt: true, attrs: { str: 1 } } }, ng: { text: '', fx: {} } },
      { label: '계속 경쟁하겠다고 한다', chance: C(80), ok: { text: '코치가 "그럼 증명해 봐"라며 스페셜팀에 넣었다.', fx: { meters: { trust: 4 }, season: { playing: .04 } } }, ng: { text: '코치의 표정이 떨떠름하다.', fx: { meters: { trust: -2 } } } },
    ] },
  { id: 'col-nil', when: { stage: ['college'] }, eyebrow: 'NIL', title: '지역 자동차 딜러의 광고 제안',
    body: '대학가 자동차 딜러가 SNS 광고 계약을 제안했다. 금액은 크지 않지만 첫 NIL 계약이다.',
    choices: [
      { label: '계약한다', chance: C(86, 'media', .2), ok: { text: '광고 영상이 캠퍼스에서 화제가 됐다.', fx: { money: 12000, meters: { media: 4 }, followers: 1.15 } }, ng: { text: '어색한 연기가 밈이 됐다. 그래도 돈은 들어왔다.', fx: { money: 12000, meters: { media: -3 } } } },
      { label: '시즌 중엔 훈련에만 집중한다', chance: C(90), ok: { text: '코치가 그 얘기를 팀 미팅에서 꺼냈다.', fx: { meters: { trust: 3 } } }, ng: { text: '', fx: {} } },
    ] },
  { id: 'col-collective', when: { stage: ['college'], minOvr: 64 }, eyebrow: 'NIL 컬렉티브', title: '다른 학교 부스터의 은밀한 연락',
    body: '경쟁 학교의 부스터 컬렉티브에서 연락이 왔다. "포털에 이름만 올리면 연 70만 달러." 규정상 위험한 접촉이다.',
    choices: [
      { label: '선을 긋고 코치에게 알린다', chance: C(88), ok: { text: '감독이 "너 같은 선수가 팀의 기둥"이라며 NIL 지원을 늘려 줬다.', fx: { meters: { trust: 6, front: 6, locker: 4 }, money: 40000 } }, ng: { text: '', fx: {} } },
      { label: '이야기는 들어 본다', hint: '시즌 뒤 트랜스퍼 포털에서 좋은 제안이 올 수 있다', chance: C(58), ok: { text: '조용히 연락처만 주고받았다.', fx: { flags: ['portalBuzz'], meters: { locker: -3 } } }, ng: { text: '소문이 퍼졌다. 라커룸 분위기가 싸늘하다.', fx: { meters: { locker: -9, trust: -5, media: -4 } } } },
    ] },
  { id: 'col-rivalry', when: { stage: ['college'], seg: [2] }, eyebrow: '라이벌 주간', title: '라이벌전 전날 밤 팀 미팅',
    body: '10만 관중이 들어찰 라이벌전. 주장이 마이크를 넘기며 "한마디 해"라고 한다.',
    choices: [
      { label: '일어서서 진심을 말한다', chance: C(52, 'locker', .5), ok: { text: '방 안이 조용해졌다가 함성이 터졌다. 다음 날 팀 전체가 미쳐 있었다.', fx: { meters: { locker: 9 }, season: { perf: 1 } } }, ng: { text: '말이 엉켰다. 몇몇이 웃었다.', fx: { meters: { locker: -2 } } } },
      { label: '짧게 "이기자"고만 한다', chance: C(85), ok: { text: '박수가 나왔다.', fx: { meters: { locker: 3 } } }, ng: { text: '', fx: {} } },
    ] },
  { id: 'col-heisman', when: { stage: ['college'], form: 'hot', pos: ['QB', 'RB', 'WR'] }, eyebrow: '시즌 중반', title: '하이즈먼 바람이 분다',
    body: '전국 방송이 내 하이라이트를 연달아 틀었다. 인터뷰 요청이 쏟아진다. 홍보팀은 "하이즈먼 캠페인"을 해 보자고 한다.',
    choices: [
      { label: '적극적으로 인터뷰에 응한다', chance: C(60, 'media', .4), ok: { text: '전국구 스타가 됐다. 팔로워가 폭발했다.', fx: { meters: { media: 9 }, followers: 1.6 } }, ng: { text: '한 발언이 짜깁기돼 퍼졌다. 해명에 일주일을 썼다.', fx: { meters: { media: -6 }, season: { perf: -.5 } } } },
      { label: '"팀이 먼저"라며 사양한다', chance: C(88), ok: { text: '동료들의 신뢰가 깊어졌다.', fx: { meters: { locker: 6, trust: 3 } } }, ng: { text: '', fx: {} } },
    ] },
  { id: 'col-concussion', when: { stage: ['college', 'nfl'] }, eyebrow: '경기 중', title: '뇌진탕 프로토콜',
    body: '헬멧끼리 부딪친 뒤 머리가 띵하다. 독립 트레이너가 사이드라인 텐트로 들어오라고 손짓한다.',
    choices: [
      { label: '증상을 솔직하게 말한다', chance: C(92), ok: { text: '한 경기를 쉬었다. 깨끗이 회복했다.', fx: { season: { playing: -.04 }, meters: { body: -1 } } }, ng: { text: '', fx: {} } },
      { label: '괜찮다고 버틴다', hint: '위험하다', chance: C(42), ok: { text: '그대로 뛰었다. 다행히 별일 없었다.', fx: { meters: { trust: 2 } } }, ng: { text: '다음 날 두통이 심해져 결국 프로토콜에 들어갔다. 3주 결장.', fx: { meters: { body: 3, trust: -2 }, season: { playing: -.15, injury: .05 } } } },
    ] },
  { id: 'col-advisory', when: { stage: ['college'], collegeYear: [3, 4, 5], minOvr: 68 }, eyebrow: '드래프트 준비', title: 'NFL 드래프트 자문 위원회',
    body: '컴플라이언스 팀이 NFL 드래프트 자문 위원회 평가를 신청해 보라고 한다. 예상 라운드를 알려 주는 제도다.',
    choices: [
      { label: '평가를 신청한다', chance: C(92), ok: { text: '평가서가 도착했다. 시즌이 끝나면 진로 화면에서 예상 순위를 확인할 수 있다.', fx: { flags: ['advisory'] } }, ng: { text: '', fx: {} } },
      { label: '지금은 시즌만 생각한다', chance: C(90), ok: { text: '머릿속이 가벼워졌다.', fx: { season: { perf: .5 } } }, ng: { text: '', fx: {} } },
    ] },
  { id: 'col-coach-leave', when: { stage: ['college'], seg: [2] }, eyebrow: '이적 소문', title: '포지션 코치가 떠난다는 소문',
    body: '나를 리크루팅했던 포지션 코치가 NFL 팀 코치로 간다는 소문이 돈다.',
    choices: [
      { label: '코치에게 직접 묻는다', chance: C(70), ok: { text: '"어디 가든 너를 응원한다"는 말을 들었다. 마음이 정리됐다.', fx: { meters: { trust: 2 }, attrs: { mental: 1 } } }, ng: { text: '대답이 애매했다. 마음이 싱숭생숭하다.', fx: { season: { perf: -.5 } } } },
      { label: '신경 쓰지 않고 경기에 집중한다', chance: C(80), ok: { text: '그 주 경기에서 시즌 최고 평점.', fx: { season: { perf: .8 } } }, ng: { text: '', fx: {} } },
    ] },
  // ── NFL ──
  { id: 'nfl-camp', when: { stage: ['nfl'], roleIn: ['rotation', 'backup', 'special', 'practice'], seg: [0], ageMax: 28 }, eyebrow: '트레이닝 캠프', title: '주전 경쟁',
    body: '같은 포지션 베테랑과 번갈아 1군 스냅을 받는다. 코치진은 이번 주 연습 경기를 보고 뎁스 차트를 확정한다고 한다.',
    choices: [
      { label: '과감하게 승부한다', chance: C(48, 'trust', .5), ok: { text: '연습 경기 하이라이트에 내 장면만 세 개. 뎁스 차트 한 칸이 올라갔다.', fx: { meters: { trust: 8 }, season: { playing: .1 } } }, ng: { text: '실수가 겹쳤다. 다시 뒤로 밀렸다.', fx: { meters: { trust: -4 }, season: { playing: -.04 } } } },
      { label: '베테랑에게 먼저 다가가 배운다', chance: C(75, 'locker', .4), ok: { text: '베테랑이 자기만의 노하우를 알려 줬다. "네 차례는 온다."', fx: { meters: { locker: 7 }, attrs: { mental: 1 }, season: { perf: .5 } } }, ng: { text: '베테랑은 거리를 뒀다.', fx: { meters: { locker: -2 } } } },
    ] },
  { id: 'nfl-qb-hurt', when: { stage: ['nfl'], pos: ['QB'], roleIn: ['backup', 'rotation'] }, eyebrow: '경기 중', title: '주전 쿼터백이 쓰러졌다',
    body: '3쿼터, 주전 QB가 무릎을 잡고 일어나지 못한다. 공격 코디네이터가 헬멧을 쓰라고 손짓한다.',
    choices: [
      { label: '"준비됐습니다"', chance: C(52, 'trust', .4), ok: { text: '첫 드라이브에서 터치다운. 다음 주 선발로 이름이 올라갔다.', fx: { season: { playing: .25, perf: 1 }, meters: { trust: 8, media: 6 }, followers: 1.3 } }, ng: { text: '첫 패스가 인터셉트됐다. 손이 떨렸다.', fx: { season: { playing: .1 }, meters: { trust: -5 } } } },
      { label: '짧은 패스 위주로 안전하게', chance: C(75), ok: { text: '실수 없이 경기를 마쳤다. 코치진은 다음 주도 맡기기로 했다.', fx: { season: { playing: .18 }, meters: { trust: 4 } } }, ng: { text: '3앤아웃만 반복했다.', fx: { season: { playing: .05 } } } },
    ] },
  { id: 'nfl-mentor', when: { stage: ['nfl'], ageMax: 24 }, eyebrow: '루키 시즌', title: '베테랑의 조언',
    body: '팀 최고참이 라커에서 말을 건다. "몸 관리는 지금부터야. 나랑 같이 아침 루틴 해 볼래?"',
    choices: [
      { label: '매일 같이 한다', chance: C(80), ok: { text: '새벽 5시 냉탕, 필름, 스트레칭. 몸이 달라졌다.', fx: { attrs: { mental: 2 }, meters: { body: -1, locker: 4 } } }, ng: { text: '일주일 만에 늦잠. 베테랑이 웃어넘겼다.', fx: { meters: { locker: 1 } } } },
      { label: '내 방식이 있다며 정중히 사양한다', chance: C(65), ok: { text: '내 루틴을 지켰다.', fx: { attrs: { main: 1 } } }, ng: { text: '"루키가 건방지다"는 말이 돌았다.', fx: { meters: { locker: -5 } } } },
    ] },
  { id: 'nfl-media', when: { stage: ['nfl'], minOvr: 76 }, eyebrow: '수요일 기자회견', title: '계약 질문 공세',
    body: '"연장 계약 이야기는 오가고 있나요?" 마이크가 열 개쯤 앞에 놓였다.',
    choices: [
      { label: '솔직하게 "가치를 인정받고 싶다"고 말한다', chance: C(55, 'media', .3), ok: { text: '팬들은 당당하다고 반겼다.', fx: { meters: { media: 6, front: -3 } } }, ng: { text: '"돈 얘기만 한다"는 헤드라인이 떴다.', fx: { meters: { media: -6, front: -4 } } } },
      { label: '"지금은 다음 경기만 생각한다"', chance: C(88), ok: { text: '구단 프런트가 만족했다는 후문.', fx: { meters: { front: 4 } } }, ng: { text: '', fx: {} } },
    ] },
  { id: 'nfl-extend', when: { stage: ['nfl'], minOvr: 78, contractLast: true }, eyebrow: '계약 마지막 해', title: '시즌 중 연장 제안',
    body: '단장이 조용히 제안서를 내밀었다. 시장 가치보다 조금 낮지만, 지금 사인하면 부상 걱정 없이 시즌을 보낼 수 있다.',
    choices: [
      { label: '지금 사인한다', hint: '안정. 구단 관계 상승', chance: C(92), ok: { text: '도장을 찍었다. 마음이 편해졌다.', fx: { extend: .9, meters: { front: 8 } } }, ng: { text: '', fx: {} } },
      { label: '시즌 뒤 시장을 본다', hint: '잘하면 더 큰 계약, 다치면 손해', chance: C(90), ok: { text: '나 자신에게 걸었다. 남은 경기에 모든 걸 건다.', fx: { season: { perf: .8 } } }, ng: { text: '', fx: {} } },
    ] },
  { id: 'nfl-deadline', when: { stage: ['nfl'], seg: [1, 2], losing: true }, eyebrow: '트레이드 마감일', title: '트레이드 소문',
    body: '팀 성적이 바닥이다. 우승을 노리는 팀이 나를 원한다는 기사가 떴다.',
    choices: [
      { label: '에이전트에게 알아보게 한다', hint: '오프시즌 트레이드 요청이 쉬워진다', chance: C(70), ok: { text: '구단도 진지하게 검토 중이라는 답이 왔다.', fx: { meters: { front: -3 }, flags: ['tradeBuzz'] } }, ng: { text: '소문이 라커룸에 퍼졌다.', fx: { meters: { locker: -6, front: -5 } } } },
      { label: '"이 팀에서 이기고 싶다" 공개 지지', chance: C(90), ok: { text: '팬들이 경기장에 내 이름을 연호했다.', fx: { meters: { locker: 6, front: 5, media: 4 } } }, ng: { text: '', fx: {} } },
    ] },
  { id: 'nfl-primetime', when: { stage: ['nfl'] }, eyebrow: '프라임타임', title: '전국 중계 나이트 경기',
    body: '일요일 밤, 전국 중계. 시청자 2천만 명. 경기 전 터널에서 심장 소리가 들린다.',
    choices: [
      { label: '큰 경기일수록 즐긴다', chance: C(55, 'media', .3), ok: { text: '그날 밤 하이라이트의 주인공. 다음 날 아침 SNS 알림이 멈추지 않았다.', fx: { season: { perf: 1.2 }, meters: { media: 6 }, followers: 1.3 } }, ng: { text: '결정적인 실수가 전국에 생중계됐다.', fx: { meters: { media: -5 }, season: { perf: -.6 } } } },
      { label: '평소 루틴대로 간다', chance: C(84), ok: { text: '흔들림 없는 경기.', fx: { season: { perf: .4 } } }, ng: { text: '', fx: {} } },
    ] },
  { id: 'nfl-fine', when: { stage: ['nfl'] }, eyebrow: '리그 사무국', title: '벌금 통지서',
    body: '지난 경기의 세리머니(혹은 태클)가 규정 위반이라며 벌금 통지서가 날아왔다.',
    choices: [
      { label: '이의를 제기한다', chance: C(38), ok: { text: '벌금이 철회됐다.', fx: { meters: { media: 2 } } }, ng: { text: '기각. 벌금에 수수료까지 냈다.', fx: { money: -25000, meters: { front: -2 } } } },
      { label: '그냥 낸다', chance: C(95), ok: { text: '깔끔하게 정리했다.', fx: { money: -15000 } }, ng: { text: '', fx: {} } },
    ] },
  { id: 'nfl-charity', when: { stage: ['nfl'], noFlag: 'foundation' }, eyebrow: '지역 사회', title: '어린이 병원 방문',
    body: '구단 봉사 활동으로 어린이 병원을 찾았다. 한 아이가 내 등번호 저지를 입고 있었다.',
    choices: [
      { label: '내 이름으로 재단을 세운다', hint: '돈이 들지만 오래 남는다', chance: C(90), ok: { text: '재단 설립. 지역 신문이 크게 다뤘다.', fx: { money: -150000, flags: ['foundation'], meters: { media: 9, front: 4 }, followers: 1.2 } }, ng: { text: '', fx: {} } },
      { label: '시간 날 때마다 다시 찾는다', chance: C(85), ok: { text: '그 아이와 SNS 친구가 됐다.', fx: { meters: { media: 3 } } }, ng: { text: '', fx: {} } },
    ] },
  { id: 'nfl-cold', when: { stage: ['nfl'], seg: [3] }, eyebrow: '12월 원정', title: '체감 영하 20도',
    body: '램보 필드 같은 원정 구장. 입김이 얼어붙는다. 장갑을 끼면 감각이 둔하고, 벗으면 손이 얼어붙는다.',
    choices: [
      { label: '장갑 없이 맨손으로', chance: C(48), ok: { text: '얼어붙은 손으로 결정적인 플레이를 해냈다.', fx: { season: { perf: 1 }, meters: { media: 4 } } }, ng: { text: '손끝 감각이 없다. 실수가 나왔다.', fx: { season: { perf: -.8 } } } },
      { label: '핫팩과 장비로 철저히 준비', chance: C(84), ok: { text: '평소처럼 뛰었다.', fx: { season: { perf: .3 } } }, ng: { text: '', fx: {} } },
    ] },
  { id: 'nfl-teammate-holdout', when: { stage: ['nfl'], seg: [0] }, eyebrow: '라커룸', title: '동료의 홀드아웃',
    body: '팀의 간판 선수가 계약 문제로 캠프에 나오지 않는다. 기자들이 내 생각을 묻는다.',
    choices: [
      { label: '동료를 공개 지지한다', chance: C(62, 'locker', .3), ok: { text: '돌아온 동료가 가장 먼저 나를 안았다.', fx: { meters: { locker: 7, front: -4 } } }, ng: { text: '구단 프런트가 불편해한다는 말이 들렸다.', fx: { meters: { front: -6 } } } },
      { label: '"구단과 선수가 잘 풀 것"이라며 중립', chance: C(88), ok: { text: '무난하게 넘어갔다.', fx: { meters: { front: 3 } } }, ng: { text: '', fx: {} } },
    ] },
  { id: 'nfl-aging', when: { stage: ['nfl', 'cfl'], ageMin: 30 }, eyebrow: '베테랑', title: '몸이 예전 같지 않다',
    body: '회복 시간이 길어졌다. 트레이너가 주중 훈련량을 줄이자고 한다.',
    choices: [
      { label: '훈련량을 줄이고 관리한다', chance: C(82), ok: { text: '일요일에 쓸 힘을 아꼈다.', fx: { meters: { body: -2 }, season: { injury: -.03, perf: -.2 } } }, ng: { text: '감각이 무뎌진 느낌이다.', fx: { season: { perf: -.5 } } } },
      { label: '젊은 선수들처럼 다 소화한다', chance: C(44, 'body', -4), ok: { text: '아직 살아 있다. 코치들이 혀를 내둘렀다.', fx: { attrs: { main: 1 }, meters: { trust: 4 } } }, ng: { text: '햄스트링이 올라왔다.', fx: { meters: { body: 2 }, season: { injury: .07 } } } },
    ] },
  { id: 'nfl-rookie-rival', when: { stage: ['nfl'], ageMin: 29, roleIn: ['starter', 'key'] }, eyebrow: '세대교체', title: '1라운드 루키가 내 자리를 노린다',
    body: '구단이 같은 포지션에 1라운드 루키를 뽑았다. 언론은 벌써 "세대교체"를 말한다.',
    choices: [
      { label: '루키의 멘토가 되어 준다', chance: C(80, 'locker', .3), ok: { text: '루키가 인터뷰에서 내 이름을 말했다. 라커룸의 리더로 인정받았다.', fx: { meters: { locker: 9, trust: 3 } } }, ng: { text: '루키는 생각보다 빨리 컸다.', fx: { season: { playing: -.04 } } } },
      { label: '실력으로 자리를 지킨다', chance: C(54, 'trust', .4), ok: { text: '주전은 아직 나다. 코치가 공개적으로 못을 박았다.', fx: { meters: { trust: 6 }, season: { perf: .8 } } }, ng: { text: '스냅 수가 눈에 띄게 줄었다.', fx: { meters: { trust: -4 }, season: { playing: -.08 } } } },
    ] },
  { id: 'nfl-sns', when: { stage: ['college', 'nfl'] }, eyebrow: 'SNS', title: '새벽에 올린 게시물',
    body: '패배 후 새벽에 올린 짧은 글이 "팀 동료 저격"으로 해석돼 퍼지고 있다.',
    choices: [
      { label: '바로 사과하고 해명한다', chance: C(76, 'media', .3), ok: { text: '오해가 풀렸다. 동료들도 웃어넘겼다.', fx: { meters: { media: 1 } } }, ng: { text: '사과문이 또 다른 논란을 불렀다.', fx: { meters: { media: -4, locker: -2 } } } },
      { label: '해명하지 않는다', chance: C(40), ok: { text: '오히려 화제가 돼 팔로워가 늘었다.', fx: { followers: 1.2 } }, ng: { text: '논란이 커졌다. 구단 홍보팀이 전화를 걸어왔다.', fx: { meters: { media: -8, front: -4, locker: -4 } } } },
    ] },
  { id: 'nfl-weekly', when: { stage: ['nfl'], form: 'hot' }, eyebrow: '이 주의 선수', title: '이 주의 선수 선정',
    body: '리그가 이번 주 컨퍼런스 "이 주의 선수"로 나를 뽑았다. 방송 출연 요청이 들어왔다.',
    choices: [
      { label: '방송에 나간다', chance: C(70, 'media', .3), ok: { text: '입담까지 좋다는 평. 광고 문의가 들어왔다.', fx: { money: 80000, meters: { media: 6 }, followers: 1.25 } }, ng: { text: '어색한 출연. 그래도 화제는 됐다.', fx: { followers: 1.08 } } },
      { label: '다음 상대 분석에 시간을 쓴다', chance: C(85), ok: { text: '다음 경기도 좋았다.', fx: { season: { perf: .6 } } }, ng: { text: '', fx: {} } },
    ] },
  // ── 한국 국적 ──
  { id: 'kr-broadcast', when: { stage: ['college', 'nfl'], nat: 'KR' }, eyebrow: '한국 중계', title: '한국 방송사의 현지 인터뷰',
    body: '한국 스포츠 채널이 경기 뒤 인터뷰를 요청했다. 새벽 중계를 본 팬들의 응원 메시지도 전해 줬다.',
    choices: [
      { label: '한국어로 팬들에게 인사한다', chance: C(90), ok: { text: '"새벽까지 응원해 주셔서 감사합니다." 영상이 포털 메인에 걸렸다.', fx: { meters: { media: 7 }, followers: 1.35 } }, ng: { text: '', fx: {} } },
      { label: '짧게 끝내고 회복에 집중한다', chance: C(88), ok: { text: '몸 관리가 우선이다.', fx: { meters: { body: -1 } } }, ng: { text: '', fx: {} } },
    ] },
  { id: 'kr-military', when: { stage: ['nfl'], nat: 'KR', ageMin: 24, ageMax: 28, noFlag: 'militaryDone', noFlag2: 'enlist' }, eyebrow: '병역', title: '국외여행 허가 만료 통지',
    body: '병무청에서 국외여행 허가 기간이 곧 끝난다는 통지가 왔다. 한국 국적 남성으로서 결정을 내려야 한다.',
    choices: [
      { label: '영주권을 받아 국외 체류를 연장한다', hint: '심사에 따라 결과가 갈린다', chance: C(68, 'front', .3), ok: { text: '구단의 도움으로 영주권 심사를 통과했다. 국외 체류 연장이 승인됐다.', fx: { flags: ['militaryDone'], meters: { front: 3 } } }, ng: { text: '서류 보완 요청이 왔다. 내년에 다시 결정해야 한다. 한국 언론의 시선이 따갑다.', fx: { meters: { media: -6 } } } },
      { label: '시즌이 끝나면 귀국해 입대한다', hint: '2시즌 공백 뒤 FA로 복귀', chance: C(95), ok: { text: '발표하자 한국 팬들의 응원이 쏟아졌다. 구단은 계약을 정지하기로 했다.', fx: { flags: ['enlist'], meters: { media: 12 }, followers: 1.3 } }, ng: { text: '', fx: {} } },
      { label: '미국 시민권을 취득한다', hint: '한국 팬들의 실망이 크다', chance: C(90), ok: { text: '시민권 선서를 마쳤다. 한국 커뮤니티가 들끓었다.', fx: { flags: ['militaryDone'], nat: 'US', meters: { media: -18 }, followers: .8 } }, ng: { text: '', fx: {} } },
    ] },
  // ── 미식축구만의 순간 ──
  { id: 'fb-4thdown', when: { stage: ['hs', 'college', 'nfl', 'cfl'], side: 'O', roleIn: ['starter', 'key'] }, eyebrow: '경기 중 · 4th & 1', title: '4번째 다운, 감독의 눈빛',
    body: '상대 진영 38야드, 4th & 1. 펀트 팀이 사이드라인에서 대기 중인데 감독이 헤드셋을 벗고 나를 본다. "갈 수 있겠어?"',
    choices: [
      { label: '"갑시다." 밀어붙인다', hint: '성공하면 흐름을 가져온다', chance: C(52, 'trust', .4), ok: { text: '스냅과 동시에 2야드를 짜냈다. 퍼스트 다운! 관중석이 폭발했다.', fx: { meters: { trust: 6, media: 4 }, season: { perf: 1 } } }, ng: { text: '반 야드가 모자랐다. 턴오버 온 다운스. 상대가 그 드라이브에서 득점했다.', fx: { meters: { trust: -5 }, season: { perf: -.6 } } } },
      { label: '펀트로 필드 포지션을 지킨다', chance: C(82), ok: { text: '펀트가 상대 5야드 라인에 멈췄다. 수비가 다음 공격을 막아 냈다.', fx: { meters: { trust: 2 } } }, ng: { text: '무난했지만 다음 날 지역 라디오가 "소심한 콜"을 성토했다.', fx: { meters: { media: -2 } } } },
    ] },
  { id: 'fb-2pt', when: { stage: ['hs', 'college', 'nfl', 'cfl'], side: 'O', roleIn: ['starter', 'key', 'rotation'] }, eyebrow: '종료 0:04 · 1점 차', title: '2점 컨버전이냐, 연장이냐',
    body: '방금 터치다운으로 22-23. 킥이면 연장, 2점 컨버전이면 경기 끝. 공격 코디네이터가 2점 플레이에 내 이름을 불렀다.',
    choices: [
      { label: '2점 컨버전, 나에게 맡겨라', chance: C(47, 'trust', .3), ok: { text: '엔드존에 공을 꽂았다. 24-23 역전승! 동료들이 나를 깔고 앉았다.', fx: { meters: { trust: 7, locker: 6, media: 8 }, season: { perf: 1.2 }, followers: 1.25 } }, ng: { text: '골라인 앞에서 막혔다. 경기가 끝났다. 라커룸이 조용하다.', fx: { meters: { trust: -3, media: -3 }, season: { perf: -.5 } } } },
      { label: 'PAT로 연장을 가자고 건의한다', chance: C(78), ok: { text: '연장전 첫 공격에서 결승 필드골. 이겼다.', fx: { meters: { trust: 3 } } }, ng: { text: '연장에서 졌다. "그때 2점을 갔어야"라는 말이 오래 따라다녔다.', fx: { meters: { media: -3 } } } },
    ] },
  { id: 'fb-trick', when: { stage: ['hs', 'college', 'nfl'], pos: ['QB', 'RB', 'WR', 'TE'] }, eyebrow: '골라인 4th & goal', title: '트릭 플레이 콜',
    body: '4th & goal, 1야드. 코치가 웃으며 플레이 카드를 보여 준다. 공이 두 번 손을 바꾼 뒤 쿼터백이 엔드존에서 패스를 받는 그 플레이, \'필리 스페셜\' 변형이다.',
    choices: [
      { label: '트릭 플레이를 한다', hint: '성공하면 하이라이트, 실패하면 역적', chance: C(46), ok: { text: '수비가 완전히 속았다. 터치다운! 그날 밤 하이라이트 1위.', fx: { meters: { media: 9, trust: 4 }, season: { perf: 1.2 }, followers: 1.35 } }, ng: { text: '핸드오프가 엉켰다. 펌블. 감독이 플레이 카드를 구겨 던졌다.', fx: { meters: { trust: -5 }, season: { perf: -.7 } } } },
      { label: '정석대로 힘으로 밀어붙인다', chance: C(64), ok: { text: '다이브로 1야드를 넘었다. 터치다운.', fx: { meters: { trust: 3 } } }, ng: { text: '골라인 스탠드에 막혔다.', fx: { meters: { trust: -1 } } } },
    ] },
  { id: 'fb-hailmary', when: { stage: ['hs', 'college', 'nfl'], pos: ['QB', 'WR', 'TE'] }, eyebrow: '종료 0:02 · 4점 차', title: '헤일 메리',
    body: '마지막 한 번. 52야드. 모두가 엔드존으로 달린다. 공이 하늘 높이 떠오른다.',
    choices: [
      { label: '내가 직접 해결한다 (점프 캐치 / 끝까지 버티고 던진다)', chance: C(30), ok: { text: '수비수 셋 사이에서 공이 내 손에 들어왔다. 버저비터 터치다운! 경기장이 무너질 듯 흔들렸다.', fx: { meters: { media: 14, trust: 6, locker: 6 }, season: { perf: 1.5 }, followers: 1.6 } }, ng: { text: '공이 손끝을 스치고 바닥에 떨어졌다.', fx: { season: { perf: -.3 } } } },
      { label: '공을 쳐 내 동료에게 기회를 준다', chance: C(42), ok: { text: '튕겨 나온 공을 동료가 낚아챘다. 터치다운! 내 팁이 결정적이었다.', fx: { meters: { locker: 8, media: 6 }, followers: 1.2 } }, ng: { text: '수비가 공을 쳐 냈다. 경기 끝.', fx: {} } },
    ] },
  { id: 'fb-iced', when: { stage: ['hs', 'college', 'nfl', 'cfl'], pos: ['K'] }, eyebrow: '종료 0:03 · 결승 필드골', title: '아이스 더 키커',
    body: '47야드 결승 필드골. 스냅 직전, 상대 감독이 타임아웃을 불렀다. 30초 동안 경기장 전체가 나만 본다.',
    choices: [
      { label: '처음부터 루틴을 다시 밟는다', chance: C(66, 'trust', .2), ok: { text: '세 걸음 뒤로, 두 걸음 옆으로. 공이 골대 한가운데를 가른다. 끝내기!', fx: { meters: { trust: 7, media: 10 }, attrs: { poise: 1 }, followers: 1.3 } }, ng: { text: '왼쪽 폴을 맞고 튕겨 나왔다.', fx: { meters: { trust: -6, media: -5 } } } },
      { label: '헬멧을 벗고 관중석을 본다. 즐긴다', chance: C(55), ok: { text: '여유가 통했다. 결승 필드골 성공. 상대 벤치가 머리를 감쌌다.', fx: { meters: { media: 8 }, attrs: { poise: 2 } } }, ng: { text: '너무 여유를 부렸나. 짧았다.', fx: { meters: { trust: -6 } } } },
    ] },
  { id: 'fb-fakepunt', when: { stage: ['hs', 'college', 'nfl'], pos: ['P'] }, eyebrow: '4th & 4 · 자기 진영 45야드', title: '페이크 펀트 사인',
    body: '스페셜팀 코치가 귀를 두 번 만졌다. 페이크 사인이다. 앞이 비어 있다.',
    choices: [
      { label: '공을 들고 직접 달린다', chance: C(48), ok: { text: '12야드 질주로 퍼스트 다운! 펀터가 달리자 관중이 미쳤다.', fx: { meters: { media: 9, trust: 5 }, attrs: { ath: 1 } } }, ng: { text: '2야드 앞에서 넘어졌다. 상대가 좋은 필드 포지션을 얻었다.', fx: { meters: { trust: -5 } } } },
      { label: '못 본 척 정상적으로 찬다', chance: C(80), ok: { text: '58야드 펀트가 코너로 빠져나갔다.', fx: { meters: { trust: 1 } } }, ng: { text: '코치가 사이드라인에서 팔을 휘저었다.', fx: { meters: { trust: -3 } } } },
    ] },
  { id: 'fb-hardcount', when: { stage: ['hs', 'college', 'nfl', 'cfl'], pos: ['DT', 'EDGE'] }, eyebrow: '3rd & 2', title: '쿼터백의 하드 카운트',
    body: '상대 QB가 목소리를 높이며 스냅 카운트를 끈다. 몸이 먼저 튀어 나가고 싶다.',
    choices: [
      { label: '끝까지 공만 보고 출발한다', chance: C(70), ok: { text: '스냅과 동시에 터졌다. 러닝백을 백필드에서 잡았다.', fx: { season: { perf: .8 }, meters: { trust: 3 } } }, ng: { text: '반 박자 늦었다. 퍼스트 다운을 내줬다.', fx: {} } },
      { label: '카운트를 읽고 먼저 뛴다', hint: '맞히면 색, 틀리면 페널티', chance: C(40), ok: { text: '정확히 읽었다. 블라인드 사이드 색! 펌블까지 유도했다.', fx: { season: { perf: 1.4 }, meters: { media: 5, trust: 4 } } }, ng: { text: '뉴트럴 존 침범. 5야드 페널티로 퍼스트 다운을 헌납했다.', fx: { meters: { trust: -5 } } } },
    ] },
  { id: 'fb-pick6', when: { stage: ['hs', 'college', 'nfl', 'cfl'], pos: ['CB', 'S'] }, eyebrow: '경기 중', title: '쿼터백이 나를 노린다',
    body: '상대가 세 번 연속 내 쪽으로 던졌다. 약점으로 본 모양이다. 필름에서 본 그 루트가 또 나올 것 같다.',
    choices: [
      { label: '일부러 공간을 주고 루트를 가로챈다', chance: C(44, 'trust', .2), ok: { text: '미끼를 물었다. 인터셉트 후 엔드존까지, 픽식스!', fx: { season: { perf: 1.6 }, meters: { media: 8, trust: 5 }, followers: 1.25 } }, ng: { text: '도박이 빗나갔다. 60야드 터치다운을 허용했다.', fx: { season: { perf: -1 }, meters: { trust: -6 } } } },
      { label: '정석대로 붙어서 막는다', chance: C(76), ok: { text: '패스를 쳐 냈다. 상대가 내 쪽을 피하기 시작했다.', fx: { season: { perf: .5 } } }, ng: { text: '결국 한 번 뚫렸다.', fx: { meters: { trust: -2 } } } },
    ] },
  { id: 'fb-goalline', when: { stage: ['hs', 'college', 'nfl', 'cfl'], pos: ['RB', 'LB', 'DT'] }, eyebrow: '골라인 스탠드', title: '1야드를 둘러싼 전쟁',
    body: '공은 1야드 라인 위. 양쪽 라인이 서로의 헬멧을 맞댄다. 이 한 번이 경기를 가른다.',
    choices: [
      { label: '몸을 날려 넘는다 / 파고든다', chance: C(52, 'trust', .3), ok: { text: '파일 맨 위로 넘어갔다. 심판의 두 팔이 올라갔다(막아 냈다)!', fx: { season: { perf: 1.1 }, meters: { trust: 5, locker: 4 } } }, ng: { text: '공중에서 부딪혀 튕겨 나왔다.', fx: { meters: { body: 1 } } } },
      { label: '틈을 보고 바깥으로 / 자리를 지킨다', chance: C(58), ok: { text: '바깥이 비어 있었다. 정답이었다.', fx: { season: { perf: .7 } } }, ng: { text: '바깥이 막혀 있었다.', fx: { meters: { trust: -2 } } } },
    ] },
  { id: 'fb-celebrate', when: { stage: ['hs', 'college', 'nfl'], pos: ['RB', 'WR', 'TE', 'QB', 'CB', 'S'] }, eyebrow: '터치다운 직후', title: '엔드존 세리머니',
    body: '시즌 첫 터치다운. 동료들과 준비한 단체 세리머니가 있다. 심판은 오늘 깃발을 자주 던진다.',
    choices: [
      { label: '준비한 단체 세리머니!', hint: '팬들은 좋아하지만 15야드 페널티 위험', chance: C(58, 'media', .3), ok: { text: '볼링 세리머니가 전국 SNS를 달궜다.', fx: { meters: { media: 9, locker: 6 }, followers: 1.3 } }, ng: { text: '노란 깃발. 15야드 페널티. 감독이 이를 악물었다.', fx: { meters: { trust: -5 }, money: -5000 } } },
      { label: '공을 조용히 심판에게 건넨다', chance: C(90), ok: { text: '"늘 해 본 것처럼 행동하라." 감독이 엄지를 들었다.', fx: { meters: { trust: 4 } } }, ng: { text: '', fx: {} } },
    ] },
  { id: 'fb-twominute', when: { stage: ['hs', 'college', 'nfl', 'cfl'], pos: ['QB'], seg: [1, 2, 3] }, eyebrow: '2분 경고', title: '노 허들, 역전 드라이브',
    body: '1:58 남기고 5점 차. 타임아웃 하나. 75야드를 가야 한다.',
    choices: [
      { label: '노 허들로 직접 콜한다', chance: C(48, 'trust', .4), ok: { text: '9플레이 75야드. 종료 12초 전 역전 터치다운 패스! "클러치"라는 별명이 붙었다.', fx: { season: { perf: 1.5 }, meters: { trust: 8, media: 9 }, attrs: { poise: 1 }, followers: 1.3 } }, ng: { text: '서두르다 인터셉트. 경기 끝.', fx: { meters: { trust: -6 }, season: { perf: -.8 } } } },
      { label: '사이드라인 콜을 받아 차분하게', chance: C(55), ok: { text: '짧게 끊어 가며 필드골 범위까지. 동점으로 연장, 결국 이겼다.', fx: { meters: { trust: 4 } } }, ng: { text: '시계가 먼저 끝났다.', fx: { meters: { media: -2 } } } },
    ] },
  { id: 'fb-blindside', when: { stage: ['hs', 'college', 'nfl', 'cfl'], pos: ['OL', 'TE'] }, eyebrow: '경기 전 미팅', title: '블라인드 사이드를 지켜라',
    body: '오늘 상대 엣지 러셔는 리그 색 1위. 쿼터백이 "내 등 뒤는 네가 맡아"라고 했다.',
    choices: [
      { label: '혼자 막겠다. 셋업을 깊게 잡는다', chance: C(55, 'trust', .3), ok: { text: '한 번도 쿼터백을 내주지 않았다. 상대 러셔가 고개를 저었다.', fx: { attrs: { pblk: 1 }, meters: { trust: 6 }, season: { perf: 1 } } }, ng: { text: '스피드에 두 번 뚫렸다. 쿼터백이 쓰러졌다.', fx: { meters: { trust: -5, locker: -3 } } } },
      { label: 'TE·RB에게 칩 블록 지원을 요청한다', chance: C(80), ok: { text: '협력 블로킹이 통했다. 공격이 술술 풀렸다.', fx: { meters: { locker: 4 } } }, ng: { text: '대신 패스 옵션이 줄었다.', fx: {} } },
    ] },
  { id: 'fb-filmtell', when: { stage: ['college', 'nfl', 'cfl'], side: 'D' }, eyebrow: '필름룸', title: '상대 쿼터백의 버릇',
    body: '필름을 열 번 돌려 봤다. 상대 QB는 패스 플레이 때 스냅 직전 왼발을 살짝 뒤로 뺀다.',
    choices: [
      { label: '수비진 전체와 공유한다', chance: C(82, 'locker', .2), ok: { text: '수비가 패스를 미리 읽었다. 그날 색 5개.', fx: { meters: { locker: 7, trust: 4 }, season: { perf: .6 } } }, ng: { text: '상대가 경기 중 버릇을 고쳤다.', fx: {} } },
      { label: '나만 알고 결정적인 순간에 쓴다', chance: C(60), ok: { text: '4쿼터 결정적인 순간, 정확히 읽고 뛰어들었다.', fx: { season: { perf: 1.3 } } }, ng: { text: '혼자 튀어 나가다 커버리지가 깨졌다.', fx: { meters: { locker: -3, trust: -2 } } } },
    ] },
  { id: 'fb-international', when: { stage: ['nfl'], seg: [1] }, eyebrow: 'NFL 해외 경기', title: '런던 원정',
    body: '이번 주는 런던에서 열리는 정규시즌 경기다. 시차는 8시간.',
    choices: [
      { label: '일주일 먼저 건너가 적응한다', chance: C(78), ok: { text: '몸이 가볍다. 영국 팬들 앞에서 펄펄 날았다.', fx: { season: { perf: .8 }, followers: 1.12 } }, ng: { text: '비 때문에 훈련을 거의 못 했다.', fx: {} } },
      { label: '평소 루틴대로 직전에 간다', chance: C(55), ok: { text: '별 차이 없었다.', fx: {} }, ng: { text: '경기 내내 몸이 무거웠다.', fx: { meters: { body: 1 }, season: { perf: -.5 } } } },
    ] },
  { id: 'fb-thanksgiving', when: { stage: ['nfl'], seg: [2] }, eyebrow: '추수감사절', title: '온 가족이 보는 경기',
    body: '추수감사절 낮 경기. 미국 전역 식탁 앞 TV가 이 경기를 틀어 놓는다.',
    choices: [
      { label: '큰 무대에서 나를 알린다', chance: C(58, 'media', .3), ok: { text: '그날 경기 MVP. 중계진이 칠면조 다리를 건넸다.', fx: { meters: { media: 8 }, followers: 1.3, season: { perf: .8 } } }, ng: { text: '조용한 하루였다.', fx: {} } },
      { label: '경기 뒤 가족과 저녁을 먹는다', chance: C(90), ok: { text: '오랜만에 엄마가 해 준 밥. 마음이 편해졌다.', fx: { meters: { body: -1, locker: 2 } } }, ng: { text: '', fx: {} } },
    ] },
  { id: 'fb-docu', when: { stage: ['nfl'], seg: [0], ageMax: 27 }, eyebrow: '트레이닝 캠프', title: '리얼리티 다큐 출연 제안',
    body: '스포츠 다큐 제작진이 팀 캠프를 밀착 취재한다. 내 이야기를 중심으로 찍고 싶다고 한다.',
    choices: [
      { label: '출연한다', chance: C(60, 'media', .4), ok: { text: '방송 이후 전국구 인기 선수가 됐다.', fx: { followers: 1.6, meters: { media: 9 } } }, ng: { text: '편집된 장면 하나가 논란이 됐다.', fx: { meters: { media: -6, locker: -3 } } } },
      { label: '정중히 사양하고 훈련에 집중한다', chance: C(88), ok: { text: '코치들이 그 태도를 기억했다.', fx: { meters: { trust: 4 } } }, ng: { text: '', fx: {} } },
    ] },
  { id: 'fb-cutday', when: { stage: ['nfl'], seg: [0], roleIn: ['backup', 'special', 'practice'] }, eyebrow: '로스터 확정 전날', title: '컷 데이',
    body: '내일 53인 로스터가 발표된다. 마지막 프리시즌 경기, 스페셜팀에서 뛸 기회가 왔다.',
    choices: [
      { label: '킥오프 커버에서 몸을 날린다', chance: C(55, 'trust', .3), ok: { text: '리터너를 20야드 라인 안쪽에서 쓰러뜨렸다. 감독이 메모했다.', fx: { meters: { trust: 8 }, season: { playing: .08 } } }, ng: { text: '너무 무리하다 발목을 접질렸다.', fx: { season: { injury: .05 }, meters: { body: 1 } } } },
      { label: '포지션 코치에게 조언을 구한다', chance: C(72), ok: { text: '"너는 남는다. 다만 스페셜팀에서 먼저 증명해."', fx: { meters: { trust: 4 } } }, ng: { text: '코치는 말을 아꼈다.', fx: {} } },
    ] },
  { id: 'fb-lightning', when: { stage: ['hs', 'college'], seg: [0, 1] }, eyebrow: '경기 중단', title: '번개 경보',
    body: '하프타임 직전, 경기장 위로 번개가 쳤다. 규정상 30분 이상 경기가 멈춘다. 라커룸이 어수선하다.',
    choices: [
      { label: '계속 몸을 풀며 동료들을 다독인다', chance: C(74, 'locker', .3), ok: { text: '재개 후 첫 공격에서 터치다운. 흐름을 놓치지 않았다.', fx: { meters: { locker: 6 }, season: { perf: .6 } } }, ng: { text: '대기가 길어지자 다들 지쳤다.', fx: {} } },
      { label: '헤드폰을 끼고 혼자 집중한다', chance: C(70), ok: { text: '머릿속으로 남은 플레이를 다 그려 봤다.', fx: { attrs: { mental: 1 } } }, ng: { text: '몸이 식어 버렸다.', fx: { season: { injury: .02 } } } },
    ] },
  { id: 'fb-seniorbowl', when: { stage: ['college'], collegeYear: [3, 4, 5], seg: [3], minOvr: 66 }, eyebrow: '드래프트 준비', title: '시니어 보울 초청',
    body: '드래프트 유망주들이 모이는 시니어 보울(대학 올스타전)에서 초청장이 왔다. NFL 32개 구단 스카우트가 일주일 내내 훈련을 지켜본다.',
    choices: [
      { label: '참가해 스카우트 앞에서 증명한다', chance: C(62), ok: { text: '1대1 드릴에서 압도했다. 드래프트 보드가 움직였다는 소문.', fx: { flags: ['seniorBowl'], meters: { media: 5 } } }, ng: { text: '평범했다. 그래도 얼굴은 알렸다.', fx: { meters: { media: 1 } } } },
      { label: '부상 위험을 피해 불참한다', chance: C(90), ok: { text: '몸을 아끼고 컴바인을 준비한다.', fx: { flags: ['combinePrep'] } }, ng: { text: '', fx: {} } },
    ] },
  { id: 'fb-interview', when: { stage: ['college'], collegeYear: [3, 4, 5], seg: [2, 3], minOvr: 64 }, eyebrow: '드래프트 준비', title: '구단 인터뷰와 필기 테스트',
    body: '컴바인에서는 15분짜리 구단 인터뷰와 필기 테스트도 본다. 화이트보드 앞에서 플레이북을 설명해야 한다.',
    choices: [
      { label: '필름과 플레이북을 밤새 공부한다', chance: C(76), ok: { text: '인터뷰에서 상대 수비 커버리지를 술술 설명했다. 단장들이 고개를 끄덕였다.', fx: { flags: ['interviewAce'], attrs: { mental: 1 } } }, ng: { text: '긴장해서 말이 꼬였다.', fx: {} } },
      { label: '40야드 대시 훈련에 집중한다', chance: C(72), ok: { text: '스타트 동작이 0.05초 빨라졌다.', fx: { flags: ['combinePrep'] } }, ng: { text: '햄스트링이 살짝 당긴다.', fx: { meters: { body: 1 } } } },
    ] },
  { id: 'fb-visit', when: { stage: ['hs'], grade: [11, 12], seg: [1, 2] }, eyebrow: '리크루팅', title: '공식 방문 주말',
    body: '대학 두 곳에서 공식 방문 초청이 왔다. 한 곳은 10만 관중의 명문, 한 곳은 집에서 30분 거리의 중위권 학교다.',
    choices: [
      { label: '명문 대학을 방문한다', chance: C(70, 'media', .2), ok: { text: '헤드코치가 직접 라커룸 투어를 해 줬다. "네 자리를 비워 두겠다."', fx: { flags: ['exposure'], followers: 1.15 } }, ng: { text: '수많은 유망주 중 하나처럼 느껴졌다.', fx: {} } },
      { label: '가까운 학교를 방문한다', chance: C(85), ok: { text: '"너를 중심으로 팀을 만들겠다"는 말이 마음에 남았다.', fx: { meters: { locker: 3 } } }, ng: { text: '', fx: {} } },
    ] },
  // ── 공통 ──
  { id: 'any-family', when: {}, eyebrow: '가족', title: '부모님이 경기를 보러 온다',
    body: '처음으로 부모님이 직관을 오신다. 관중석 어디쯤일까.',
    choices: [
      { label: '경기 전 관중석에 손을 흔든다', chance: C(82), ok: { text: '엄마가 휴대폰으로 찍은 영상을 몇 번이나 돌려 봤다.', fx: { season: { perf: .6 }, meters: { locker: 2 } } }, ng: { text: '긴장해서 몸이 굳었다.', fx: { season: { perf: -.3 } } } },
      { label: '평소처럼 경기에만 집중한다', chance: C(88), ok: { text: '경기 뒤 아빠가 말없이 어깨를 쥐었다.', fx: { season: { perf: .3 } } }, ng: { text: '', fx: {} } },
    ] },
  { id: 'any-diet', when: { stage: ['college', 'nfl', 'cfl'] }, eyebrow: '몸 관리', title: '식단표',
    body: '팀 영양사가 새 식단표를 건넸다. 좋아하는 음식이 하나도 없다.',
    choices: [
      { label: '식단표대로 먹는다', chance: C(78), ok: { text: '체지방이 줄고 회복이 빨라졌다.', fx: { meters: { body: -2 }, attrs: { str: 1 } } }, ng: { text: '일주일 만에 치킨을 시켰다.', fx: {} } },
      { label: '먹고 싶은 대로 먹는다', chance: C(55), ok: { text: '행복이 최고의 보약.', fx: { meters: { locker: 2 } } }, ng: { text: '몸이 무거워졌다.', fx: { meters: { body: 1 }, season: { perf: -.4 } } } },
    ] },
];
export const CARD_BY_ID = Object.fromEntries(CARDS.map(c => [c.id, c]));

// 지금까지의 폼: 평점으로 판단 (최소 3경기).
export function formOf(s) {
  const L = s.season?.line;
  if (!L || L.g < 3) return 'normal';
  const g = L.gradeSum / L.g;
  return g >= 74 ? 'hot' : g <= 57 ? 'slump' : 'normal';
}
function matches(s, c, seg) {
  const w = c.when, p = s.player, z = s.season;
  if (w.stage && !w.stage.includes(s.stage)) return false;
  if (w.pos && !w.pos.includes(p.pos)) return false;
  if (w.side && POSITIONS[p.pos].side !== w.side) return false;
  if (w.ageMin && p.age < w.ageMin) return false;
  if (w.ageMax && p.age > w.ageMax) return false;
  if (w.seg && !w.seg.includes(seg)) return false;
  if (w.nat && p.nat !== w.nat) return false;
  if (w.first && s.history.length) return false;
  if (w.grade && !w.grade.includes(s.grade)) return false;
  if (w.collegeYear && !w.collegeYear.includes(s.collegeYear)) return false;
  if (w.roleIn && !w.roleIn.includes(z.role)) return false;
  if (w.minOvr && p.ovr < w.minOvr) return false;
  if (w.form && formOf(s) !== w.form) return false;
  if (w.noTwoWay && p.twoWay) return false;
  if (w.noRedshirt && (s.redshirt || s.redshirtUsed)) return false;
  if (w.noFlag && s.flags.includes(w.noFlag)) return false;
  if (w.noFlag2 && s.flags.includes(w.noFlag2)) return false;
  if (w.contractLast && !(s.contract && s.contract.yearsLeft === 1)) return false;
  if (w.losing && !(z.line.l > z.line.w + 1)) return false;
  return true;
}
export function chanceOf(s, ch) {
  const m = ch.meter ? (s.meters[ch.meter] ?? 50) - (ch.meter === 'body' ? 0 : 50) : 0;
  return clamp(Math.round(ch.base + m * (ch.per || 0) + diffOf(s).chance), 5, 95);
}
export function drawCard(s, r, seg) {
  const seen = new Set(s.cardsSeen || []);
  const pool = CARDS.filter(c => matches(s, c, seg));
  const fresh = pool.filter(c => !seen.has(c.id));
  const list = fresh.length ? fresh : pool.filter(c => !(s.season.cards || []).includes(c.id));
  if (!list.length) return null;
  // 조건이 구체적인 카드(포지션·국적·폼)를 조금 더 자주.
  const weightOf = c => 1 + Object.keys(c.when).length * .35;
  let d = r() * list.reduce((n, c) => n + weightOf(c), 0);
  const c = list.find(x => (d -= weightOf(x)) < 0) || list[0];
  s.cardsSeen = [...seen, c.id].slice(-40);
  s.season.cards.push(c.id);
  return { id: c.id, seg, label: s.season.segLabels[seg], choices: c.choices.map((x, i) => ({ i, label: x.label, hint: x.hint || '', chance: chanceOf(s, x.chance) })) };
}
// 선택지 결과 적용. 보이는 확률 그대로 굴립니다.
export function resolveCard(s, r, card, choiceIdx) {
  const c = CARD_BY_ID[card.id], ch = c.choices[choiceIdx];
  if (!ch) throw Error('없는 선택지입니다.');
  const chance = card.choices[choiceIdx].chance, roll = Math.floor(r() * 100), ok = roll < chance;
  const out = ok ? ch.ok : ch.ng;
  const lines = applyFx(s, r, out.fx || {});
  return { id: card.id, title: c.title, choice: ch.label, chance, roll, ok, text: out.text || (ok ? '무난하게 지나갔다.' : '별일 없이 지나갔다.'), lines };
}
function attrTarget(p, key) {
  const keys = attrsOf(p.pos), w = POSITIONS[p.pos].w;
  if (keys.includes(key)) return key;
  if (key === 'main') return p.focus[0] || keys.sort((a, b) => w[b] - w[a])[0];
  if (key === 'mental') return ['vis', 'poise', 'acc', 'route', 'cov', 'kacc', 'cons', 'pblk'].find(k => keys.includes(k)) || keys[0];
  if (key === 'phys' || key === 'str') return ['str', 'spd', 'agi', 'kpow', 'ath'].find(k => keys.includes(k)) || keys[0];
  return [...keys].sort((a, b) => w[b] - w[a])[0];
}
export function applyFx(s, r, fx) {
  const p = s.player, lines = [];
  for (const [k, v] of Object.entries(fx.meters || {})) {
    if (!v) continue;
    s.meters[k] = clamp((s.meters[k] ?? (k === 'body' ? 0 : 50)) + v, 0, k === 'body' ? 10 : 100);
    lines.push(`${METERS[k]} ${v > 0 ? '+' : ''}${v}`);
  }
  for (const [k, v] of Object.entries(fx.attrs || {})) {
    const t = attrTarget(p, k);
    p.attrs[t] = clamp(p.attrs[t] + v, 15, 99);
    lines.push(`${ATTR[t][0]} ${v > 0 ? '+' : ''}${v}`);
  }
  if (fx.attrs) p.ovr = overall(p.pos, p.attrs);
  for (const [k, v] of Object.entries(fx.season || {})) {
    s.seasonMods[k] = (s.seasonMods[k] || 0) + v;
    if (s.season && k === 'injury') s.season.injuryChance = clamp(s.season.injuryChance + v, .02, .7);
    lines.push(k === 'playing' ? `출전 기회 ${v > 0 ? '+' : ''}${Math.round(v * 100)}%` : k === 'perf' ? `경기력 ${v > 0 ? '상승' : '하락'}` : `부상 위험 ${v > 0 ? '증가' : '감소'}`);
  }
  if (fx.money) { s.money = Math.max(0, s.money + fx.money); lines.push(`자금 ${fx.money > 0 ? '+' : '−'}${usd(Math.abs(fx.money))}`); }
  if (fx.followers) { const before = s.followers; s.followers = Math.max(10, Math.round(s.followers * fx.followers)); lines.push(`팔로워 ${s.followers >= before ? '▲' : '▼'}${Math.abs(s.followers - before).toLocaleString('ko-KR')}`); }
  for (const f of fx.flags || []) if (!s.flags.includes(f)) s.flags.push(f);
  if (fx.redshirt && s.season) { s.redshirt = true; s.season.role = 'redshirt'; s.season.redshirtGames = s.season.line.g; lines.push('레드셔트 시즌 (남은 경기 최대 4경기)'); }
  if (fx.nat) p.nat = fx.nat;
  if (fx.extend && s.contract) {
    const mv = Math.round(estimateMarket(s) * fx.extend), yrs = p.age <= 28 ? 4 : 2;
    s.contract = { ...s.contract, type: 'vet', aav: mv, years: yrs, yearsLeft: yrs + 1, total: mv * yrs, guaranteed: Math.round(mv * yrs * .5) };
    lines.push(`연장 계약 ${yrs}년 · 연 ${usd(mv)}`);
  }
  return lines;
}
// career.js의 marketValue와 같은 식 (순환 참조를 피하려고 복제).
function estimateMarket(s) {
  const POS_MARKET = { QB: 56e6, WR: 41e6, EDGE: 41e6, DT: 36e6, OL: 30e6, CB: 30e6, S: 21e6, LB: 21e6, RB: 20e6, TE: 20e6, K: 6.5e6, P: 4.2e6 };
  const p = s.player, f = Math.pow(clamp((p.ovr - 64) / 31, 0, 1.1), 1.8), ageF = p.age > 30 ? Math.pow(.86, p.age - 30) : 1;
  return Math.max(1e6, POS_MARKET[p.pos] * f * ageF);
}
export { pick };
