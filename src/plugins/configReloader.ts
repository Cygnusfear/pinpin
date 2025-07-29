/**
 * Plugin Configuration Live Reloader
 * 
 * Simple event-based reloading of plugin configuration without page reloads.
 * Includes polling fallback for environments where HMR might not work reliably.
 */

import { clearConfigCache } from './configLoader';
import { loadAllPluginsSafely } from './safePluginLoader';

// State tracking for polling mechanism
let isPollingEnabled = false;
let pollingInterval: NodeJS.Timeout | null = null;
let lastConfigHash: string | null = null;

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
      
      // Log current state before clearing
      const beforeStats = registry.getStats();
      console.log('📊 Before clearing - Registry stats:', beforeStats);
      
      registry.clear();
      console.log('🧹 Registry cleared, all plugins unregistered');
      
      // Reload all plugins with the new configuration
      const result = await loadAllPluginsSafely();
      
      // Log final state after reloading
      const afterStats = registry.getStats();
      console.log('📊 After reloading - Registry stats:', afterStats);
      console.log(`🔄 Plugin reload completed: ${result.successCount}/${result.total} successful`);
      
      if (result.failed.length > 0) {
        console.warn('⚠️ Some plugins failed to reload:', result.failed.map(f => f.name));
      }
      
      // Dispatch event to notify other parts of the app
      window.dispatchEvent(new CustomEvent('pluginsReloaded', {
        detail: {
          ...result,
          registryStats: afterStats,
          timestamp: Date.now()
        }
      }));
      
    } catch (error) {
      console.error('❌ Failed to reload plugins after configuration change:', error);
      
      // Still dispatch event so UI knows something happened
      window.dispatchEvent(new CustomEvent('pluginsReloaded', {
        detail: {
          error: error instanceof Error ? error.message : String(error),
          timestamp: Date.now()
        }
      }));
    }
  });
  
  // Always enable polling for plugin configuration changes
  // HMR won't detect changes to server/public/plugins.json since it's not part of the client bundle
  if (import.meta.env.DEV) {
    console.log('🔥 Development mode: enabling polling for plugin config changes');
    enablePollingFallback(500); // Poll every 500ms in development
  } else {
    console.log('🔄 Production mode: enabling polling fallback');
    enablePollingFallback(5000); // Poll every 5 seconds in production
  }
  
  console.log('✅ Plugin configuration live reloader ready');
}

/**
 * Manually trigger a configuration reload
 */
export async function reloadPluginConfiguration(): Promise<void> {
  console.log('🔄 Manually triggering plugin configuration reload');
  window.dispatchEvent(new CustomEvent('pluginConfigUpdated'));
}

/**
 * Force reload plugins without fetching new configuration
 * Useful when you know plugins need to be re-registered but config hasn't changed
 */
export async function forceReloadPlugins(): Promise<void> {
  console.log('🔄 Force reloading plugins with current configuration');
  
  try {
    // Get current registry
    const { getWidgetRegistry } = await import('../core/WidgetRegistry');
    const registry = getWidgetRegistry();
    
    // Log current state
    const beforeStats = registry.getStats();
    console.log('📊 Before force reload - Registry stats:', beforeStats);
    
    // Clear and reload
    registry.clear();
    console.log('🧹 Registry cleared for force reload');
    
    const result = await loadAllPluginsSafely();
    
    const afterStats = registry.getStats();
    console.log('📊 After force reload - Registry stats:', afterStats);
    console.log(`🔄 Force reload completed: ${result.successCount}/${result.total} successful`);
    
    // Dispatch event
    window.dispatchEvent(new CustomEvent('pluginsReloaded', {
      detail: {
        ...result,
        registryStats: afterStats,
        timestamp: Date.now(),
        source: 'force-reload'
      }
    }));
    
  } catch (error) {
    console.error('❌ Failed to force reload plugins:', error);
    throw error;
  }
}

/**
 * Calculate hash of plugin configuration for change detection
 */
async function getConfigHash(): Promise<string | null> {
  try {
    const response = await fetch('/api/plugins/config');
    if (!response.ok) {
      if (response.status === 400) {
        // Invalid JSON - this is expected during editing, just return null silently
        return null;
      }
      console.warn('⚠️ Failed to fetch plugin configuration for polling');
      return null;
    }
    const config = await response.json();
    return JSON.stringify(config);
  } catch (error) {
    // Network errors or other issues - log but don't spam console
    return null;
  }
}

/**
 * Enable polling as fallback for plugin changes
 * This provides a backup mechanism if HMR doesn't work reliably
 */
export async function enablePollingFallback(intervalMs: number = 2000): Promise<void> {
  if (isPollingEnabled) {
    console.log('📊 Plugin polling already enabled');
    return;
  }
  
  console.log(`📊 Enabling plugin polling fallback (every ${intervalMs}ms)`);
  isPollingEnabled = true;
  
  // Get initial configuration hash
  lastConfigHash = await getConfigHash();
  console.log('📊 Initial plugin config hash:', lastConfigHash?.substring(0, 50) + '...');
  
  pollingInterval = setInterval(async () => {
    try {
      const currentHash = await getConfigHash();
      
      if (currentHash) {
        if (currentHash !== lastConfigHash) {
          console.log('📊 Plugin configuration change detected via polling');
          lastConfigHash = currentHash;
          window.dispatchEvent(new CustomEvent('pluginConfigUpdated'));
        }
      }
    } catch (error) {
      console.warn('⚠️ Error in plugin polling:', error);
    }
  }, intervalMs);
  
  console.log('✅ Plugin polling fallback enabled');
}

/**
 * Disable polling fallback
 */
export function disablePollingFallback(): void {
  if (!isPollingEnabled) {
    return;
  }
  
  console.log('📊 Disabling plugin polling fallback');
  isPollingEnabled = false;
  
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
  
  lastConfigHash = null;
  console.log('❌ Plugin polling fallback disabled');
}

/**
 * Get polling status
 */
export function getPollingStatus(): { enabled: boolean; interval: NodeJS.Timeout | null } {
  return {
    enabled: isPollingEnabled,
    interval: pollingInterval
  };
}