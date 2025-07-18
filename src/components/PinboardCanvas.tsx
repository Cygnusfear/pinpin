import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { InteractionController, InteractionCallbacks } from '../managers/InteractionController';
import { SelectionIndicator } from './SelectionIndicator';
import { GenericWidgetRenderer } from './GenericWidgetRenderer';
import { getWidgetRegistry } from '../core/WidgetRegistry';
import { coreWidgetPlugin } from '../plugins/CoreWidgetPlugin';
import { 
  Widget, 
  WidgetRenderState, 
  WidgetEvents,
  WidgetCreateData 
} from '../types/widgets';
import { CanvasTransform, InteractionMode } from '../types/canvas';

interface PinboardCanvasProps {
  widgets: Widget[];
  canvasTransform?: CanvasTransform;
  onWidgetUpdate: (id: string, updates: Partial<Widget>) => void;
  onWidgetsUpdate: (updates: Array<{ id: string; updates: Partial<Widget> }>) => void;
  onWidgetAdd: (widget: WidgetCreateData) => void;
  onWidgetRemove: (id: string) => void;
  onCanvasTransform?: (transform: CanvasTransform) => void;
}

const CORKBOARD_TEXTURE = 'https://thumbs.dreamstime.com/b/wooden-cork-board-seamless-tileable-texture-29991843.jpg';

// Global flag to prevent multiple registry initializations
let registryInitialized = false;

export const PinboardCanvas: React.FC<PinboardCanvasProps> = ({
  widgets,
  canvasTransform,
  onWidgetUpdate,
  onWidgetsUpdate,
  onWidgetAdd,
  onWidgetRemove,
  onCanvasTransform,
}) => {
  const [transform, setTransform] = useState<CanvasTransform>(
    canvasTransform || { x: 0, y: 0, scale: 1 }
  );
  const [mode, setMode] = useState<InteractionMode>('select');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [isFileOver, setIsFileOver] = useState(false);
  
  const canvasRef = useRef<HTMLDivElement>(null);
  const interactionControllerRef = useRef<InteractionController | null>(null);

  // Initialize widget registry and install core plugin
  useEffect(() => {
    const initializeRegistry = async () => {
      if (registryInitialized) return;
      
      try {
        const registry = getWidgetRegistry();
        await registry.installPlugin(coreWidgetPlugin);
        registryInitialized = true;
        console.log('Widget registry initialized with core plugin');
      } catch (error) {
        console.error('Failed to initialize widget registry:', error);
      }
    };

    initializeRegistry();
  }, []);

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
      onWidgetUpdate,
      onWidgetsUpdate,
      onWidgetRemove,
      onCanvasTransform: handleCanvasTransformUpdate,
      onModeChange: setMode,
      onSelectionChange: setSelectedIds,
      onHoverChange: setHoveredId,
    };

    interactionControllerRef.current = new InteractionController(callbacks);

    if (canvasRef.current) {
      interactionControllerRef.current.setCanvasElement(canvasRef.current);
    }

    return () => {
      interactionControllerRef.current?.destroy();
    };
  }, [onWidgetUpdate, onWidgetsUpdate, onWidgetRemove, handleCanvasTransformUpdate]);

  // Update widgets in interaction controller
  useEffect(() => {
    // Convert widgets to the format expected by the interaction controller
    const canvasWidgets = widgets.map(widget => ({
      ...widget,
      src: widget.type === 'image' ? (widget as any).src : undefined,
      alt: widget.type === 'image' ? (widget as any).alt : undefined,
    }));
    interactionControllerRef.current?.setWidgets(canvasWidgets as any);
  }, [widgets]);

  // Update canvas transform in interaction controller
  useEffect(() => {
    interactionControllerRef.current?.setCanvasTransform(transform);
  }, [transform]);

  // Handle file drop
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsFileOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsFileOver(false);
  }, []);

  // Common handler for both drop and paste
  const handleContentDrop = useCallback(async (
    dataTransfer: DataTransfer,
    screenPosition: { x: number; y: number }
  ) => {
    const registry = getWidgetRegistry();
    const files = Array.from(dataTransfer.files);
    const text = dataTransfer.getData('text/plain');
    const html = dataTransfer.getData('text/html');
    
    // Calculate canvas position
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (!canvasRect) return;
    
    const canvasPosition = {
      x: (screenPosition.x - canvasRect.left - transform.x) / transform.scale,
      y: (screenPosition.y - canvasRect.top - transform.y) / transform.scale,
    };

    let widgetsCreated = 0;

    // Handle files first (highest priority)
    for (const file of files) {
      try {
        const supportedTypes = registry.canHandleData(file);
        if (supportedTypes.length > 0) {
          const widget = await registry.createWidget(supportedTypes[0], file, {
            x: canvasPosition.x + (widgetsCreated * 20),
            y: canvasPosition.y + (widgetsCreated * 20),
          });
          if (widget) {
            onWidgetAdd(widget);
            widgetsCreated++;
          }
        } else {
          console.log(`Unsupported file type: ${file.type || 'unknown'} (${file.name})`);
        }
      } catch (error) {
        console.error('Failed to create widget from file:', error);
      }
    }

    // Handle text/URLs if no files were processed
    if (text && files.length === 0) {
      try {
        const supportedTypes = registry.canHandleData(text);
        if (supportedTypes.length > 0) {
          // Prefer URL over note for URL-like text
          const preferredType = supportedTypes.includes('url') ? 'url' : supportedTypes[0];
          const widget = await registry.createWidget(preferredType, text, canvasPosition);
          if (widget) {
            onWidgetAdd(widget);
            widgetsCreated++;
          }
        }
      } catch (error) {
        console.error('Failed to create widget from text:', error);
      }
    }

    // Handle HTML content (for rich text or embedded content)
    if (html && files.length === 0 && !text) {
      try {
        // Extract plain text from HTML for note creation
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        const plainText = tempDiv.textContent || tempDiv.innerText || '';
        
        if (plainText.trim()) {
          const supportedTypes = registry.canHandleData(plainText);
          if (supportedTypes.length > 0) {
            const widget = await registry.createWidget('note', plainText, canvasPosition);
            if (widget) {
              onWidgetAdd(widget);
              widgetsCreated++;
            }
          }
        }
      } catch (error) {
        console.error('Failed to create widget from HTML:', error);
      }
    }

    if (widgetsCreated === 0) {
      console.log('No widgets could be created from the dropped/pasted content');
    }
  }, [transform, onWidgetAdd]);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsFileOver(false);
    
    await handleContentDrop(e.dataTransfer, {
      x: e.clientX,
      y: e.clientY,
    });
  }, [handleContentDrop]);

  // Handle paste
  const handlePaste = useCallback(async (e: ClipboardEvent) => {
    // Only prevent default if we're going to handle the paste
    const clipboardData = e.clipboardData;
    if (!clipboardData) return;

    // Check if we have content to handle
    const text = clipboardData.getData('text/plain');
    const files = Array.from(clipboardData.files);
    
    if (!text && files.length === 0) return;

    e.preventDefault();
    e.stopPropagation();

    // Get mouse position or use center of canvas
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    const centerPosition = canvasRect ? {
      x: canvasRect.left + canvasRect.width / 2,
      y: canvasRect.top + canvasRect.height / 2,
    } : { x: window.innerWidth / 2, y: window.innerHeight / 2 };

    console.log('Paste event:', { text, files: files.length });
    await handleContentDrop(clipboardData, centerPosition);
  }, [handleContentDrop]);

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
  const createWidgetEvents = useCallback((widget: Widget): WidgetEvents => ({
    onUpdate: (updates) => onWidgetUpdate(widget.id, updates),
    onDelete: () => onWidgetRemove(widget.id),
    onDuplicate: () => {
      const duplicate = {
        ...widget,
        x: widget.x + 20,
        y: widget.y + 20,
      };
      delete (duplicate as any).id;
      onWidgetAdd(duplicate);
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
  }), [onWidgetUpdate, onWidgetRemove, onWidgetAdd]);

  // Create render state for each widget
  const createWidgetRenderState = useCallback((widget: Widget): WidgetRenderState => ({
    isSelected: selectedIds.includes(widget.id),
    isHovered: hoveredId === widget.id,
    isEditing: false,
    isLoading: false,
    hasError: false,
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
          {widgets.map((widget) => (
            <GenericWidgetRenderer
              key={widget.id}
              widget={widget}
              state={createWidgetRenderState(widget)}
              events={createWidgetEvents(widget)}
            />
          ))}
        </AnimatePresence>

        {/* Selection indicators */}
        <SelectionIndicator
          selectedWidgets={selectedWidgets}
          hoveredWidget={hoveredWidget}
          selectionBox={interactionControllerRef.current?.getSelectionBox() || null}
          snapTargets={interactionControllerRef.current?.getSnapIndicators() || []}
          onTransformStart={(type, handle, position) => {
            if (interactionControllerRef.current) {
              const canvasRect = canvasRef.current?.getBoundingClientRect();
              if (canvasRect) {
                const canvasPosition = {
                  x: (position.x - canvasRect.left - transform.x) / transform.scale,
                  y: (position.y - canvasRect.top - transform.y) / transform.scale,
                };
                interactionControllerRef.current.startTransform(type, handle, canvasPosition);
              }
            }
          }}
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