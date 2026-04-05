/**
 * Connects to a Chrome CDP instance and enables developer mode in chrome://extensions/.
 * Usage: node enable-dev-mode.js <port>
 */
const port = parseInt(process.argv[2] || '9223', 10);
const http = require('http');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function createTab(url) {
  return new Promise((resolve, reject) => {
    const opts = { method: 'PUT', hostname: '127.0.0.1', port, path: '/json/new?' + url };
    http.request(opts, (res) => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    }).on('error', reject).end();
  });
}

function evalInTab(wsUrl, expr) {
  return new Promise((resolve) => {
    const ws = new WebSocket(wsUrl);
    ws.onopen = () => ws.send(JSON.stringify({
      id: 1, method: 'Runtime.evaluate',
      params: { expression: expr, returnByValue: true }
    }));
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.id === 1) { resolve(msg.result?.result?.value); ws.close(); }
    };
    ws.onerror = () => resolve(null);
    setTimeout(() => resolve(null), 8000);
  });
}

async function waitForCDP(maxTries) {
  for (let i = 0; i < maxTries; i++) {
    try {
      await new Promise((resolve, reject) => {
        http.get(`http://127.0.0.1:${port}/json/version`, (res) => {
          let d = ''; res.on('data', c => d += c);
          res.on('end', () => resolve(JSON.parse(d)));
        }).on('error', reject);
      });
      return true;
    } catch (e) {
      await sleep(300);
    }
  }
  return false;
}

async function main() {
  const ready = await waitForCDP(20);
  if (!ready) {
    console.error('CDP not ready');
    process.exit(1);
  }

  const tab = await createTab('chrome://extensions/');
  await sleep(3000); // Wait for page to load

  // Try to enable developer mode toggle
  const script = `
    (() => {
      const mgr = document.querySelector('extensions-manager');
      const sr = mgr?.shadowRoot;
      const toolbar = sr?.querySelector('extensions-toolbar');
      const tsr = toolbar?.shadowRoot;
      const toggle = tsr?.querySelector('#devMode');
      if (!toggle) return 'no-toggle';
      if (!toggle.checked) { toggle.click(); return 'enabled'; }
      return 'already-enabled';
    })()
  `;

  const result = await evalInTab(tab.webSocketDebuggerUrl, script);
  console.log(result ?? 'null-result');

  if (result === 'no-toggle' || result === null) {
    // Try again after more wait
    await sleep(2000);
    const result2 = await evalInTab(tab.webSocketDebuggerUrl, script);
    console.log('retry:', result2 ?? 'null-result');
  }

  await sleep(1500); // Wait for preference to be written to disk
  process.exit(0);
}

main().catch(e => { console.error(e.message); process.exit(1); });
