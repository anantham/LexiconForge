import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { chromium } from 'playwright';
// Compare two production builds with identical fresh browser contexts and throttling.
// Usage: node issues/01-bootup-time/route-startup-probe.mjs BEFORE_DIST AFTER_DIST
if (process.argv.length !== 4) throw new Error('Usage: route-startup-probe.mjs BEFORE_DIST AFTER_DIST');
const roots = { before: resolve(process.argv[2]), after: resolve(process.argv[3]) };
for (const root of Object.values(roots)) {
  if (!existsSync(join(root, 'index.html'))) throw new Error(`Missing production build: ${root}`);
}
const variants = ['before', 'after'];
const servers = [];
const origins = {};
for (const variant of variants) {
  const root = roots[variant];
  const cache = new Map();
  const server = createServer((req, res) => {
    let name = new URL(req.url, 'http://localhost').pathname;
    if (!existsSync(join(root, name)) || name === '/') name = '/index.html';
    try {
      if (!cache.has(name)) cache.set(name, gzipSync(readFileSync(join(root, name))));
      const contentType = {'.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.svg':'image/svg+xml'}[extname(name)] || 'application/octet-stream';
      res.writeHead(200, {'Content-Type': contentType, 'Content-Encoding': 'gzip', 'Cache-Control':'no-store'});
      res.end(cache.get(name));
    } catch (error) { res.writeHead(500); res.end(String(error)); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  servers.push(server);
  origins[variant] = `http://127.0.0.1:${server.address().port}`;
}
let browser;
try {
  browser = await chromium.launch({headless:true});
  for (const path of ['/', '/gita']) {
    for (let repeat = 0; repeat < 3; repeat++) {
      for (const variant of (repeat % 2 ? [...variants].reverse() : variants)) {
        const context = await browser.newContext({serviceWorkers:'block'});
        const origin = origins[variant];
        await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', e => errors.push(e.message));
        const cdp = await context.newCDPSession(page);
        await cdp.send('Network.enable');
        await cdp.send('Network.setCacheDisabled', {cacheDisabled:true});
        await cdp.send('Network.emulateNetworkConditions', {offline:false, latency:80, downloadThroughput:1250000, uploadThroughput:1250000});
        await cdp.send('Emulation.setCPUThrottlingRate', {rate:4});
        await page.addInitScript(() => {
          window.__latencyLongTasks = [];
          new PerformanceObserver(list => window.__latencyLongTasks.push(...list.getEntries().map(e => e.duration))).observe({type:'longtask', buffered:true});
          new MutationObserver((_, observer) => {
            const heading = document.querySelector('#root h1');
            if (heading && heading.textContent.trim()) { window.__latencyReady = performance.now(); observer.disconnect(); }
          }).observe(document, {childList:true, subtree:true});
        });
        await page.goto(origin + path, {waitUntil:'domcontentloaded'});
        await page.waitForFunction(() => window.__latencyReady > 0, undefined, {timeout:30000});
        const metrics = await page.evaluate(() => ({
          readyMs: Math.round(window.__latencyReady),
          heading: document.querySelector('#root h1').textContent.trim(),
          js: performance.getEntriesByType('resource').filter(r => new URL(r.name).pathname.endsWith('.js')).map(r => ({name:new URL(r.name).pathname, encoded:r.encodedBodySize, decoded:r.decodedBodySize})),
          longTaskMs: Math.round(window.__latencyLongTasks.reduce((a,b)=>a+b,0)),
          boot: JSON.parse(localStorage.getItem('boot-telemetry-history') || '[]').at(-1)?.totalMs ?? null,
        }));
        console.log(JSON.stringify({variant,path,repeat,readyMs:metrics.readyMs,jsKB:Math.round(metrics.js.reduce((n,r)=>n+r.decoded,0)/1000),gzipKB:Math.round(metrics.js.reduce((n,r)=>n+r.encoded,0)/1000),longTaskMs:metrics.longTaskMs,errors}));
        await context.close();
      }
    }
  }
} finally {
  if (browser) await browser.close();
  for (const server of servers) server.close();
}
