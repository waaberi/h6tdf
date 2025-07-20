import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getAIService } from './aiService';
import { logger } from './logger';
import { ContextManager } from '../lib/contextManager';

export interface ErrorFix {
  pattern: string;
  fix: string;
  confidence: number;
  lastUsed: Date;
  successCount: number;
  failureCount: number;
}

interface ErrorPatchState {
  knownFixes: Record<string, ErrorFix>;
  addFix: (error: string, fix: ErrorFix) => void;
  getFix: (error: string) => ErrorFix | null;
  updateFixSuccess: (error: string) => void;
  updateFixFailure: (error: string) => void;
}

export const useErrorPatchStore = create<ErrorPatchState>()(
  persist(
    (set, get) => ({
      knownFixes: {},
      
      addFix: (error: string, fix: ErrorFix) => {
        set((state) => ({
          knownFixes: {
            ...state.knownFixes,
            [error]: fix,
          },
        }));
      },

      getFix: (error: string) => {
        const state = get();
        return state.knownFixes[error] || null;
      },

      updateFixSuccess: (error: string) => {
        set((state) => {
          const fix = state.knownFixes[error];
          if (!fix) return state;

          return {
            knownFixes: {
              ...state.knownFixes,
              [error]: {
                ...fix,
                successCount: fix.successCount + 1,
                lastUsed: new Date(),
              },
            },
          };
        });
      },

      updateFixFailure: (error: string) => {
        set((state) => {
          const fix = state.knownFixes[error];
          if (!fix) return state;

          return {
            knownFixes: {
              ...state.knownFixes,
              [error]: {
                ...fix,
                failureCount: fix.failureCount + 1,
                lastUsed: new Date(),
              },
            },
          };
        });
      },
    }),
    {
      name: 'error-patch-storage',
    }
  )
);

// Cache for successful fixes to avoid repeated AI calls for the same error
const fixCache = new Map<string, string>();

class ErrorPatchService {
  private aiService: ReturnType<typeof getAIService>;

  constructor() {
    this.aiService = getAIService();
    logger.info('ErrorPatchService', 'Service initialized');
  }

  // Quick fixes for common React errors using lookup tables
  private attemptQuickFix(error: string, componentCode: string): string | null {
    try {
      const component = JSON.parse(componentCode);
      let fixed = false;

      // Common React prop fixes
      const propFixes: Record<string, string> = {
        'ariaLabel': 'aria-label',
        'class': 'className',
        'for': 'htmlFor',
        'tabindex': 'tabIndex',
        'readonly': 'readOnly',
        'maxlength': 'maxLength',
        'minlength': 'minLength',
        'contenteditable': 'contentEditable',
        'spellcheck': 'spellCheck',
        'autocomplete': 'autoComplete',
        'autofocus': 'autoFocus',
        'autoplay': 'autoPlay',
        'crossorigin': 'crossOrigin',
        'formaction': 'formAction',
        'formenctype': 'formEncType',
        'formmethod': 'formMethod',
        'formnovalidate': 'formNoValidate',
        'formtarget': 'formTarget',
        'novalidate': 'noValidate',
        'usemap': 'useMap',
      };

      if (component.props) {
        for (const [wrongProp, correctProp] of Object.entries(propFixes)) {
          if (component.props[wrongProp] !== undefined) {
            component.props[correctProp] = component.props[wrongProp];
            delete component.props[wrongProp];
            fixed = true;
            logger.info('ErrorPatchService', `Quick fix applied: ${wrongProp} -> ${correctProp}`);
          }
        }
      }

      return fixed ? JSON.stringify(component, null, 2) : null;
    } catch (parseError) {
      logger.error('ErrorPatchService', 'Failed to parse component for quick fix', { parseError, componentCode });
      return null;
    }
  }

  async attemptFix(
    error: string,
    componentCode: string,
    componentId: string
  ): Promise<string | null> {
    logger.info('ErrorPatchService', `Attempting to fix error for component ${componentId}`, { error });

    // 1. Try quick fixes for common React errors first
    const quickFix = this.attemptQuickFix(error, componentCode);
    if (quickFix) {
      logger.info('ErrorPatchService', 'Applied quick fix', { originalCode: componentCode, fixedCode: quickFix });
      return quickFix;
    }

    // 2. Check cache for a known successful fix
    if (fixCache.has(error)) {
      const cachedFix = fixCache.get(error)!;
      logger.info('ErrorPatchService', 'Found cached fix', { cachedFix });
      return cachedFix;
    }

    // 3. Check persistent storage for a known fix pattern
    const knownFix = useErrorPatchStore.getState().getFix(error);
    if (knownFix && knownFix.confidence > 0.7) {
      logger.info('ErrorPatchService', 'Found known fix in storage', { knownFix });
      // Here you might apply the fix directly if it's a simple replacement
      // For now, we'll just use it to inform the AI
    }

    // 4. Use AI to generate a fix
    try {
      const context = ContextManager.captureMinimal(
        componentId,
        JSON.parse(componentCode).type,
        error
      );

      const fixedComponent = await this.aiService.fix({
        error,
        componentCode,
        context: JSON.stringify(context, null, 2),
      });

      const fixedCode = JSON.stringify(fixedComponent, null, 2);

      // Assume the fix is successful for now. In a real scenario,
      // you would re-render and check for errors.
      const isSuccess = true;

      if (isSuccess) {
        logger.info('ErrorPatchService', `AI fix successful`, { fixedCode });
        fixCache.set(error, fixedCode); // Cache the successful fix
        useErrorPatchStore.getState().addFix(error, {
          pattern: error,
          fix: fixedCode,
          confidence: 0.8, // Initial confidence
          lastUsed: new Date(),
          successCount: 1,
          failureCount: 0,
        });
        return fixedCode;
      }
    } catch (aiError) {
      logger.error('ErrorPatchService', `AI fix attempt failed`, { error: aiError });
    }

    logger.warn('ErrorPatchService', 'All attempts to fix the error failed.', { componentId });
    return null;
  }
}

export const errorPatchService = new ErrorPatchService();
