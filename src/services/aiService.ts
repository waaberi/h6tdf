// SINGLE SOURCE OF TRUTH for ALL DeepSeek AI/LangChain configuration and instances
import { ChatOpenAI } from '@langchain/openai';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { Runnable } from '@langchain/core/runnables';
import { logger } from './logger';
import { extractJson } from '../lib/ai-parsers';
import type { ComponentAnalysis } from './componentAnalyzer';
import type { AIGenerationResponse, UIComponent } from '../types';
import type { FullContext } from '../lib/contextManager';

// ============================================================================
// DEEPSEEK-ONLY CONFIGURATION
// ============================================================================

export interface AIModelConfig {
  modelName: string;
  apiKey: string;
  baseURL: string;
  temperature: number;
  maxTokens?: number;
}

export interface AIServiceConfig {
  analyzer: AIModelConfig;
  codeGenerator: AIModelConfig;
  errorPatcher: AIModelConfig; // Added for error patching
  default: AIModelConfig;
}

// 🎯 HARDCODED DEEPSEEK API KEY & ENDPOINT
const DEEPSEEK_API_KEY = 'sk-feb24d1479be40829cb0c0e9e5e77087';
const DEEPSEEK_BASE_URL = 'https://api.deepseek.com/v1';

// 🎯 MAIN CONFIGURATION - DEEPSEEK ONLY
export const AI_CONFIG: AIServiceConfig = {
  analyzer: {
    modelName: 'deepseek-chat',
    baseURL: DEEPSEEK_BASE_URL,
    apiKey: DEEPSEEK_API_KEY,
    temperature: 0.3,
    maxTokens: 4000,
  },
  
  codeGenerator: {
    modelName: 'deepseek-coder',
    baseURL: DEEPSEEK_BASE_URL,
    apiKey: DEEPSEEK_API_KEY,
    temperature: 0.2,
    maxTokens: 8000,
  },
  
  errorPatcher: {
    modelName: 'deepseek-coder',
    baseURL: DEEPSEEK_BASE_URL,
    apiKey: DEEPSEEK_API_KEY,
    temperature: 0.1,
    maxTokens: 4000,
  },
  
  default: {
    modelName: 'deepseek-chat',
    baseURL: DEEPSEEK_BASE_URL,
    apiKey: DEEPSEEK_API_KEY,
    temperature: 0.5,
  },
};

// ============================================================================
// AI MODEL CACHE & INITIALIZATION
// ============================================================================

// Using a Map for the cache for better performance and API
const modelCache = new Map<keyof AIServiceConfig, BaseChatModel>();

/**
 * Creates a new ChatOpenAI model instance with the given configuration.
 * This is the only place where ChatOpenAI models are instantiated.
 * @param config The configuration for the AI model.
 * @returns A new instance of BaseChatModel.
 */
function createModel(config: AIModelConfig): BaseChatModel {
  logger.info('AIService', `Creating LLM instance`, { modelName: config.modelName, temperature: config.temperature });
  // Note: We use ChatOpenAI as the client because the Deepseek API is OpenAI-compatible.
  // The configuration below directs it to the Deepseek endpoint and uses the specific API key.
  return new ChatOpenAI({
    modelName: config.modelName,
    // The 'apiKey' property is the correct way to pass the key directly.
    // This resolves the "missing API key" error.
    apiKey: config.apiKey,
    configuration: {
      baseURL: config.baseURL,
    },
    temperature: config.temperature,
    maxTokens: config.maxTokens,
    // Disable the cache to prevent the "insecure cache algorithm" warning.
    cache: false,
    verbose: true,
  });
}

/**
 * Retrieves a model from the cache or creates a new one if not found.
 * @param type The type of model to get (e.g., 'analyzer', 'codeGenerator').
 * @returns The requested BaseChatModel instance.
 */
function getModel(type: keyof AIServiceConfig): BaseChatModel {
  if (!modelCache.has(type)) {
    const model = createModel(AI_CONFIG[type]);
    modelCache.set(type, model);
  }
  return modelCache.get(type)!;
}

// ============================================================================
// UTILITY & REINITIALIZATION
// ============================================================================

/**
 * Clears the model cache. This can be used if configuration needs to be reloaded.
 */
export function clearModelCache(): void {
  modelCache.clear();
  logger.info("AIService", "AI model cache cleared.");
}

/**
 * Re-initializes the AI services. Currently, it just clears the cache.
 * This function can be expanded if more complex re-initialization is needed.
 */
export function reinitializeAIServices(): void {
  clearModelCache();
  // Future re-initialization logic can go here
}

// ============================================================================
// PROMPT TEMPLATES
// ============================================================================

const ANALYZER_PROMPT = ChatPromptTemplate.fromTemplate(`
You are an expert UI analyst. Your task is to break down a user's request into a list of required components.
USER REQUEST: {userPrompt}
AVAILABLE COMPONENTS: {availableComponents}

Analyze the request and return a JSON object with this structure:
{{
  "requiredComponents": ["component-name-1", "component-name-2"],
  "customComponents": [{{ "name": "custom-comp", "description": "..." }}],
  "compositeComponents": [{{ "name": "composite-comp", "components": ["c1", "c2"], "description": "..." }}],
  "reasoning": "Your reasoning for the choices."
}}

- Use only components from the AVAILABLE COMPONENTS list.
- Identify any components that need to be created from scratch (customComponents).
- Identify any composite components (e.g., a search bar with a button).
- Provide clear reasoning.
`);

const CODE_GENERATOR_PROMPT = ChatPromptTemplate.fromTemplate(`
You are a React component code generator. Generate clean, functional React components based on the analysis.
USER REQUEST: {userPrompt}
COMPONENT ANALYSIS: {componentAnalysis}
AVAILABLE COMPONENTS: {availableComponents}

Generate a JSON array of UIComponent objects with this structure:
[
  {{
    "id": "unique-id",
    "type": "component-type",
    "props": {{ "key": "value" }},
    "children": [],
    "metadata": {{ "generated_at": "timestamp", "prompt": "original prompt", "version": 1 }}
  }}
]

Guidelines:
1. Use only available Shadcn components or standard HTML elements.
2. Create proper component hierarchy with children.
3. Include appropriate props for styling and functionality.
4. Ensure accessibility with proper ARIA attributes.
5. Generate semantic, clean component structures.
`);

const ERROR_PATCHER_PROMPT = ChatPromptTemplate.fromTemplate(`
You are an expert React developer. A component has failed to render. Analyze the error and the component's code, then provide a corrected version of the component's JSON definition.

ERROR: {error}
FAILED COMPONENT CODE: {componentCode}
CONTEXT: {context}

Instructions:
1. Analyze the error message and the component's code.
2. Identify the root cause of the error.
3. Return ONLY the corrected JSON object for the component. Do not include any explanations or surrounding text.
4. If you need to change the component "type", ensure it's a valid React component or HTML tag.
5. Ensure the corrected JSON is valid and can be parsed directly.

Corrected Component JSON:
`);

const UI_GENERATOR_PROMPT = ChatPromptTemplate.fromTemplate(`
You are a UI generation agent that creates React-like component structures based on user prompts.
Your task is to generate a JSON structure representing UI components that can be dynamically rendered.

Current Context:
- User Prompt: {prompt}
- Current UI State: {currentUI}
- User Intent: {userIntent}
- Previous Interactions: {previousInteractions}

Available Component Types: search-bar, button, input, card, list, modal, form, navigation
Available HTML Elements: div, span, iframe, video, audio, canvas, img, p, h1, h2, h3, section, article, etc.

Generate a JSON response with the following structure:
{{
  "components": [
    {{
      "id": "unique-id",
      "type": "component-type",
      "props": {{
        "key": "value"
      }},
      "children": [],
      "metadata": {{
        "generated_at": "timestamp",
        "prompt": "original prompt",
        "version": 1
      }}
    }}
  ],
  "reasoning": "Explanation of design choices",
  "suggestions": ["suggestion1", "suggestion2"]
}}

Guidelines:
1. Create modern, accessible UI components
2. Use semantic component types when possible
3. Include appropriate props for styling and functionality
4. Consider user experience and interaction flow
5. Build upon existing UI state when provided
6. Suggest logical next steps or enhancements

Generate the UI components now:
`);

const RECURSIVE_GENERATOR_PROMPT = ChatPromptTemplate.fromTemplate(`
You are a recursive UI generation agent. An event was triggered on a component without an explicit handler.
Your task is to generate a new UI component in response to this interaction, based on the provided context.

Context:
- Triggering Event: An event occurred on a '{triggerElement.type}' component (ID: {triggerElement.id}).
- Element Position: Index {triggerElement.position.index}, Depth {triggerElement.position.depth}.
- User Input: {userInput}
- Sibling Components: {siblingComponents}
- Parent Component: {parentComponent}
- Full Application State: {appState.allComponents}

Based on this context, generate a single, new UI component to be inserted into the UI.
The component should be a logical continuation of the user's interaction.

Generate a JSON response with the following structure:
{{
  "ui": {{
    "id": "recursive-unique-id",
    "type": "component-type",
    "props": {{ "key": "value" }},
    "children": [],
    "metadata": {{ "generated_at": "timestamp", "trigger": "recursive", "version": 1 }}
  }},
  "metadata": {{
    "componentId": "recursive-unique-id",
    "reasoning": "Your reasoning for this specific component choice."
  }}
}}

Guidelines:
1.  Generate only ONE component.
2.  The component should be self-contained.
3.  Ensure the 'id' is unique.
4.  Provide clear reasoning for your choice.

Generate the recursive UI component now:
`);


// Singleton instance
let instance: AIService | null = null;

export class AIService {
  private analyzerChain: Runnable;
  private codeGeneratorChain: Runnable;
  private errorPatcherChain: Runnable;
  private uiGeneratorChain: Runnable;
  private recursiveGeneratorChain: Runnable; // New chain for recursive generation

  constructor() {
    // Chains are now initialized in the constructor
    this.analyzerChain = this.createChain('analyzer', ANALYZER_PROMPT);
    this.codeGeneratorChain = this.createChain('codeGenerator', CODE_GENERATOR_PROMPT);
    this.errorPatcherChain = this.createChain('errorPatcher', ERROR_PATCHER_PROMPT);
    this.uiGeneratorChain = this.createChain('codeGenerator', UI_GENERATOR_PROMPT); // Using codeGenerator model for UI generation
    this.recursiveGeneratorChain = this.createChain('codeGenerator', RECURSIVE_GENERATOR_PROMPT); // Using codeGenerator model
  }

  /**
   * Creates a chain with the given type and prompt template.
   * @param type The type of the chain (e.g., 'analyzer').
   * @param promptTemplate The prompt template to use for the chain.
   * @returns A Runnable chain instance.
   */
  private createChain(type: keyof AIServiceConfig, promptTemplate: ChatPromptTemplate): Runnable {
    return promptTemplate.pipe(getModel(type)).pipe(new StringOutputParser());
  }

  /**
   * Runs the specified chain with the given input.
   * @param chainName The name of the chain to run.
   * @param chain The chain instance to run.
   * @param input The input data for the chain.
   * @param errorMessage The error message to throw in case of failure.
   * @returns The result of the chain.
   */
  private async runChain<T>(chainName: string, chain: Runnable, input: Record<string, unknown>, errorMessage: string): Promise<T> {
    logger.info('AIService', `Invoking ${chainName} chain`, { params: { ...input, apiKey: 'REDACTED' } });
    const startTime = Date.now();

    try {
      const rawResult = await chain.invoke({ ...input, apiKey: DEEPSEEK_API_KEY });
      const endTime = Date.now();
      logger.info('AIService', `LLM call for ${chainName} successful`, {
        duration: `${endTime - startTime}ms`,
        responseLength: rawResult.length,
      });
      logger.debug('AIService', `Raw response from ${chainName}`, { rawResult });

      const parsedResult = JSON.parse(extractJson(rawResult));
      logger.info('AIService', `Successfully parsed response from ${chainName}`);
      logger.info('AIService', `PARSED JSON FROM LLM (${chainName}):`, parsedResult);
      console.log(`🔥 RAW PARSED JSON FROM ${chainName.toUpperCase()}:`, parsedResult);
      logger.debug('AIService', `Parsed response from ${chainName}`, { parsedResult });

      return parsedResult;
    } catch (error) {
      const endTime = Date.now();
      logger.error('AIService', `Error invoking ${chainName} chain`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        duration: `${endTime - startTime}ms`,
      });
      throw new Error(`${errorMessage}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async analyze(userPrompt: string, availableComponents: string[]): Promise<ComponentAnalysis> {
    return this.runChain<ComponentAnalysis>('analyzerChain', this.analyzerChain, { userPrompt, availableComponents: availableComponents.join(', ') }, 'Failed to analyze user prompt');
  }

  async generateCode(input: { userPrompt: string; componentAnalysis: ComponentAnalysis; availableComponents: string[]; }): Promise<UIComponent[]> {
    return this.runChain<UIComponent[]>('codeGeneratorChain', this.codeGeneratorChain, input, 'Failed to generate component code');
  }

  async generateUI(input: { prompt: string; currentUI: string; userIntent: string; previousInteractions: string; }): Promise<AIGenerationResponse> {
    return this.runChain<AIGenerationResponse>('uiGeneratorChain', this.uiGeneratorChain, input, 'Failed to generate UI');
  }

  async fix(input: { error: string; componentCode: string; context: string; }): Promise<UIComponent> {
    return this.runChain<UIComponent>('errorPatcherChain', this.errorPatcherChain, input, 'Failed to patch component');
  }

  /**
   * New method for recursive UI generation
   */
  async generateRecursive(context: FullContext): Promise<{ ui: UIComponent; metadata: { componentId: string; reasoning: string; } }> {
    const input = {
      triggerElement: context.triggerElement,
      userInput: context.userInput || 'No direct input.',
      siblingComponents: JSON.stringify(context.siblingComponents.map((c: UIComponent) => c.type)),
      parentComponent: context.parentComponent ? context.parentComponent.type : 'none',
      appState: { allComponents: JSON.stringify(context.appState.allComponents.map((c: UIComponent) => c.type)) }
    };
    
    return this.runChain<{ ui: UIComponent; metadata: { componentId: string; reasoning:string; } }>(
      'recursiveGeneratorChain', 
      this.recursiveGeneratorChain, 
      input, 
      'Failed to generate recursive UI'
    );
  }
}

/**
 * Gets the singleton instance of AIService.
 * @returns The AIService instance.
 */
export const getAIService = (): AIService => {
  if (!instance) {
    instance = new AIService();
  }
  return instance;
};

// ============================================================================
// PUBLIC API FUNCTIONS
// ============================================================================

/**
 * Builds a prompt for the AI service based on the captured context.
 * This function formats the context into a string that the LLM can understand.
 * @param context The full context captured by the contextManager.
 * @returns A string prompt for the AI.
 */
export const buildFallbackPrompt = (context: FullContext): FullContext => {
  // In this setup, the context object itself is the prompt.
  // The LangChain template will extract the fields it needs.
  logger.info('AIService', 'Building fallback prompt from context', { context });
  return context;
};

/**
 * Triggers recursive UI generation.
 * This is the main entry point for the recursive generation flow.
 * @param prompt The context object from buildFallbackPrompt.
 * @returns A promise that resolves to the generated UI and metadata.
 */
export const generateRecursiveUI = async (
  prompt: FullContext
): Promise<{ ui: UIComponent; metadata: { componentId: string; reasoning: string } }> => {
  const aiService = getAIService();
  try {
    const result = await aiService.generateRecursive(prompt);
    return result;
  } catch (error) {
    logger.error('AIService', 'Recursive UI generation failed', { error });
    // You might want to return a default error component here
    throw error;
  }
};
