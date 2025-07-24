import { getWidgetRegistry } from "../core/WidgetRegistry";
import { calculatorPlugin } from "./calculator";
import { documentPlugin } from "./document";
import { imagePlugin } from "./image";
import { notePlugin } from "./note";
import { todoPlugin } from "./todo";
import { urlPlugin } from "./url";

// ============================================================================
// PLUGIN REGISTRY - CLEAN IMPLEMENTATION
// ============================================================================

export const plugins = [
  calculatorPlugin,
  notePlugin,
  todoPlugin,
  imagePlugin,
  urlPlugin,
  documentPlugin,
  // Add more plugins here
];

/**
 * Register all plugins with the widget registry
 */
export async function registerAllPlugins(): Promise<void> {
  const registry = getWidgetRegistry();

  console.log("🔌 Registering all plugins...");

  try {
    // Register core plugins in logical order
    for (const plugin of plugins) {
      await plugin.install(registry);
    }

    console.log("✅ All plugins registered successfully");

    // Log registry stats
    const stats = registry.getStats();
    console.log("📊 Registry stats:", stats);
  } catch (error) {
    console.error("❌ Failed to register plugins:", error);
    throw error;
  }
}

/**
 * Unregister all plugins
 */
export async function unregisterAllPlugins(): Promise<void> {
  const registry = getWidgetRegistry();

  console.log("🔌 Unregistering all plugins...");

  try {
    // Unregister in reverse order
    for (const plugin of plugins.reverse()) {
      await plugin.uninstall(registry);
    }

    console.log("❌ All plugins unregistered");
  } catch (error) {
    console.error("❌ Failed to unregister plugins:", error);
    throw error;
  }
}

/**
 * Get all available widget types
 */
export function getAvailableWidgetTypes() {
  const registry = getWidgetRegistry();
  return registry.getAllTypes();
}

/**
 * Get widget types by category
 */
export function getWidgetTypesByCategory(category: string) {
  const registry = getWidgetRegistry();
  return registry.getTypesByCategory(category);
}

// Export individual plugins for direct access
// Export plugin components for flexibility
export {
  CalculatorFactory,
  CalculatorRenderer,
  calculatorPlugin,
} from "./calculator";
export { DocumentFactory, DocumentRenderer, documentPlugin } from "./document";
export { ImageFactory, ImageRenderer, imagePlugin } from "./image";
export { NoteFactory, NoteRenderer, notePlugin } from "./note";
export { TodoFactory, TodoRenderer, todoPlugin } from "./todo";
export { UrlFactory, UrlRenderer, urlPlugin } from "./url";
