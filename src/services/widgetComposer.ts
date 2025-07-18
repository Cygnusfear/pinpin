import { useMemo } from 'react';
import { WidgetData, ContentData, ComposedWidget } from '../types/separatedWidgets';
import { useContentStore } from '../stores/contentStore';

// ============================================================================
// WIDGET COMPOSER SERVICE
// ============================================================================

/**
 * Widget Composer Service
 * Responsible for merging widget data with content data to create complete widgets
 */
export class WidgetComposer {
  private contentStore: any;
  protected cache = new Map<string, ComposedWidget>();
  private cacheTimeout = 5000; // 5 seconds cache timeout

  constructor(contentStore: any) {
    this.contentStore = contentStore;
  }

  /**
   * Compose a single widget by merging widget data with content data
   */
  composeWidget(widgetData: WidgetData): ComposedWidget {
    const cacheKey = `${widgetData.id}-${widgetData.updatedAt}-${widgetData.contentId}`;
    
    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Get content data
    const contentData = this.contentStore.getContent(widgetData.contentId);
    
    // Enhanced debug logging for cross-device sync issues
    console.log(`🔍 [CROSS-DEVICE DEBUG] Composing widget ${widgetData.id} with contentId: ${widgetData.contentId}`);
    console.log(`📦 [CROSS-DEVICE DEBUG] Content found:`, !!contentData, contentData ? 'YES' : 'NO');
    console.log(`🏪 [CROSS-DEVICE DEBUG] Content store state:`, {
      totalContentItems: Object.keys(this.contentStore.content || {}).length,
      availableContentIds: Object.keys(this.contentStore.content || {}),
      requestedContentId: widgetData.contentId,
      contentStoreLastModified: this.contentStore.lastModified,
    });
    
    if (!contentData) {
      console.error(`❌ [CROSS-DEVICE DEBUG] Content not found! This suggests a sync issue between devices.`);
      console.error(`🔍 [CROSS-DEVICE DEBUG] Widget was created on another device but content didn't sync.`);
    }
    
    const composedWidget: ComposedWidget = {
      ...widgetData,
      content: contentData,
      isContentLoaded: !!contentData,
      contentError: contentData ? undefined : `Content not found: ${widgetData.contentId}`,
    };

    // Cache the result
    this.cache.set(cacheKey, composedWidget);
    
    // Set cache expiration
    setTimeout(() => {
      this.cache.delete(cacheKey);
    }, this.cacheTimeout);

    return composedWidget;
  }

  /**
   * Compose multiple widgets efficiently
   */
  composeWidgets(widgetDataArray: WidgetData[]): ComposedWidget[] {
    // Get all unique content IDs
    const contentIds = [...new Set(widgetDataArray.map(w => w.contentId))];
    
    // Batch fetch content data
    const contentMap = this.contentStore.getMultipleContent(contentIds);
    
    // Compose widgets
    return widgetDataArray.map(widgetData => {
      const cacheKey = `${widgetData.id}-${widgetData.updatedAt}-${widgetData.contentId}`;
      
      // Check cache first
      const cached = this.cache.get(cacheKey);
      if (cached) {
        return cached;
      }

      const contentData = contentMap[widgetData.contentId];
      
      const composedWidget: ComposedWidget = {
        ...widgetData,
        content: contentData,
        isContentLoaded: !!contentData,
        contentError: contentData ? undefined : `Content not found: ${widgetData.contentId}`,
      };

      // Cache the result
      this.cache.set(cacheKey, composedWidget);
      
      // Set cache expiration
      setTimeout(() => {
        this.cache.delete(cacheKey);
      }, this.cacheTimeout);

      return composedWidget;
    });
  }

  /**
   * Preload content for widgets to improve performance
   */
  async preloadContent(widgetDataArray: WidgetData[]): Promise<void> {
    const contentIds = [...new Set(widgetDataArray.map(w => w.contentId))];
    await this.contentStore.preloadContent(contentIds);
  }

  /**
   * Clear the composer cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

// ============================================================================
// REACT HOOKS FOR WIDGET COMPOSITION
// ============================================================================

/**
 * Hook to compose a single widget
 */
export function useComposedWidget(widgetData: WidgetData | null): ComposedWidget | null {
  const contentStore = useContentStore();
  
  return useMemo(() => {
    if (!widgetData) return null;
    
    const composer = new WidgetComposer(contentStore);
    return composer.composeWidget(widgetData);
  }, [widgetData, contentStore]);
}

/**
 * Hook to compose multiple widgets efficiently
 */
export function useComposedWidgets(widgetDataArray: WidgetData[]): ComposedWidget[] {
  const contentStore = useContentStore();
  
  return useMemo(() => {
    if (!widgetDataArray.length) return [];
    
    const composer = new WidgetComposer(contentStore);
    return composer.composeWidgets(widgetDataArray);
  }, [widgetDataArray, contentStore]);
}

/**
 * Hook to get a widget composer instance
 */
export function useWidgetComposer(): WidgetComposer {
  const contentStore = useContentStore();
  
  return useMemo(() => {
    return new WidgetComposer(contentStore);
  }, [contentStore]);
}

// ============================================================================
// WIDGET COMPOSITION UTILITIES
// ============================================================================

/**
 * Check if a widget has its content loaded
 */
export function isWidgetContentLoaded(widget: ComposedWidget): boolean {
  return widget.isContentLoaded && !widget.contentError;
}

/**
 * Get content loading status for multiple widgets
 */
export function getContentLoadingStatus(widgets: ComposedWidget[]) {
  const total = widgets.length;
  const loaded = widgets.filter(isWidgetContentLoaded).length;
  const failed = widgets.filter(w => w.contentError).length;
  
  return {
    total,
    loaded,
    failed,
    pending: total - loaded - failed,
    percentage: total > 0 ? (loaded / total) * 100 : 0,
  };
}

/**
 * Filter widgets by content loading status
 */
export function filterWidgetsByContentStatus(
  widgets: ComposedWidget[],
  status: 'loaded' | 'failed' | 'pending'
): ComposedWidget[] {
  switch (status) {
    case 'loaded':
      return widgets.filter(isWidgetContentLoaded);
    case 'failed':
      return widgets.filter(w => w.contentError);
    case 'pending':
      return widgets.filter(w => !w.isContentLoaded && !w.contentError);
    default:
      return widgets;
  }
}

/**
 * Sort widgets by content loading priority
 * Loaded widgets first, then pending, then failed
 */
export function sortWidgetsByContentPriority(widgets: ComposedWidget[]): ComposedWidget[] {
  return [...widgets].sort((a, b) => {
    // Loaded widgets first
    if (isWidgetContentLoaded(a) && !isWidgetContentLoaded(b)) return -1;
    if (!isWidgetContentLoaded(a) && isWidgetContentLoaded(b)) return 1;
    
    // Failed widgets last
    if (a.contentError && !b.contentError) return 1;
    if (!a.contentError && b.contentError) return -1;
    
    // Otherwise maintain original order
    return 0;
  });
}

// ============================================================================
// PERFORMANCE MONITORING
// ============================================================================

/**
 * Performance monitor for widget composition
 */
export class CompositionPerformanceMonitor {
  private metrics = {
    compositionTimes: [] as number[],
    cacheHits: 0,
    cacheMisses: 0,
    contentLoadFailures: 0,
  };

  recordCompositionTime(startTime: number): void {
    const duration = performance.now() - startTime;
    this.metrics.compositionTimes.push(duration);
    
    // Keep only last 100 measurements
    if (this.metrics.compositionTimes.length > 100) {
      this.metrics.compositionTimes.shift();
    }
  }

  recordCacheHit(): void {
    this.metrics.cacheHits++;
  }

  recordCacheMiss(): void {
    this.metrics.cacheMisses++;
  }

  recordContentLoadFailure(): void {
    this.metrics.contentLoadFailures++;
  }

  getMetrics() {
    const times = this.metrics.compositionTimes;
    const avgTime = times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;
    const maxTime = times.length > 0 ? Math.max(...times) : 0;
    const minTime = times.length > 0 ? Math.min(...times) : 0;
    
    const totalCacheRequests = this.metrics.cacheHits + this.metrics.cacheMisses;
    const cacheHitRate = totalCacheRequests > 0 ? (this.metrics.cacheHits / totalCacheRequests) * 100 : 0;

    return {
      composition: {
        averageTime: avgTime,
        maxTime,
        minTime,
        totalCompositions: times.length,
      },
      cache: {
        hitRate: cacheHitRate,
        hits: this.metrics.cacheHits,
        misses: this.metrics.cacheMisses,
      },
      content: {
        loadFailures: this.metrics.contentLoadFailures,
      },
    };
  }

  reset(): void {
    this.metrics = {
      compositionTimes: [],
      cacheHits: 0,
      cacheMisses: 0,
      contentLoadFailures: 0,
    };
  }
}

// Global performance monitor instance
export const compositionPerformanceMonitor = new CompositionPerformanceMonitor();

// ============================================================================
// ENHANCED WIDGET COMPOSER WITH MONITORING
// ============================================================================

/**
 * Enhanced widget composer with performance monitoring
 */
export class MonitoredWidgetComposer extends WidgetComposer {
  composeWidget(widgetData: WidgetData): ComposedWidget {
    const startTime = performance.now();
    const cacheKey = `${widgetData.id}-${widgetData.updatedAt}-${widgetData.contentId}`;
    
    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached) {
      compositionPerformanceMonitor.recordCacheHit();
      return cached;
    }

    compositionPerformanceMonitor.recordCacheMiss();
    
    const result = super.composeWidget(widgetData);
    
    if (result.contentError) {
      compositionPerformanceMonitor.recordContentLoadFailure();
    }
    
    compositionPerformanceMonitor.recordCompositionTime(startTime);
    
    return result;
  }
}

/**
 * Hook to get a monitored widget composer instance
 */
export function useMonitoredWidgetComposer(): MonitoredWidgetComposer {
  const contentStore = useContentStore();
  
  return useMemo(() => {
    return new MonitoredWidgetComposer(contentStore);
  }, [contentStore]);
}