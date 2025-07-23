import { type DocumentId, sync } from "@tonk/keepsync";
import { create } from "zustand";
import { SYNC_CONFIG } from "../config/syncEngine";
import type {
  Widget,
  CreateWidgetInput,
  TransformUpdate,
  CanvasTransform,
} from "../types/widgets";
import { useContentStore } from "./contentStore";

// ============================================================================
// WIDGET STORE DATA STRUCTURE - CLEAN ARCHITECTURE
// ============================================================================

export interface WidgetStoreData {
  widgets: Widget[]; // Only lightweight widget data
  lastModified: number;
}

// ============================================================================
// WIDGET STORE STATE AND ACTIONS - UNIFIED PATTERN
// ============================================================================

export interface WidgetStoreState extends WidgetStoreData {}

export interface WidgetStoreActions {
  // Core widget operations
  addWidget: (input: CreateWidgetInput) => Promise<void>;
  updateWidget: (id: string, updates: Partial<Widget>) => void;
  removeWidget: (id: string) => void;

  // Performance-critical transform updates
  updateWidgetTransform: (id: string, transform: TransformUpdate['transform']) => void;
  updateMultipleWidgetTransforms: (updates: TransformUpdate[]) => void;

  // Selection operations (local state, not synced)
  selectWidget: (id: string, selected: boolean) => void;
  selectWidgets: (ids: string[], selected: boolean) => void;
  clearSelection: () => void;
  getSelectedWidgets: () => Widget[];

  // Utility operations
  reset: () => void;
  getWidget: (id: string) => Widget | undefined;
  getWidgetsByType: (type: string) => Widget[];
  reorderWidget: (id: string, newZIndex: number) => void;

  // Batch operations
  addMultipleWidgets: (inputs: CreateWidgetInput[]) => Promise<void>;
  removeMultipleWidgets: (ids: string[]) => void;
  updateMultipleWidgets: (updates: Array<{ id: string; updates: Partial<Widget> }>) => void;
}

export type WidgetStore = WidgetStoreState & WidgetStoreActions;

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
// STORE IMPLEMENTATION - CLEAN SLATE
// ============================================================================

// Initial widget store data
const initialWidgetData: WidgetStoreData = {
  widgets: [],
  lastModified: Date.now(),
};

// Create the widget store
export const useWidgetStore = create<WidgetStore>(
  sync(
    (set, get) => ({
      // Initial state
      ...initialWidgetData,

      // Core widget operations
      addWidget: async (input: CreateWidgetInput): Promise<void> => {
        const now = Date.now();
        const contentStore = useContentStore.getState();

        console.log("🔧 Adding widget:", input.type, input);

        try {
          // First, add content to content store
          const contentId = await contentStore.addContent({
            type: input.type,
            ...input.content,
          });

          // Then create widget data with content reference
          const newWidget = cleanWidgetData({
            id: generateWidgetId(),
            type: input.type,
            x: input.x,
            y: input.y,
            width: input.width,
            height: input.height,
            rotation: input.rotation || 0,
            zIndex: get().widgets.length,
            locked: input.locked || false,
            selected: false, // Always start unselected
            contentId, // Reference to content
            metadata: input.metadata || {},
            createdAt: now,
            updatedAt: now,
          } as Widget);

          console.log(
            "✅ Created widget with content reference:",
            newWidget.id,
            "->",
            contentId,
          );

          set((state) => ({
            widgets: [...state.widgets, newWidget],
            lastModified: now,
          }));
        } catch (error) {
          console.error("❌ Failed to add widget:", error);
          throw error;
        }
      },

      updateWidget: (id: string, updates: Partial<Widget>): void => {
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

      // Performance-critical transform updates
      updateWidgetTransform: (
        id: string,
        transform: TransformUpdate['transform'],
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

      updateMultipleWidgetTransforms: (updates: TransformUpdate[]): void => {
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

      getSelectedWidgets: (): Widget[] => {
        return get().widgets.filter((widget) => widget.selected);
      },

      // Utility operations
      reset: (): void => {
        set({
          ...initialWidgetData,
          lastModified: Date.now(),
        });
      },

      getWidget: (id: string): Widget | undefined => {
        return get().widgets.find((widget) => widget.id === id);
      },

      getWidgetsByType: (type: string): Widget[] => {
        return get().widgets.filter((widget) => widget.type === type);
      },

      reorderWidget: (id: string, newZIndex: number): void => {
        get().updateWidget(id, { zIndex: newZIndex });
      },

      // Batch operations
      addMultipleWidgets: async (inputs: CreateWidgetInput[]): Promise<void> => {
        for (const input of inputs) {
          await get().addWidget(input);
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

      updateMultipleWidgets: (
        updates: Array<{ id: string; updates: Partial<Widget> }>,
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
    }),
    {
      docId: SYNC_CONFIG.DOCUMENT_ID as DocumentId,
      initTimeout: SYNC_CONFIG.INIT_TIMEOUT,
      onInitError: (error) => {
        console.error("❌ Widget store sync initialization error:", error);
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
// CLEAN HOOKS - CONSISTENT NAMING
// ============================================================================

/**
 * Hook for accessing widgets
 */
export const useWidgets = () => {
  return useWidgetStore((state) => state.widgets);
};

/**
 * Hook for widget management actions
 */
export const useWidgetActions = () => {
  const addWidget = useWidgetStore((state) => state.addWidget);
  const updateWidget = useWidgetStore((state) => state.updateWidget);
  const removeWidget = useWidgetStore((state) => state.removeWidget);
  const updateWidgetTransform = useWidgetStore((state) => state.updateWidgetTransform);
  const updateMultipleWidgetTransforms = useWidgetStore(
    (state) => state.updateMultipleWidgetTransforms,
  );
  const selectWidget = useWidgetStore((state) => state.selectWidget);
  const selectWidgets = useWidgetStore((state) => state.selectWidgets);
  const clearSelection = useWidgetStore((state) => state.clearSelection);
  const getSelectedWidgets = useWidgetStore((state) => state.getSelectedWidgets);
  const getWidget = useWidgetStore((state) => state.getWidget);
  const getWidgetsByType = useWidgetStore((state) => state.getWidgetsByType);
  const reorderWidget = useWidgetStore((state) => state.reorderWidget);
  const addMultipleWidgets = useWidgetStore((state) => state.addMultipleWidgets);
  const removeMultipleWidgets = useWidgetStore((state) => state.removeMultipleWidgets);
  const updateMultipleWidgets = useWidgetStore((state) => state.updateMultipleWidgets);

  return {
    addWidget,
    updateWidget,
    removeWidget,
    updateWidgetTransform,
    updateMultipleWidgetTransforms,
    selectWidget,
    selectWidgets,
    clearSelection,
    getSelectedWidgets,
    getWidget,
    getWidgetsByType,
    reorderWidget,
    addMultipleWidgets,
    removeMultipleWidgets,
    updateMultipleWidgets,
  };
};

/**
 * Hook for content operations from content store
 */
export const useContentActions = () => {
  const addContent = useContentStore((state) => state.addContent);
  const getContent = useContentStore((state) => state.getContent);
  const updateContent = useContentStore((state) => state.updateContent);
  const removeContent = useContentStore((state) => state.removeContent);

  return {
    addContent,
    getContent,
    updateContent,
    removeContent,
  };
};