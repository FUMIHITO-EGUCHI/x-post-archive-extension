import http from 'http';

const port = parseInt(process.argv[2] || '9222', 10);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function request(method, path) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { method, hostname: '127.0.0.1', port, path },
      (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          resolve(JSON.parse(body));
        });
      },
    );
    req.on('error', reject);
    req.end();
  });
}

function evaluate(wsUrl, expression) {
  return new Promise((resolve) => {
    const ws = new WebSocket(wsUrl);
    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          id: 1,
          method: 'Runtime.evaluate',
          params: {
            expression,
            returnByValue: true,
          },
        }),
      );
    };
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.id === 1) {
        resolve(message.result?.result?.value ?? null);
        ws.close();
      }
    };
    ws.onerror = () => resolve(null);
    setTimeout(() => resolve(null), 10000);
  });
}

async function main() {
  const tab = await request('PUT', '/json/new?chrome://extensions/');
  await sleep(2500);

  const clickResult = await evaluate(
    tab.webSocketDebuggerUrl,
    `(() => {
      const manager = document.querySelector('extensions-manager');
      const managerRoot = manager?.shadowRoot;
      const toolbar = managerRoot?.querySelector('extensions-toolbar');
      const toolbarRoot = toolbar?.shadowRoot;
      const button = toolbarRoot?.querySelector('#loadUnpacked');
      if (!button) return 'no-button';
      button.click();
      return 'clicked';
    })()`,
  );

  await sleep(8000);

  const targets = await request('GET', '/json/list');
  const extensionTarget =
    targets.find(
      (target) =>
        target.type === 'service_worker' &&
        /^chrome-extension:\/\/[^/]+\/background\.js$/.test(target.url),
    ) ?? null;

  process.stdout.write(
    JSON.stringify(
      {
        clickResult,
        extensionTarget,
      },
      null,
      2,
    ) + '\n',
  );
}

main().catch((error) => {
  process.stderr.write(String(error?.stack ?? error) + '\n');
  process.exit(1);
});
