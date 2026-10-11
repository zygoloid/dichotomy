// Renders the soundtrack offline in headless Chrome and prints level statistics.
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
  ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: 'new Promise(r => { const t = setInterval(() => { if (window.result) { clearInterval(t); r(window.result); } }, 100); })', awaitPromise: true, returnByValue: true } }));
  const msg = await new Promise(r => ws.addEventListener('message', e => r(JSON.parse(e.data))));
  console.log(msg.result && msg.result.result ? msg.result.result.value : JSON.stringify(msg));
})().catch(e => console.error(e.message)).finally(() => { chrome.kill(); });
