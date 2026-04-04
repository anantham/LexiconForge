import { isUrlSupported, getSupportedSiteInfo } from '../scraping/urlUtils';
import type { SupportedSiteInfo } from '../scraping/urlUtils';

export const validateNavigation = (
  url: string
): { valid: true } | { error: string; supportedSites: SupportedSiteInfo[] } => {
  if (!isUrlSupported(url)) {
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname;
      const supportedSites = getSupportedSiteInfo();

      const errorMessage = `${domain} is not currently supported.

Currently supported sites:
${supportedSites.map(s => `• ${s.domain} (example: ${s.example})`).join('\n')}

Want this site added? Please file an issue with:
• The site URL you're trying to use
• Example chapter links from the site
• Site name and description

This helps us prioritize which sites to support next.`;

      return { error: errorMessage, supportedSites };
    } catch {
      const supportedSites = getSupportedSiteInfo();
      return {
        error: `Invalid URL format. Please provide a valid URL from one of these supported sites:\n${supportedSites.map(s => s.domain).join(', ')}`,
        supportedSites
      };
    }
  }
  return { valid: true };
};
