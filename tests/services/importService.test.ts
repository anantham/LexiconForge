import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ImportService } from '../../services/importService';
import type { SessionData } from '../../types/session';
import { useAppStore } from '../../store';

// Mock the store
const mockSetSessionProvenance = vi.fn();
const mockSetSessionVersion = vi.fn();
const mockImportSessionData = vi.fn().mockResolvedValue(undefined);

vi.mock('../../store', () => ({
  useAppStore: {
    getState: vi.fn(() => ({
      importSessionData: mockImportSessionData,
      setSessionProvenance: mockSetSessionProvenance,
      setSessionVersion: mockSetSessionVersion
    })),
    setState: vi.fn()
  }
}));

// Polyfill Blob.text() for Node environment
if (!Blob.prototype.text) {
  Blob.prototype.text = async function() {
    const reader = new FileReader();
    return new Promise((resolve, reject) => {
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsText(this);
    });
  };
}

// Helper to create a mock ReadableStream
function createMockReadableStream(data: any) {
  const jsonString = JSON.stringify(data);
  const encoder = new TextEncoder();
  const bytes = encoder.encode(jsonString);

  return new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    }
  });
}

describe('ImportService', () => {
  beforeEach(() => {
    mockSetSessionProvenance.mockClear();
    mockSetSessionVersion.mockClear();
    mockImportSessionData.mockClear();
  });

  it('should extract provenance from session data', async () => {
    const mockSessionData: SessionData = {
      metadata: {
        format: 'lexiconforge-session',
        version: '2.0',
        exportedAt: '2025-01-19T10:00:00Z'
      },
      novel: {
        id: 'test-novel',
        title: 'Test Novel'
      },
      version: {
        versionId: 'test-v1',
        displayName: 'Test Version',
        style: 'faithful',
        features: ['footnotes']
      },
      provenance: {
        originalCreator: {
          name: 'Alice',
          versionId: 'alice-v1',
          createdAt: '2025-01-01T00:00:00Z'
        },
        contributors: [
          { name: 'Alice', role: 'original-translator', dateRange: '2025-01-01' }
        ]
      },
      chapters: [],
      settings: {}
    };

    const jsonString = JSON.stringify(mockSessionData);
    const contentLength = new TextEncoder().encode(jsonString).length;

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({
        'content-length': contentLength.toString()
      }),
      body: createMockReadableStream(mockSessionData)
    });

    const result = await ImportService.importFromUrl('https://example.com/session.json');

    // Verify provenance is returned
    expect(result.provenance).toBeDefined();
    expect(result.provenance.originalCreator.name).toBe('Alice');

    // Verify store methods were called
    expect(mockSetSessionProvenance).toHaveBeenCalledWith(mockSessionData.provenance);
    expect(mockSetSessionVersion).toHaveBeenCalledWith(mockSessionData.version);
  });

  it('should handle sessions without provenance (legacy)', async () => {
    const legacySession = {
      metadata: {
        format: 'lexiconforge-session',
        version: '1.0'
      },
      chapters: []
    };

    const jsonString = JSON.stringify(legacySession);
    const contentLength = new TextEncoder().encode(jsonString).length;

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({
        'content-length': contentLength.toString()
      }),
      body: createMockReadableStream(legacySession)
    });

    const result = await ImportService.importFromUrl('https://example.com/legacy.json');

    // Verify no provenance
    expect(result.provenance).toBeUndefined();

    // Verify store methods were NOT called
    expect(mockSetSessionProvenance).not.toHaveBeenCalled();
    expect(mockSetSessionVersion).not.toHaveBeenCalled();
  });

  it('should import BookToki scrape JSON by converting it to lexiconforge-full-1', async () => {
    const bookTokiPayload = {
      metadata: {
        source: 'booktoki468.com',
        scrapeDate: '2025-08-14T00:00:00Z',
        totalChapters: 1,
        scraper: 'BookToki Chrome Extension',
        version: '1.0',
        sessionStartTime: '2025-08-14T00:00:00Z',
      },
      chapters: [
        {
          chapterNumber: 1,
          title: '던전 디펜스-1화',
          url: 'https://booktoki468.com/novel/3913764',
          content: '테스트 콘텐츠',
          timestamp: '2025-08-14T00:00:00Z',
          koreanCount: 6,
          paragraphCount: 1,
        },
      ],
    };

    const file = new File([JSON.stringify(bookTokiPayload)], 'booktoki.json', {
      type: 'application/json',
    });

    const result = await ImportService.importFromFile(file);

    expect(mockImportSessionData).toHaveBeenCalledTimes(1);
    const importedArg = mockImportSessionData.mock.calls[0][0];
    expect(importedArg?.metadata?.format).toBe('lexiconforge-full-1');
    expect(importedArg?.chapters).toHaveLength(1);
    expect(importedArg?.chapters?.[0]?.canonicalUrl).toContain('booktoki468.com/novel/3913764');

    // ImportService returns the converted payload
    expect(result?.metadata?.format).toBe('lexiconforge-full-1');
  });
});
