import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { UIState, UISession, UIComponent } from '../types';
import { storageManager } from '../services/storage';
import { getAIService } from '../services/aiService';

interface AppState {
  // Current session and UI state
  currentSession: UISession | null;
  currentUIState: UIState | null;
  currentComponents: UIComponent[];
  
  // UI state management
  savedStates: UIState[];
  isLoading: boolean;
  error: string | null;
  
  // AI interaction
  isGenerating: boolean;
  lastAIResponse: string | null;
  suggestions: string[];
  
  // Actions
  initializeSession: () => Promise<void>;
  setCurrentUIState: (state: UIState) => void;
  saveCurrentState: (name: string, description?: string) => Promise<void>;
  loadUIState: (stateId: string) => Promise<void>;
  generateUI: (prompt: string) => Promise<void>;
  enhanceCurrentUI: (enhancement: string) => Promise<void>;
  rollbackToVersion: (stateId: string, version: number) => Promise<void>;
  loadSavedStates: () => Promise<void>;
  searchStates: (query: string) => Promise<UIState[]>;
  deleteState: (stateId: string) => Promise<void>;
  clearError: () => void;
  
  // Component management
  updateComponent: (componentId: string, updates: Partial<UIComponent>) => void;
  removeComponent: (componentId: string) => void;
  addComponent: (component: UIComponent, position?: number) => void;
  insertComponentAfter: (targetComponentId: string, newComponent: UIComponent) => void;
  // Placeholder-driven generation
  generatePlaceholder: (placeholder: import('../types').UIPlaceholder, inputValue?: unknown) => Promise<void>;
}

export const useAppStore = create<AppState>()(
  devtools((set, get) => ({
    // Initial state
    currentSession: null,
    currentUIState: null,
    currentComponents: [],
    savedStates: [],
    isLoading: false,
    error: null,
    isGenerating: false,
    lastAIResponse: null,
    suggestions: [],

      // Initialize a new session
      initializeSession: async () => {
        set({ isLoading: true, error: null });
        try {
          const session = await storageManager.createSession();
          
          // Create initial UI state with search bar
          const initialComponents: UIComponent[] = [{
            id: `search-${Date.now()}`,
            type: 'search-bar',
            props: {
              placeholder: 'Start exploring... What would you like to build?',
              variant: 'outlined',
              size: 'large',
              autoFocus: true
            },
            metadata: {
              generated_at: new Date().toISOString(),
              prompt: 'Initial search interface',
              version: 1
            }
          }];

          const initialState = await storageManager.saveUIState({
            name: 'Initial Interface',
            description: 'Starting point with search functionality',
            components: initialComponents,
            connections: []
          });

          await storageManager.updateSession(session.id, {
            current_state_id: initialState.id,
            history: [initialState.id]
          });

          set({ 
            currentSession: { ...session, current_state_id: initialState.id, history: [initialState.id] },
            currentUIState: initialState,
            currentComponents: initialComponents,
            isLoading: false
          });

        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Failed to initialize session',
            isLoading: false
          });
        }
      },

      // Set current UI state
      setCurrentUIState: (state: UIState) => {
        set({ 
          currentUIState: state,
          currentComponents: state.components,
          error: null
        });
      },

      // Save current state
      saveCurrentState: async (name: string, description?: string) => {
        const { currentComponents, currentSession } = get();
        if (!currentComponents.length) return;

        set({ isLoading: true, error: null });
        try {
          const newState = await storageManager.saveUIState({
            name,
            description,
            components: currentComponents,
            connections: []
          });

          // Update session history
          if (currentSession) {
            const updatedHistory = [...currentSession.history, newState.id];
            await storageManager.updateSession(currentSession.id, {
              current_state_id: newState.id,
              history: updatedHistory
            });
            
            set({ 
              currentSession: { ...currentSession, current_state_id: newState.id, history: updatedHistory },
              currentUIState: newState,
              isLoading: false
            });
          }

          // Refresh saved states
          get().loadSavedStates();
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Failed to save state',
            isLoading: false
          });
        }
      },

      // Load a UI state
      loadUIState: async (stateId: string) => {
        set({ isLoading: true, error: null });
        try {
          const state = await storageManager.getUIState(stateId);
          if (!state) {
            throw new Error('UI state not found');
          }

          const { currentSession } = get();
          if (currentSession) {
            const updatedHistory = [...currentSession.history, stateId];
            await storageManager.updateSession(currentSession.id, {
              current_state_id: stateId,
              history: updatedHistory
            });
            
            set({ 
              currentSession: { ...currentSession, current_state_id: stateId, history: updatedHistory },
              currentUIState: state,
              currentComponents: state.components,
              isLoading: false
            });
          } else {
            set({
              currentUIState: state,
              currentComponents: state.components,
              isLoading: false
            });
          }
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Failed to load state',
            isLoading: false
          });
        }
      },

      // Generate UI with AI
      generateUI: async (prompt: string) => {
        const { currentUIState, currentSession } = get();
        set({ isGenerating: true, error: null });
        
        try {
          const response = await getAIService().generateUI({
            prompt,
            currentUI: currentUIState?.components ? JSON.stringify(currentUIState.components) : "[]",
            userIntent: prompt,
            previousInteractions: currentSession?.history?.join(', ') || 'None',
          });

          console.log('🔥 FULL AI RESPONSE RECEIVED IN STORE:', response);
          console.log('🔥 COMPONENTS FROM AI RESPONSE:', response.components);

          set({
            currentComponents: response.components,
            lastAIResponse: response.reasoning || null,
            suggestions: response.suggestions || [],
            isGenerating: false
          });

        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Failed to generate UI',
            isGenerating: false
          });
        }
      },
      // Generate components for a placeholder and replace it in currentComponents
      generatePlaceholder: async (placeholder, inputValue) => {
        const { currentComponents } = get();
        set({ isGenerating: true, error: null });
        try {
          // Build actual prompt by injecting user input
          const basePrompt = placeholder.props.generationPrompt;
          const finalPrompt = basePrompt.replace('{{userInput}}', String(inputValue || ''));
          // Generate new components via MultiAgentUIGenerator
          const { components: newComponents, success } = await new (await import('../services/multiAgentGenerator')).MultiAgentUIGenerator().generateUI(finalPrompt);
          if (!success) throw new Error('Placeholder generation failed');
          // Replace placeholder in currentComponents (top-level only)
          const updatedComponents = currentComponents.flatMap(comp => comp.id === placeholder.id ? newComponents : [comp]);
          set({ currentComponents: updatedComponents, isGenerating: false });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to generate placeholder',
            isGenerating: false
          });
        }
      },

      // Enhance current UI
      enhanceCurrentUI: async (enhancement: string) => {
        const { currentComponents, currentSession } = get();
        if (!currentComponents.length) return;

        set({ isGenerating: true, error: null });
        try {
          const response = await getAIService().generateUI({
            prompt: enhancement,
            currentUI: JSON.stringify(currentComponents),
            userIntent: `Enhance UI with: ${enhancement}`,
            previousInteractions: currentSession?.history?.join(', ') || 'None',
          });
          
          set({
            currentComponents: response.components,
            lastAIResponse: response.reasoning || null,
            suggestions: response.suggestions || [],
            isGenerating: false
          });

        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Failed to enhance UI',
            isGenerating: false
          });
        }
      },

      // Rollback to previous version
      rollbackToVersion: async (stateId: string, version: number) => {
        set({ isLoading: true, error: null });
        try {
          const rolledBackState = await storageManager.rollbackToVersion(stateId, version);
          if (rolledBackState) {
            set({
              currentUIState: rolledBackState,
              currentComponents: rolledBackState.components,
              isLoading: false
            });
          }
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Failed to rollback',
            isLoading: false
          });
        }
      },

      // Load saved states
      loadSavedStates: async () => {
        try {
          const states = await storageManager.getAllUIStates();
          set({ savedStates: states });
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Failed to load saved states'
          });
        }
      },

      // Search states
      searchStates: async (query: string) => {
        try {
          return await storageManager.searchUIStates(query);
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Search failed'
          });
          return [];
        }
      },

      // Delete state
      deleteState: async (stateId: string) => {
        set({ isLoading: true, error: null });
        try {
          await storageManager.deleteUIState(stateId);
          get().loadSavedStates();
          set({ isLoading: false });
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Failed to delete state',
            isLoading: false
          });
        }
      },

      // Clear error
      clearError: () => set({ error: null }),

      // Component management
      updateComponent: (componentId: string, updates: Partial<UIComponent>) => {
        set(state => ({
          currentComponents: state.currentComponents.map(c =>
            c.id === componentId ? { ...c, ...updates } : c
          ),
        }));
      },

      removeComponent: (componentId: string) => {
        set(state => ({
          currentComponents: state.currentComponents.filter(c => c.id !== componentId),
        }));
      },

      addComponent: (component: UIComponent, position?: number) => {
        set(state => {
          const newComponents = [...state.currentComponents];
          if (position !== undefined) {
            newComponents.splice(position, 0, component);
          } else {
            newComponents.push(component);
          }
          return { currentComponents: newComponents };
        });
      },

      insertComponentAfter: (targetComponentId: string, newComponent: UIComponent) => {
        set(state => {
          const targetIndex = state.currentComponents.findIndex(c => c.id === targetComponentId);
          const newComponents = [...state.currentComponents];
          
          if (targetIndex !== -1) {
            newComponents.splice(targetIndex + 1, 0, newComponent);
          } else {
            // If the target component is not found, append to the end.
            // This is a safe fallback.
            newComponents.push(newComponent);
          }
          
          return { currentComponents: newComponents };
        });
      },
    }),
    {
      name: 'selfgen-ui-store',
    }
  )
);
