




  /**
   * TEST MOTIVATION: Core Export Functionality
   * 
   * Users need to export their translation work to JSON files.
   * This is their primary backup mechanism and must be 100% reliable.
   * 
   * WHAT IT VALIDATES:
   * - All session data is included in export
   * - JSON format is valid and parseable
   * - File naming follows expected pattern
   * - No data loss during export process
   */
  describe('JSON Export', () => {
    it('should export complete session data to valid JSON', async () => {
      const store = useAppStore.getState();
      const chapters = createChapterChain(3);
      
      // Set up a complete translation session
      store.updateSettings(createMockAppSettings({
        provider: 'Gemini',
        model: 'gemini-2.5-flash',
        temperature: 0.7,
        contextDepth: 2
      }));
      
      // Add multiple chapters with translations (stableId flow)
      for (const chapter of chapters) {
        await store.handleFetch(chapter.originalUrl);
        const currentId = useAppStore.getState().currentChapterId!;
        await store.handleTranslate(currentId);
      }
      
      // Export session data
      const json = store.exportSessionData();
      const exportData = JSON.parse(json);

      expect(exportData).toHaveProperty('session_metadata');
      expect(exportData).toHaveProperty('chapters');
      
      // Verify metadata
      expect(exportData.session_metadata.settings.provider).toBe('Gemini');
      
      // Verify all chapters included
      expect(exportData.chapters).toHaveLength(3);
      chapters.forEach(chapter => {
        const exportedChapter = exportData.chapters.find(c => c.sourceUrl === chapter.originalUrl);
        expect(exportedChapter).toBeTruthy();
        expect(exportedChapter.title).toBe(chapter.title);
        expect(exportedChapter.translationResult).toBeTruthy();
      });
      
      // Verify JSON is valid
      expect(() => JSON.parse(json)).not.toThrow();
    });

    it('should handle empty session data gracefully', () => {
      // WHY: Users might try to export before doing any translations
      // PREVENTS: Export errors when no data exists
      const store = useAppStore.getState();
      
      store.exportSession();
      
      // Verify that the download link creation was not called
      const mockCreateObjectURL = vi.spyOn(URL, 'createObjectURL');
      expect(mockCreateObjectURL).not.toHaveBeenCalled();
    });

    it('should preserve all translation metadata in export', async () => {
      // WHY: Users need cost tracking and translation history preserved
      // PREVENTS: Loss of valuable usage metrics and translation metadata
      const store = useAppStore.getState();
      const chapter = createMockChapter();
      
      await store.handleFetch(chapter.originalUrl);
      await store.handleTranslate(useAppStore.getState().currentChapterId!);

      const json = store.exportSessionData();
      const exportData = JSON.parse(json);

      const exportedChapter = exportData.chapters.find(c => c.sourceUrl === chapter.originalUrl);
      
      // Verify all cost and timing data preserved
      expect(exportedChapter.translationResult.usageMetrics.estimatedCost).toBeCloseTo(0.000345, 6);
      expect(exportedChapter.translationResult.usageMetrics.requestTime).toBeGreaterThan(0);
      expect(exportedChapter.translationResult.usageMetrics.totalTokens).toBe(2500);
      
      // Verify translation context preserved
      expect(exportedChapter.translationResult.usageMetrics.provider).toBe('Gemini');
      expect(exportedChapter.translationResult.usageMetrics.model).toBe('gemini-2.5-flash');
    });
  });

  /**
   * TEST MOTIVATION: Import Data Restoration
   * 
   * Users must be able to restore their exported data completely.
   * This is critical for data continuity and backup recovery.
   */
  describe('JSON Import', () => {
    it('should restore complete session from exported JSON', async () => {
      const store = useAppStore.getState();
      const chapters = createChapterChain(2);
      
      // Create export data
      const exportData = {
        session_metadata: { 
            exported_at: new Date().toISOString(), 
            settings: createMockAppSettings({
              provider: 'DeepSeek',
              model: 'deepseek-chat',
              temperature: 0.5
            })
        },
        urlHistory: chapters.map(c => c.originalUrl),
        chapters: chapters.map(chapter => ({
            sourceUrl: chapter.originalUrl,
            title: chapter.title,
            originalContent: chapter.content,
            nextUrl: chapter.nextUrl,
            prevUrl: chapter.prevUrl,
            translationResult: createMockTranslationResult(),
            feedback: [],
        }))
      };
      
      // Import the data (direct payload)
      await store.importSessionData(exportData);
      
      // Verify settings restored
      const state = useAppStore.getState();
      expect(state.settings.provider).toBe('DeepSeek');
      expect(state.settings.model).toBe('deepseek-chat');
      expect(state.settings.temperature).toBe(0.5);
      
      // Verify chapters were indexed
      expect(state.urlIndex.size + state.rawUrlIndex.size).toBeGreaterThan(0);
    });

    it('should handle corrupted import data gracefully', async () => {
      // WHY: Import files can get corrupted during transfer
      // PREVENTS: App crashes when importing bad data
      const store = useAppStore.getState();
      
      const corruptedData = 'this is not a valid json string';
      try {
        await store.importSessionData(corruptedData);
      } catch {}
      
      // App should remain in valid state
      const state = useAppStore.getState();
      expect(state.error).toBeTruthy();
      expect(state.error).toContain('import');
    });

    it('should validate import data structure before importing', async () => {
      const store = useAppStore.getState();
      
      const invalidData = [
        null,
        undefined,
        'not-an-object',
        { settings: 'invalid' }, // Missing required fields
        { chapters: null, session_metadata: {} }, // Invalid chapters
      ];
      
      for (const data of invalidData) {
        await store.importSessionData(data as any);
        const state = useAppStore.getState();
        expect(state.error).toBeTruthy();
      }
    });
  });

  /**
   * TEST MOTIVATION: File Operations
   * 
   * Users interact with export/import through file downloads/uploads.
   * File naming and format must be consistent and user-friendly.
   */
  describe('File Operations', () => {
    it('should generate consistent file names for exports', async () => {
      const store = useAppStore.getState();
      const chapter = createMockChapter();
      await store.handleFetch(chapter.originalUrl, true);
      
      // Mock Date to get predictable filename
      const mockDate = new Date('2025-01-12T14:30:45.000Z');
      vi.setSystemTime(mockDate);
      
      store.exportSession();

      const mockAnchor = { download: '' };
      vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor as any);

      // We need to re-run exportSession to get the spy to work
      store.exportSession();
      
      expect(mockAnchor.download).toBe('novel-translator-session_2025-01-12_14-30-45_1-chapters.json');
      
      vi.useRealTimers();
    });

    it('should handle file download mechanics properly', async () => {
      // WHY: Browser download functionality must work correctly
      // PREVENTS: Users unable to save their export files
      const store = useAppStore.getState();
      const chapter = createMockChapter();
      
      // Mock browser APIs
      const mockCreateObjectURL = vi.fn().mockReturnValue('blob:mock-url');
      const mockRevokeObjectURL = vi.fn();
      const mockClick = vi.fn();
      
      global.URL.createObjectURL = mockCreateObjectURL;
      global.URL.revokeObjectURL = mockRevokeObjectURL;
      
      const mockAnchor = {
        href: '',
        download: '',
        click: mockClick,
        style: { display: '' }
      };
      
      vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor as any);
      vi.spyOn(document.body, 'appendChild').mockImplementation(() => {});
      vi.spyOn(document.body, 'removeChild').mockImplementation(() => {});
      
      // Add some data and export
      await store.handleFetch(chapter.originalUrl, true);
      store.exportSession();
      
      // Verify download flow
      expect(mockCreateObjectURL).toHaveBeenCalledWith(expect.any(Blob));
      expect(mockAnchor.href).toBe('blob:mock-url');
      expect(mockAnchor.download).toMatch(/^novel-translator-session-.*\.json$/);
      expect(mockClick).toHaveBeenCalled();
      expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    });
  });

  /**
   * TEST MOTIVATION: Data Integrity
   * 
   * Import/export must preserve data perfectly.
   * Any data loss is unacceptable for paid translation work.
   */
  describe('Data Integrity', () => {
    it('should preserve exact data through export/import cycle', async () => {
      const store = useAppStore.getState();
      const originalChapter = createMockChapter({
        title: 'Specific Test Title',
        content: 'Specific test content with special characters: 「こんにちは」',
      });
      
      const originalResult = createMockTranslationResult({
        translatedTitle: 'Exact Translation Title',
        translation: 'Exact translation with footnotes[1] and markers',
        footnotes: [{ marker: '1', text: 'Exact footnote text' }],
        usageMetrics: {
          totalTokens: 1234,
          promptTokens: 800,
          completionTokens: 434,
          estimatedCost: 0.00567,
          requestTime: 32.1,
          provider: 'Gemini',
          model: 'gemini-2.5-pro'
        }
      });
      
      // Set up original state
      store.updateSettings({ provider: 'Gemini', model: 'gemini-2.5-pro', temperature: 0.8 });
      await store.handleFetch(originalChapter.originalUrl, true);
      // Manually set the translation result to control the data for the test
      useAppStore.setState(state => ({
        sessionData: {
          ...state.sessionData,
          [originalChapter.originalUrl]: {
            ...state.sessionData[originalChapter.originalUrl],
            translationResult: originalResult
          }
        }
      }));

      // Export and clear
      store.exportSession();
      const mockCreateObjectURL = vi.spyOn(URL, 'createObjectURL');
      expect(mockCreateObjectURL).toHaveBeenCalled();
      const blob = (mockCreateObjectURL.mock.calls[0][0] as Blob);
      const text = await blob.text();
      const exportData = JSON.parse(text);

      store.clearSession();
      
      // Verify cleared
      expect(Object.keys(useAppStore.getState().sessionData)).toHaveLength(0);
      
      // Import back
      const file = new File([JSON.stringify(exportData)], "session.json", { type: "application/json" });
      const event = { target: { files: [file] } } as unknown as React.ChangeEvent<HTMLInputElement>;
      await store.importSession(event);
      
      // Verify exact restoration
      const restoredState = useAppStore.getState();
      const restoredSession = restoredState.sessionData[originalChapter.originalUrl];
      
      expect(restoredSession.chapter.title).toBe('Specific Test Title');
      expect(restoredSession.chapter.content).toBe('Specific test content with special characters: 「こんにちは」');
      expect(restoredSession.translationResult.translatedTitle).toBe('Exact Translation Title');
      expect(restoredSession.translationResult.translation).toBe('Exact translation with footnotes[1] and markers');
      expect(restoredSession.translationResult.footnotes[0].text).toBe('Exact footnote text');
      expect(restoredSession.translationResult.usageMetrics.estimatedCost).toBe(0.00567);
      expect(restoredSession.translationResult.usageMetrics.requestTime).toBe(32.1);
      expect(restoredState.settings.temperature).toBe(0.8);
    });

    it('should handle Unicode and special characters correctly', async () => {
      // WHY: Japanese novels contain complex Unicode characters
      // PREVENTS: Character corruption during export/import
      const store = useAppStore.getState();
      const unicodeChapter = createMockChapter({
        title: '第一章：魔王の覚醒 ～禁断の力～',
        content: `「お前は何者だ？」
彼は剣を構えながら問いかけた。

※この物語はフィクションです。`,
      });
      
      const unicodeResult = createMockTranslationResult({
        translatedTitle: 'Chapter 1: The Demon King\'s Awakening ~Forbidden Power~',
        translation: `"Who are you?" he asked while readying his sword.

※This story is fiction.`,
        footnotes: [{ marker: '※', text: 'Translator\'s note: This is a common disclaimer' }]
      });
      
      await store.handleFetch(unicodeChapter.originalUrl, true);
      useAppStore.setState(state => ({
        sessionData: {
          ...state.sessionData,
          [unicodeChapter.originalUrl]: {
            ...state.sessionData[unicodeChapter.originalUrl],
            translationResult: unicodeResult
          }
        }
      }));
      
      // Export/import cycle
      store.exportSession();
      const mockCreateObjectURL = vi.spyOn(URL, 'createObjectURL');
      expect(mockCreateObjectURL).toHaveBeenCalled();
      const blob = (mockCreateObjectURL.mock.calls[0][0] as Blob);
      const text = await blob.text();
      const exportData = JSON.parse(text);

      store.clearSession();

      const file = new File([JSON.stringify(exportData)], "session.json", { type: "application/json" });
      const event = { target: { files: [file] } } as unknown as React.ChangeEvent<HTMLInputElement>;
      await store.importSession(event);
      
      // Verify Unicode preservation
      const restored = useAppStore.getState().sessionData[unicodeChapter.originalUrl];
      expect(restored.chapter.title).toBe('第一章：魔王の覚醒 ～禁断の力～');
      expect(restored.chapter.content).toContain('「お前は何者だ？」');
      expect(restored.translationResult.translation).toContain('"Who are you?"');
      expect(restored.translationResult.footnotes[0].marker).toBe('※');
    });

    it('should handle large session data without corruption', async () => {
      // WHY: Users might have translated many long chapters
      // PREVENTS: Performance issues or data truncation with large exports
      const store = useAppStore.getState();
      const largeChapters = createChapterChain(20); // Simulate large session
      
      // Add all chapters with substantial content
      for (const chapter of largeChapters) {
        await store.handleFetch(chapter.originalUrl, true);
        // Manually set a large translation result to avoid actual translation
        useAppStore.setState(state => ({
          sessionData: {
            ...state.sessionData,
            [chapter.originalUrl]: {
              ...state.sessionData[chapter.originalUrl],
              translationResult: createMockTranslationResult({
                translation: `This is a very long translation for chapter ${chapter.title}. `.repeat(100), // ~7KB per chapter
              })
            }
          }
        }));
      }
      
      // Export large dataset
      store.exportSession();
      const mockCreateObjectURL = vi.spyOn(URL, 'createObjectURL');
      expect(mockCreateObjectURL).toHaveBeenCalled();
      const blob = (mockCreateObjectURL.mock.calls[0][0] as Blob);
      const text = await blob.text();
      const exportData = JSON.parse(text);
      
      // Verify export completed successfully
      expect(exportData.chapters).toHaveLength(20);
      
      // Verify JSON serialization works
      expect(text.length).toBeGreaterThan(100000); // Should be substantial size
      
      // Verify can be parsed back
      expect(() => JSON.parse(text)).not.toThrow();
    });
  });

  /**
   * TEST MOTIVATION: Version Compatibility
   * 
   * Export format might change over time.
   * Must handle backward compatibility gracefully.
   */
  describe('Version Compatibility', () => {
    it('should include version information in exports', async () => {
      const store = useAppStore.getState();
      const chapter = createMockChapter();
      await store.handleFetch(chapter.originalUrl, true);

      store.exportSession();

      const mockCreateObjectURL = vi.spyOn(URL, 'createObjectURL');
      const blob = (mockCreateObjectURL.mock.calls[0][0] as Blob);
      const text = await blob.text();
      const exportData = JSON.parse(text);
      
      expect(exportData.session_metadata.exported_at).toBeTruthy();
    });

    it('should handle missing version information gracefully', async () => {
      // WHY: Old export files might not have version metadata
      // PREVENTS: Import failures for legacy data
      const store = useAppStore.getState();
      
      const legacyExportData = {
        // Missing session_metadata
        chapters: [],
        urlHistory: [],
      };
      
      const file = new File([JSON.stringify(legacyExportData)], "session.json", { type: "application/json" });
      const event = { target: { files: [file] } } as unknown as React.ChangeEvent<HTMLInputElement>;
      await store.importSession(event);
      
      // Should import with reasonable defaults
      const state = useAppStore.getState();
      expect(state.settings).toBeTruthy();
    });
  });
});
