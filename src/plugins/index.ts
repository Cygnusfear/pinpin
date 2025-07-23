import { getWidgetRegistry } from "../core/WidgetRegistry";
import { calculatorPlugin } from "./calculator";
import { notePlugin } from "./note";
import { todoPlugin } from "./todo";
import { imagePlugin } from "./image";
import { urlPlugin } from "./url";
import { documentPlugin } from "./document";

// ============================================================================
// PLUGIN REGISTRY - CLEAN IMPLEMENTATION
// ============================================================================

/**
 * Register all plugins with the widget registry
 */
export async function registerAllPlugins(): Promise<void> {
  const registry = getWidgetRegistry();

  console.log("🔌 Registering all plugins...");

  try {
    // Register core plugins in logical order
    await calculatorPlugin.install(registry);
    await notePlugin.install(registry);
    await todoPlugin.install(registry);
    await imagePlugin.install(registry);
    await urlPlugin.install(registry);
    await documentPlugin.install(registry);

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
    await documentPlugin.uninstall(registry);
    await urlPlugin.uninstall(registry);
    await imagePlugin.uninstall(registry);
    await todoPlugin.uninstall(registry);
    await notePlugin.uninstall(registry);
    await calculatorPlugin.uninstall(registry);

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
export { calculatorPlugin } from "./calculator";
export { notePlugin } from "./note";
export { todoPlugin } from "./todo";
export { imagePlugin } from "./image";
export { urlPlugin } from "./url";
export { documentPlugin } from "./document";

// Export plugin components for flexibility
export { CalculatorFactory, CalculatorRenderer } from "./calculator";
export { NoteFactory, NoteRenderer } from "./note";
export { TodoFactory, TodoRenderer } from "./todo";
export { ImageFactory, ImageRenderer } from "./image";
export { UrlFactory, UrlRenderer } from "./url";
export { DocumentFactory, DocumentRenderer } from "./document";