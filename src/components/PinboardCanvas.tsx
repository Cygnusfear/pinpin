import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { InteractionController, InteractionCallbacks } from '../managers/InteractionController';
import { SelectionIndicator } from './SelectionIndicator';
import { WidgetContainer } from './WidgetContainer';
import { getWidgetRegistry } from '../core/WidgetRegistry';
import { getGenericWidgetFactory } from '../core/GenericWidgetFactory';
import { useSelection, useInteractionMode, useUIStore } from '../stores/pinboardStore';
import {
  Widget,
  WidgetRenderState,
  WidgetEvents,
  WidgetCreateData
} from '../types/widgets';
import { ComposedWidget } from '../types/separatedWidgets';
import { CanvasTransform, InteractionMode } from '../types/canvas';

interface PinboardCanvasProps {
  widgets: ComposedWidget[];
  canvasTransform?: CanvasTransform;
  onWidgetUpdate: (id: string, updates: Partial<ComposedWidget>) => void;
  onWidgetsUpdate: (updates: Array<{ id: string; updates: Partial<ComposedWidget> }>) => void;
  onWidgetAdd: (widget: WidgetCreateData) => void;
  onWidgetRemove: (id: string) => void;
  onCanvasTransform?: (transform: CanvasTransform) => void;
}

const CORKBOARD_TEXTURE = 'https://thumbs.dreamstime.com/b/wooden-cork-board-seamless-tileable-texture-29991843.jpg';

// Utility function to convert ComposedWidget to legacy Widget format for InteractionController
const composedWidgetToLegacyWidget = (composedWidget: ComposedWidget): Widget => {
  const { content, isContentLoaded, contentError, ...baseWidget } = composedWidget;
  
  // If content is not loaded yet, return a loading placeholder widget
  if (!isContentLoaded && !contentError) {
    return {
      ...baseWidget,
      type: 'loading',
      message: 'Loading content...',
    } as Widget;
  }
  
  // If there's an error loading content, return an error widget
  if (contentError) {
    return {
      ...baseWidget,
      type: 'error',
      errorMessage: contentError,
      originalType: composedWidget.type,
    } as Widget;
  }
  
  // Merge content properties back into the widget for legacy compatibility
  switch (content?.type) {
    case 'image':
      return {
        ...baseWidget,
        type: 'image',
        src: content.src,
        alt: content.alt,
        originalDimensions: content.originalDimensions,
        filters: content.filters,
      } as Widget;
      
    case 'note':
      return {
        ...baseWidget,
        type: 'note',
        content: content.content,
        backgroundColor: content.backgroundColor,
        textColor: content.textColor,
        fontSize: content.fontSize,
        fontFamily: content.fontFamily,
        textAlign: content.textAlign,
        formatting: content.formatting,
      } as Widget;
      
    case 'url':
      return {
        ...baseWidget,
        type: 'url',
        url: content.url,
        title: content.title,
        description: content.description,
        favicon: content.favicon,
        preview: content.preview,
        embedType: content.embedType,
        embedData: content.embedData,
      } as Widget;
      
    case 'document':
      return {
        ...baseWidget,
        type: 'document',
        fileName: content.fileName,
        fileType: content.fileType,
        fileSize: content.fileSize,
        mimeType: content.mimeType,
        content: content.content,
        thumbnail: content.thumbnail,
        downloadUrl: content.downloadUrl,
        previewUrl: content.previewUrl,
      } as Widget;
      
    default:
      // Fallback for unknown or missing content
      return {
        ...baseWidget,
        type: 'unknown',
        originalData: content,
        fallbackRepresentation: 'icon',
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
    selectWidget,
    selectWidgets,
    clearSelection,
    setHoveredWidget,
  } = useSelection();

  const {
    mode,
    setMode,
  } = useInteractionMode();

  const {
    isFileOver,
    selectionBox,
    setFileOver,
    setSelectionBox,
  } = useUIStore();

  // Local state for canvas transform (synced with store)
  const [transform, setTransform] = useState<CanvasTransform>(
    canvasTransform || { x: 0, y: 0, scale: 1 }
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
  const handleCanvasTransformUpdate = useCallback((newTransform: CanvasTransform) => {
    setTransform(newTransform);
    onCanvasTransform?.(newTransform);
  }, [onCanvasTransform]);

  // Initialize interaction controller
  useEffect(() => {
    const callbacks: InteractionCallbacks = {
      onWidgetUpdate: (id: string, updates: Partial<Widget>) => {
        // Convert legacy Widget updates to ComposedWidget updates
        const composedUpdates = updates as Partial<ComposedWidget>;
        onWidgetUpdate(id, composedUpdates);
      },
      onWidgetsUpdate: (updates: Array<{ id: string; updates: Partial<Widget> }>) => {
        // Convert legacy Widget updates to ComposedWidget updates
        const composedUpdates = updates.map(({ id, updates }) => ({
          id,
          updates: updates as Partial<ComposedWidget>
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
  }, [onWidgetUpdate, onWidgetsUpdate, onWidgetRemove, handleCanvasTransformUpdate, setMode, clearSelection, selectWidgets, setHoveredWidget]);

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
      const currentSelectionBox = interactionControllerRef.current?.getSelectionBox() || null;
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

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Increment counter to track nested drag enters
    dragCounterRef.current++;
    
    // Only set file over on first enter
    if (dragCounterRef.current === 1) {
      setFileOver(true);
    }
  }, [setFileOver]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Don't change state on dragover - just prevent default
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Decrement counter
    dragCounterRef.current--;
    
    // Only clear file over when all nested elements are left
    if (dragCounterRef.current === 0) {
      setFileOver(false);
    }
  }, [setFileOver]);

  // Common handler for both drop and paste
  const handleContentDrop = useCallback(async (
    dataTransfer: DataTransfer,
    screenPosition: { x: number; y: number }
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
        canvasPosition
      );

      // Add all created widgets
      widgets.forEach(widget => {
        onWidgetAdd(widget);
      });

      if (widgets.length === 0) {
        console.log('No widgets could be created from the dropped content');
      } else {
        console.log(`Created ${widgets.length} widget(s) from dropped content`);
      }
    } catch (error) {
      console.error('Failed to create widgets from dropped content:', error);
    }
  }, [transform, onWidgetAdd]);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Reset drag counter and file over state
    dragCounterRef.current = 0;
    setFileOver(false);
    
    await handleContentDrop(e.dataTransfer, {
      x: e.clientX,
      y: e.clientY,
    });
  }, [handleContentDrop, setFileOver]);

  // Handle paste
  const handlePaste = useCallback(async (e: ClipboardEvent) => {
    const clipboardData = e.clipboardData;
    if (!clipboardData) return;

    const genericFactory = getGenericWidgetFactory();

    // Check if we have content to handle
    if (!genericFactory.canHandleData(clipboardData)) return;

    e.preventDefault();
    e.stopPropagation();

    // Get mouse position or use center of canvas
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    const centerPosition = canvasRect ? {
      x: canvasRect.left + canvasRect.width / 2,
      y: canvasRect.top + canvasRect.height / 2,
    } : { x: window.innerWidth / 2, y: window.innerHeight / 2 };

    // Calculate canvas position
    const canvasPosition = {
      x: (centerPosition.x - (canvasRect?.left || 0) - transform.x) / transform.scale,
      y: (centerPosition.y - (canvasRect?.top || 0) - transform.y) / transform.scale,
    };

    try {
      // Use the generic factory to handle paste events
      const widgets = await genericFactory.handlePasteEvent(e, canvasPosition);

      // Add all created widgets
      widgets.forEach(widget => {
        onWidgetAdd(widget);
      });

      if (widgets.length === 0) {
        console.log('No widgets could be created from the pasted content');
      } else {
        console.log(`Created ${widgets.length} widget(s) from pasted content`);
      }
    } catch (error) {
      console.error('Failed to create widgets from pasted content:', error);
    }
  }, [transform, onWidgetAdd]);

  // Add paste event listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'v') {
        // Don't prevent default here - let the paste event handle it
        return;
      }
    };

    // Add paste listener to the canvas element specifically
    const canvasElement = canvasRef.current;
    if (canvasElement) {
      canvasElement.addEventListener('paste', handlePaste);
    }
    
    // Also add to document for global paste
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('paste', handlePaste);

    return () => {
      if (canvasElement) {
        canvasElement.removeEventListener('paste', handlePaste);
      }
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('paste', handlePaste);
    };
  }, [handlePaste]);

  // Create widget events for each widget
  const createWidgetEvents = useCallback((widget: ComposedWidget): WidgetEvents => ({
    onUpdate: (updates) => {
      // Convert legacy Widget updates to ComposedWidget updates
      const composedUpdates = updates as Partial<ComposedWidget>;
      onWidgetUpdate(widget.id, composedUpdates);
    },
    onDelete: () => onWidgetRemove(widget.id),
    onDuplicate: () => {
      // For now, disable duplication until we implement proper conversion
      console.warn('Widget duplication not yet implemented for separated architecture');
    },
    onEdit: () => {
      // TODO: Implement edit mode
      console.log('Edit widget:', widget.id);
    },
    onConfigure: () => {
      // TODO: Implement configuration panel
      console.log('Configure widget:', widget.id);
    },
    onSelect: (event?: React.MouseEvent) => {
      // Forward widget clicks to the interaction controller
      if (event && interactionControllerRef.current) {
        // Prevent the event from bubbling to the canvas
        event.stopPropagation();
        
        // Create a synthetic mouse event for the interaction controller
        const syntheticEvent = {
          clientX: event.clientX,
          clientY: event.clientY,
          shiftKey: event.shiftKey,
          ctrlKey: event.ctrlKey,
          altKey: event.altKey,
          metaKey: event.metaKey,
          preventDefault: () => {},
          stopPropagation: () => {},
        } as MouseEvent;
        
        // Simulate mousedown and mouseup to complete the click cycle
        interactionControllerRef.current.handleMouseDown(syntheticEvent);
        
        // Use setTimeout to simulate the mouseup after a brief delay
        setTimeout(() => {
          if (interactionControllerRef.current) {
            interactionControllerRef.current.handleMouseUp(syntheticEvent);
          }
        }, 10);
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
  }), [onWidgetUpdate, onWidgetRemove]);

  // Create render state for each widget
  const createWidgetRenderState = useCallback((widget: ComposedWidget): WidgetRenderState => ({
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
  }), [selectedIds, hoveredId, transform]);

  // Get selected and hovered widgets
  const selectedWidgets = widgets.filter(w => selectedIds.includes(w.id));
  const hoveredWidget = hoveredId ? widgets.find(w => w.id === hoveredId) || null : null;
  
  // Convert to legacy widgets for components that still expect Widget type
  const selectedLegacyWidgets = selectedWidgets.map(composedWidgetToLegacyWidget);
  const hoveredLegacyWidget = hoveredWidget ? composedWidgetToLegacyWidget(hoveredWidget) : null;

  // Get cursor style based on mode
  const getCursorStyle = () => {
    switch (mode) {
      case 'hand':
        return 'grab';
      case 'drag':
        return 'grabbing';
      case 'area-select':
        return 'crosshair';
      case 'transform':
        return 'move';
      default:
        return 'default';
    }
  };

  return (
    <div
      ref={canvasRef}
      className="relative w-full h-screen overflow-hidden select-none"
      style={{
        backgroundColor: '#f5f5f5',
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
          transformOrigin: '0 0',
          width: '200vw',
          height: '200vh',
          position: 'relative',
          backgroundImage: `url(${CORKBOARD_TEXTURE})`,
          backgroundRepeat: 'repeat',
          backgroundSize: '400px 400px',
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
          snapTargets={interactionControllerRef.current?.getSnapIndicators() || []}
        />
      </div>

      {/* File drop overlay */}
      {isFileOver && (
        <motion.div
          className="absolute inset-0 bg-blue-500/20 backdrop-blur-sm flex items-center justify-center z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="bg-white/90 p-8 rounded-lg shadow-xl">
            <div className="text-center">
              <div className="text-4xl mb-4">📎</div>
              <p className="text-lg font-medium text-gray-700">
                Drop files, images, or URLs here!
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Supports images, web links, and text notes
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Controls */}
      <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
        <button
          type="button"
          onClick={() => handleCanvasTransformUpdate({ x: 0, y: 0, scale: 1 })}
          className="bg-white/90 hover:bg-white px-4 py-2 rounded-lg shadow-md transition-colors"
        >
          Reset View
        </button>
        <div className="bg-white/90 px-4 py-2 rounded-lg shadow-md text-sm">
          Zoom: {Math.round(transform.scale * 100)}%
        </div>
        <div className="bg-white/90 px-4 py-2 rounded-lg shadow-md text-sm">
          Mode: {mode}
        </div>
        {selectedIds.length > 0 && (
          <div className="bg-blue-500/90 text-white px-4 py-2 rounded-lg shadow-md text-sm">
            {selectedIds.length} selected
          </div>
        )}
        <div className="bg-green-500/90 text-white px-4 py-2 rounded-lg shadow-md text-sm">
          {widgets.length} widgets
        </div>
      </div>

      {/* Keyboard shortcuts help */}
      <div className="absolute bottom-4 right-4 bg-white/90 px-4 py-2 rounded-lg shadow-md text-xs max-w-xs">
        <p className="font-medium mb-1">Keyboard Shortcuts:</p>
        <div className="grid grid-cols-2 gap-1 text-gray-600">
          <span>⌘A</span><span>Select All</span>
          <span>⌘D</span><span>Duplicate</span>
          <span>Del</span><span>Delete</span>
          <span>Space</span><span>Hand Tool</span>
          <span>1</span><span>Zoom to Fit</span>
          <span>2</span><span>Zoom to Selection</span>
        </div>
      </div>
    </div>
  );
};

export default PinboardCanvas;