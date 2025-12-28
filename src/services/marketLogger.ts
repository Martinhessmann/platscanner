// Market Logger Service - Similar to ocrLogger but for market fetch operations

interface MarketLogEntry {
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  data?: any;
}

class MarketLogger {
  private logs: MarketLogEntry[] = [];
  private maxLogs = 500;
  private verboseLogging = false;

  log(level: 'info' | 'warn' | 'error' | 'debug', message: string, data?: any) {
    // Only log market-related messages
    if (!this.verboseLogging && level === 'debug') {
      return;
    }

    const entry: MarketLogEntry = {
      timestamp: Date.now(),
      level,
      message,
      data
    };

    this.logs.push(entry);
    
    // Keep only the last maxLogs entries
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
  }

  info(message: string, data?: any) {
    this.log('info', message, data);
  }

  warn(message: string, data?: any) {
    this.log('warn', message, data);
  }

  error(message: string, data?: any) {
    this.log('error', message, data);
  }

  debug(message: string, data?: any) {
    this.log('debug', message, data);
  }

  getRecentLogs(count: number = 100): MarketLogEntry[] {
    return this.logs.slice(-count);
  }

  getLogCount(): number {
    return this.logs.length;
  }

  clearLogs() {
    this.logs = [];
  }

  isVerboseLoggingEnabled(): boolean {
    return this.verboseLogging;
  }

  setVerboseLogging(enabled: boolean) {
    this.verboseLogging = enabled;
    localStorage.setItem('market_debug_verbose', String(enabled));
  }

  // Initialize from localStorage
  init() {
    const stored = localStorage.getItem('market_debug_verbose');
    if (stored !== null) {
      this.verboseLogging = stored === 'true';
    }
  }
}

export const marketLogger = new MarketLogger();
marketLogger.init();

// Intercept console logs for market-related operations
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

console.log = (...args: any[]) => {
  originalConsoleLog(...args);
  const message = args.map(arg => 
    typeof arg === 'string' ? arg : JSON.stringify(arg, null, 2)
  ).join(' ');
  
  // Only capture market-related logs
  if (message.includes('💰') || message.includes('🎯') || message.includes('Market') || 
      message.includes('Price') || message.includes('fetch') || message.includes('Batch') ||
      message.includes('[Prime Set]') || message.includes('[Batch Refresh]') ||
      message.includes('[Market Analysis]') || message.includes('[Individual Set]')) {
    marketLogger.info(message, args.length > 1 ? args.slice(1) : undefined);
  }
};

console.warn = (...args: any[]) => {
  originalConsoleWarn(...args);
  const message = args.map(arg => 
    typeof arg === 'string' ? arg : JSON.stringify(arg, null, 2)
  ).join(' ');
  
  if (message.includes('💰') || message.includes('🎯') || message.includes('Market') || 
      message.includes('Price') || message.includes('fetch') || message.includes('Batch') ||
      message.includes('[Prime Set]') || message.includes('[Batch Refresh]') ||
      message.includes('[Market Analysis]') || message.includes('[Individual Set]')) {
    marketLogger.warn(message, args.length > 1 ? args.slice(1) : undefined);
  }
};

console.error = (...args: any[]) => {
  originalConsoleError(...args);
  const message = args.map(arg => 
    typeof arg === 'string' ? arg : JSON.stringify(arg, null, 2)
  ).join(' ');
  
  if (message.includes('💰') || message.includes('🎯') || message.includes('Market') || 
      message.includes('Price') || message.includes('fetch') || message.includes('Batch') ||
      message.includes('[Prime Set]') || message.includes('[Batch Refresh]') ||
      message.includes('[Market Analysis]') || message.includes('[Individual Set]')) {
    marketLogger.error(message, args.length > 1 ? args.slice(1) : undefined);
  }
};
