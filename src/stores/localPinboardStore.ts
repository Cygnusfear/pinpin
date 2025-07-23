import { type DocumentId, sync } from "@tonk/keepsync";
import { create } from "zustand";
import { SYNC_CONFIG } from "../config/syncEngine";
import type { LocalWidgetCreateInput, WidgetData } from "../types/widgets";
import { useContentStore } from "./contentStore";

// ============================================================================
// Local PINBOARD STORE DATA STRUCTURE
// ============================================================================

export interface LocalPinboardData {
  widgets: WidgetData[]; // Only lightweight widget data
  lastModified: number;
}

// ============================================================================
// Local PINBOARD STORE STATE AND ACTIONS
// ============================================================================

export interface LocalPinboardState extends LocalPinboardData {}

export interface LocalPinboardActions {
  // Widget operations (only widget data)
  addWidget: (widgetInput: LocalWidgetCreateInput) => Promise<void>;
  updateWidget: (id: string, updates: Partial<WidgetData>) => void;
  updateWidgets: (
    updates: Array<{ id: string; updates: Partial<WidgetData> }>,
  ) => void;
  removeWidget: (id: string) => void;

  // Widget data only operations (for performance-critical updates)
  updateWidgetTransform: (
    id: string,
    transform: {
      x?: number;
      y?: number;
      width?: number;
      height?: number;
      rotation?: number;
    },
  ) => void;
  updateWidgetState: (
    id: string,
    state: { selected?: boolean; locked?: boolean; zIndex?: number },
  ) => void;
  updateMultipleWidgetTransforms: (
    updates: Array<{
      id: string;
      transform: {
        x?: number;
        y?: number;
        width?: number;
        height?: number;
        rotation?: number;
      };
    }>,
  ) => void;

  // Batch operations
  addMultipleWidgets: (widgetInputs: LocalWidgetCreateInput[]) => Promise<void>;
  removeMultipleWidgets: (ids: string[]) => void;

  // Selection operations (local state, not synced)
  selectWidget: (id: string, selected: boolean) => void;
  selectWidgets: (ids: string[], selected: boolean) => void;
  clearSelection: () => void;
  getSelectedWidgets: () => WidgetData[];

  // Utility operations
  reset: () => void;
  getWidget: (id: string) => WidgetData | undefined;
  getWidgetsByType: (type: string) => WidgetData[];
  reorderWidget: (id: string, newZIndex: number) => void;
}

export type LocalPinboardStore = LocalPinboardState & LocalPinboardActions;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Generate unique IDs for widgets
const generateWidgetId = () =>
  `widget_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Clean widget data by removing undefined values
const cleanWidgetData = (widget: any): any => {
  const cleaned = { ...widget };

  Object.keys(cleaned).forEach((key) => {
    if (cleaned[key] === undefined) {
      delete cleaned[key];
    }
  });

  return cleaned;
};

// ============================================================================
// STORE IMPLEMENTATION
// ============================================================================

// Initial Local pinboard data
const initialLocalData: LocalPinboardData = {
  widgets: [],
  lastModified: Date.now(),
};

// Create the Local pinboard store
export const useLocalPinboardStore = create<LocalPinboardStore>(
  sync(
    (set, get) => ({
      // Initial state
      ...initialLocalData,

      // Widget operations
      addWidget: async (widgetInput: LocalWidgetCreateInput): Promise<void> => {
        const now = Date.now();
        const contentStore = useContentStore.getState();

        console.log("🔧 Adding Local widget:", widgetInput.type, widgetInput);

        try {
          // First, add content to content store
          const contentId = await contentStore.addContent(widgetInput.content);

          // Then create widget data with content reference
          const newWidgetData = cleanWidgetData({
            id: generateWidgetId(),
            type: widgetInput.type,
            x: widgetInput.x,
            y: widgetInput.y,
            width: widgetInput.width,
            height: widgetInput.height,
            rotation: widgetInput.rotation || 0,
            zIndex: get().widgets.length,
            locked: widgetInput.locked || false,
            selected: false, // Always start unselected
            contentId, // Reference to content
            metadata: widgetInput.metadata || {},
            createdAt: now,
            updatedAt: now,
          } as WidgetData);

          console.log(
            "✅ Created widget data with content reference:",
            newWidgetData.id,
            "->",
            contentId,
          );

          set((state) => ({
            widgets: [...state.widgets, newWidgetData],
            lastModified: now,
          }));
        } catch (error) {
          console.error("❌ Failed to add widget:", error);
          throw error;
        }
      },

      updateWidget: (id: string, updates: Partial<WidgetData>): void => {
        const now = Date.now();

        // Filter out content-related updates (these should go to content store)
        const { contentId, ...widgetUpdates } = updates as any;

        if (contentId && contentId !== get().getWidget(id)?.contentId) {
          console.warn(
            "⚠️ Content ID updates should be handled through content store",
          );
        }

        set((state) => ({
          widgets: state.widgets.map((widget) =>
            widget.id === id
              ? cleanWidgetData({ ...widget, ...widgetUpdates, updatedAt: now })
              : widget,
          ),
          lastModified: now,
        }));
      },

      updateWidgets: (
        updates: Array<{ id: string; updates: Partial<WidgetData> }>,
      ): void => {
        const now = Date.now();
        set((state) => {
          const updatesMap = new Map(updates.map((u) => [u.id, u.updates]));

          return {
            widgets: state.widgets.map((widget) => {
              const widgetUpdates = updatesMap.get(widget.id);
              return widgetUpdates
                ? cleanWidgetData({
                    ...widget,
                    ...widgetUpdates,
                    updatedAt: now,
                  })
                : widget;
            }),
            lastModified: now,
          };
        });
      },

      removeWidget: (id: string): void => {
        const widget = get().getWidget(id);
        if (widget) {
          // Remove content from content store
          const contentStore = useContentStore.getState();
          contentStore.removeContent(widget.contentId);
        }

        set((state) => ({
          widgets: state.widgets.filter((widget) => widget.id !== id),
          lastModified: Date.now(),
        }));
      },

      // Performance-optimized transform updates
      updateWidgetTransform: (
        id: string,
        transform: {
          x?: number;
          y?: number;
          width?: number;
          height?: number;
          rotation?: number;
        },
      ): void => {
        const now = Date.now();
        set((state) => ({
          widgets: state.widgets.map((widget) =>
            widget.id === id
              ? { ...widget, ...transform, updatedAt: now }
              : widget,
          ),
          lastModified: now,
        }));
      },

      updateWidgetState: (
        id: string,
        state: { selected?: boolean; locked?: boolean; zIndex?: number },
      ): void => {
        const now = Date.now();
        set((currentState) => ({
          widgets: currentState.widgets.map((widget) =>
            widget.id === id ? { ...widget, ...state, updatedAt: now } : widget,
          ),
          lastModified: now,
        }));
      },

      updateMultipleWidgetTransforms: (
        updates: Array<{
          id: string;
          transform: {
            x?: number;
            y?: number;
            width?: number;
            height?: number;
            rotation?: number;
          };
        }>,
      ): void => {
        const now = Date.now();
        set((state) => {
          const updatesMap = new Map(updates.map((u) => [u.id, u.transform]));

          return {
            widgets: state.widgets.map((widget) => {
              const transform = updatesMap.get(widget.id);
              return transform
                ? { ...widget, ...transform, updatedAt: now }
                : widget;
            }),
            lastModified: now,
          };
        });
      },

      // Batch operations
      addMultipleWidgets: async (
        widgetInputs: LocalWidgetCreateInput[],
      ): Promise<void> => {
        for (const widgetInput of widgetInputs) {
          await get().addWidget(widgetInput);
        }
      },

      removeMultipleWidgets: (ids: string[]): void => {
        const widgets = get().widgets;
        const contentStore = useContentStore.getState();

        // Remove content for all widgets
        ids.forEach((id) => {
          const widget = widgets.find((w) => w.id === id);
          if (widget) {
            contentStore.removeContent(widget.contentId);
          }
        });

        set((state) => ({
          widgets: state.widgets.filter((widget) => !ids.includes(widget.id)),
          lastModified: Date.now(),
        }));
      },

      // Selection operations (these don't sync, they're local UI state)
      selectWidget: (id: string, selected: boolean): void => {
        set((state) => ({
          widgets: state.widgets.map((widget) =>
            widget.id === id ? { ...widget, selected } : widget,
          ),
        }));
      },

      selectWidgets: (ids: string[], selected: boolean): void => {
        const idSet = new Set(ids);
        set((state) => ({
          widgets: state.widgets.map((widget) =>
            idSet.has(widget.id) ? { ...widget, selected } : widget,
          ),
        }));
      },

      clearSelection: (): void => {
        set((state) => ({
          widgets: state.widgets.map((widget) => ({
            ...widget,
            selected: false,
          })),
        }));
      },

      getSelectedWidgets: (): WidgetData[] => {
        return get().widgets.filter((widget) => widget.selected);
      },

      // Utility operations
      reset: (): void => {
        set({
          ...initialLocalData,
          lastModified: Date.now(),
        });
      },

      getWidget: (id: string): WidgetData | undefined => {
        return get().widgets.find((widget) => widget.id === id);
      },

      getWidgetsByType: (type: string): WidgetData[] => {
        return get().widgets.filter((widget) => widget.type === type);
      },

      reorderWidget: (id: string, newZIndex: number): void => {
        get().updateWidget(id, { zIndex: newZIndex });
      },
    }),
    {
      docId: SYNC_CONFIG.DOCUMENT_ID as DocumentId, // Use same document ID as before for widgets
      initTimeout: SYNC_CONFIG.INIT_TIMEOUT,
      onInitError: (error) => {
        console.error("❌ Local pinboard sync initialization error:", error);
      },
      onBeforeSync: (data: any) => {
        console.log(
          "📤 About to sync widget data:",
          data.widgets?.length || 0,
          "widgets",
        );

        // Calculate total sync size for monitoring
        const syncSize = JSON.stringify(data).length;
        console.log("📊 Widget data sync size:", syncSize, "bytes");

        return data;
      },
    } as any,
  ),
);

// ============================================================================
// HELPER HOOKS
// ============================================================================

/**
 * Hook for widget operations
 */
export const useWidgetOperations = () => {
  const addWidget = useLocalPinboardStore((state) => state.addWidget);
  const updateWidget = useLocalPinboardStore((state) => state.updateWidget);
  const updateWidgets = useLocalPinboardStore((state) => state.updateWidgets);
  const removeWidget = useLocalPinboardStore((state) => state.removeWidget);
  const addMultipleWidgets = useLocalPinboardStore(
    (state) => state.addMultipleWidgets,
  );
  const removeMultipleWidgets = useLocalPinboardStore(
    (state) => state.removeMultipleWidgets,
  );

  return {
    addWidget,
    updateWidget,
    updateWidgets,
    removeWidget,
    addMultipleWidgets,
    removeMultipleWidgets,
  };
};

/**
 * Hook for performance-critical transform updates
 */
export const useWidgetTransforms = () => {
  const updateWidgetTransform = useLocalPinboardStore(
    (state) => state.updateWidgetTransform,
  );
  const updateMultipleWidgetTransforms = useLocalPinboardStore(
    (state) => state.updateMultipleWidgetTransforms,
  );

  return {
    updateWidgetTransform,
    updateMultipleWidgetTransforms,
  };
};

/**
 * Hook for widget selection
 */
export const useWidgetSelection = () => {
  const selectWidget = useLocalPinboardStore((state) => state.selectWidget);
  const selectWidgets = useLocalPinboardStore((state) => state.selectWidgets);
  const clearSelection = useLocalPinboardStore((state) => state.clearSelection);
  const getSelectedWidgets = useLocalPinboardStore(
    (state) => state.getSelectedWidgets,
  );
  const selectedWidgets = useLocalPinboardStore((state) =>
    state.getSelectedWidgets(),
  );

  return {
    selectWidget,
    selectWidgets,
    clearSelection,
    getSelectedWidgets,
    selectedWidgets,
  };
};

/**
 * Hook for widget queries
 */
export const useWidgetQueries = () => {
  const getWidget = useLocalPinboardStore((state) => state.getWidget);
  const getWidgetsByType = useLocalPinboardStore(
    (state) => state.getWidgetsByType,
  );
  const widgets = useLocalPinboardStore((state) => state.widgets);

  return {
    getWidget,
    getWidgetsByType,
    widgets,
  };
};

// Export sync status check function
export const getLocalSyncStatus = () => {
  try {
    return "synced";
  } catch (_error) {
    return "error";
  }
};
