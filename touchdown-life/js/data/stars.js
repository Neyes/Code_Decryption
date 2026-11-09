// 이름이 알려진 선수들의 한글 표기, 게임 포지션, 게임 속 능력치(OVR), 출생 연도.
// 소속 구단은 여기 적지 않고 rosters.js(위키백과 로스터)에서 찾습니다. 로스터에 없는 선수는 게임에 나오지 않습니다.
// OVR은 시뮬레이션용 게임 값이며 실제 선수 평가가 아닙니다.
// [영문 이름, 한글 이름, 포지션, OVR, 출생 연도]
const RAW = [
  // QB
  ['Patrick Mahomes', '패트릭 마홈스', 'QB', 95, 1995], ['Josh Allen', '조시 앨런', 'QB', 95, 1996], ['Lamar Jackson', '라마 잭슨', 'QB', 93, 1997],
  ['Joe Burrow', '조 버로', 'QB', 93, 1996], ['Jalen Hurts', '제일런 허츠', 'QB', 86, 1998], ['Jayden Daniels', '제이든 대니얼스', 'QB', 88, 2000],
  ['C. J. Stroud', 'C.J. 스트라우드', 'QB', 82, 2001], ['Justin Herbert', '저스틴 허버트', 'QB', 88, 1998], ['Matthew Stafford', '매슈 스태퍼드', 'QB', 89, 1988],
  ['Jared Goff', '재러드 고프', 'QB', 86, 1994], ['Baker Mayfield', '베이커 메이필드', 'QB', 85, 1995], ['Bo Nix', '보 닉스', 'QB', 85, 2000],
  ['Drake Maye', '드레이크 메이', 'QB', 89, 2002], ['Caleb Williams', '케일럽 윌리엄스', 'QB', 84, 2001], ['Brock Purdy', '브록 퍼디', 'QB', 85, 1999],
  ['Dak Prescott', '닥 프레스콧', 'QB', 85, 1993], ['Jordan Love', '조던 러브', 'QB', 84, 1998], ['Trevor Lawrence', '트레버 로런스', 'QB', 82, 1999],
  ['Sam Darnold', '샘 다널드', 'QB', 84, 1997], ['Kyler Murray', '카일러 머리', 'QB', 79, 1997], ['Aaron Rodgers', '에런 로저스', 'QB', 77, 1983],
  ['Cam Ward', '캠 워드', 'QB', 76, 2002], ['Fernando Mendoza', '페르난도 멘도자', 'QB', 74, 2003], ['Tua Tagovailoa', '투아 타고바일로아', 'QB', 76, 1998],
  ['J. J. McCarthy', 'J.J. 매카시', 'QB', 74, 2003], ['Michael Penix Jr.', '마이클 페닉스 주니어', 'QB', 76, 2000], ['Shedeur Sanders', '셰듀어 샌더스', 'QB', 73, 2002],
  ['Bryce Young', '브라이스 영', 'QB', 79, 2001], ['Daniel Jones', '대니얼 존스', 'QB', 78, 1997], ['Geno Smith', '지노 스미스', 'QB', 77, 1990],
  ['Justin Fields', '저스틴 필즈', 'QB', 74, 1999], ['Tyler Shough', '타일러 셔프', 'QB', 73, 1999], ['Joe Flacco', '조 플라코', 'QB', 70, 1985],
  // RB
  ['Saquon Barkley', '세이쿼 바클리', 'RB', 92, 1997], ['Derrick Henry', '데릭 헨리', 'RB', 91, 1994], ['Christian McCaffrey', '크리스천 매캐프리', 'RB', 92, 1996],
  ['Bijan Robinson', '비잔 로빈슨', 'RB', 95, 2002], ['Jahmyr Gibbs', '자미어 기브스', 'RB', 94, 2002], ["De'Von Achane", '디본 어케인', 'RB', 89, 2001],
  ['Jonathan Taylor', '조너선 테일러', 'RB', 92, 1999], ['Josh Jacobs', '조시 제이컵스', 'RB', 87, 1998], ['Kyren Williams', '카이런 윌리엄스', 'RB', 85, 2000],
  ['James Cook', '제임스 쿡', 'RB', 88, 1999], ['Breece Hall', '브리스 홀', 'RB', 84, 2001], ['Chase Brown', '체이스 브라운', 'RB', 85, 2000],
  ['Omarion Hampton', '오마리온 햄프턴', 'RB', 82, 2003], ['Kenneth Walker III', '케네스 워커 3세', 'RB', 84, 2000], ['Jeremiyah Love', '제레마이아 러브', 'RB', 80, 2005],
  ['Ashton Jeanty', '애슈턴 젠티', 'RB', 86, 2003], ['Travis Etienne', '트래비스 에티엔', 'RB', 84, 1999], ['Javonte Williams', '저본테 윌리엄스', 'RB', 82, 2000],
  // WR
  ["Ja'Marr Chase", '자마 체이스', 'WR', 96, 2000], ['Justin Jefferson', '저스틴 제퍼슨', 'WR', 95, 1999], ['CeeDee Lamb', '시디 램', 'WR', 92, 1999],
  ['Puka Nacua', '푸카 나쿠아', 'WR', 94, 2001], ['Amon-Ra St. Brown', '아몬라 세인트브라운', 'WR', 92, 1999], ['A. J. Brown', 'A.J. 브라운', 'WR', 89, 1997],
  ['Nico Collins', '니코 콜린스', 'WR', 89, 1999], ['Malik Nabers', '말릭 네이버스', 'WR', 90, 2003], ['Jaxon Smith-Njigba', '잭슨 스미스은지그바', 'WR', 93, 2002],
  ['Drake London', '드레이크 런던', 'WR', 89, 2001], ['Garrett Wilson', '개릿 윌슨', 'WR', 85, 2000], ['Brian Thomas Jr.', '브라이언 토머스 주니어', 'WR', 86, 2002],
  ['Ladd McConkey', '래드 맥콩키', 'WR', 86, 2001], ['DeVonta Smith', '디본타 스미스', 'WR', 85, 1998], ['Davante Adams', '다반테 애덤스', 'WR', 84, 1992],
  ['Mike Evans', '마이크 에번스', 'WR', 84, 1993], ['Terry McLaurin', '테리 매클로린', 'WR', 85, 1995], ['Tee Higgins', '티 히긴스', 'WR', 85, 1999],
  ['Rashee Rice', '라시 라이스', 'WR', 86, 2000], ['DK Metcalf', 'DK 멧캐프', 'WR', 84, 1997], ['Zay Flowers', '제이 플라워스', 'WR', 85, 2000],
  ['Tetairoa McMillan', '테타이로아 맥밀런', 'WR', 84, 2003], ['Travis Hunter', '트래비스 헌터', 'WR', 80, 2003], ['Emeka Egbuka', '에메카 에그부카', 'WR', 82, 2002],
  ['Marvin Harrison Jr.', '마빈 해리슨 주니어', 'WR', 82, 2002], ['Jameson Williams', '제임슨 윌리엄스', 'WR', 84, 2001], ['George Pickens', '조지 피컨스', 'WR', 87, 2001],
  ['Jaylen Waddle', '제일런 와들', 'WR', 85, 1998], ['Carnell Tate', '카넬 테이트', 'WR', 76, 2005], ['Jordyn Tyson', '조딘 타이슨', 'WR', 75, 2004],
  ['Chris Olave', '크리스 올라브', 'WR', 84, 2000], ['Courtland Sutton', '코틀랜드 서턴', 'WR', 84, 1995], ['Xavier Worthy', '재비어 워시', 'WR', 81, 2003],
  // TE
  ['Travis Kelce', '트래비스 켈시', 'TE', 85, 1989], ['George Kittle', '조지 키틀', 'TE', 91, 1993], ['Trey McBride', '트레이 맥브라이드', 'TE', 92, 1999],
  ['Brock Bowers', '브록 바워스', 'TE', 93, 2002], ['Sam LaPorta', '샘 라포타', 'TE', 84, 2001], ['Tucker Kraft', '터커 크래프트', 'TE', 86, 2000],
  ['Mark Andrews', '마크 앤드루스', 'TE', 83, 1995], ['Tyler Warren', '타일러 워런', 'TE', 84, 2002], ['Colston Loveland', '콜스턴 러블랜드', 'TE', 80, 2004],
  ['Dallas Goedert', '댈러스 고더트', 'TE', 82, 1995],
  // OL
  ['Trent Williams', '트렌트 윌리엄스', 'OL', 91, 1988], ['Penei Sewell', '페네이 수얼', 'OL', 95, 2000], ['Lane Johnson', '레인 존슨', 'OL', 89, 1990],
  ['Tristan Wirfs', '트리스턴 워프스', 'OL', 93, 1999], ['Rashawn Slater', '라숀 슬레이터', 'OL', 88, 1999], ['Creed Humphrey', '크리드 험프리', 'OL', 90, 1999],
  ['Quenton Nelson', '퀜턴 넬슨', 'OL', 90, 1996], ['Tyler Smith', '타일러 스미스', 'OL', 90, 2001], ['Joe Thuney', '조 서니', 'OL', 89, 1992],
  ['Christian Darrisaw', '크리스천 대리소', 'OL', 87, 1999], ['Jordan Mailata', '조던 마일라타', 'OL', 92, 1997], ['Dion Dawkins', '다이언 도킨스', 'OL', 87, 1994],
  ['Will Campbell', '윌 캠벨', 'OL', 82, 2004], ['Francis Mauigoa', '프랜시스 마우이고아', 'OL', 76, 2005], ['Spencer Fano', '스펜서 파노', 'OL', 76, 2004],
  ['Trey Smith', '트레이 스미스', 'OL', 88, 1999], ['Kolton Miller', '콜턴 밀러', 'OL', 86, 1995],
  // DT
  ['Chris Jones', '크리스 존스', 'DT', 92, 1994], ['Dexter Lawrence', '덱스터 로런스', 'DT', 93, 1997], ['Jalen Carter', '제일런 카터', 'DT', 91, 2001],
  ['Quinnen Williams', '퀴넌 윌리엄스', 'DT', 89, 1997], ['Jeffery Simmons', '제프리 시먼스', 'DT', 89, 1997], ['Zach Allen', '잭 앨런', 'DT', 88, 1997],
  ['Leonard Williams', '레너드 윌리엄스', 'DT', 87, 1994], ['Vita Vea', '비타 베아', 'DT', 87, 1995],
  // EDGE
  ['Myles Garrett', '마일스 개릿', 'EDGE', 97, 1995], ['T. J. Watt', 'T.J. 와트', 'EDGE', 92, 1994], ['Micah Parsons', '마이카 파슨스', 'EDGE', 95, 1999],
  ['Aidan Hutchinson', '에이든 허친슨', 'EDGE', 94, 2000], ['Nick Bosa', '닉 보사', 'EDGE', 91, 1997], ['Maxx Crosby', '맥스 크로스비', 'EDGE', 94, 1997],
  ['Will Anderson Jr.', '윌 앤더슨 주니어', 'EDGE', 93, 2001], ['Trey Hendrickson', '트레이 헨드릭슨', 'EDGE', 89, 1994], ['Danielle Hunter', '대니엘 헌터', 'EDGE', 89, 1994],
  ['Josh Hines-Allen', '조시 하인스앨런', 'EDGE', 88, 1997], ['Brian Burns', '브라이언 번스', 'EDGE', 88, 1998], ['Abdul Carter', '압둘 카터', 'EDGE', 85, 2004],
  ['Nik Bonitto', '닉 보니토', 'EDGE', 87, 1999], ['Jared Verse', '재러드 버스', 'EDGE', 87, 2000], ['Rueben Bain Jr.', '루벤 베인 주니어', 'EDGE', 77, 2004],
  ['David Bailey', '데이비드 베일리', 'EDGE', 78, 2004], ['Khalil Mack', '칼릴 맥', 'EDGE', 85, 1991], ['Montez Sweat', '몬테즈 스웨트', 'EDGE', 85, 1996],
  ['George Karlaftis', '조지 칼라프티스', 'EDGE', 84, 2001], ['Jonathan Greenard', '조너선 그리너드', 'EDGE', 86, 1997],
  // LB
  ['Fred Warner', '프레드 워너', 'LB', 94, 1996], ['Roquan Smith', '로쿠언 스미스', 'LB', 92, 1997], ['Zack Baun', '잭 바운', 'LB', 90, 1996],
  ['Patrick Queen', '패트릭 퀸', 'LB', 86, 1999], ['Bobby Okereke', '바비 오케레케', 'LB', 84, 1996], ['Foyesade Oluokun', '포예사데 올루오쿤', 'LB', 84, 1995],
  ['Jack Campbell', '잭 캠벨', 'LB', 90, 2000], ['Sonny Styles', '소니 스타일스', 'LB', 76, 2004], ['Arvell Reese', '아르벨 리스', 'LB', 78, 2005],
  ['Nick Bolton', '닉 볼턴', 'LB', 85, 2000], ['Jeremiah Owusu-Koramoah', '제러마이아 오우수코라모아', 'LB', 84, 1999],
  // CB
  ['Patrick Surtain II', '패트릭 서테인 2세', 'CB', 94, 2000], ['Sauce Gardner', '소스 가드너', 'CB', 90, 2000], ['Derek Stingley Jr.', '데릭 스팅리 주니어', 'CB', 92, 2001],
  ['Trent McDuffie', '트렌트 맥더피', 'CB', 89, 2000], ['Denzel Ward', '덴젤 워드', 'CB', 88, 1997], ['Christian Gonzalez', '크리스천 곤살레스', 'CB', 90, 2002],
  ['Devon Witherspoon', '데번 위더스푼', 'CB', 89, 2000], ['Quinyon Mitchell', '퀴니언 미첼', 'CB', 89, 2001], ['Cooper DeJean', '쿠퍼 디진', 'CB', 88, 2003],
  ['Jalen Ramsey', '제일런 램지', 'CB', 86, 1994], ['Mansoor Delane', '만수르 들레인', 'CB', 76, 2004], ['Marlon Humphrey', '말런 험프리', 'CB', 85, 1996],
  ['Jaycee Horn', '제이시 혼', 'CB', 86, 1999], ['Darius Slay', '다리어스 슬레이', 'CB', 80, 1991],
  // S
  ['Kyle Hamilton', '카일 해밀턴', 'S', 93, 2001], ['Brian Branch', '브라이언 브랜치', 'S', 88, 2001], ['Jessie Bates', '제시 베이츠', 'S', 88, 1997],
  ['Budda Baker', '부다 베이커', 'S', 86, 1996], ['Kerby Joseph', '커비 조지프', 'S', 89, 2000], ['Derwin James', '더윈 제임스', 'S', 90, 1996],
  ['Xavier McKinney', '재비어 매키니', 'S', 89, 1999], ['Antoine Winfield Jr.', '앙투안 윈필드 주니어', 'S', 88, 1998], ['Minkah Fitzpatrick', '밍카 피츠패트릭', 'S', 85, 1996],
  ['Caleb Downs', '케일럽 다운스', 'S', 79, 2004], ['Kevin Byard', '케빈 바이어드', 'S', 84, 1993],
  // K · P
  ['Brandon Aubrey', '브랜던 오브리', 'K', 94, 1995], ['Harrison Butker', '해리슨 버커', 'K', 88, 1995], ['Cameron Dicker', '캐머런 디커', 'K', 90, 2000],
  ['Chris Boswell', '크리스 보즈웰', 'K', 90, 1991], ['Jake Bates', '제이크 베이츠', 'K', 86, 1999], ['Justin Tucker', '저스틴 터커', 'K', 80, 1989],
  ['Wil Lutz', '윌 러츠', 'K', 84, 1994], ['Tyler Bass', '타일러 배스', 'K', 82, 1997], ['Jake Elliott', '제이크 엘리엇', 'K', 84, 1995],
  ['Evan McPherson', '에번 맥퍼슨', 'K', 84, 1999], ['Jack Fox', '잭 폭스', 'P', 90, 1996], ['Logan Cooke', '로건 쿡', 'P', 86, 1995], ['Michael Dickson', '마이클 딕슨', 'P', 88, 1996],
];
export const STARS = Object.fromEntries(RAW.map(([en, ko, pos, ovr, born]) => [en, { ko, pos, ovr, born }]));

// 역대 NFL 통산 기록 (은퇴 화면 비교용). 정규시즌 기준.
export const ALL_TIME = {
  passYds: { label: '통산 패싱 야드', value: 89214, holder: '톰 브래디' },
  passTD: { label: '통산 터치다운 패스', value: 649, holder: '톰 브래디' },
  rushYds: { label: '통산 러싱 야드', value: 18355, holder: '에밋 스미스' },
  rushTD: { label: '통산 러싱 터치다운', value: 164, holder: '에밋 스미스' },
  rec: { label: '통산 리셉션', value: 1549, holder: '제리 라이스' },
  recYds: { label: '통산 리시빙 야드', value: 22895, holder: '제리 라이스' },
  recTD: { label: '통산 리시빙 터치다운', value: 197, holder: '제리 라이스' },
  sacks: { label: '통산 색(공식 집계 1982~)', value: 200, holder: '브루스 스미스' },
  int: { label: '통산 인터셉트', value: 81, holder: '폴 크라우스' },
  points: { label: '통산 득점', value: 2673, holder: '애덤 비너티에리' },
};
