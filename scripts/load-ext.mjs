import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const port = parseInt(process.argv[2] || '9229', 10);
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.dirname(scriptDir);
const extPath = path.join(repoRoot, '.output', 'chrome-mv3');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function request(method, urlPath) {
  return new Promise((resolve, reject) => {
    const opts = { method, hostname: '127.0.0.1', port, path: urlPath };
    http.request(opts, (res) => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    }).on('error', reject).end();
  });
}

function evalInWS(wsUrl, expr, awaitPromise = false) {
  return new Promise((resolve) => {
    const ws = new WebSocket(wsUrl);
    ws.onopen = () => ws.send(JSON.stringify({
      id: 1, method: 'Runtime.evaluate',
      params: { expression: expr, awaitPromise, returnByValue: true }
    }));
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.id === 1) { resolve(msg.result); ws.close(); }
    };
    ws.onerror = () => resolve(null);
    setTimeout(() => resolve(null), 12000);
  });
}

async function main() {
  const tab = await request('PUT', '/json/new?chrome://extensions/');
  await sleep(2500);

  const expr = `new Promise((res,rej)=>chrome.developerPrivate.loadUnpacked({failQuietly:false,populateError:true,path:${JSON.stringify(extPath)}},(r)=>{const e=chrome.runtime.lastError;if(e)rej(e.message);else res(JSON.stringify(r))}))`;
  const result = await evalInWS(tab.webSocketDebuggerUrl, expr, true);
  process.stdout.write(JSON.stringify(result?.result?.value ?? result) + '\n');

  await sleep(2000);
  const targets = await request('GET', '/json/list');
  targets.forEach(t => process.stdout.write(t.type + ' ' + t.url + '\n'));
  process.exit(0);
}

main().catch(e => { process.stdout.write('error: ' + e.message + '\n'); process.exit(1); });
