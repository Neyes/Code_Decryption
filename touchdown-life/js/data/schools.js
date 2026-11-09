// 미국 고교 미식축구 명문 (시작 학교). prestige는 게임 속 팀 전력과 스카우트 노출도.
export const HIGH_SCHOOLS = [
  { id: 'img', en: 'IMG Academy', ko: 'IMG 아카데미', city: '플로리다 브레이든턴', state: 'FL', prestige: 95, note: '전국 단위로 선수를 모으는 스포츠 기숙학교' },
  { id: 'aquinas', en: 'St. Thomas Aquinas', ko: '세인트 토머스 아퀴나스 고교', city: '플로리다 포트로더데일', state: 'FL', prestige: 88, note: '플로리다 남부의 강호' },
  { id: 'heritage', en: 'American Heritage', ko: '아메리칸 헤리티지 고교', city: '플로리다 플랜테이션', state: 'FL', prestige: 84, note: 'NFL 선수를 꾸준히 배출하는 사립학교' },
  { id: 'materdei', en: 'Mater Dei', ko: '마터 데이 고교', city: '캘리포니아 샌타애나', state: 'CA', prestige: 94, note: '남부 캘리포니아 트리니티 리그의 명문' },
  { id: 'bosco', en: 'St. John Bosco', ko: '세인트 존 보스코 고교', city: '캘리포니아 벨플라워', state: 'CA', prestige: 92, note: '마터 데이와의 라이벌전으로 유명' },
  { id: 'gorman', en: 'Bishop Gorman', ko: '비숍 고먼 고교', city: '네바다 라스베이거스', state: 'NV', prestige: 88, note: '네바다를 넘어 전국 랭킹 단골' },
  { id: 'duncanville', en: 'Duncanville', ko: '덩컨빌 고교', city: '텍사스 덩컨빌', state: 'TX', prestige: 88, note: '텍사스 6A의 강호' },
  { id: 'northshore', en: 'North Shore', ko: '노스 쇼어 고교', city: '텍사스 휴스턴', state: 'TX', prestige: 88, note: '휴스턴의 주 챔피언 단골' },
  { id: 'desoto', en: 'DeSoto', ko: '디소토 고교', city: '텍사스 디소토', state: 'TX', prestige: 82, note: '빠른 스킬 포지션 선수의 산실' },
  { id: 'westlake', en: 'Westlake', ko: '웨스트레이크 고교', city: '텍사스 오스틴', state: 'TX', prestige: 82, note: '쿼터백 명문' },
  { id: 'allen', en: 'Allen', ko: '앨런 고교', city: '텍사스 앨런', state: 'TX', prestige: 80, note: '대형 경기장으로 유명한 공립 강호' },
  { id: 'buford', en: 'Buford', ko: '뷰퍼드 고교', city: '조지아 뷰퍼드', state: 'GA', prestige: 84, note: '조지아의 주 챔피언 단골' },
  { id: 'grayson', en: 'Grayson', ko: '그레이슨 고교', city: '조지아 로간빌', state: 'GA', prestige: 82, note: '애틀랜타 근교의 강호' },
  { id: 'carrollton', en: 'Carrollton', ko: '캐럴턴 고교', city: '조지아 캐럴턴', state: 'GA', prestige: 78, note: '쿼터백을 키워 내는 학교' },
  { id: 'thompson', en: 'Thompson', ko: '톰프슨 고교', city: '앨라배마 앨라배스터', state: 'AL', prestige: 80, note: '앨라배마 최강 공립고' },
  { id: 'hoover', en: 'Hoover', ko: '후버 고교', city: '앨라배마 후버', state: 'AL', prestige: 76, note: '오랜 전통의 앨라배마 명문' },
  { id: 'stfrances', en: 'St. Frances Academy', ko: '세인트 프랜시스 아카데미', city: '메릴랜드 볼티모어', state: 'MD', prestige: 82, note: '전국 단위 일정을 치르는 동부 강호' },
  { id: 'dematha', en: 'DeMatha Catholic', ko: '드매사 가톨릭 고교', city: '메릴랜드 하이애츠빌', state: 'MD', prestige: 78, note: 'DC 근교의 명문' },
  { id: 'bergen', en: 'Bergen Catholic', ko: '버겐 가톨릭 고교', city: '뉴저지 오라델', state: 'NJ', prestige: 76, note: '뉴저지 최강' },
  { id: 'kahuku', en: 'Kahuku', ko: '카후쿠 고교', city: '하와이 카후쿠', state: 'HI', prestige: 70, note: '폴리네시아계 라인맨의 산실' },
  { id: 'lakeview', en: 'Lakeview', ko: '레이크뷰 고교', city: '오하이오 시골 마을', state: 'OH', prestige: 52, note: '작은 마을의 평범한 풋볼부. 스카우트의 눈길이 잘 닿지 않습니다.' },
];
export const SCHOOL_BY_ID = Object.fromEntries(HIGH_SCHOOLS.map(s => [s.id, s]));
// 학년: 미국 고교는 4년제지만 게임은 10학년(15세)부터 3시즌을 치릅니다.
export const GRADE_LABEL = { 10: '10학년 (소포모어)', 11: '11학년 (주니어)', 12: '12학년 (시니어)' };
export const COLLEGE_YEAR_LABEL = ['', '1학년 (프레시맨)', '2학년 (소포모어)', '3학년 (주니어)', '4학년 (시니어)', '5학년 (레드셔트 시니어)'];
