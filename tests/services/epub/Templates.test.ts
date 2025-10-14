import { describe, it, expect } from 'vitest';
import { 
  getDefaultTemplate, 
  createCustomTemplate, 
  getNovelConfig,
  generateTitlePage,
  generateTableOfContents,
  generateStatsAndAcknowledgments,
  type EpubTemplate,
  type NovelConfig,
  type TranslationStats
} from '../../../services/epub/Templates';

const expectLocalizedNumber = (html: string, value: number) => {
  const locales = ['en-US', 'en-IN', 'fr-FR', 'de-DE', 'ja-JP'];
  const variants = new Set<string>();
  locales.forEach(locale => {
    try {
      variants.add(new Intl.NumberFormat(locale).format(value));
    } catch {
      // ignore locale errors in minimal environments
    }
  });
  variants.add(value.toString());
  const matched = Array.from(variants).some(variant => html.includes(variant));
  expect(matched).toBe(true);
};

describe('Templates', () => {
  describe('getDefaultTemplate', () => {
    it('returns default template with all required fields', () => {
      const template = getDefaultTemplate();
      
      expect(template.gratitudeMessage).toBeTruthy();
      expect(template.projectDescription).toBeTruthy();
      expect(template.githubUrl).toBe('https://github.com/anantham/LexiconForge');
      expect(template.additionalAcknowledgments).toBeTruthy();
      expect(template.customFooter).toBe('');
    });

    it('returns consistent results on multiple calls', () => {
      const template1 = getDefaultTemplate();
      const template2 = getDefaultTemplate();
      
      expect(template1).toEqual(template2);
    });
  });

  describe('createCustomTemplate', () => {
    it('merges custom values with defaults', () => {
      const custom = createCustomTemplate({
        gratitudeMessage: 'Custom gratitude',
        githubUrl: 'https://github.com/custom/repo'
      });
      
      expect(custom.gratitudeMessage).toBe('Custom gratitude');
      expect(custom.githubUrl).toBe('https://github.com/custom/repo');
      expect(custom.projectDescription).toBeTruthy(); // Should keep default
      expect(custom.additionalAcknowledgments).toBeTruthy(); // Should keep default
    });

    it('handles empty overrides', () => {
      const custom = createCustomTemplate({});
      const defaultTemplate = getDefaultTemplate();
      
      expect(custom).toEqual(defaultTemplate);
    });

    it('handles undefined overrides', () => {
      const custom = createCustomTemplate(undefined as any);
      const defaultTemplate = getDefaultTemplate();
      
      expect(custom).toEqual(defaultTemplate);
    });
  });

  describe('getNovelConfig', () => {
    it('returns default config without URL or manual config', () => {
      const config = getNovelConfig();
      
      expect(config.title).toBe('Translated Novel');
      expect(config.author).toBe('Unknown Author');
      expect(config.language).toBe('en');
      expect(config.originalLanguage).toBe('ja');
      expect(config.publisher).toBe('LexiconForge Community');
    });

    it('applies manual config overrides', () => {
      const manualConfig = {
        title: 'My Custom Novel',
        author: 'Custom Author'
      };
      
      const config = getNovelConfig(undefined, manualConfig);
      
      expect(config.title).toBe('My Custom Novel');
      expect(config.author).toBe('Custom Author');
      expect(config.language).toBe('en'); // Should keep default
    });

    it('recognizes Kakuyomu URLs', () => {
      const config = getNovelConfig('https://kakuyomu.jp/works/test');
      
      expect(config.title).toContain('Strongest Exorcist');
      expect(config.author).toBe('Kosuzu Kiichi');
      expect(config.originalLanguage).toBe('ja');
    });

    it('recognizes BookToki URLs', () => {
      const config = getNovelConfig('https://booktoki468.com/novel/test');
      
      expect(config.title).toBe('Dungeon Defense');
      expect(config.author).toBe('Yoo Heonhwa');
      expect(config.originalLanguage).toBe('ko');
    });

    it('recognizes Syosetu URLs', () => {
      const config = getNovelConfig('https://ncode.syosetu.com/test');
      
      expect(config.title).toContain('Syosetu');
      expect(config.originalLanguage).toBe('ja');
      expect(config.publisher).toContain('Syosetu');
    });

    it('manual config takes precedence over URL-based config', () => {
      const config = getNovelConfig('https://kakuyomu.jp/works/test', {
        title: 'Override Title',
        author: 'Override Author'
      });
      
      expect(config.title).toBe('Override Title');
      expect(config.author).toBe('Override Author');
      // But other Kakuyomu-specific fields should still apply
      expect(config.originalLanguage).toBe('ja');
    });
  });

  describe('generateTitlePage', () => {
    const mockNovelConfig: NovelConfig = {
      title: 'Test Novel',
      author: 'Test Author',
      originalTitle: 'テスト小説',
      description: 'A test novel description',
      genre: 'Fantasy, Adventure',
      language: 'en',
      originalLanguage: 'ja',
      publisher: 'Test Publisher',
      seriesName: 'Test Series',
      volumeNumber: 1
    };

    const mockStats: TranslationStats = {
      totalChapters: 10,
      totalWords: 50000,
      totalCharacters: 250000,
      uniqueModels: ['gpt-4'],
      uniqueProviders: ['OpenAI'],
      translationSettings: [],
      averageWordsPerChapter: 5000
    };

    it('generates valid XHTML title page', () => {
      const page = generateTitlePage(mockNovelConfig, mockStats);
      
      expect(page).toContain('<!DOCTYPE html PUBLIC');
      expect(page).toContain('xmlns="http://www.w3.org/1999/xhtml"');
      expect(page).toContain('<title>Test Novel</title>');
    });

    it('includes novel metadata', () => {
      const page = generateTitlePage(mockNovelConfig, mockStats);
      
      expect(page).toContain('Test Novel');
      expect(page).toContain('Test Author');
      expect(page).toContain('テスト小説');
      expect(page).toContain('Fantasy, Adventure');
    });

    it('includes translation statistics', () => {
      const page = generateTitlePage(mockNovelConfig, mockStats);
      
      expect(page).toContain('10'); // chapter count
      expect(page).toContain('50,000'); // word count
      expect(page).toContain('ja → en'); // language pair
    });

    it('escapes HTML in content', () => {
      const configWithHtml: NovelConfig = {
        ...mockNovelConfig,
        title: 'Novel with <script>alert(1)</script> tags',
        author: 'Author & Co.'
      };
      
      const page = generateTitlePage(configWithHtml, mockStats);
      
      expect(page).not.toContain('<script>');
      expect(page).toContain('&lt;script&gt;');
      expect(page).toContain('&amp;');
    });

    it('handles missing optional fields gracefully', () => {
      const minimalConfig: NovelConfig = {
        title: 'Minimal Novel',
        author: 'Minimal Author',
        language: 'en',
        originalLanguage: 'ja',
        publisher: 'Test'
      };
      
      const page = generateTitlePage(minimalConfig, mockStats);
      
      expect(page).toContain('Minimal Novel');
      expect(page).not.toContain('undefined');
      expect(page).not.toContain('null');
    });
  });

  describe('generateTableOfContents', () => {
    const mockChapters = [
      { title: 'Chapter 1: Beginning', filename: 'ch01.xhtml' },
      { title: 'Chapter 2: Adventure', filename: 'ch02.xhtml' },
      { title: 'Chapter 3: Conclusion', filename: 'ch03.xhtml' }
    ];

    it('generates valid XHTML table of contents', () => {
      const toc = generateTableOfContents(mockChapters, false);
      
      expect(toc).toContain('<!DOCTYPE html PUBLIC');
      expect(toc).toContain('xmlns="http://www.w3.org/1999/xhtml"');
      expect(toc).toContain('<title>Table of Contents</title>');
    });

    it('includes all chapters', () => {
      const toc = generateTableOfContents(mockChapters, false);
      
      expect(toc).toContain('Chapter 1: Beginning');
      expect(toc).toContain('Chapter 2: Adventure');
      expect(toc).toContain('Chapter 3: Conclusion');
      expect(toc).toContain('ch01.xhtml');
      expect(toc).toContain('ch02.xhtml');
      expect(toc).toContain('ch03.xhtml');
    });

    it('includes stats page when requested', () => {
      const toc = generateTableOfContents(mockChapters, true);
      
      expect(toc).toContain('stats-acknowledgments.xhtml');
      expect(toc).toContain('Translation Stats');
    });

    it('excludes stats page when not requested', () => {
      const toc = generateTableOfContents(mockChapters, false);
      
      expect(toc).not.toContain('stats-acknowledgments.xhtml');
      expect(toc).not.toContain('Translation Stats');
    });

    it('handles empty chapter list', () => {
      const toc = generateTableOfContents([], false);
      
      expect(toc).toContain('Table of Contents');
      expect(toc).not.toContain('<li><a href=');
    });

    it('escapes HTML in chapter titles', () => {
      const chaptersWithHtml = [
        { title: 'Chapter <script>alert(1)</script> & More', filename: 'ch01.xhtml' }
      ];
      
      const toc = generateTableOfContents(chaptersWithHtml, false);
      
      expect(toc).not.toContain('<script>');
      expect(toc).toContain('&lt;script&gt;');
      expect(toc).toContain('&amp;');
    });
  });

  describe('generateStatsAndAcknowledgments', () => {
    const mockStats: TranslationStats = {
      totalChapters: 15,
      totalWords: 75000,
      totalCharacters: 375000,
      uniqueModels: ['gpt-4', 'claude-3'],
      uniqueProviders: ['OpenAI', 'Anthropic'],
      translationSettings: [
        { model: 'gpt-4', provider: 'OpenAI', chapterCount: 10 },
        { model: 'claude-3', provider: 'Anthropic', chapterCount: 5 }
      ],
      averageWordsPerChapter: 5000,
      earliestTranslation: new Date('2024-01-01'),
      latestTranslation: new Date('2024-01-15')
    };

    const mockTemplate: EpubTemplate = {
      gratitudeMessage: 'Test gratitude message',
      projectDescription: 'Test project description',
      githubUrl: 'https://github.com/test/test',
      additionalAcknowledgments: 'Test additional acknowledgments',
      customFooter: 'Custom footer message'
    };

    it('generates valid XHTML stats page', () => {
      const page = generateStatsAndAcknowledgments(mockStats, mockTemplate);
      
      expect(page).toContain('<!DOCTYPE html PUBLIC');
      expect(page).toContain('xmlns="http://www.w3.org/1999/xhtml"');
      expect(page).toContain('<title>Translation Stats');
    });

    it('includes translation statistics', () => {
      const page = generateStatsAndAcknowledgments(mockStats, mockTemplate);
      
      expect(page).toContain('15'); // total chapters
      expectLocalizedNumber(page, 75000);
      expectLocalizedNumber(page, 375000);
      expect(page).toContain('5000'); // average words per chapter
    });

    it('includes model breakdown table', () => {
      const page = generateStatsAndAcknowledgments(mockStats, mockTemplate);
      
      expect(page).toContain('OpenAI - gpt-4');
      expect(page).toContain('Anthropic - claude-3');
      expect(page).toContain('<td>10</td>'); // chapter count for gpt-4
      expect(page).toContain('<td>5</td>'); // chapter count for claude-3
    });

    it('includes template content', () => {
      const page = generateStatsAndAcknowledgments(mockStats, mockTemplate);
      
      expect(page).toContain('Test gratitude message');
      expect(page).toContain('Test project description');
      expect(page).toContain('https://github.com/test/test');
      expect(page).toContain('Test additional acknowledgments');
      expect(page).toContain('Custom footer message');
    });

    it('calculates translation duration', () => {
      const page = generateStatsAndAcknowledgments(mockStats, mockTemplate);
      
      expect(page).toContain('14 days'); // 15 days between dates
    });

    it('handles missing dates gracefully', () => {
      const statsWithoutDates = { ...mockStats, earliestTranslation: undefined, latestTranslation: undefined };
      const page = generateStatsAndAcknowledgments(statsWithoutDates, mockTemplate);
      
      expect(page).toContain('Unknown');
    });

    it('escapes HTML in template content', () => {
      const templateWithHtml: EpubTemplate = {
        ...mockTemplate,
        gratitudeMessage: 'Message with <script>alert(1)</script> tags & symbols'
      };
      
      const page = generateStatsAndAcknowledgments(mockStats, templateWithHtml);
      
      expect(page).not.toContain('<script>');
      expect(page).toContain('&lt;script&gt;');
      expect(page).toContain('&amp;');
    });

    it('handles empty custom footer', () => {
      const templateWithoutFooter = { ...mockTemplate, customFooter: '' };
      const page = generateStatsAndAcknowledgments(mockStats, templateWithoutFooter);
      
      // Should not include custom footer section when empty
      expect(page).not.toContain('Custom Message');
    });
  });
});
