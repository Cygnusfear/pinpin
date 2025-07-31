import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CanvasTransform } from "../types/canvas";

// Background type options
export type BackgroundType = 'board' | 'dots';

// Local UI state interface
export interface UIState {
  // Selection state
  selectedWidgets: Set<string>;
  hoveredWidget: string | null;

  // Camera/viewport state
  canvasTransform: CanvasTransform;

  // Background state
  backgroundType: BackgroundType;

  // Other UI state
  mode: string;
  isFileOver: boolean;
  selectionBox: any | null; // BoundingBox type from canvas types
}

// UI actions interface
export interface UIActions {
  // Selection operations
  selectWidget: (id: string, selected: boolean) => void;
  selectWidgets: (ids: string[], selected: boolean) => void;
  clearSelection: () => void;
  setHoveredWidget: (id: string | null) => void;

  // Camera operations
  setCanvasTransform: (transform: CanvasTransform) => void;
  resetCanvasTransform: () => void;

  // Background operations
  setBackgroundType: (type: BackgroundType) => void;
  toggleBackgroundType: () => void;

  // Mode operations
  setMode: (mode: string) => void;

  // File drag operations
  setFileOver: (isOver: boolean) => void;

  // Selection box operations
  setSelectionBox: (box: any | null) => void;

  // Utility operations
  reset: () => void;
}

export type UIStore = UIState & UIActions;

// Initial state
const initialState: UIState = {
  selectedWidgets: new Set(),
  hoveredWidget: null,
  canvasTransform: { x: 0, y: 0, scale: 1 },
  backgroundType: "board",
  mode: "select",
  isFileOver: false,
  selectionBox: null,
};

// Create the UI store with persistence for camera transform only
export const useUIStore = create<UIStore>()(
  persist(
    (set, _get) => ({
      ...initialState,

      // Selection operations
      selectWidget: (id: string, selected: boolean) => {
        set((state) => {
          const newSelectedWidgets = new Set(state.selectedWidgets);
          if (selected) {
            newSelectedWidgets.add(id);
          } else {
            newSelectedWidgets.delete(id);
          }
          return { selectedWidgets: newSelectedWidgets };
        });
      },

      selectWidgets: (ids: string[], selected: boolean) => {
        set((state) => {
          const newSelectedWidgets = new Set(state.selectedWidgets);
          ids.forEach((id) => {
            if (selected) {
              newSelectedWidgets.add(id);
            } else {
              newSelectedWidgets.delete(id);
            }
          });
          return { selectedWidgets: newSelectedWidgets };
        });
      },

      clearSelection: () => {
        set({ selectedWidgets: new Set() });
      },

      setHoveredWidget: (id: string | null) => {
        set({ hoveredWidget: id });
      },

      // Camera operations
      setCanvasTransform: (transform: CanvasTransform) => {
        set({ canvasTransform: transform });
      },

      resetCanvasTransform: () => {
        set({ canvasTransform: { x: 0, y: 0, scale: 1 } });
      },

      // Background operations
      setBackgroundType: (type: BackgroundType) => {
        set({ backgroundType: type });
      },

      toggleBackgroundType: () => {
        set((state) => ({
          backgroundType: state.backgroundType === 'board' ? 'dots' : 'board',
        }));
      },

      // Mode operations
      setMode: (mode: string) => {
        set({ mode });
      },

      // File drag operations
      setFileOver: (isOver: boolean) => {
        set({ isFileOver: isOver });
      },

      // Selection box operations
      setSelectionBox: (box: any | null) => {
        set({ selectionBox: box });
      },

      // Utility operations
      reset: () => {
        set({
          ...initialState,
          selectedWidgets: new Set(),
        });
      },
    }),
    {
      name: "pinboard-ui-storage",
      partialize: (state) => ({
        // Only persist camera transform and background type, not selection or other transient UI state
        canvasTransform: state.canvasTransform,
        backgroundType: state.backgroundType,
      }),
    },
  ),
);

// Helper hooks for specific UI state
export const useSelection = () => {
  const selectedWidgets = useUIStore((state) => state.selectedWidgets);
  const hoveredWidget = useUIStore((state) => state.hoveredWidget);
  const selectWidget = useUIStore((state) => state.selectWidget);
  const selectWidgets = useUIStore((state) => state.selectWidgets);
  const clearSelection = useUIStore((state) => state.clearSelection);
  const setHoveredWidget = useUIStore((state) => state.setHoveredWidget);

  return {
    selectedWidgets,
    hoveredWidget,
    selectWidget,
    selectWidgets,
    clearSelection,
    setHoveredWidget,
  };
};

export const useCanvasTransform = () => {
  const canvasTransform = useUIStore((state) => state.canvasTransform);
  const setCanvasTransform = useUIStore((state) => state.setCanvasTransform);
  const resetCanvasTransform = useUIStore(
    (state) => state.resetCanvasTransform,
  );

  return {
    canvasTransform,
    setCanvasTransform,
    resetCanvasTransform,
  };
};

export const useInteractionMode = () => {
  const mode = useUIStore((state) => state.mode);
  const setMode = useUIStore((state) => state.setMode);

  return {
    mode,
    setMode,
  };
};

export const useBackgroundType = () => {
  const backgroundType = useUIStore((state) => state.backgroundType);
  const setBackgroundType = useUIStore((state) => state.setBackgroundType);
  const toggleBackgroundType = useUIStore((state) => state.toggleBackgroundType);

  return {
    backgroundType,
    setBackgroundType,
    toggleBackgroundType,
  };
};
