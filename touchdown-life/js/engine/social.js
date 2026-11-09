// 반응 탭: 팔로워와 시즌마다 쌓이는 기사·팬 반응. 매체·커뮤니티 이름은 모두 게임 속 가상의 이름입니다.
import { clamp, pick, round1, POSITIONS } from './core.js';
import { COLLEGE_BY_ID } from '../data/colleges.js';

const OUTLETS = ['터치다운 데일리', '그리디언 위클리', '풋볼 인사이드', '엔드존 리포트', '사이드라인 뉴스', '스냅 카운트'];
const KR_OUTLETS = ['스포츠 오늘', '데일리 풋볼', '그라운드K'];
const PLACES = ['풋볼 갤러리', '엔드존 팬카페', '인스타그램 댓글', '유튜브 댓글', 'X(트위터)'];
const HANDLES = ['gridiron', 'td_', 'blitz', 'snap', 'pylon', 'redzone', 'hailmary', 'kickoff', 'audible', 'fourth', 'pickSix', 'sundays'];
export function ensureSocial(s) {
  s.followers ??= 80;
  s.followerHistory ??= [{ year: s.year - 1, n: s.followers }];
  s.feed ??= [];
}
function tier(rec) {
  const big = rec.awards.some(a => a.pts >= 10), good = rec.score >= 78, bad = rec.stats.g >= 3 && rec.score < 62;
  if (rec.champion || big) return 'legend';
  if (good) return 'good';
  if (rec.stats.g === 0) return rec.injuries?.length ? 'hurt' : 'bench';
  if (bad) return 'bad';
  return 'normal';
}
const HEADLINE = {
  legend: [n => `${n}, 이번 시즌의 주인공은 누구도 아닌 그였다`, n => `"역사를 쓰는 중" ${n}의 시즌을 돌아보다`, n => `${n} 신드롬, 어디까지 갈까`],
  good: [n => `${n}의 성장 곡선이 심상치 않다`, n => `코치진이 꼽은 올해의 발견, ${n}`, n => `${n}, 내년이 더 무서운 이유`],
  normal: [n => `${n}, 한 단계 더 올라서려면`, n => `무난했던 시즌, ${n}에게 남은 숙제`, n => `${n}의 다음 시즌 키워드는 '꾸준함'`],
  bad: [n => `${n}, 반등의 실마리는 어디에`, n => `기대에 못 미친 ${n}의 한 해`, n => `${n}을 향한 엇갈린 시선`],
  bench: [n => `벤치에서 보낸 시즌, ${n}은 무엇을 배웠나`, n => `${n}, 기회는 언제 올까`],
  hurt: [n => `${n}, 부상을 딛고 다시 일어설 수 있을까`, n => `재활 중인 ${n}에게 전하는 응원`],
};
const COMMENTS = {
  legend: [['열광', '이건 진짜 레전드 시즌이다 🔥🔥'], ['열광', '하이라이트 돌려 보다가 밤 샜다'], ['훈훈', '이 선수 응원하길 잘했다 진짜'], ['드립', '얘 게임 난이도 이지로 해 놓고 하는 듯'], ['열광', '내 인생 첫 유니폼은 무조건 이 번호']],
  good: [['열광', '1년 만에 레벨이 달라졌다'], ['훈훈', '꾸준히 성장하는 게 보여서 좋다'], ['드립', '비시즌에 뭐 먹었는지 공개해라'], ['분석', '판단 속도가 확실히 빨라졌음. 필름 보면 보인다'], ['열광', '내년엔 진짜 터진다 각']],
  normal: [['분석', '나쁘진 않은데 결정적 한 방이 아쉽다'], ['훈훈', '아직 어리다. 기다려 주자'], ['드립', '평타는 쳤다 ㅇㅇ'], ['걱정', '이대로면 주전 경쟁 쉽지 않을 듯']],
  bad: [['비판', '솔직히 이번 시즌은 실망'], ['걱정', '몸이 안 좋은 건가?'], ['훈훈', '그래도 다음 시즌 믿는다'], ['드립', '이번 시즌은 없던 걸로 하자']],
  bench: [['걱정', '경기에 나와야 평가를 하지...'], ['훈훈', '연습 때 평 좋다던데 기다려 보자'], ['분석', '뎁스 차트가 너무 빡빡함. 이적도 고려해야']],
  hurt: [['훈훈', '건강하게만 돌아와라 제발'], ['걱정', '십자인대는 복귀 후가 더 중요하다던데'], ['훈훈', '재활 영상 보니까 눈물 난다']],
};
const KR_COMMENTS = [['열광', '새벽에 일어나서 본 보람이 있다 🇰🇷'], ['훈훈', '한국 선수가 저기서 뛰는 것만으로도 감동'], ['열광', '국뽕 차오른다 진짜']];
export function socialSeason(s, r, rec) {
  ensureSocial(s);
  const t = tier(rec), n = s.player.name;
  const stageBase = { hs: 260, college: 5200, nfl: 42000, cfl: 3500, military: 800 }[rec.stage] ?? 500;
  const perf = clamp(.4 + (rec.score - 60) / 22, .15, 2.4) * (rec.champion ? 1.6 : 1) * (1 + rec.awards.reduce((m, a) => m + a.pts, 0) / 40);
  const media = .7 + s.meters.media / 100, kr = s.player.nat === 'KR' ? 1.35 : 1, pr = s.shop?.staff?.pr ? 1.25 : 1;
  const prestige = rec.stage === 'college' ? .35 + (COLLEGE_BY_ID[rec.teamId]?.prestige ?? 60) / 100 : 1;
  const delta = Math.round(stageBase * perf * media * kr * pr * prestige * (.75 + r() * .5) + s.followers * (t === 'bad' ? -.04 : t === 'hurt' ? -.02 : .06));
  s.followers = Math.max(10, s.followers + delta);
  s.followerHistory.push({ year: rec.year, n: s.followers });
  const outlet = s.player.nat === 'KR' && r() < .5 ? pick(r, KR_OUTLETS) : pick(r, OUTLETS);
  const pool = [...COMMENTS[t]], comments = [];
  if (s.player.nat === 'KR') pool.push(...KR_COMMENTS);
  const used = new Set();
  for (let i = 0; i < 4 && pool.length; i++) {
    let c; for (let k = 0; k < 6; k++) { c = pick(r, pool); if (!used.has(c[1])) break; }
    used.add(c[1]);
    comments.push({ who: `${pick(r, HANDLES)}${Math.floor(r() * 90 + 10)}${r() < .5 ? '****' : ''}`, tag: c[0], text: c[1], where: pick(r, PLACES), likes: Math.floor(Math.pow(r(), 2.2) * (s.followers / 40 + 50)), ago: `${1 + Math.floor(r() * 50)}분 전` });
  }
  const post = { year: rec.year, tier: t, outlet, headline: pick(r, HEADLINE[t])(n), comments, delta };
  s.feed.unshift(post);
  s.feed = s.feed.slice(0, 40);
  return { delta, followers: s.followers, tier: t };
}
export const fmtFollowers = n => n >= 1e6 ? `${round1(n / 1e6)}M` : n >= 1e4 ? `${round1(n / 1e4)}만` : n.toLocaleString('ko-KR');
export { POSITIONS };
