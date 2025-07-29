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
  
  // Define plugin loaders with static imports
  const pluginLoaders = [
    {
      name: 'calculator',
      loader: () => import('./calculator')
    },
    {
      name: 'chat', 
      loader: () => import('./chat')
    },
    {
      name: 'note',
      loader: () => import('./note')
    },
    {
      name: 'todo',
      loader: () => import('./todo')
    },
    {
      name: 'image',
      loader: () => import('./image')
    },
    {
      name: 'terminal',
      loader: () => import('./terminal')
    },
    {
      name: 'youtube',
      loader: () => import('./youtube')
    },
    {
      name: 'url',
      loader: () => import('./url')
    },
    {
      name: 'document',
      loader: () => import('./document')
    }
  ];
  
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
  // Accept changes to individual plugin modules
  import.meta.hot.accept(['./calculator', './chat', './note', './todo', './image', './terminal', './youtube', './url', './document'], (modules) => {
    console.log('🔥 HMR: Plugin modules updated');
    
    // Could implement plugin hot reloading here if needed
    // For now, just log that modules were updated
    if (modules) {
      modules.forEach((module, index) => {
        if (module) {
          console.log(`🔥 HMR: Plugin ${index} reloaded`);
        }
      });
    }
  });
}