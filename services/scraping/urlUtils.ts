/**
 * URL validation and supported-site utilities.
 */

import { SUPPORTED_WEBSITES } from '../../config/constants';

/**
 * Check if a URL is supported by any scraping adapter.
 */
export const isUrlSupported = (url: string): boolean => {
  try {
    return SUPPORTED_WEBSITES.some((site) => url.includes(site));
  } catch {
    return false;
  }
};

export interface SupportedSiteInfo {
  domain: string;
  example: string;
  status: 'active';
}

/**
 * Get metadata for all supported sites.
 */
export const getSupportedSiteInfo = (): SupportedSiteInfo[] => {
  return SUPPORTED_WEBSITES.map((site) => ({
    domain: site,
    example: getExampleUrl(site),
    status: 'active' as const,
  }));
};

const getExampleUrl = (domain: string): string => {
  const examples: Record<string, string> = {
    'kakuyomu.jp': 'https://kakuyomu.jp/works/1234567890/episodes/1',
    'dxmwx.org': 'https://www.dxmwx.org/chapter/12345',
    'kanunu8.com': 'https://www.kanunu8.com/book/12345/123456.html',
    'novelcool.com': 'https://www.novelcool.com/chapter/Novel-Name-Chapter-1/12345',
    'ncode.syosetu.com': 'https://ncode.syosetu.com/n1234ab/1/',
    'booktoki468.com': 'https://booktoki468.com/novel/3913764',
    'suttacentral.net': 'https://suttacentral.net/mn10/en/sujato',
  };
  return examples[domain] || `https://${domain}/example-chapter-url`;
};
