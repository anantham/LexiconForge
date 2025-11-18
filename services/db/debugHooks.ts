import { SchemaOps } from './operations/schema';

export const registerIndexedDbDebugHooks = (): void => {
  if (typeof window === 'undefined') {
    return;
  }

  const global = window as any;

  global.cleanupDuplicateVersions = async () => {
    const { cleanupDuplicateVersions } = await import('./maintenanceService');
    return cleanupDuplicateVersions();
  };

  global.cleanupAndRefresh = async () => {
    const { cleanupDuplicateVersions } = await import('./maintenanceService');
    await cleanupDuplicateVersions();
    console.log('[Cleanup] Refreshing page to update UI...');
    window.location.reload();
  };

  global.resetIndexedDB = () => {
    console.log('[Recovery] IndexedDB now uses direct connections - no reset needed');
  };

  global.testStableIdSchema = async () => {
    const result = await SchemaOps.testStableIdSchema();
    console.log('[Schema Test]', result.success ? '✅' : '❌', result.message);
    console.log('[Schema Test] Details:', result.details);
    return result;
  };

  console.log('[IndexedDB] Debug hooks registered (window.testStableIdSchema available)');
};
