// Main pinboard store export
// This file provides a clean interface for components to import the stores

export type { CanvasTransform } from "../types/canvas";
// Re-export widget and canvas types for convenience

// Export types
export type {
  KeepSyncPinboardData as PinboardData,
  KeepSyncPinboardStore as SyncedPinboardStore,
  PinboardActions,
  PinboardState,
} from "./keepSyncPinboardStore";
// Export the synced pinboard store (for actual pinboard data)
export {
  useKeepSyncPinboardStore as usePinboardStore,
} from "./keepSyncPinboardStore";
export type {
  UIActions,
  UIState,
  UIStore,
} from "./uiStore";
// Export the UI store (for local UI state)
export {
  useCanvasTransform,
  useInteractionMode,
  useSelection,
  useUIStore,
} from "./uiStore";
