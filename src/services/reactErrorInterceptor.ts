import { logger } from './logger';
import { patchService } from './patchService';
import { isValidHTMLElement, isWebComponent } from '@/lib/elementUtils';

interface ReactError {
  type: 'error' | 'warning';
  message: string;
  component?: string;
  props?: Record<string, unknown>;
  stack?: string;
}

class ReactErrorInterceptor {
  private static instance: ReactErrorInterceptor;
  private originalConsole: Partial<Console>;

  private constructor() {
    this.originalConsole = {
      error: console.error,
      warn: console.warn,
    };
  }

  static getInstance(): ReactErrorInterceptor {
    if (!ReactErrorInterceptor.instance) {
      ReactErrorInterceptor.instance = new ReactErrorInterceptor();
    }
    return ReactErrorInterceptor.instance;
  }

  private extractComponentInfoFromArgs(args: unknown[]): { componentName?: string; props?: Record<string, unknown>, source?: string } {
    logger.debug('ReactErrorInterceptor', 'Extracting component info from console args', { args });
    for (const arg of args) {
        // React often logs the component stack as a string starting with "\n    in "
        if (typeof arg === 'string' && arg.includes('\n    in ')) {
            const lines = arg.split('\n');
            for (const line of lines) {
                const trimmedLine = line.trim();
                if (trimmedLine.startsWith('in ')) {
                    const componentNameMatch = trimmedLine.match(/in ([\w\d_]+)/);
                    const sourceMatch = trimmedLine.match(/ \(at ([\w\d\s.:/\\_-]+)\)/);
                    const componentName = componentNameMatch ? componentNameMatch[1] : 'Unknown';
                    const source = sourceMatch ? sourceMatch[1] : 'Unknown';
                    logger.debug('ReactErrorInterceptor', 'Extracted component from stack trace', { componentName, source });
                    // This is a best-effort extraction, we don't get props this way.
                    return { componentName, source };
                }
            }
        }
    }
    logger.warn('ReactErrorInterceptor', 'Could not extract component info from args.');
    return {};
  }

  private parseReactError(type: 'error' | 'warning', args: unknown[]): ReactError | null {
    logger.startOperation('ReactErrorInterceptor', `parseReactError (type: ${type})`);
    const message = args.map(arg => (typeof arg === 'object' ? JSON.stringify(arg) : String(arg))).join(' ');

    // Handle "Unknown component type" errors specifically
    if (message.includes('Unknown component type')) {
      const elementMatch = message.match(/Unknown component type:\s*(\w+)/);
      const elementType = elementMatch ? elementMatch[1] : null;
      
      if (elementType) {
        // Don't intercept valid HTML5 elements or web components
        if (isValidHTMLElement(elementType)) {
          logger.debug('ReactErrorInterceptor', `Valid HTML5 element "${elementType}" - letting DynamicRenderer handle it`);
          logger.endOperation('ReactErrorInterceptor', 'parseReactError', false);
          return null;
        }
        
        if (isWebComponent(elementType)) {
          logger.debug('ReactErrorInterceptor', `Web component "${elementType}" detected - assuming it's properly registered`);
          logger.endOperation('ReactErrorInterceptor', 'parseReactError', false);
          return null;
        }
        
        // Only intercept truly unknown/invalid elements (likely typos)
        const error: ReactError = {
          type,
          message,
          component: elementType,
          props: {},
          stack: new Error().stack,
        };
        logger.debug('ReactErrorInterceptor', `Parsed React Error for unknown element "${elementType}"`, error);
        logger.endOperation('ReactErrorInterceptor', 'parseReactError', true);
        return error;
      }
    }

    // Handle other React errors (onClick handlers, etc.)
    if (
      message.includes('Expected `onClick` listener to be a function') ||
      message.includes('Invalid event handler property')
    ) {
      const { componentName, props, source } = this.extractComponentInfoFromArgs(args);
      const error: ReactError = {
        type,
        message,
        component: componentName || 'UnknownComponent',
        props: props || {},
        stack: source || new Error().stack,
      };
      logger.debug('ReactErrorInterceptor', 'Parsed React Error', error);
      logger.endOperation('ReactErrorInterceptor', 'parseReactError', true);
      return error;
    }
    
    logger.endOperation('ReactErrorInterceptor', 'parseReactError', false);
    return null;
  }

  intercept(): void {
    const origError = this.originalConsole.error?.bind(console);
    const origWarn = this.originalConsole.warn?.bind(console);

    console.error = (...args: unknown[]) => {
      // Only handle relevant React errors
      const reactError = this.parseReactError('error', args);
      if (reactError) {
        logger.info(
          'ReactErrorInterceptor',
          `React error intercepted for component ${reactError.component}`,
          { message: reactError.message }
        );
        // Queue patch request
        patchService.queuePatch(reactError.component || 'unknown', reactError.message);
      } else {
        // Not a React error we care about
        logger.debug('ReactErrorInterceptor', 'Ignored non-React console.error', { args });
      }
      // Always call original
      origError?.(...args);
    };

    console.warn = (...args: unknown[]) => {
      // Only handle relevant React warnings
      const reactError = this.parseReactError('warning', args);
      if (reactError) {
        logger.info(
          'ReactErrorInterceptor',
          `React warning intercepted for component ${reactError.component}`,
          { message: reactError.message }
        );
        patchService.queuePatch(reactError.component || 'unknown', reactError.message);
      } else {
        // Not a React warning we care about
        logger.debug('ReactErrorInterceptor', 'Ignored non-React console.warn', { args });
      }
      // Always call original
      origWarn?.(...args);
    };

    logger.info('ReactErrorInterceptor', 'Error interceptor installed');
  }

  restore(): void {
    if (this.originalConsole.error) {
      console.error = this.originalConsole.error;
    }
    if (this.originalConsole.warn) {
      console.warn = this.originalConsole.warn;
    }
    logger.info('ReactErrorInterceptor', 'Error interceptor removed');
  }
}

export const reactErrorInterceptor = ReactErrorInterceptor.getInstance();
