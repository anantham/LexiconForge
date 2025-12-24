import { describe, it, expect } from 'vitest';
import { getSupportedSiteInfo, isUrlSupported } from '../../services/adapters';

describe('BookToki adapter wiring', () => {
  it('treats BookToki URLs as supported', () => {
    expect(isUrlSupported('https://booktoki468.com/novel/3913764')).toBe(true);
  });

  it('includes BookToki in the supported sites list', () => {
    const sites = getSupportedSiteInfo();
    const bookToki = sites.find((site) => site.domain === 'booktoki468.com');
    expect(bookToki).toBeDefined();
    expect(bookToki?.example).toContain('booktoki468.com');
  });
});

