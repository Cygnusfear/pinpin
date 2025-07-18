// Main pinboard store export
// This file provides a clean interface for components to import the stores

// Export the synced pinboard store (for actual pinboard data)
export {
  useSyncedPinboardStore as usePinboardStore,
  getSyncStatus
} from './syncedPinboardStore';

// Export the UI store (for local UI state)
export {
  useUIStore,
  useSelection,
  useCanvasTransform,
  useInteractionMode
} from './uiStore';

// Export types
export type {
  SyncedPinboardStore,
  PinboardData,
  PinboardState,
  PinboardActions
} from './syncedPinboardStore';

export type {
  UIStore,
  UIState,
  UIActions
} from './uiStore';

// Re-export widget and canvas types for convenience
export type { Widget, WidgetCreateData } from '../types/widgets';
export type { CanvasTransform } from '../types/canvas';