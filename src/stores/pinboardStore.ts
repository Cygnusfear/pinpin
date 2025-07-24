// ============================================================================
// PINBOARD STORE - CLEAN UNIFIED EXPORTS
// ============================================================================
// This file provides a clean interface for components to import the stores
// using the new unified architecture

export { getWidgetFactory as getGenericWidgetFactory } from "../core/GenericWidgetFactory";
// Export core services
export { getWidgetRegistry } from "../core/WidgetRegistry";
// Export plugin system
export { getAvailableWidgetTypes, registerAllPlugins } from "../plugins";
export type { CalculatorContent } from "../plugins/calculator/types";
export type { NoteContent } from "../plugins/note/types";
// Export plugin-specific content types from their respective locations
export type { TodoContent } from "../plugins/todo/types";
// Export hydration utilities
export {
  filterWidgetsByContentStatus,
  getContentLoadingStatus,
  isWidgetContentLoaded,
  useHydratedWidget,
  useHydratedWidgets,
  useWidgetHydrator,
} from "../services/widgetHydrator";

// Export types for convenience
export type {
  Widget,
  HydratedWidget,
  CreateWidgetInput,
  WidgetContent,
  CanvasTransform,
} from "../types/widgets";
export { useContentOperations, useContentStore } from "./contentStore";
export {
  useBackgroundType,
  useCanvasTransform,
  useInteractionMode,
  useSelection,
  useUIStore,
} from "./uiStore";
// Export the new unified stores
export {
  useContentActions,
  useWidgetActions,
  useWidgetStore,
  useWidgets,
} from "./widgetStore";
