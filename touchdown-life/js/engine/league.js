// NFL 리그 풀: 위키백과 로스터(2026-11)에서 출발해 해마다 나이를 먹고, 은퇴하고, 신인이 들어옵니다.
// 선수 행: [이름, 포지션, OVR, 나이, 등번호, 상태(0 현역 · 1 부상 · 2 연습생)]
import { ROSTERS } from '../data/rosters.js';
import { STARS } from '../data/stars.js';
import { TEAMS, TEAM_BY_ID } from '../data/teams.js';
import { clamp, hash, pick, gauss, POS_ORDER } from './core.js';

export const START_YEAR = 2026;
export const ROSTER_NEED = { QB: 3, RB: 4, WR: 6, TE: 3, OL: 9, DT: 5, EDGE: 5, LB: 5, CB: 6, S: 4, K: 1, P: 1 };
// 뎁스 차트 주전 자리 수 (11인 기준 + 키커·펀터).
export const STARTER_SLOTS = { QB: 1, RB: 1, WR: 3, TE: 1, OL: 5, DT: 2, EDGE: 2, LB: 2, CB: 3, S: 2, K: 1, P: 1 };
// 팀 전력 계산 가중치 (주전 슬롯별).
const POWER_WEIGHT = { QB: .28, RB: .05, WR: .12, TE: .04, OL: .14, DT: .07, EDGE: .08, LB: .06, CB: .09, S: .05, K: .01, P: .01 };

const FIRST = ['Jalen', 'Marcus', 'Tyler', 'Jordan', 'Cameron', 'Devin', 'Isaiah', 'Caleb', 'Malik', 'Ethan', 'Bryce', 'Darius', 'Xavier', 'Trey', 'Mason', 'Logan', 'Elijah', 'Jaylen', 'Nate', 'Cole', 'Drew', 'Zion', 'Kendrick', 'Austin', 'Brady', 'Micah', 'Terrell', 'Quentin', 'Garrett', 'Hunter', 'Jace', 'Omari', 'Tre', 'Kobe', 'Landon', 'Dillon', 'Rashad', 'Wyatt', 'Carson', 'Damien', 'Keon', 'Luke', 'Jamari', 'Silas', 'Grant', 'Amari', 'Reggie', 'Colby', 'Deion', 'Tanner'];
const LAST = ['Johnson', 'Williams', 'Brown', 'Jackson', 'Davis', 'Harris', 'Robinson', 'Walker', 'Mitchell', 'Carter', 'Thompson', 'Moore', 'Taylor', 'Anderson', 'Thomas', 'White', 'Martin', 'Allen', 'Young', 'King', 'Wright', 'Scott', 'Green', 'Baker', 'Adams', 'Nelson', 'Hill', 'Campbell', 'Evans', 'Turner', 'Parker', 'Collins', 'Edwards', 'Stewart', 'Morris', 'Murphy', 'Cook', 'Rogers', 'Reed', 'Bailey', 'Bell', 'Brooks', 'Price', 'Bennett', 'Wood', 'Barnes', 'Ross', 'Henderson', 'Coleman', 'Jenkins', 'Perry', 'Powell', 'Long', 'Patterson', 'Hughes', 'Washington', 'Butler', 'Simmons', 'Foster', 'Bryant'];
export const randomName = r => `${pick(r, FIRST)} ${pick(r, LAST)}`;

// 실제 선수 능력치는 이름 해시로만 정합니다(모든 커리어에서 같은 세계).
function rate(name, pos, st, rookie, year) {
  const star = STARS[name];
  if (star) return { pos: star.pos, ovr: star.ovr, age: year - star.born, star: 1 };
  const h = hash(`nfl:${name}`), spec = pos === 'K' || pos === 'P';
  const ovr = st === 2 ? 56 + h % 9 : rookie ? 61 + h % 11 : spec ? 70 + h % 13 : 65 + h % 13;
  const age = rookie ? 22 + (h >> 4) % 2 : st === 2 ? 23 + (h >> 4) % 3 : 24 + (h >> 4) % 9;
  return { pos, ovr, age, star: 0 };
}
export function buildLeague(year = START_YEAR) {
  const teams = {};
  for (const t of TEAMS) {
    teams[t.id] = { p: (ROSTERS[t.id] || []).map(([num, name, pos, st, rookie]) => { const x = rate(name, pos, st, rookie, year); return [name, x.pos, x.ovr, x.age, num, st, x.star]; }) };
  }
  return { year, teams, retiredNumbers: {}, champions: [] };
}
export const displayName = name => STARS[name]?.ko || name;

// 포지션별 뎁스 (OVR 내림차순). 부상(1)은 제외할 수 있습니다.
export function depth(league, teamId, pos, { healthy = true, practice = false } = {}) {
  return league.teams[teamId].p.filter(x => x[1] === pos && (practice || x[5] !== 2) && (!healthy || x[5] !== 1)).sort((a, b) => b[2] - a[2]);
}
export function rosterRating(league, teamId, extra = null) {
  let total = 0, wsum = 0;
  for (const pos of POS_ORDER) {
    const list = depth(league, teamId, pos).map(x => x[2]);
    if (extra && extra.pos === pos) { list.push(extra.ovr); list.sort((a, b) => b - a); }
    const n = STARTER_SLOTS[pos], top = list.slice(0, n);
    while (top.length < n) top.push(58);
    total += POWER_WEIGHT[pos] * top.reduce((a, b) => a + b, 0) / n; wsum += POWER_WEIGHT[pos];
  }
  return total / wsum;
}
// 0~100 전력. 첫 해에는 2025 시즌 흐름(teams.js power)을 절반 반영하고, 해가 갈수록 로스터만 봅니다.
export function teamPower(league, teamId, extra = null) {
  const base = TEAM_BY_ID[teamId].power, w = clamp(.5 - .12 * (league.year - START_YEAR), 0, .5);
  const fromRoster = clamp(50 + (rosterRating(league, teamId, extra) - 75.5) * 7, 15, 95);
  return clamp(w * base + (1 - w) * fromRoster, 10, 97);
}
export function contenderLabel(power) {
  return power >= 74 ? '우승 후보' : power >= 62 ? '플레이오프 경쟁' : power >= 50 ? '중위권' : '리빌딩';
}
// 리그 상위 선수 (수상 경쟁자 이름에 씀).
export function leagueTop(league, pos, n = 5, excludeTeam = null) {
  const all = [];
  for (const [id, t] of Object.entries(league.teams)) for (const x of t.p) if (x[1] === pos && x[5] === 0 && id !== excludeTeam) all.push({ name: x[0], ovr: x[2], age: x[3], team: id });
  return all.sort((a, b) => b.ovr - a.ovr).slice(0, n);
}

// 한 해가 지나면: 나이 +1, 성장·노쇠, 은퇴, 부상 회복, 신인 드래프트로 빈자리 채우기, 일부 이적.
export function evolveLeague(league, r) {
  league.year += 1;
  const moving = [];
  for (const [id, t] of Object.entries(league.teams)) {
    const keep = [];
    for (const x of t.p) {
      const [name, pos] = x;
      x[3] += 1;
      const age = x[3], late = pos === 'QB' || pos === 'K' || pos === 'P' ? 4 : pos === 'OL' ? 1 : 0;
      const a = age - late;
      const d = a <= 24 ? .5 + r() * 2 : a <= 27 ? r() * 1.8 - .6 : a <= 30 ? r() * 2.4 - 2 : a <= 33 ? -1.5 - r() * 3 : -3 - r() * 4;
      x[2] = clamp(Math.round(x[2] + d), 40, 99);
      x[5] = x[5] === 1 ? 0 : x[5];
      const retire = a >= 37 || (a >= 33 && r() < .3) || (a >= 29 && x[2] < 68 && r() < .5) || x[2] < 60 || r() < .03;
      if (retire) continue;
      if (x[5] === 2 && x[2] >= 66) x[5] = 0;
      if (x[5] === 0 && !x[6] && r() < .07) { moving.push(x); continue; }
      keep.push(x);
    }
    t.p = keep;
  }
  // 이적 시장: 떠난 선수를 자리가 빈 팀에 배치.
  for (const x of moving) {
    const ids = Object.keys(league.teams).filter(id => league.teams[id].p.filter(y => y[1] === x[1] && y[5] !== 2).length < ROSTER_NEED[x[1]] + 1);
    league.teams[ids.length ? pick(r, ids) : pick(r, Object.keys(league.teams))].p.push(x);
  }
  // 드래프트: 모자란 포지션에 신인.
  for (const t of Object.values(league.teams)) {
    for (const pos of POS_ORDER) {
      let have = t.p.filter(y => y[1] === pos && y[5] !== 2).length;
      while (have < ROSTER_NEED[pos]) {
        const star = r() < .06;
        const ovr = clamp(Math.round(star ? 73 + r() * 9 : 59 + r() * 11 + gauss(r) * 2), 52, 86);
        t.p.push([randomName(r), pos, ovr, 21 + Math.floor(r() * 3), Math.floor(r() * 99), 0, 0]);
        have++;
      }
      // 연습생 보충
      const ps = t.p.filter(y => y[5] === 2).length;
      if (ps < 12 && r() < .5) t.p.push([randomName(r), pos, 54 + Math.floor(r() * 9), 22 + Math.floor(r() * 3), Math.floor(r() * 99), 2, 0]);
    }
  }
  // 리그 평균이 한쪽으로 쏠리지 않게 부드럽게 맞춥니다 (2026 로스터 평균 ≈ 77.8).
  const ids = Object.keys(league.teams), avg = ids.reduce((n, id) => n + rosterRating(league, id), 0) / ids.length, shift = Math.round((LEAGUE_TARGET - avg) * .7);
  if (shift) for (const t of Object.values(league.teams)) for (const x of t.p) if (!x[6] || shift < 0) x[2] = clamp(x[2] + shift, 40, 99);
  return league;
}
const LEAGUE_TARGET = 77.8;
// 시즌 중 부상: 팀마다 몇 명은 결장 (뎁스가 바뀌어 내 출전 기회가 생깁니다).
export function seasonInjuries(league, r) {
  for (const t of Object.values(league.teams)) for (const x of t.p) if (x[5] === 0 && r() < .06) x[5] = 1;
}
export function addPlayerToTeam(league, teamId, row) { league.teams[teamId].p.push(row); }
