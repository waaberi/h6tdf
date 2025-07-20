# Recursive UI Generation Plan for SelfGenUI

This plan outlines how to enable true recursive generation: any AI-generated component can itself trigger further AI calls when interacted with. We build on existing services in `src/services/` (LangChain via `aiService.ts`, UI orchestration, error-patching) to add recursion without disrupting the React render cycle.

## 1. Objectives
- Allow every AI-generated component (and native UI) to register fallback handlers for events (`onClick`, `onChange`, `onSubmit`).
- On an unhandled interaction, capture context and dispatch a prompt to the LLM via `aiService.generateRecursiveUI`.
- Insert the returned UIComponent[] adjacent to (or replacing) the trigger, mark it for caching, and allow undo.
- Preserve modularity: reuse `aiService`, `errorPatchService`, `uiOrchestrator`, and extend `functionResolver` and `DynamicRenderer`.

## 2. Key Modules & Responsibilities

1. **DynamicRenderer** (`src/components/DynamicRenderer.tsx`)
   - Wraps all `UIComponent` nodes, attaching `resolveEventHandler(id, eventType)` to the corresponding prop.
   - Ensures placeholders and generated fragments seamlessly integrate.

2. **FunctionResolver** (`src/lib/functionResolver.ts`)
   - `resolveEventHandler(componentId: string, eventType: string)` returns:
     - The explicit handler if defined in component props.
     - Otherwise, a generated fallback handler that calls AI.

3. **ContextManager** (`src/lib/contextManager.ts`)
   - `captureContext(event, componentId)` returns JSON-safe `{ componentId, tag, props, appState }`.

4. **AI Service** (`src/services/aiService.ts`)
   - Implement `generateRecursiveUI(prompt: string, context: object, placeholderId: string, placement: 'after'|'replace'|…): Promise<UIComponent[]>`.
   - Wrap existing LangChain calls, JSON extraction (`extractJson`), validation, and `errorPatchService` retry.
   - Add `buildFallbackPrompt(componentId, eventType, context)` to compose descriptive AI prompts.

5. **UI Orchestrator** (`src/services/uiOrchestrator.ts`)
   - `insertRecursive(targetId: string, components: UIComponent[], placement: string)` updates Zustand store via `patchPlaceholder` or `appendChildren`, then caches results.

6. **Cache Service** (`src/services/cacheService.ts`)
   - `saveRecursive(targetId, components)` persists generated fragments for session-level undo/redo and performance.

## 3. Implementation Steps

**Step 3.1: Extend FunctionResolver**
```ts
// src/lib/functionResolver.ts
export function resolveEventHandler(
  componentId: string,
  eventType: string
): (e: Event) => any {
  const explicit = explicitHandlers[componentId]?.[eventType];
  if (explicit) return explicit;
  // Fallback: generate recursively
  return createRecursiveHandler(componentId, eventType);
}

function createRecursiveHandler(
  id: string,
  type: string
): (e: Event) => void {
  return async (e: Event) => {
    const ctx = captureContext(e, id);
    const prompt = buildFallbackPrompt(id, type, ctx);
    const ui = await aiService.generateRecursiveUI(prompt, ctx, id, 'after');
    uiOrchestrator.insertRecursive(id, ui, 'after');
  };
}
```

**Step 3.2: Update DynamicRenderer**
```tsx
// src/components/DynamicRenderer.tsx
...existing imports...
import { resolveEventHandler } from 'src/lib/functionResolver';

function renderNode(node: UIComponent) {
  // ...existing type-based rendering...
  return (
    <ComponentWrapper id={node.id} {...node.props}>
      {node.children?.map(child =>
        React.cloneElement(getReactNode(child), {
          onClick: resolveEventHandler(node.id, 'onClick'),
          onChange: resolveEventHandler(node.id, 'onChange'),
          onSubmit: resolveEventHandler(node.id, 'onSubmit'),
        })
      )}
    </ComponentWrapper>
  );
}
```

**Step 3.3: Implement Context Capture & Prompt Builder**
```ts
// src/lib/contextManager.ts
export function captureContext(e: Event, id: string): ContextData {
  const el = e.target as HTMLElement;
  const props = extractProps(el);
  const store = appStore.getState();
  return { componentId: id, tag: el.tagName, props, appState: store };
}

// src/services/aiService.ts
export function buildFallbackPrompt(
  componentId: string,
  eventType: string,
  context: ContextData
): string {
  return `User triggered ${eventType} on ${componentId}. Props: ${JSON.stringify(
    context.props
  )}. State snapshot: ${JSON.stringify(context.appState)}. ` +
    `Generate UI to handle this interaction.`;
}
```

**Step 3.4: Enhance aiService.generateRecursiveUI**
```ts
// src/services/aiService.ts
export async function generateRecursiveUI(
  prompt: string,
  context: object,
  placeholderId: string,
  placement: PlacementType
): Promise<UIComponent[]> {
  try {
    const resp = await langChainClient.call({ prompt, context });
    return validateComponents(extractJson(resp));
  } catch (err) {
    const patched = await errorPatchService(err, prompt, context);
    return validateComponents(patched);
  }
}
```

**Step 3.5: Insert & Cache Recursive UI**
```ts
// src/services/uiOrchestrator.ts
export function insertRecursive(
  targetId: string,
  components: UIComponent[],
  placement: PlacementType
): void {
  appStore.update(tree =>
    modifyTree(tree, targetId, components, placement)
  );
  cacheService.saveRecursive(targetId, components);
}
```

## 4. Error Handling & Performance
- Debounce rapid `onChange` or repeated clicks (200ms–300ms).
- Summarize context when `JSON.stringify(context.appState)` is too large.
- On consecutive AI failures, show a retry UI via `ErrorBoundary`.

## 5. Testing & Validation
- Unit tests: `resolveEventHandler` returns explicit vs fallback handlers correctly.
- Context tests: `captureContext` serializes expected data.
- Integration: simulate click on generated component without explicit handler, assert `generateRecursiveUI` was called and UI inserted.

This plan provides a clear, modular path to add recursive generation to every AI-generated component. Let me know if you need more details on any step!
