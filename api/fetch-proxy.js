// Shared policy also used by Vite; services/scraping/allowedDomains.cjs owns the allowlist.
import proxy from '../services/scraping/serverFetchProxy.cjs';

const serve = proxy.createFetchProxy({ source: 'vercel-fetch-proxy' });

export default function handler(req, res) {
  return serve(req, res, req.query?.url);
}
