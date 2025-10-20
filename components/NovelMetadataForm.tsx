import React, { useState } from 'react';
import type { NovelMetadata } from '../types/novel';

interface NovelMetadataFormProps {
  initialData?: Partial<NovelMetadata>;
  onSave: (metadata: NovelMetadata) => void;
}

interface FormErrors {
  title?: string;
  author?: string;
  description?: string;
}

export function NovelMetadataForm({ initialData, onSave }: NovelMetadataFormProps) {
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
    novelUpdatesUrl: initialData?.sourceLinks?.novelUpdates || '',
    bestTranslationUrl: initialData?.sourceLinks?.bestTranslation || '',
    rawSourceUrl: initialData?.sourceLinks?.rawSource || '',
    lnAdaptationUrl: initialData?.sourceLinks?.lnAdaptation || '',
    mangaUrl: initialData?.sourceLinks?.manga || '',
    animeUrl: initialData?.sourceLinks?.anime || ''
  });

  const [errors, setErrors] = useState<FormErrors>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    const newErrors: FormErrors = {};
    if (!formData.title) newErrors.title = 'Title is required';
    if (!formData.author) newErrors.author = 'Author is required';
    if (!formData.description) newErrors.description = 'Description is required';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Build metadata object
    const metadata: NovelMetadata = {
      originalLanguage: formData.originalLanguage,
      genres: formData.genres.split(',').map(g => g.trim()).filter(Boolean),
      description: formData.description,
      author: formData.author,
      coverImageUrl: formData.coverImageUrl || undefined,
      publicationStatus: formData.publicationStatus as any,
      originalPublicationDate: formData.originalPublicationDate || undefined,
      tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
      sourceLinks: {
        novelUpdates: formData.novelUpdatesUrl || undefined,
        bestTranslation: formData.bestTranslationUrl || undefined,
        rawSource: formData.rawSourceUrl || undefined,
        lnAdaptation: formData.lnAdaptationUrl || undefined,
        manga: formData.mangaUrl || undefined,
        anime: formData.animeUrl || undefined
      },
      lastUpdated: new Date().toISOString().split('T')[0]
    };

    onSave(metadata);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
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
            {errors.title && <p className="text-red-600 text-sm mt-1">{errors.title}</p>}
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
            {errors.author && <p className="text-red-600 text-sm mt-1">{errors.author}</p>}
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
            {errors.description && <p className="text-red-600 text-sm mt-1">{errors.description}</p>}
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

      {/* Submit */}
      <div className="flex justify-end">
        <button
          type="submit"
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Save Metadata
        </button>
      </div>
    </form>
  );
}
