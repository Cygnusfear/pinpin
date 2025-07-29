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
  
  // Enable polling fallback if not in development mode or if HMR isn't available
  if (!import.meta.hot || !import.meta.env.DEV) {
    console.log('🔄 HMR not available, enabling polling fallback');
    enablePollingFallback(3000); // Poll every 3 seconds in production
  } else {
    console.log('🔥 HMR available, polling fallback disabled');
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
 * Calculate hash of plugin configuration for change detection
 */
async function getConfigHash(): Promise<string | null> {
  try {
    const response = await fetch('/api/plugins/config');
    if (!response.ok) {
      console.warn('⚠️ Failed to fetch plugin configuration for polling');
      return null;
    }
    const config = await response.json();
    return JSON.stringify(config);
  } catch (error) {
    console.warn('⚠️ Error fetching plugin configuration for polling:', error);
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
  
  pollingInterval = setInterval(async () => {
    try {
      const currentHash = await getConfigHash();
      
      if (currentHash && currentHash !== lastConfigHash) {
        console.log('📊 Plugin configuration change detected via polling');
        lastConfigHash = currentHash;
        window.dispatchEvent(new CustomEvent('pluginConfigUpdated'));
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