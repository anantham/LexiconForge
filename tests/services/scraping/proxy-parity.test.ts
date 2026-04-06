/**
 * Contract test for INV-3: Dev/prod proxy parity.
 *
 * The Vite dev proxy and Vercel serverless proxy must enforce the same
 * domain allowlist. If a request is allowed in dev but blocked in prod
 * (or vice versa), that's a bug.
 *
 * This test extracts the allowlist from both files and compares them.
 * It should FAIL on current main because the dev proxy has no allowlist.
 */

import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

function extractAllowlistFromFile(filePath: string): string[] | null {
  const source = fs.readFileSync(filePath, 'utf-8');

  // Look for ALLOWED_DOMAINS array
  const match = source.match(/ALLOWED_DOMAINS\s*=\s*\[([\s\S]*?)\]/);
  if (!match) return null;

  const domains = match[1]
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.startsWith("'") || line.startsWith('"'))
    .map(line => {
      const domainMatch = line.match(/['"]([^'"]+)['"]/);
      return domainMatch ? domainMatch[1] : null;
    })
    .filter(Boolean) as string[];

  return domains.length > 0 ? domains.sort() : null;
}

describe('INV-3: Dev/prod proxy domain allowlist parity', () => {
  const prodProxyPath = path.resolve(__dirname, '../../../api/fetch-proxy.js');
  const viteConfigPath = path.resolve(__dirname, '../../../vite.config.ts');

  it('prod proxy (api/fetch-proxy.js) should have an ALLOWED_DOMAINS list', () => {
    const domains = extractAllowlistFromFile(prodProxyPath);
    expect(domains).not.toBeNull();
    expect(domains!.length).toBeGreaterThan(0);
  });

  it('dev proxy (vite.config.ts) should have an ALLOWED_DOMAINS list', () => {
    // On current main this will FAIL — the dev proxy has no allowlist.
    const viteSource = fs.readFileSync(viteConfigPath, 'utf-8');

    // Check if vite.config.ts contains any domain validation
    const hasDomainCheck =
      viteSource.includes('ALLOWED_DOMAINS') ||
      viteSource.includes('isDomainAllowed') ||
      viteSource.includes('allowlist');

    expect(hasDomainCheck).toBe(true);
  });

  it('dev and prod allowlists should contain the same domains', () => {
    const prodDomains = extractAllowlistFromFile(prodProxyPath);
    expect(prodDomains).not.toBeNull();

    const viteSource = fs.readFileSync(viteConfigPath, 'utf-8');

    // Try to extract from vite config — may use shared import or inline
    const viteDomains = extractAllowlistFromFile(viteConfigPath);

    // If vite has no extractable allowlist, the test fails (proving the gap)
    expect(viteDomains).not.toBeNull();

    // If both exist, they must match
    if (prodDomains && viteDomains) {
      expect(viteDomains).toEqual(prodDomains);
    }
  });
});
