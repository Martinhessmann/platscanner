import React, { useState, useEffect } from 'react';
import { Settings, X, Key, HardDrive, Cloud, Bug, Copy, Check } from 'lucide-react';
import DataBackupSection from './DataBackupSection';
import CloudSyncSection from './CloudSyncSection';
import { ocrLogger } from '../services/ocrLogger';

interface ApiKeySettingsProps {
  onApiKeyChange: (key: string) => Promise<void>;
  isConfigured: boolean;
  openSettings?: boolean;
  onOpenSettingsHandled?: () => void;
  onDataImported?: () => void; // Callback to refresh UI after import
}

const ApiKeySettings: React.FC<ApiKeySettingsProps> = ({
  onApiKeyChange,
  isConfigured,
  openSettings = false,
  onOpenSettingsHandled,
  onDataImported
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'api' | 'backup' | 'sync' | 'debug'>('api');
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [logs, setLogs] = useState(ocrLogger.getRecentLogs(100));
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (openSettings) {
      setIsOpen(true);
      onOpenSettingsHandled?.();
    }
  }, [openSettings, onOpenSettingsHandled]);

  // Auto-refresh logs when debug tab is active
  useEffect(() => {
    if (activeTab === 'debug' && autoRefresh) {
      const interval = setInterval(() => {
        setLogs(ocrLogger.getRecentLogs(100));
      }, 1000); // Refresh every second
      return () => clearInterval(interval);
    }
  }, [activeTab, autoRefresh]);

  useEffect(() => {
    try {
      const storedKey = localStorage.getItem('platscanner_gemini_api_key');
      if (storedKey) {
        setApiKey(storedKey);
        onApiKeyChange(storedKey).catch(err => {
          console.error('Failed to restore API key:', err);
          setError('Stored API key is invalid. Please enter a new one.');
          setApiKey('');
        });
      }
    } catch (error) {
      console.error('Failed to load API key:', error);
      setError('Failed to load stored API key');
    }
  }, [onApiKeyChange]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await onApiKeyChange(apiKey);
      setIsOpen(false);
      setError(null);
    } catch (error) {
      console.error('Failed to save API key:', error);
      setError(error instanceof Error ? error.message : 'Failed to save API key. Please try again.');
      setApiKey('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="absolute top-4 right-4 p-2 text-gray-400 hover:text-orokin-gold transition-colors"
        title="API Settings"
      >
        <Settings size={20} />
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-background-card rounded-lg shadow-lg w-full max-w-full sm:max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Settings size={20} className="text-orokin-gold" />
                Settings
              </h2>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-white transition-colors"
                disabled={isSubmitting}
              >
                <X size={20} />
              </button>
            </div>

            {/* Tab Navigation */}
            <div className="flex border-b border-gray-800 overflow-x-auto scrollbar-hide">
              <button
                onClick={() => setActiveTab('api')}
                className={`flex items-center gap-2 px-4 sm:px-6 py-3 font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
                  activeTab === 'api'
                    ? 'text-white border-b-2 border-tenno-blue bg-gray-800'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                <Key size={16} />
                <span className="hidden sm:inline">API Configuration</span>
                <span className="sm:hidden">API</span>
              </button>
              <button
                onClick={() => setActiveTab('sync')}
                className={`flex items-center gap-2 px-4 sm:px-6 py-3 font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
                  activeTab === 'sync'
                    ? 'text-white border-b-2 border-tenno-blue bg-gray-800'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                <Cloud size={16} />
                <span className="hidden sm:inline">Cloud Sync</span>
                <span className="sm:hidden">Sync</span>
              </button>
              <button
                onClick={() => setActiveTab('backup')}
                className={`flex items-center gap-2 px-4 sm:px-6 py-3 font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
                  activeTab === 'backup'
                    ? 'text-white border-b-2 border-tenno-blue bg-gray-800'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                <HardDrive size={16} />
                <span className="hidden sm:inline">Data Backup</span>
                <span className="sm:hidden">Backup</span>
              </button>
              <button
                onClick={() => {
                  setActiveTab('debug');
                  setLogs(ocrLogger.getRecentLogs(100));
                }}
                className={`flex items-center gap-2 px-4 sm:px-6 py-3 font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
                  activeTab === 'debug'
                    ? 'text-white border-b-2 border-tenno-blue bg-gray-800'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                <Bug size={16} />
                <span className="hidden sm:inline">Debug/Logs</span>
                <span className="sm:hidden">Logs</span>
                {ocrLogger.getLogCount() > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 bg-tenno-blue/20 text-tenno-blue text-xs rounded">
                    {ocrLogger.getLogCount()}
                  </span>
                )}
              </button>
            </div>

            {/* Tab Content */}
            <div className="p-4 overflow-y-auto flex-1">
              {activeTab === 'api' && (
                <form onSubmit={handleSubmit}>
                  <div className="mb-4">
                    <label htmlFor="apiKey" className="block text-sm font-medium text-gray-300 mb-2">
                      API Key (Optional - Not Required for OCR)
                    </label>
                    <input
                      type="password"
                      id="apiKey"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder={isConfigured ? '••••••••••••••••' : 'Enter your API key'}
                      className="w-full px-3 py-2 bg-background-dark border border-gray-700 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-tenno-blue focus:border-transparent"
                      disabled={isSubmitting}
                    />
                    {error && (
                      <p className="mt-2 text-sm text-grineer-red">{error}</p>
                    )}
                  </div>

                  <div className="text-sm text-gray-400 mb-4">
                    <p className="mb-2 text-gray-500">
                      Note: OCR-based text extraction doesn't require an API key. This field is kept for backward compatibility.
                    </p>
                  </div>

                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setIsOpen(false)}
                      className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
                      disabled={isSubmitting}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-tenno-blue text-white rounded hover:bg-tenno-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </form>
              )}

              {activeTab === 'sync' && (
                <CloudSyncSection onDataImported={onDataImported} />
              )}

              {activeTab === 'backup' && (
                <DataBackupSection onDataImported={onDataImported} />
              )}

              {activeTab === 'debug' && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-1">OCR Debug Logs</h3>
                      <p className="text-sm text-gray-400">
                        View detailed logs from OCR processing to debug image analysis failures
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="flex items-center gap-2 text-sm text-gray-300 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={autoRefresh}
                          onChange={(e) => setAutoRefresh(e.target.checked)}
                          className="rounded"
                        />
                        Auto-refresh
                      </label>
                      <button
                        onClick={async () => {
                          try {
                            const logsText = logs.map(log => {
                              const date = new Date(log.timestamp);
                              const dataStr = log.data ? '\n' + JSON.stringify(log.data, null, 2) : '';
                              return `[${log.level.toUpperCase()}] ${date.toLocaleString()} [${log.category}]\n${log.message}${dataStr}`;
                            }).join('\n\n');
                            
                            await navigator.clipboard.writeText(logsText);
                            setCopied(true);
                            setTimeout(() => setCopied(false), 2000);
                          } catch (error) {
                            console.error('Failed to copy logs:', error);
                            // Fallback: create textarea and copy
                            const textarea = document.createElement('textarea');
                            const logsText = logs.map(log => {
                              const date = new Date(log.timestamp);
                              const dataStr = log.data ? '\n' + JSON.stringify(log.data, null, 2) : '';
                              return `[${log.level.toUpperCase()}] ${date.toLocaleString()} [${log.category}]\n${log.message}${dataStr}`;
                            }).join('\n\n');
                            textarea.value = logsText;
                            document.body.appendChild(textarea);
                            textarea.select();
                            document.execCommand('copy');
                            document.body.removeChild(textarea);
                            setCopied(true);
                            setTimeout(() => setCopied(false), 2000);
                          }
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-orokin-gold/20 hover:bg-orokin-gold/30 border border-orokin-gold/50 text-orokin-gold rounded text-sm transition-colors whitespace-nowrap"
                      >
                        {copied ? (
                          <>
                            <Check size={14} />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy size={14} />
                            Copy Logs
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => {
                          ocrLogger.clearLogs();
                          setLogs([]);
                        }}
                        className="px-3 py-1.5 bg-grineer-red/20 hover:bg-grineer-red/30 border border-grineer-red/50 text-grineer-red rounded text-sm transition-colors whitespace-nowrap"
                      >
                        Clear Logs
                      </button>
                      <button
                        onClick={() => setLogs(ocrLogger.getRecentLogs(100))}
                        className="px-3 py-1.5 bg-tenno-blue/20 hover:bg-tenno-blue/30 border border-tenno-blue/50 text-tenno-blue rounded text-sm transition-colors whitespace-nowrap"
                      >
                        Refresh
                      </button>
                    </div>
                  </div>

                  <div className="bg-background-dark rounded-lg border border-gray-700 p-4 max-h-[60vh] overflow-y-auto">
                    {logs.length === 0 ? (
                      <p className="text-gray-500 text-center py-8">No logs yet. Upload an image to see OCR processing logs.</p>
                    ) : (
                      <div className="space-y-2 font-mono text-xs">
                        {logs.map((log, index) => {
                          const date = new Date(log.timestamp);
                          const levelColors = {
                            info: 'text-tenno-blue',
                            warn: 'text-yellow-400',
                            error: 'text-grineer-red',
                            debug: 'text-gray-500'
                          };
                          const levelBg = {
                            info: 'bg-tenno-blue/10',
                            warn: 'bg-yellow-400/10',
                            error: 'bg-grineer-red/10',
                            debug: 'bg-gray-500/10'
                          };

                          return (
                            <div
                              key={index}
                              className={`p-2 rounded border-l-2 ${
                                log.level === 'error' ? 'border-grineer-red' :
                                log.level === 'warn' ? 'border-yellow-400' :
                                log.level === 'info' ? 'border-tenno-blue' :
                                'border-gray-600'
                              } ${levelBg[log.level]}`}
                            >
                              <div className="flex items-start gap-2">
                                <span className={`font-semibold ${levelColors[log.level]}`}>
                                  [{log.level.toUpperCase()}]
                                </span>
                                <span className="text-gray-400">
                                  {date.toLocaleTimeString()}
                                </span>
                                <span className="text-orokin-gold font-semibold">
                                  [{log.category}]
                                </span>
                              </div>
                              <div className="mt-1 text-gray-300">
                                {log.message}
                              </div>
                              {log.data && (
                                <details className="mt-2">
                                  <summary className="cursor-pointer text-gray-400 hover:text-gray-300 text-xs">
                                    View data
                                  </summary>
                                  <pre className="mt-2 p-2 bg-black/30 rounded text-xs overflow-x-auto">
                                    {JSON.stringify(log.data, null, 2)}
                                  </pre>
                                </details>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="text-xs text-gray-500">
                    <p>Total logs: {ocrLogger.getLogCount()} (showing last {logs.length})</p>
                    <p className="mt-1">Logs are stored in localStorage and persist across sessions. Clear logs to free up space.</p>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ApiKeySettings;