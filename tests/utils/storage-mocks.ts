// Storage mocking utilities for testing localStorage behavior
import { vi } from 'vitest';

/**
 * MOTIVATION: We need to test localStorage behavior without actually writing to the browser's storage
 * 
 * Why this matters:
 * - Tests should be isolated and not affect each other
 * - We need to simulate storage failures and edge cases
 * - We need to verify exactly what data gets stored and retrieved
 * - Tests should run fast without actual disk I/O
 */

export interface MockStorage {
  data: Record<string, string>;
  getItem: ReturnType<typeof vi.fn>;
  setItem: ReturnType<typeof vi.fn>;
  removeItem: ReturnType<typeof vi.fn>;
  clear: ReturnType<typeof vi.fn>;
  key: ReturnType<typeof vi.fn>;
  length: number;
}

export const createMockStorage = (initialData: Record<string, string> = {}): MockStorage => {
  const data = { ...initialData };
  
  const storage: MockStorage = {
    data,
    
    getItem: vi.fn((key: string) => {
      return data[key] || null;
    }),
    
    setItem: vi.fn((key: string, value: string) => {
      data[key] = value;
    }),
    
    removeItem: vi.fn((key: string) => {
      delete data[key];
    }),
    
    clear: vi.fn(() => {
      Object.keys(data).forEach(key => delete data[key]);
    }),
    
    key: vi.fn((index: number) => {
      const keys = Object.keys(data);
      return keys[index] || null;
    }),
    
    get length() {
      return Object.keys(data).length;
    },
  };
  
  return storage;
};

/**
 * MOTIVATION: Test storage quota exceeded scenarios
 * 
 * localStorage has size limits (~5-10MB), and users with many translations could hit this.
 * We need to test that the app handles storage failures gracefully.
 */
export const createQuotaExceededStorage = (): MockStorage => {
  const storage = createMockStorage();
  
  storage.setItem.mockImplementation((key: string, value: string) => {
    // Simulate quota exceeded after storing some data
    if (storage.length > 5) {
      const error = new Error('QuotaExceededError');
      error.name = 'QuotaExceededError';
      throw error;
    }
    storage.data[key] = value;
  });
  
  return storage;
};

/**
 * MOTIVATION: Test corrupted localStorage data scenarios
 * 
 * Sometimes localStorage data gets corrupted (browser crashes, extensions, etc.)
 * The app should handle this gracefully instead of crashing.
 */
export const createCorruptedStorage = (): MockStorage => {
  const storage = createMockStorage();
  
  storage.getItem.mockImplementation((key: string) => {
    if (key === 'novel-translator-storage-v2') {
      return '{"corrupted": json}'; // Invalid JSON
    }
    return storage.data[key] || null;
  });
  
  return storage;
};

/**
 * MOTIVATION: Test storage with existing user data
 * 
 * When we migrate to IndexedDB, we need to ensure existing user data is preserved.
 * This mock simulates a real user's localStorage with translations.
 */
export const createPopulatedStorage = (): MockStorage => {
  const existingData = {
    'novel-translator-storage-v2': JSON.stringify({
      sessionData: {
        'https://kakuyomu.jp/works/16816927859418072361/episodes/16818093085877625597': {
          chapter: {
            title: '第一話　最強の陰陽師、言い逃れる',
            content: '「君――――魔王なんだって？」...',
            originalUrl: 'https://kakuyomu.jp/works/16816927859418072361/episodes/16818093085877625597',
            nextUrl: 'https://kakuyomu.jp/works/16816927859418072361/episodes/16818093085877625598',
            prevUrl: null,
          },
          translationResult: {
            translatedTitle: 'Chapter 1: The Strongest Exorcist Makes Excuses',
            translation: '"You——are the Demon King, aren\'t you?"...',
            proposal: null,
            footnotes: [],
            suggestedIllustrations: [],
            usageMetrics: {
              totalTokens: 2500,
              promptTokens: 1800,
              completionTokens: 700,
              estimatedCost: 0.00858,
              requestTime: 59.26,
              provider: 'Gemini',
              model: 'gemini-2.5-flash',
            },
          },
        },
      },
      urlHistory: ['https://kakuyomu.jp/works/16816927859418072361/episodes/16818093085877625597'],
      feedbackHistory: {},
      settings: {
        contextDepth: 2,
        preloadCount: 0,
        fontSize: 18,
        fontStyle: 'serif',
        lineHeight: 1.7,
        systemPrompt: 'You are a translator...',
        provider: 'Gemini',
        model: 'gemini-2.5-flash',
        temperature: 0.3,
        apiKeyGemini: 'test-key-123',
      },
      proxyScores: {},
    }),
  };
  
  return createMockStorage(existingData);
};

/**
 * MOTIVATION: Test slow storage operations
 * 
 * On some devices, localStorage operations can be slow.
 * We need to ensure the UI remains responsive during storage operations.
 */
export const createSlowStorage = (delayMs: number = 100): MockStorage => {
  const storage = createMockStorage();
  
  const addDelay = (originalFn: Function) => {
    return vi.fn(async (...args: any[]) => {
      await new Promise(resolve => setTimeout(resolve, delayMs));
      return originalFn.apply(storage, args);
    });
  };
  
  storage.getItem = addDelay(storage.getItem);
  storage.setItem = addDelay(storage.setItem);
  
  return storage;
};

/**
 * MOTIVATION: Simulate browser security restrictions
 * 
 * Some browsers or privacy modes disable localStorage entirely.
 * The app should detect this and show appropriate error messages.
 */
export const createRestrictedStorage = (): MockStorage => {
  const storage = createMockStorage();
  
  storage.getItem.mockImplementation(() => {
    throw new Error('localStorage is not available');
  });
  
  storage.setItem.mockImplementation(() => {
    throw new Error('localStorage is not available');
  });
  
  return storage;
};

/**
 * Utility to apply a storage mock globally for testing
 */
export const applyStorageMock = (storageMock: MockStorage) => {
  Object.defineProperty(window, 'localStorage', {
    value: storageMock,
    writable: true,
  });
  
  return storageMock;
};