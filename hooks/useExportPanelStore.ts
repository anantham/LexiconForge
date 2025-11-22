import { useAppStore } from '../store';
import { useShallow } from 'zustand/react/shallow';

export const useExportPanelStore = () =>
  useAppStore(
    useShallow((state) => ({
      showNotification: state.showNotification,
    }))
  );
