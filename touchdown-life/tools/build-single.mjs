// 단일 HTML 빌드: ES 모듈들을 하나의 <script>로 묶고 CSS를 인라인합니다.
// 결과물은 서버 없이 더블클릭(file://)으로도 열립니다.
// node tools/build-single.mjs  →  touchdown-life.html
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, normalize, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const order = [], seen = new Set(), sources = {};
const IMPORT = /import\s+(\*\s+as\s+\w+|\{[\s\S]*?\})\s+from\s+['"](\.[^'"]+)['"];?/g;
const id = p => relative(root, p).replace(/\\/g, '/');

function visit(file) {
  const key = id(file);
  if (seen.has(key)) return;
  seen.add(key);
  const src = readFileSync(file, 'utf8');
  sources[key] = src;
  for (const m of src.matchAll(IMPORT)) visit(normalize(join(dirname(file), m[2])));
  order.push(key);
}
visit(join(root, 'js/main.js'));

// 선언 목록에서 이름들을 찾습니다 (괄호 깊이 0의 쉼표로 구분, 문자열·템플릿·정규식은 건너뜀)
function declNames(s, i) {
  const names = [], first = /^\s*([A-Za-z_$][\w$]*)/.exec(s.slice(i));
  if (first) names.push(first[1]);
  let depth = 0, prev = '=';
  for (; i < s.length; i++) {
    const ch = s[i];
    if (ch === '"' || ch === "'" || ch === '`') { const q = ch; for (i++; i < s.length && s[i] !== q; i++) if (s[i] === '\\') i++; prev = q; continue; }
    if (ch === '/' && s[i + 1] === '/') { while (i < s.length && s[i] !== '\n') i++; continue; }
    if (ch === '/' && s[i + 1] === '*') { i = s.indexOf('*/', i + 2) + 1; continue; }
    if (ch === '/' && '(,=:[!&|?{};+-*%<>~^'.includes(prev)) { let cls = false; for (i++; i < s.length; i++) { if (s[i] === '\\') { i++; continue; } if (s[i] === '[') cls = true; else if (s[i] === ']') cls = false; else if (s[i] === '/' && !cls) break; } prev = '/'; continue; }
    if ('([{'.includes(ch)) depth++;
    else if (')]}'.includes(ch)) depth--;
    else if (depth === 0 && ch === ';') break;
    else if (depth === 0 && ch === ',') { const m = /^\s*([A-Za-z_$][\w$]*)\s*=/.exec(s.slice(i + 1)); if (m) names.push(m[1]); }
    if (!/\s/.test(ch)) prev = ch;
  }
  return names;
}

function transform(key) {
  let src = sources[key];
  const exports = [];
  src = src.replace(IMPORT, (_, what, from) => {
    const dep = id(normalize(join(root, dirname(key), from)));
    if (what.startsWith('*')) return `const ${what.split(/\s+as\s+/)[1].trim()} = __req(${JSON.stringify(dep)});`;
    const names = what.slice(1, -1).split(',').map(x => x.trim()).filter(Boolean).map(x => x.replace(/\s+as\s+/, ': '));
    return `const { ${names.join(', ')} } = __req(${JSON.stringify(dep)});`;
  });
  // export const a = 1, b = 2; 처럼 한 줄에 여러 개를 선언해도 모두 내보냅니다
  src = src.replace(/^export\s+(const|let)\s+/gm, (m, kind, at, whole) => { exports.push(...declNames(whole, at + m.length)); return `${kind} `; });
  src = src.replace(/^export\s+(async\s+function|function|class)\s+([A-Za-z_$][\w$]*)/gm, (_, kind, name) => { exports.push(name); return `${kind} ${name}`; });
  src = src.replace(/^export\s*\{([^}]*)\};?/gm, (_, list) => { for (const x of list.split(',').map(y => y.trim()).filter(Boolean)) exports.push(x.includes(' as ') ? x.replace(/(\w+)\s+as\s+(\w+)/, '$2: $1') : x); return ''; });
  if (/\bexport\b\s/.test(src.replace(/(['"`]).*?\1/g, ''))) throw Error(`처리하지 못한 export: ${key}`);
  return `__def(${JSON.stringify(key)}, function () {\n${src}\nreturn { ${exports.join(', ')} };\n});`;
}

const bundle = `(function () {
'use strict';
const __defs = {}, __cache = {};
function __def(k, f) { __defs[k] = f; }
function __req(k) { if (!(k in __cache)) { if (!__defs[k]) throw Error('missing module ' + k); __cache[k] = __defs[k](); } return __cache[k]; }
${order.map(transform).join('\n')}
__req('js/main.js');
})();`;

const index = readFileSync(join(root, 'index.html'), 'utf8');
const css = readFileSync(join(root, 'css/app.css'), 'utf8');
const script = `<script>\n${bundle.replace(/<\/script/gi, '<\\/script')}\n</script>`;
// --artifact <경로>: Claude 아티팩트용. 문서 뼈대(doctype·html·head·body)는 게시할 때 붙으므로 내용만 씁니다.
const artIdx = process.argv.indexOf('--artifact');
if (artIdx > 0) {
  const out = process.argv[artIdx + 1];
  const pick = re => (index.match(re) || [''])[0];
  const body = index.slice(index.indexOf('<body>') + 6, index.indexOf('</body>')).replace(/<noscript>[\s\S]*?<\/noscript>/, '').trim();
  const page = [
    '<title>터치다운 인생</title>',
    '<meta name="claude:viewport-fit-sides" content="cover">',
    pick(/<meta name="description"[^>]*>/),
    ...index.match(/<link rel="(preconnect|stylesheet)" href="https:[^>]*>/g),
    `<style>\n${css}\n</style>`,
    pick(/<script>try\{var t=localStorage[\s\S]*?<\/script>/),
    body,
    script,
  ].join('\n');
  writeFileSync(out, page);
  console.log(`artifact → ${out} · ${(page.length / 1024).toFixed(0)}KB`);
  process.exit(0);
}
let html = index;
html = html.replace(/<link rel="stylesheet" href="css\/app.css">/, () => `<style>\n${css}\n</style>`);
html = html.replace(/<script type="module" src="js\/main.js"><\/script>/, '');
html = html.replace('</body>', () => `${script}\n</body>`);
html = html.replace('<!doctype html>', '<!doctype html>\n<!-- 자동 생성 파일: node tools/build-single.mjs (원본은 js/, css/) -->');
writeFileSync(join(root, 'touchdown-life.html'), html);
console.log(`touchdown-life.html · 모듈 ${order.length}개 · ${(html.length / 1024).toFixed(0)}KB`);
