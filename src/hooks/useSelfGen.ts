import { useCallback, createContext, useState, useRef, useEffect, createElement } from 'react';
import type { ReactNode } from 'react';
import { logger } from '../services/logger';
import { GenerationTriggers } from '../lib/generationTriggers';
import type { FullContext } from '../lib/contextManager';
import { generateRecursiveUI } from '../services/aiService';
import { storageManager } from '../services/storage';
import { cacheService } from '../services/cache';
import { getCachedRecursiveResult } from '../services/cacheService';

interface SavedState {
  ui: Element;
  context: Partial<FullContext>;
}

// Extend MountStrategy to include morphing
interface MorphingMountStrategy extends Omit<MountStrategy, 'type'> {
  type: 'morph' | MountStrategy['type'];
  morphTarget?: string;
}

interface PlacementStrategy {
  type: 'replace' | 'after' | 'before' | 'modal' | 'container';
  targetId?: string;
  container?: HTMLElement | null;
  animation?: 'fade' | 'slide' | 'grow';
}

interface SelfGenContextValue {
  generateUI: (options: GenerationOptions) => Promise<void>;
  isGenerating: boolean;
  registerMountPoint: (id: string, element: HTMLElement) => void;
  unregisterMountPoint: (id: string) => void;
}

interface GenerationOptions {
  prompt?: string;
  context?: Record<string, unknown>;
  mountStrategy?: MountStrategy;
  enhancementType?: 'append' | 'replace' | 'enhance';
  autoPrompt?: boolean;
}

interface MountStrategy {
  type: 'after' | 'before' | 'child' | 'portal' | 'modal' | 'enhance';
  targetId?: string;
  container?: HTMLElement | null;
  position?: 'start' | 'end';
  animation?: 'fade' | 'slide' | 'grow';
}

const SelfGenContext = createContext<SelfGenContextValue | null>(null);

export interface SelfGenProviderProps {
  children: ReactNode;
  aiService?: typeof import('../services/aiService');
  initialMountPoints?: Map<string, HTMLElement>;
}

async function generateContextualPrompt(context: Record<string, unknown>): Promise<string> {
  const contextKeys = Object.keys(context);
  if (contextKeys.length === 0) {
    return 'Morph the UI to fit the current context and user needs';
  }

  const contextDescription = contextKeys
    .map(key => `${key}: ${JSON.stringify(context[key])}`)
    .join(', ');
  
  return `Morph the UI to handle the following context: ${contextDescription}`;
}

// Serializable DOM state
interface SerializableState {
  html: string;
  components: any[];
  context: Partial<FullContext>;
  timestamp: string;
}

async function saveState(state: SerializableState) {
  try {
    await storageManager.setItem('selfgenui_state', state);
    logger.info('useSelfGen', 'State saved successfully');
  } catch (error) {
    logger.error('useSelfGen', 'Failed to save state', { error });
  }
}

async function loadState(): Promise<SerializableState | null> {
  try {
    const state = await storageManager.getItem<SerializableState>('selfgenui_state');
    if (state) {
      logger.info('useSelfGen', 'State loaded successfully');
      return state;
    }
  } catch (error) {
    logger.error('useSelfGen', 'Failed to load state', { error });
  }
  return null;
}

// Utility to serialize DOM state
function serializeState(doc: Element, components: any[], context: Partial<FullContext>): SerializableState {
  return {
    html: doc.innerHTML,
    components,
    context,
    timestamp: new Date().toISOString()
  };
}

// Utility to restore DOM state
function restoreState(state: SerializableState) {
  const container = document.createElement('div');
  container.innerHTML = state.html;
  document.body.innerHTML = container.firstElementChild?.innerHTML || '';
  return state;
}

export function SelfGenProvider({ 
  children, 
  aiService
}: SelfGenProviderProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const previousStateRef = useRef<SavedState | null>(null);
  const [initialized, setInitialized] = useState(false);

  // Load saved state on mount
  useEffect(() => {
    const initState = async () => {
      try {
        const savedState = await loadState();
        if (savedState) {
          restoreState(savedState);
          logger.info('useSelfGen', 'Restored previous session state', {
            timestamp: savedState.timestamp
          });
        }
      } catch (error) {
        logger.error('useSelfGen', 'Failed to restore state', { error });
      } finally {
        setInitialized(true);
      }
    };
    initState();
  }, []);

  // Initialize cache service
  useEffect(() => {
    cacheService.initialize().catch(error => {
      logger.error('useSelfGen', 'Failed to initialize cache service', { error });
    });
  }, []);

  // Initialize triggers when provider mounts
  useEffect(() => {
    if (!initialized) return;

    GenerationTriggers.initialize(
      async (prompt: string, context: unknown, placement?: PlacementStrategy) => {
        setIsGenerating(true);
        try {
          if (!aiService) {
            logger.warn('useSelfGen', 'No AI service available for generation');
            return;
          }

          // Capture current state before changes
          const currentDoc = document.documentElement.cloneNode(true) as Element;
          previousStateRef.current = {
            ui: currentDoc,
            context: context as Partial<FullContext>
          };

          const fullContext: FullContext = {
            ...context as Partial<FullContext>,
            level: 'full',
            triggerType: 'recursive-generation',
            triggerId: 'root',
            triggerElement: {
              id: 'root',
              type: 'selfgen-trigger',
              props: {},
              position: { index: 0, depth: 0 }
            },
            componentHierarchy: [],
            siblingComponents: [],
            appState: {
              allComponents: [],
              componentCount: 0,
              hasErrors: false,
              lastUserActions: [],
              metadata: {}
            },
            environmentInfo: {
              viewport: {
                width: window.innerWidth,
                height: window.innerHeight
              },
              userAgent: navigator.userAgent,
              timestamp: new Date().toISOString()
            },
            timestamp: new Date().toISOString()
          };

          const result = await generateRecursiveUI(fullContext);
          
          if (result) {
            const { metadata } = result;
            logger.info('useSelfGen', 'Morphed UI via trigger', { 
              ...metadata,
              placement 
            });

            // Cache the morphed state
            await cacheService.cacheComponent(result.ui, fullContext);
            
            // Save complete state
            const elements = Array.from(document.querySelectorAll('[data-selfgen]'));
            const serializedState = serializeState(
              document.documentElement,
              elements.map(el => ({
                id: el.id,
                type: el.tagName.toLowerCase(),
                props: Object.fromEntries(
                  Array.from(el.attributes)
                    .filter(attr => !attr.name.startsWith('data-'))
                    .map(attr => [attr.name, attr.value])
                ),
                children: Array.from(el.children).map(child => child.outerHTML)
              })),
              fullContext
            );
            await saveState(serializedState);
          }
        } catch (error) {
          logger.error('useSelfGen', 'UI morphing failed', { error, prompt });
          // Attempt to restore previous state if available
          if (previousStateRef.current) {
            const { ui, context } = previousStateRef.current;
            document.documentElement.replaceWith(ui);
            logger.info('useSelfGen', 'Restored previous UI state', { context });
            
            // Save the restored state
            const serializedState = serializeState(ui, [], context);
            await saveState(serializedState);
          }
        } finally {
          setIsGenerating(false);
        }
      },
      // Function to get current components for context
      () => {
        // Get all UI elements from the current page
        const elements = Array.from(document.querySelectorAll('[data-selfgen]'));
        return elements.map(el => ({
          id: el.id,
          type: el.tagName.toLowerCase(),
          props: Object.fromEntries(
            Array.from(el.attributes)
              .filter(attr => !attr.name.startsWith('data-'))
              .map(attr => [attr.name, attr.value])
          ),
          children: Array.from(el.children).map(child => child.outerHTML)
        }));
      }
    );

    return () => {
      // Clean up by clearing the trigger callback
      GenerationTriggers.initialize(
        async () => { /* no-op cleanup */ },
        () => []
      );
    };
  }, [aiService, initialized]);

  const generateUI = useCallback(async (options: GenerationOptions) => {
    const {
      prompt,
      context = {},
      mountStrategy = { type: 'morph' as const, morphTarget: 'root' } satisfies MorphingMountStrategy,
      autoPrompt = true
    } = options;

    setIsGenerating(true);
    try {
      // Store current state for potential rollback
      const currentDoc = document.documentElement.cloneNode(true) as Element;
      previousStateRef.current = {
        ui: currentDoc,
        context: context as Partial<FullContext>
      };

      // Save current state before changes
      const beforeState = serializeState(currentDoc, [], context as Partial<FullContext>);
      await saveState(beforeState);

      // If no prompt is provided but autoPrompt is true, generate one based on context
      const finalPrompt = prompt || (autoPrompt ? await generateContextualPrompt(context) : '');
      
      if (!finalPrompt) {
        logger.warn('useSelfGen', 'No prompt available for morphing');
        return;
      }

      const morphTarget = (mountStrategy as MorphingMountStrategy)?.morphTarget || 'root';

      const fullContext: FullContext = {
        // Base context
        triggerId: morphTarget,
        triggerType: 'recursive-generation',
        timestamp: new Date().toISOString(),
        
        // Full context
        level: 'full',
        triggerElement: {
          id: morphTarget,
          type: 'selfgen-trigger',
          props: context,
          position: { index: 0, depth: 0 }
        },
        componentHierarchy: [],
        siblingComponents: [],
        appState: {
          allComponents: [],
          componentCount: 0,
          hasErrors: false,
          lastUserActions: [],
          metadata: {}
        },
        environmentInfo: {
          viewport: {
            width: window.innerWidth,
            height: window.innerHeight
          },
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString()
        }
      };

      // Check cache first
      const cachedResult = await getCachedRecursiveResult(fullContext);
      let result;

      if (cachedResult) {
        logger.info('useSelfGen', 'Using cached UI morphing result', { 
          context: fullContext,
          cached: true 
        });
        result = {
          ui: cachedResult.ui,
          metadata: {
            componentId: cachedResult.metadata.componentId,
            reasoning: cachedResult.metadata.reasoning
          }
        };
      } else {
        // Generate new UI if not in cache
        result = await generateRecursiveUI(fullContext);
      }

      if (result) {
        // Cache the result
        await cacheService.cacheComponent(result.ui, fullContext);

        // Save complete state after changes
        const elements = Array.from(document.querySelectorAll('[data-selfgen]'));
        const serializedState = serializeState(
          document.documentElement,
          elements.map(el => ({
            id: el.id,
            type: el.tagName.toLowerCase(),
            props: Object.fromEntries(
              Array.from(el.attributes)
                .filter(attr => !attr.name.startsWith('data-'))
                .map(attr => [attr.name, attr.value])
            ),
            children: Array.from(el.children).map(child => child.outerHTML)
          })),
          fullContext
        );
        await saveState(serializedState);

        // Handle successful morphing
        logger.info('useSelfGen', 'UI morphed successfully', { 
          prompt: finalPrompt,
          strategy: mountStrategy,
          cached: !!cachedResult
        });
      }
    } catch (error) {
      logger.error('useSelfGen', 'Failed to morph UI', { error, options });
      // Attempt to restore previous state if available
      if (previousStateRef.current) {
        const { ui, context } = previousStateRef.current;
        document.documentElement.replaceWith(ui);
        logger.info('useSelfGen', 'Restored previous UI state', { context });
        
        // Save the restored state
        const serializedState = serializeState(ui, [], context);
        await saveState(serializedState);
      }
    } finally {
      setIsGenerating(false);
    }
  }, []);

  return createElement(SelfGenContext.Provider, {
    value: {
      generateUI,
      isGenerating,
      registerMountPoint,
      unregisterMountPoint
    }
  }, children);
}

// ...rest of the file (useSelfGen and withSelfGen functions)
