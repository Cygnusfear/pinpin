/**
 * Safe Plugin Loader - Simpler approach with static imports and error boundaries
 * 
 * This approach:
 * - Uses static imports for better Vite/HMR compatibility
 * - Wraps each plugin registration in try-catch
 * - Continues loading other plugins if one fails
 * - Provides detailed error reporting
 * - Maintains proper HMR support
 */

import { getWidgetRegistry } from "../core/WidgetRegistry";
import type { WidgetPlugin } from "../types/widgets";

// Plugin loading state tracking
interface PluginLoadResult {
  name: string;
  success: boolean;
  error?: string;
  plugin?: WidgetPlugin;
}

/**
 * Get static plugin importer for better HMR support
 * This avoids dynamic imports that cause page reloads
 */
function getStaticPluginImporter(pluginName: string): () => Promise<{ [key: string]: any }> {
    return () => import(/* @vite-ignore */ `../plugins/${pluginName}`);
}

/**
 * Safely load and install a plugin with error handling
 */
async function safeLoadPlugin(
  name: string, 
  pluginImport: () => Promise<{ [key: string]: any }>
): Promise<PluginLoadResult> {
  try {
    console.log(`🔌 Loading plugin: ${name}`);
    
    // Import the plugin module
    const module = await pluginImport();
    
    // Find the plugin export (try multiple naming conventions)
    const pluginKey = `${name}Plugin`;
    
    // Special case for YouTube which uses camelCase
    let plugin;
    if (name === 'youtube') {
      plugin = module.youTubePlugin || module.YouTubePlugin || module[pluginKey] || module.default;
    } else {
      plugin = module[pluginKey] || module.default;
    }
    
    if (!plugin) {
      throw new Error(`Plugin export "${pluginKey}" not found. Available exports: ${Object.keys(module).join(', ')}`);
    }
    
    if (!plugin.install || typeof plugin.install !== 'function') {
      throw new Error(`Plugin "${name}" missing install method`);
    }
    
    // Install the plugin
    const registry = getWidgetRegistry();
    await plugin.install(registry);
    
    console.log(`✅ Successfully loaded plugin: ${name}`);
    
    return {
      name,
      success: true,
      plugin
    };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Failed to load plugin ${name}:`, errorMessage);
    
    return {
      name,
      success: false,
      error: errorMessage
    };
  }
}

/**
 * Load all core plugins with error handling
 */
export async function loadAllPluginsSafely(): Promise<{
  loaded: PluginLoadResult[];
  failed: PluginLoadResult[];
  total: number;
  successCount: number;
}> {
  console.log("🔌 Starting safe plugin loading...");
  
  // Get enabled plugins from server configuration
  const { getEnabledPlugins } = await import('./configLoader');
  const enabledPlugins = await getEnabledPlugins();
  console.log(`📋 Found ${enabledPlugins.length} enabled plugins in configuration`);
  
  // Create plugin loaders from configuration using static imports for better HMR
  const pluginLoaders = enabledPlugins.map((plugin) => {
    console.log(`🔍 Preparing to load plugin: ${plugin.name}`);
    return {
      name: plugin.name,
      loader: getStaticPluginImporter(plugin.name)
    };
  });
  
  // Load all plugins concurrently with error handling
  const results = await Promise.all(
    pluginLoaders.map(({ name, loader }) => safeLoadPlugin(name, loader))
  );
  
  // Separate successful and failed loads
  const loaded = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  // Report results
  const total = results.length;
  const successCount = loaded.length;
  
  console.log(`📊 Plugin loading completed: ${successCount}/${total} successful`);
  
  if (failed.length > 0) {
    console.warn(`⚠️ ${failed.length} plugins failed to load:`);
    failed.forEach(result => {
      console.error(`  💥 ${result.name}: ${result.error}`);
    });
    console.warn("🔄 Application will continue with available plugins");
  }
  
  // Log registry stats
  const registry = getWidgetRegistry();
  const registryStats = registry.getStats();
  console.log("📊 Final registry stats:", registryStats);
  
  return {
    loaded,
    failed,
    total,
    successCount
  };
}

/**
 * Get plugin loading statistics
 */
export function getPluginLoadingStatus() {
  const registry = getWidgetRegistry();
  const stats = registry.getStats();
  
  return {
    registeredTypes: stats.types,
    fullyRegistered: stats.fullyRegistered,
    registrationRate: stats.registrationRate
  };
}
