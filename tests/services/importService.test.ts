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
});
