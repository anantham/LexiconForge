# Environment Variables

LexiconForge is a client-first Vite application. Every `VITE_` variable is public browser configuration and may be serialized into downloadable JavaScript. Never put an AI-provider credential in a `VITE_` variable or in a client deployment's build environment.

## Browser Configuration

- `VITE_DB_BACKEND` (optional): `modern` (default) or `memory`. This is a public behavior switch, not a secret.

Provider credentials are not environment variables. Users add Gemini, OpenAI, DeepSeek, Claude, OpenRouter, and PiAPI keys in **Settings -> API Keys**. The browser keeps those values in the user's local settings and sends them only to the selected provider.

## Node-Only Scripts

- `OPENROUTER_API_KEY`: used by paid benchmark and curation scripts executed under Node.

Load Node-only values explicitly when running a script, for example:

```bash
npx tsx --env-file=.env.local scripts/sutta-studio/benchmark.ts
```

Do not rename a Node-only credential with a `VITE_` prefix. Do not configure it in Vercel for the browser build.

## OpenRouter Headers

`config/app.json` defines the public `openrouter.referer` and `openrouter.title` headers used for browser requests.

## Release Gate

CI builds with synthetic credential canaries and then runs `npm run security:scan-client`. A release fails if a canary or a provider-shaped credential appears in `dist/`.

Shared or subsidized access requires an authenticated server-side broker with server-side authorization, rate limiting, and spend controls. A key embedded in a Vite bundle cannot be protected by client-side request limits.
