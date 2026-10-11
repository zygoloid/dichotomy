// Renders the soundtrack offline in headless Chrome.
//   node tools/audio_test.js             print level statistics for every song and intensity
//   node tools/audio_test.js --wav DIR   also write song0.wav .. song4.wav previews into DIR
//   ... --wav DIR --song N               write only song N (each takes a minute or two)
//   node tools/audio_test.js --cand DIR  write a preview of each song-0 candidate in song_candidates.js
const { spawn } = require('child_process'), path = require('path'), os = require('os'), fs = require('fs');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', PORT = 9377;
const page = 'file:///' + path.join(__dirname, 'audio_test.html').split(path.sep).join('/');
const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'gb-audio-'));
const chrome = spawn(CHROME, ['--headless=new', '--remote-debugging-port=' + PORT, '--user-data-dir=' + prof, page], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  let target;
  for (let i = 0; i < 40 && !target; i++) {
    await sleep(250);
    try { target = (await (await fetch('http://127.0.0.1:' + PORT + '/json/list')).json()).find(t => t.url.includes('audio_test')); } catch (e) { }
  }
  if (!target) throw new Error('could not reach Chrome');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r));
  let id = 0; const pending = {};
  ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (pending[m.id]) pending[m.id](m); });
  const run = expr => new Promise((res, rej) => {
    pending[++id] = m => m.result && m.result.result && !m.result.exceptionDetails ? res(m.result.result.value) : rej(new Error(JSON.stringify(m).slice(0, 600)));
    ws.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression: expr, awaitPromise: true, returnByValue: true } }));
  });
  // the page may still be navigating when we first attach, so retry until it answers
  for (let k = 0; ; k++) {
    try { await run('new Promise(r => { const t = setInterval(() => { if (window.ready) { clearInterval(t); r(1); } }, 100); })'); break; }
    catch (e) { if (k > 8) throw e; await sleep(300); }
  }
  const cd = process.argv.indexOf('--cand');
  if (cd > 0) {
    const dir = process.argv[cd + 1]; fs.mkdirSync(dir, { recursive: true });
    for (const k of await run('Object.keys(CAND)')) { const f = path.join(dir, 'song0_' + k + '.wav'); fs.writeFileSync(f, Buffer.from(await run('wavCand(' + JSON.stringify(k) + ')'), 'base64')); console.log('wrote', f); }
    return;
  }
  if (!process.argv.includes('--song')) console.log(await run('stats()')); // a single-song export skips the statistics
  const w = process.argv.indexOf('--wav');
  if (w > 0) {
    const dir = process.argv[w + 1]; fs.mkdirSync(dir, { recursive: true });
    const only = process.argv.indexOf('--song') > 0 ? +process.argv[process.argv.indexOf('--song') + 1] : -1;
    for (let m = 0; m < 5; m++) {
      if (only >= 0 && m !== only) continue; const f = path.join(dir, 'song' + m + '.wav'); fs.writeFileSync(f, Buffer.from(await run('wav(' + m + ')'), 'base64')); console.log('wrote', f); }
  }
})().catch(e => console.error(e.message)).finally(() => { chrome.kill(); });
