import React, { useState } from 'react';
import { useSettingsModalContext } from './SettingsModalContext';
import { pingSillyTavernBridge, type BridgeStatus } from '../../services/sillyTavernBridge';

const BRIDGE_COMMAND = 'uvicorn bridge:app --port 5001';

const SillyTavernPanel: React.FC = () => {
  const { currentSettings, handleSettingChange } = useSettingsModalContext();
  const [bridgeStatus, setBridgeStatus] = useState<BridgeStatus>({ state: 'unknown' });
  const [isChecking, setIsChecking] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleTestConnection = async () => {
    setIsChecking(true);
    try {
      const result = await pingSillyTavernBridge(currentSettings.sillyTavernBridgeUrl ?? null);
      setBridgeStatus(result);
    } finally {
      setIsChecking(false);
    }
  };

  const handleCopyCommand = async () => {
    try {
      await navigator.clipboard.writeText(BRIDGE_COMMAND);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable; ignore
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
          SillyTavern Integration
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Select a passage and enter the story as a participant via SillyTavern group chat.
          Requires the novel-analyzer bridge and SillyTavern to be running.
        </p>
      </div>

      <div>
        <label className="flex items-start gap-3 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
          <input
            type="checkbox"
            checked={currentSettings.enableSillyTavern ?? false}
            onChange={(e) => handleSettingChange('enableSillyTavern', e.target.checked)}
            className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <div>
            <span className="block font-medium text-gray-800 dark:text-gray-100">
              Enable self-insert
            </span>
            <span className="block text-xs text-gray-500 dark:text-gray-400 mt-1">
              Shows a portal icon in the selection toolbar (only when the bridge is reachable).
              Click it to enter the story at the selected passage.
            </span>
          </div>
        </label>
      </div>

      {currentSettings.enableSillyTavern && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Bridge URL
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={currentSettings.sillyTavernBridgeUrl ?? ''}
              onChange={(e) => {
                handleSettingChange('sillyTavernBridgeUrl', e.target.value);
                setBridgeStatus({ state: 'unknown' });
              }}
              placeholder="http://localhost:5001"
              className="flex-1 px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-gray-100"
            />
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isChecking || !currentSettings.sillyTavernBridgeUrl}
              data-testid="bridge-test-connection"
              className={`px-3 py-2 text-sm rounded-md transition-colors ${
                isChecking
                  ? 'bg-gray-300 dark:bg-gray-600 cursor-wait'
                  : 'bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed'
              }`}
            >
              {isChecking ? 'Testing…' : 'Test connection'}
            </button>
          </div>

          {/* Status pill */}
          {bridgeStatus.state !== 'unknown' && (
            <div
              data-testid="bridge-status-pill"
              className={`mt-2 inline-flex items-center gap-2 px-2 py-1 text-xs rounded-md ${
                bridgeStatus.state === 'reachable'
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
                  : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${bridgeStatus.state === 'reachable' ? 'bg-green-500' : 'bg-red-500'}`} />
              {bridgeStatus.state === 'reachable'
                ? 'Bridge is reachable'
                : `Unreachable: ${bridgeStatus.reason}`}
            </div>
          )}

          <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
            <div className="flex items-center gap-2 flex-wrap">
              <span>Start the bridge with:</span>
              <code className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded select-all">
                {BRIDGE_COMMAND}
              </code>
              <button
                type="button"
                onClick={handleCopyCommand}
                data-testid="bridge-copy-command"
                className="px-2 py-0.5 text-xs rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            </div>
            <p className="mt-1">
              The <code>start-lexiconforge.command</code> script will start the bridge automatically
              if novel-analyzer is at <code>~/Documents/Ongoing Local/ST/novel-analyzer</code> and{' '}
              <code>uvicorn</code> is on PATH.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default SillyTavernPanel;
