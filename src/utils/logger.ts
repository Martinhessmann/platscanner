type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type LogContext = string;

interface LogConfig {
  level: LogLevel;
  contexts: Set<string>;
}

class Logger {
  private config: LogConfig = {
    level: 'info',
    contexts: new Set()
  };

  private logLevels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
  };

  constructor() {
    // Initialize from localStorage or environment
    const savedLevel = localStorage.getItem('platscanner_log_level') as LogLevel;
    const savedContexts = localStorage.getItem('platscanner_log_contexts');
    
    if (savedLevel && this.logLevels[savedLevel] !== undefined) {
      this.config.level = savedLevel;
    }
    
    if (savedContexts) {
      try {
        const contexts = JSON.parse(savedContexts);
        this.config.contexts = new Set(contexts);
      } catch (e) {
        // Ignore invalid JSON
      }
    }

    // Development mode defaults
    if (process.env.NODE_ENV === 'development') {
      this.config.level = 'debug';
      this.config.contexts = new Set(['*']); // Log all contexts in dev
    }
  }

  private shouldLog(level: LogLevel, context?: LogContext): boolean {
    // Check log level
    if (this.logLevels[level] < this.logLevels[this.config.level]) {
      return false;
    }

    // Check context filter
    if (context && this.config.contexts.size > 0) {
      const hasWildcard = this.config.contexts.has('*');
      const hasContext = this.config.contexts.has(context);
      return hasWildcard || hasContext;
    }

    return true;
  }

  private formatMessage(level: LogLevel, context: LogContext | undefined, message: string, ...args: any[]): [string, ...any[]] {
    const timestamp = new Date().toLocaleTimeString();
    const contextStr = context ? `[${context}]` : '';
    const levelStr = `[${level.toUpperCase()}]`;
    
    return [`${timestamp} ${levelStr}${contextStr} ${message}`, ...args];
  }

  debug(context: LogContext, message: string, ...args: any[]): void;
  debug(message: string, ...args: any[]): void;
  debug(contextOrMessage: string, message?: string, ...args: any[]): void {
    const [ctx, msg, ...rest] = message !== undefined 
      ? [contextOrMessage, message, ...args]
      : [undefined, contextOrMessage, ...args];
    
    if (this.shouldLog('debug', ctx)) {
      console.debug(...this.formatMessage('debug', ctx, msg, ...rest));
    }
  }

  info(context: LogContext, message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  info(contextOrMessage: string, message?: string, ...args: any[]): void {
    const [ctx, msg, ...rest] = message !== undefined 
      ? [contextOrMessage, message, ...args]
      : [undefined, contextOrMessage, ...args];
    
    if (this.shouldLog('info', ctx)) {
      console.info(...this.formatMessage('info', ctx, msg, ...rest));
    }
  }

  warn(context: LogContext, message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  warn(contextOrMessage: string, message?: string, ...args: any[]): void {
    const [ctx, msg, ...rest] = message !== undefined 
      ? [contextOrMessage, message, ...args]
      : [undefined, contextOrMessage, ...args];
    
    if (this.shouldLog('warn', ctx)) {
      console.warn(...this.formatMessage('warn', ctx, msg, ...rest));
    }
  }

  error(context: LogContext, message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
  error(contextOrMessage: string, message?: string, ...args: any[]): void {
    const [ctx, msg, ...rest] = message !== undefined 
      ? [contextOrMessage, message, ...args]
      : [undefined, contextOrMessage, ...args];
    
    if (this.shouldLog('error', ctx)) {
      console.error(...this.formatMessage('error', ctx, msg, ...rest));
    }
  }

  // Configuration methods
  setLevel(level: LogLevel): void {
    this.config.level = level;
    localStorage.setItem('platscanner_log_level', level);
  }

  addContext(context: LogContext): void {
    this.config.contexts.add(context);
    localStorage.setItem('platscanner_log_contexts', JSON.stringify([...this.config.contexts]));
  }

  removeContext(context: LogContext): void {
    this.config.contexts.delete(context);
    localStorage.setItem('platscanner_log_contexts', JSON.stringify([...this.config.contexts]));
  }

  clearContexts(): void {
    this.config.contexts.clear();
    localStorage.removeItem('platscanner_log_contexts');
  }

  // Helper for conditional bulk logging
  withContext(context: LogContext) {
    return {
      debug: (message: string, ...args: any[]) => this.debug(context, message, ...args),
      info: (message: string, ...args: any[]) => this.info(context, message, ...args),
      warn: (message: string, ...args: any[]) => this.warn(context, message, ...args),
      error: (message: string, ...args: any[]) => this.error(context, message, ...args),
      
      // For bulk operations - only log if enabled for this context
      isEnabled: () => this.shouldLog('debug', context),
      
      // Summary logging - always use info level for summaries
      summary: (message: string, ...args: any[]) => this.info(context, `[SUMMARY] ${message}`, ...args)
    };
  }
}

// Export singleton instance
export const logger = new Logger();

// Export types for external use
export type { LogLevel, LogContext };