import { useMemo } from "react";
import { useContentStore } from "../stores/contentStore";
import { useWidgetStore } from "../stores/widgetStore";
import type {
  Widget,
  HydratedWidget,
  WidgetContent,
} from "../types/widgets";

// ============================================================================
// WIDGET HYDRATOR SERVICE - CLEAN IMPLEMENTATION
// ============================================================================

/**
 * Widget Hydrator Service
 * Combines lightweight widget data with heavy content data for rendering
 * This replaces the legacy widgetComposer with a cleaner, more efficient approach
 */
export class WidgetHydrator {
  private contentStore: any;
  private cache = new Map<string, HydratedWidget>();
  private cacheTimeout = 5000; // 5 seconds cache timeout

  constructor(contentStore: any) {
    this.contentStore = contentStore;
  }

  /**
   * Hydrate a single widget by combining widget data with content data
   */
  hydrateWidget<T = any>(widget: Widget): HydratedWidget<T> {
    const cacheKey = `${widget.id}-${widget.updatedAt}-${widget.contentId}`;

    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached as HydratedWidget<T>;
    }

    // Get content data
    const contentData = this.contentStore.getContent(widget.contentId);

    console.log(
      `🔍 Hydrating widget ${widget.id} with contentId: ${widget.contentId}`,
    );

    const hydratedWidget: HydratedWidget<T> = {
      ...widget,
      content: contentData as WidgetContent<T>,
      isContentLoaded: !!contentData,
      contentError: contentData
        ? undefined
        : `Content not found: ${widget.contentId}`,
    };

    // Cache the result
    this.cache.set(cacheKey, hydratedWidget);

    // Set cache expiration
    setTimeout(() => {
      this.cache.delete(cacheKey);
    }, this.cacheTimeout);

    return hydratedWidget;
  }

  /**
   * Hydrate multiple widgets efficiently
   */
  hydrateWidgets<T = any>(widgets: Widget[]): HydratedWidget<T>[] {
    // Get all unique content IDs
    const contentIds = [...new Set(widgets.map((w) => w.contentId))];

    // Batch fetch content data
    const contentMap = this.contentStore.getMultipleContent(contentIds);

    // Hydrate widgets
    return widgets.map((widget) => {
      const cacheKey = `${widget.id}-${widget.updatedAt}-${widget.contentId}`;

      // Check cache first
      const cached = this.cache.get(cacheKey);
      if (cached) {
        return cached as HydratedWidget<T>;
      }

      const contentData = contentMap[widget.contentId];

      const hydratedWidget: HydratedWidget<T> = {
        ...widget,
        content: contentData as WidgetContent<T>,
        isContentLoaded: !!contentData,
        contentError: contentData
          ? undefined
          : `Content not found: ${widget.contentId}`,
      };

      // Cache the result
      this.cache.set(cacheKey, hydratedWidget);

      // Set cache expiration
      setTimeout(() => {
        this.cache.delete(cacheKey);
      }, this.cacheTimeout);

      return hydratedWidget;
    });
  }

  /**
   * Clear the hydrator cache
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
// REACT HOOKS FOR WIDGET HYDRATION - CLEAN IMPLEMENTATION
// ============================================================================

/**
 * Hook to hydrate a single widget
 */
export function useHydratedWidget<T = any>(
  widgetId: string,
): HydratedWidget<T> | null {
  const widget = useWidgetStore((state) => state.getWidget(widgetId));
  const contentStore = useContentStore();

  return useMemo(() => {
    if (!widget) return null;

    const hydrator = new WidgetHydrator(contentStore);
    return hydrator.hydrateWidget<T>(widget);
  }, [widget, contentStore]);
}

/**
 * Hook to hydrate multiple widgets efficiently
 */
export function useHydratedWidgets<T = any>(): HydratedWidget<T>[] {
  const widgets = useWidgetStore((state) => state.widgets);
  const contentStore = useContentStore();

  return useMemo(() => {
    if (!widgets.length) return [];

    const hydrator = new WidgetHydrator(contentStore);
    return hydrator.hydrateWidgets<T>(widgets);
  }, [widgets, contentStore]);
}

/**
 * Hook to get a widget hydrator instance
 */
export function useWidgetHydrator(): WidgetHydrator {
  const contentStore = useContentStore();

  return useMemo(() => {
    return new WidgetHydrator(contentStore);
  }, [contentStore]);
}

// ============================================================================
// WIDGET HYDRATION UTILITIES
// ============================================================================

/**
 * Check if a widget has its content loaded
 */
export function isWidgetContentLoaded(widget: HydratedWidget): boolean {
  return widget.isContentLoaded && !widget.contentError;
}

/**
 * Get content loading status for multiple widgets
 */
export function getContentLoadingStatus(widgets: HydratedWidget[]) {
  const total = widgets.length;
  const loaded = widgets.filter(isWidgetContentLoaded).length;
  const failed = widgets.filter((w) => w.contentError).length;

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
  widgets: HydratedWidget[],
  status: "loaded" | "failed" | "pending",
): HydratedWidget[] {
  switch (status) {
    case "loaded":
      return widgets.filter(isWidgetContentLoaded);
    case "failed":
      return widgets.filter((w) => w.contentError);
    case "pending":
      return widgets.filter((w) => !w.isContentLoaded && !w.contentError);
    default:
      return widgets;
  }
}

/**
 * Sort widgets by content loading priority
 * Loaded widgets first, then pending, then failed
 */
export function sortWidgetsByContentPriority(
  widgets: HydratedWidget[],
): HydratedWidget[] {
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