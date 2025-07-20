import type React from 'react';

// A placeholder represents a deferred generation trigger in the UI
export interface UIPlaceholder {
  type: 'placeholder';
  id: string;
  props: {
    generationPrompt: string;
    triggerComponent: UIComponent;
    triggerType?: 'onClick' | 'onSubmit' | 'onChange';
  };
}

// Children can be nested components, simple text, or placeholders
export type UIChild = UIComponent | string | UIPlaceholder;

export interface UIComponent {
  id: string;
  type: string;
  props: Record<string, unknown>;
  children?: UIChild[];
  metadata?: {
    generated_at: string;
    prompt?: string;
    version?: number;
  };
}

export interface UIComponentProps {
  id: string;
  metadata?: UIComponent['metadata'];
  onUpdate?: (updates: Partial<UIComponent>) => void;
  onInteraction?: (action: string, data?: unknown) => void;
  children?: React.ReactNode;
  [key: string]: unknown;
}

export interface UIState {
  id: string;
  name: string;
  description?: string;
  components: UIComponent[];
  connections?: string[]; // IDs of connected UI states
  created_at: string;
  updated_at: string;
  version: number;
  parent_version?: string; // For version tracking
}

export interface UISession {
  id: string;
  current_state_id?: string;
  history: string[]; // Array of state IDs
  created_at: string;
}

export interface AIGenerationRequest {
  prompt: string;
  context?: {
    current_ui?: UIState;
    user_intent?: string;
    previous_interactions?: string[];
  };
}

export interface AIGenerationResponse {
  components: UIComponent[];
  reasoning?: string;
  suggestions?: string[];
}

// DISABLED: UISnapshot system is turned off
// export interface UISnapshot {
//   id: string;
//   components: UIComponent[];
//   metadata: {
//     created_at: string;
//     updated_at?: string;
//     prompt: string;
//     version: number;
//     title: string;
//     tags: string[];
//     parent_id?: string;
//   };
//   connections: string[]; // IDs of connected snapshots
// }

export type ComponentType = 
  | 'search-bar'
  | 'button'
  | 'input'
  | 'card'
  | 'list'
  | 'modal'
  | 'form'
  | 'navigation';
