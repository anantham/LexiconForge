# LexiconForge - Deployment Guide

## 🚀 **Vercel Deployment (Recommended)**

### **Quick Deploy**
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/anantham/LexiconForge)

### **Step-by-Step Deployment**

#### **1. Prerequisites**
- GitHub repository pushed to your account
- Vercel account (free tier available)
- API keys for at least one AI provider

#### **2. Connect Repository**
1. Go to [vercel.com](https://vercel.com) and sign in
2. Click "New Project" 
3. Import your LexiconForge repository
4. Framework: **Vite** (auto-detected)
5. Root Directory: `./` (default)

#### **3. Configure Environment Variables**
In Vercel Dashboard → Project → Settings → Environment Variables:

```bash
# Required: At least one AI provider
GEMINI_API_KEY=your_gemini_api_key_here
OPENAI_API_KEY=your_openai_api_key_here  
DEEPSEEK_API_KEY=your_deepseek_api_key_here
```

**Environment Types:**
- Set for: `Production`, `Preview`, `Development`
- This ensures keys work in all environments

#### **4. Deploy**
- Click "Deploy" - Vercel handles the rest automatically
- Build time: ~2-3 minutes
- Your app will be live at: `https://your-project.vercel.app`

### **🔧 Build Configuration**

**Automatic Configuration:**
- Framework: Vite (auto-detected)
- Build Command: `npm run build`
- Output Directory: `dist`
- Install Command: `npm install`

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

## 🔒 **Security Considerations**

### **⚠️ Critical Security Warning**

**Client-Side API Key Exposure:**
- This is a **client-side application**
- API keys are **visible in browser** (dev tools → sources/network)
- Anyone can extract and potentially misuse your keys

### **🛡️ Production Security Best Practices**

#### **1. Separate API Keys**
- **Never use personal/primary API keys in production**
- Create separate, limited-scope keys for public deployment
- Use different keys for development vs. production

#### **2. Set Usage Limits**
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

#### **3. Monitor Usage**
- Set up email alerts for unusual usage spikes
- Regularly check API dashboards for unauthorized usage
- Rotate keys if you notice suspicious activity

#### **4. Rate Limiting (Application Level)**
The app includes built-in rate limiting:
- 6.5 second intervals between API calls
- Automatic retry with exponential backoff
- Cost tracking to prevent runaway usage

### **🏢 Enterprise Deployment Options**

For production environments requiring hidden API keys:

#### **Option 1: Backend Proxy (Recommended)**
```
Frontend (LexiconForge) → Your API Server → AI Providers
```
- Add authentication/authorization
- Hide API keys server-side
- Implement per-user rate limiting
- Add usage analytics

#### **Option 2: Serverless Functions**
```
Frontend → Vercel/Netlify Functions → AI Providers
```
- Environment variables on server-side only
- Per-function rate limiting
- Built-in logging and monitoring

## 🌍 **Alternative Deployment Platforms**

### **Netlify**
1. Connect GitHub repository
2. Build command: `npm run build`
3. Publish directory: `dist`
4. Add environment variables in Site Settings

### **GitHub Pages**
```bash
npm run build
# Deploy dist/ folder to gh-pages branch
```

### **Self-Hosted (Docker)**
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npx", "serve", "dist", "-s", "-l", "3000"]
```

## 🧪 **Testing Deployment**

### **Pre-Deployment Checklist**
- [ ] Test local build: `npm run build && npm run preview`
- [ ] Verify all environment variables are set
- [ ] Test with each AI provider
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
npm install

# Test local build
npm run build

# Check for TypeScript errors
npm run type-check
```

### **Environment Variable Issues**
- Ensure variables are set for correct environment (Production/Preview)
- Check variable names match exactly (case-sensitive)
- Redeploy after adding new variables

### **API Key Problems**
- Verify keys are valid and have correct permissions
- Check API quotas haven't been exceeded
- Ensure keys support the specific models you're using

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

This deployment guide ensures secure, scalable deployment of LexiconForge while maintaining awareness of the security implications of client-side API keys.