// UI 아이콘(선 아이콘)과 팔로워 그래프. 선수·장면 그림은 pixel.js가 그립니다.
export const AVATAR_OPTIONS = { skin: 5, hair: 6, style: 6, visor: 3 };
export const STYLE_NAMES = ['짧은 머리', '버즈컷', '드레드', '곱슬', '긴 머리', '삭발'];
export const VISOR_NAMES = ['바이저 없음', '스모크 바이저', '골드 바이저'];
const esc = v => String(v ?? '').replace(/[&<>"']/g, x => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[x]));
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
