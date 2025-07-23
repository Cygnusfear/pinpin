import { type DocumentId, sync } from "@tonk/keepsync";
import { create } from "zustand";
import { SYNC_CONFIG } from "../config/syncEngine";
import type {
  ContentData,
  LocalWidgetCreateInput,
  WidgetData,
} from "../types/widgets";
import { create as StorachaCreate } from "@storacha/client";

// ============================================================================
// UNIFIED PINBOARD STORE DATA STRUCTURE
// ============================================================================

export interface UnifiedPinboardData {
  widgets: WidgetData[]; // Lightweight widget data
  content: Record<string, ContentData>; // Heavy content data
  lastModified: number;
}

// ============================================================================
// UNIFIED PINBOARD STORE STATE AND ACTIONS
// ============================================================================

export interface UnifiedPinboardState extends UnifiedPinboardData {}

export interface UnifiedPinboardActions {
  // Widget operations
  addWidget: (widgetInput: LocalWidgetCreateInput) => Promise<void>;
  updateWidget: (id: string, updates: Partial<WidgetData>) => void;
  removeWidget: (id: string) => void;

  // Content operations
  addContent: (contentData: any) => Promise<string>;
  getContent: (contentId: string) => ContentData | null;
  updateContent: (contentId: string, updates: Partial<ContentData>) => void;
  removeContent: (contentId: string) => void;

  // Performance-critical transform updates (only sync widget data)
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

  // Utility operations
  reset: () => void;
  getWidget: (id: string) => WidgetData | undefined;
}

export type UnifiedPinboardStore = UnifiedPinboardState &
  UnifiedPinboardActions;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Generate unique IDs
const generateWidgetId = () =>
  `widget_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
const generateContentId = () =>
  `content_${Math.random().toString(36).substr(2, 6)}_${Date.now()}`;

// Content hashing for deduplication
function generateContentHash(contentData: any): { hash: string; size: number } {
  const hashInput = JSON.stringify(
    contentData,
    Object.keys(contentData).sort(),
  );
  let hash = 0;
  for (let i = 0; i < hashInput.length; i++) {
    const char = hashInput.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  const hashString = generateContentId();
  const size = new Blob([hashInput]).size;
  return { hash: hashString, size };
}

// ============================================================================
// STORE IMPLEMENTATION
// ============================================================================

const initialData: UnifiedPinboardData = {
  widgets: [],
  content: {},
  lastModified: Date.now(),
};

export const useUnifiedPinboardStore = create<UnifiedPinboardStore>(
  sync(
    (set, get) => ({
      ...initialData,

      // Widget operations
      addWidget: async (widgetInput: LocalWidgetCreateInput): Promise<void> => {
        const now = Date.now();

        console.log(
          "🔧 [UNIFIED] Adding widget:",
          widgetInput.type,
          widgetInput,
        );

        try {
          // First, add content
          const contentId = await get().addContent(widgetInput.content);

          // Then create widget data with content reference
          const newWidgetData: WidgetData = {
            id: generateWidgetId(),
            type: widgetInput.type,
            x: widgetInput.x,
            y: widgetInput.y,
            width: widgetInput.width,
            height: widgetInput.height,
            rotation: widgetInput.rotation || 0,
            zIndex: get().widgets.length,
            locked: widgetInput.locked || false,
            selected: false,
            contentId,
            metadata: widgetInput.metadata || {},
            createdAt: now,
            updatedAt: now,
          };

          console.log(
            "✅ [UNIFIED] Created widget with content reference:",
            newWidgetData.id,
            "->",
            contentId,
          );

          set((state) => ({
            widgets: [...state.widgets, newWidgetData],
            lastModified: now,
          }));
        } catch (error) {
          console.error("❌ [UNIFIED] Failed to add widget:", error);
          throw error;
        }
      },

      updateWidget: (id: string, updates: Partial<WidgetData>): void => {
        const now = Date.now();
        set((state) => ({
          widgets: state.widgets.map((widget) =>
            widget.id === id
              ? { ...widget, ...updates, updatedAt: now }
              : widget,
          ),
          lastModified: now,
        }));
      },

      removeWidget: (id: string): void => {
        const widget = get().getWidget(id);
        if (widget) {
          get().removeContent(widget.contentId);
        }

        set((state) => ({
          widgets: state.widgets.filter((widget) => widget.id !== id),
          lastModified: Date.now(),
        }));
      },

      // Content operations
      addContent: async (contentData: any): Promise<string> => {
        // Check for existing duplicate content
        const existingContent = Object.entries(get().content).find(
          ([_, content]) => {
            return (
              JSON.stringify(content, Object.keys(content).sort()) ===
              JSON.stringify(contentData, Object.keys(contentData).sort())
            );
          },
        );

        if (existingContent) {
          console.log(
            "🔄 [UNIFIED] Content deduplication: reusing existing content",
            existingContent[0],
          );
          return existingContent[0];
        }

        const { hash, size } = generateContentHash(contentData);
        const now = Date.now();

        const newContent: ContentData = {
          ...contentData,
          id: hash,
          lastModified: now,
          size,
        } as any;

        console.log(
          "📦 [UNIFIED] Adding new content:",
          hash,
          `(${size} bytes)`,
        );

        set((state) => ({
          content: {
            ...state.content,
            [hash]: newContent,
          },
          lastModified: now,
        }));

        return hash;
      },

      getContent: (contentId: string): ContentData | null => {
        return get().content[contentId] || null;
      },

      updateContent: (
        contentId: string,
        updates: Partial<ContentData>,
      ): void => {
        const now = Date.now();
        set((state) => {
          const existingContent = state.content[contentId];
          if (!existingContent) {
            console.warn(
              "⚠️ [UNIFIED] Attempted to update non-existent content:",
              contentId,
            );
            return state;
          }

          return {
            content: {
              ...state.content,
              [contentId]: {
                ...existingContent,
                ...updates,
                lastModified: now,
              },
            },
            lastModified: now,
          };
        });
      },

      removeContent: (contentId: string): void => {
        set((state) => {
          const { [contentId]: removed, ...remainingContent } = state.content;
          return {
            content: remainingContent,
            lastModified: Date.now(),
          };
        });
      },

      // Performance-critical transform updates
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

      // Utility operations
      reset: (): void => {
        set({ ...initialData, lastModified: Date.now() });
      },

      getWidget: (id: string): WidgetData | undefined => {
        return get().widgets.find((widget) => widget.id === id);
      },
    }),
    {
      docId: SYNC_CONFIG.DOCUMENT_ID as DocumentId,
      initTimeout: SYNC_CONFIG.INIT_TIMEOUT,
      onInitError: (error) => {
        console.error("❌ [UNIFIED] Sync initialization error:", error);
      },
      onBeforeSync: (data: any) => {
        const widgetCount = data.widgets?.length || 0;
        const contentCount = Object.keys(data.content || {}).length;
        console.log(
          "📤 [UNIFIED] About to sync:",
          widgetCount,
          "widgets,",
          contentCount,
          "content items",
        );

        // Calculate sync sizes for monitoring
        const widgetSyncSize = JSON.stringify(data.widgets || []).length;
        const contentSyncSize = JSON.stringify(data.content || {}).length;
        console.log(
          "📊 [UNIFIED] Sync sizes - Widgets:",
          widgetSyncSize,
          "bytes, Content:",
          contentSyncSize,
          "bytes",
        );

        return data;
      },
      onAfterSync: (data: any) => {
        const widgetCount = data.widgets?.length || 0;
        const contentCount = Object.keys(data.content || {}).length;
        console.log(
          "📥 [UNIFIED] Synced from remote:",
          widgetCount,
          "widgets,",
          contentCount,
          "content items",
        );
      },
    } as any,
  ),
);

// ============================================================================
// HELPER HOOKS
// ============================================================================

export const useUnifiedWidgetOperations = () => {
  const addWidget = useUnifiedPinboardStore((state) => state.addWidget);
  const updateWidget = useUnifiedPinboardStore((state) => state.updateWidget);
  const removeWidget = useUnifiedPinboardStore((state) => state.removeWidget);

  return { addWidget, updateWidget, removeWidget };
};

export const useUnifiedContentOperations = () => {
  const addContent = useUnifiedPinboardStore((state) => state.addContent);
  const getContent = useUnifiedPinboardStore((state) => state.getContent);
  const updateContent = useUnifiedPinboardStore((state) => state.updateContent);
  const removeContent = useUnifiedPinboardStore((state) => state.removeContent);

  return { addContent, getContent, updateContent, removeContent };
};

export const useUnifiedWidgetQueries = () => {
  const widgets = useUnifiedPinboardStore((state) => state.widgets);
  const getWidget = useUnifiedPinboardStore((state) => state.getWidget);

  return { widgets, getWidget };
};
