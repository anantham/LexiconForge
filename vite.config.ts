import path from 'path';
import { defineConfig, loadEnv } from 'vite';

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
        'process.env.PIAPI_API_KEY': JSON.stringify(env.PIAPI_API_KEY)
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
      }
    };
});
