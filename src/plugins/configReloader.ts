/**
 * Plugin Configuration Live Reloader
 * 
 * Simple event-based reloading of plugin configuration without page reloads.
 */

import { clearConfigCache } from './configLoader';
import { loadAllPluginsSafely } from './safePluginLoader';

/**
 * Set up configuration change monitoring
 */
export function setupConfigReloader(): void {
  console.log('🔄 Setting up plugin configuration live reloader');
  
  // Listen for plugin configuration updates
  window.addEventListener('pluginConfigUpdated', async () => {
    console.log('🔄 Plugin configuration update detected, reloading plugins...');
    
    try {
      // Clear the cache to force fresh fetch
      clearConfigCache();
      
      // Clear existing plugin registrations
      const { getWidgetRegistry } = await import('../core/WidgetRegistry');
      const registry = getWidgetRegistry();
      registry.clear();
      
      // Reload all plugins with the new configuration
      const result = await loadAllPluginsSafely();
      
      console.log(`🔄 Plugin reload completed: ${result.successCount}/${result.total} successful`);
      
      // Dispatch event to notify other parts of the app
      window.dispatchEvent(new CustomEvent('pluginsReloaded', {
        detail: result
      }));
      
    } catch (error) {
      console.error('❌ Failed to reload plugins after configuration change:', error);
    }
  });
  
  console.log('✅ Plugin configuration live reloader ready');
}

/**
 * Manually trigger a configuration reload
 */
export async function reloadPluginConfiguration(): Promise<void> {
  console.log('🔄 Manually triggering plugin configuration reload');
  window.dispatchEvent(new CustomEvent('pluginConfigUpdated'));
}