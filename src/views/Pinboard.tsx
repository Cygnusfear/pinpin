import React, { useCallback, useEffect, useRef } from 'react';
import { PinboardCanvas } from '../components/PinboardCanvas';
import { SyncDemo } from '../components/SyncDemo';
import { Widget, WidgetCreateData } from '../types/widgets';
import { usePinboardStore } from '../stores/pinboardStore';
import { getWidgetRegistry } from '../core/WidgetRegistry';

const Pinboard: React.FC = () => {
  // Use the smart store selector that handles sync/fallback automatically
  const {
    widgets,
    updateWidget,
    updateWidgets,
    addWidget,
    removeWidget,
    canvasTransform,
    setCanvasTransform,
  } = usePinboardStore();

  // Track if demo widgets have been initialized to prevent duplicates
  const demoInitializedRef = useRef(false);

  // Initialize with demo widgets if the store is empty
  useEffect(() => {
    const initializeDemoWidgets = async () => {
      if (widgets.length === 0 && !demoInitializedRef.current) {
        demoInitializedRef.current = true;
        const registry = getWidgetRegistry();
        
        // Demo widget data
        const demoData = [
          {
            type: 'image',
            data: 'https://picsum.photos/200/150?random=1',
            position: { x: 100, y: 100 },
            metadata: { demo: true, demoId: 'demo-image-1' }
          },
          {
            type: 'image', 
            data: 'https://picsum.photos/180/120?random=2',
            position: { x: 350, y: 200 },
            metadata: { demo: true, demoId: 'demo-image-2' }
          },
          {
            type: 'note',
            data: 'Welcome to the new widget system! 🎉\n\nThis note demonstrates the extensible widget architecture in offline mode.',
            position: { x: 200, y: 350 },
            metadata: { demo: true, demoId: 'demo-note-1' }
          },
          {
            type: 'url',
            data: 'https://github.com',
            position: { x: 500, y: 100 },
            metadata: { demo: true, demoId: 'demo-url-1' }
          }
        ];

        // Create demo widgets using factories
        for (const demoItem of demoData) {
          try {
            const widget = await registry.createWidget(
              demoItem.type,
              demoItem.data,
              demoItem.position
            );
            
            if (widget) {
              // Add demo metadata
              widget.metadata = { ...widget.metadata, ...demoItem.metadata };
              addWidget(widget);
            } else {
              console.warn(`Failed to create demo widget of type: ${demoItem.type}`);
            }
          } catch (error) {
            console.error(`Error creating demo widget of type ${demoItem.type}:`, error);
          }
        }
      }
    };

    initializeDemoWidgets();
  }, [widgets.length, addWidget]);

  const handleWidgetUpdate = useCallback((id: string, updates: Partial<Widget>) => {
    updateWidget(id, updates);
  }, [updateWidget]);

  const handleWidgetsUpdate = useCallback((updates: Array<{ id: string; updates: Partial<Widget> }>) => {
    updateWidgets(updates);
  }, [updateWidgets]);

  const handleWidgetAdd = useCallback((widgetData: WidgetCreateData) => {
    addWidget(widgetData);
  }, [addWidget]);

  const handleWidgetRemove = useCallback((id: string) => {
    removeWidget(id);
  }, [removeWidget]);

  const handleCanvasTransform = useCallback((transform: any) => {
    setCanvasTransform(transform);
  }, [setCanvasTransform]);

  return (
    <div className="w-full h-screen relative">
      <PinboardCanvas
        widgets={widgets}
        canvasTransform={canvasTransform}
        onWidgetUpdate={handleWidgetUpdate}
        onWidgetsUpdate={handleWidgetsUpdate}
        onWidgetAdd={handleWidgetAdd}
        onWidgetRemove={handleWidgetRemove}
        onCanvasTransform={handleCanvasTransform}
      />
      <SyncDemo />
    </div>
  );
};

export default Pinboard;