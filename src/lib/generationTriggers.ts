/**
 * Generation Trigger Functions
 * 
 * This module provides functions that can trigger AI generation with appropriate context levels.
 * These functions are designed to be used with the function resolver for recursive UI generation.
 */

import { ContextManager } from './contextManager';
import { logger } from '../services/logger';
import type { UIComponent } from '../types';

// Type definitions for event handlers and function registry
interface GenerationEventHandler {
  (event: Event): void | Promise<void>;
}

interface ErrorFixHandler {
  (elementId: string, errorMessage: string): void | Promise<void>;
}

interface GenerationFunctionRegistry {
  [key: string]: GenerationEventHandler | ErrorFixHandler;
}

// Type for generation callback - to be provided by the app
type GenerationCallback = (prompt: string, context: unknown, placement?: PlacementStrategy) => Promise<void>;

interface PlacementStrategy {
  type: 'replace' | 'after' | 'before' | 'modal' | 'container';
  targetId?: string;
  animation?: 'fade' | 'slide' | 'grow';
}

/**
 * Generation trigger system that can be integrated with any app
 */
export class GenerationTriggers {
  private static generationCallback: GenerationCallback | null = null;
  private static currentComponents: UIComponent[] = [];
  
  /**
   * Initialize the generation system with app-specific callbacks
   */
  static initialize(
    generationCallback: GenerationCallback,
    getCurrentComponents: () => UIComponent[]
  ) {
    this.generationCallback = generationCallback;
    this.currentComponents = getCurrentComponents();
    logger.info('GenerationTriggers', 'System initialized');
  }
  
  /**
   * Update current components (should be called when components change)
   */
  static updateComponents(components: UIComponent[]) {
    this.currentComponents = components;
  }

  /**
   * Simple click-to-generate function
   * Uses standard context level
   */
  static createSimpleGenerator(prompt: string, placement: PlacementStrategy = { type: 'after' }) {
    return (event: Event) => {
      if (!this.generationCallback) {
        logger.warn('GenerationTriggers', 'No generation callback registered');
        return;
      }

      const element = event.target as Element;
      const context = ContextManager.captureStandard(element);
      
      logger.info('GenerationTriggers', 'Simple generation triggered', { prompt, placement });
      
      this.generationCallback(prompt, context, placement).catch(error => {
        logger.error('GenerationTriggers', 'Generation failed', error);
      });
    };
  }

  /**
   * Input-based generation function
   * Uses the input value in the generation prompt
   */
  static createInputGenerator(
    promptTemplate: string, 
    placement: PlacementStrategy = { type: 'after' }
  ) {
    return (event: Event) => {
      if (!this.generationCallback) {
        logger.warn('GenerationTriggers', 'No generation callback registered');
        return;
      }

      const input = event.target as HTMLInputElement;
      const userInput = input.value.trim();
      
      if (!userInput) {
        logger.debug('GenerationTriggers', 'Empty input, skipping generation');
        return;
      }

      // Replace template placeholders with actual input
      const prompt = promptTemplate.replace(/\{\{value\}\}/g, userInput);
      const context = ContextManager.captureStandard(input, userInput);
      
      logger.info('GenerationTriggers', 'Input-based generation triggered', { prompt, userInput });
      
      this.generationCallback(prompt, context, placement).catch(error => {
        logger.error('GenerationTriggers', 'Input generation failed', error);
      });
    };
  }

  /**
   * Rich context generation function
   * Uses rich context with component hierarchy information
   */
  static createRichGenerator(
    prompt: string, 
    placement: PlacementStrategy = { type: 'after' }
  ) {
    return (event: Event) => {
      if (!this.generationCallback) {
        logger.warn('GenerationTriggers', 'No generation callback registered');
        return;
      }

      const element = event.target as Element;
      const context = ContextManager.captureRich(element, this.currentComponents);
      
      logger.info('GenerationTriggers', 'Rich generation triggered', { prompt, placement });
      
      this.generationCallback(prompt, context, placement).catch(error => {
        logger.error('GenerationTriggers', 'Rich generation failed', error);
      });
    };
  }

  /**
   * Contextual generation that adapts the prompt based on the triggering element
   */
  static createContextualGenerator(
    basePrompt: string,
    placement: PlacementStrategy = { type: 'after' }
  ) {
    return (event: Event) => {
      if (!this.generationCallback) {
        logger.warn('GenerationTriggers', 'No generation callback registered');
        return;
      }

      const element = event.target as Element;
      const elementType = element.tagName.toLowerCase();
      const elementText = element.textContent || '';
      
      // Adapt prompt based on element type and content
      let adaptedPrompt = basePrompt;
      if (elementText) {
        adaptedPrompt += ` Related to: "${elementText}"`;
      }
      if (elementType === 'button') {
        adaptedPrompt += ' Create interactive elements that complement this button.';
      } else if (elementType === 'input') {
        adaptedPrompt += ' Create elements that work with this input field.';
      }

      const context = ContextManager.captureRich(element, this.currentComponents, elementText);
      
      logger.info('GenerationTriggers', 'Contextual generation triggered', { 
        original: basePrompt, 
        adapted: adaptedPrompt 
      });
      
      this.generationCallback(adaptedPrompt, context, placement).catch(error => {
        logger.error('GenerationTriggers', 'Contextual generation failed', error);
      });
    };
  }

  /**
   * Confirmation-based generation
   * Asks user to confirm before generating
   */
  static createConfirmGenerator(
    prompt: string,
    placement: PlacementStrategy = { type: 'after' },
    confirmMessage?: string
  ) {
    return (event: Event) => {
      const message = confirmMessage || `Generate: ${prompt}?`;
      const shouldGenerate = confirm(message);
      
      if (!shouldGenerate) {
        logger.debug('GenerationTriggers', 'User cancelled generation');
        return;
      }

      if (!this.generationCallback) {
        logger.warn('GenerationTriggers', 'No generation callback registered');
        return;
      }

      const element = event.target as Element;
      const context = ContextManager.captureStandard(element);
      
      logger.info('GenerationTriggers', 'Confirmed generation triggered', { prompt });
      
      this.generationCallback(prompt, context, placement).catch(error => {
        logger.error('GenerationTriggers', 'Confirmed generation failed', error);
      });
    };
  }

  /**
   * Debounced generation function
   * Waits for a pause in user input before generating
   */
  static createDebouncedGenerator(
    promptTemplate: string,
    placement: PlacementStrategy = { type: 'after' },
    delay: number = 1000
  ) {
    let timeoutId: NodeJS.Timeout;
    
    return (event: Event) => {
      // Clear previous timeout
      clearTimeout(timeoutId);
      
      // Set new timeout
      timeoutId = setTimeout(() => {
        if (!this.generationCallback) {
          logger.warn('GenerationTriggers', 'No generation callback registered');
          return;
        }

        const input = event.target as HTMLInputElement;
        const userInput = input.value.trim();
        
        if (!userInput) {
          logger.debug('GenerationTriggers', 'Empty input after debounce, skipping');
          return;
        }

        const prompt = promptTemplate.replace(/\{\{value\}\}/g, userInput);
        const context = ContextManager.captureStandard(input, userInput);
        
        logger.info('GenerationTriggers', 'Debounced generation triggered', { prompt, delay });
        
        this.generationCallback(prompt, context, placement).catch(error => {
          logger.error('GenerationTriggers', 'Debounced generation failed', error);
        });
      }, delay);
    };
  }

  /**
   * Error-fixing generation function
   * Uses minimal context for error resolution
   */
  static createErrorFixer(basePrompt: string = 'Fix this component error'): ErrorFixHandler {
    return (elementId: string, errorMessage: string) => {
      if (!this.generationCallback) {
        logger.warn('GenerationTriggers', 'No generation callback registered for error fixing');
        return;
      }

      const context = ContextManager.captureMinimal(elementId, 'error-element', errorMessage);
      const prompt = `${basePrompt}: ${errorMessage}`;
      
      logger.info('GenerationTriggers', 'Error fix generation triggered', { elementId, errorMessage });
      
      this.generationCallback(prompt, context, { type: 'replace', targetId: elementId }).catch(error => {
        logger.error('GenerationTriggers', 'Error fix generation failed', error);
      });
    };
  }
}

/**
 * Pre-configured generation functions for common use cases
 * These can be registered directly with the function resolver
 */
export const commonGenerationFunctions: GenerationFunctionRegistry = {
  // Simple generation functions
  'generateButton': GenerationTriggers.createSimpleGenerator(
    'Create a button component with appropriate styling and functionality',
    { type: 'after' }
  ),
  
  'generateCard': GenerationTriggers.createSimpleGenerator(
    'Create a card component to display information',
    { type: 'after' }
  ),
  
  'generateForm': GenerationTriggers.createSimpleGenerator(
    'Create a form with appropriate input fields',
    { type: 'after' }
  ),
  
  // Input-based generation
  'generateFromSearch': GenerationTriggers.createInputGenerator(
    'Create search results for: {{value}}',
    { type: 'after' }
  ),
  
  'generateFromPrompt': GenerationTriggers.createInputGenerator(
    'Generate UI components based on: {{value}}',
    { type: 'after' }
  ),
  
  // Contextual generation
  'generateRelated': GenerationTriggers.createContextualGenerator(
    'Generate related components that complement the current interface',
    { type: 'after' }
  ),
  
  'generateModal': GenerationTriggers.createContextualGenerator(
    'Create a modal dialog with relevant content',
    { type: 'modal' }
  ),
  
  // Confirmation-based
  'confirmGenerate': GenerationTriggers.createConfirmGenerator(
    'Create additional UI elements',
    { type: 'after' },
    'Do you want to generate more components?'
  ),
  
  // Debounced for real-time generation
  'liveGenerate': GenerationTriggers.createDebouncedGenerator(
    'Generate components as you type: {{value}}',
    { type: 'after' },
    800
  ),
};

/**
 * Helper function to register all generation functions with the function resolver
 */
export function registerGenerationFunctions(functionRegistry: GenerationFunctionRegistry): void {
  Object.entries(commonGenerationFunctions).forEach(([name, func]) => {
    functionRegistry[name] = func;
  });
  
  logger.info('GenerationTriggers', 'Registered generation functions', { 
    count: Object.keys(commonGenerationFunctions).length 
  });
}
