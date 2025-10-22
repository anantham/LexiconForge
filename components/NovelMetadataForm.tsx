import React, { useState } from 'react';
import type { NovelMetadata } from '../types/novel';

// Extended metadata interface that includes title, alternate titles, and version info
interface NovelMetadataFormData extends NovelMetadata {
  title?: string;
  alternateTitles?: string[];
  // Version-specific fields
  targetLanguage?: string;
  translatorName?: string;
  translatorBio?: string;
  translatorWebsite?: string;
  translatorRating?: number;
  translationApproach?: string;
  versionDescription?: string;
  contentNotes?: string;
  mediaCorrespondenceJson?: string;  // JSON string for media correspondence
}

interface NovelMetadataFormProps {
  initialData?: Partial<NovelMetadataFormData>;
  onChange: (metadata: NovelMetadataFormData) => void;
}

export function NovelMetadataForm({ initialData, onChange }: NovelMetadataFormProps) {
  const [formData, setFormData] = useState({
    title: initialData?.title || '',
    alternateTitles: initialData?.alternateTitles?.join(', ') || '',
    author: initialData?.author || '',
    description: initialData?.description || '',
    originalLanguage: initialData?.originalLanguage || '',
    genres: initialData?.genres?.join(', ') || '',
    tags: initialData?.tags?.join(', ') || '',
    publicationStatus: initialData?.publicationStatus || 'Ongoing',
    originalPublicationDate: initialData?.originalPublicationDate || '',
    coverImageUrl: initialData?.coverImageUrl || '',
    chapterCount: initialData?.chapterCount?.toString() || '',
    novelUpdatesUrl: initialData?.sourceLinks?.novelUpdates || '',
    bestTranslationUrl: initialData?.sourceLinks?.bestTranslation || '',
    rawSourceUrl: initialData?.sourceLinks?.rawSource || '',
    lnAdaptationUrl: initialData?.sourceLinks?.lnAdaptation || '',
    mangaUrl: initialData?.sourceLinks?.manga || '',
    animeUrl: initialData?.sourceLinks?.anime || '',
    // Version-specific fields
    targetLanguage: 'English',
    translatorName: '',
    translatorBio: '',
    translatorWebsite: '',
    translatorRating: '',
    translationApproach: '',
    versionDescription: '',
    contentNotes: '',
    mediaCorrespondenceJson: initialData?.mediaCorrespondence ? JSON.stringify(initialData.mediaCorrespondence, null, 2) : ''
  });

  // Call onChange whenever formData changes
  React.useEffect(() => {
    // Parse media correspondence JSON if provided
    let mediaCorrespondence;
    if (formData.mediaCorrespondenceJson && formData.mediaCorrespondenceJson.trim()) {
      try {
        mediaCorrespondence = JSON.parse(formData.mediaCorrespondenceJson);
      } catch (e) {
        // Invalid JSON - ignore silently
        mediaCorrespondence = undefined;
      }
    }

    const metadata: NovelMetadataFormData = {
      title: formData.title,
      alternateTitles: formData.alternateTitles.split(',').map(t => t.trim()).filter(Boolean),
      originalLanguage: formData.originalLanguage,
      genres: formData.genres.split(',').map(g => g.trim()).filter(Boolean),
      description: formData.description,
      author: formData.author,
      coverImageUrl: formData.coverImageUrl || undefined,
      publicationStatus: formData.publicationStatus as any,
      originalPublicationDate: formData.originalPublicationDate || undefined,
      chapterCount: formData.chapterCount ? parseInt(formData.chapterCount, 10) : undefined,
      tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
      sourceLinks: {
        novelUpdates: formData.novelUpdatesUrl || undefined,
        bestTranslation: formData.bestTranslationUrl || undefined,
        rawSource: formData.rawSourceUrl || undefined,
        lnAdaptation: formData.lnAdaptationUrl || undefined,
        manga: formData.mangaUrl || undefined,
        anime: formData.animeUrl || undefined
      },
      lastUpdated: new Date().toISOString().split('T')[0],
      mediaCorrespondence: mediaCorrespondence,
      // Version-specific fields
      targetLanguage: formData.targetLanguage || undefined,
      translatorName: formData.translatorName || undefined,
      translatorBio: formData.translatorBio || undefined,
      translatorWebsite: formData.translatorWebsite || undefined,
      translatorRating: formData.translatorRating ? parseFloat(formData.translatorRating) : undefined,
      translationApproach: formData.translationApproach || undefined,
      versionDescription: formData.versionDescription || undefined,
      contentNotes: formData.contentNotes || undefined,
      mediaCorrespondenceJson: formData.mediaCorrespondenceJson || undefined
    };
    onChange(metadata);
  }, [formData, onChange]);

  return (
    <div className="space-y-6">
      {/* Basic Info */}
      <section>
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">Basic Information</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" htmlFor="title">
              Title *
            </label>
            <input
              id="title"
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" htmlFor="alternateTitles">
              Alternate Titles (comma-separated)
            </label>
            <input
              id="alternateTitles"
              type="text"
              value={formData.alternateTitles}
              onChange={(e) => setFormData({ ...formData, alternateTitles: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600"
              placeholder="e.g., 던전 디펜스, DD"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" htmlFor="author">
              Author *
            </label>
            <input
              id="author"
              type="text"
              value={formData.author}
              onChange={(e) => setFormData({ ...formData, author: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" htmlFor="description">
              Description *
            </label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600"
              rows={4}
            />
          </div>
        </div>
      </section>

      {/* Version Information */}
      <section>
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">Translation Version Information</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Optional fields to help readers understand your translation choices and approach. All fields except target language are optional.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" htmlFor="targetLanguage">
              Target Language *
            </label>
            <input
              id="targetLanguage"
              type="text"
              value={formData.targetLanguage}
              onChange={(e) => setFormData({ ...formData, targetLanguage: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600"
              placeholder="e.g., English, Spanish, French"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" htmlFor="translatorName">
              Translator Name (optional)
            </label>
            <input
              id="translatorName"
              type="text"
              value={formData.translatorName}
              onChange={(e) => setFormData({ ...formData, translatorName: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600"
              placeholder="Your name or pseudonym"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" htmlFor="translatorWebsite">
              Translator Website (optional)
            </label>
            <input
              id="translatorWebsite"
              type="url"
              value={formData.translatorWebsite}
              onChange={(e) => setFormData({ ...formData, translatorWebsite: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600"
              placeholder="https://..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" htmlFor="translatorBio">
              Translator Bio (optional)
            </label>
            <textarea
              id="translatorBio"
              value={formData.translatorBio}
              onChange={(e) => setFormData({ ...formData, translatorBio: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600"
              rows={2}
              placeholder="Brief introduction or background"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" htmlFor="translatorRating">
              Translation Quality Rating (optional)
            </label>
            <input
              id="translatorRating"
              type="number"
              min="0"
              max="10"
              step="0.1"
              value={formData.translatorRating}
              onChange={(e) => setFormData({ ...formData, translatorRating: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600"
              placeholder="e.g., 8.5"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Quality rating for this translation version (1-10 scale, decimals allowed)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" htmlFor="versionDescription">
              Version Description (optional)
            </label>
            <textarea
              id="versionDescription"
              value={formData.versionDescription}
              onChange={(e) => setFormData({ ...formData, versionDescription: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600"
              rows={3}
              placeholder="Describe this translation version. What makes it unique? What features does it include? (e.g., 'This version includes extensive footnotes and character illustrations from the original publication')"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" htmlFor="translationApproach">
              Translation Philosophy & Approach (optional)
            </label>
            <textarea
              id="translationApproach"
              value={formData.translationApproach}
              onChange={(e) => setFormData({ ...formData, translationApproach: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600"
              rows={4}
              placeholder="Describe your translation philosophy. Consider: Do you prioritize literal accuracy or natural flow? How do you handle cultural references? Do you preserve original idioms or localize them? How do you balance readability with faithfulness to the source?"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" htmlFor="contentNotes">
              Content & Style Notes (optional)
            </label>
            <textarea
              id="contentNotes"
              value={formData.contentNotes}
              onChange={(e) => setFormData({ ...formData, contentNotes: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600"
              rows={3}
              placeholder="Any additional notes about content, style, or special features. (e.g., 'Heavy use of footnotes to explain Korean cultural context', 'Includes AI-generated character illustrations', 'Glossary of terms included')"
            />
          </div>
        </div>
      </section>

      {/* Publication Info */}
      <section>
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">Publication Information</h3>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" htmlFor="originalLanguage">
              Original Language
            </label>
            <input
              id="originalLanguage"
              type="text"
              value={formData.originalLanguage}
              onChange={(e) => setFormData({ ...formData, originalLanguage: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600"
              placeholder="e.g., Korean, Japanese"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" htmlFor="publicationStatus">
              Publication Status
            </label>
            <select
              id="publicationStatus"
              value={formData.publicationStatus}
              onChange={(e) => setFormData({ ...formData, publicationStatus: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600"
            >
              <option value="Ongoing">Ongoing</option>
              <option value="Completed">Completed</option>
              <option value="Hiatus">Hiatus</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" htmlFor="originalPublicationDate">
              Original Publication Date
            </label>
            <input
              id="originalPublicationDate"
              type="date"
              value={formData.originalPublicationDate}
              onChange={(e) => setFormData({ ...formData, originalPublicationDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" htmlFor="chapterCount">
              Total Chapters *
            </label>
            <input
              id="chapterCount"
              type="number"
              min="1"
              step="1"
              value={formData.chapterCount}
              onChange={(e) => setFormData({ ...formData, chapterCount: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600"
              placeholder="e.g., 1600"
              required
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Total number of chapters published for this novel (enter current count for ongoing novels)
            </p>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section>
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">Categories</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" htmlFor="genres">
              Genres (comma-separated)
            </label>
            <input
              id="genres"
              type="text"
              value={formData.genres}
              onChange={(e) => setFormData({ ...formData, genres: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600"
              placeholder="e.g., Dark Fantasy, Strategy, Psychological"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" htmlFor="tags">
              Tags (comma-separated)
            </label>
            <input
              id="tags"
              type="text"
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600"
              placeholder="e.g., Anti-Hero, Cunning Protagonist, Dark"
            />
          </div>
        </div>
      </section>

      {/* Links */}
      <section>
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">External Links</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" htmlFor="coverImageUrl">
              Cover Image URL
            </label>
            <input
              id="coverImageUrl"
              type="url"
              value={formData.coverImageUrl}
              onChange={(e) => setFormData({ ...formData, coverImageUrl: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600"
              placeholder="https://i.imgur.com/..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" htmlFor="novelUpdatesUrl">
              Novel Updates URL
            </label>
            <input
              id="novelUpdatesUrl"
              type="url"
              value={formData.novelUpdatesUrl}
              onChange={(e) => setFormData({ ...formData, novelUpdatesUrl: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" htmlFor="bestTranslationUrl">
              Best human/fan translation URL (optional)
            </label>
            <input
              id="bestTranslationUrl"
              type="url"
              value={formData.bestTranslationUrl}
              onChange={(e) => setFormData({ ...formData, bestTranslationUrl: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" htmlFor="rawSourceUrl">
              Raw WN Source URL
            </label>
            <input
              id="rawSourceUrl"
              type="url"
              value={formData.rawSourceUrl}
              onChange={(e) => setFormData({ ...formData, rawSourceUrl: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" htmlFor="lnAdaptationUrl">
              LN Adaptation URL (optional)
            </label>
            <input
              id="lnAdaptationUrl"
              type="url"
              value={formData.lnAdaptationUrl}
              onChange={(e) => setFormData({ ...formData, lnAdaptationUrl: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" htmlFor="mangaUrl">
              Manga Adaptation URL (optional)
            </label>
            <input
              id="mangaUrl"
              type="url"
              value={formData.mangaUrl}
              onChange={(e) => setFormData({ ...formData, mangaUrl: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" htmlFor="animeUrl">
              Anime Adaptation URL (optional)
            </label>
            <input
              id="animeUrl"
              type="url"
              value={formData.animeUrl}
              onChange={(e) => setFormData({ ...formData, animeUrl: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600"
            />
          </div>
        </div>
      </section>

      {/* Cross-Media Correspondence */}
      <section>
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">Cross-Media Correspondence (Advanced)</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Define anchor points showing how different media adaptations (anime, manga, light novel, etc.) align at key story milestones.
          This helps readers navigate between different versions of the story.
        </p>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" htmlFor="mediaCorrespondenceJson">
            Media Correspondence Data (JSON format, optional)
          </label>
          <textarea
            id="mediaCorrespondenceJson"
            value={formData.mediaCorrespondenceJson || ''}
            onChange={(e) => setFormData({ ...formData, mediaCorrespondenceJson: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600 font-mono text-xs"
            rows={12}
            placeholder={`[
  {
    "id": "anchor-1",
    "label": "Season 1 End",
    "description": "Conclusion of the awakening arc",
    "anime": { "episodes": { "season": 1, "from": 1, "to": 12 } },
    "webNovel": { "chapters": { "from": 1, "to": 45 } },
    "manga": { "chapters": { "from": 1, "to": 28 } },
    "lightNovel": { "volume": 2, "chapters": { "from": 1, "to": 15 } }
  }
]`}
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Enter JSON array of anchor points. Each anchor can reference: anime, donghua, webNovel, lightNovel, manga, manhua.
            Optional fields: startUrl (link), notes (text). See placeholder for example format.
          </p>
        </div>
      </section>
    </div>
  );
}
