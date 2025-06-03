import React, { useState, useEffect } from 'react';
import { Settings, X, Key } from 'lucide-react';

interface ApiKeySettingsProps {
  onApiKeyChange: (key: string) => Promise<void>;
  isConfigured: boolean;
}

const ApiKeySettings: React.FC<ApiKeySettingsProps> = ({ onApiKeyChange, isConfigured }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    try {
      const storedKey = localStorage.getItem('gemini_api_key');
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background-card rounded-lg shadow-lg w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Key size={20} className="text-orokin-gold" />
                API Settings
              </h2>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-white transition-colors"
                disabled={isSubmitting}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4">
              <div className="mb-4">
                <label htmlFor="apiKey" className="block text-sm font-medium text-gray-300 mb-2">
                  Gemini API Key
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
                <p className="mb-2">
                  To get your API key:
                </p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Visit <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-tenno-blue hover:underline">Google AI Studio</a></li>
                  <li>Click "Create API Key" if you don't have one</li>
                  <li>Copy your API key and paste it here</li>
                </ol>
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
          </div>
        </div>
      )}
    </>
  );
};

export default ApiKeySettings;