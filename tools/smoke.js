// Headless smoke test: loads the game scripts into a stubbed browser context and plays them with a bot.
const vm = require('vm'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const noop = () => { };
const ctx2d = new Proxy({}, { get: (t, k) => k in t ? t[k] : noop, set: (t, k, v) => { t[k] = v; return true; } });
const canvas = () => ({ width: 1280, height: 720, getContext: k => k === '2d' ? ctx2d : null, getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 }), parentNode: { replaceChild: noop } });
const store = {};
const sb = {
  console, Math, JSON, Set, Map, Float32Array, Object, Array, Number, String, Error,
  document: { getElementById: canvas, createElement: canvas },
  localStorage: { getItem: k => store[k] || null, setItem: (k, v) => { store[k] = v; } },
  requestAnimationFrame: noop, location: { hash: '' }, addEventListener: noop, CTX: ctx2d
};
sb.window = sb;
vm.createContext(sb);
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
for (const m of html.matchAll(/src="(js\/[^"]+)"/g)) vm.runInContext(fs.readFileSync(path.join(root, m[1]), 'utf8'), sb, { filename: m[1] });
vm.runInContext(fs.readFileSync(process.argv[2] || path.join(__dirname, 'smoke_body.js'), 'utf8'), sb, { filename: 'smoke_body.js' });
