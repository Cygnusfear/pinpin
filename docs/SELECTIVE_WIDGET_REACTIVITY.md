# Selective Widget Reactivity Architecture

## Overview

This document outlines the solution for implementing Zustand-style selective reactivity in widget plugins to solve the "prop waterfall" problem where any widget data change causes complete re-renders and destroys internal plugin state.

## The Problem

### Current Architecture Issues

The current widget system suffers from a "prop waterfall" problem:

```typescript
// Current problematic pattern
export const YouTubeRenderer: React.FC<WidgetRendererProps<YouTubeContent>> = ({
  widget,    // ← Full widget object passed as prop
  state,     // ← Full state object passed as prop  
  events,    // ← Full events object passed as prop
}) => {
  // ANY change to widget/state/events triggers complete re-render
  // This destroys internal component state like YouTube player progress
```

**Root Cause**: When widget data syncs across devices, the entire widget object gets updated, causing [`WidgetContainer`](src/components/WidgetContainer.tsx:17) to pass new props to plugin renderers, which triggers complete React re-renders.

**Impact**: 
- YouTube players lose playback position
- Form inputs get reset
- Component internal state is destroyed
- Poor user experience during collaboration

### Analogy to Zustand

This is equivalent to doing `const everything = useStore()` in Zustand instead of selective subscriptions like `const count = useStore(state => state.count)`.

## The Solution

### Zustand-Style Selective Subscriptions

Enable plugins to subscribe only to specific data they care about, similar to Zustand selectors.

**Key Insight**: Fix reactivity on the **reading side** with selective subscriptions, keep existing [`updateContent`](src/stores/widgetStore.ts:408) unchanged.

## Implementation Plan

### 1. New Plugin Interface

**Before:**
```typescript
export const YouTubeRenderer: React.FC<WidgetRendererProps<YouTubeContent>> = ({
  widget, state, events
}) => {
  // Props cause re-renders on any change
```

**After:**
```typescript
export const YouTubeRenderer: React.FC<{ widgetId: string }> = ({ widgetId }) => {
  // Selective subscriptions - only re-render on specific changes
  const { currentTime, isPlaying } = useWidgetContent(widgetId, (content) => ({
    currentTime: content.data.lastInteraction?.currentTime,
    isPlaying: content.data.lastInteraction?.isPlaying
  }));
  
  const videoId = useWidgetContent(widgetId, (content) => content.data.videoId);
  
  // Keep existing update pattern
  const { updateContent } = useContentActions();
```

### 2. Core Hooks Implementation

#### `useWidgetContent` - Selective Content Subscriptions

```typescript
/**
 * Subscribe to specific parts of widget content data
 * Only re-renders when selected data changes
 */
function useWidgetContent<T>(
  widgetId: string, 
  selector: (content: WidgetContent) => T
): T {
  return useContentStore((state) => {
    const widget = getWidgetById(widgetId);
    if (!widget?.contentId) return undefined;
    const content = state.content[widget.contentId];
    return content ? selector(content) : undefined;
  });
}
```

#### `useWidgetState` - Selective State Subscriptions

```typescript
/**
 * Subscribe to specific widget state (selection, hover, etc.)
 */
function useWidgetState<T>(
  widgetId: string, 
  selector: (state: WidgetRenderState) => T
): T {
  return useWidgetStore((state) => {
    const widget = state.widgets.find(w => w.id === widgetId);
    const renderState = computeRenderState(widget);
    return selector(renderState);
  });
}
```

#### `useWidgetActions` - Get Action Handlers

```typescript
/**
 * Get widget-specific action handlers
 */
function useWidgetActions(widgetId: string) {
  const { updateContent } = useContentActions();
  const { updateWidget, removeWidget } = useWidgetActions();
  
  return {
    updateContent: (updates) => {
      const widget = getWidgetById(widgetId);
      if (widget?.contentId) {
        updateContent(widget.contentId, updates);
      }
    },
    updateWidget: (updates) => updateWidget(widgetId, updates),
    removeWidget: () => removeWidget(widgetId),
    // ... other actions
  };
}
```

### 3. WidgetContainer Changes

**Before:**
```typescript
// WidgetContainer passes full objects as props
<RendererComponent
  widget={widget}
  state={state}
  events={events}
  canvasTransform={state.transform}
/>
```

**After:**
```typescript
// WidgetContainer only passes widgetId
<RendererComponent widgetId={widget.id} />
```

### 4. Migration Path

#### Phase 1: Add New Hooks
- Implement `useWidgetContent`, `useWidgetState`, `useWidgetActions`
- Add to existing stores alongside current implementation
- No breaking changes

#### Phase 2: Update WidgetContainer
- Modify [`WidgetContainer`](src/components/WidgetContainer.tsx:17) to support both old and new interfaces
- Use type detection to determine which props to pass

```typescript
// Backward compatibility check
if (renderer.component.length === 1) {
  // New interface - only pass widgetId
  return <RendererComponent widgetId={widget.id} />;
} else {
  // Legacy interface - pass full props
  return <RendererComponent widget={widget} state={state} events={events} />;
}
```

#### Phase 3: Migrate Plugins
- Update plugin renderers one by one
- Start with most problematic ones (YouTube, complex forms)
- Test thoroughly before migrating each plugin

#### Phase 4: Remove Legacy Support
- Once all plugins migrated, remove old interface
- Clean up unused code

## Example: YouTube Plugin Migration

### Before (Problematic)

```typescript
export const YouTubeRenderer: React.FC<WidgetRendererProps<YouTubeContent>> = ({
  widget,
  state,
  events,
}) => {
  const { updateContent } = useContentActions();
  
  // PROBLEM: Any widget prop change destroys player state
  const data = widget.content.data;
  
  return (
    <IsolatedYouTubePlayer
      videoId={data.videoId}
      data={data}
      onPlayerEvent={(updates) => {
        updateContent(widget.contentId, { data: { ...data, ...updates } });
      }}
    />
  );
};
```

### After (Selective Reactivity)

```typescript
export const YouTubeRenderer: React.FC<{ widgetId: string }> = ({ widgetId }) => {
  // SOLUTION: Only subscribe to data we care about
  const playbackData = useWidgetContent(widgetId, (content) => ({
    currentTime: content.data.lastInteraction?.currentTime,
    isPlaying: content.data.lastInteraction?.isPlaying,
  }));
  
  const videoId = useWidgetContent(widgetId, (content) => content.data.videoId);
  const title = useWidgetContent(widgetId, (content) => content.data.title);
  
  // Keep existing update pattern
  const { updateContent } = useWidgetActions(widgetId);
  
  // Player only re-renders when playbackData or videoId changes
  // Title changes don't affect the player component!
  return (
    <div>
      <IsolatedYouTubePlayer
        videoId={videoId}
        playbackData={playbackData}
        onPlayerEvent={(updates) => {
          updateContent({ data: updates });
        }}
      />
      
      {/* Title display can update independently */}
      {title && <div className="title">{title}</div>}
    </div>
  );
};
```

## Benefits

### Performance
- **Eliminates unnecessary re-renders**: Components only update when subscribed data changes
- **Preserves internal state**: YouTube players maintain playback position during sync events
- **Reduces React reconciliation overhead**: Fewer DOM updates

### Developer Experience
- **Familiar API**: Same pattern as Zustand selectors
- **Granular control**: Plugin authors decide exactly what triggers re-renders
- **Simple migration**: Existing `updateContent` stays unchanged
- **Better debugging**: Clear separation between reactive and non-reactive data

### Collaboration
- **Maintains sync functionality**: Cross-device collaboration still works perfectly
- **Better user experience**: No interruptions during collaborative sessions
- **Selective sync**: Can choose which updates should trigger UI changes

## Implementation Details

### Store Integration

The new hooks integrate with existing stores:

```typescript
// Builds on existing useContentStore
const content = useContentStore((state) => {
  const widget = getWidgetById(widgetId);
  return state.content[widget.contentId];
});

// Builds on existing useWidgetStore  
const isSelected = useWidgetStore((state) => {
  const widget = state.widgets.find(w => w.id === widgetId);
  return widget?.selected || false;
});
```

### Type Safety

```typescript
// Generic selector for type safety
function useWidgetContent<T>(
  widgetId: string,
  selector: (content: WidgetContent) => T
): T | undefined {
  // Implementation ensures type safety
}

// Usage with TypeScript inference
const isPlaying = useWidgetContent(widgetId, (content) => 
  content.data.lastInteraction?.isPlaying // ← TypeScript knows this is boolean
);
```

### Error Handling

```typescript
function useWidgetContent<T>(widgetId: string, selector: (content: WidgetContent) => T): T | undefined {
  return useContentStore((state) => {
    try {
      const widget = getWidgetById(widgetId);
      if (!widget?.contentId) return undefined;
      
      const content = state.content[widget.contentId];
      if (!content) return undefined;
      
      return selector(content);
    } catch (error) {
      console.warn(`Widget content selector error for ${widgetId}:`, error);
      return undefined;
    }
  });
}
```

## Testing Strategy

### Unit Tests
- Test hooks in isolation
- Verify selective re-rendering behavior
- Test error cases and edge conditions

### Integration Tests
- Test full widget lifecycle with new hooks
- Verify sync behavior across multiple devices
- Test migration compatibility

### Performance Tests
- Measure re-render frequency before/after
- Test with complex widget hierarchies
- Benchmark sync performance

## Future Enhancements

### Computed Selectors
```typescript
// Derived state computed from multiple sources
const playerStatus = useWidgetContent(widgetId, (content) => {
  const interaction = content.data.lastInteraction;
  return {
    isActive: interaction?.isPlaying || false,
    position: interaction?.currentTime || 0,
    lastUpdated: interaction?.timestamp || 0,
    isRecent: Date.now() - (interaction?.timestamp || 0) < 30000
  };
});
```

### Batch Subscriptions
```typescript
// Subscribe to multiple widgets efficiently
const allVideoStates = useMultipleWidgetContent(
  videoWidgetIds,
  (content) => content.data.lastInteraction?.isPlaying
);
```

### Async Selectors
```typescript
// Support for async data loading
const thumbnailUrl = useAsyncWidgetContent(
  widgetId, 
  async (content) => await fetchVideoThumbnail(content.data.videoId)
);
```

## Conclusion

This selective reactivity architecture solves the fundamental "prop waterfall" problem while maintaining the existing sync infrastructure. It provides:

1. **Granular control** over component re-renders
2. **Familiar developer experience** similar to Zustand
3. **Backward compatibility** during migration
4. **Better performance** and user experience
5. **Preserved sync functionality** for collaboration

The solution enables complex interactive widgets (like YouTube players) to maintain their internal state while still participating in real-time collaborative features.