import React from 'react';
import { NovelMetadataForm } from '../NovelMetadataForm';
import { useSettingsModalContext } from './SettingsModalContext';

export const MetadataPanel: React.FC = () => {
  const { novelMetadata, handleNovelMetadataChange } = useSettingsModalContext();

  return (
    <fieldset>
      <legend className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4 border-b border-gray-200 dark:border-gray-700 pb-2">
        Novel Metadata
      </legend>
      <NovelMetadataForm initialData={novelMetadata || undefined} onChange={handleNovelMetadataChange} />
    </fieldset>
  );
};

export default MetadataPanel;
