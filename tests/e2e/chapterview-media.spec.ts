import { test, expect } from '@playwright/test';
import { importSessionFromFile, prepareFreshApp } from './helpers/sessionHarness';

const ONE_BY_ONE_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=';

test.describe('ChapterView (E2E) — Media Rendering', () => {
  test.beforeEach(async ({ page }) => {
    await prepareFreshApp(page);
  });

  test('renders inline illustrations from suggestedIllustrations', async ({ page }) => {
    const chapterId = 'fixture-media-chapter';
    const sessionData = {
      metadata: { format: 'lexiconforge-full-1', exportedAt: new Date().toISOString() },
      settings: null,
      urlMappings: [],
      novels: [],
      promptTemplates: [],
      chapters: [
        {
          stableId: chapterId,
          url: 'https://example.com/media',
          canonicalUrl: 'https://example.com/media',
          title: 'Media Fixture Chapter',
          content: 'Raw content (fixture)',
          nextUrl: null,
          prevUrl: null,
          chapterNumber: 1,
          fanTranslation: null,
          feedback: [],
          translations: [
            {
              id: 'translation-1',
              version: 1,
              translatedTitle: 'Media Fixture Chapter',
              translation: 'Some text.<br><br>[ILLUSTRATION-1]<br><br>More text.',
              proposal: null,
              footnotes: [],
              suggestedIllustrations: [
                {
                  placementMarker: '[ILLUSTRATION-1]',
                  imagePrompt: 'A tiny red square.',
                  generatedImage: {
                    imageData: ONE_BY_ONE_PNG,
                    requestTime: 0,
                    cost: 0,
                    metadata: {
                      version: 1,
                      prompt: 'A tiny red square.',
                      generatedAt: new Date().toISOString(),
                    },
                  },
                },
              ],
              usageMetrics: {
                totalTokens: 42,
                promptTokens: 20,
                completionTokens: 22,
                estimatedCost: 0,
                requestTime: 0,
                provider: 'Gemini',
                model: 'gemini-2.5-flash',
              },
              provider: 'Gemini',
              model: 'gemini-2.5-flash',
              temperature: 0.7,
              systemPrompt: 'fixture',
              promptId: null,
              promptName: null,
              isActive: true,
              createdAt: new Date().toISOString(),
            },
          ],
        },
      ],
      diffResults: [],
      amendmentLogs: [],
    };

    await importSessionFromFile(page, sessionData);

    // Illustration should render as an <img> from the persisted base64 payload.
    const illustration = page.getByAltText('A tiny red square.').first();
    await expect(illustration).toBeVisible();
    await expect(illustration).toHaveAttribute('src', ONE_BY_ONE_PNG);

    // Audio player should render and expose the generate button (enabled by default task type).
    const audioGenerateButton = page.locator('button[title^=\"Generate background music\"]').first();
    await expect(audioGenerateButton).toBeVisible();
    await expect(audioGenerateButton).toBeEnabled();
  });
});
