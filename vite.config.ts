import path from 'path';
import fs from 'fs';
import { defineConfig, type Plugin } from 'vite';

/**
 * Plugin: local fetch proxy for scraping.
 * Fetches target URLs server-side (Node.js on the user's machine),
 * bypassing CORS and Cloudflare bot-detection that blocks server IPs.
 * Endpoint: GET /api/fetch-proxy?url=<encoded-url>
 */
// Domain allowlist lives in ONE shared module (INV-3) — same file api/fetch-proxy.js
// requires, so dev and prod proxies cannot drift (structure enforced by proxy-parity.test.ts).
// services/scraping/allowedDomains.cjs is enforced by serverFetchProxy.

import serverFetchProxy from './services/scraping/serverFetchProxy.cjs';

function localFetchProxyPlugin(): Plugin {
  const serve = serverFetchProxy.createFetchProxy({ source: 'local-fetch-proxy' });
  return {
    name: 'local-fetch-proxy',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const reqUrl = req.url || '';
        if (!reqUrl.startsWith('/api/fetch-proxy?')) return next();
        const params = new URL(reqUrl, 'http://localhost').searchParams;
        void serve(req, res, params.get('url'));
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

export default defineConfig({
  server: {
    port: 5180,
    strictPort: true,
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
});
