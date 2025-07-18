import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Widget, WidgetCreateData } from '../types/widgets';
import { CanvasTransform } from '../types/canvas';

// Fallback store interface matching the synced store
export interface PinboardState {
  widgets: Widget[];
  canvasTransform: CanvasTransform;
  lastModified: number;
  selectedWidgets: Set<string>;
}

export interface PinboardActions {
  // Widget operations
  addWidget: (widgetData: WidgetCreateData) => void;
  updateWidget: (id: string, updates: Partial<Widget>) => void;
  updateWidgets: (updates: Array<{ id: string; updates: Partial<Widget> }>) => void;
  removeWidget: (id: string) => void;
  
  // Canvas operations
  setCanvasTransform: (transform: CanvasTransform) => void;
  
  // Selection operations
  selectWidget: (id: string, selected: boolean) => void;
  clearSelection: () => void;
  getSelectedWidgets: () => Widget[];
  
  // Utility operations
  reset: () => void;
}

export type FallbackPinboardStore = PinboardState & PinboardActions;

// Generate unique IDs for widgets
const generateId = () => `widget_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Initial state
const initialState: PinboardState = {
  widgets: [],
  canvasTransform: { x: 0, y: 0, scale: 1 },
  lastModified: Date.now(),
  selectedWidgets: new Set(),
};

// Create the fallback store with persistence
export const useFallbackPinboardStore = create<FallbackPinboardStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      // Widget operations
      addWidget: (widgetData: WidgetCreateData) => {
        const now = Date.now();
        const newWidget = {
          ...widgetData,
          id: generateId(),
          zIndex: get().widgets.length,
          selected: false,
          createdAt: now,
          updatedAt: now,
        } as Widget;

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
              ? { ...widget, ...updates, updatedAt: now } as Widget
              : widget
          ),
          lastModified: now,
        }));
      },

      updateWidgets: (updates: Array<{ id: string; updates: Partial<Widget> }>) => {
        const now = Date.now();
        set((state) => {
          const updatesMap = new Map(updates.map(u => [u.id, u.updates]));
          
          return {
            widgets: state.widgets.map((widget) => {
              const widgetUpdates = updatesMap.get(widget.id);
              return widgetUpdates
                ? { ...widget, ...widgetUpdates, updatedAt: now } as Widget
                : widget;
            }),
            lastModified: now,
          };
        });
      },

      removeWidget: (id: string) => {
        set((state) => ({
          widgets: state.widgets.filter((widget) => widget.id !== id),
          selectedWidgets: new Set([...state.selectedWidgets].filter(wId => wId !== id)),
          lastModified: Date.now(),
        }));
      },

      // Canvas operations
      setCanvasTransform: (transform: CanvasTransform) => {
        set({
          canvasTransform: transform,
          lastModified: Date.now(),
        });
      },

      // Selection operations
      selectWidget: (id: string, selected: boolean) => {
        set((state) => {
          const newSelectedWidgets = new Set(state.selectedWidgets);
          if (selected) {
            newSelectedWidgets.add(id);
          } else {
            newSelectedWidgets.delete(id);
          }

          return {
            selectedWidgets: newSelectedWidgets,
            widgets: state.widgets.map((widget) =>
              widget.id === id ? { ...widget, selected } : widget
            ),
            lastModified: Date.now(),
          };
        });
      },

      clearSelection: () => {
        set((state) => ({
          selectedWidgets: new Set(),
          widgets: state.widgets.map((widget) => ({ ...widget, selected: false })),
          lastModified: Date.now(),
        }));
      },

      getSelectedWidgets: () => {
        const { widgets, selectedWidgets } = get();
        return widgets.filter((widget) => selectedWidgets.has(widget.id));
      },

      // Utility operations
      reset: () => {
        set({
          ...initialState,
          lastModified: Date.now(),
        });
      },
    }),
    {
      name: 'pinboard-fallback-storage',
      partialize: (state) => ({
        widgets: state.widgets,
        canvasTransform: state.canvasTransform,
        lastModified: state.lastModified,
      }),
    }
  )
);