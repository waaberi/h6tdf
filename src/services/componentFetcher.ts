import shadcnCache from '../cache/shadcn/cache.json';
import { availableShadcnComponents } from '../cache/shadcn/available';

interface FetchResult {
  success: boolean;
  component: string;
  error?: string;
}

interface ComponentAvailability {
  available: string[];
  cached: string[];
  missing: string[];
}

export class ComponentFetcher {
  private cache: Record<string, boolean> = shadcnCache;
  private availableComponents: string[] = availableShadcnComponents.map(name => 
    name.toLowerCase().replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()
  );

  constructor() {
    // No initialization needed for browser-only mode
  }

  // Placeholder for consistency with other services
  reinitialize(): void {
    // No action needed for ComponentFetcher in browser mode
  }

  private checkComponentAvailability(components: string[]): ComponentAvailability {
    const available: string[] = [];
    const cached: string[] = [];
    const missing: string[] = [];

    for (const component of components) {
      const normalizedName = component.toLowerCase().trim();
      
      if (this.availableComponents.includes(normalizedName)) {
        available.push(normalizedName);
        if (this.cache[normalizedName]) {
          cached.push(normalizedName);
        }
      } else {
        missing.push(normalizedName);
      }
    }

    return { available, cached, missing };
  }

  async fetchComponents(components: string[]): Promise<FetchResult[]> {
    const results: FetchResult[] = [];
    const availability = this.checkComponentAvailability(components);
    
    // All components are pre-cached, so we just validate they exist
    for (const component of availability.available) {
      if (this.cache[component]) {
        results.push({
          success: true,
          component
        });
      } else {
        results.push({
          success: false,
          component,
          error: `Component '${component}' not found in cache`
        });
      }
    }

    // Handle missing components
    for (const missing of availability.missing) {
      results.push({
        success: false,
        component: missing,
        error: `Component '${missing}' not available in Shadcn registry`
      });
    }

    return results;
  }

  async ensureComponentsAvailable(components: string[]): Promise<boolean> {
    const results = await this.fetchComponents(components);
    const failures = results.filter(r => !r.success);
    
    if (failures.length > 0) {
      console.error('Components not available in cache:', failures.map(f => f.component));
      return false;
    }
    
    return true;
  }

  /**
   * Check if all requested components are available in cache
   */
  areComponentsCached(components: string[]): boolean {
    return components.every(component => this.cache[component] === true);
  }

  /**
   * Get list of all cached components
   */
  getCachedComponents(): string[] {
    return Object.keys(this.cache).filter(component => this.cache[component]);
  }
}
