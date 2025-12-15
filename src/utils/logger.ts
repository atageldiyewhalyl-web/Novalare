/**
 * Logger utility that only logs in development mode.
 * Use this instead of console.log/error/warn throughout the app
 * to prevent logging in production.
 */

const isDev = import.meta.env.DEV;

type LogLevel = 'log' | 'info' | 'warn' | 'error' | 'debug';

interface LoggerOptions {
  prefix?: string;
  enabled?: boolean;
}

class Logger {
  private prefix: string;
  private enabled: boolean;

  constructor(options: LoggerOptions = {}) {
    this.prefix = options.prefix || '';
    this.enabled = options.enabled ?? isDev;
  }

  private formatMessage(level: LogLevel, ...args: unknown[]): unknown[] {
    if (this.prefix) {
      return [`[${this.prefix}]`, ...args];
    }
    return args;
  }

  log(...args: unknown[]): void {
    if (this.enabled) {
      console.log(...this.formatMessage('log', ...args));
    }
  }

  info(...args: unknown[]): void {
    if (this.enabled) {
      console.info(...this.formatMessage('info', ...args));
    }
  }

  warn(...args: unknown[]): void {
    if (this.enabled) {
      console.warn(...this.formatMessage('warn', ...args));
    }
  }

  error(...args: unknown[]): void {
    if (this.enabled) {
      console.error(...this.formatMessage('error', ...args));
    }
  }

  debug(...args: unknown[]): void {
    if (this.enabled) {
      console.debug(...this.formatMessage('debug', ...args));
    }
  }

  /**
   * Create a new logger with a specific prefix
   */
  createChild(prefix: string): Logger {
    const childPrefix = this.prefix ? `${this.prefix}:${prefix}` : prefix;
    return new Logger({ prefix: childPrefix, enabled: this.enabled });
  }

  /**
   * Log a group of related messages
   */
  group(label: string, fn: () => void): void {
    if (this.enabled) {
      console.group(this.prefix ? `[${this.prefix}] ${label}` : label);
      try {
        fn();
      } finally {
        console.groupEnd();
      }
    }
  }

  /**
   * Time an operation
   */
  time<T>(label: string, fn: () => T): T {
    if (!this.enabled) {
      return fn();
    }
    
    const timerLabel = this.prefix ? `[${this.prefix}] ${label}` : label;
    console.time(timerLabel);
    try {
      return fn();
    } finally {
      console.timeEnd(timerLabel);
    }
  }

  /**
   * Time an async operation
   */
  async timeAsync<T>(label: string, fn: () => Promise<T>): Promise<T> {
    if (!this.enabled) {
      return fn();
    }
    
    const timerLabel = this.prefix ? `[${this.prefix}] ${label}` : label;
    console.time(timerLabel);
    try {
      return await fn();
    } finally {
      console.timeEnd(timerLabel);
    }
  }

  /**
   * Create a table in the console
   */
  table(data: unknown): void {
    if (this.enabled) {
      if (this.prefix) {
        console.log(`[${this.prefix}]`);
      }
      console.table(data);
    }
  }
}

// Default logger instance
export const logger = new Logger();

// Named loggers for different parts of the app
export const apiLogger = new Logger({ prefix: 'API' });
export const authLogger = new Logger({ prefix: 'Auth' });
export const routerLogger = new Logger({ prefix: 'Router' });

// Export Logger class for custom instances
export { Logger };

// Export isDev for direct checks
export { isDev };

