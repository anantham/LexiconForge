// Test setup file
import { beforeEach } from 'vitest'

// Clear localStorage before each test
beforeEach(() => {
  localStorage.clear()
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