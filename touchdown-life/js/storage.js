// 저장: 진행 중인 커리어 1개 + 은퇴 기록 보관함.
// 1) 브라우저 저장(localStorage) — 어디서나, 다만 지워질 수 있음
// 2) Claude 아티팩트로 열었을 때는 내 계정의 비공개 저장소(db, data/users/<내 id>/)에도 저장 — 휴대폰·PC 어디서 열어도 이어짐
const KEY = 'tdlife.save.v1', ARCHIVE = 'tdlife.archive.v1', THEME = 'tdlife.theme';
const safe = (fn, fallback = null) => { try { return fn(); } catch { return fallback; } };
const viewer = () => (typeof window !== 'undefined' && window.claude && typeof window.claude.use === 'function') ? window.claude : null;
export const inViewer = () => !!viewer();

export const loadCareer = () => safe(() => JSON.parse(localStorage.getItem(KEY) || 'null'));
export function saveCareer(s) {
  cloudSave(s);
  if (!s) { safe(() => localStorage.removeItem(KEY)); return true; }
  return safe(() => { localStorage.setItem(KEY, JSON.stringify(s)); return true; }, false) || !!cloud;
}
export const listArchive = () => safe(() => JSON.parse(localStorage.getItem(ARCHIVE) || '[]'), []);
function writeArchive(list) { safe(() => localStorage.setItem(ARCHIVE, JSON.stringify(list))); cloudArchive(list); }
export function archiveCareer(entry) {
  const list = [entry, ...listArchive().filter(x => x.id !== entry.id)].slice(0, 60);
  writeArchive(list);
  return list;
}
export function deleteArchive(id) { writeArchive(listArchive().filter(x => x.id !== id)); }
export const getTheme = () => safe(() => localStorage.getItem(THEME)) || 'auto';
export const setTheme = t => safe(() => localStorage.setItem(THEME, t));

// ───────── 계정 저장소 (아티팩트 db) ─────────
let cloud = null, status = inViewer() ? 'connecting' : 'local';
export const storageStatus = () => status;
const timeout = (p, ms = 10000) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej({ code: 'timeout' }), ms))]);
const metaPath = () => `data/users/${cloud.uid}/save`, chunkPath = i => `data/users/${cloud.uid}/save/chunks/${i}`, archivePath = () => `data/users/${cloud.uid}/archive`;
const CHUNK = 70000; // 문서 한 개 256KiB 제한 안쪽 (한글이 많아도 안전한 크기)
export async function connectCloud() {
  const c = viewer();
  if (!c) { status = 'local'; return null; }
  try {
    const [db, user] = await Promise.all([c.use('db'), c.use('user')]);
    const uid = db && user ? await user.id() : null;
    if (!uid) { status = 'local'; return null; }
    cloud = { db, uid }; status = 'synced';
    return cloud;
  } catch { status = 'local'; return null; }
}
// 계정에 저장된 커리어와 은퇴 기록을 읽습니다. { career, savedAt, archive }
export async function cloudLoad() {
  if (!cloud) return null;
  try {
    const [meta, arch] = await Promise.all([timeout(cloud.db.doc(metaPath()).get()), timeout(cloud.db.doc(archivePath()).get())]);
    const archive = arch.exists ? (arch.data().list || []) : null;
    if (!meta.exists) return { career: null, savedAt: 0, archive };
    const m = meta.data();
    if (!m.chunks) return { career: null, savedAt: m.savedAt || 0, archive, empty: true };
    const parts = [];
    for (let i = 0; i < m.chunks; i++) { const d = await timeout(cloud.db.doc(chunkPath(i)).get()); if (!d.exists) throw { code: 'missing' }; parts.push(d.data().s); }
    const career = JSON.parse(parts.join(''));
    lastJson = parts.join('');
    return { career, savedAt: m.savedAt || 0, archive };
  } catch { status = 'offline'; return null; }
}
export function mergeArchive(list) {
  if (!list?.length) return listArchive();
  const mine = listArchive(), ids = new Set(mine.map(x => x.id));
  const merged = [...mine, ...list.filter(x => !ids.has(x.id))].slice(0, 60);
  safe(() => localStorage.setItem(ARCHIVE, JSON.stringify(merged)));
  if (merged.length !== list.length) cloudArchive(merged);
  return merged;
}
// 쓰기는 마지막 변경 뒤 1.2초에 한 번, 문서마다 한 번에 하나씩.
let lastJson = null, latest = null, timer = null, writing = false, again = false;
function cloudSave(s) {
  if (!cloud) return;
  latest = s ? JSON.stringify(s) : '';
  clearTimeout(timer); timer = setTimeout(flush, 1200);
}
export async function flush() {
  if (!cloud || latest === null || latest === lastJson) return;
  if (writing) { again = true; return; }
  writing = true;
  const json = latest;
  try {
    if (!json) await cloud.db.doc(metaPath()).set({ savedAt: Date.now(), chunks: 0 });
    else {
      const n = Math.ceil(json.length / CHUNK);
      for (let i = 0; i < n; i++) await cloud.db.doc(chunkPath(i)).set({ i, s: json.slice(i * CHUNK, (i + 1) * CHUNK) });
      await cloud.db.doc(metaPath()).set({ savedAt: Date.now(), chunks: n, v: 1 });
    }
    lastJson = json; status = 'synced';
  } catch (e) { status = e?.code === 'quota_exceeded' ? 'quota' : 'offline'; }
  writing = false;
  if (again) { again = false; flush(); }
}
let archiveWriting = Promise.resolve();
function cloudArchive(list) {
  if (!cloud) return;
  archiveWriting = archiveWriting.then(() => cloud.db.doc(archivePath()).set({ list, updatedAt: Date.now() })).catch(() => { status = 'offline'; });
}
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { clearTimeout(timer); flush(); } });

// ───────── 파일 내보내기 ─────────
// 아티팩트 안에서는 downloads 권한으로(보는 사람이 확인), 밖에서는 일반 다운로드. 'saved' | 'cancelled' | 'fallback'
export async function offerFile(filename, data) {
  const c = viewer();
  if (c) {
    try {
      const dl = await c.use('downloads');
      if (!dl) return 'fallback';
      await dl.save({ filename, data });
      return 'saved';
    } catch (e) { return ['unavailable', 'rejected_extension', 'extension_not_enabled', 'bad_request'].includes(e?.code) || !e?.code ? 'fallback' : 'cancelled'; }
  }
  try {
    const blob = data instanceof Blob ? data : new Blob([data], { type: filename.endsWith('.json') ? 'application/json' : 'application/octet-stream' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    return 'saved';
  } catch { return 'fallback'; }
}
export const exportData = s => JSON.stringify({ app: 'touchdown-life', v: 1, exportedAt: new Date().toISOString(), career: s, archive: listArchive() });
export function importText(text) {
  const data = JSON.parse(text);
  if (data.app !== 'touchdown-life' || !data.career?.player) throw Error('터치다운 인생 저장 데이터가 아닙니다.');
  if (data.archive?.length) mergeArchive(data.archive);
  return data.career;
}
export async function importFile(file) { return importText(await file.text()); }
