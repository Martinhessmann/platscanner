// Reservation Logger Service - Tracks reservation checks and updates

interface ReservationLogEntry {
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'debug';
  category: 'reservation_check' | 'reservation_update' | 'set_planning' | 'cleanup' | 'sync';
  message: string;
  data?: any;
}

class ReservationLogger {
  private logs: ReservationLogEntry[] = [];
  private maxLogs = 500;
  private verboseLogging = false;

  log(level: 'info' | 'warn' | 'error' | 'debug', category: ReservationLogEntry['category'], message: string, data?: any) {
    // Only log debug messages if verbose logging is enabled
    if (!this.verboseLogging && level === 'debug') {
      return;
    }

    const entry: ReservationLogEntry = {
      timestamp: Date.now(),
      level,
      category,
      message,
      data
    };

    this.logs.push(entry);

    // Keep only the last maxLogs entries
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
  }

  info(category: ReservationLogEntry['category'], message: string, data?: any) {
    this.log('info', category, message, data);
  }

  warn(category: ReservationLogEntry['category'], message: string, data?: any) {
    this.log('warn', category, message, data);
  }

  error(category: ReservationLogEntry['category'], message: string, data?: any) {
    this.log('error', category, message, data);
  }

  debug(category: ReservationLogEntry['category'], message: string, data?: any) {
    this.log('debug', category, message, data);
  }

  getRecentLogs(count: number = 100): ReservationLogEntry[] {
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
    localStorage.setItem('reservation_debug_verbose', String(enabled));
  }

  init() {
    const stored = localStorage.getItem('reservation_debug_verbose');
    if (stored) {
      this.verboseLogging = stored === 'true';
    }
  }
}

export const reservationLogger = new ReservationLogger();
reservationLogger.init();
