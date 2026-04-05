import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { useAppStore } from '../store';

const AUTO_DISMISS_MS = 5000;

const STYLE_BY_TYPE = {
  success: {
    container: 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-100',
    button: 'text-emerald-700 hover:text-emerald-900 dark:text-emerald-300 dark:hover:text-emerald-100',
  },
  error: {
    container: 'border-red-300 bg-red-50 text-red-900 dark:border-red-700 dark:bg-red-950/70 dark:text-red-100',
    button: 'text-red-700 hover:text-red-900 dark:text-red-300 dark:hover:text-red-100',
  },
  warning: {
    container: 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/70 dark:text-amber-100',
    button: 'text-amber-700 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-100',
  },
  info: {
    container: 'border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-700 dark:bg-sky-950/70 dark:text-sky-100',
    button: 'text-sky-700 hover:text-sky-900 dark:text-sky-300 dark:hover:text-sky-100',
  },
} as const;

const NotificationToast: React.FC = () => {
  const notification = useAppStore((state) => state.notification);
  const clearNotification = useAppStore((state) => state.clearNotification);
  const showToasts = useAppStore((state) => (state as any).settings?.showToastNotifications ?? false);

  useEffect(() => {
    if (!notification) {
      return;
    }

    const timeout = window.setTimeout(() => {
      clearNotification();
    }, AUTO_DISMISS_MS);

    return () => window.clearTimeout(timeout);
  }, [notification?.timestamp, clearNotification]);

  if (!notification || !showToasts) {
    return null;
  }

  const styles = STYLE_BY_TYPE[notification.type];

  return (
    <div className="fixed right-4 top-4 z-50 w-[min(28rem,calc(100vw-2rem))]">
      <div
        role={notification.type === 'error' ? 'alert' : 'status'}
        aria-live={notification.type === 'error' ? 'assertive' : 'polite'}
        className={`rounded-xl border shadow-lg backdrop-blur-sm ${styles.container}`}
      >
        <div className="flex items-start gap-3 px-4 py-3">
          <div className="min-w-0 flex-1 text-sm font-medium whitespace-pre-line">
            {notification.message}
          </div>
          <button
            type="button"
            aria-label="Dismiss notification"
            onClick={clearNotification}
            className={`rounded p-1 transition-colors ${styles.button}`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotificationToast;
