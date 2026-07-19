// Test setup file
import { beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import '@testing-library/jest-dom';

// Mock Cache API for tests (jsdom doesn't have it)
class MockCache {
  private storage = new Map<string, Response>();

  async match(request: RequestInfo | URL): Promise<Response | undefined> {
    const url = typeof request === 'string' ? request : request instanceof URL ? request.toString() : request.url;
    return this.storage.get(url);
  }

  async put(request: RequestInfo | URL, response: Response): Promise<void> {
    const url = typeof request === 'string' ? request : request instanceof URL ? request.toString() : request.url;
    // Clone response to store it
    const clonedResponse = response.clone();
    this.storage.set(url, clonedResponse);
  }

  async delete(request: RequestInfo | URL): Promise<boolean> {
    const url = typeof request === 'string' ? request : request instanceof URL ? request.toString() : request.url;
    return this.storage.delete(url);
  }

  async keys(): Promise<Request[]> {
    const requests: Request[] = [];
    for (const url of this.storage.keys()) {
      requests.push(new Request(url));
    }
    return requests;
  }
}

class MockCacheStorage {
  private caches = new Map<string, MockCache>();

  async open(cacheName: string): Promise<MockCache> {
    if (!this.caches.has(cacheName)) {
      this.caches.set(cacheName, new MockCache());
    }
    return this.caches.get(cacheName)!;
  }

  async delete(cacheName: string): Promise<boolean> {
    return this.caches.delete(cacheName);
  }

  async has(cacheName: string): Promise<boolean> {
    return this.caches.has(cacheName);
  }

  async keys(): Promise<string[]> {
    return Array.from(this.caches.keys());
  }
}

// Install Cache API mock
if (typeof global.caches === 'undefined') {
  global.caches = new MockCacheStorage() as any;
}

// JSDOM doesn't implement window.matchMedia. Components that use media
// queries (dark-mode detection, responsive helpers) crash without it.
// Stub a minimum viable implementation that always reports "no match".
if (typeof window !== 'undefined' && typeof window.matchMedia === 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(), // deprecated but some libs still call this
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(() => false),
    }),
  });
}

// Clear localStorage before each test. Guard on localStorage ITSELF — in the
// current jsdom build `window` exists while `localStorage` is undefined, and
// guarding only on window made this beforeEach throw, killing every
// jsdom-environment test in setup (the machine-wide "41 failures" of 2026-07).
beforeEach(() => {
  // Node 26's jsdom exposes `window` but not a working `localStorage`
  // (ExperimentalWarning: needs --localstorage-file) — guard both, or every
  // test file dies here in setup regardless of what it tests.
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined' && localStorage) {
    localStorage.clear();
  }
});

// Mock console methods to reduce noise in tests unless specifically testing logging
global.console = {
  ...console,
  log: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
  groupCollapsed: vi.fn(),
  groupEnd: vi.fn(),
};