import path from 'path';
import fs from 'fs';
import { defineConfig, type Plugin } from 'vite';
import { createRequire } from 'node:module';
import { findReportPacket, isSafeReportId } from './scripts/lib/dev-report-paths';

/**
 * Plugin: local fetch proxy for scraping.
 * Fetches target URLs server-side (Node.js on the user's machine),
 * bypassing CORS and Cloudflare bot-detection that blocks server IPs.
 * Endpoint: GET /api/fetch-proxy?url=<encoded-url>
 */
// Domain allowlist lives in ONE shared module (INV-3) — same file api/fetch-proxy.js
// requires, so dev and prod proxies cannot drift (structure enforced by proxy-parity.test.ts).
// services/scraping/allowedDomains.cjs is enforced by serverFetchProxy.

// Load the Node-only policy without bundling its built-in requires into ESM.
const requireFromConfig = createRequire(path.join(__dirname, 'vite.config.ts'));
const serverFetchProxy = requireFromConfig('./services/scraping/serverFetchProxy.cjs') as typeof import('./services/scraping/serverFetchProxy.cjs');

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
export function suttaStudioReportsPlugin(
  reportsDir = path.resolve(__dirname, 'reports/sutta-studio')
): Plugin {

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
              .filter((e) => e.isDirectory() && isSafeReportId(e.name))
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
          if (!isSafeReportId(reportId)) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid report ID' }));
            return;
          }

          try {
            const finalPath = findReportPacket(reportsDir, reportId);
            if (!finalPath) {
              res.writeHead(404, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Packet not found' }));
              return;
            }
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
    host: '127.0.0.1',
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
