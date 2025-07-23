import { AnimatePresence, motion } from "framer-motion";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { getGenericWidgetFactory } from "../core/GenericWidgetFactory";
import {
  type InteractionCallbacks,
  InteractionController,
} from "../managers/InteractionController";
import {
  useInteractionMode,
  useSelection,
  useUIStore,
} from "../stores/pinboardStore";
import type { CanvasTransform } from "../types/canvas";
import type {
  ComposedWidget,
  Widget,
  WidgetCreateData,
  WidgetEvents,
  WidgetRenderState,
} from "../types/widgets";
import { SelectionIndicator } from "./SelectionIndicator";
import { WidgetContainer } from "./WidgetContainer";

interface PinboardCanvasProps {
  widgets: ComposedWidget[];
  canvasTransform?: CanvasTransform;
  onWidgetUpdate: (id: string, updates: Partial<ComposedWidget>) => void;
  onWidgetsUpdate: (
    updates: Array<{ id: string; updates: Partial<ComposedWidget> }>,
  ) => void;
  onWidgetAdd: (widget: WidgetCreateData) => void;
  onWidgetRemove: (id: string) => void;
  onCanvasTransform?: (transform: CanvasTransform) => void;
}

const CORKBOARD_TEXTURE =
  "https://thumbs.dreamstime.com/b/wooden-cork-board-seamless-tileable-texture-29991843.jpg";

// Utility function to convert ComposedWidget to legacy Widget format for InteractionController
const composedWidgetToLegacyWidget = (
  composedWidget: ComposedWidget,
): Widget => {
  const { content, isContentLoaded, contentError, ...baseWidget } =
    composedWidget;

  // If content is not loaded yet, return a loading placeholder widget
  if (!isContentLoaded && !contentError) {
    return {
      ...baseWidget,
      type: "loading",
      message: "Loading content...",
    } as Widget;
  }

  // If there's an error loading content, return an error widget
  if (contentError) {
    return {
      ...baseWidget,
      type: "error",
      errorMessage: contentError,
      originalType: composedWidget.type,
    } as Widget;
  }

  // Merge content properties back into the widget for legacy compatibility
  switch (content?.type) {
    case "image":
      return {
        ...baseWidget,
        type: "image",
        src: content.src,
        alt: content.alt,
        originalDimensions: content.originalDimensions,
        filters: content.filters,
      } as Widget;

    case "note":
      return {
        ...baseWidget,
        type: "note",
        content: content.content,
        backgroundColor: content.backgroundColor,
        textColor: content.textColor,
        fontSize: content.fontSize,
        fontFamily: content.fontFamily,
        textAlign: content.textAlign,
        formatting: content.formatting,
      } as Widget;

    case "url":
      return {
        ...baseWidget,
        type: "url",
        url: content.url,
        title: content.title,
        description: content.description,
        favicon: content.favicon,
        preview: content.preview,
        embedType: content.embedType,
        embedData: content.embedData,
      } as Widget;

    case "document":
      return {
        ...baseWidget,
        type: "document",
        fileName: content.fileName,
        fileType: content.fileType,
        fileSize: content.fileSize,
        mimeType: content.mimeType,
        content: content.content,
        thumbnail: content.thumbnail,
        downloadUrl: content.downloadUrl,
        previewUrl: content.previewUrl,
      } as Widget;

    case "calculator":
      return {
        ...baseWidget,
        type: "calculator",
        currentValue: content.currentValue,
        previousValue: content.previousValue,
        operation: content.operation,
        result: content.result,
        history: content.history,
        isResultDisplayed: content.isResultDisplayed,
        contentId: composedWidget.contentId, // Pass contentId for content updates
      } as Widget;

    default:
      // Fallback for unknown or missing content
      return {
        ...baseWidget,
        type: "unknown",
        originalData: content,
        fallbackRepresentation: "icon",
        errorMessage: contentError,
      } as Widget;
  }
};

export const PinboardCanvas: React.FC<PinboardCanvasProps> = ({
  widgets,
  canvasTransform,
  onWidgetUpdate,
  onWidgetsUpdate,
  onWidgetAdd,
  onWidgetRemove,
  onCanvasTransform,
}) => {
  // Use UI store for local state
  const {
    selectedWidgets: selectedWidgetIds,
    hoveredWidget: hoveredWidgetId,
    selectWidgets,
    clearSelection,
    setHoveredWidget,
  } = useSelection();

  const { mode, setMode } = useInteractionMode();

  const { isFileOver, selectionBox, setFileOver, setSelectionBox } =
    useUIStore();

  // Local state for canvas transform (synced with store)
  const [transform, setTransform] = useState<CanvasTransform>(
    canvasTransform || { x: 0, y: 0, scale: 1 },
  );

  // Convert selectedWidgets Set to array for compatibility
  const selectedIds = Array.from(selectedWidgetIds);
  const hoveredId = hoveredWidgetId;

  const canvasRef = useRef<HTMLDivElement>(null);
  const interactionControllerRef = useRef<InteractionController | null>(null);

  // Sync canvas transform with store
  useEffect(() => {
    if (canvasTransform) {
      setTransform(canvasTransform);
    }
  }, [canvasTransform]);

  // Handle canvas transform updates
  const handleCanvasTransformUpdate = useCallback(
    (newTransform: CanvasTransform) => {
      setTransform(newTransform);
      onCanvasTransform?.(newTransform);
    },
    [onCanvasTransform],
  );

  // Initialize interaction controller
  useEffect(() => {
    const callbacks: InteractionCallbacks = {
      onWidgetUpdate: (id: string, updates: Partial<Widget>) => {
        // Convert legacy Widget updates to ComposedWidget updates
        const composedUpdates = updates as Partial<ComposedWidget>;
        onWidgetUpdate(id, composedUpdates);
      },
      onWidgetsUpdate: (
        updates: Array<{ id: string; updates: Partial<Widget> }>,
      ) => {
        // Convert legacy Widget updates to ComposedWidget updates
        const composedUpdates = updates.map(({ id, updates }) => ({
          id,
          updates: updates as Partial<ComposedWidget>,
        }));
        onWidgetsUpdate(composedUpdates);
      },
      onWidgetRemove,
      onCanvasTransform: handleCanvasTransformUpdate,
      onModeChange: setMode,
      onSelectionChange: (ids: string[]) => {
        // Clear current selection and select new widgets
        clearSelection();
        selectWidgets(ids, true);
      },
      onHoverChange: setHoveredWidget,
    };

    interactionControllerRef.current = new InteractionController(callbacks);

    if (canvasRef.current) {
      interactionControllerRef.current.setCanvasElement(canvasRef.current);
    }

    return () => {
      interactionControllerRef.current?.destroy();
    };
  }, [
    onWidgetUpdate,
    onWidgetsUpdate,
    onWidgetRemove,
    handleCanvasTransformUpdate,
    setMode,
    clearSelection,
    selectWidgets,
    setHoveredWidget,
  ]);

  // Update widgets in interaction controller
  useEffect(() => {
    // Convert ComposedWidgets to legacy Widget format for InteractionController
    const legacyWidgets = widgets.map(composedWidgetToLegacyWidget);
    interactionControllerRef.current?.setWidgets(legacyWidgets);
  }, [widgets]);

  // Update canvas transform in interaction controller
  useEffect(() => {
    interactionControllerRef.current?.setCanvasTransform(transform);
  }, [transform]);

  // Update selection box state when mode changes (to trigger re-renders)
  useEffect(() => {
    const updateSelectionBox = () => {
      const currentSelectionBox =
        interactionControllerRef.current?.getSelectionBox() || null;
      setSelectionBox(currentSelectionBox);
    };

    // Update immediately
    updateSelectionBox();

    // Set up an interval to check for changes (temporary solution)
    const interval = setInterval(updateSelectionBox, 16); // ~60fps

    return () => clearInterval(interval);
  }, [setSelectionBox]); // Re-run when setSelectionBox changes

  // Handle file drop with proper event target checking to prevent flickering
  const dragCounterRef = useRef(0);

  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Increment counter to track nested drag enters
      dragCounterRef.current++;

      // Only set file over on first enter
      if (dragCounterRef.current === 1) {
        setFileOver(true);
      }
    },
    [setFileOver],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Don't change state on dragover - just prevent default
  }, []);

  const handleDragLeave = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Decrement counter
      dragCounterRef.current--;

      // Only clear file over when all nested elements are left
      if (dragCounterRef.current === 0) {
        setFileOver(false);
      }
    },
    [setFileOver],
  );

  // Common handler for both drop and paste
  const handleContentDrop = useCallback(
    async (
      dataTransfer: DataTransfer,
      screenPosition: { x: number; y: number },
    ) => {
      const genericFactory = getGenericWidgetFactory();

      // Calculate canvas position
      const canvasRect = canvasRef.current?.getBoundingClientRect();
      if (!canvasRect) return;

      const canvasPosition = {
        x: (screenPosition.x - canvasRect.left - transform.x) / transform.scale,
        y: (screenPosition.y - canvasRect.top - transform.y) / transform.scale,
      };

      try {
        // Use the generic factory to handle drop events
        const widgets = await genericFactory.handleDropEvent(
          { dataTransfer } as DragEvent,
          canvasPosition,
        );

        // Add all created widgets
        widgets.forEach((widget) => {
          onWidgetAdd(widget);
        });

        if (widgets.length === 0) {
          console.log("No widgets could be created from the dropped content");
        } else {
          console.log(
            `Created ${widgets.length} widget(s) from dropped content`,
          );
        }
      } catch (error) {
        console.error("Failed to create widgets from dropped content:", error);
      }
    },
    [transform, onWidgetAdd],
  );

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Reset drag counter and file over state
      dragCounterRef.current = 0;
      setFileOver(false);

      await handleContentDrop(e.dataTransfer, {
        x: e.clientX,
        y: e.clientY,
      });
    },
    [handleContentDrop, setFileOver],
  );

  // Handle paste
  const handlePaste = useCallback(
    async (e: ClipboardEvent) => {
      const clipboardData = e.clipboardData;
      if (!clipboardData) return;

      const genericFactory = getGenericWidgetFactory();

      // Check if we have content to handle
      if (!genericFactory.canHandleData(clipboardData)) return;

      e.preventDefault();
      e.stopPropagation();

      // Get mouse position or use center of canvas
      const canvasRect = canvasRef.current?.getBoundingClientRect();
      const centerPosition = canvasRect
        ? {
            x: canvasRect.left + canvasRect.width / 2,
            y: canvasRect.top + canvasRect.height / 2,
          }
        : { x: window.innerWidth / 2, y: window.innerHeight / 2 };

      // Calculate canvas position
      const canvasPosition = {
        x:
          (centerPosition.x - (canvasRect?.left || 0) - transform.x) /
          transform.scale,
        y:
          (centerPosition.y - (canvasRect?.top || 0) - transform.y) /
          transform.scale,
      };

      try {
        // Use the generic factory to handle paste events
        const widgets = await genericFactory.handlePasteEvent(
          e,
          canvasPosition,
        );

        // Add all created widgets
        widgets.forEach((widget) => {
          onWidgetAdd(widget);
        });

        if (widgets.length === 0) {
          console.log("No widgets could be created from the pasted content");
        } else {
          console.log(
            `Created ${widgets.length} widget(s) from pasted content`,
          );
        }
      } catch (error) {
        console.error("Failed to create widgets from pasted content:", error);
      }
    },
    [transform, onWidgetAdd],
  );

  // Add paste event listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "v") {
        // Don't prevent default here - let the paste event handle it
        return;
      }
    };

    // Add paste listener to the canvas element specifically
    const canvasElement = canvasRef.current;
    if (canvasElement) {
      canvasElement.addEventListener("paste", handlePaste);
    }

    // Also add to document for global paste
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("paste", handlePaste);

    return () => {
      if (canvasElement) {
        canvasElement.removeEventListener("paste", handlePaste);
      }
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("paste", handlePaste);
    };
  }, [handlePaste]);

  // Create widget events for each widget
  const createWidgetEvents = useCallback(
    (widget: ComposedWidget): WidgetEvents => ({
      onUpdate: (updates) => {
        console.log('🔄 Widget onUpdate called:', {
          widgetId: widget.id,
          widgetType: widget.type,
          updates
        });
        // Convert legacy Widget updates to ComposedWidget updates
        const composedUpdates = updates as Partial<ComposedWidget>;
        onWidgetUpdate(widget.id, composedUpdates);
      },
      onDelete: () => onWidgetRemove(widget.id),
      onDuplicate: () => {
        // For now, disable duplication until we implement proper conversion
        console.warn(
          "Widget duplication not yet implemented for separated architecture",
        );
      },
      onEdit: () => {
        // TODO: Implement edit mode
        console.log("Edit widget:", widget.id);
      },
      onConfigure: () => {
        // TODO: Implement configuration panel
        console.log("Configure widget:", widget.id);
      },
      onSelect: (event?: React.MouseEvent) => {
        console.log('🎯 PinboardCanvas onSelect called:', {
          widgetId: widget.id,
          widgetType: widget.type,
          hasEvent: !!event,
          target: event?.target,
          targetTagName: event?.target ? (event.target as HTMLElement).tagName : 'no-event'
        });

        // Check if the click is on interactive content (e.g., calculator buttons)
        if (event && interactionControllerRef.current) {
          const target = event.target as HTMLElement;
          
          // Check if the click target is a button or other interactive content
          const isButton = target.tagName === 'BUTTON';
          const closestButton = target.closest('button');
          const hasInteractiveAttr = target.hasAttribute('data-interactive');
          const closestInteractive = target.closest('[data-interactive]');
          
          const isInteractiveContent = isButton || closestButton || hasInteractiveAttr || closestInteractive;
          
          console.log('🎯 PinboardCanvas interactive content detection:', {
            isButton,
            closestButton: !!closestButton,
            hasInteractiveAttr,
            closestInteractive: !!closestInteractive,
            isInteractiveContent
          });
          
          // If clicking on interactive content, don't trigger widget selection
          if (isInteractiveContent) {
            console.log('🎯 PinboardCanvas detected interactive content - stopping propagation');
            event.stopPropagation();
            return;
          }

          console.log('🎯 PinboardCanvas forwarding to InteractionController');
          // For non-interactive clicks, forward to interaction controller
          // Use the native event directly instead of synthetic events
          const nativeEvent = event.nativeEvent;
          if (nativeEvent) {
            interactionControllerRef.current.handleMouseDown(nativeEvent);
            // Handle mouseup immediately for a complete click cycle
            interactionControllerRef.current.handleMouseUp(nativeEvent);
          }
        }
      },
      onDeselect: () => {
        // Selection is handled by interaction controller
      },
      onHover: () => {
        // Hover is handled by interaction controller
      },
      onUnhover: () => {
        // Hover is handled by interaction controller
      },
    }),
    [onWidgetUpdate, onWidgetRemove],
  );

  // Create render state for each widget
  const createWidgetRenderState = useCallback(
    (widget: ComposedWidget): WidgetRenderState => ({
      isSelected: selectedIds.includes(widget.id),
      isHovered: hoveredId === widget.id,
      isEditing: false,
      isLoading: !widget.isContentLoaded,
      hasError: !!widget.contentError,
      errorMessage: widget.contentError,
      transform: {
        x: transform.x,
        y: transform.y,
        scale: transform.scale,
        rotation: widget.rotation,
      },
    }),
    [selectedIds, hoveredId, transform],
  );

  // Get selected and hovered widgets
  const selectedWidgets = widgets.filter((w) => selectedIds.includes(w.id));
  const hoveredWidget = hoveredId
    ? widgets.find((w) => w.id === hoveredId) || null
    : null;

  // Convert to legacy widgets for components that still expect Widget type
  const selectedLegacyWidgets = selectedWidgets.map(
    composedWidgetToLegacyWidget,
  );
  const hoveredLegacyWidget = hoveredWidget
    ? composedWidgetToLegacyWidget(hoveredWidget)
    : null;

  // Get cursor style based on mode
  const getCursorStyle = () => {
    switch (mode) {
      case "hand":
        return "grab";
      case "drag":
        return "grabbing";
      case "area-select":
        return "crosshair";
      case "transform":
        return "move";
      default:
        return "default";
    }
  };

  return (
    <div
      ref={canvasRef}
      className="relative h-screen w-full select-none overflow-hidden"
      style={{
        backgroundColor: "#f5f5f5",
        cursor: getCursorStyle(),
      }}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      role="application"
      aria-label="Widget-based pinboard canvas"
    >
      {/* Canvas transform container */}
      <div
        style={{
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          transformOrigin: "0 0",
          width: "200vw",
          height: "200vh",
          position: "relative",
          backgroundImage: `url(${CORKBOARD_TEXTURE})`,
          backgroundRepeat: "repeat",
          backgroundSize: "400px 400px",
        }}
      >
        {/* Widgets */}
        <AnimatePresence>
          {widgets.map((widget) => {
            const legacyWidget = composedWidgetToLegacyWidget(widget);
            return (
              <WidgetContainer
                key={widget.id}
                widget={legacyWidget}
                state={createWidgetRenderState(widget)}
                events={createWidgetEvents(widget)}
              />
            );
          })}
        </AnimatePresence>

        {/* Selection indicators */}
        <SelectionIndicator
          selectedWidgets={selectedLegacyWidgets}
          hoveredWidget={hoveredLegacyWidget}
          selectionBox={selectionBox}
          snapTargets={
            interactionControllerRef.current?.getSnapIndicators() || []
          }
        />
      </div>

      {/* File drop overlay */}
      {isFileOver && (
        <motion.div
          className="absolute inset-0 z-50 flex items-center justify-center bg-blue-500/20 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="rounded-lg bg-white/90 p-8 shadow-xl">
            <div className="text-center">
              <div className="mb-4 text-4xl">📎</div>
              <p className="font-medium text-gray-700 text-lg">
                Drop files, images, or URLs here!
              </p>
              <p className="mt-2 text-gray-500 text-sm">
                Supports images, web links, and text notes
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Keyboard shortcuts help */}
      <div className="absolute right-4 bottom-4 max-w-xs rounded-lg bg-white/90 px-4 py-2 text-xs shadow-md">
        <p className="mb-1 font-medium">Keyboard Shortcuts:</p>
        <div className="grid grid-cols-2 gap-1 text-gray-600">
          <span>⌘A</span>
          <span>Select All</span>
          <span>⌘D</span>
          <span>Duplicate</span>
          <span>Del</span>
          <span>Delete</span>
          <span>Space</span>
          <span>Hand Tool</span>
          <span>1</span>
          <span>Zoom to Fit</span>
          <span>2</span>
          <span>Zoom to Selection</span>
        </div>
      </div>
    </div>
  );
};

export default PinboardCanvas;
