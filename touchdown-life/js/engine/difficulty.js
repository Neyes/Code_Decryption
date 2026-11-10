// 난이도: 쉬움 · 노말 · 하드(리얼리스틱). 커리어마다 s.difficulty에 저장하고 설정에서 바꿀 수 있습니다.
// 노말은 기준 밸런스(값이 없는 예전 저장도 노말)입니다. 쉬움은 성장·확률·판정을 넉넉하게,
// 하드는 성장 속도·드래프트 확률·직접 플레이를 현실에 가깝게 맞춥니다 (tools/simulate.mjs로 맞춘 값).
//
// 커리어(엔진)
//   growth 성장량 배율 · pro 프로(NFL·CFL)에서의 성장량 추가 배율 · stall 한 능력치가 정체할 확률 · breakout 급성장 확률 배율 · decline 노쇠 배율
//   scout 드래프트·FA 평가 보정(점) · recruit 고교 리크루팅 평가 보정(점, 없으면 scout) · chance 선택 카드 성공 확률 보정(%p) · injury 부상 확률 배율
//   role 주전 경쟁에서 내 평가 보정(OVR점) · form 경기력 보정(OVR점) · income 수입 배율 · gym 헬스장 상승량 배율
//   cut 방출 확률 배율 · cutBackup 젊은 백업도 방출될 수 있음 · udfaMin 언드래프티 전화가 오는 최소 OVR · psMin 연습생 제안 최소 OVR · psMax 연습생으로 버틸 수 있는 시즌 수 · cflMin CFL 제안 최소 OVR (0 = 제한 없음)
// 직접 플레이(live: 실시간 필드)
//   mate·opp 우리 팀·상대 AI 능력치 보정 · edge 직접 뛰지 않는 장면의 전력 보정
//   reach 내 캐치 범위 보너스(야드) · catchP 내 캐치 확률 보정 · throwErr 내 패스 오차 배율
//   pocket 포켓 시간 보정(초, 내 쪽에 유리한 방향) · skill 기술(스핀·페이크·잼·펌프 등) 성공 확률 보정
//   cd 기술 재사용 대기 배율 · breakP 태클 대결 보정(내가 뚫을 때 +, 내가 태클할 때 상대에게 −)
//   myTackle 내 태클 범위 보정(야드) · aiDive 상대 다이브 태클 빈도 배율 · aiInt 상대의 인터셉트·팁 확률 배율
//   myInt 내 인터셉트 확률 보정 · fumble 내 펌블 확률 배율 · assist 손을 뗐을 때 AI가 대신 뛰어 주는 정도 배율
//   callWait 패스 콜 뒤 쿼터백이 던지기까지 배율 · disguise 상대가 커버리지를 숨길 확률 · openHint 리시버 열림 색 표시
//   coverSpd 상대 커버 속도 배율 · coverLag 맨 커버가 늦게 따라오는 정도 배율 · react 뜬 공에 반응하는 지연 배율 · pursue 볼 캐리어 추격 속도 배율
// 킥(kick): err 흔들림 배율 · rush 러셔 도착 시간 보정(초) · over 너무 세게 찼을 때 벌점 배율 · wind 바람 배율
// 헬스장 미니게임(gymWin): 판정 구간·제한 시간 배율
export const DIFFICULTY = {
  easy: {
    id: 'easy', name: '쉬움', tag: 'EASY', color: '#3BB273',
    blurb: '성장이 빠르고 선택지 확률이 높아요. 직접 플레이는 판정이 넉넉하고 상대가 약해요.',
    growth: 1.1, pro: 1, stall: .17, breakout: 1.2, decline: .9, scout: 1.5, recruit: 1.5, chance: 8, injury: .7, role: 1.5, form: .7, income: 1.2, gym: 1.3, cut: .7, cutBackup: false, udfaMin: 0, psMin: 0, psMax: 99, cflMin: 0,
    live: { mate: 2, opp: -3, edge: 6, reach: .5, catchP: .07, throwErr: .7, pocket: .6, skill: .15, cd: .8, breakP: .08, myTackle: .3, aiDive: .75, aiInt: .55, myInt: .12, fumble: .5, assist: 1.3, callWait: .7, disguise: .08, openHint: true, coverSpd: .96, coverLag: 1.35, react: 1.3, pursue: .98 },
    kick: { err: .7, rush: .8, over: .6, wind: .5 },
    gymWin: 1.2,
  },
  normal: {
    id: 'normal', name: '노말', tag: 'NORMAL', color: '#2F6FD6',
    blurb: '기준 밸런스예요. 쉬움보다 빡빡하지만 잘 키우면 프로에서 스타가 될 수 있어요.',
    growth: 1, pro: 1, stall: .22, breakout: 1, decline: 1, scout: 0, recruit: 0, chance: 0, injury: 1, role: 0, form: 0, income: 1, gym: 1, cut: 1, cutBackup: false, udfaMin: 0, psMin: 0, psMax: 99, cflMin: 0,
    live: { mate: 0, opp: 0, edge: 0, reach: .25, catchP: 0, throwErr: 1, pocket: 0, skill: 0, cd: 1, breakP: 0, myTackle: 0, aiDive: 1, aiInt: 1, myInt: 0, fumble: 1, assist: 1, callWait: 1, disguise: .22, openHint: true, coverSpd: 1, coverLag: 1, react: 1, pursue: 1 },
    kick: { err: 1, rush: 0, over: 1, wind: 1 },
    gymWin: 1,
  },
  hard: {
    id: 'hard', name: '하드 (리얼리스틱)', tag: 'REAL', color: '#D9483B',
    blurb: '성장 속도·NFL 드래프트 확률·직접 플레이가 현실에 가까워요. 대부분은 프로에 가지 못해요.',
    growth: .72, pro: .6, stall: .3, breakout: .45, decline: 1.15, scout: -9, recruit: -3, chance: -8, injury: 1.3, role: -4, form: -2.5, income: .85, gym: .7, cut: 2, cutBackup: true, udfaMin: 65, psMin: 66, psMax: 1, cflMin: 56,
    live: { mate: 0, opp: 4, edge: -4, reach: 0, catchP: -.04, throwErr: 1.35, pocket: -.5, skill: -.08, cd: 1.2, breakP: -.05, myTackle: -.1, aiDive: 1.3, aiInt: 1.2, myInt: -.08, fumble: 1.25, assist: .6, callWait: 1.35, disguise: .38, openHint: false, coverSpd: 1.05, coverLag: .5, react: .65, pursue: 1.05 },
    kick: { err: 1.3, rush: -.45, over: 1.4, wind: 1.35 },
    gymWin: .85,
  },
};
export const DIFF_ORDER = ['easy', 'normal', 'hard'];
export const DIFF_DEFAULT = 'normal';
export const diffId = s => (DIFFICULTY[s?.difficulty] ? s.difficulty : DIFF_DEFAULT);
export const diffOf = s => DIFFICULTY[diffId(s)];
// 커리어 도중 난이도를 바꾸면, 기록에는 그동안 쓴 가장 쉬운 난이도가 남습니다.
export function setDifficulty(s, id) {
  if (!DIFFICULTY[id]) throw Error('없는 난이도입니다.');
  const before = diffId(s);
  s.difficulty = id;
  const low = DIFF_ORDER[Math.min(DIFF_ORDER.indexOf(s.diffLow ?? before), DIFF_ORDER.indexOf(id))];
  s.diffLow = low;
  return s;
}
export const diffLowest = s => DIFFICULTY[s?.diffLow] ? s.diffLow : diffId(s);
