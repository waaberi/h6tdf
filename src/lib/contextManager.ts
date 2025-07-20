/**
 * Context Management for Recursive UI Generation
 * 
 * This module provides different levels of context capture for various types of generation:
 * - Minimal context for error fixes and simple operations
 * - Rich context for user-initiated generation
 * - Full context for complex recursive scenarios
 */

import type { UIComponent } from '../types';
import { logger } from '../services/logger';
import { useAppStore } from '../store/appStore';

/**
 * Different context levels for different generation scenarios
 */
export type ContextLevel = 'minimal' | 'standard' | 'rich' | 'full';

/**
 * Base context that all generations receive
 */
interface BaseContext {
  triggerId: string;
  triggerType: 'error' | 'user-interaction' | 'recursive-generation';
  timestamp: string;
}

/**
 * Minimal context for error fixes and simple operations
 */
interface MinimalContext extends BaseContext {
  level: 'minimal';
  errorMessage?: string;
  elementType: string;
}

/**
 * Standard context for common user interactions
 */
interface StandardContext extends BaseContext {
  level: 'standard';
  triggerElement: {
    id: string;
    type: string;
    props: Record<string, unknown>;
  };
  userInput?: string;
}

/**
 * Rich context for complex user-initiated generation
 */
interface RichContext extends BaseContext {
  level: 'rich';
  triggerElement: {
    id: string;
    type: string;
    props: Record<string, unknown>;
    textContent?: string;
  };
  userInput?: string;
  siblingComponents: UIComponent[];
  parentComponent?: UIComponent;
  appState: {
    componentCount: number;
    hasErrors: boolean;
    lastUserAction?: string;
  };
}

/**
 * Full context for advanced recursive scenarios
 */
export interface FullContext extends BaseContext {
  level: 'full';
  triggerElement: {
    id: string;
    type: string;
    props: Record<string, unknown>;
    textContent?: string;
    position: { index: number; depth: number };
  };
  userInput?: string;
  componentHierarchy: UIComponent[];
  siblingComponents: UIComponent[];
  parentComponent?: UIComponent;
  appState: {
    allComponents: UIComponent[];
    componentCount: number;
    hasErrors: boolean;
    lastUserActions: string[];
    metadata: Record<string, unknown>;
  };
  environmentInfo: {
    viewport: { width: number; height: number };
    userAgent: string;
    timestamp: string;
  };
}

export type GenerationContext = MinimalContext | StandardContext | RichContext | FullContext;

/**
 * Context capture strategies for different generation types
 */
export class ContextManager {
  /**
   * Capture minimal context - used for error fixes and simple operations
   */
  static captureMinimal(
    triggerId: string,
    elementType: string,
    errorMessage?: string
  ): MinimalContext {
    logger.debug('ContextManager', 'Capturing minimal context', { triggerId, elementType });
    
    return {
      level: 'minimal',
      triggerId,
      triggerType: 'error',
      timestamp: new Date().toISOString(),
      elementType,
      errorMessage
    };
  }

  /**
   * Capture standard context - used for common user interactions
   */
  static captureStandard(
    element: Element,
    userInput?: string
  ): StandardContext {
    const triggerId = element.id || 'unknown';
    const elementType = element.tagName.toLowerCase();
    
    logger.debug('ContextManager', 'Capturing standard context', { triggerId, elementType });
    
    return {
      level: 'standard',
      triggerId,
      triggerType: 'user-interaction',
      timestamp: new Date().toISOString(),
      triggerElement: {
        id: triggerId,
        type: elementType,
        props: this.extractElementProps(element)
      },
      userInput
    };
  }

  /**
   * Capture rich context - used for complex user-initiated generation
   */
  static captureRich(
    element: Element,
    components: UIComponent[],
    userInput?: string
  ): RichContext {
    const triggerId = element.id || 'unknown';
    const elementType = element.tagName.toLowerCase();
    
    logger.debug('ContextManager', 'Capturing rich context', { triggerId, elementType });
    
    const siblingComponents = this.findSiblingComponents(components, triggerId);
    const parentComponent = this.findParentComponent(components, triggerId);
    
    return {
      level: 'rich',
      triggerId,
      triggerType: 'user-interaction',
      timestamp: new Date().toISOString(),
      triggerElement: {
        id: triggerId,
        type: elementType,
        props: this.extractElementProps(element),
        textContent: element.textContent || undefined
      },
      userInput,
      siblingComponents,
      parentComponent,
      appState: {
        componentCount: components.length,
        hasErrors: this.checkForErrors(components),
        lastUserAction: userInput || `clicked ${elementType}`
      }
    };
  }

  /**
   * Capture full context - used for advanced recursive scenarios
   */
  static captureFull(
    element: Element,
    components: UIComponent[],
    userInput?: string,
    metadata?: Record<string, unknown>
  ): FullContext {
    const triggerId = element.id || 'unknown';
    const elementType = element.tagName.toLowerCase();
    
    logger.debug('ContextManager', 'Capturing full context', { triggerId, elementType });
    
    const siblingComponents = this.findSiblingComponents(components, triggerId);
    const parentComponent = this.findParentComponent(components, triggerId);
    const componentHierarchy = this.buildComponentHierarchy(components, triggerId);
    const position = this.calculateElementPosition(components, triggerId);
    
    return {
      level: 'full',
      triggerId,
      triggerType: 'recursive-generation',
      timestamp: new Date().toISOString(),
      triggerElement: {
        id: triggerId,
        type: elementType,
        props: this.extractElementProps(element),
        textContent: element.textContent || undefined,
        position
      },
      userInput,
      componentHierarchy,
      siblingComponents,
      parentComponent,
      appState: {
        allComponents: components,
        componentCount: components.length,
        hasErrors: this.checkForErrors(components),
        lastUserActions: this.getRecentUserActions(),
        metadata: metadata || {}
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
  }

  /**
   * Smart context selection based on generation type
   */
  static captureContextForType(
    generationType: 'error-fix' | 'simple-interaction' | 'complex-interaction' | 'recursive',
    element: Element,
    components: UIComponent[],
    options?: {
      userInput?: string;
      errorMessage?: string;
      metadata?: Record<string, unknown>;
    }
  ): GenerationContext {
    const { userInput, errorMessage, metadata } = options || {};
    
    switch (generationType) {
      case 'error-fix':
        return this.captureMinimal(
          element.id || 'error-element',
          element.tagName.toLowerCase(),
          errorMessage
        );
      
      case 'simple-interaction':
        return this.captureStandard(element, userInput);
      
      case 'complex-interaction':
        return this.captureRich(element, components, userInput);
      
      case 'recursive':
        return this.captureFull(element, components, userInput, metadata);
      
      default:
        return this.captureStandard(element, userInput);
    }
  }

  // Helper methods
  private static extractElementProps(element: Element): Record<string, unknown> {
    const props: Record<string, unknown> = {};
    
    // Common attributes
    if (element.id) props.id = element.id;
    if (element.className) props.className = element.className;
    
    // Input-specific attributes
    if (element instanceof HTMLInputElement) {
      props.type = element.type;
      props.value = element.value;
      props.placeholder = element.placeholder;
    }
    
    // Button-specific attributes
    if (element instanceof HTMLButtonElement) {
      props.type = element.type;
      props.disabled = element.disabled;
    }
    
    return props;
  }

  private static findSiblingComponents(components: UIComponent[], targetId: string): UIComponent[] {
    // Simplified sibling finding - in a real implementation, this would traverse the component tree
    return components.filter(comp => comp.id !== targetId).slice(0, 3); // Limit siblings for context size
  }

  private static findParentComponent(components: UIComponent[], targetId: string): UIComponent | undefined {
    // Simplified parent finding - would need proper tree traversal in production
    return components.find(comp => 
      comp.children?.some(child => 
        typeof child === 'object' && child.id === targetId
      )
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private static buildComponentHierarchy(components: UIComponent[], _targetId: string): UIComponent[] {
    // Build the path from root to target component
    // Simplified implementation - would need proper tree traversal
    return components.slice(0, 5); // Limit for context size
  }

  private static calculateElementPosition(components: UIComponent[], targetId: string): { index: number; depth: number } {
    // Calculate position in component tree
    const index = components.findIndex(comp => comp.id === targetId);
    return { index: Math.max(0, index), depth: 1 }; // Simplified depth calculation
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private static checkForErrors(_components: UIComponent[]): boolean {
    // Check if any components have error states
    // This would integrate with the error tracking system
    return false; // Simplified for now
  }

  private static getRecentUserActions(): string[] {
    // Get recent user actions from a history store
    // This would integrate with user action tracking
    return []; // Simplified for now
  }
}

/**
 * Context-aware prompt builders for different scenarios
 */
export class PromptBuilder {
  /**
   * Build a prompt for error fixing with minimal context
   */
  static buildErrorFixPrompt(context: MinimalContext, basePrompt: string): string {
    return `${basePrompt}

Context:
- Element type: ${context.elementType}
- Error: ${context.errorMessage || 'Unknown error'}
- Trigger ID: ${context.triggerId}

Please fix the error with minimal changes and return a working component.`;
  }

  /**
   * Build a prompt for standard interactions
   */
  static buildStandardPrompt(context: StandardContext, basePrompt: string): string {
    const { triggerElement, userInput } = context;
    
    return `${basePrompt}

Context:
- Triggered by: ${triggerElement.type} (ID: ${triggerElement.id})
- User input: ${userInput || 'None'}
- Element properties: ${JSON.stringify(triggerElement.props)}

Generate appropriate components based on this interaction.`;
  }

  /**
   * Build a rich prompt with comprehensive context
   */
  static buildRichPrompt(context: RichContext, basePrompt: string): string {
    const { triggerElement, userInput, siblingComponents, appState } = context;
    
    return `${basePrompt}

Rich Context:
- Triggered by: ${triggerElement.type} (ID: ${triggerElement.id})
- User input: ${userInput || 'None'}
- Text content: ${triggerElement.textContent || 'None'}
- Sibling components: ${siblingComponents.length} nearby components
- App state: ${appState.componentCount} total components, errors: ${appState.hasErrors}
- Last action: ${appState.lastUserAction}

Generate contextually appropriate components that complement the existing UI.`;
  }

  /**
   * Build a comprehensive prompt for complex scenarios
   */
  static buildFullPrompt(context: FullContext, basePrompt: string): string {
    const { triggerElement, userInput, componentHierarchy, appState } = context;
    
    return `${basePrompt}

Full Context:
- Triggered by: ${triggerElement.type} (ID: ${triggerElement.id}) at position ${triggerElement.position.index}
- User input: ${userInput || 'None'}
- Component hierarchy: ${componentHierarchy.length} components in tree
- Total components: ${appState.componentCount}
- Environment: ${context.environmentInfo.viewport.width}x${context.environmentInfo.viewport.height}
- User agent: ${context.environmentInfo.userAgent}

Generate sophisticated, context-aware components that integrate seamlessly with the existing application architecture.`;
  }

  /**
   * Smart prompt building based on context type
   */
  static buildPrompt(context: GenerationContext, basePrompt: string): string {
    switch (context.level) {
      case 'minimal':
        return this.buildErrorFixPrompt(context, basePrompt);
      case 'standard':
        return this.buildStandardPrompt(context, basePrompt);
      case 'rich':
        return this.buildRichPrompt(context, basePrompt);
      case 'full':
        return this.buildFullPrompt(context, basePrompt);
      default:
        return basePrompt;
    }
  }
}

/**
 * Captures the full context for a recursive generation event.
 * This is the primary function used by the recursive handler to gather intelligence.
 * @param elementId The ID of the element that triggered the event.
 * @param event The DOM event that was triggered.
 * @returns A promise that resolves to the full generation context.
 */
export const captureContext = async (elementId: string, event: Event): Promise<FullContext> => {
  logger.info('ContextManager', `Capturing context for recursive event on element: ${elementId}`);

  const element = document.getElementById(elementId);
  if (!element) {
    logger.error('ContextManager', `Could not find element with ID: ${elementId}`);
    // In a real app, you might want a more robust error handling here
    throw new Error(`Element with ID ${elementId} not found for context capture.`);
  }

  // Get current UI state from the app store
  const { currentComponents } = useAppStore.getState();

  // Determine user input if available (e.g., from an input event on a text field)
  let userInput: string | undefined;
  if (event.target && 'value' in event.target && typeof event.target.value === 'string') {
    userInput = event.target.value;
  }

  // Use the existing ContextManager class to capture the full context
  // This provides a rich snapshot of the application state for the AI
  const context = ContextManager.captureFull(
    element,
    currentComponents,
    userInput
  );

  return context;
};
