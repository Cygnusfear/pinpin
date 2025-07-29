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
  
  // Create plugin loaders from configuration with static mapping
  // Note: Using static mapping to ensure Vite can analyze imports properly
  const importMap: Record<string, () => Promise<any>> = {
    chat: () => import('./chat'),
    calculator: () => import('./calculator'),
    note: () => import('./note'),
    todo: () => import('./todo'),
    image: () => import('./image'),
    terminal: () => import('./terminal'),
    youtube: () => import('./youtube'),
    url: () => import('./url'),
    document: () => import('./document'),
    drawing: () => import('./drawing'),
  };
  
  const pluginLoaders = enabledPlugins
    .filter(plugin => {
      if (!importMap[plugin.name]) {
        console.warn(`⚠️ No import mapping for plugin: ${plugin.name}`);
        return false;
      }
      return true;
    })
    .map((plugin) => {
      console.log(`🔍 Preparing to load plugin: ${plugin.name}`);
      return {
        name: plugin.name,
        loader: importMap[plugin.name]
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

// Hot Module Replacement support for individual plugins
if (import.meta.hot) {
  // Accept configuration changes without page reload
  import.meta.hot.accept('./configLoader', () => {
    console.log('🔥 HMR: Plugin configuration updated');
    window.dispatchEvent(new CustomEvent('pluginConfigUpdated'));
  });
  
  // Accept changes to the plugins.json file
  import.meta.hot.accept('./plugins.json', () => {
    console.log('🔥 HMR: Plugin list updated from JSON');
    window.dispatchEvent(new CustomEvent('pluginConfigUpdated'));
  });
  
  // Accept changes to individual plugin modules (dynamically built list)
  const acceptableModules = [
    './calculator', './chat', './note', './todo', './image', 
    './terminal', './youtube', './url', './document', './drawing'
  ];
  
  import.meta.hot.accept(acceptableModules, (modules) => {
    console.log('🔥 HMR: Plugin modules updated');
    
    if (modules) {
      modules.forEach((module, index) => {
        if (module) {
          console.log(`🔥 HMR: Plugin ${index} reloaded`);
        }
      });
    }
  });
}