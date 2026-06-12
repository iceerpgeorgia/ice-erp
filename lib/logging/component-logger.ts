/**
 * Advanced component logging system to catch UI breaks and track lifecycle issues
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  component: string;
  message: string;
  data?: Record<string, unknown>;
  stack?: string;
  duration?: number;
}

class ComponentLogger {
  private logs: LogEntry[] = [];
  private maxLogs = 500; // Keep last 500 logs in memory
  private timers: Map<string, number> = new Map();
  private isClient = typeof window !== 'undefined';

  log(
    level: LogLevel,
    component: string,
    message: string,
    data?: Record<string, unknown>,
  ) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      component,
      message,
      data,
      stack:
        level === 'error' || level === 'warn'
          ? new Error().stack?.split('\n').slice(1, 4).join(' | ')
          : undefined,
    };

    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development' || level === 'error') {
      if (level === 'debug') {
        console.log(`[${component}] ${message}`, data);
      } else if (level === 'warn') {
        console.warn(`[${component}] ${message}`, data);
      } else if (level === 'error') {
        console.error(`[${component}] ${message}`, data);
      } else {
        console.info(`[${component}] ${message}`, data);
      }
    }

    // Send error logs to monitoring
    if (level === 'error') {
      this.reportError(entry);
    }
  }

  debug(component: string, message: string, data?: Record<string, unknown>) {
    this.log('debug', component, message, data);
  }

  info(component: string, message: string, data?: Record<string, unknown>) {
    this.log('info', component, message, data);
  }

  warn(component: string, message: string, data?: Record<string, unknown>) {
    this.log('warn', component, message, data);
  }

  error(component: string, message: string, data?: Record<string, unknown>) {
    this.log('error', component, message, data);
  }

  startTimer(id: string) {
    this.timers.set(id, performance.now());
  }

  endTimer(
    id: string,
    component: string,
    message: string,
    data?: Record<string, unknown>,
  ) {
    const start = this.timers.get(id);
    if (!start) return;

    const duration = performance.now() - start;
    this.timers.delete(id);

    this.log('debug', component, message, {
      ...data,
      duration: `${duration.toFixed(2)}ms`,
    });

    return duration;
  }

  /** Track render cycles */
  trackRender(component: string, props?: Record<string, unknown>) {
    this.debug(component, 'Render', {
      viewport: this.isClient ? `${window.innerWidth}x${window.innerHeight}` : 'server',
      ...props,
    });
  }

  /** Track mount/unmount lifecycle */
  trackMount(component: string, data?: Record<string, unknown>) {
    this.info(component, 'Mounted', data);
  }

  trackUnmount(component: string, data?: Record<string, unknown>) {
    this.info(component, 'Unmounted', data);
  }

  /** Track hydration mismatch */
  trackHydrationIssue(
    component: string,
    serverValue: unknown,
    clientValue: unknown,
  ) {
    this.warn(component, 'Hydration Mismatch', {
      serverValue: String(serverValue),
      clientValue: String(clientValue),
    });
  }

  /** Track DOM mutations */
  trackDOMMutation(component: string, selector: string, mutation: string) {
    this.debug(component, 'DOM Mutation', {
      selector,
      mutation,
      domSize: this.isClient
        ? document.body.innerHTML.length
        : 'not-available',
    });
  }

  /** Get all logs for debugging */
  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  /** Get logs filtered by component */
  getLogsByComponent(component: string): LogEntry[] {
    return this.logs.filter((l) => l.component === component);
  }

  /** Get error logs only */
  getErrorLogs(): LogEntry[] {
    return this.logs.filter((l) => l.level === 'error' || l.level === 'warn');
  }

  /** Export logs as JSON for debugging */
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  /** Report error to monitoring service (placeholder) */
  private reportError(entry: LogEntry) {
    // In production, send to error tracking service
    // e.g., Sentry, LogRocket, etc.
    if (typeof window !== 'undefined') {
      // Send to /api/logs endpoint
      fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...entry,
          userAgent: navigator.userAgent,
          url: window.location.href,
          timestamp: new Date().toISOString(),
        }),
      }).catch(() => {
        // Silently fail if logging fails
      });
    }
  }

  /** Clear all logs */
  clear() {
    this.logs = [];
    this.timers.clear();
  }
}

// Singleton instance
export const logger = new ComponentLogger();

// Hook for React components
export function useComponentLogger(componentName: string) {
  return {
    debug: (message: string, data?: Record<string, unknown>) =>
      logger.debug(componentName, message, data),
    info: (message: string, data?: Record<string, unknown>) =>
      logger.info(componentName, message, data),
    warn: (message: string, data?: Record<string, unknown>) =>
      logger.warn(componentName, message, data),
    error: (message: string, data?: Record<string, unknown>) =>
      logger.error(componentName, message, data),
    trackRender: (props?: Record<string, unknown>) =>
      logger.trackRender(componentName, props),
    trackMount: (data?: Record<string, unknown>) =>
      logger.trackMount(componentName, data),
    trackUnmount: (data?: Record<string, unknown>) =>
      logger.trackUnmount(componentName, data),
    trackHydrationIssue: (serverValue: unknown, clientValue: unknown) =>
      logger.trackHydrationIssue(componentName, serverValue, clientValue),
    startTimer: (id: string) => logger.startTimer(`${componentName}-${id}`),
    endTimer: (
      id: string,
      message: string,
      data?: Record<string, unknown>,
    ) =>
      logger.endTimer(`${componentName}-${id}`, componentName, message, data),
  };
}
