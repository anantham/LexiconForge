import React, { useState, useEffect } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { getDefaultKeyStatus } from '../services/defaultApiKeyService';
import { useAppStore } from '../store';

export function DefaultKeyBanner() {
  const [isDismissed, setIsDismissed] = useState(false);
  const [status, setStatus] = useState(getDefaultKeyStatus());
  const settings = useAppStore(s => s.settings);
  const [lastLoggedState, setLastLoggedState] = useState<string>('');

  // Update status periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setStatus(getDefaultKeyStatus());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Check if we should show the banner
  // Show if using OpenRouter without a user key (includes both active trial and exceeded trial)
  const hasTrialKey = import.meta.env.VITE_DEFAULT_OPENROUTER_KEY;
  const hasUserEnvKey = import.meta.env.VITE_OPENROUTER_API_KEY;
  // Don't show banner if user has their own key (either in settings or env)
  const isUsingDefaultKey = settings.provider === 'OpenRouter' &&
    !settings.apiKeyOpenRouter &&
    !hasUserEnvKey &&
    !hasTrialKey;

  // Debug logging to understand banner visibility (only log when state changes)
  useEffect(() => {
    const currentState = JSON.stringify({
      provider: settings.provider,
      hasUserKey: !!settings.apiKeyOpenRouter,
      hasUserEnvKey: !!hasUserEnvKey,
      hasTrialKey: !!hasTrialKey,
      usageCount: status.usageCount,
      isUsingDefaultKey,
      isDismissed,
    });

    if (currentState !== lastLoggedState) {
      console.log('[DefaultKeyBanner] Visibility state changed:', {
        provider: settings.provider,
        hasUserKey: !!settings.apiKeyOpenRouter,
        hasUserEnvKey: !!hasUserEnvKey,
        hasTrialKey: !!hasTrialKey,
        userKeyPrefix: settings.apiKeyOpenRouter ? `${settings.apiKeyOpenRouter.slice(0, 8)}...` : 'none',
        usageCount: status.usageCount,
        usageLimit: 10,
        remainingUses: status.remainingUses,
        isUsingDefaultKey,
        isDismissed,
        willShow: isUsingDefaultKey && !isDismissed,
      });
      setLastLoggedState(currentState);
    }
  }, [settings.provider, settings.apiKeyOpenRouter, hasUserEnvKey, hasTrialKey, status.usageCount, isUsingDefaultKey, isDismissed, lastLoggedState]);

  if (!isUsingDefaultKey || isDismissed) {
    return null;
  }

  // Change banner color to red when limit exceeded
  const isExceeded = status.hasExceeded;
  const bgClasses = isExceeded
    ? "bg-gradient-to-r from-red-50 to-red-100 dark:from-red-900/30 dark:to-red-800/30 border-l-4 border-red-600"
    : "bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-l-4 border-amber-500";

  const iconClasses = isExceeded
    ? "h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 mr-3 flex-shrink-0"
    : "h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 mr-3 flex-shrink-0";

  return (
    <div className={`${bgClasses} p-4 mb-4 rounded-r-lg shadow-sm`}>
      <div className="flex items-start">
        <AlertCircle className={iconClasses} />
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h3 className={`text-sm font-semibold ${isExceeded ? 'text-red-900 dark:text-red-100' : 'text-amber-900 dark:text-amber-100'}`}>
              {isExceeded ? '⚠️ Trial Limit Exceeded' : 'Using Trial API Key'}
            </h3>
            <button
              onClick={() => setIsDismissed(true)}
              className={`${isExceeded ? 'text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200' : 'text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200'}`}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className={`text-sm mt-1 ${isExceeded ? 'text-red-800 dark:text-red-200' : 'text-amber-800 dark:text-amber-200'}`}>
            {isExceeded ? (
              <>
                You've used all <strong>10 free trial requests</strong>. Add your own API key to continue translating.
              </>
            ) : (
              <>
                You're using a shared trial key with <strong>{status.remainingUses} {status.remainingUses === 1 ? 'request' : 'requests'} remaining</strong>.
              </>
            )}
          </p>
          <p className={`text-xs mt-2 ${isExceeded ? 'text-red-700 dark:text-red-300' : 'text-amber-700 dark:text-amber-300'}`}>
            Get your own free <a
              href="https://openrouter.ai/settings/keys"
              target="_blank"
              rel="noopener noreferrer"
              className={`underline font-medium ${isExceeded ? 'hover:text-red-900 dark:hover:text-red-100' : 'hover:text-amber-900 dark:hover:text-amber-100'}`}
            >
              OpenRouter API key
            </a> for unlimited translations, or contact{' '}
            <a
              href="https://t.me/everythingisrelative"
              target="_blank"
              rel="noopener noreferrer"
              className={`underline font-medium ${isExceeded ? 'hover:text-red-900 dark:hover:text-red-100' : 'hover:text-amber-900 dark:hover:text-amber-100'}`}
            >
              @everythingisrelative
            </a> for more trial credits in exchange for user testing.
          </p>
        </div>
      </div>
    </div>
  );
}
