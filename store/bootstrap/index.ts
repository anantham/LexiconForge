import type { StoreApi } from 'zustand';
import type { SessionActions, StoreState } from '../storeTypes';
import { createClearSession } from './clearSession';
import { createImportSessionData } from './importSessionData';
import { createInitializeStore } from './initializeStore';

export interface BootstrapContext {
  set: StoreApi<StoreState>['setState'];
  get: StoreApi<StoreState>['getState'];
  store: StoreApi<StoreState>;
}

export const createBootstrapActions = (
  ctx: BootstrapContext
): Pick<SessionActions, 'clearSession' | 'importSessionData' | 'initializeStore'> => ({
  clearSession: createClearSession(ctx),
  importSessionData: createImportSessionData(ctx),
  initializeStore: createInitializeStore(ctx),
});
