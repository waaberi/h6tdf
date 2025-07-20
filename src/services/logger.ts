// Singleton logger for consistent logging across the application
class Logger {
  private static instance: Logger;
  private debugMode: boolean = true;

  private constructor() {}

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
  }

  private safeStringify(obj: unknown): string {
    try {
      return JSON.stringify(obj, (key, value) => {
        // Handle circular references by replacing them with a placeholder
        if (typeof value === 'object' && value !== null) {
          // Check for common circular reference patterns
          if (value instanceof HTMLElement) {
            return {
              tagName: (value as HTMLElement).tagName,
              id: (value as HTMLElement).id,
              className: (value as HTMLElement).className,
              textContent: (value as HTMLElement).textContent?.slice(0, 100)
            };
          }
          // Check for React fiber nodes and other circular objects
          if (value.constructor && (
            value.constructor.name === 'FiberNode' || 
            key.includes('Fiber') || 
            key.includes('react')
          )) {
            return '[Circular/React Object]';
          }
        }
        return value;
      }, 2);
    } catch (error) {
      return `[Unable to stringify: ${error instanceof Error ? error.message : 'Unknown error'}]`;
    }
  }

  private formatMessage(type: string, module: string, message: string, data?: unknown): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${type}] [${module}] ${message}${data ? '\nData: ' + this.safeStringify(data) : ''}`;
  }

  info(module: string, message: string, data?: unknown): void {
    const formattedMessage = this.formatMessage('INFO', module, message, data);
    console.info(formattedMessage);
  }

  warn(module: string, message: string, data?: unknown): void {
    const formattedMessage = this.formatMessage('WARN', module, message, data);
    console.warn(formattedMessage);
  }

  error(module: string, message: string, data?: unknown): void {
    const formattedMessage = this.formatMessage('ERROR', module, message, data);
    console.error(formattedMessage);
  }

  debug(module: string, message: string, data?: unknown): void {
    if (this.debugMode) {
      const formattedMessage = this.formatMessage('DEBUG', module, message, data);
      console.debug(formattedMessage);
    }
  }

  startOperation(module: string, operation: string): void {
    this.debug(module, `Starting operation: ${operation}`);
  }

  endOperation(module: string, operation: string, success: boolean): void {
    this.debug(module, `Operation ${operation} ${success ? 'succeeded' : 'failed'}`);
  }
}

export const logger = Logger.getInstance();
