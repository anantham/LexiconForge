import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Load a VCR cassette fixture from `tests/contracts/cassettes/<name>.json`.
 *
 * These cassettes are "replay-only": no network calls, deterministic outputs.
 */
export function loadCassette<T>(name: string): T {
  if (!name || typeof name !== 'string') {
    throw new Error(`[VCR] loadCassette(name): expected non-empty string, got: ${String(name)}`);
  }

  const normalized = name.endsWith('.json') ? name.slice(0, -'.json'.length) : name;
  const cassettePath = path.resolve(
    process.cwd(),
    'tests',
    'contracts',
    'cassettes',
    `${normalized}.json`,
  );

  try {
    const raw = readFileSync(cassettePath, 'utf-8');
    return JSON.parse(raw) as T;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`[VCR] Failed to load cassette "${normalized}" (${cassettePath}): ${msg}`);
  }
}
