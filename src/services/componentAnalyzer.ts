import { getAIService } from './aiService';
import shadcnCache from '../cache/shadcn/cache.json';
import { availableShadcnComponents } from '../cache/shadcn/available';
import { logger } from './logger';

export interface ComponentAnalysis {
  requiredComponents: string[];
  customComponents: { name: string; description: string }[];
  compositeComponents: { name: string; components: string[]; description: string }[];
  reasoning: string;
}

class ComponentAnalyzer {
  private static instance: ComponentAnalyzer;
  private aiService: ReturnType<typeof getAIService>;
  private availableComponents: string[] = availableShadcnComponents.map(name => 
    name.toLowerCase().replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()
  );
  private cachedComponents: Record<string, boolean> = shadcnCache;

  private constructor() {
    this.aiService = getAIService();
    logger.info('ComponentAnalyzer', 'Service initialized');
  }

  static getInstance(): ComponentAnalyzer {
    if (!ComponentAnalyzer.instance) {
      ComponentAnalyzer.instance = new ComponentAnalyzer();
    }
    return ComponentAnalyzer.instance;
  }

  reinitialize(): void {
    // No longer need to re-initialize model here, AIService handles it
    logger.info('ComponentAnalyzer', 'Reinitialization requested. AIService handles its own lifecycle.');
  }

  async analyzeComponents(userPrompt: string): Promise<ComponentAnalysis> {
    logger.info('ComponentAnalyzer', 'Starting component analysis', { userPrompt });
    try {
      const analysis = await this.aiService.analyze(userPrompt, this.availableComponents);
      logger.info('ComponentAnalyzer', 'Component analysis successful', { required: analysis.requiredComponents.length });
      return this.validateAnalysis(analysis);
    } catch (error) {
      logger.error('ComponentAnalyzer', 'Component analysis failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        requiredComponents: [],
        customComponents: [],
        compositeComponents: [],
        reasoning: `An error occurred during analysis: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  private validateAnalysis(analysis: unknown): ComponentAnalysis {
    if (!analysis || typeof analysis !== 'object') {
      throw new Error('Invalid analysis structure: not an object');
    }

    const { requiredComponents, customComponents, compositeComponents, reasoning } = analysis as ComponentAnalysis;

    return {
      requiredComponents: requiredComponents || [],
      customComponents: customComponents || [],
      compositeComponents: compositeComponents || [],
      reasoning: reasoning || 'No reasoning provided.',
    };
  }

  isComponentAvailable(componentName: string): boolean {
    const available = this.cachedComponents[componentName.toLowerCase()] === true;
    logger.debug('ComponentAnalyzer', 'Checking component availability', { componentName, available });
    return available;
  }
}

export default ComponentAnalyzer;
