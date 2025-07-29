/**
 * Plugin Configuration Loader
 * 
 * Loads plugin configuration from server endpoints only.
 * No fallbacks to avoid any possibility of page reloads.
 */

export interface PluginConfig {
  name: string;
  path: string;
  enabled: boolean;
}

export interface PluginsConfiguration {
  plugins: PluginConfig[];
}

// Simple cache for plugin configuration
let configCache: PluginsConfiguration | null = null;

/**
 * Fetch plugin configuration from server
 */
async function fetchPluginConfig(): Promise<PluginsConfiguration> {
  const response = await fetch('/api/plugins/config');
  
  if (!response.ok) {
    throw new Error(`Failed to fetch plugin config: ${response.status}`);
  }
  
  const config: PluginsConfiguration = await response.json();
  configCache = config;
  
  console.log(`📋 Loaded ${config.plugins.length} plugins from server`);
  return config;
}

/**
 * Get all enabled plugins from configuration
 */
export async function getEnabledPlugins(): Promise<PluginConfig[]> {
  const config = await fetchPluginConfig();
  return config.plugins.filter(plugin => plugin.enabled);
}

/**
 * Get all plugins (enabled and disabled)
 */
export async function getAllPlugins(): Promise<PluginConfig[]> {
  const config = await fetchPluginConfig();
  return config.plugins;
}

/**
 * Check if a plugin is enabled
 */
export async function isPluginEnabled(name: string): Promise<boolean> {
  const config = await fetchPluginConfig();
  const plugin = config.plugins.find(p => p.name === name);
  return plugin?.enabled || false;
}

/**
 * Get plugin configuration by name
 */
export async function getPluginConfig(name: string): Promise<PluginConfig | undefined> {
  const config = await fetchPluginConfig();
  return config.plugins.find(p => p.name === name);
}

/**
 * Update plugin configuration on server
 */
export async function updatePluginConfig(config: PluginsConfiguration): Promise<boolean> {
  try {
    const response = await fetch('/api/plugins/config', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(config),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to update plugin config: ${response.status}`);
    }
    
    // Clear cache to force refetch
    configCache = null;
    lastFetchTime = 0;
    
    console.log('✅ Plugin configuration updated on server');
    
    // Trigger plugin reload event
    window.dispatchEvent(new CustomEvent('pluginConfigUpdated'));
    
    return true;
    
  } catch (error) {
    console.error('❌ Failed to update plugin configuration:', error);
    return false;
  }
}

/**
 * Clear configuration cache to force refresh
 */
export function clearConfigCache(): void {
  configCache = null;
  lastFetchTime = 0;
  console.log('🔄 Plugin configuration cache cleared');
}