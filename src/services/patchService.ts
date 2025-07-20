import type { UIComponent } from '@/types';
import { logger } from '@/services/logger';
import { errorPatchService } from './errorPatchService';
import { useAppStore } from '@/store/appStore';

interface PatchRequest {
  componentId: string;
  error: string;
}

class PatchService {
  private static instance: PatchService;
  private patchQueue: PatchRequest[] = [];
  private isProcessing = false;

  private constructor() {
    logger.info('PatchService', 'Service initialized');
  }

  public static getInstance(): PatchService {
    if (!PatchService.instance) {
      PatchService.instance = new PatchService();
    }
    return PatchService.instance;
  }

  public queuePatch(componentId: string, error: string): void {  
    logger.info('PatchService', `Queueing patch request for component '${componentId}' due to error: ${error}`);
    this.patchQueue.push({ componentId, error });
    this.processQueue();
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.patchQueue.length === 0) {
      return;
    }

    // Start processing the next patch in queue
    this.isProcessing = true;
    const { componentId, error } = this.patchQueue.shift()!;
    logger.startOperation('PatchService', `PatchService.processQueue for '${componentId}'`);
    logger.info('PatchService', `Processing patch for component '${componentId}'`, { error });

    const state = useAppStore.getState();
    // Retrieve the current component list from the app state
    const componentList = state.currentComponents;
    const componentToFix = this.findComponent(componentList, componentId);

    if (!componentToFix) {
      logger.error('PatchService', `Component with id ${componentId} not found in state.`);
      this.isProcessing = false;
      logger.endOperation('PatchService', `PatchService.processQueue for '${componentId}'`, false);
      this.processQueue();
      return;
    }

    const componentString = JSON.stringify(componentToFix, null, 2);
    // Show the exact component we're trying to fix
    logger.info('PatchService', `Found component in state for '${componentId}':`, { 
      component: componentToFix,
      componentJSON: componentString 
    });
    
    // Attempt to fix the component via ErrorPatchService
    logger.info('PatchService', `Calling ErrorPatchService.attemptFix for component '${componentId}'`);
    const fixedComponentString = await errorPatchService.attemptFix(error, componentString, componentId);

    if (fixedComponentString) {
      logger.info('PatchService', `Received patched code string for component '${componentId}':`, { 
        originalCode: componentString,
        fixedCode: fixedComponentString,
        diff: fixedComponentString !== componentString ? 'CHANGED' : 'UNCHANGED'
      });
      try {
        const patchedComponent = JSON.parse(fixedComponentString) as UIComponent;
        logger.info('PatchService', `Parsed patched component for '${componentId}':`, { 
          patchedComponent,
          changes: JSON.stringify(patchedComponent, null, 2) 
        });
        logger.info('PatchService', `Applying patched component for '${componentId}' to app state`);
        useAppStore.getState().updateComponent(componentId, patchedComponent);
        logger.info('PatchService', `Component '${componentId}' updated successfully in app state`);
      } catch (parseErr) {
        logger.error('PatchService', `Failed to parse patched component JSON for '${componentId}'`, { 
          parseErr,
          invalidJSON: fixedComponentString 
        });
      }
    } else {
      logger.error('PatchService', `No patch generated for component '${componentId}'. Original component unchanged:`, {
        originalComponent: componentToFix,
        error: error
      });
    }

    logger.endOperation('PatchService', `PatchService.processQueue for '${componentId}'`, !!fixedComponentString);
    this.isProcessing = false;
    // Continue with next queued patch, if any
    this.processQueue();
  }

  private findComponent(components: UIComponent[], id: string): UIComponent | null {
    for (const component of components) {
      if (component.id === id) {
        return component;
      }
      if (component.children) {
        const foundInChildren = this.findComponent(
          component.children.filter(c => typeof c !== 'string') as UIComponent[],
          id
        );
        if (foundInChildren) {
          return foundInChildren;
        }
      }
    }
    return null;
  }
}

export const patchService = PatchService.getInstance();
