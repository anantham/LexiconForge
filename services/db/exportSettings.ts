import type { AppSettings, ExportedAppSettings } from '../../types';

export const redactApiCredentials = (settings: AppSettings | null): ExportedAppSettings => {
  const safeEntries = Object.entries(settings ?? {}).filter(
    ([key]) => !key.toLowerCase().includes('apikey')
  );

  return Object.fromEntries(safeEntries) as ExportedAppSettings;
};
