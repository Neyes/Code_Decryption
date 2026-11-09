// NCAA 대학 미식축구 프로그램. prestige(0~100)는 게임 속 프로그램 위상으로, 리크루팅 오퍼와 팀 전력·노출도에 쓰입니다.
// tier: P4(파워 4 컨퍼런스·노터데임) · G5(그룹 오브 5) · FCS · JUCO
export const COLLEGES = [
  // SEC
  { id: 'BAMA', en: 'Alabama Crimson Tide', ko: '앨라배마 크림슨 타이드', school: '앨라배마 대학교', conf: 'SEC', tier: 'P4', prestige: 95, colors: ['#9E1B32', '#FFFFFF'] },
  { id: 'UGA', en: 'Georgia Bulldogs', ko: '조지아 불독스', school: '조지아 대학교', conf: 'SEC', tier: 'P4', prestige: 95, colors: ['#BA0C2F', '#000000'] },
  { id: 'LSU', en: 'LSU Tigers', ko: 'LSU 타이거스', school: '루이지애나 주립대', conf: 'SEC', tier: 'P4', prestige: 88, colors: ['#461D7C', '#FDD023'] },
  { id: 'TEX', en: 'Texas Longhorns', ko: '텍사스 롱혼스', school: '텍사스 대학교', conf: 'SEC', tier: 'P4', prestige: 92, colors: ['#BF5700', '#FFFFFF'] },
  { id: 'TAMU', en: 'Texas A&M Aggies', ko: '텍사스 A&M 애기스', school: '텍사스 A&M 대학교', conf: 'SEC', tier: 'P4', prestige: 84, colors: ['#500000', '#FFFFFF'] },
  { id: 'TENN', en: 'Tennessee Volunteers', ko: '테네시 볼런티어스', school: '테네시 대학교', conf: 'SEC', tier: 'P4', prestige: 84, colors: ['#FF8200', '#FFFFFF'] },
  { id: 'MISS', en: 'Ole Miss Rebels', ko: '올 미스 레벨스', school: '미시시피 대학교', conf: 'SEC', tier: 'P4', prestige: 84, colors: ['#CE1126', '#14213D'] },
  { id: 'UF', en: 'Florida Gators', ko: '플로리다 게이터스', school: '플로리다 대학교', conf: 'SEC', tier: 'P4', prestige: 80, colors: ['#0021A5', '#FA4616'] },
  { id: 'AUB', en: 'Auburn Tigers', ko: '오번 타이거스', school: '오번 대학교', conf: 'SEC', tier: 'P4', prestige: 78, colors: ['#0C2340', '#E87722'] },
  { id: 'OU', en: 'Oklahoma Sooners', ko: '오클라호마 수너스', school: '오클라호마 대학교', conf: 'SEC', tier: 'P4', prestige: 84, colors: ['#841617', '#FDF9D8'] },
  { id: 'MIZ', en: 'Missouri Tigers', ko: '미주리 타이거스', school: '미주리 대학교', conf: 'SEC', tier: 'P4', prestige: 76, colors: ['#F1B82D', '#000000'] },
  { id: 'SC', en: 'South Carolina Gamecocks', ko: '사우스캐롤라이나 게임콕스', school: '사우스캐롤라이나 대학교', conf: 'SEC', tier: 'P4', prestige: 74, colors: ['#73000A', '#000000'] },
  // Big Ten
  { id: 'OSU', en: 'Ohio State Buckeyes', ko: '오하이오 주립대 벅아이스', school: '오하이오 주립대', conf: 'Big Ten', tier: 'P4', prestige: 96, colors: ['#BB0000', '#666666'] },
  { id: 'MICH', en: 'Michigan Wolverines', ko: '미시간 울버린스', school: '미시간 대학교', conf: 'Big Ten', tier: 'P4', prestige: 88, colors: ['#00274C', '#FFCB05'] },
  { id: 'PSU', en: 'Penn State Nittany Lions', ko: '펜실베이니아 주립대 니터니 라이언스', school: '펜실베이니아 주립대', conf: 'Big Ten', tier: 'P4', prestige: 86, colors: ['#041E42', '#FFFFFF'] },
  { id: 'ORE', en: 'Oregon Ducks', ko: '오리건 덕스', school: '오리건 대학교', conf: 'Big Ten', tier: 'P4', prestige: 90, colors: ['#154733', '#FEE123'] },
  { id: 'USC', en: 'USC Trojans', ko: 'USC 트로전스', school: '서던캘리포니아 대학교', conf: 'Big Ten', tier: 'P4', prestige: 86, colors: ['#990000', '#FFC72C'] },
  { id: 'IU', en: 'Indiana Hoosiers', ko: '인디애나 후지어스', school: '인디애나 대학교', conf: 'Big Ten', tier: 'P4', prestige: 86, colors: ['#990000', '#EEEDEB'] },
  { id: 'UW', en: 'Washington Huskies', ko: '워싱턴 허스키스', school: '워싱턴 대학교', conf: 'Big Ten', tier: 'P4', prestige: 78, colors: ['#4B2E83', '#B7A57A'] },
  { id: 'WIS', en: 'Wisconsin Badgers', ko: '위스콘신 배저스', school: '위스콘신 대학교', conf: 'Big Ten', tier: 'P4', prestige: 72, colors: ['#C5050C', '#FFFFFF'] },
  { id: 'IOWA', en: 'Iowa Hawkeyes', ko: '아이오와 호크아이스', school: '아이오와 대학교', conf: 'Big Ten', tier: 'P4', prestige: 74, colors: ['#FFCD00', '#000000'] },
  { id: 'NEB', en: 'Nebraska Cornhuskers', ko: '네브래스카 콘허스커스', school: '네브래스카 대학교', conf: 'Big Ten', tier: 'P4', prestige: 70, colors: ['#E41C38', '#FDF2D9'] },
  { id: 'UCLA', en: 'UCLA Bruins', ko: 'UCLA 브루인스', school: 'UCLA', conf: 'Big Ten', tier: 'P4', prestige: 68, colors: ['#2D68C4', '#F2A900'] },
  // ACC · 독립
  { id: 'ND', en: 'Notre Dame Fighting Irish', ko: '노터데임 파이팅 아이리시', school: '노터데임 대학교', conf: '독립', tier: 'P4', prestige: 90, colors: ['#0C2340', '#C99700'] },
  { id: 'CLEM', en: 'Clemson Tigers', ko: '클렘슨 타이거스', school: '클렘슨 대학교', conf: 'ACC', tier: 'P4', prestige: 86, colors: ['#F56600', '#522D80'] },
  { id: 'MIA', en: 'Miami Hurricanes', ko: '마이애미 허리케인스', school: '마이애미 대학교', conf: 'ACC', tier: 'P4', prestige: 86, colors: ['#F47321', '#005030'] },
  { id: 'FSU', en: 'Florida State Seminoles', ko: '플로리다 주립대 세미놀스', school: '플로리다 주립대', conf: 'ACC', tier: 'P4', prestige: 78, colors: ['#782F40', '#CEB888'] },
  { id: 'LOU', en: 'Louisville Cardinals', ko: '루이빌 카디널스', school: '루이빌 대학교', conf: 'ACC', tier: 'P4', prestige: 72, colors: ['#AD0000', '#000000'] },
  { id: 'SMU', en: 'SMU Mustangs', ko: 'SMU 머스탱스', school: '서던메소디스트 대학교', conf: 'ACC', tier: 'P4', prestige: 72, colors: ['#CC0035', '#354CA1'] },
  { id: 'UNC', en: 'North Carolina Tar Heels', ko: '노스캐롤라이나 타르힐스', school: '노스캐롤라이나 대학교', conf: 'ACC', tier: 'P4', prestige: 68, colors: ['#7BAFD4', '#13294B'] },
  // Big 12
  { id: 'TTU', en: 'Texas Tech Red Raiders', ko: '텍사스 테크 레드 레이더스', school: '텍사스 공과대학교', conf: 'Big 12', tier: 'P4', prestige: 78, colors: ['#CC0000', '#000000'] },
  { id: 'BYU', en: 'BYU Cougars', ko: 'BYU 쿠거스', school: '브리검영 대학교', conf: 'Big 12', tier: 'P4', prestige: 74, colors: ['#002E5D', '#FFFFFF'] },
  { id: 'UTAH', en: 'Utah Utes', ko: '유타 유츠', school: '유타 대학교', conf: 'Big 12', tier: 'P4', prestige: 72, colors: ['#CC0000', '#000000'] },
  { id: 'COLO', en: 'Colorado Buffaloes', ko: '콜로라도 버펄로스', school: '콜로라도 대학교', conf: 'Big 12', tier: 'P4', prestige: 70, colors: ['#CFB87C', '#000000'] },
  { id: 'KSU', en: 'Kansas State Wildcats', ko: '캔자스 주립대 와일드캐츠', school: '캔자스 주립대', conf: 'Big 12', tier: 'P4', prestige: 70, colors: ['#512888', '#FFFFFF'] },
  { id: 'ASU', en: 'Arizona State Sun Devils', ko: '애리조나 주립대 선데빌스', school: '애리조나 주립대', conf: 'Big 12', tier: 'P4', prestige: 72, colors: ['#8C1D40', '#FFC627'] },
  // Group of 5
  { id: 'BSU', en: 'Boise State Broncos', ko: '보이시 주립대 브롱코스', school: '보이시 주립대', conf: 'Mountain West', tier: 'G5', prestige: 64, colors: ['#0033A0', '#D64309'] },
  { id: 'TUL', en: 'Tulane Green Wave', ko: '툴레인 그린 웨이브', school: '툴레인 대학교', conf: 'American', tier: 'G5', prestige: 60, colors: ['#006747', '#418FDE'] },
  { id: 'JMU', en: 'James Madison Dukes', ko: '제임스 매디슨 듀크스', school: '제임스 매디슨 대학교', conf: 'Sun Belt', tier: 'G5', prestige: 58, colors: ['#450084', '#CBB677'] },
  { id: 'UNLV', en: 'UNLV Rebels', ko: 'UNLV 레벨스', school: '네바다 대학교 라스베이거스', conf: 'Mountain West', tier: 'G5', prestige: 56, colors: ['#CF0A2C', '#666666'] },
  { id: 'MEM', en: 'Memphis Tigers', ko: '멤피스 타이거스', school: '멤피스 대학교', conf: 'American', tier: 'G5', prestige: 58, colors: ['#003087', '#898D8D'] },
  { id: 'NAVY', en: 'Navy Midshipmen', ko: '해군사관학교 미드십먼', school: '미국 해군사관학교', conf: 'American', tier: 'G5', prestige: 52, colors: ['#00205B', '#C5B783'] },
  // FCS
  { id: 'NDSU', en: 'North Dakota State Bison', ko: '노스다코타 주립대 바이슨', school: '노스다코타 주립대', conf: 'Missouri Valley', tier: 'FCS', prestige: 50, colors: ['#0A5640', '#FFC72A'] },
  { id: 'SDSU', en: 'South Dakota State Jackrabbits', ko: '사우스다코타 주립대 잭래빗츠', school: '사우스다코타 주립대', conf: 'Missouri Valley', tier: 'FCS', prestige: 48, colors: ['#0033A0', '#FFD100'] },
  { id: 'MTST', en: 'Montana State Bobcats', ko: '몬태나 주립대 밥캐츠', school: '몬태나 주립대', conf: 'Big Sky', tier: 'FCS', prestige: 46, colors: ['#003875', '#B9975B'] },
  { id: 'JKST', en: 'Jackson State Tigers', ko: '잭슨 주립대 타이거스', school: '잭슨 주립대', conf: 'SWAC', tier: 'FCS', prestige: 42, colors: ['#002147', '#D9D9D9'] },
  // JUCO
  { id: 'EMCC', en: 'East Mississippi Lions', ko: '이스트미시시피 커뮤니티칼리지 라이언스', school: '이스트미시시피 커뮤니티칼리지', conf: 'JUCO', tier: 'JUCO', prestige: 34, colors: ['#000000', '#FFC72C'] },
];
export const COLLEGE_BY_ID = Object.fromEntries(COLLEGES.map(c => [c.id, c]));
export const TIER_LABEL = { P4: '파워 4', G5: '그룹 오브 5', FCS: 'FCS', JUCO: '전문대(JUCO)' };
// 대학 포지션상 (실제 상 이름).
export const COLLEGE_POSITION_AWARDS = {
  QB: '데이비 오브라이언 상', RB: '도크 워커 상', WR: '빌레트니코프 상', TE: '존 매키 상', OL: '아웃랜드 트로피',
  DT: '아웃랜드 트로피', EDGE: '테드 핸드릭스 상', LB: '딕 버트커스 상', CB: '짐 소프 상', S: '짐 소프 상', K: '루 그로자 상', P: '레이 가이 상',
};
