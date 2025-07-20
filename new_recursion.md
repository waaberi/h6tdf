# Recursive UI Generation System

## Overview
The system needs to enable any element (React components or native HTML5 elements) to trigger the generation of further components dynamically. This creates a recursive, self-expanding UI that can grow based on user interactions.

## Key Requirements

### 1. Universal Trigger Capability
- **Any element** should be able to trigger generation
- **Any interaction** (click, input, hover, etc.) should be configurable as a trigger
- **Multiple triggers** per element should be supported

### 2. Contextual Generation
- New components should be generated **in context** of the triggering element
- Generation prompts should include:
  - Current app state
  - Triggering element properties
  - User input (if applicable)
  - Surrounding component context

### 3. Placement Strategy
- Generated components need clear placement rules:
  - Replace the triggering element
  - Insert after/before the triggering element
  - Insert into a designated container
  - Create a modal/overlay
  - Append to a specific parent

## Technical Architecture

### 1. Trigger Registration System

```typescript
interface GenerationTrigger {
  elementId: string;
  triggerType: 'onClick' | 'onChange' | 'onSubmit' | 'onFocus' | 'onHover' | 'custom';
  generationPrompt: string;
  placementStrategy: 'replace' | 'after' | 'before' | 'modal' | 'container';
  placementTarget?: string; // ID of target container if needed
  context?: Record<string, unknown>; // Additional context for generation
}
```

### 2. Enhanced Function Resolver

#### Current State
- ✅ Resolves string function names to actual functions
- ✅ Handles basic event handlers safely
- ✅ Provides fallback functions

#### Needed Enhancements
- 🔄 **Generation-aware functions**: Functions that can trigger UI generation
- 🔄 **Context capture**: Functions that collect current state for generation prompts
- 🔄 **Placement coordination**: Functions that know where to place generated content

### 3. Generation Trigger Functions

```typescript
// New function types to add to functionRegistry
const generationFunctions = {
  // Immediate generation on click
  'generateOnClick': (prompt: string, placement: PlacementStrategy) => (event: Event) => {
    const context = captureElementContext(event.target);
    triggerGeneration(prompt, context, placement);
  },
  
  // Generate based on input value
  'generateFromInput': (promptTemplate: string, placement: PlacementStrategy) => (event: Event) => {
    const input = event.target as HTMLInputElement;
    const prompt = promptTemplate.replace('{{value}}', input.value);
    const context = captureElementContext(input);
    triggerGeneration(prompt, context, placement);
  },
  
  // Generate with user confirmation
  'confirmAndGenerate': (prompt: string, placement: PlacementStrategy) => (event: Event) => {
    const shouldGenerate = confirm(`Generate: ${prompt}?`);
    if (shouldGenerate) {
      const context = captureElementContext(event.target);
      triggerGeneration(prompt, context, placement);
    }
  }
};
```

### 4. Context Capture System

```typescript
interface GenerationContext {
  triggerId: string;
  triggerElement: {
    type: string;
    props: Record<string, unknown>;
    textContent?: string;
  };
  siblingElements: UIComponent[];
  parentContainer: UIComponent;
  userInput?: string;
  appState: {
    currentComponents: UIComponent[];
    metadata: Record<string, unknown>;
  };
}

function captureElementContext(element: Element): GenerationContext {
  // Capture comprehensive context for AI generation
  // Include element details, DOM structure, component hierarchy
}
```

### 5. Placement Engine

```typescript
interface PlacementStrategy {
  type: 'replace' | 'after' | 'before' | 'modal' | 'container' | 'portal';
  targetId?: string;
  animation?: 'fade' | 'slide' | 'grow';
  position?: 'top' | 'bottom' | 'left' | 'right';
}

class PlacementEngine {
  placeComponent(
    newComponent: UIComponent, 
    strategy: PlacementStrategy, 
    triggerId: string
  ): void {
    // Handle different placement strategies
    // Update component tree
    // Trigger re-render
    // Handle animations
  }
}
```

## Context Management Strategy (UPDATED)

### Simplified Context Levels
To prevent the system from "going off the rails," we now use **tiered context management**:

1. **Minimal Context** - For error fixes and simple operations
   - Only essential info: element type, error message, trigger ID
   - Prevents overwhelming AI with unnecessary context
   - Example: Auto-fixing broken components

2. **Standard Context** - For common user interactions  
   - Element details, user input, basic props
   - Balanced information for typical generation needs
   - Example: Button clicks, form submissions

3. **Rich Context** - For complex user-initiated generation
   - Includes sibling components, app state, user input
   - More context for better integration with existing UI
   - Example: Context-aware component generation

4. **Full Context** - For advanced recursive scenarios
   - Complete component hierarchy, environment info, metadata
   - Only used when sophisticated integration is needed
   - Example: Complex multi-component generation

### Smart Context Selection
The system automatically selects appropriate context level based on:
- **Generation type** (error-fix vs user-interaction vs recursive)
- **Trigger source** (error handler vs user click vs AI suggestion)  
- **Complexity needs** (simple fix vs complex integration)

This prevents:
- ❌ Over-contextualization leading to confused AI responses
- ❌ Token limit exceeding with unnecessary information
- ❌ Performance issues from excessive context capture
- ❌ System going "off the rails" with too much information

### Implementation Status - CLEANUP COMPLETE ✅
- ✅ **Context Management System** (`contextManager.ts`) - Created with 4 context levels
- ✅ **Generation Trigger Functions** (`generationTriggers.ts`) - Ready for integration
- ✅ **Function Resolver Cleanup** - Removed redundant prop type fixers (now handled centrally)
- ✅ **Error Patch Service Cleanup** - Simplified to use minimal context, removed duplicate function handling
- ✅ **Test Code Removal** - Removed temporary test components and demo files
- ✅ **App Simplification** - Cleaned up test imports and components
- 🔄 **Integration with App** (next step when recursion is implemented)
- 🔄 **Placement Engine** (future step)

### Files Cleaned Up:
1. **`errorPatchService.ts`** - Removed `commonPropTypeFixers` (redundant with function resolver)
2. **`App.tsx`** - Removed test components and imports
3. **`functionResolver.ts`** - Removed premature generation function registration
4. **Removed files** - `functionResolverTest.ts` (was temporary demo)

The system is now cleaner and the function resolver handles ALL function property resolution consistently.

## Implementation Strategy

### Phase 1: Enhanced Function Resolver ✅ (Completed)
- ✅ String to function resolution
- ✅ Safe event handling
- ✅ Function registry system

### Phase 2: Generation Triggers (Current Focus)
1. **Add generation-aware functions** to the function resolver
2. **Implement context capture** system
3. **Create placement engine** for new components
4. **Update DynamicRenderer** to handle trigger registration

### Phase 3: AI Integration
1. **Enhanced prompts** with full context
2. **Placement-aware generation** 
3. **Conflict resolution** for overlapping generations
4. **State synchronization** between generated components

### Phase 4: Advanced Features
1. **Conditional triggers** (only generate if certain conditions met)
2. **Batch generation** (multiple components from one trigger)
3. **Template-based generation** (reusable patterns)
4. **User preference learning** (adapt generation based on usage)

## Example Usage Scenarios

### Scenario 1: Search Results Expansion
```typescript
// Search input generates result cards on typing
{
  id: 'search-input',
  type: 'input',
  props: {
    placeholder: 'Search for products...',
    onChange: 'generateFromInput("Show product cards for: {{value}}", { type: "after", animation: "fade" })'
  }
}
```

### Scenario 2: Progressive Form Building
```typescript
// Button that adds more form fields
{
  id: 'add-field-btn',
  type: 'button',
  props: {
    onClick: 'generateOnClick("Add a new form field for user preferences", { type: "before", targetId: "submit-btn" })'
  },
  children: ['Add More Fields']
}
```

### Scenario 3: Context-Aware Actions
```typescript
// Card that generates related actions
{
  id: 'product-card',
  type: 'card',
  props: {
    onClick: 'contextualGenerate("Create action buttons related to this {{title}} product", { type: "modal" })',
    title: 'iPhone 15'
  }
}
```

## Data Flow

```
User Interaction 
    ↓
Trigger Function (from Function Resolver)
    ↓
Context Capture (element + surrounding context)
    ↓
Generation Prompt Assembly (context + template)
    ↓
AI Service (generate new components)
    ↓
Placement Engine (determine where to put new components)
    ↓
Component Tree Update (modify app state)
    ↓
DynamicRenderer Re-render (show new components)
    ↓
New Components (with their own potential triggers)
```

## Technical Challenges & Solutions

### Challenge 1: State Management
**Problem**: New components need to integrate with existing state
**Solution**: 
- Centralized state store (Zustand)
- Context-aware generation that includes current state
- State merge strategies for new components

### Challenge 2: Performance
**Problem**: Recursive generation could cause performance issues
**Solution**:
- Debounced generation triggers
- Generation queuing system
- Lazy rendering of complex components

### Challenge 3: User Experience
**Problem**: Unexpected UI changes could confuse users
**Solution**:
- Visual indicators for generation triggers
- Smooth animations for new components
- Undo/redo system for generated content

### Challenge 4: AI Context Window
**Problem**: Too much context could exceed AI token limits
**Solution**:
- Smart context summarization
- Hierarchical context (immediate → local → global)
- Context compression techniques

## Next Steps

1. **Implement Generation Trigger Functions** in the function resolver
2. **Create Context Capture System** to gather relevant information
3. **Build Placement Engine** to handle component positioning
4. **Update AI Service** to accept contextual prompts
5. **Integrate with DynamicRenderer** for seamless updates

This system will enable true recursive UI generation where any interaction can spawn new components, creating a dynamic, self-expanding interface that grows based on user needs and AI capabilities.
