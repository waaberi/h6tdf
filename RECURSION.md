# Recursive Generation: The "Shapeshifter" App

## 1. Understanding the Core Concept

The goal is to evolve the application from a "prompt-and-generate" model to an "explore-and-discover" model. The current system relies on a user explicitly asking for a UI via a search bar. The proposed "recursive generation" feature will allow the UI to generate parts of itself dynamically as the user interacts with it.

The "fridge" analogy is key:
- A user sees a fridge (an initial component).
- The user opens the fridge (an interaction).
- The system *infers* that the user expects to see food.
- The system generates the food components on-the-fly and inserts them into the fridge.

This creates a seamless, immersive experience where the world builds itself around the user's curiosity. It eliminates the need for the user to constantly return to a search bar, making the interaction feel more natural and less like a series of commands.

## 2. Architectural Plan

To achieve this without infinite loops or chaotic generation, we need a structured approach. The plan involves changes to our data structures, rendering logic, and AI prompting strategy.

### 2.1. The `Placeholder` Component

A `placeholder` is not a visible component itself but a **trigger for future generation**. It's a promise that more UI *can* be generated at this location.

Its structure in `src/types/index.ts` would look like this:

```typescript
// In UIComponent type definition
// children?: (UIComponent | string | UIPlaceholder)[]

export interface UIPlaceholder {
  type: 'placeholder';
  id: string; // Unique ID for this placeholder
  props: {
    // The prompt template for the next AI call; may include user input variables
    generationPrompt: string;
    
    // The UI to display for triggering generation. Can be a button, input box, form, etc.
    triggerComponent: UIComponent;
    
    // Type of event on which to fire generation: 'onClick' | 'onSubmit' | 'onChange'
    triggerType?: 'onClick' | 'onSubmit' | 'onChange';
  };
}
```

-  **triggerComponent** is any UIComponent (button, text input, message box, form) that collects or signals user intent.
-  **triggerType** lets us handle input submission (e.g., form submit) or simple clicks.

**Example:** A placeholder that prompts for a username before generating posts:

```json
{
  "id": "placeholder-for-user-posts",
  "type": "placeholder",
  "props": {
    "generationPrompt": "A list of blog posts by {{username}}",
    "triggerType": "onSubmit",
    "triggerComponent": {
      "id": "username-form",
      "type": "form",
      "props": { "className": "space-y-2" },
      "children": [
        {
          "id": "username-input",
          "type": "input",
          "props": { "placeholder": "Enter username" }
        },
        {
          "id": "submit-button",
          "type": "button",
          "props": { "text": "Load Posts" }
        }
      ]
    }
  }
}
```

### 2.2. The Generation & Rendering Flow

1.  **Initial Generation**: The AI generates a UI that includes `placeholder` components for deferred details.
2.  **Rendering**: The `DynamicRenderer` encounters a `placeholder`. It renders the `triggerComponent` defined in the placeholder's props instead of any placeholder marker.
3.  **Interaction**: Depending on `triggerType`:
    - **onClick**: User clicks a button.
    - **onSubmit**: User fills and submits a form or input box.
    - **onChange**: User changes a value (e.g., typing in a message box) and optionally confirms.
4.  **Triggering Generation**: An event handler attached by the renderer captures the user input (if any), interpolates it into `generationPrompt` (e.g., replacing `{{username}}`), and notes the placeholder `id`.
5.  **AI Call**: The `uiOrchestrator` uses the finalized prompt to request new components from DeepSeek.
6.  **State Update**: On AI response, the orchestrator replaces the original placeholder node in the global UI state with the returned `UIComponent[]`, using the placeholder `id` to locate it.
7.  **Re-render**: React re-renders the updated component tree, seamlessly showing the newly generated UI in place of the trigger.

### 2.3. Prompt Engineering Strategy

- **Defer Details**: Instruct AI to use placeholders for any deferred content, whether list items, detailed views, or input-driven data.
- **Parameterize Prompts**: Encourage use of templated prompts (e.g., `{{userInput}}`) so that user-provided text can be injected into the generation call.
- **Design Adaptive Triggers**: Ask AI to select the appropriate `triggerComponent` (button, message box, form) based on the kind of content to be generated.

```markdown
Now, placeholders can handle both simple click triggers and rich text input flows, enabling the shapeshifter app to react to a wide range of user interactions efficiently.
```
