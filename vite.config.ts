import path from 'path';
import fs from 'fs';
import { defineConfig, loadEnv, type Plugin } from 'vite';

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
        suttaStudioReportsPlugin(),
      ],
    };
});
