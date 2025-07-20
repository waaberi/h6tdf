import { getAIService } from './aiService';
import ComponentAnalyzer, { type ComponentAnalysis } from './componentAnalyzer';
import { ComponentFetcher } from './componentFetcher';
import type { UIComponent } from '../types';
import { logger } from './logger';

interface GenerationStep {
  step: number;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: unknown;
  error?: string;
  retryCount?: number;
}

interface UIGenerationContext {
  userPrompt: string;
  analyzedComponents: ComponentAnalysis | null;
  availableComponents: string[];
  generatedCode: string;
  steps: GenerationStep[];
}

export class MultiAgentUIGenerator {
  private analyzer: ComponentAnalyzer;
  private fetcher: ComponentFetcher;
  private aiService: ReturnType<typeof getAIService>;
  private maxRetries = 3;

  constructor() {
    this.analyzer = ComponentAnalyzer.getInstance();
    this.fetcher = new ComponentFetcher();
    this.aiService = getAIService();
    logger.info('MultiAgentUIGenerator', 'Service initialized');
  }

  // Method to reinitialize when API key is set
  reinitialize(): void {
    this.analyzer.reinitialize();
    this.fetcher.reinitialize();
    // AIService handles its own reinitialization
    logger.info('MultiAgentUIGenerator', 'Reinitialization requested.');
  }

  async generateUI(userPrompt: string): Promise<{
    components: UIComponent[];
    context: UIGenerationContext;
    success: boolean;
  }> {
    logger.info('MultiAgentUIGenerator', '🚀 Starting UI generation', { 
      userPrompt,
      timestamp: new Date().toISOString()
    });
    
    const context: UIGenerationContext = {
      userPrompt,
      analyzedComponents: null,
      availableComponents: [],
      generatedCode: '',
      steps: [
        { step: 1, description: 'Analyze UI requirements', status: 'pending' },
        { step: 2, description: 'Check component availability', status: 'pending' },
        { step: 3, description: 'Fetch missing components', status: 'pending' },
        { step: 4, description: 'Generate component code', status: 'pending' },
        { step: 5, description: 'Validate and assemble UI', status: 'pending' }
      ]
    };

    try {
      // Step 1: Analyze components
      await this.executeStep(context, 0, async () => {
        context.analyzedComponents = await this.analyzer.analyzeComponents(userPrompt);
        return context.analyzedComponents;
      });

      // Step 2: Check availability
      await this.executeStep(context, 1, async () => {
        if (!context.analyzedComponents) {
          throw new Error('No analyzed components available');
        }
        
        const allRequired = context.analyzedComponents.requiredComponents;
        const allCompositeShadcn = context.analyzedComponents.compositeComponents.flatMap(c => c.components);
        const allComponents = [...new Set([...allRequired, ...allCompositeShadcn])];
        
        const available: string[] = [];
        const unavailable: string[] = [];

        allComponents.forEach(comp => {
          if (this.analyzer.isComponentAvailable(comp)) {
            available.push(comp);
          } else {
            unavailable.push(comp);
          }
        });

        context.availableComponents = available;
        return { available, unavailable };
      });

      // Step 3: Fetch missing components (if any)
      const step2Result = context.steps[1].result as { available: string[], unavailable: string[] };
      const unavailable = step2Result.unavailable;
      if (unavailable.length > 0) {
        await this.executeStep(context, 2, async () => {
          const result = await this.fetcher.fetchComponents(unavailable);
          // After fetching, update the analyzer's internal cache/state
          this.analyzer.reinitialize(); // Or a more targeted update if available
          return result;
        });
      } else {
        context.steps[2].status = 'completed';
        context.steps[2].result = 'No components to fetch';
      }

      // Step 4: Generate component code
      await this.executeStep(context, 3, async () => {
        context.generatedCode = await this.generateComponentCode(context);
        return context.generatedCode;
      });

      // Step 5: Validate and assemble UI
      const components = await this.executeStep(context, 4, async () => {
        return this.assembleComponents(context);
      });

      logger.info('MultiAgentUIGenerator', '🎉 UI generation completed successfully', { userPrompt });
      return { components, context, success: true };

    } catch (error) {
      logger.error('MultiAgentUIGenerator', '💥 UI generation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userPrompt,
        failedStep: context.steps.find(s => s.status === 'failed')?.description
      });
      return { components: [], context, success: false };
    }
  }

  private async executeStep<T>(
    context: UIGenerationContext,
    stepIndex: number,
    operation: () => Promise<T>,
    retryCount = 0
  ): Promise<T> {
    const step = context.steps[stepIndex];
    step.status = 'running';
    step.retryCount = retryCount;

    logger.info('MultiAgentUIGenerator', `📋 Step ${step.step}: ${step.description}`, {
      stepIndex,
      stepDescription: step.description,
      retryCount,
      userPrompt: context.userPrompt
    });

    try {
      const result = await operation();
      step.status = 'completed';
      step.result = result;
      
      logger.info('MultiAgentUIGenerator', `✅ Step ${step.step} completed successfully`, {
        stepIndex,
        stepDescription: step.description,
        resultType: typeof result,
        resultPreview: JSON.stringify(result).slice(0, 200)
      });
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      if (retryCount < this.maxRetries - 1) {
        logger.warn('MultiAgentUIGenerator', `🔄 Step ${step.step} retry ${retryCount + 1}/${this.maxRetries}`, {
          stepIndex,
          stepDescription: step.description,
          error: errorMessage,
          retryCount: retryCount + 1
        });
        return this.executeStep(context, stepIndex, operation, retryCount + 1);
      }
      
      step.status = 'failed';
      step.error = errorMessage;
      
      logger.error('MultiAgentUIGenerator', `❌ Step ${step.step} failed after ${this.maxRetries} attempts`, {
        stepIndex,
        stepDescription: step.description,
        error: errorMessage,
        totalRetries: this.maxRetries
      });
      
      throw error;
    }
  }

  private async generateComponentCode(context: UIGenerationContext): Promise<string> {
    if (!context.analyzedComponents) {
      throw new Error('Cannot generate code without component analysis.');
    }
    // Corrected to use `generateCode` and pass the correct object
    const components = await this.aiService.generateCode({
      userPrompt: context.userPrompt,
      componentAnalysis: context.analyzedComponents,
      availableComponents: context.availableComponents
    });
    // The AI service now returns a UIComponent[] array, so we stringify it for the context
    return JSON.stringify(components, null, 2);
  }

  private async assembleComponents(context: UIGenerationContext): Promise<UIComponent[]> {
    logger.debug('MultiAgentUIGenerator', '🔧 Assembling components from generated code', {
      generatedCodeLength: context.generatedCode.length,
    });

    try {
      // The generatedCode is now a JSON string of the components array.
      const components = JSON.parse(context.generatedCode);
      
      logger.info('MultiAgentUIGenerator', '✅ Components assembled successfully', {
        componentCount: components.length,
      });

      return components as UIComponent[];
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown parsing error';
      
      logger.error('MultiAgentUIGenerator', '❌ Failed to assemble components', {
        error: errorMessage,
        rawGeneratedCode: context.generatedCode,
      });

      // The generatedCode is a string, not an object.
      const fallbackComponent: UIComponent = {
        id: `fallback-${Date.now()}`,
        type: 'card',
        props: {
          title: 'Assembly Error',
          content: `Failed to assemble UI components. Raw output was: ${context.generatedCode}`,
          className: 'border-red-500 bg-red-50 text-red-900'
        },
        metadata: {
          generated_at: new Date().toISOString(),
          prompt: context.userPrompt,
          version: 1
        }
      };

      logger.info('MultiAgentUIGenerator', '🔄 Returning fallback error component');
      return [fallbackComponent];
    }
  }
}
