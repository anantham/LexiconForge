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

// Clear localStorage before each test
beforeEach(() => {
  if (typeof window !== 'undefined') {
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