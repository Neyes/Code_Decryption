// 브라우저 저장: 진행 중인 커리어 1개 + 은퇴 기록 보관함. 저장 파일 내보내기/가져오기.
const KEY = 'tdlife.save.v1', ARCHIVE = 'tdlife.archive.v1', THEME = 'tdlife.theme';
const safe = (fn, fallback = null) => { try { return fn(); } catch { return fallback; } };
export const loadCareer = () => safe(() => JSON.parse(localStorage.getItem(KEY) || 'null'));
export function saveCareer(s) {
  if (!s) { safe(() => localStorage.removeItem(KEY)); return true; }
  return safe(() => { localStorage.setItem(KEY, JSON.stringify(s)); return true; }, false);
}
export const listArchive = () => safe(() => JSON.parse(localStorage.getItem(ARCHIVE) || '[]'), []);
export function archiveCareer(entry) {
  const list = listArchive().filter(x => x.id !== entry.id);
  list.unshift(entry);
  safe(() => localStorage.setItem(ARCHIVE, JSON.stringify(list.slice(0, 60))));
  return list;
}
export function deleteArchive(id) { safe(() => localStorage.setItem(ARCHIVE, JSON.stringify(listArchive().filter(x => x.id !== id)))); }
export const getTheme = () => safe(() => localStorage.getItem(THEME)) || 'auto';
export const setTheme = t => safe(() => localStorage.setItem(THEME, t));
export function exportFile(s) {
  const blob = new Blob([JSON.stringify({ app: 'touchdown-life', v: 1, exportedAt: new Date().toISOString(), career: s, archive: listArchive() })], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = `touchdown-life-${(s?.player?.name || 'save').replace(/\s+/g, '')}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
export async function importFile(file) {
  const data = JSON.parse(await file.text());
  if (data.app !== 'touchdown-life' || !data.career?.player) throw Error('터치다운 인생 저장 파일이 아닙니다.');
  for (const e of data.archive || []) archiveCareer(e);
  return data.career;
}
