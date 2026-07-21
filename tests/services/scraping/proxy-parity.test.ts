/**
 * Contract test for INV-3: Dev/prod proxy parity.
 *
 * The Vite dev proxy and Vercel serverless proxy must enforce the same domain
 * allowlist. Parity is structural — both consumers import the ONE shared module
 * (services/scraping/allowedDomains.cjs) — so this test no longer compares two
 * extracted arrays; it enforces that the structure holds:
 *   1. the shared module exists, exports a sane list, and matches correctly;
 *   2. each consumer references the shared module;
 *   3. neither consumer defines its own ALLOWED_DOMAINS literal (fork guard).
 */

import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { createRequire } from 'module';

const requireCjs = createRequire(import.meta.url);
const root = path.resolve(__dirname, '../../..');
const sharedPath = path.join(root, 'services/scraping/allowedDomains.cjs');

const { ALLOWED_DOMAINS, isDomainAllowed } = requireCjs(sharedPath) as {
  ALLOWED_DOMAINS: string[];
  isDomainAllowed: (hostname: string) => boolean;
};

describe('INV-3: shared proxy domain allowlist', () => {
  it('shared module exports a non-empty, well-formed allowlist', () => {
    expect(ALLOWED_DOMAINS.length).toBeGreaterThan(0);
    for (const d of ALLOWED_DOMAINS) {
      expect(d).toMatch(/^[a-z0-9.-]+$/);
      expect(d).not.toMatch(/^\./);
    }
    // The two domains whose absence from the old "canonical" copy proved drift.
    expect(ALLOWED_DOMAINS).toContain('fojin.app');
    expect(ALLOWED_DOMAINS).toContain('84000.co');
  });

  it('isDomainAllowed matches exact domains and subdomains, not suffix tricks', () => {
    expect(isDomainAllowed('suttacentral.net')).toBe(true);
    expect(isDomainAllowed('www.suttacentral.net')).toBe(true);
    expect(isDomainAllowed('evilsuttacentral.net')).toBe(false);
    expect(isDomainAllowed('suttacentral.net.evil.com')).toBe(false);
  });

  for (const consumer of ['vite.config.ts', 'api/fetch-proxy.js']) {
    it(`${consumer} uses the shared module and defines no fork`, () => {
      const source = fs.readFileSync(path.join(root, consumer), 'utf-8');
      expect(source).toContain('services/scraping/allowedDomains.cjs');
      // Fork guard: an inline literal would silently re-introduce drift.
      expect(source).not.toMatch(/ALLOWED_DOMAINS\s*=\s*\[/);
    });
  }
});
