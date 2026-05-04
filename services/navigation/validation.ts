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

      return {
        error: `${domain} is not currently supported. See the list of supported sites above.`,
        supportedSites,
      };
    } catch {
      const supportedSites = getSupportedSiteInfo();
      return {
        error: 'Invalid URL format. See the list of supported sites above.',
        supportedSites,
      };
    }
  }
  return { valid: true };
};
