import React, { useState, useEffect } from 'react';
import { Bug, Terminal, Filter, Settings } from 'lucide-react';
import { logger, LogLevel } from '../utils/logger';

const DeveloperSection: React.FC = () => {
  const [logLevel, setLogLevel] = useState<LogLevel>('info');
  const [enabledContexts, setEnabledContexts] = useState<string[]>([]);
  const [newContext, setNewContext] = useState('');

  // Available logging contexts
  const availableContexts = [
    'built-sets-filter',
    'mod-service',
    'inventory-service',
    'gemini-service',
    'warframe-market',
    'cloud-sync',
    'prime-sets',
    'relic-analysis',
    'syndicate-rewards'
  ];

  useEffect(() => {
    // Load current settings
    const savedLevel = localStorage.getItem('platscanner_log_level') as LogLevel;
    const savedContexts = localStorage.getItem('platscanner_log_contexts');
    
    if (savedLevel) {
      setLogLevel(savedLevel);
    }
    
    if (savedContexts) {
      try {
        const contexts = JSON.parse(savedContexts);
        setEnabledContexts(contexts);
      } catch (e) {
        setEnabledContexts([]);
      }
    }
  }, []);

  const handleLogLevelChange = (level: LogLevel) => {
    setLogLevel(level);
    logger.setLevel(level);
  };

  const toggleContext = (context: string) => {
    const newContexts = enabledContexts.includes(context)
      ? enabledContexts.filter(c => c !== context)
      : [...enabledContexts, context];
    
    setEnabledContexts(newContexts);
    
    // Update logger
    logger.clearContexts();
    newContexts.forEach(ctx => logger.addContext(ctx));
  };

  const addCustomContext = () => {
    if (newContext.trim() && !enabledContexts.includes(newContext.trim())) {
      const context = newContext.trim();
      const newContexts = [...enabledContexts, context];
      setEnabledContexts(newContexts);
      logger.addContext(context);
      setNewContext('');
    }
  };

  const clearAllContexts = () => {
    setEnabledContexts([]);
    logger.clearContexts();
  };

  const enableAllContexts = () => {
    const allContexts = ['*']; // Wildcard enables all
    setEnabledContexts(allContexts);
    logger.clearContexts();
    logger.addContext('*');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Bug className="text-grineer-red" size={20} />
        <h3 className="text-lg font-semibold text-white">Developer Settings</h3>
      </div>

      <div className="text-sm text-gray-400 mb-4">
        <p>Control logging levels and contexts for debugging. Only available in development mode.</p>
      </div>

      {/* Log Level Selection */}
      <div className="bg-background-darker rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Terminal size={16} className="text-tenno-blue" />
          <h4 className="font-medium text-white">Log Level</h4>
        </div>
        
        <div className="grid grid-cols-4 gap-2">
          {(['debug', 'info', 'warn', 'error'] as LogLevel[]).map(level => (
            <button
              key={level}
              onClick={() => handleLogLevelChange(level)}
              className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                logLevel === level
                  ? 'bg-tenno-blue text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {level.toUpperCase()}
            </button>
          ))}
        </div>
        
        <div className="mt-2 text-xs text-gray-500">
          Current: {logLevel.toUpperCase()} (shows {logLevel} level and above)
        </div>
      </div>

      {/* Context Filtering */}
      <div className="bg-background-darker rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={16} className="text-tenno-blue" />
          <h4 className="font-medium text-white">Logging Contexts</h4>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={enableAllContexts}
            className="px-3 py-1 text-xs bg-tenno-blue text-white rounded hover:bg-tenno-dark transition-colors"
          >
            Enable All
          </button>
          <button
            onClick={clearAllContexts}
            className="px-3 py-1 text-xs bg-grineer-red text-white rounded hover:bg-red-700 transition-colors"
          >
            Clear All
          </button>
        </div>

        {/* Available Contexts */}
        <div className="space-y-2 mb-4">
          <div className="text-sm text-gray-400 mb-2">Available Contexts:</div>
          <div className="flex flex-wrap gap-2">
            {availableContexts.map(context => (
              <button
                key={context}
                onClick={() => toggleContext(context)}
                className={`px-3 py-1 text-xs rounded transition-colors ${
                  enabledContexts.includes(context)
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {context}
              </button>
            ))}
          </div>
        </div>

        {/* Add Custom Context */}
        <div className="border-t border-gray-700 pt-4">
          <div className="text-sm text-gray-400 mb-2">Add Custom Context:</div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newContext}
              onChange={(e) => setNewContext(e.target.value)}
              placeholder="Enter context name..."
              className="flex-1 px-3 py-1 text-sm bg-background-dark border border-gray-700 rounded text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-tenno-blue"
              onKeyPress={(e) => e.key === 'Enter' && addCustomContext()}
            />
            <button
              onClick={addCustomContext}
              disabled={!newContext.trim()}
              className="px-3 py-1 text-xs bg-tenno-blue text-white rounded hover:bg-tenno-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add
            </button>
          </div>
        </div>

        {/* Current Status */}
        <div className="mt-4 p-3 bg-background-dark rounded text-xs">
          <div className="text-gray-400">
            Enabled: {enabledContexts.length === 0 ? 'None' : 
                     enabledContexts.includes('*') ? 'All contexts' : 
                     enabledContexts.join(', ')}
          </div>
        </div>
      </div>

      {/* Usage Instructions */}
      <div className="bg-background-darker rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Settings size={16} className="text-tenno-blue" />
          <h4 className="font-medium text-white">Usage Instructions</h4>
        </div>
        
        <div className="text-sm text-gray-400 space-y-2">
          <p>• <strong>Log Levels:</strong> Debug shows all logs, Info shows normal operation, Warn/Error show only issues</p>
          <p>• <strong>Contexts:</strong> Enable specific contexts to see only relevant logs (e.g., 'built-sets-filter' for the issue you reported)</p>
          <p>• <strong>Built Sets Filter:</strong> Enable 'built-sets-filter' context to see only logs related to that feature</p>
          <p>• <strong>Wildcard (*):</strong> Shows all logging contexts - useful for debugging but verbose</p>
          <p>• <strong>Settings persist:</strong> Your choices are saved and will persist across browser sessions</p>
        </div>
      </div>
    </div>
  );
};

export default DeveloperSection;