// ============================================================================
// PINBOARD STORE - CLEAN UNIFIED EXPORTS
// ============================================================================
// This file provides a clean interface for components to import the stores
// using the new unified architecture

// Export the new unified stores
export { useWidgetStore, useWidgets, useWidgetActions, useContentActions } from "./widgetStore";
export { useContentStore, useContentOperations } from "./contentStore";
export { 
  useUIStore, 
  useSelection, 
  useCanvasTransform, 
  useInteractionMode,
  useBackgroundType 
} from "./uiStore";

// Export hydration utilities
export { 
  useHydratedWidget, 
  useHydratedWidgets, 
  useWidgetHydrator,
  isWidgetContentLoaded,
  getContentLoadingStatus,
  filterWidgetsByContentStatus 
} from "../services/widgetHydrator";

// Export plugin system
export { registerAllPlugins, getAvailableWidgetTypes } from "../plugins";

// Export core services
export { getWidgetRegistry } from "../core/WidgetRegistry";
export { getGenericWidgetFactory } from "../core/GenericWidgetFactory";

// Export types for convenience
export type {
  Widget,
  HydratedWidget,
  CreateWidgetInput,
  WidgetContent,
  TodoContent,
  NoteContent,
  CalculatorContent,
  CanvasTransform,
} from "../types/widgets";
