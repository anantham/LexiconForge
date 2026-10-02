const https = require('node:https');
const { isDomainAllowed } = require('./allowedDomains.cjs');
const { createRequestBudget } = require('./requestBudget.cjs');

const LIMITS = Object.freeze({ maxBytes: 4 * 1024 * 1024, deadlineMs: 20_000, maxRedirects: 4, maxUrlLength: 4096 });
const SAFE_HEADERS = Object.freeze({
  'Content-Type': 'text/plain; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': "sandbox; default-src 'none'; frame-ancestors 'none'",
  'Content-Disposition': 'attachment; filename="scraped-source.txt"',
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
});

function validateUrl(value) {
  if (typeof value !== 'string' || value.length > LIMITS.maxUrlLength) throw new Error('Invalid URL');
  let parsed;
  try { parsed = new URL(value); } catch { throw new Error('Invalid URL'); }
  if (parsed.protocol !== 'https:' || parsed.port || parsed.username || parsed.password) {
    throw new Error('Only HTTPS URLs on the default port without credentials are supported');
  }
  if (!isDomainAllowed(parsed.hostname)) throw new Error('Domain is not in the allowlist');
  return parsed;
}

// One deadline and one byte budget span headers, body and every redirect.
function fetchBounded(value, { transport = https, limits = LIMITS } = {}) {
  return new Promise((resolve, reject) => {
    let request, response, settled = false, receivedBytes = 0;
    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) { response?.destroy(); request?.destroy(); reject(error); }
      else resolve(result);
    };
    const timer = setTimeout(() => finish(new Error('Proxy deadline exceeded')), limits.deadlineMs);
    const visit = (url, hops) => {
      if (settled) return;
      let parsed, hopDone = false;
      try { parsed = validateUrl(url); } catch (error) { finish(error); return; }
      try { request = transport.get(parsed.href, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; LexiconForge scraper)',
          Accept: 'text/html,application/xhtml+xml,application/json,text/plain;q=0.9',
          'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8',
          'Accept-Encoding': 'identity',
        },
      }, (upstream) => {
        response = upstream;
        if (settled) { upstream.destroy(); return; }
        const fail = (error) => { if (!hopDone) finish(error); };
        upstream.on('error', fail);
        upstream.on('aborted', () => fail(new Error('Upstream response aborted')));
        if (upstream.statusCode >= 300 && upstream.statusCode < 400) {
          hopDone = true;
          upstream.destroy(); // Never buffer/drain arbitrary redirect bodies.
          if (!upstream.headers.location || hops >= limits.maxRedirects) {
            finish(new Error('Proxy redirect limit exceeded or missing location')); return;
          }
          let redirect;
          try { redirect = validateUrl(new URL(upstream.headers.location, parsed).href).href; }
          catch (error) { finish(error); return; }
          visit(redirect, hops + 1);
          return;
        }
        const contentType = upstream.headers['content-type'] || 'text/plain';
        if (!/^(text\/(?:html|plain|xml)|application\/(?:json|xml|xhtml\+xml))(?:\s*;|$)/i.test(contentType)) {
          finish(new Error('Unsupported upstream representation')); return;
        }
        if (upstream.headers['content-encoding'] && upstream.headers['content-encoding'] !== 'identity') {
          finish(new Error('Compressed upstream responses are unsupported')); return;
        }
        const declared = upstream.headers['content-length'];
        if (declared !== undefined && (!/^\d+$/.test(declared) || Number(declared) > limits.maxBytes - receivedBytes)) {
          finish(new Error('Upstream response exceeds byte limit')); return;
        }
        const chunks = [];
        upstream.on('data', (chunk) => {
          if (settled) return;
          receivedBytes += chunk.length;
          if (receivedBytes > limits.maxBytes) { finish(new Error('Upstream response exceeds byte limit')); return; }
          chunks.push(chunk);
        });
        upstream.on('end', () => {
          if (settled) return;
          hopDone = true;
          const body = Buffer.concat(chunks);
          const charset = contentType.match(/charset=["']?([^\s;"']+)/i)?.[1] || 'utf-8';
          let text;
          try { text = new TextDecoder(charset).decode(body); }
          catch { text = body.toString('utf-8'); }
          finish(null, { text, statusCode: upstream.statusCode || 200 });
        });
      });
      request.on('error', (error) => { if (!hopDone) finish(error); });
      } catch (error) { finish(error); }
    };
    visit(value, 0);
  });
}

function createFetchProxy({ fetcher = fetchBounded, budget = createRequestBudget(), processBudget = createRequestBudget({ maxCallerActive: 8, perMinute: 120 }), source = 'fetch-proxy' } = {}) {
  return async (req, res, targetUrl) => {
    for (const [key, value] of Object.entries(SAFE_HEADERS)) res.setHeader(key, value);
    res.setHeader('X-Proxy-Source', source);
    const reply = (status, message) => { res.statusCode = status; res.end(JSON.stringify({ error: message })); };
    if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); reply(405, 'Method not allowed'); return; }
    let parsed;
    try { parsed = validateUrl(targetUrl); }
    catch (error) { reply(error.message.includes('allowlist') ? 403 : 400, error.message); return; }
    const release = budget.acquire(req);
    const releaseProcess = release && processBudget.acquire({});
    if (!release || !releaseProcess) { release?.(); res.setHeader('Retry-After', '60'); reply(429, 'Proxy request budget exceeded'); return; }
    try {
      const { text, statusCode } = await fetcher(parsed.href);
      res.statusCode = statusCode;
      res.end(text);
    } catch (error) {
      reply(error.message === 'Proxy deadline exceeded' ? 504 : 502, 'Upstream fetch failed or exceeded limits');
    } finally { release(); releaseProcess(); }
  };
}

module.exports = { LIMITS, SAFE_HEADERS, validateUrl, fetchBounded, createFetchProxy };
