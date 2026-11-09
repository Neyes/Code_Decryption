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

function transform(key) {
  let src = sources[key];
  const exports = [];
  src = src.replace(IMPORT, (_, what, from) => {
    const dep = id(normalize(join(root, dirname(key), from)));
    if (what.startsWith('*')) return `const ${what.split(/\s+as\s+/)[1].trim()} = __req(${JSON.stringify(dep)});`;
    const names = what.slice(1, -1).split(',').map(x => x.trim()).filter(Boolean).map(x => x.replace(/\s+as\s+/, ': '));
    return `const { ${names.join(', ')} } = __req(${JSON.stringify(dep)});`;
  });
  src = src.replace(/^export\s+(async\s+function|function|const|let|class)\s+([A-Za-z_$][\w$]*)/gm, (_, kind, name) => { exports.push(name); return `${kind} ${name}`; });
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

let html = readFileSync(join(root, 'index.html'), 'utf8');
const css = readFileSync(join(root, 'css/app.css'), 'utf8');
html = html.replace(/<link rel="stylesheet" href="css\/app.css">/, () => `<style>\n${css}\n</style>`);
html = html.replace(/<script type="module" src="js\/main.js"><\/script>/, '');
html = html.replace('</body>', () => `<script>\n${bundle.replace(/<\/script/gi, '<\\/script')}\n</script>\n</body>`);
html = html.replace('<!doctype html>', '<!doctype html>\n<!-- 자동 생성 파일: node tools/build-single.mjs (원본은 js/, css/) -->');
writeFileSync(join(root, 'touchdown-life.html'), html);
console.log(`touchdown-life.html · 모듈 ${order.length}개 · ${(html.length / 1024).toFixed(0)}KB`);
