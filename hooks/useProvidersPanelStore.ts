import { useAppStore } from '../store';
import { useShallow } from 'zustand/react/shallow';

export const useProvidersPanelStore = () =>
  useAppStore(
    useShallow((state) => ({
      loadOpenRouterCatalogue: state.loadOpenRouterCatalogue,
      refreshOpenRouterModels: state.refreshOpenRouterModels,
      refreshOpenRouterCredits: state.refreshOpenRouterCredits,
      getOpenRouterOptions: state.getOpenRouterOptions,
      openRouterModels: state.openRouterModels,
      openRouterKeyUsage: state.openRouterKeyUsage,
      providerCredits: state.providerCredits,
      refreshProviderCredits: state.refreshProviderCredits,
      loadProviderCreditsFromCache: state.loadProviderCreditsFromCache,
    }))
  );
