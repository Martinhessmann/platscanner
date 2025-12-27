// OCR Logger - Stores verbose logs for debugging OCR failures

export interface LogEntry {
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'debug';
  category: string;
  message: string;
  data?: any;
}

const MAX_LOGS = 500; // Keep last 500 log entries
const LOG_STORAGE_KEY = 'platscanner_ocr_logs';
const VERBOSE_LOGGING_KEY = 'platscanner_verbose_logging_enabled';

class OCRLogger {
  private logs: LogEntry[] = [];

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
      console.error('Failed to load logs:', error);
      this.logs = [];
    }
  }

  private saveLogs(): void {
    try {
      // Keep only the most recent logs
      if (this.logs.length > MAX_LOGS) {
        this.logs = this.logs.slice(-MAX_LOGS);
      }
      localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(this.logs));
    } catch (error) {
      console.error('Failed to save logs:', error);
    }
  }

  private shouldLog(): boolean {
    // Always log errors and warnings
    // Check verbose logging preference for info/debug logs
    try {
      const isProduction = window.location.protocol === 'https:' || !window.location.hostname.includes('localhost');
      if (!isProduction) {
        return true; // Always log in development
      }
      
      // In production, check user preference
      const verboseEnabled = localStorage.getItem(VERBOSE_LOGGING_KEY);
      return verboseEnabled === 'true';
    } catch {
      return true; // Default to logging if we can't check
    }
  }

  private addLog(level: LogEntry['level'], category: string, message: string, data?: any): void {
    // Always log errors and warnings, but respect verbose setting for info/debug
    const shouldLogThis = level === 'error' || level === 'warn' || this.shouldLog();
    
    if (!shouldLogThis) {
      return; // Skip logging if verbose is disabled in production
    }

    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      category,
      message,
      data: data !== undefined ? (typeof data === 'object' ? JSON.parse(JSON.stringify(data)) : data) : undefined
    };

    this.logs.push(entry);
    this.saveLogs();

    // Also log to console for immediate debugging (respect same rules)
    if (shouldLogThis) {
      const consoleMethod = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
      const prefix = `[OCR ${category}]`;
      if (data !== undefined) {
        console[consoleMethod](prefix, message, data);
      } else {
        console[consoleMethod](prefix, message);
      }
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

  getLogs(limit?: number): LogEntry[] {
    if (limit) {
      return this.logs.slice(-limit);
    }
    return [...this.logs];
  }

  getRecentLogs(count: number = 100): LogEntry[] {
    return this.logs.slice(-count);
  }

  clearLogs(): void {
    this.logs = [];
    this.saveLogs();
  }

  getLogCount(): number {
    return this.logs.length;
  }

  // Verbose logging preference management
  isVerboseLoggingEnabled(): boolean {
    try {
      const isProduction = window.location.protocol === 'https:' || !window.location.hostname.includes('localhost');
      if (!isProduction) {
        return true; // Always enabled in development
      }
      const enabled = localStorage.getItem(VERBOSE_LOGGING_KEY);
      return enabled === 'true';
    } catch {
      return false; // Default to disabled in production if we can't check
    }
  }

  setVerboseLogging(enabled: boolean): void {
    try {
      localStorage.setItem(VERBOSE_LOGGING_KEY, enabled ? 'true' : 'false');
    } catch (error) {
      console.error('Failed to save verbose logging preference:', error);
    }
  }
}

// Export singleton instance
export const ocrLogger = new OCRLogger();
