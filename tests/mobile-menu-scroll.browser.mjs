import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const chromePath = process.env.CHROME_BIN;
assert(chromePath, 'Set CHROME_BIN to a Chromium executable');
const dist = resolve(dirname(fileURLToPath(import.meta.url)), '../dist');
await access(resolve(dist, 'guide.html'));

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const profile = await mkdtemp(resolve(tmpdir(), 'pbz-menu-scroll-'));
const server = createServer(async (request, response) => {
  try {
    let path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (path === '/') path = '/index.html';
    if (!extname(path)) path += '.html';
    const file = resolve(dist, '.' + path);
    if (!file.startsWith(dist + '/')) {
      response.writeHead(403).end();
      return;
    }
    const type = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' }[extname(path)];
    response.writeHead(200, { 'Content-Type': type || 'application/octet-stream', 'Cache-Control': 'no-store' }).end(await readFile(file));
  } catch {
    response.writeHead(404).end();
  }
});

let chrome;
let socket;
try {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const origin = `http://127.0.0.1:${server.address().port}`;
  chrome = spawn(chromePath, [
    '--headless=new', '--no-sandbox', '--disable-dev-shm-usage',
    '--remote-debugging-port=0', '--user-data-dir=' + profile, 'about:blank'
  ], { stdio: 'ignore' });
  let port;
  for (let i = 0; i < 120; i++) {
    try {
      port = Number((await readFile(resolve(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]);
      break;
    } catch {
      await sleep(100);
    }
  }
  assert(port, 'Chromium did not start');
  const target = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' }).then((r) => r.json());
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await once(socket, 'open');

  let sequence = 0;
  const pending = new Map();
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (!message.id) return;
    const callback = pending.get(message.id);
    pending.delete(message.id);
    if (callback) message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result);
  });
  const send = (method, params = {}) => new Promise((resolveCall, rejectCall) => {
    const id = ++sequence;
    pending.set(id, { resolve: resolveCall, reject: rejectCall });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const snapshot = () => evaluate(`(() => {
    const root = document.documentElement, body = document.body;
    const toggle = document.querySelector('.nav-toggle'), menu = document.querySelector('.nav-links');
    return {
      y: scrollY, max: root.scrollHeight - innerHeight, height: root.scrollHeight,
      headerTop: document.querySelector('.site-header').getBoundingClientRect().top,
      padding: getComputedStyle(body).paddingRight, inlinePadding: body.style.paddingRight,
      transitionProperty: body.style.transitionProperty,
      gutter: root.style.scrollbarGutter, anchor: root.style.overflowAnchor,
      overflow: getComputedStyle(body).overflow, locked: body.classList.contains('nav-open'),
      expanded: toggle.getAttribute('aria-expanded'), firstFocus: document.activeElement === menu.querySelector('a'),
      toggleFocus: document.activeElement === toggle, focusVisible: document.activeElement.matches(':focus-visible'),
      menuScrollTop: menu.scrollTop
    };
  })()`);
  const key = async (name) => {
    const code = name === 'Enter' ? 13 : 27;
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: name, code: name, windowsVirtualKeyCode: code, ...(name === 'Enter' ? { text: '\r', unmodifiedText: '\r' } : {}) });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: name, code: name, windowsVirtualKeyCode: code });
    await sleep(100);
  };
  const clickToggle = async () => {
    const point = await evaluate(`(() => { const r = document.querySelector('.nav-toggle').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
    await sleep(100);
  };
  const stable = (before, open, closed, label) => {
    assert(Math.abs(open.y - before.y) <= 1 && Math.abs(closed.y - before.y) <= 1, `${label}: scroll ${before.y}/${open.y}/${closed.y}`);
    assert(Math.abs(open.height - before.height) <= 1 && Math.abs(closed.height - before.height) <= 1, `${label}: document height`);
    assert(Math.abs(open.headerTop) <= 1 && Math.abs(closed.headerTop) <= 1, `${label}: sticky header`);
    assert.equal(open.expanded, 'true');
    assert.equal(open.locked, true);
    assert.equal(open.firstFocus, true);
    assert.equal(open.menuScrollTop, 0);
    assert.equal(closed.expanded, 'false');
    assert.equal(closed.locked, false);
    assert.notEqual(closed.overflow, 'hidden');
    for (const property of ['inlinePadding', 'transitionProperty', 'gutter', 'anchor']) assert.equal(closed[property], before[property], `${label}: restore ${property}`);
  };

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Network.setCacheDisabled', { cacheDisabled: true });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await send('Emulation.setDeviceMetricsOverride', { width: 681, height: 900, deviceScaleFactor: 1, mobile: false });
  for (const path of ['/guide', '/weapons/white-shadow']) {
    const url = origin + path;
    await send('Page.navigate', { url });
    let ready = false;
    for (let i = 0; i < 180; i++) {
      try {
        ready = await evaluate(`location.href === ${JSON.stringify(url)} && document.readyState !== 'loading' && !!document.querySelector('.nav-toggle')`);
      } catch {
        // Navigation may replace the execution context before the new page is ready.
      }
      if (ready) break;
      await sleep(50);
    }
    assert(ready, `Navigation failed: ${path}`);
    await evaluate('document.fonts.ready.then(() => true)');
    await sleep(180);
    await evaluate('scrollTo({ top: document.documentElement.scrollHeight - innerHeight, behavior: "instant" })');
    await sleep(100);
    await evaluate('document.querySelector(".nav-toggle").focus({ preventScroll: true })');
    const baseline = await snapshot();
    assert.equal(baseline.y, baseline.max, `${path}: start at page bottom`);
    for (let cycle = 0; cycle < 3; cycle++) {
      const before = await snapshot();
      await key('Enter');
      const keyboardOpen = await snapshot();
      assert.equal(keyboardOpen.focusVisible, true, `${path}: keyboard focus visible`);
      await key('Escape');
      const keyboardClosed = await snapshot();
      assert.equal(keyboardClosed.toggleFocus, true, `${path}: Escape returns focus`);
      stable(before, keyboardOpen, keyboardClosed, `${path} keyboard cycle ${cycle}`);
      await clickToggle();
      const mouseOpen = await snapshot();
      await clickToggle();
      const mouseClosed = await snapshot();
      stable(keyboardClosed, mouseOpen, mouseClosed, `${path} mouse cycle ${cycle}`);
      assert(Math.abs(mouseClosed.y - baseline.y) <= 1, `${path}: repeated cycles accumulate scroll offset`);
    }
  }
  console.log('681px page-bottom menu scroll regression passed on Guide and White Shadow (keyboard and mouse ×3).');
} finally {
  if (socket) socket.close();
  if (chrome && chrome.exitCode === null) {
    chrome.kill();
    await once(chrome, 'exit').catch(() => {});
  }
  await new Promise((done) => server.close(done));
  await rm(profile, { recursive: true, force: true, maxRetries: 6, retryDelay: 150 });
}
