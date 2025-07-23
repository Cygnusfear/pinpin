import type React from "react";
import { useCallback, useEffect, useRef } from "react";
import { FloatingToolbar } from "../components/FloatingToolbar";
import { PinboardCanvas } from "../components/PinboardCanvas";
import { useComposedWidgets } from "../services/widgetComposer";
import { useContentStore } from "../stores/contentStore";
import {
  useWidgetOperations,
  useWidgetQueries,
} from "../stores/localPinboardStore";
import { useCanvasTransform, usePinboardStore } from "../stores/pinboardStore";
import type {
  ComposedWidget,
  LocalWidgetCreateInput,
  WidgetDataCreateData,
} from "../types/widgets";

const Pinboard: React.FC = () => {
  // Use the separated pinboard store for widget data
  const { widgets: widgetDataArray } = useWidgetQueries();
  const { addWidget, updateWidget, removeWidget } = useWidgetOperations();

  // Access content store for sync status monitoring
  const _contentStore = useContentStore();

  // Debug logging with cross-device sync monitoring
  // console.log(
  // 	`📊 [CROSS-DEVICE DEBUG] Pinboard: ${widgetDataArray.length} widget data items:`,
  // 	widgetDataArray.map((w) => ({ id: w.id, contentId: w.contentId })),
  // );
  // console.log(`🏪 [CROSS-DEVICE DEBUG] Content store status:`, {
  // 	totalContentItems: Object.keys(contentStore.content || {}).length,
  // 	availableContentIds: Object.keys(contentStore.content || {}),
  // 	lastModified: contentStore.lastModified,
  // });

  // Compose widgets with their content for rendering
  const composedWidgets = useComposedWidgets(widgetDataArray);

  // console.log(
  // 	`🎨 [CROSS-DEVICE DEBUG] Pinboard: ${composedWidgets.length} composed widgets:`,
  // 	composedWidgets.map((w) => ({
  // 		id: w.id,
  // 		contentLoaded: w.isContentLoaded,
  // 		error: w.contentError,
  // 	})),
  // );

  // Check for content sync issues
  const contentSyncIssues = composedWidgets.filter(
    (w) => !w.isContentLoaded && w.contentError,
  );
  if (contentSyncIssues.length > 0) {
    console.warn(
      `⚠️ [CROSS-DEVICE DEBUG] Found ${contentSyncIssues.length} widgets with content sync issues:`,
      contentSyncIssues.map((w) => ({
        id: w.id,
        contentId: w.contentId,
        error: w.contentError,
      })),
    );
  }

  // Use the UI store for canvas transform
  const { canvasTransform, setCanvasTransform } = useCanvasTransform();

  // Track if demo widgets have been initialized to prevent duplicates
  const demoInitializedRef = useRef(false);

  // Initialize with demo widgets if the store is empty
  useEffect(() => {
    if (!usePinboardStore.getState().firstLaunch) {
      return;
    }
    usePinboardStore.setState({ firstLaunch: false });
    const initializeDemoWidgets = async () => {
      if (widgetDataArray.length === 0 && !demoInitializedRef.current) {
        demoInitializedRef.current = true;

        // Demo widget data in separated format
        const demoData: LocalWidgetCreateInput[] = [
          {
            type: "image",
            x: 100,
            y: 100,
            width: 200,
            height: 150,
            content: {
              type: "image",
              src: "https://picsum.photos/200/150?random=1",
              alt: "Demo Image 1",
              originalDimensions: { width: 200, height: 150 },
            },
            metadata: { demo: true, demoId: "demo-image-1" },
          },
          {
            type: "image",
            x: 350,
            y: 200,
            width: 180,
            height: 120,
            content: {
              type: "image",
              src: "https://picsum.photos/180/120?random=2",
              alt: "Demo Image 2",
              originalDimensions: { width: 180, height: 120 },
            },
            metadata: { demo: true, demoId: "demo-image-2" },
          },
          {
            type: "note",
            x: 200,
            y: 350,
            width: 400,
            height: 100,
            content: {
              type: "note",
              content:
                "Welcome to the new widget system! 🎉\n\nThis note demonstrates the extensible widget architecture in offline mode.",
              backgroundColor: "#AB47BC",
              textColor: "#FFFFFF",
              fontSize: 14,
              fontFamily: "Inter, system-ui, sans-serif",
              textAlign: "left" as const,
            },
            metadata: { demo: true, demoId: "demo-note-1" },
          },
          {
            type: "url",
            x: 500,
            y: 100,
            width: 300,
            height: 200,
            content: {
              type: "url",
              url: "https://github.com",
              title: "GitHub Repository",
              description: "Code repository on GitHub",
              favicon: "https://www.google.com/s2/favicons?domain=github.com",
              embedType: "link" as const,
            },
            metadata: { demo: true, demoId: "demo-url-1" },
          },
        ];

        // Create demo widgets using separated architecture
        for (const demoWidget of demoData) {
          try {
            await addWidget(demoWidget);
          } catch (error) {
            console.error(
              `Error creating demo widget of type ${demoWidget.type}:`,
              error,
            );
          }
        }
      }
    };

    initializeDemoWidgets();
  }, [widgetDataArray.length, addWidget]);

  const handleWidgetUpdate = useCallback(
    (id: string, updates: Partial<ComposedWidget>) => {
      // For separated architecture, we only update widget data properties
      // Content updates should go through content store separately
      const { content, isContentLoaded, contentError, ...widgetUpdates } =
        updates;
      updateWidget(id, widgetUpdates);
    },
    [updateWidget],
  );

  const handleWidgetsUpdate = useCallback(
    (updates: Array<{ id: string; updates: Partial<ComposedWidget> }>) => {
      // Convert to widget data updates only
      const widgetDataUpdates = updates.map(({ id, updates }) => {
        const { content, isContentLoaded, contentError, ...widgetUpdates } =
          updates;
        return { id, updates: widgetUpdates };
      });

      // Use individual updates for now since we don't have batch update in separated store
      widgetDataUpdates.forEach(({ id, updates }) => {
        updateWidget(id, updates);
      });
    },
    [updateWidget],
  );

  const handleWidgetAdd = useCallback(
    async (widgetData: WidgetDataCreateData) => {
      try {
        // Convert legacy WidgetCreateData to LocalWidgetCreateInput
        const separatedInput: LocalWidgetCreateInput = {
          type: widgetData.type,
          x: widgetData.x,
          y: widgetData.y,
          width: widgetData.width,
          height: widgetData.height,
          rotation: widgetData.rotation || 0,
          locked: widgetData.locked || false,
          metadata: widgetData.metadata || {},
          content: widgetData,
        };

        console.log("✅ Converted to separated format:", separatedInput);
        await addWidget(separatedInput);
      } catch (error) {
        console.error("❌ Failed to convert legacy widget:", error);
      }
    },
    [addWidget],
  );

  const handleWidgetRemove = useCallback(
    (id: string) => {
      removeWidget(id);
    },
    [removeWidget],
  );

  const handleCanvasTransform = useCallback(
    (transform: any) => {
      setCanvasTransform(transform);
    },
    [setCanvasTransform],
  );

  return (
    <div className="relative h-screen w-full">
      <PinboardCanvas
        widgets={composedWidgets}
        canvasTransform={canvasTransform}
        onWidgetUpdate={handleWidgetUpdate}
        onWidgetsUpdate={handleWidgetsUpdate}
        onWidgetAdd={handleWidgetAdd}
        onWidgetRemove={handleWidgetRemove}
        onCanvasTransform={handleCanvasTransform}
      />
      <FloatingToolbar
        onWidgetAdd={handleWidgetAdd}
        canvasPosition={{
          x: (400 - (canvasTransform?.x || 0)) / (canvasTransform?.scale || 1),
          y: (300 - (canvasTransform?.y || 0)) / (canvasTransform?.scale || 1),
        }}
      />
    </div>
  );
};

export default Pinboard;
