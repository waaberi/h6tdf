import { mongodb } from './mongodb';
import { logger } from './logger';
import type { UIComponent } from '../types';
import type { FullContext } from '../lib/contextManager';

export interface CachedComponent {
  componentId: string;
  component: UIComponent;
  metadata: {
    createdAt: string;
    mountPoint?: string;
    prompt?: string;
    context?: FullContext;
  };
}

export interface CachedMountPoint {
  mountId: string;
  elementDetails: {
    selector: string;
    attributes: Record<string, string>;
  };
  components: string[]; // Array of componentIds
  metadata: {
    lastUpdated: string;
    registeredAt: string;
  };
}

export interface GenerationHistoryEntry {
  id: string;
  timestamp: string;
  action: 'create' | 'update' | 'delete';
  componentId: string;
  mountPoint?: string;
  snapshot: UIComponent;
  context: FullContext;
}

class CacheService {
  private static instance: CacheService;
  
  private constructor() {}

  static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }

  async initialize(): Promise<void> {
    await mongodb.connect();
    await this.loadInitialState();
  }

  private async loadInitialState(): Promise<void> {
    try {
      const components = mongodb.getCollection('components');
      const mountPoints = mongodb.getCollection('mountPoints');

      if (!components || !mountPoints) {
        throw new Error('Collections not initialized');
      }

      // Load mount points first
      const cachedMountPoints = await mountPoints.find({}).toArray();
      logger.info('Cache', 'Loaded mount points', { count: cachedMountPoints.length });

      // Then load associated components
      const cachedComponents = await components.find({}).toArray();
      logger.info('Cache', 'Loaded components', { count: cachedComponents.length });

    } catch (error) {
      logger.error('Cache', 'Failed to load initial state', { error });
      throw error;
    }
  }

  async cacheComponent(component: UIComponent, context: FullContext): Promise<void> {
    try {
      const components = mongodb.getCollection('components');
      if (!components) throw new Error('Components collection not initialized');

      const cached: CachedComponent = {
        componentId: component.id,
        component,
        metadata: {
          createdAt: new Date().toISOString(),
          mountPoint: context.triggerId,
          context
        }
      };

      await components.updateOne(
        { componentId: component.id },
        { $set: cached },
        { upsert: true }
      );

      await this.addToHistory({
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        action: 'create',
        componentId: component.id,
        mountPoint: context.triggerId,
        snapshot: component,
        context
      });

      logger.info('Cache', 'Component cached', { componentId: component.id });
    } catch (error) {
      logger.error('Cache', 'Failed to cache component', { error, componentId: component.id });
      throw error;
    }
  }

  async registerMountPoint(
    mountId: string,
    element: HTMLElement
  ): Promise<void> {
    try {
      const mountPoints = mongodb.getCollection('mountPoints');
      if (!mountPoints) throw new Error('MountPoints collection not initialized');

      const cached: CachedMountPoint = {
        mountId,
        elementDetails: {
          selector: this.generateSelector(element),
          attributes: Object.fromEntries(
            Array.from(element.attributes).map(attr => [attr.name, attr.value])
          )
        },
        components: [],
        metadata: {
          lastUpdated: new Date().toISOString(),
          registeredAt: new Date().toISOString()
        }
      };

      await mountPoints.updateOne(
        { mountId },
        { $set: cached },
        { upsert: true }
      );

      logger.info('Cache', 'Mount point registered', { mountId });
    } catch (error) {
      logger.error('Cache', 'Failed to register mount point', { error, mountId });
      throw error;
    }
  }

  async unregisterMountPoint(mountId: string): Promise<void> {
    try {
      const mountPoints = mongodb.getCollection('mountPoints');
      if (!mountPoints) throw new Error('MountPoints collection not initialized');

      await mountPoints.deleteOne({ mountId });
      logger.info('Cache', 'Mount point unregistered', { mountId });
    } catch (error) {
      logger.error('Cache', 'Failed to unregister mount point', { error, mountId });
      throw error;
    }
  }

  private async addToHistory(entry: GenerationHistoryEntry): Promise<void> {
    try {
      const generations = mongodb.getCollection('generations');
      if (!generations) throw new Error('Generations collection not initialized');

      await generations.insertOne(entry);
    } catch (error) {
      logger.error('Cache', 'Failed to add history entry', { error, entryId: entry.id });
      throw error;
    }
  }

  private generateSelector(element: HTMLElement): string {
    const id = element.id ? `#${element.id}` : '';
    const classes = element.className ? `.${element.className.split(' ').join('.')}` : '';
    return `${element.tagName.toLowerCase()}${id}${classes}`;
  }

  // Utility method to find a cached component by ID
  async getComponent(componentId: string): Promise<CachedComponent | null> {
    try {
      const components = mongodb.getCollection('components');
      if (!components) throw new Error('Components collection not initialized');

      return await components.findOne({ componentId });
    } catch (error) {
      logger.error('Cache', 'Failed to get component', { error, componentId });
      return null;
    }
  }

  // Get all components for a mount point
  async getMountPointComponents(mountId: string): Promise<CachedComponent[]> {
    try {
      const components = mongodb.getCollection('components');
      if (!components) throw new Error('Components collection not initialized');

      return await components
        .find({ 'metadata.mountPoint': mountId })
        .toArray();
    } catch (error) {
      logger.error('Cache', 'Failed to get mount point components', { error, mountId });
      return [];
    }
  }

  // Get generation history for a component
  async getComponentHistory(componentId: string): Promise<GenerationHistoryEntry[]> {
    try {
      const generations = mongodb.getCollection('generations');
      if (!generations) throw new Error('Generations collection not initialized');

      return await generations
        .find({ componentId })
        .sort({ timestamp: -1 })
        .toArray();
    } catch (error) {
      logger.error('Cache', 'Failed to get component history', { error, componentId });
      return [];
    }
  }
}

export const cacheService = CacheService.getInstance();
