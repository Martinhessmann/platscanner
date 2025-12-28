// OCR Logger - Stores logs for debugging OCR failures

export interface LogEntry {
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'debug';
  category: string;
  message: string;
  data?: any;
}

const MAX_LOGS = 500; // Keep last 500 log entries
const LOG_STORAGE_KEY = 'platscanner_ocr_logs';
const LOGGING_ENABLED_KEY = 'platscanner_logging_enabled';

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

  private isLoggingEnabled(): boolean {
    try {
      // Check if logging is enabled via user preference
      const enabled = localStorage.getItem(LOGGING_ENABLED_KEY);
      // Default to enabled if not set
      return enabled !== 'false';
    } catch {
      return true; // Default to logging if we can't check
    }
  }

  private addLog(level: LogEntry['level'], category: string, message: string, data?: any): void {
    // Check if logging is enabled
    if (!this.isLoggingEnabled()) {
      return; // Skip all logging when disabled
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

    // Also log to console for immediate debugging
    const consoleMethod = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
    const prefix = `[OCR ${category}]`;
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

  // Logging preference management - renamed for clarity
  isVerboseLoggingEnabled(): boolean {
    return this.isLoggingEnabled();
  }

  setVerboseLogging(enabled: boolean): void {
    try {
      localStorage.setItem(LOGGING_ENABLED_KEY, enabled ? 'true' : 'false');
    } catch (error) {
      console.error('Failed to save logging preference:', error);
    }
  }
}

// Export singleton instance
export const ocrLogger = new OCRLogger();
