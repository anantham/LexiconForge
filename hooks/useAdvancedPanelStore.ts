import { useAppStore } from '../store';
import { useShallow } from 'zustand/react/shallow';

export const useAdvancedPanelStore = () =>
  useAppStore(
    useShallow((state) => ({
      getMemoryDiagnostics: state.getMemoryDiagnostics,
    }))
  );
