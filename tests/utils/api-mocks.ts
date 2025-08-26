// API mocking utilities for provider testing
import { vi } from 'vitest';
import { MOCK_API_RESPONSES, createMockTranslationResult } from './test-data';

// Mock localStorage for testing
export const mockLocalStorage = () => {
  const store: Record<string, string> = {};
  
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      Object.keys(store).forEach(key => delete store[key]);
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] || null),
  };
};

// Mock window.fetch for API calls
export const mockFetch = () => {
  return vi.fn().mockImplementation((url: string, options?: RequestInit) => {
    const body = options?.body as string;
    
    // Parse request to determine provider and response
    if (url.includes('generativelanguage.googleapis.com')) {
      // Differentiate between translation and image generation
      if (url.includes(':generateImages')) {
        return Promise.resolve(new Response(
          JSON.stringify(MOCK_API_RESPONSES.image.success),
          { status: 200 }
        ));
      } else {
        return mockGeminiResponse(body);
      }
    } else if (url.includes('api.openai.com')) {
      return mockOpenAIResponse(body);  
    } else if (url.includes('api.deepseek.com')) {
      return mockDeepSeekResponse(body);
    }
    
    // Default to 404 for unknown URLs
    return Promise.resolve(new Response(null, { status: 404 }));
  });
};

const mockGeminiResponse = (body: string) => {
  try {
    const request = JSON.parse(body);
    
    // Simulate rate limit error
    if (request.contents?.[0]?.parts?.[0]?.text?.includes('rate-limit-test')) {
      return Promise.resolve(new Response(
        JSON.stringify(MOCK_API_RESPONSES.gemini.error),
        { status: 429 }
      ));
    }
    
    // Simulate network error  
    if (request.contents?.[0]?.parts?.[0]?.text?.includes('network-error-test')) {
      return Promise.reject(new Error('Network error'));
    }
    
    // Success response
    return Promise.resolve(new Response(
      JSON.stringify(MOCK_API_RESPONSES.gemini.success),
      { status: 200 }
    ));
  } catch (error) {
    return Promise.resolve(new Response(null, { status: 400 }));
  }
};

const mockOpenAIResponse = (body: string) => {
  try {
    const request = JSON.parse(body);
    
    // Test temperature fallback
    if (request.temperature && request.temperature !== 1.0) {
      return Promise.resolve(new Response(
        JSON.stringify({
          error: {
            code: 'invalid_request_error',
            message: `Unsupported value: 'temperature' does not support ${request.temperature} with this model. Only the default (1) value is supported.`,
          },
        }),
        { status: 400 }
      ));
    }
    
    // Test rate limiting
    if (request.messages?.[0]?.content?.includes('rate-limit-test')) {
      return Promise.resolve(new Response(
        JSON.stringify(MOCK_API_RESPONSES.openai.error),
        { status: 429 }
      ));
    }
    
    // Success response
    return Promise.resolve(new Response(
      JSON.stringify(MOCK_API_RESPONSES.openai.success),
      { status: 200 }
    ));
  } catch (error) {
    return Promise.resolve(new Response(null, { status: 400 }));
  }
};

const mockDeepSeekResponse = (body: string) => {
  try {
    const request = JSON.parse(body);
    
    // Test API key validation
    if (!request.model || !body) {
      return Promise.resolve(new Response(
        JSON.stringify({ error: 'Invalid request' }),
        { status: 400 }
      ));
    }
    
    return Promise.resolve(new Response(
      JSON.stringify(MOCK_API_RESPONSES.deepseek.success),
      { status: 200 }
    ));
  } catch (error) {
    return Promise.resolve(new Response(null, { status: 400 }));
  }
};

// Mock the HTML parsing for chapter fetching
export const mockChapterHtml = {
  kakuyomu: `
    <!DOCTYPE html>
    <html>
      <head>
        <title>第一話　最強の陰陽師、言い逃れる - カクヨム</title>
      </head>
      <body>
        <h1 class="widget-episodeTitle">第一話　最強の陰陽師、言い逃れる</h1>
        <div class="widget-episodeBody">
          <p>「君――――魔王なんだって？」</p>
          <p>　皇帝ジルゼリウスが放ったその言葉を、ぼくは立ち尽くしたまま聞いていた。</p>
        </div>
        <nav class="widget-episodeNavigation">
          <a href="https://kakuyomu.jp/works/16816927859418072361/episodes/16818093085877625596" class="prevLink">前のエピソード</a>
          <a href="https://kakuyomu.jp/works/16816927859418072361/episodes/16818093085877625598" class="nextLink">次のエピソード</a>
        </nav>
      </body>
    </html>
  `,
  
  kakuyomuNoNext: `
    <!DOCTYPE html>
    <html>
      <head>
        <title>最終話　完結 - カクヨム</title>
      </head>
      <body>
        <h1 class="widget-episodeTitle">最終話　完結</h1>
        <div class="widget-episodeBody">
          <p>これで物語は終わりです。</p>
        </div>
        <nav class="widget-episodeNavigation">
          <a href="https://kakuyomu.jp/works/16816927859418072361/episodes/16818093085877625596" class="prevLink">前のエピソード</a>
        </nav>
      </body>
    </html>
  `,
  
  invalidHtml: '<html><body>Invalid chapter content</body></html>',
  
  networkError: null, // Simulates network failure
};

// Mock fetch for chapter content
export const mockChapterFetch = () => {
  return vi.fn().mockImplementation((url: string) => {
    if (url.includes('16818093085877625597')) {
      return Promise.resolve(new Response(mockChapterHtml.kakuyomu, { status: 200 }));
    } else if (url.includes('16818093085877625999')) {
      return Promise.resolve(new Response(mockChapterHtml.kakuyomuNoNext, { status: 200 }));
    } else if (url.includes('invalid-url')) {
      return Promise.resolve(new Response(mockChapterHtml.invalidHtml, { status: 404 }));
    } else if (url.includes('network-error')) {
      return Promise.reject(new Error('Network error'));
    }
    
    // Default success for most URLs
    return Promise.resolve(new Response(mockChapterHtml.kakuyomu, { status: 200 }));
  });
};

// Mock AbortController for translation cancellation testing
export const mockAbortController = () => {
  const mockController = {
    signal: { aborted: false },
    abort: vi.fn(() => {
      mockController.signal.aborted = true;
    }),
  };
  
  global.AbortController = vi.fn(() => mockController) as any;
  
  return mockController;
};

// Utility to setup all mocks for a test
export const setupAllMocks = () => {
  const localStorage = mockLocalStorage();
  const fetch = mockFetch();
  const chapterFetch = mockChapterFetch();
  const abortController = mockAbortController();
  
  global.localStorage = localStorage as any;
  global.fetch = fetch as any;
  
  return {
    localStorage,
    fetch,
    chapterFetch,
    abortController,
  };
};

// Clean up all mocks after tests  
export const cleanupMocks = () => {
  vi.clearAllMocks();
  vi.resetAllMocks();
  vi.restoreAllMocks();
};