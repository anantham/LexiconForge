import React, { useState, useEffect } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { getDefaultKeyStatus } from '../services/defaultApiKeyService';
import { useAppStore } from '../store';

export function DefaultKeyBanner() {
  const [isDismissed, setIsDismissed] = useState(false);
  const [status, setStatus] = useState(getDefaultKeyStatus());
  const settings = useAppStore(s => s.settings);

  // Update status periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setStatus(getDefaultKeyStatus());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Check if we should show the banner
  const isUsingDefaultKey = settings.provider === 'OpenRouter' &&
    !settings.apiKeyOpenRouter &&
    status.usageCount < 10;

  if (!isUsingDefaultKey || isDismissed) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-l-4 border-amber-500 p-4 mb-4 rounded-r-lg shadow-sm">
      <div className="flex items-start">
        <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 mr-3 flex-shrink-0" />
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-100">
              Using Trial API Key
            </h3>
            <button
              onClick={() => setIsDismissed(true)}
              className="text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="text-sm text-amber-800 dark:text-amber-200 mt-1">
            You're using a shared trial key with <strong>{status.remainingUses} requests remaining</strong>.
            {' '}
            {status.hasExceeded && (
              <span className="font-semibold text-red-600 dark:text-red-400">
                Trial limit reached.
              </span>
            )}
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-300 mt-2">
            Add your own <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                useAppStore.getState().setShowSettingsModal(true);
              }}
              className="underline hover:text-amber-900 dark:hover:text-amber-100 font-medium"
            >
              OpenRouter API key
            </a> in Settings for unlimited translations.
          </p>
        </div>
      </div>
    </div>
  );
}
