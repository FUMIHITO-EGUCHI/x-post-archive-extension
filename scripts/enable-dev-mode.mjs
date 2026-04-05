/**
 * Connects to a Chrome CDP instance, enables developer mode, then closes Chrome gracefully.
 * Usage: node enable-dev-mode.mjs <port>
 */
import http from 'http';

const port = parseInt(process.argv[2] || '9223', 10);

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function getJSON(path) {
  return new Promise((resolve, reject) => {
    http.get({ hostname: '127.0.0.1', port, path }, (res) => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}

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
      if (msg.id === 1) { resolve(msg.result?.result?.value ?? null); ws.close(); }
    };
    ws.onerror = () => resolve(null);
    setTimeout(() => resolve(null), 8000);
  });
}

function closeBrowser(wsUrl) {
  return new Promise((resolve) => {
    const ws = new WebSocket(wsUrl);
    ws.onopen = () => ws.send(JSON.stringify({ id: 1, method: 'Browser.close' }));
    ws.onmessage = () => { resolve(); ws.close(); };
    ws.onerror = () => resolve();
    setTimeout(() => resolve(), 3000);
  });
}

async function waitForCDP(maxTries) {
  for (let i = 0; i < maxTries; i++) {
    try {
      await getJSON('/json/version');
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
    process.stdout.write('cdp-not-ready\n');
    process.exit(1);
  }

  const tab = await createTab('chrome://extensions/');
  await sleep(3000); // Wait for extensions page to fully load

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

  let result = await evalInTab(tab.webSocketDebuggerUrl, script);
  if (result === 'no-toggle' || result === null) {
    await sleep(2000);
    result = await evalInTab(tab.webSocketDebuggerUrl, script);
  }

  // Wait for Chrome to persist the preference change
  await sleep(3000);

  // Close Chrome gracefully so preferences are flushed to disk
  const versionInfo = await getJSON('/json/version');
  await closeBrowser(versionInfo.webSocketDebuggerUrl);

  process.stdout.write((result ?? 'null') + '\n');
  await sleep(1000);
  process.exit(0);
}

main().catch(e => { process.stdout.write('error: ' + e.message + '\n'); process.exit(1); });
