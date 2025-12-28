import React, { useState, useEffect } from 'react';
import { X, Bug } from 'lucide-react';

interface MarketLogEntry {
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  data?: any;
}

const MarketDebugOverlay: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [logs, setLogs] = useState<MarketLogEntry[]>([]);
  const [isEnabled, setIsEnabled] = useState(() => {
    return localStorage.getItem('market_debug_enabled') === 'true';
  });

  useEffect(() => {
    if (!isEnabled) return;

    // Intercept console.log, console.warn, console.error for market-related logs
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;

    const addLog = (level: 'info' | 'warn' | 'error', ...args: any[]) => {
      const message = args.map(arg => 
        typeof arg === 'string' ? arg : JSON.stringify(arg, null, 2)
      ).join(' ');
      
      // Only capture market-related logs
      if (message.includes('💰') || message.includes('🎯') || message.includes('Market') || 
          message.includes('Price') || message.includes('fetch') || message.includes('Batch')) {
        setLogs(prev => {
          const newLog: MarketLogEntry = {
            timestamp: Date.now(),
            level,
            message,
            data: args.length > 1 ? args.slice(1) : undefined
          };
          // Keep last 100 logs
          return [...prev.slice(-99), newLog];
        });
      }
    };

    console.log = (...args: any[]) => {
      originalLog(...args);
      addLog('info', ...args);
    };

    console.warn = (...args: any[]) => {
      originalWarn(...args);
      addLog('warn', ...args);
    };

    console.error = (...args: any[]) => {
      originalError(...args);
      addLog('error', ...args);
    };

    return () => {
      console.log = originalLog;
      console.warn = originalWarn;
      console.error = originalError;
    };
  }, [isEnabled]);

  const toggleEnabled = () => {
    const newEnabled = !isEnabled;
    setIsEnabled(newEnabled);
    localStorage.setItem('market_debug_enabled', String(newEnabled));
    if (!newEnabled) {
      setLogs([]);
    }
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const getLogColor = (level: string) => {
    switch (level) {
      case 'error': return 'text-red-400';
      case 'warn': return 'text-yellow-400';
      case 'debug': return 'text-blue-400';
      default: return 'text-gray-300';
    }
  };

  if (!isOpen && !isEnabled) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-50 p-2 bg-gray-800 rounded-lg border border-gray-700 hover:bg-gray-700 transition-colors"
        title="Open Market Debug"
      >
        <Bug size={16} className="text-gray-400" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-96 max-h-[600px] bg-gray-900 border border-gray-700 rounded-lg shadow-xl flex flex-col">
      <div className="flex items-center justify-between p-3 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <Bug size={16} className="text-blue-400" />
          <span className="text-sm font-semibold text-white">Market Debug</span>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-xs text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={isEnabled}
              onChange={toggleEnabled}
              className="w-3 h-3"
            />
            <span>Enable</span>
          </label>
          {logs.length > 0 && (
            <button
              onClick={clearLogs}
              className="text-xs text-gray-400 hover:text-gray-300"
            >
              Clear
            </button>
          )}
          <button
            onClick={() => setIsOpen(false)}
            className="text-gray-400 hover:text-gray-300"
          >
            <X size={16} />
          </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {logs.length === 0 ? (
          <div className="text-xs text-gray-500 text-center py-4">
            {isEnabled ? 'No market logs yet...' : 'Enable logging to see market fetch logs'}
          </div>
        ) : (
          logs.map((log, index) => (
            <div
              key={index}
              className={`text-xs ${getLogColor(log.level)} font-mono p-2 bg-gray-800/50 rounded border-l-2 ${
                log.level === 'error' ? 'border-red-500' :
                log.level === 'warn' ? 'border-yellow-500' :
                'border-blue-500'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="flex-1 break-words">{log.message}</span>
                <span className="text-[10px] text-gray-500 whitespace-nowrap">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
              </div>
              {log.data && log.data.length > 0 && (
                <pre className="text-[10px] text-gray-500 mt-1 overflow-x-auto">
                  {JSON.stringify(log.data, null, 2)}
                </pre>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default MarketDebugOverlay;
