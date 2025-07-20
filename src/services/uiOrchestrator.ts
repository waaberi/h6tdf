/**
 * UI Orchestrator for Recursive and Dynamic UI Management
 * 
 * This service is responsible for strategically inserting new UI components
 * into the application's component tree. It ensures that recursively
 * generated components are placed logically relative to their trigger source.
 */

import type { UIComponent } from '../types';
import { logger } from './logger';
import { useAppStore } from '../store/appStore';

/**
 * Inserts a recursively generated UI component into the DOM.
 * 
 * The function finds the component that triggered the generation event and
 * inserts the new component immediately after it in the component list.
 * This creates a direct and logical flow in the UI.
 * 
 * @param component The new UIComponent to be inserted.
 * @param targetElementId The ID of the component that initiated the recursive generation.
 */
export function insertRecursiveUI(component: UIComponent, targetElementId: string): void {
  if (!component || !targetElementId) {
    logger.error('UIOrchestrator', 'Invalid component or targetElementId for insertion.', { component, targetElementId });
    return;
  }

  try {
    // Use the app store to insert the component
    useAppStore.getState().insertComponentAfter(targetElementId, component);
    logger.info('UIOrchestrator', `Successfully inserted component ${component.id} after ${targetElementId}.`);
  } catch (error) {
    logger.error('UIOrchestrator', `Failed to insert component ${component.id}.`, { 
      error,
      componentId: component.id,
      targetElementId,
    });
    // Optionally, dispatch an error event or show a notification
  }
}
