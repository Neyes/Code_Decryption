// 게임 그래픽 (모두 인라인 SVG): 선수 아바타, 필드 배너, 아이콘, 팔로워 그래프.
const SKIN = ['#F6D3B3', '#E8B48C', '#C98B5E', '#8D5A3B', '#5E3A26'];
const HAIR = ['#1E1A17', '#4A3020', '#8B5A2B', '#D8B35A', '#A33A1E', '#BFBFBF'];
export const AVATAR_OPTIONS = { skin: SKIN.length, hair: HAIR.length, style: 6, visor: 3 };
export const STYLE_NAMES = ['짧은 머리', '버즈컷', '드레드', '곱슬', '긴 머리', '삭발'];
export const VISOR_NAMES = ['바이저 없음', '스모크 바이저', '골드 바이저'];
const esc = v => String(v ?? '').replace(/[&<>"']/g, x => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[x]));

// 헬멧을 벗은 모습(얼굴)과 유니폼. size: px.
export function avatarSvg(av = {}, colors = ['#1E5B3A', '#F2F2F2'], number = 0, size = 64, helmet = false) {
  const skin = SKIN[av.skin ?? 1], hair = HAIR[av.hair ?? 0], st = av.style ?? 0, [c1, c2] = colors;
  const hairPath = [
    '<path d="M18 26c0-10 6-15 14-15s14 5 14 15c-3-4-7-6-14-6s-11 2-14 6z"/>',
    '<path d="M19 24c1-8 6-12 13-12s12 4 13 12c-3-2-7-3-13-3s-10 1-13 3z" opacity=".8"/>',
    '<g><path d="M17 27c0-11 7-16 15-16s15 5 15 16"/><rect x="16" y="24" width="4" height="14" rx="2"/><rect x="44" y="24" width="4" height="14" rx="2"/><rect x="21" y="25" width="3" height="10" rx="1.5"/><rect x="40" y="25" width="3" height="10" rx="1.5"/></g>',
    '<g><circle cx="22" cy="19" r="5"/><circle cx="29" cy="15" r="5.5"/><circle cx="36" cy="15" r="5.5"/><circle cx="42" cy="19" r="5"/><circle cx="19" cy="25" r="3.5"/><circle cx="45" cy="25" r="3.5"/></g>',
    '<g><path d="M17 28c0-11 7-17 15-17s15 6 15 17"/><path d="M17 26c-1 8 0 14 2 18l4-2c-2-5-3-10-2-14z"/><path d="M47 26c1 8 0 14-2 18l-4-2c2-5 3-10 2-14z"/></g>',
    '',
  ][st];
  const face = `<ellipse cx="32" cy="31" rx="13" ry="15" fill="${skin}"/><circle cx="27" cy="31" r="1.6" fill="#1b1b1b"/><circle cx="37" cy="31" r="1.6" fill="#1b1b1b"/><path d="M28 38q4 3 8 0" stroke="#7a3d2a" stroke-width="1.6" fill="none" stroke-linecap="round"/><ellipse cx="19" cy="32" rx="2" ry="3" fill="${skin}"/><ellipse cx="45" cy="32" rx="2" ry="3" fill="${skin}"/>`;
  const helm = helmet ? `<path d="M15 30c0-12 8-20 18-20s17 7 17 18v6H15z" fill="${c1}"/><path d="M31 11c4 0 8 1 10 3" stroke="${c2}" stroke-width="2.4" fill="none"/><rect x="15" y="28" width="35" height="5" rx="2.5" fill="${c1}"/>
    ${av.visor ? `<rect x="22" y="28" width="22" height="7" rx="3" fill="${av.visor === 2 ? '#d9a531' : '#2b2f33'}" opacity=".85"/>` : ''}
    <path d="M22 36h22M24 40h18M33 33v12" stroke="#cfd4d8" stroke-width="2" stroke-linecap="round"/>` : '';
  return `<svg class="avatar" width="${size}" height="${size}" viewBox="0 0 64 64" role="img" aria-label="선수 아바타">
    <rect x="0" y="0" width="64" height="64" rx="18" fill="${c1}" opacity=".12"/>
    <path d="M8 64c2-12 11-17 24-17s22 5 24 17z" fill="${c1}"/>
    <path d="M24 48l8 5 8-5" stroke="${c2}" stroke-width="2.4" fill="none"/>
    <text x="32" y="62" text-anchor="middle" font-size="9" font-weight="800" fill="${c2}" font-family="system-ui">${esc(number)}</text>
    <rect x="27" y="42" width="10" height="7" fill="${skin}"/>
    ${helmet ? '' : face}${helmet ? `<ellipse cx="32" cy="34" rx="12" ry="13" fill="${skin}"/>` + helm : `<g fill="${hair}">${hairPath}</g>`}
  </svg>`;
}
// 선택 카드 위 필드 일러스트: 엔드존 색은 소속 팀 색.
export function fieldBanner(colors = ['#1E5B3A', '#FFFFFF'], label = '', kind = 'ball') {
  const [c1, c2] = colors;
  const lines = Array.from({ length: 9 }, (_, i) => `<line x1="${60 + i * 35}" y1="10" x2="${60 + i * 35}" y2="150" stroke="#ffffff" stroke-opacity=".55" stroke-width="${i === 4 ? 3 : 1.5}"/>`).join('');
  const hash = Array.from({ length: 36 }, (_, i) => `<line x1="${62 + i * 8.75}" y1="55" x2="${62 + i * 8.75}" y2="60" stroke="#fff" stroke-opacity=".4"/><line x1="${62 + i * 8.75}" y1="100" x2="${62 + i * 8.75}" y2="105" stroke="#fff" stroke-opacity=".4"/>`).join('');
  const icon = kind === 'trophy'
    ? '<g transform="translate(200 80)"><path d="M-14-26h28v10c0 12-6 20-14 20s-14-8-14-20z" fill="#E5B53C"/><path d="M-14-20h-8c0 10 5 14 9 14M14-20h8c0 10-5 14-9 14" stroke="#E5B53C" stroke-width="4" fill="none"/><rect x="-4" y="4" width="8" height="10" fill="#C99328"/><rect x="-12" y="14" width="24" height="6" rx="2" fill="#8C6A23"/></g>'
    : kind === 'helmet'
      ? `<g transform="translate(176 52) scale(1.6)"><path d="M2 22C2 10 10 2 21 2s18 7 18 18v6H2z" fill="${c1}" stroke="#fff" stroke-width="1.5"/><path d="M14 22h26M16 27h22M27 20v12" stroke="#ddd" stroke-width="2.4" stroke-linecap="round"/></g>`
      : '<g transform="translate(200 80) rotate(-28)"><ellipse rx="30" ry="17" fill="#8A4B22" stroke="#5a2e12" stroke-width="2"/><path d="M-14 0h28" stroke="#fff" stroke-width="2.2"/><path d="M-8-4v8M-3-4v8M2-4v8M7-4v8" stroke="#fff" stroke-width="1.8"/><path d="M-27-3q27-9 54 0M-27 3q27 9 54 0" stroke="#fff" stroke-opacity=".35" fill="none" stroke-width="1.4"/></g>';
  return `<svg class="field" viewBox="0 0 400 160" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${esc(label)}">
    <defs><linearGradient id="turf" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#2E8B4F"/><stop offset="1" stop-color="#1F6B3B"/></linearGradient></defs>
    <rect width="400" height="160" fill="url(#turf)"/>
    ${Array.from({ length: 8 }, (_, i) => `<rect x="${60 + i * 35}" y="0" width="17.5" height="160" fill="#000" opacity=".05"/>`).join('')}
    <rect x="0" y="0" width="60" height="160" fill="${c1}"/><rect x="340" y="0" width="60" height="160" fill="${c1}"/>
    <text x="30" y="80" fill="${c2}" font-size="15" font-weight="900" text-anchor="middle" transform="rotate(-90 30 80)" font-family="system-ui" letter-spacing="3">ENDZONE</text>
    <text x="370" y="80" fill="${c2}" font-size="15" font-weight="900" text-anchor="middle" transform="rotate(90 370 80)" font-family="system-ui" letter-spacing="3">ENDZONE</text>
    ${lines}${hash}${icon}
  </svg>`;
}
const P = {
  home: 'M3 10.5 12 4l9 6.5V20h-6v-6H9v6H3z', season: 'M4 5h16v15H4zM4 9h16M9 3v4m6-4v4', player: 'M16 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0M4 21a8 8 0 0 1 16 0',
  records: 'M7 4h10v4a5 5 0 0 1-10 0zM5 5H3v2a4 4 0 0 0 4 4m12-6h2v2a4 4 0 0 1-4 4M10 14h4v3h-4zM8 20h8', social: 'M4 5h16v10H9l-5 4z', shop: 'M4 8h16l-1.5 12h-13zM9 8V6a3 3 0 0 1 6 0v2',
  settings: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM19 12l2-1-1-3-2 .3-1.4-1.4.3-2-3-1-1 2h-1.8l-1-2-3 1 .3 2L7 7.3 5 7 4 10l2 1v2l-2 1 1 3 2-.3 1.4 1.4-.3 2 3 1 1-2h1.8l1 2 3-1-.3-2 1.4-1.4 2 .3 1-3-2-1z',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z', arrow: 'M5 12h14m-6-6 6 6-6 6', chevron: 'm9 6 6 6-6 6', close: 'M6 6l12 12M18 6 6 18', check: 'm5 12 5 5 9-10',
  ball: 'M5 19c-1-5 1-10 5-13s9-3 9-3 1 5-2 9-8 6-12 7zM9 15l6-6M10 12l2 2M12 10l2 2', tv: 'M3 6h18v11H3zM8 21h8M12 17v4', star: 'm12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z',
  trophy: 'M7 4h10v4a5 5 0 0 1-10 0zM10 14h4v3h-4zM8 20h8', bolt: 'M13 2 4 14h7l-1 8 9-12h-7z', draft: 'M4 4h16v16H4zM8 9h8M8 13h8M8 17h5', door: 'M6 3h10v18H6zM13 12h.01M16 5h3v14h-3',
  download: 'M12 4v11m-5-5 5 5 5-5M5 20h14', upload: 'M12 20V9m-5 5 5-5 5 5M5 4h14', plus: 'M12 5v14M5 12h14', medal: 'M8 3h8l-2 6h-4zM12 21a6 6 0 1 0 0-12 6 6 0 0 0 0 12z',
};
export const icon = (name, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${P[name] || P.ball}"/></svg>`;
export function sparkline(points, w = 320, h = 90) {
  if (points.length < 2) return '';
  const xs = points.map((_, i) => i / (points.length - 1) * (w - 16) + 8), max = Math.max(...points.map(p => p.n)), min = Math.min(...points.map(p => p.n));
  const ys = points.map(p => h - 14 - (max === min ? .5 : (p.n - min) / (max - min)) * (h - 28));
  const d = xs.map((x, i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${ys[i].toFixed(1)}`).join(' ');
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" role="img" aria-label="팔로워 추이"><path d="${d} L${xs.at(-1)} ${h - 6} L${xs[0]} ${h - 6}Z" class="spark-fill"/><path d="${d}" class="spark-line"/>${xs.map((x, i) => `<circle cx="${x}" cy="${ys[i]}" r="${i === xs.length - 1 ? 4 : 2.2}" class="spark-dot"/>`).join('')}</svg>`;
}
export { esc };
