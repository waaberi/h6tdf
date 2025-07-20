/**
 * Function Resolver - Smart handling of serialized function properties.
 * 
 * This module provides safe methods to handle function properties that may have been
 * serialized to strings during JSON serialization/deserialization.
 */

import { logger } from '../services/logger';
import type { UIComponent } from '../types';
import { generateRecursiveUI, buildFallbackPrompt } from '../services/aiService';
import { captureContext } from './contextManager';
import { insertRecursiveUI } from '../services/uiOrchestrator';
import { cacheRecursiveResult, getCachedRecursiveResult } from '../services/cacheService';

// Event handler and function types
type DOMEventHandler = (event: Event) => void;
type MouseEventHandler = (event: MouseEvent) => void;
type FormEventHandler = (event: Event) => void;
type InputEventHandler = (event: Event) => void;
type ChangeEventHandler = (event: Event) => void;
type KeyboardEventHandler = (event: KeyboardEvent) => void;
type FocusEventHandler = (event: FocusEvent) => void;
type InteractionHandler = (action: string, data?: unknown) => void;

// Base interface for all event handlers
interface BaseEventHandler {
  (event: Event): void | Promise<void>;
}

// Specific event handler types
interface ComponentEventHandler extends BaseEventHandler {
  (event: Event, componentId?: string): void | Promise<void>;
}

interface DataEventHandler extends BaseEventHandler {
  (event: Event, data?: unknown): void | Promise<void>;
}

// Type for custom event handlers
type CustomEventHandler = {
  (event: Event): void;
  (action: string, data?: unknown): void;
};

// Union type for all possible event handlers
export type EventHandler = 
  | DOMEventHandler
  | MouseEventHandler
  | FormEventHandler
  | InputEventHandler 
  | ChangeEventHandler
  | KeyboardEventHandler
  | FocusEventHandler
  | ComponentEventHandler
  | DataEventHandler
  | CustomEventHandler
  | InteractionHandler;

// Type for function registry
export interface FunctionRegistry {
  [key: string]: EventHandler;
}

// Common event handler signatures

/**
 * Registry of safe, pre-defined functions that can be used as event handlers
 * This prevents the need for dangerous eval() while still allowing dynamic function assignment
 */
export const functionRegistry: FunctionRegistry = {
  // No-op handlers
  'noop': () => {},
  'preventDefault': (event: Event) => event.preventDefault(),
  'stopPropagation': (event: Event) => event.stopPropagation(),
  
  // Common click handlers
  'logClick': (event: MouseEvent) => {
    logger.info('FunctionResolver', 'Button clicked', { target: event.target, timestamp: new Date().toISOString() });
  },
  'alertClick': () => {
    alert('Button clicked!');
  },
  'consoleLog': (event: Event) => {
    console.log('Event triggered:', event.type, event.target);
  },
  
  // Form handlers
  'submitForm': (event: Event) => {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const formData = new FormData(form);
    logger.info('FunctionResolver', 'Form submitted', { data: Object.fromEntries(formData) });
  },
  'logFormSubmit': (event: Event) => {
    event.preventDefault();
    logger.info('FunctionResolver', 'Form submit attempted', { target: event.target });
  },
  
  // Input change handlers
  'logChange': (event: Event) => {
    const input = event.target as HTMLInputElement;
    logger.info('FunctionResolver', 'Input changed', { value: input.value, name: input.name });
  },
  'validateInput': (event: Event) => {
    const input = event.target as HTMLInputElement;
    if (input.value.trim() === '') {
      input.setCustomValidity('This field cannot be empty');
    } else {
      input.setCustomValidity('');
    }
  },
  
  // Modal/dialog handlers
  'closeModal': () => {
    logger.info('FunctionResolver', 'Modal close requested');
  },
  'openModal': () => {
    logger.info('FunctionResolver', 'Modal open requested');
  },
  
  // Navigation handlers
  'navigateHome': () => {
    logger.info('FunctionResolver', 'Navigation to home requested');
  },
  'navigateBack': () => {
    logger.info('FunctionResolver', 'Navigation back requested');
    window.history.back();
  },
  
  // Search handlers
  'performSearch': (event: Event) => {
    const input = event.target as HTMLInputElement;
    logger.info('FunctionResolver', 'Search performed', { query: input.value });
  },
  
  // Generic interaction handler
  'logInteraction': (action: string, data?: unknown) => {
    logger.info('FunctionResolver', 'Component interaction', { action, data, timestamp: new Date().toISOString() });
  }
};

/**
 * Function property patterns - properties that should be treated as functions
 */
const functionPropertyPatterns = [
  /^on[A-Z]/, // React event handlers (onClick, onChange, etc.)
  /^handle[A-Z]/, // Handler functions (handleClick, handleSubmit, etc.)
  /Handler$/, // Functions ending with Handler
  /Callback$/, // Functions ending with Callback
];

/**
 * Check if a property name suggests it should be a function
 */
export function isFunctionProperty(propertyName: string): boolean {
  return functionPropertyPatterns.some(pattern => pattern.test(propertyName));
}

/**
 * Safely resolve a string to a function using the registry
 * Returns undefined if the function cannot be resolved safely
 */
export function resolveFunction(functionName: string): EventHandler | undefined {
  if (typeof functionName !== 'string') {
    return undefined;
  }
  
  // Clean the function name (remove quotes, whitespace)
  const cleanName = functionName.trim().replace(/^['"]|['"]$/g, '');
  
  // Check if it's in our registry
  if (functionRegistry[cleanName]) {
    logger.debug('FunctionResolver', `Function resolved from registry: ${cleanName}`);
    return functionRegistry[cleanName];
  }
  
  // Check for common patterns and provide fallbacks
  if (cleanName.includes('click') || cleanName.includes('Click')) {
    logger.debug('FunctionResolver', `Using default click handler for: ${cleanName}`);
    return functionRegistry['logClick'];
  }
  
  if (cleanName.includes('submit') || cleanName.includes('Submit')) {
    logger.debug('FunctionResolver', `Using default submit handler for: ${cleanName}`);
    return functionRegistry['submitForm'];
  }
  
  if (cleanName.includes('change') || cleanName.includes('Change')) {
    logger.debug('FunctionResolver', `Using default change handler for: ${cleanName}`);
    return functionRegistry['logChange'];
  }
  
  // If we can't resolve it safely, log and return a safe fallback
  logger.warn('FunctionResolver', `Unable to resolve function: ${functionName}. Using noop fallback.`);
  return functionRegistry['noop'];
}

/**
 * Process an object's properties, converting string function references to actual functions
 */
export function resolveFunctionProperties(props: Record<string, unknown>): Record<string, unknown> {
  const resolved: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(props)) {
    if (isFunctionProperty(key) && typeof value === 'string') {
      const resolvedFunction = resolveFunction(value);
      if (resolvedFunction) {
        resolved[key] = resolvedFunction;
        logger.debug('FunctionResolver', `Resolved function property: ${key} = ${value}`);
      } else {
        // Keep the original string value if we can't resolve it
        resolved[key] = value;
        logger.warn('FunctionResolver', `Could not resolve function property: ${key} = ${value}`);
      }
    } else {
      resolved[key] = value;
    }
  }
  
  return resolved;
}

/**
 * Create a dynamic function handler that can be used for component interactions
 * This is useful for components that need to report their interactions back to the parent
 */
export function createInteractionHandler(
  componentId: string, 
  onComponentInteraction?: (componentId: string, action: string, data?: unknown) => void
): InteractionHandler {
  return (action: string, data?: unknown) => {
    logger.info('FunctionResolver', `Component interaction: ${componentId}`, { action, data });
    if (onComponentInteraction) {
      onComponentInteraction(componentId, action, data);
    }
  };
}

/**
 * Register a new function in the registry
 * This allows extending the system with custom functions
 */
export function registerFunction(name: string, fn: EventHandler): void {
  if (typeof name !== 'string' || typeof fn !== 'function') {
    logger.error('FunctionResolver', 'Invalid function registration', { name, type: typeof fn });
    return;
  }
  
  functionRegistry[name] = fn;
  logger.info('FunctionResolver', `Registered new function: ${name}`);
}

/**
 * Get all available function names from the registry
 */
export function getAvailableFunctions(): string[] {
  return Object.keys(functionRegistry);
}

/**
 * Creates a fallback event handler that triggers recursive UI generation.
 * This is invoked when no explicit handler is defined for a component interaction.
 * @param componentId The ID of the component containing the element.
 * @param elementId A unique identifier for the element that triggered the event.
 * @param eventName The name of the event being handled (e.g., 'onClick').
 * @returns An asynchronous event handler function.
 */
export const createRecursiveHandler = (componentId: string, elementId: string, eventName: string) => {
  return async (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
    logger.info('FunctionResolver', `Recursive handler triggered for ${eventName} on ${componentId}:${elementId}`);

    try {
      // 1. Capture context
      const context = await captureContext(elementId, event);
      logger.debug('FunctionResolver', 'Captured context for recursive generation', { context });

      // Check cache first
      const cachedResult = await getCachedRecursiveResult(context);
      if (cachedResult) {
        logger.info('FunctionResolver', 'Using cached recursive UI');
        insertRecursiveUI(cachedResult.ui, componentId);
        return;
      }

      // 2. Build the prompt for the LLM
      const prompt = buildFallbackPrompt(context);
      logger.debug('FunctionResolver', 'Built fallback prompt', { prompt });

      // 3. Call the AI service to generate the UI
      const { ui, metadata } = await generateRecursiveUI(prompt);
      logger.info('FunctionResolver', 'Received recursive UI from AI service', { componentId: metadata.componentId });

      // 4. Insert the new UI into the application state
      insertRecursiveUI(ui, componentId);
      logger.debug('FunctionResolver', 'Inserted recursive UI into orchestrator');

      // 5. Cache the result for future use
      await cacheRecursiveResult(context, { ui, metadata });
      logger.debug('FunctionResolver', 'Cached recursive generation result');

    } catch (error) {
      logger.error('FunctionResolver', 'Error during recursive UI generation', { error, componentId, elementId });
      // Future enhancement: Display an error boundary or a message to the user
    }
  };
};

/**
 * Resolves an event handler property.
 * If the property value corresponds to a registered function, that function is returned.
 * If the property value is missing or unresolved, a recursive fallback handler is created.
 * @param propName The name of the event property (e.g., 'onClick').
 * @param propValue The value of the event property from the component's props.
 * @param componentId The ID of the component.
 * @param elementId A unique identifier for the element.
 * @returns A function to be used as the event handler.
 */
export function resolveEventHandler(
  propName: string,
  propValue: unknown,
  componentId: string,
  elementId: string
): EventHandler {
  if (typeof propValue === 'string' && functionRegistry[propValue]) {
    logger.debug('FunctionResolver', `Resolved event handler from registry: ${propName} -> ${propValue}`);
    return functionRegistry[propValue];
  }

  if (typeof propValue === 'function') {
    logger.debug('FunctionResolver', `Using provided function for event handler: ${propName}`);
    return propValue as EventHandler;
  }
  
  logger.info('FunctionResolver', `No explicit handler for ${propName} on ${componentId}. Creating recursive fallback.`);
  return createRecursiveHandler(componentId, elementId, propName);
}
