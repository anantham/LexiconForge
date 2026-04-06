/**
 * Vercel Serverless Function: fetch proxy for scraping.
 * Fetches target URLs server-side, bypassing CORS.
 * Runs on Vercel's edge network (not a single VPS IP),
 * so it's less likely to be blocked by Cloudflare.
 *
 * GET /api/fetch-proxy?url=<encoded-url>
 */

const https = require('https');
const http = require('http');

/** Allowlist of domains we proxy for (prevents open-relay abuse). */
const ALLOWED_DOMAINS = [
  'kakuyomu.jp',
  'dxmwx.org',
  'kanunu8.com',
  'kanunu.net',
  'novelcool.com',
  'ncode.syosetu.com',
  'booktoki468.com',
  'suttacentral.net',
  'hetushu.com',
  'hetubook.com',
];

function isDomainAllowed(hostname) {
  return ALLOWED_DOMAINS.some(
    (d) => hostname === d || hostname.endsWith('.' + d)
  );
}

function fetchUrl(targetUrl, timeout) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(targetUrl);
    const transport = parsed.protocol === 'https:' ? https : http;

    const req = transport.get(
      targetUrl,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
        },
        timeout,
      },
      (proxyRes) => {
        // Follow redirects — re-validate domain on every hop (INV-1)
        if (
          proxyRes.statusCode >= 300 &&
          proxyRes.statusCode < 400 &&
          proxyRes.headers.location
        ) {
          const redirectUrl = new URL(
            proxyRes.headers.location,
            targetUrl
          ).href;
          const redirectHostname = new URL(redirectUrl).hostname;
          if (!isDomainAllowed(redirectHostname)) {
            reject(new Error(`Redirect to disallowed domain: ${redirectHostname}`));
            return;
          }
          fetchUrl(redirectUrl, timeout).then(resolve, reject);
          return;
        }

        const chunks = [];
        proxyRes.on('data', (chunk) => chunks.push(chunk));
        proxyRes.on('end', () => {
          const body = Buffer.concat(chunks);
          const contentType = proxyRes.headers['content-type'] || 'text/html';
          const charsetMatch = contentType.match(/charset=([^\s;]+)/i);
          const charset = charsetMatch?.[1]?.toLowerCase() || 'utf-8';

          let html;
          try {
            const decoder = new TextDecoder(charset, { fatal: false });
            html = decoder.decode(body);
          } catch {
            html = body.toString('utf-8');
          }

          resolve({ html, statusCode: proxyRes.statusCode });
        });
        proxyRes.on('error', reject);
      }
    );

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });
  });
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const targetUrl = req.query.url;
  if (!targetUrl) {
    return res.status(400).json({ error: 'Missing ?url= parameter' });
  }

  let parsed;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  if (!isDomainAllowed(parsed.hostname)) {
    return res
      .status(403)
      .json({ error: `Domain ${parsed.hostname} is not in the allowlist` });
  }

  try {
    const { html, statusCode } = await fetchUrl(targetUrl, 20000);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('X-Proxy-Source', 'vercel-fetch-proxy');
    res.setHeader(
      'Cache-Control',
      'public, s-maxage=300, stale-while-revalidate=600'
    );
    return res.status(statusCode || 200).send(html);
  } catch (err) {
    console.error('[fetch-proxy] Error:', err.message);
    return res.status(502).json({ error: err.message });
  }
}
