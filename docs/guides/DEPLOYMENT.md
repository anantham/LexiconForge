# LexiconForge - Deployment Guide

## 🚀 **Vercel Deployment (Recommended)**

### **Quick Deploy**
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/anantham/LexiconForge)

### **Step-by-Step Deployment**

#### **1. Prerequisites**
- GitHub repository pushed to your account
- Vercel account (free tier available)

#### **2. Connect Repository**
1. Go to [vercel.com](https://vercel.com) and sign in
2. Click "New Project" 
3. Import your LexiconForge repository
4. Framework: **Vite** (auto-detected)
5. Root Directory: `./` (default)

#### **3. Configure Environment Variables**
No AI-provider credential is required for the browser deployment. Users bring their own keys through **Settings -> API Keys**.

Do not add Gemini, OpenAI, DeepSeek, Claude, OpenRouter, or PiAPI credentials to Vercel's project environment. Do not use `VITE_` provider-key variables. Vite client variables and previous build-time `define` values are downloadable by every visitor.

`VITE_DB_BACKEND` is the only supported optional browser build variable. It is public configuration, not a credential; omit it to use the modern IndexedDB backend.

#### **4. Deploy**
- Click "Deploy" - Vercel handles the rest automatically
- Build time: ~2-3 minutes
- Your app will be live at: `https://your-project.vercel.app`

### **🔧 Build Configuration**

**Automatic Configuration:**
- Framework: Vite (auto-detected)
- Build Command: `npm run build`
- Output Directory: `dist`
- Install Command: `npm ci`

**Custom Configuration (vercel.json):**
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist", 
  "framework": "vite",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

### **Client Telemetry Callback Proof**

This repo now includes a minimal Vercel function proof at `api/client-telemetry.js`.

- Route: `POST /api/client-telemetry`
- Purpose: validate that this Vite deployment can accept best-effort client telemetry callbacks before broader telemetry plumbing lands
- Current behavior:
  - accepts JSON payloads up to 16 KB
  - requires `event_type`
  - logs a normalized summary to the function log
  - returns `200 { ok: true }` on success
- Verification status:
  - `vercel build` recognizes the function and emits `.vercel/output`
  - a deployed proof was exercised with `vercel curl`, returning `405 {"ok":false,"error":"Method not allowed. Use POST."}` for GET and `200 {"ok":true,...}` for POST
  - the current Vite catch-all rewrite did not shadow `/api/client-telemetry`, so this setup does not currently need an explicit `/api/*` rewrite exemption

Client telemetry should remain best-effort only:
- callback failures must never degrade the reader UX
- if the callback POST fails, the client should drop the payload silently

## 🔒 **Security Considerations**

### **Credential Boundary**

- LexiconForge is a client-side, bring-your-own-key application.
- Each user enters credentials in Settings; those values remain in that browser's local settings and are sent to the provider selected for a request.
- Never ship an operator-owned or shared provider key in JavaScript, HTML, static assets, or public runtime configuration.
- Client-side throttles and counters are UX controls, not security controls. A visitor can bypass them.
- CI builds with synthetic canaries and rejects provider-shaped credentials in `dist/`.

### **🛡️ Production Security Best Practices**

#### **1. Keep Provider Keys Out of Deployment Configuration**
- Remove provider credentials from Vercel, Netlify, and other client build environments.
- Run `npm run build && npm run security:scan-client` before publishing static artifacts.
- Rotate a key immediately if it has appeared in a deployed artifact or shared log.

#### **2. Encourage User-Owned Limits**
**Google Gemini:**
- Go to [Google Cloud Console](https://console.cloud.google.com)
- Set daily/monthly quotas
- Enable billing alerts

**OpenAI:**
- Go to [OpenAI Platform](https://platform.openai.com/usage)
- Set usage limits in "Limits & Billing"
- Enable usage notifications

**DeepSeek:**
- Check [DeepSeek Console](https://platform.deepseek.com)
- Set up balance alerts
- Monitor usage patterns

#### **3. Monitor Provider Usage**
- Set up email alerts for unusual usage spikes
- Regularly check API dashboards for unauthorized usage
- Rotate keys if you notice suspicious activity

#### **4. Application-Level Pacing**
The app includes request pacing for reliability and cost feedback:
- 6.5 second intervals between API calls
- Automatic retry with exponential backoff
- Cost tracking to prevent runaway usage

These controls do not protect a shared key because they execute in code controlled by the visitor.

### **🏢 Enterprise Deployment Options**

For production environments requiring hidden API keys:

#### **Option 1: Backend Proxy (Recommended)**
```
Frontend (LexiconForge) → Your API Server → AI Providers
```
- Add authentication/authorization
- Hide API keys server-side
- Implement fail-closed per-user rate limiting and cumulative spend caps
- Add usage analytics

#### **Option 2: Serverless Functions**
```
Frontend → Vercel/Netlify Functions → AI Providers
```
- Environment variables on server-side only
- Authentication, authorization, and per-user rate limiting
- Built-in logging and monitoring

The current repository does not implement a shared-key broker. Do not treat Vercel project variables as server-only when the Vite build reads them.

## 🌍 **Alternative Deployment Platforms**

### **Netlify**
1. Connect GitHub repository
2. Build command: `npm run build`
3. Publish directory: `dist`
4. Leave provider credentials out of Site Settings

### **GitHub Pages**
```bash
npm run build
# Deploy dist/ folder to gh-pages branch
```

### **Self-Hosted (Docker)**
```dockerfile
FROM node:24-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npx", "serve", "dist", "-s", "-l", "3000"]
```

## 🧪 **Testing Deployment**

### **Pre-Deployment Checklist**
- [ ] Run `npm run typecheck` and `npm run lint`
- [ ] Run `npm run build && npm run security:scan-client`
- [ ] Verify no provider credentials are configured in the client deployment
- [ ] Test provider flows with a disposable user-owned key entered through Settings
- [ ] Check mobile responsiveness
- [ ] Verify error handling for missing API keys

### **Post-Deployment Validation**
- [ ] Test novel URL fetching
- [ ] Verify translations work for each provider
- [ ] Check temperature control functionality
- [ ] Validate session persistence
- [ ] Monitor initial API usage

### **Performance Monitoring**
- Vercel Analytics (automatic)
- API usage dashboards
- Error tracking (Sentry integration possible)

## 🔄 **Continuous Deployment**

### **Automatic Deployments**
Vercel automatically deploys on:
- Push to `main` branch (production)
- Pull requests (preview deployments)
- Custom branch rules (configurable)

### **Environment-Specific Deployments**
- **Production**: `main` branch → production environment
- **Staging**: `develop` branch → preview environment  
- **Feature**: Feature branches → preview deployments

## 🚨 **Common Issues & Solutions**

### **Build Failures**
```bash
# Install dependencies
npm ci

# Test local build
npm run build

# Check for TypeScript errors
npm run typecheck
```

### **Environment Variable Issues**
- Provider credentials are not supported as client environment variables.
- Check [EnvVars.md](./EnvVars.md) before adding public build configuration.
- Redeploy after changing supported public configuration.

### **API Key Problems**
- Verify keys are valid and have correct permissions
- Check API quotas haven't been exceeded
- Ensure keys support the specific models you're using
- Re-enter the key in Settings; do not add it to Vercel or `.env.local`

### **Runtime Errors**
- Check Vercel function logs for server-side errors
- Use browser dev tools to debug client-side issues
- Monitor network tab for failed API calls

## 📊 **Cost Management**

### **Estimated Costs (per 1000 chapters)**
- **GPT-5**: ~$15-30 (depending on chapter length)
- **Gemini 2.5 Flash**: ~$3-6
- **DeepSeek**: ~$1-3

### **Cost Optimization**
- Use Gemini 2.5 Flash for development/testing (cheaper)
- Reserve GPT-5 for final translations
- Implement user authentication to prevent abuse
- Set strict usage quotas per user

This deployment model keeps operator credentials out of public artifacts. Users remain responsible for the provider keys they enter locally; a future shared-credit product must use a separately reviewed server-side boundary.
