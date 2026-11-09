// NFL 32개 구단 (2026 시즌 기준).
// 감독: 위키백과 "List of current NFL head coaches" (2026-11 확인). 구장·디비전·슈퍼볼 우승 횟수는 Super Bowl LX(2026-02, 시애틀 우승)까지 반영.
// power: 게임 속 기본 전력(0~100). 실제 전력 평가가 아니라 시뮬레이션의 출발점입니다.
export const TEAMS = [
  { id: 'BUF', en: 'Buffalo Bills', ko: '버펄로 빌스', short: '빌스', city: '버펄로', conf: 'AFC', div: 'AFC 동부', stadium: '하이마크 스타디움', coach: '조 브래디', colors: ['#00338D', '#C60C30'], sb: 0, power: 78 },
  { id: 'MIA', en: 'Miami Dolphins', ko: '마이애미 돌핀스', short: '돌핀스', city: '마이애미', conf: 'AFC', div: 'AFC 동부', stadium: '하드 록 스타디움', coach: '제프 해플리', colors: ['#008E97', '#FC4C02'], sb: 2, power: 58 },
  { id: 'NE', en: 'New England Patriots', ko: '뉴잉글랜드 패트리어츠', short: '패트리어츠', city: '폭스버러', conf: 'AFC', div: 'AFC 동부', stadium: '질레트 스타디움', coach: '마이크 브레이블', colors: ['#002244', '#C60C30'], sb: 6, power: 80 },
  { id: 'NYJ', en: 'New York Jets', ko: '뉴욕 제츠', short: '제츠', city: '이스트러더퍼드', conf: 'AFC', div: 'AFC 동부', stadium: '메트라이프 스타디움', coach: '에런 글렌', colors: ['#125740', '#FFFFFF'], sb: 1, power: 48 },
  { id: 'BAL', en: 'Baltimore Ravens', ko: '볼티모어 레이븐스', short: '레이븐스', city: '볼티모어', conf: 'AFC', div: 'AFC 북부', stadium: 'M&T 뱅크 스타디움', coach: '제시 민터', colors: ['#241773', '#9E7C0C'], sb: 2, power: 70 },
  { id: 'CIN', en: 'Cincinnati Bengals', ko: '신시내티 벵골스', short: '벵골스', city: '신시내티', conf: 'AFC', div: 'AFC 북부', stadium: '페이코 스타디움', coach: '잭 테일러', colors: ['#FB4F14', '#000000'], sb: 0, power: 62 },
  { id: 'CLE', en: 'Cleveland Browns', ko: '클리블랜드 브라운스', short: '브라운스', city: '클리블랜드', conf: 'AFC', div: 'AFC 북부', stadium: '헌팅턴 뱅크 필드', coach: '토드 몽컨', colors: ['#311D00', '#FF3C00'], sb: 0, power: 55 },
  { id: 'PIT', en: 'Pittsburgh Steelers', ko: '피츠버그 스틸러스', short: '스틸러스', city: '피츠버그', conf: 'AFC', div: 'AFC 북부', stadium: '애크리슈어 스타디움', coach: '마이크 매카시', colors: ['#101820', '#FFB612'], sb: 6, power: 66 },
  { id: 'HOU', en: 'Houston Texans', ko: '휴스턴 텍산스', short: '텍산스', city: '휴스턴', conf: 'AFC', div: 'AFC 남부', stadium: 'NRG 스타디움', coach: '디미코 라이언스', colors: ['#03202F', '#A71930'], sb: 0, power: 74 },
  { id: 'IND', en: 'Indianapolis Colts', ko: '인디애나폴리스 콜츠', short: '콜츠', city: '인디애나폴리스', conf: 'AFC', div: 'AFC 남부', stadium: '루커스 오일 스타디움', coach: '셰인 스타이컨', colors: ['#002C5F', '#A2AAAD'], sb: 2, power: 64 },
  { id: 'JAX', en: 'Jacksonville Jaguars', ko: '잭슨빌 재규어스', short: '재규어스', city: '잭슨빌', conf: 'AFC', div: 'AFC 남부', stadium: '에버뱅크 스타디움', coach: '리엄 코언', colors: ['#006778', '#D7A22A'], sb: 0, power: 74 },
  { id: 'TEN', en: 'Tennessee Titans', ko: '테네시 타이탄스', short: '타이탄스', city: '내슈빌', conf: 'AFC', div: 'AFC 남부', stadium: '닛산 스타디움', coach: '로버트 살레', colors: ['#0C2340', '#4B92DB'], sb: 0, power: 50 },
  { id: 'DEN', en: 'Denver Broncos', ko: '덴버 브롱코스', short: '브롱코스', city: '덴버', conf: 'AFC', div: 'AFC 서부', stadium: '엠파워 필드 앳 마일 하이', coach: '숀 페이턴', colors: ['#FB4F14', '#002244'], sb: 3, power: 79 },
  { id: 'KC', en: 'Kansas City Chiefs', ko: '캔자스시티 치프스', short: '치프스', city: '캔자스시티', conf: 'AFC', div: 'AFC 서부', stadium: '애로헤드 스타디움', coach: '앤디 리드', colors: ['#E31837', '#FFB81C'], sb: 4, power: 70 },
  { id: 'LV', en: 'Las Vegas Raiders', ko: '라스베이거스 레이더스', short: '레이더스', city: '라스베이거스', conf: 'AFC', div: 'AFC 서부', stadium: '얼리전트 스타디움', coach: '클린트 쿠비악', colors: ['#000000', '#A5ACAF'], sb: 3, power: 50 },
  { id: 'LAC', en: 'Los Angeles Chargers', ko: '로스앤젤레스 차저스', short: '차저스', city: '잉글우드', conf: 'AFC', div: 'AFC 서부', stadium: '소파이 스타디움', coach: '짐 하보', colors: ['#0080C6', '#FFC20E'], sb: 0, power: 72 },
  { id: 'DAL', en: 'Dallas Cowboys', ko: '댈러스 카우보이스', short: '카우보이스', city: '알링턴', conf: 'NFC', div: 'NFC 동부', stadium: 'AT&T 스타디움', coach: '브라이언 쇼튼하이머', colors: ['#003594', '#869397'], sb: 5, power: 62 },
  { id: 'NYG', en: 'New York Giants', ko: '뉴욕 자이언츠', short: '자이언츠', city: '이스트러더퍼드', conf: 'NFC', div: 'NFC 동부', stadium: '메트라이프 스타디움', coach: '존 하보', colors: ['#0B2265', '#A71930'], sb: 4, power: 54 },
  { id: 'PHI', en: 'Philadelphia Eagles', ko: '필라델피아 이글스', short: '이글스', city: '필라델피아', conf: 'NFC', div: 'NFC 동부', stadium: '링컨 파이낸셜 필드', coach: '닉 시리아니', colors: ['#004C54', '#A5ACAF'], sb: 2, power: 75 },
  { id: 'WAS', en: 'Washington Commanders', ko: '워싱턴 커맨더스', short: '커맨더스', city: '랜도버', conf: 'NFC', div: 'NFC 동부', stadium: '노스웨스트 스타디움', coach: '댄 퀸', colors: ['#5A1414', '#FFB612'], sb: 3, power: 60 },
  { id: 'CHI', en: 'Chicago Bears', ko: '시카고 베어스', short: '베어스', city: '시카고', conf: 'NFC', div: 'NFC 북부', stadium: '솔저 필드', coach: '벤 존슨', colors: ['#0B162A', '#C83803'], sb: 1, power: 73 },
  { id: 'DET', en: 'Detroit Lions', ko: '디트로이트 라이언스', short: '라이언스', city: '디트로이트', conf: 'NFC', div: 'NFC 북부', stadium: '포드 필드', coach: '댄 캠벨', colors: ['#0076B6', '#B0B7BC'], sb: 0, power: 72 },
  { id: 'GB', en: 'Green Bay Packers', ko: '그린베이 패커스', short: '패커스', city: '그린베이', conf: 'NFC', div: 'NFC 북부', stadium: '램보 필드', coach: '맷 라플러', colors: ['#203731', '#FFB612'], sb: 4, power: 70 },
  { id: 'MIN', en: 'Minnesota Vikings', ko: '미네소타 바이킹스', short: '바이킹스', city: '미니애폴리스', conf: 'NFC', div: 'NFC 북부', stadium: 'US 뱅크 스타디움', coach: '케빈 오코넬', colors: ['#4F2683', '#FFC62F'], sb: 0, power: 63 },
  { id: 'ATL', en: 'Atlanta Falcons', ko: '애틀랜타 팰컨스', short: '팰컨스', city: '애틀랜타', conf: 'NFC', div: 'NFC 남부', stadium: '메르세데스-벤츠 스타디움', coach: '케빈 스테판스키', colors: ['#A71930', '#000000'], sb: 0, power: 60 },
  { id: 'CAR', en: 'Carolina Panthers', ko: '캐롤라이나 팬서스', short: '팬서스', city: '샬럿', conf: 'NFC', div: 'NFC 남부', stadium: '뱅크 오브 아메리카 스타디움', coach: '데이브 카날레스', colors: ['#0085CA', '#101820'], sb: 0, power: 61 },
  { id: 'NO', en: 'New Orleans Saints', ko: '뉴올리언스 세인츠', short: '세인츠', city: '뉴올리언스', conf: 'NFC', div: 'NFC 남부', stadium: '시저스 슈퍼돔', coach: '켈런 무어', colors: ['#D3BC8D', '#101820'], sb: 1, power: 55 },
  { id: 'TB', en: 'Tampa Bay Buccaneers', ko: '탬파베이 버커니어스', short: '버커니어스', city: '탬파', conf: 'NFC', div: 'NFC 남부', stadium: '레이먼드 제임스 스타디움', coach: '토드 볼스', colors: ['#D50A0A', '#34302B'], sb: 2, power: 64 },
  { id: 'ARI', en: 'Arizona Cardinals', ko: '애리조나 카디널스', short: '카디널스', city: '글렌데일', conf: 'NFC', div: 'NFC 서부', stadium: '스테이트 팜 스타디움', coach: '마이크 라플러', colors: ['#97233F', '#000000'], sb: 0, power: 50 },
  { id: 'LAR', en: 'Los Angeles Rams', ko: '로스앤젤레스 램스', short: '램스', city: '잉글우드', conf: 'NFC', div: 'NFC 서부', stadium: '소파이 스타디움', coach: '숀 맥베이', colors: ['#003594', '#FFA300'], sb: 2, power: 77 },
  { id: 'SF', en: 'San Francisco 49ers', ko: '샌프란시스코 포티나이너스', short: '포티나이너스', city: '샌타클래라', conf: 'NFC', div: 'NFC 서부', stadium: '리바이스 스타디움', coach: '카일 섀너핸', colors: ['#AA0000', '#B3995D'], sb: 5, power: 74 },
  { id: 'SEA', en: 'Seattle Seahawks', ko: '시애틀 시호크스', short: '시호크스', city: '시애틀', conf: 'NFC', div: 'NFC 서부', stadium: '루멘 필드', coach: '마이크 맥도널드', colors: ['#002244', '#69BE28'], sb: 2, power: 81 },
];
export const TEAM_BY_ID = Object.fromEntries(TEAMS.map(t => [t.id, t]));
export const TEAM_BY_EN = Object.fromEntries(TEAMS.map(t => [t.en, t]));
export const DIVISIONS = [...new Set(TEAMS.map(t => t.div))];
export const LAST_CHAMPION = { season: 2025, team: 'SEA', game: '슈퍼볼 LX' };
// 은퇴한 등번호. 위키백과 로스터 템플릿에 적힌 구단만 넣었습니다(그 외 구단은 게임에서 쌓인 영구결번만 표시).
export const RETIRED_NUMBERS = { KC: [3, 16, 18, 28, 33, 36, 58, 63, 78, 86] };

// 캐나다 CFL: NFL에서 자리를 잃었을 때의 재도전 무대.
export const CFL_TEAMS = [
  { id: 'BC', ko: 'BC 라이언스' }, { id: 'CGY', ko: '캘거리 스탬피더스' }, { id: 'EDM', ko: '에드먼턴 엘크스' },
  { id: 'SSK', ko: '서스캐처원 러프라이더스' }, { id: 'WPG', ko: '위니펙 블루 바머스' }, { id: 'HAM', ko: '해밀턴 타이캐츠' },
  { id: 'TOR', ko: '토론토 아르고너츠' }, { id: 'OTT', ko: '오타와 레드블랙스' }, { id: 'MTL', ko: '몬트리올 알루에츠' },
];
