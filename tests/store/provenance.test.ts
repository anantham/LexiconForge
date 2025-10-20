import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../../store';
import type { SessionProvenance } from '../../types/session';

describe('Store Provenance', () => {
  beforeEach(() => {
    useAppStore.setState({
      sessionProvenance: null,
      sessionVersion: null
    });
  });

  it('should set session provenance', () => {
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

    useAppStore.getState().setSessionProvenance(provenance);

    expect(useAppStore.getState().sessionProvenance).toEqual(provenance);
  });

  it('should update contributors when adding new contributor', () => {
    const initialProvenance: SessionProvenance = {
      originalCreator: {
        name: 'Alice',
        versionId: 'alice-v1',
        createdAt: '2025-01-01T00:00:00Z'
      },
      contributors: [
        { name: 'Alice', role: 'original-translator', dateRange: '2025-01-01' }
      ]
    };

    useAppStore.getState().setSessionProvenance(initialProvenance);

    const updatedProvenance = {
      ...initialProvenance,
      contributors: [
        ...initialProvenance.contributors,
        { name: 'Bob', role: 'enhancer' as const, changes: 'Added images', dateRange: '2025-01-15' }
      ]
    };

    useAppStore.getState().setSessionProvenance(updatedProvenance);

    expect(useAppStore.getState().sessionProvenance?.contributors).toHaveLength(2);
  });
});
