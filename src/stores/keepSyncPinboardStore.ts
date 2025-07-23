import { type DocumentId, sync } from "@tonk/keepsync";
import { create } from "zustand";
import { SYNC_CONFIG } from "../config/syncEngine";
import type { Widget, WidgetCreateData } from "../types/widgets";

// Synced store data structure (what gets synchronized)
export interface KeepSyncPinboardData {
  firstLaunch: boolean;
  widgets: Widget[];
  lastModified: number;
}

// Store state interface (only synced data)
export interface PinboardState extends KeepSyncPinboardData {}

// Store actions interface
export interface PinboardActions {
  // Widget operations
  addWidget: (widgetData: WidgetCreateData) => void;
  updateWidget: (id: string, updates: Partial<Widget>) => void;
  updateWidgets: (
    updates: Array<{ id: string; updates: Partial<Widget> }>,
  ) => void;
  removeWidget: (id: string) => void;

  // Utility operations
  reset: () => void;
}

export type KeepSyncPinboardStore = PinboardState & PinboardActions;

// Generate unique IDs for widgets
const generateId = () =>
  `widget_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Clean widget data by removing undefined values that can't be serialized
const cleanWidgetData = (widget: any, visited = new WeakSet()): any => {
  // Check for circular references
  if (visited.has(widget)) {
    console.error(
      "🔄 RECURSION DETECTED: Circular reference found in widget data",
      widget,
    );
    return "[Circular Reference Removed]";
  }

  if (widget && typeof widget === "object" && !Array.isArray(widget)) {
    visited.add(widget);
  }

  const cleaned = { ...widget };

  // Remove undefined values recursively
  Object.keys(cleaned).forEach((key) => {
    if (cleaned[key] === undefined) {
      delete cleaned[key];
    } else if (
      cleaned[key] &&
      typeof cleaned[key] === "object" &&
      !Array.isArray(cleaned[key])
    ) {
      try {
        cleaned[key] = cleanWidgetData(cleaned[key], visited);
      } catch (error) {
        console.error(`🔄 RECURSION ERROR in key "${key}":`, error);
        cleaned[key] = "[Recursion Error - Removed]";
      }
    }
  });

  return cleaned;
};

// Initial synced data
const initialSyncedData: KeepSyncPinboardData = {
  firstLaunch: true,
  widgets: [],
  lastModified: Date.now(),
};

// Create the synced store
export const useKeepSyncPinboardStore = create<KeepSyncPinboardStore>(
  sync(
    (set, get) => ({
      // Initial state
      ...initialSyncedData,

      // Widget operations
      addWidget: (widgetData: WidgetCreateData) => {
        const now = Date.now();

        // Log widget creation for debugging
        console.log("🔧 Adding widget:", widgetData.type, widgetData);

        // Check for potential circular references in GroupWidget
        if (widgetData.type === "group" && "children" in widgetData) {
          const groupData = widgetData as any;
          console.log("👥 GroupWidget children:", groupData.children);

          // Check if any children reference back to this group (potential circular ref)
          const currentWidgets = get().widgets;
          const circularRefs = groupData.children?.filter((childId: string) => {
            const child = currentWidgets.find((w) => w.id === childId);
            return (
              child?.type === "group" &&
              "children" in child &&
              (child as any).children?.includes(groupData.id)
            );
          });

          if (circularRefs?.length > 0) {
            console.error(
              "🔄 POTENTIAL CIRCULAR GROUP REFERENCE:",
              circularRefs,
            );
          }
        }

        const newWidget = cleanWidgetData({
          ...widgetData,
          id: generateId(),
          zIndex: get().widgets.length,
          selected: false,
          createdAt: now,
          updatedAt: now,
        } as Widget);

        console.log("✅ Cleaned widget data:", newWidget);

        set((state) => ({
          widgets: [...state.widgets, newWidget],
          lastModified: now,
        }));
      },

      updateWidget: (id: string, updates: Partial<Widget>) => {
        const now = Date.now();
        set((state) => ({
          widgets: state.widgets.map((widget) =>
            widget.id === id
              ? ({ ...widget, ...updates, updatedAt: now } as Widget)
              : widget,
          ),
          lastModified: now,
        }));
      },

      updateWidgets: (
        updates: Array<{ id: string; updates: Partial<Widget> }>,
      ) => {
        const now = Date.now();
        set((state) => {
          const updatesMap = new Map(updates.map((u) => [u.id, u.updates]));

          return {
            widgets: state.widgets.map((widget) => {
              const widgetUpdates = updatesMap.get(widget.id);
              return widgetUpdates
                ? ({ ...widget, ...widgetUpdates, updatedAt: now } as Widget)
                : widget;
            }),
            lastModified: now,
          };
        });
      },

      removeWidget: (id: string) => {
        set((state) => ({
          widgets: state.widgets.filter((widget) => widget.id !== id),
          lastModified: Date.now(),
        }));
      },

      // Utility operations
      reset: () => {
        set({
          ...initialSyncedData,
          lastModified: Date.now(),
        });
      },
    }),
    {
      docId: SYNC_CONFIG.DOCUMENT_ID as DocumentId,
      initTimeout: SYNC_CONFIG.INIT_TIMEOUT,
      onInitError: (error) => {
        console.error("❌ Sync initialization error:", error);
        // The store selector will handle fallback to offline mode
      },
      // Add serialization monitoring
      onBeforeSync: (data: any) => {
        console.log("📤 About to sync data:", data);
        try {
          const serialized = JSON.stringify(data);
          console.log(
            "✅ Data serialization successful, size:",
            serialized.length,
          );
        } catch (error) {
          console.error(
            "🔄 SERIALIZATION ERROR - Potential circular reference:",
            error,
          );
          console.error("🔄 Problematic data:", data);
        }
        return data;
      },
    } as any,
  ),
);