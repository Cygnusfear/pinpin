import type React from "react";
import { useCallback, } from "react";
import { FloatingToolbar } from "../components/FloatingToolbar";
import { PinboardCanvas } from "../components/PinboardCanvas";
import { useWidgetActions } from "../stores/widgetStore";
import { useCanvasTransform } from "../stores/uiStore";
import { useHydratedWidgets } from "../services/widgetHydrator";
import type {
  HydratedWidget,
  CreateWidgetInput,
} from "../types/widgets";

const Pinboard: React.FC = () => {
  // Use the new unified stores with proper action hooks
  const { addWidget, updateWidget, removeWidget } = useWidgetActions();
  
  // Use the hydrator hook to get hydrated widgets
  const hydratedWidgets = useHydratedWidgets();

  // Use the UI store for canvas transform
  const { canvasTransform, setCanvasTransform } = useCanvasTransform();

  const handleWidgetUpdate = useCallback(
    (id: string, updates: Partial<HydratedWidget>) => {
      // For unified architecture, we only update widget data properties
      // Content updates should go through content store separately
      const { content, isContentLoaded, contentError, ...widgetUpdates } =
        updates;
      updateWidget(id, widgetUpdates);
    },
    [updateWidget],
  );

  const handleWidgetsUpdate = useCallback(
    (updates: Array<{ id: string; updates: Partial<HydratedWidget> }>) => {
      // Convert to widget data updates only
      const widgetDataUpdates = updates.map(({ id, updates }) => {
        const { content, isContentLoaded, contentError, ...widgetUpdates } =
          updates;
        return { id, updates: widgetUpdates };
      });

      // Use individual updates for now since we don't have batch update
      widgetDataUpdates.forEach(({ id, updates }) => {
        updateWidget(id, updates);
      });
    },
    [updateWidget],
  );

  const handleWidgetAdd = useCallback(
    async (widgetData: CreateWidgetInput) => {
      try {
        console.log("✅ Adding widget with unified format:", widgetData.type, widgetData);
        await addWidget(widgetData);
      } catch (error) {
        console.error("❌ Failed to add widget:", error);
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
        widgets={hydratedWidgets}
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
