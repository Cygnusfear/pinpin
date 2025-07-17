import React, { useState, useCallback } from 'react';
import { PinboardCanvas } from '../components/PinboardCanvas';
import { Widget, ImageWidget, WidgetCreateData } from '../types/widgets';

const Pinboard: React.FC = () => {
  const [widgets, setWidgets] = useState<Widget[]>([
    // Demo widgets with proper ImageWidget structure
    {
      id: 'demo-1',
      type: 'image',
      src: 'https://picsum.photos/200/150?random=1',
      alt: 'Demo image 1',
      originalDimensions: { width: 200, height: 150 },
      x: 100,
      y: 100,
      width: 200,
      height: 150,
      rotation: -5,
      zIndex: 1,
      locked: false,
      selected: false,
      metadata: { demo: true },
      createdAt: Date.now() - 10000,
      updatedAt: Date.now() - 10000,
    } as ImageWidget,
    {
      id: 'demo-2',
      type: 'image',
      src: 'https://picsum.photos/180/120?random=2',
      alt: 'Demo image 2',
      originalDimensions: { width: 180, height: 120 },
      x: 350,
      y: 200,
      width: 180,
      height: 120,
      rotation: 3,
      zIndex: 2,
      locked: false,
      selected: false,
      metadata: { demo: true },
      createdAt: Date.now() - 8000,
      updatedAt: Date.now() - 8000,
    } as ImageWidget,
    {
      id: 'demo-3',
      type: 'note',
      content: 'Welcome to the new widget system! 🎉\n\nThis note demonstrates the extensible widget architecture.',
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
      zIndex: 3,
      locked: false,
      selected: false,
      metadata: { demo: true },
      createdAt: Date.now() - 6000,
      updatedAt: Date.now() - 6000,
    },
  ]);

  const handleWidgetUpdate = useCallback((id: string, updates: Partial<Widget>) => {
    setWidgets(prevWidgets =>
      prevWidgets.map(widget =>
        widget.id === id ? { ...widget, ...updates, updatedAt: Date.now() } as Widget : widget
      )
    );
  }, []);

  const handleWidgetsUpdate = useCallback((updates: Array<{ id: string; updates: Partial<Widget> }>) => {
    setWidgets(prevWidgets => {
      const updatesMap = new Map(updates.map(u => [u.id, u.updates]));
      return prevWidgets.map(widget => {
        const update = updatesMap.get(widget.id);
        return update ? { ...widget, ...update, updatedAt: Date.now() } as Widget : widget;
      });
    });
  }, []);

  const handleWidgetAdd = useCallback((widgetData: WidgetCreateData) => {
    const newWidget = {
      id: `widget-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      selected: false,
      zIndex: Date.now(),
      ...widgetData,
    } as Widget;
    
    setWidgets(prevWidgets => [...prevWidgets, newWidget]);
  }, []);

  const handleWidgetRemove = useCallback((id: string) => {
    setWidgets(prevWidgets => prevWidgets.filter(widget => widget.id !== id));
  }, []);

  return (
    <div className="w-full h-screen relative">
      <PinboardCanvas
        widgets={widgets}
        onWidgetUpdate={handleWidgetUpdate}
        onWidgetsUpdate={handleWidgetsUpdate}
        onWidgetAdd={handleWidgetAdd}
        onWidgetRemove={handleWidgetRemove}
      />
    </div>
  );
};

export default Pinboard;