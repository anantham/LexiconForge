import { describe, it, expect } from 'vitest';
import type { SessionMetadata, SessionVersion, SessionProvenance } from './session';

describe('Session Types', () => {
  it('should accept session metadata with format version', () => {
    const metadata: SessionMetadata = {
      format: 'lexiconforge-session',
      version: '2.0',
      exportedAt: '2025-01-19T10:30:00Z'
    };

    expect(metadata.version).toBe('2.0');
  });

  it('should accept session version info', () => {
    const version: SessionVersion = {
      versionId: 'alice-v1',
      displayName: 'Alice Community Translation',
      style: 'faithful',
      features: ['footnotes', 'cultural-notes']
    };

    expect(version.features).toContain('footnotes');
  });

  it('should accept session with provenance', () => {
    const provenance: SessionProvenance = {
      originalCreator: {
        name: 'Alice',
        versionId: 'alice-v1',
        createdAt: '2025-01-01T00:00:00Z'
      },
      contributors: [
        { name: 'Alice', role: 'original-translator', dateRange: '2025-01-01' }
      ]
    };

    expect(provenance.originalCreator.name).toBe('Alice');
  });
});
