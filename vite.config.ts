import path from 'path';
import fs from 'fs';
import http from 'http';
import https from 'https';
import { defineConfig, loadEnv, type Plugin } from 'vite';

/**
 * Plugin: local fetch proxy for scraping.
 * Fetches target URLs server-side (Node.js on the user's machine),
 * bypassing CORS and Cloudflare bot-detection that blocks server IPs.
 * Endpoint: GET /api/fetch-proxy?url=<encoded-url>
 */
/** Domain allowlist — must match api/fetch-proxy.js (enforced by proxy-parity.test.ts) */
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

function isDomainAllowed(hostname: string): boolean {
  return ALLOWED_DOMAINS.some(
    (d) => hostname === d || hostname.endsWith('.' + d)
  );
}

function localFetchProxyPlugin(): Plugin {
  return {
    name: 'local-fetch-proxy',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const reqUrl = req.url || '';
        if (!reqUrl.startsWith('/api/fetch-proxy?')) return next();

        const params = new URL(reqUrl, 'http://localhost').searchParams;
        const targetUrl = params.get('url');

        if (!targetUrl) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing ?url= parameter' }));
          return;
        }

        let parsed: URL;
        try {
          parsed = new URL(targetUrl);
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid URL' }));
          return;
        }

        if (!isDomainAllowed(parsed.hostname)) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `Domain ${parsed.hostname} is not in the allowlist` }));
          return;
        }

        const transport = parsed.protocol === 'https:' ? https : http;
        const proxyReq = transport.get(targetUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
          },
          timeout: 20000,
        }, (proxyRes) => {
          // Follow redirects (3xx)
          if (proxyRes.statusCode && proxyRes.statusCode >= 300 && proxyRes.statusCode < 400 && proxyRes.headers.location) {
            const redirectUrl = new URL(proxyRes.headers.location, targetUrl).href;
            // Re-issue as a redirect to ourselves
            res.writeHead(302, { 'Location': `/api/fetch-proxy?url=${encodeURIComponent(redirectUrl)}` });
            res.end();
            return;
          }

          const chunks: Buffer[] = [];
          proxyRes.on('data', (chunk: Buffer) => chunks.push(chunk));
          proxyRes.on('end', () => {
            const body = Buffer.concat(chunks);
            // Detect charset from content-type header
            const contentType = proxyRes.headers['content-type'] || 'text/html';
            const charsetMatch = contentType.match(/charset=([^\s;]+)/i);
            const charset = charsetMatch?.[1]?.toLowerCase() || 'utf-8';

            let html: string;
            try {
              // Use TextDecoder for proper charset handling (gbk, gb2312, etc.)
              html = new TextDecoder(charset, { fatal: false }).decode(body);
            } catch {
              html = body.toString('utf-8');
            }

            res.writeHead(proxyRes.statusCode || 200, {
              'Content-Type': 'text/html; charset=utf-8',
              'Access-Control-Allow-Origin': '*',
              'X-Proxy-Source': 'local-fetch-proxy',
            });
            res.end(html);
          });
        });

        proxyReq.on('error', (err) => {
          console.error('[local-fetch-proxy] Error:', err.message);
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        });

        proxyReq.on('timeout', () => {
          proxyReq.destroy();
          res.writeHead(504, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Proxy request timed out' }));
        });
      });
    },
  };
}

/**
 * Plugin to serve benchmark reports for the /sutta/pipeline route.
 * Provides API endpoints:
 * - GET /api/sutta-studio/reports - List available reports (sorted newest first)
 * - GET /api/sutta-studio/reports/:reportId/packet.json - Get assembled packet
 */
function suttaStudioReportsPlugin(): Plugin {
  const reportsDir = path.resolve(__dirname, 'reports/sutta-studio');

  return {
    name: 'sutta-studio-reports',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url || '';

        // List available reports
        if (url === '/api/sutta-studio/reports') {
          try {
            if (!fs.existsSync(reportsDir)) {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ reports: [] }));
              return;
            }

            const entries = fs.readdirSync(reportsDir, { withFileTypes: true });
            const reports = entries
              .filter((e) => e.isDirectory())
              .map((e) => e.name)
              .sort()
              .reverse(); // Newest first (ISO timestamps sort correctly)

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ reports }));
          } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: String(e) }));
          }
          return;
        }

        // Serve packet.json for a specific report
        const packetMatch = url.match(/^\/api\/sutta-studio\/reports\/([^/]+)\/packet\.json$/);
        if (packetMatch) {
          const reportId = packetMatch[1];
          const packetPath = path.join(reportsDir, reportId, 'outputs', 'gemini-3-flash', 'packet.json');

          // Also check direct in report dir (fallback)
          const altPacketPath = path.join(reportsDir, reportId, 'packet.json');
          const finalPath = fs.existsSync(packetPath) ? packetPath : altPacketPath;

          if (!fs.existsSync(finalPath)) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Packet not found' }));
            return;
          }

          try {
            const content = fs.readFileSync(finalPath, 'utf8');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(content);
          } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: String(e) }));
          }
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const mask = (k?: string) => {
      if (!k) return null;
      return '*'.repeat(Math.max(0, k.length - 4)) + k.slice(-4);
    };
    // Terminal diagnostics on server start/build
    // Shows which .env values were loaded (masked) for quick troubleshooting
    console.log('[Vite Env] Loaded keys (masked):', {
      GEMINI_API_KEY: mask(env.GEMINI_API_KEY),
      OPENAI_API_KEY: mask(env.OPENAI_API_KEY),
      DEEPSEEK_API_KEY: mask(env.DEEPSEEK_API_KEY),
      CLAUDE_API_KEY: mask(env.CLAUDE_API_KEY),
      OPENROUTER_API_KEY: mask(env.OPENROUTER_API_KEY),
      PIAPI_API_KEY: mask(env.PIAPI_API_KEY),
      mode
    });
    return {
      server: {
        port: 5180,
        strictPort: true,
      },
      define: {
        // Legacy support
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        // All provider API keys for Vercel deployment
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.OPENAI_API_KEY': JSON.stringify(env.OPENAI_API_KEY),
        'process.env.DEEPSEEK_API_KEY': JSON.stringify(env.DEEPSEEK_API_KEY),
        'process.env.CLAUDE_API_KEY': JSON.stringify(env.CLAUDE_API_KEY),
        'process.env.OPENROUTER_API_KEY': JSON.stringify(env.OPENROUTER_API_KEY),
        'process.env.PIAPI_API_KEY': JSON.stringify(env.PIAPI_API_KEY),
        'import.meta.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'import.meta.env.VITE_OPENAI_API_KEY': JSON.stringify(env.OPENAI_API_KEY),
        'import.meta.env.OPENAI_API_KEY': JSON.stringify(env.OPENAI_API_KEY),
        'import.meta.env.VITE_DEEPSEEK_API_KEY': JSON.stringify(env.DEEPSEEK_API_KEY),
        'import.meta.env.DEEPSEEK_API_KEY': JSON.stringify(env.DEEPSEEK_API_KEY),
        'import.meta.env.VITE_CLAUDE_API_KEY': JSON.stringify(env.CLAUDE_API_KEY),
        'import.meta.env.CLAUDE_API_KEY': JSON.stringify(env.CLAUDE_API_KEY),
        'import.meta.env.VITE_OPENROUTER_API_KEY': JSON.stringify(env.OPENROUTER_API_KEY),
        'import.meta.env.OPENROUTER_API_KEY': JSON.stringify(env.OPENROUTER_API_KEY),
        'import.meta.env.VITE_PIAPI_API_KEY': JSON.stringify(env.PIAPI_API_KEY),
        'import.meta.env.PIAPI_API_KEY': JSON.stringify(env.PIAPI_API_KEY),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        // Optimize for production deployment
        sourcemap: false,
        minify: 'terser',
        chunkSizeWarningLimit: 1000,
        rollupOptions: {
          external: ['epub-gen'], // keep it out of browser bundle
        },
      },
      optimizeDeps: {
        exclude: ['epub-gen'] // don't prebundle node-only lib in the client
      },
      plugins: [
        localFetchProxyPlugin(),
        suttaStudioReportsPlugin(),
      ],
    };
});
