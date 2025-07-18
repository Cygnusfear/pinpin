# Separated Widget Architecture

## Overview

This document describes the new separated widget architecture that solves the performance issue where moving widgets with heavy content (like 3MB images) would re-sync all the widget data. The new architecture separates lightweight widget data (position, rotation, scale) from heavy content data (images, documents, etc.).

## Problem Solved

**Before**: Moving a 3MB image widget would sync the entire 3MB of data
**After**: Moving a 3MB image widget only syncs ~200 bytes of position data

## Architecture Components

### 1. Type System (`src/types/separatedWidgets.ts`)

#### WidgetData (Lightweight, Frequently Updated)
```typescript
interface WidgetData {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  locked: boolean;
  selected: boolean;
  contentId: string; // Reference to content
  metadata: Record<string, any>;
  createdAt: number;
  updatedAt: number;
}
```

#### ContentData (Heavy, Rarely Updated)
```typescript
// Base interface
interface BaseContentData {
  id: string; // Content hash for deduplication
  type: string;
  lastModified: number;
  size?: number;
}

// Type-specific content data
interface ImageContentData extends BaseContentData {
  type: 'image';
  src: string;
  alt?: string;
  originalDimensions: { width: number; height: number };
  filters?: { brightness?: number; contrast?: number; saturation?: number; blur?: number };
}
```

#### ComposedWidget (For Rendering)
```typescript
interface ComposedWidget extends WidgetData {
  content: ContentData;
  isContentLoaded: boolean;
  contentError?: string;
}
```

### 2. Content Store (`src/stores/contentStore.ts`)

**Features:**
- Hash-based deduplication (same image used multiple times = single storage)
- Smart caching with LRU eviction
- Separate sync document (`pinboard-content`)
- Automatic cache cleanup
- Performance monitoring

**Key Methods:**
```typescript
const contentStore = useContentStore();

// Add content (returns hash for deduplication)
const contentId = await contentStore.addContent(contentData);

// Get content by ID
const content = contentStore.getContent(contentId);

// Batch operations
const contentMap = contentStore.getMultipleContent(contentIds);
```

### 3. Separated Pinboard Store (`src/stores/separatedPinboardStore.ts`)

**Features:**
- Only stores lightweight widget data
- Performance-optimized transform updates
- Batch operations for multiple widgets
- Direct position updates for drag operations

**Key Methods:**
```typescript
const widgetStore = useSeparatedPinboardStore();

// Add widget (automatically splits content)
await widgetStore.addWidget({
  type: 'image',
  x: 100, y: 100,
  width: 200, height: 150,
  content: { src: 'image.jpg', ... }
});

// Performance-critical updates (drag operations)
widgetStore.updateWidgetTransform(id, { x: 150, y: 200 });
widgetStore.updateMultipleWidgetTransforms([
  { id: 'widget1', transform: { x: 100, y: 100 } },
  { id: 'widget2', transform: { x: 200, y: 200 } }
]);
```

### 4. Widget Composer (`src/services/widgetComposer.ts`)

**Purpose:** Merges widget data with content data for rendering

**Features:**
- Efficient batch composition
- Caching for performance
- Content loading status tracking
- React hooks for easy integration

**Usage:**
```typescript
// Single widget composition
const composedWidget = useComposedWidget(widgetData);

// Multiple widgets composition
const composedWidgets = useComposedWidgets(widgetDataArray);

// Manual composition
const composer = useWidgetComposer();
const composed = composer.composeWidgets(widgetDataArray);
```

### 5. Optimized Drag Manager (`src/managers/SeparatedDragManager.ts`)

**Features:**
- Only updates widget positions (no content sync during drag)
- Batch position updates for multiple widgets
- Performance monitoring
- Direct store access for maximum speed

**Performance Gains:**
- 99.9% reduction in sync data during drag operations
- Responsive interactions regardless of content size
- Batch updates for smooth multi-widget dragging

### 6. Migration Utility (`src/utils/widgetMigration.ts`)

**Features:**
- Converts legacy widgets to separated architecture
- Validates migration results
- Generates migration reports
- Backup and restore functionality

**Usage:**
```typescript
const migrationService = useMigrationService();

// Migrate legacy widgets
const results = await migrationService.migrateLegacyWidgets(legacyWidgets);

// Validate migration
const validation = migrationService.validateMigration(original, results);

// Generate report
const report = migrationService.generateMigrationReport(original, results);
```

## Performance Benefits

### Drag Operations
- **Before**: 3MB image drag = 3MB sync per update
- **After**: 3MB image drag = 16 bytes sync per update (x, y coordinates)
- **Improvement**: 99.99% reduction in sync data

### Content Deduplication
- Same image used in 10 widgets = 1 content entry instead of 10
- Automatic hash-based deduplication
- Significant storage and bandwidth savings

### Caching
- LRU cache with configurable size limits
- Automatic cleanup and eviction
- Smart preloading for visible widgets

## Usage Examples

### Creating a New Widget
```typescript
import { useSeparatedPinboardStore } from './stores/separatedPinboardStore';

const widgetStore = useSeparatedPinboardStore();

// Add an image widget
await widgetStore.addWidget({
  type: 'image',
  x: 100,
  y: 100,
  width: 200,
  height: 150,
  content: {
    type: 'image',
    src: 'https://example.com/image.jpg',
    alt: 'Example image',
    originalDimensions: { width: 800, height: 600 }
  }
});
```

### Rendering Widgets
```typescript
import { useComposedWidgets } from './services/widgetComposer';
import { useWidgetQueries } from './stores/separatedPinboardStore';

function WidgetRenderer() {
  const { widgets } = useWidgetQueries();
  const composedWidgets = useComposedWidgets(widgets);

  return (
    <div>
      {composedWidgets.map(widget => (
        <div key={widget.id}>
          {widget.isContentLoaded ? (
            <WidgetContent widget={widget} />
          ) : (
            <LoadingSpinner />
          )}
        </div>
      ))}
    </div>
  );
}
```

### Drag Operations
```typescript
import { SeparatedDragManager } from './managers/SeparatedDragManager';
import { useWidgetTransforms } from './stores/separatedPinboardStore';

function useDragManager() {
  const { updateWidgetTransform, updateMultipleWidgetTransforms } = useWidgetTransforms();

  const dragManager = new SeparatedDragManager(
    undefined, // onDragStart
    undefined, // onDragUpdate
    undefined, // onDragEnd
    undefined, // onSnapChange
    updateWidgetTransform,
    updateMultipleWidgetTransforms
  );

  return dragManager;
}
```

### Migration from Legacy System
```typescript
import { useMigrationService } from './utils/widgetMigration';

async function migrateLegacyData() {
  const migrationService = useMigrationService();
  const legacyWidgets = getLegacyWidgets(); // Your existing widgets

  // Perform migration
  const result = await migrationService.performFullMigration(legacyWidgets);

  if (result.success) {
    console.log(`Successfully migrated ${result.migratedCount} widgets`);
  } else {
    console.error('Migration failed:', result.errors);
  }
}
```

## Configuration

### Content Store Cache Settings
```typescript
// In src/stores/contentStore.ts
const CACHE_CONFIG = {
  MAX_SIZE_MB: 100,        // Maximum cache size
  MAX_ITEMS: 1000,         // Maximum cached items
  CLEANUP_INTERVAL_MS: 5 * 60 * 1000, // 5 minutes
  LRU_THRESHOLD: 0.8,      // Start eviction at 80% full
};
```

### Sync Document IDs
- Widget Data: Uses existing `SYNC_CONFIG.DOCUMENT_ID`
- Content Data: Uses `"pinboard-content"`

## Monitoring and Debugging

### Performance Metrics
```typescript
import { compositionPerformanceMonitor } from './services/widgetComposer';
import { dragPerformanceMonitor } from './managers/SeparatedDragManager';

// Get composition metrics
const compositionMetrics = compositionPerformanceMonitor.getMetrics();

// Get drag performance metrics
const dragMetrics = dragPerformanceMonitor.getMetrics();
```

### Cache Statistics
```typescript
import { useContentCache } from './stores/contentStore';

const { getCacheStats } = useContentCache();
const stats = getCacheStats();
console.log('Cache stats:', stats);
```

## Migration Strategy

1. **Backup existing data** using `backupWidgets()`
2. **Run migration** with `performFullMigration()`
3. **Validate results** with `validateMigration()`
4. **Monitor performance** with built-in metrics
5. **Rollback if needed** using backup data

## Future Enhancements

1. **Lazy Loading**: Load content only when widgets become visible
2. **Content Compression**: Compress large content before storage
3. **CDN Integration**: Store large assets in CDN with references
4. **Background Sync**: Sync content in background while keeping UI responsive
5. **Content Versioning**: Track content changes for better caching

## Conclusion

The separated widget architecture provides:
- **99.9% reduction** in sync data for drag operations
- **Automatic deduplication** of content
- **Smart caching** with LRU eviction
- **Performance monitoring** and debugging tools
- **Seamless migration** from legacy system

This architecture ensures that widget interactions remain responsive regardless of content size, while maintaining all existing functionality and adding powerful new features for content management.