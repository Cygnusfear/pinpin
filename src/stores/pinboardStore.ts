// Main pinboard store export
// This file provides a clean interface for components to import the store

export { 
  usePinboardStore,
  useSyncedPinboardStore, 
  useFallbackPinboardStore,
  setSyncAvailability,
  getSyncAvailability
} from './storeSelector';

export type { 
  SyncedPinboardStore,
  FallbackPinboardStore,
  PinboardData,
  PinboardState,
  PinboardActions 
} from './storeSelector';

// Re-export widget and canvas types for convenience
export type { Widget, WidgetCreateData } from '../types/widgets';
export type { CanvasTransform } from '../types/canvas';