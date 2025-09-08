# Environment Variables

LexiconForge is a client‑first app built with Vite. Variables prefixed with `VITE_` are exposed to the browser.

## Core API Keys

- `VITE_GEMINI_API_KEY`
- `VITE_OPENAI_API_KEY`
- `VITE_DEEPSEEK_API_KEY`
- `VITE_CLAUDE_API_KEY`
- `VITE_OPENROUTER_API_KEY`
- `VITE_PIAPI_API_KEY` (PiAPI for Flux images and audio)

Set in `.env.local` for local dev or in Vercel Project → Settings → Environment Variables (Development/Preview/Production).

## OpenRouter Headers

- `config/app.json` includes `openrouter.referer` and `openrouter.title`. These are sent as headers when using OpenRouter.

## Precedence

- Settings UI values override empty envs at runtime where applicable.
- Some services read directly from env (build‑time); prefer setting both when in doubt.

## Security Note

- Client apps expose keys in the browser. See `DEPLOYMENT.md` for mitigation (proxies, serverless, quotas, rotation).

