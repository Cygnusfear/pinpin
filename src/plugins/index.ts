import { getWidgetRegistry } from "../core/WidgetRegistry";
import { loadAllPluginsSafely, getPluginLoadingStatus } from "./safePluginLoader";

// ============================================================================
// SAFE PLUGIN LOADING - RELIABLE IMPLEMENTATION
// ============================================================================

/**
 * Register all plugins with the widget registry using safe loading
 * This prevents individual plugin failures from crashing the entire application
 */
export async function registerAllPlugins(): Promise<void> {
  console.log("🔌 Registering all plugins with safe loading...");

  try {
    // Use safe loader that handles individual plugin failures gracefully
    const results = await loadAllPluginsSafely();

    // Report final status
    if (results.successCount === 0) {
      console.error("❌ No plugins loaded successfully! Application may have limited functionality.");
    } else if (results.failed.length > 0) {
      console.warn(`⚠️ ${results.failed.length} plugins failed to load, but application will continue`);
      console.log(`✅ Successfully loaded ${results.successCount}/${results.total} plugins`);
    } else {
      console.log(`✅ All ${results.total} plugins loaded successfully!`);
    }

    // Log final registry state
    const status = getPluginLoadingStatus();
    console.log("📊 Final plugin status:", status);

  } catch (error) {
    console.error("❌ Critical error in plugin loading system:", error);
    
    // Don't throw - allow app to continue with whatever plugins loaded successfully
    console.warn("🔄 Application continuing with available plugins...");
  }
}

/**
 * Unregister all plugins
 */
export async function unregisterAllPlugins(): Promise<void> {
  const registry = getWidgetRegistry();

  console.log("🔌 Unregistering all plugins...");

  try {
    // Clear the entire registry (simpler approach for dynamic loading)
    registry.clear();

    console.log("❌ All plugins unregistered");
  } catch (error) {
    console.error("❌ Failed to unregister plugins:", error);
    throw error;
  }
}

/**
 * Get detailed plugin loading statistics
 */
export function getPluginStats() {
  return {
    loading: getPluginLoadingStatus(),
    registry: getWidgetRegistry().getStats()
  };
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

// ============================================================================
// DEVELOPMENT UTILITIES
// ============================================================================

/**
 * Development utilities for plugin management
 * These are exposed for debugging and development purposes
 */
export const PluginDevUtils = {
  getPluginStats,
  getPluginLoadingStatus,
  getWidgetRegistry
};

// Note: Individual plugin exports are no longer directly available to prevent 
// static import errors. Use the registry to access loaded plugins.
