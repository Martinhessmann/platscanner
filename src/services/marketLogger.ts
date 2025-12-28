// Market Logger - Stores logs for debugging Warframe Market API calls

export interface MarketLogEntry {
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'debug';
  category: string;
  message: string;
  data?: any;
}

const MAX_LOGS = 500;
const LOG_STORAGE_KEY = 'platscanner_market_logs';
const LOGGING_ENABLED_KEY = 'platscanner_market_logging_enabled';

class MarketLogger {
  private logs: MarketLogEntry[] = [];

  constructor() {
    this.loadLogs();
  }

  private loadLogs(): void {
    try {
      const stored = localStorage.getItem(LOG_STORAGE_KEY);
      if (stored) {
        this.logs = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load market logs:', error);
      this.logs = [];
    }
  }

  private saveLogs(): void {
    try {
      if (this.logs.length > MAX_LOGS) {
        this.logs = this.logs.slice(-MAX_LOGS);
      }
      localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(this.logs));
    } catch (error) {
      console.error('Failed to save market logs:', error);
    }
  }

  private isLoggingEnabled(): boolean {
    try {
      const enabled = localStorage.getItem(LOGGING_ENABLED_KEY);
      return enabled !== 'false';
    } catch {
      return true;
    }
  }

  private addLog(level: MarketLogEntry['level'], category: string, message: string, data?: any): void {
    if (!this.isLoggingEnabled()) {
      return;
    }

    const entry: MarketLogEntry = {
      timestamp: Date.now(),
      level,
      category,
      message,
      data: data !== undefined ? (typeof data === 'object' ? JSON.parse(JSON.stringify(data)) : data) : undefined
    };

    this.logs.push(entry);
    this.saveLogs();

    const consoleMethod = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
    const prefix = `[Market ${category}]`;
    if (data !== undefined) {
      console[consoleMethod](prefix, message, data);
    } else {
      console[consoleMethod](prefix, message);
    }
  }

  info(category: string, message: string, data?: any): void {
    this.addLog('info', category, message, data);
  }

  warn(category: string, message: string, data?: any): void {
    this.addLog('warn', category, message, data);
  }

  error(category: string, message: string, data?: any): void {
    this.addLog('error', category, message, data);
  }

  debug(category: string, message: string, data?: any): void {
    this.addLog('debug', category, message, data);
  }

  getLogs(limit?: number): MarketLogEntry[] {
    if (limit) {
      return this.logs.slice(-limit);
    }
    return [...this.logs];
  }

  getRecentLogs(count: number = 100): MarketLogEntry[] {
    return this.logs.slice(-count);
  }

  clearLogs(): void {
    this.logs = [];
    this.saveLogs();
  }

  getLogCount(): number {
    return this.logs.length;
  }

  isVerboseLoggingEnabled(): boolean {
    return this.isLoggingEnabled();
  }

  setVerboseLogging(enabled: boolean): void {
    try {
      localStorage.setItem(LOGGING_ENABLED_KEY, enabled ? 'true' : 'false');
    } catch (error) {
      console.error('Failed to save market logging preference:', error);
    }
  }
}

export const marketLogger = new MarketLogger();
