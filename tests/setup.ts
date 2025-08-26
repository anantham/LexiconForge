// Test setup file
import { beforeEach, vi } from 'vitest'
import * as fakeIndexedDB from 'fake-indexeddb'

// Setup fake-indexeddb
if (typeof window !== 'undefined') {
  globalThis.indexedDB = new fakeIndexedDB.FDBFactory()
}

// Clear localStorage and indexedDB before each test
beforeEach(() => {
  if (typeof window !== 'undefined') {
    localStorage.clear()
    // Clear all databases
    fakeIndexedDB.FDBFactory.clear()
  }
})

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
}