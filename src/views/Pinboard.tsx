import React, { useCallback, useEffect } from 'react';
import { PinboardCanvas } from '../components/PinboardCanvas';
import { SyncDemo } from '../components/SyncDemo';
import { Widget, WidgetCreateData } from '../types/widgets';
import { usePinboardStore } from '../stores/pinboardStore';

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

  // Initialize with demo widgets if the store is empty
  useEffect(() => {
    if (widgets.length === 0) {
      // Add demo widgets
      const demoWidgets = [
        {
          type: 'image',
          src: 'https://picsum.photos/200/150?random=1',
          alt: 'Demo image 1',
          originalDimensions: { width: 200, height: 150 },
          x: 100,
          y: 100,
          width: 200,
          height: 150,
          rotation: -5,
          locked: false,
          metadata: { demo: true },
        } as WidgetCreateData,
        {
          type: 'image',
          src: 'https://picsum.photos/180/120?random=2',
          alt: 'Demo image 2',
          originalDimensions: { width: 180, height: 120 },
          x: 350,
          y: 200,
          width: 180,
          height: 120,
          rotation: 3,
          locked: false,
          metadata: { demo: true },
        } as WidgetCreateData,
        {
          type: 'note',
          content: 'Welcome to the new widget system! 🎉\n\nThis note demonstrates the extensible widget architecture in offline mode.',
          backgroundColor: '#FFF740',
          textColor: '#000000',
          fontSize: 14,
          fontFamily: 'Inter, system-ui, sans-serif',
          textAlign: 'left',
          formatting: {
            bold: false,
            italic: false,
            underline: false,
          },
          x: 200,
          y: 350,
          width: 250,
          height: 150,
          rotation: 2,
          locked: false,
          metadata: { demo: true },
        } as WidgetCreateData,
      ];

      // Add demo widgets one by one
      demoWidgets.forEach(widget => addWidget(widget));
    }
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