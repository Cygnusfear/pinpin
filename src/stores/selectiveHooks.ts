import { useMemo } from "react";
import type {
  HydratedWidget,
  Widget,
  WidgetContent,
  WidgetRenderState,
} from "../types/widgets";
import { useContentStore } from "./contentStore";
import { useWidgetStore } from "./widgetStore";

// ============================================================================
// SELECTIVE REACTIVITY HOOKS - ZUSTAND-STYLE SELECTORS
// ============================================================================

/**
 * Subscribe to specific parts of widget content data
 * Only re-renders when selected data changes
 */
export function useWidgetContent<T>(
  widgetId: string,
  selector: (content: WidgetContent) => T,
): T | undefined {
  // Memoize the selector to avoid infinite loops
  const memoizedSelector = useMemo(() => {
    let lastContent: WidgetContent | undefined;
    let lastResult: T | undefined;

    return (state: any): T | undefined => {
      try {
        // Get widget to find contentId
        const widget = useWidgetStore.getState().getWidget(widgetId);
        if (!widget?.contentId) return undefined;

        // Get content from content store
        const content = state.content[widget.contentId];
        if (!content) return undefined;

        // Only recompute if content actually changed
        if (content !== lastContent) {
          lastContent = content;
          lastResult = selector(content);
        }

        return lastResult;
      } catch (error) {
        console.warn(`Widget content selector error for ${widgetId}:`, error);
        return undefined;
      }
    };
  }, [widgetId, selector]);

  return useContentStore(memoizedSelector);
}

/**
 * Subscribe to specific widget state (selection, hover, etc.)
 */
export function useWidgetState<T>(
  widgetId: string,
  selector: (state: WidgetRenderState, widget: Widget) => T,
): T | undefined {
  // Memoize the selector to avoid infinite loops
  const memoizedSelector = useMemo(() => {
    let lastWidget: Widget | undefined;
    let lastRenderState: WidgetRenderState | undefined;
    let lastResult: T | undefined;

    return (state: any): T | undefined => {
      try {
        const widget = state.widgets.find((w: Widget) => w.id === widgetId);
        if (!widget) return undefined;

        // Check if widget changed significantly
        const widgetChanged =
          !lastWidget ||
          lastWidget.selected !== widget.selected ||
          lastWidget.x !== widget.x ||
          lastWidget.y !== widget.y ||
          lastWidget.rotation !== widget.rotation;

        if (widgetChanged) {
          // Only create new objects when values actually change
          const renderState: WidgetRenderState = {
            isSelected: widget.selected,
            isHovered: false,
            isEditing: false,
            isLoading: false,
            hasError: false,
            errorMessage: undefined,
            transform: {
              x: widget.x,
              y: widget.y,
              scale: 1,
              rotation: widget.rotation,
            },
          };

          lastWidget = widget;
          lastRenderState = renderState;
          lastResult = selector(renderState, widget);
        }

        return lastResult;
      } catch (error) {
        console.warn(`Widget state selector error for ${widgetId}:`, error);
        return undefined;
      }
    };
  }, [widgetId, selector]);

  return useWidgetStore(memoizedSelector);
}

/**
 * Get widget-specific action handlers
 */
export function useWidgetActions(widgetId: string) {
  const widgetStore = useWidgetStore();
  const contentStore = useContentStore();

  return useMemo(() => {
    const getWidget = () => widgetStore.getWidget(widgetId);

    return {
      // Content actions
      updateContent: (updates: Partial<WidgetContent["data"]>) => {
        const widget = getWidget();
        if (widget?.contentId) {
          const existingContent = contentStore.getContent(widget.contentId);
          if (existingContent) {
            contentStore.updateContent(widget.contentId, {
              data: { ...existingContent.data, ...updates },
            });
          }
        }
      },

      // Widget actions
      updateWidget: (updates: Partial<Widget>) => {
        widgetStore.updateWidget(widgetId, updates);
      },

      removeWidget: () => {
        widgetStore.removeWidget(widgetId);
      },

      // Transform actions
      updateTransform: (transform: {
        x?: number;
        y?: number;
        width?: number;
        height?: number;
        rotation?: number;
      }) => {
        widgetStore.updateWidgetTransform(widgetId, transform);
      },

      // Selection actions
      select: (selected: boolean = true) => {
        widgetStore.selectWidget(widgetId, selected);
      },

      deselect: () => {
        widgetStore.selectWidget(widgetId, false);
      },

      // Utility actions
      duplicate: () => {
        const widget = getWidget();
        if (widget) {
          const content = contentStore.getContent(widget.contentId);
          if (content) {
            // Create new widget with same content but offset position
            widgetStore.addWidget({
              type: widget.type,
              x: widget.x + 20,
              y: widget.y + 20,
              width: widget.width,
              height: widget.height,
              rotation: widget.rotation,
              locked: false,
              metadata: { ...widget.metadata },
              content: content.data,
            });
          }
        }
      },

      reorder: (newZIndex: number) => {
        widgetStore.reorderWidget(widgetId, newZIndex);
      },
    };
  }, [widgetId, widgetStore, contentStore]);
}

/**
 * Hook to get the widget itself (lightweight data only)
 */
export function useWidget(widgetId: string): Widget | undefined {
  return useWidgetStore((state) =>
    state.widgets.find((w) => w.id === widgetId),
  );
}

/**
 * Hook to check if widget content is loaded
 */
export function useWidgetContentLoaded(widgetId: string): boolean {
  return useWidgetContent(widgetId, () => true) !== undefined;
}

/**
 * Hook to get content loading error if any
 */
export function useWidgetContentError(widgetId: string): string | undefined {
  const widget = useWidget(widgetId);
  const content = useWidgetContent(widgetId, (content) => content);

  if (!widget) return "Widget not found";
  if (!widget.contentId) return "No content ID";
  if (!content) return "Content not loaded";

  return undefined;
}

/**
 * Convenience hook that combines widget and content data for compatibility
 * Use this for gradual migration when you need the full hydrated widget
 */
export function useHydratedWidgetData(
  widgetId: string,
): HydratedWidget | undefined {
  const widget = useWidget(widgetId);
  const content = useWidgetContent(widgetId, (content) => content);
  const contentError = useWidgetContentError(widgetId);

  if (!widget) return undefined;

  return {
    ...widget,
    content: content || {
      id: "",
      type: widget.type,
      data: {},
      lastModified: 0,
    },
    isContentLoaded: !!content,
    contentError,
  };
}

// ============================================================================
// BATCH OPERATIONS FOR PERFORMANCE
// ============================================================================

/**
 * Subscribe to multiple widgets efficiently
 */
export function useMultipleWidgetContent<T>(
  widgetIds: string[],
  selector: (content: WidgetContent) => T,
): Record<string, T | undefined> {
  return useContentStore((state) => {
    const result: Record<string, T | undefined> = {};
    const widgetState = useWidgetStore.getState();

    for (const widgetId of widgetIds) {
      try {
        const widget = widgetState.getWidget(widgetId);
        if (widget?.contentId) {
          const content = state.content[widget.contentId];
          if (content) {
            result[widgetId] = selector(content);
          } else {
            result[widgetId] = undefined;
          }
        } else {
          result[widgetId] = undefined;
        }
      } catch (error) {
        console.warn(`Batch content selector error for ${widgetId}:`, error);
        result[widgetId] = undefined;
      }
    }

    return result;
  });
}

/**
 * Subscribe to multiple widget states efficiently
 */
export function useMultipleWidgetStates<T>(
  widgetIds: string[],
  selector: (state: WidgetRenderState, widget: Widget) => T,
): Record<string, T | undefined> {
  return useWidgetStore((state) => {
    const result: Record<string, T | undefined> = {};

    for (const widgetId of widgetIds) {
      try {
        const widget = state.widgets.find((w) => w.id === widgetId);
        if (widget) {
          const renderState: WidgetRenderState = {
            isSelected: widget.selected,
            isHovered: false,
            isEditing: false,
            isLoading: false,
            hasError: false,
            errorMessage: undefined,
            transform: {
              x: widget.x,
              y: widget.y,
              scale: 1,
              rotation: widget.rotation,
            },
          };
          result[widgetId] = selector(renderState, widget);
        } else {
          result[widgetId] = undefined;
        }
      } catch (error) {
        console.warn(`Batch state selector error for ${widgetId}:`, error);
        result[widgetId] = undefined;
      }
    }

    return result;
  });
}

// ============================================================================
// COMPUTED SELECTORS - DERIVED STATE
// ============================================================================

/**
 * Get computed widget info that combines multiple data sources
 */
export function useWidgetInfo(widgetId: string) {
  const widget = useWidget(widgetId);
  const contentLoaded = useWidgetContentLoaded(widgetId);
  const contentError = useWidgetContentError(widgetId);

  return useMemo(() => {
    if (!widget) return null;

    return {
      id: widget.id,
      type: widget.type,
      position: { x: widget.x, y: widget.y },
      size: { width: widget.width, height: widget.height },
      rotation: widget.rotation,
      zIndex: widget.zIndex,
      locked: widget.locked,
      selected: widget.selected,
      contentId: widget.contentId,
      isContentLoaded: contentLoaded,
      hasContentError: !!contentError,
      contentError,
      createdAt: widget.createdAt,
      updatedAt: widget.updatedAt,
    };
  }, [widget, contentLoaded, contentError]);
}

/**
 * Get widgets by type with selective subscriptions
 */
export function useWidgetsByType(type: string) {
  return useWidgetStore((state) =>
    state.widgets.filter((widget) => widget.type === type),
  );
}

/**
 * Get selected widgets with selective subscriptions
 */
export function useSelectedWidgets() {
  return useWidgetStore((state) =>
    state.widgets.filter((widget) => widget.selected),
  );
}
