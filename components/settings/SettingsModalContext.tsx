import React, { createContext, useContext, Dispatch, SetStateAction } from 'react';
import type { AppSettings } from '../../types';
import type { PublisherMetadata } from './types';

export type ParameterSupportState = {
  temperature: boolean | null;
  topP: boolean | null;
  frequencyPenalty: boolean | null;
  presencePenalty: boolean | null;
  seed: boolean | null;
};

export interface SettingsModalContextValue {
  currentSettings: AppSettings;
  handleSettingChange: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  parameterSupport: Record<string, ParameterSupportState>;
  setParameterSupport: Dispatch<SetStateAction<Record<string, ParameterSupportState>>>;
  novelMetadata: PublisherMetadata | null;
  handleNovelMetadataChange: (metadata: PublisherMetadata) => void;
}

const SettingsModalContext = createContext<SettingsModalContextValue | null>(null);

export const SettingsModalProvider: React.FC<{
  value: SettingsModalContextValue;
  children: React.ReactNode;
}> = ({ value, children }) => (
  <SettingsModalContext.Provider value={value}>
    {children}
  </SettingsModalContext.Provider>
);

export const useSettingsModalContext = (): SettingsModalContextValue => {
  const ctx = useContext(SettingsModalContext);
  if (!ctx) {
    throw new Error('useSettingsModalContext must be used within a SettingsModalProvider');
  }
  return ctx;
};
