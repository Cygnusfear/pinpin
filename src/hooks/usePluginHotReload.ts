/**
 * Hook for components to listen to plugin hot reloads
 * This allows components to update their state when plugins are reloaded
 */

import { useEffect, useState } from 'react';

export function usePluginHotReload() {
  const [version, setVersion] = useState(0);
  const [lastReloadInfo, setLastReloadInfo] = useState<any>(null);

  useEffect(() => {
    const handlePluginsReloaded = (event: CustomEvent) => {
      console.log('🔄 Plugin hot reload detected', event.detail);
      setVersion(prev => prev + 1);
      setLastReloadInfo(event.detail || null);
    };

    window.addEventListener('pluginsReloaded', handlePluginsReloaded as EventListener);
    
    return () => {
      window.removeEventListener('pluginsReloaded', handlePluginsReloaded as EventListener);
    };
  }, []);

  return { version, lastReloadInfo };
}

/**
 * Utility function to manually trigger a plugin reload from server configuration
 * This will fetch the latest config from the server and re-register all plugins
 */
export function triggerPluginReload() {
  console.log('🔄 Manually triggering plugin reload from server');
  window.dispatchEvent(new CustomEvent('pluginConfigUpdated'));
}

/**
 * Force refresh the floating toolbar and other plugin-dependent components
 * This directly triggers the pluginsReloaded event without reloading from server
 */
export function forcePluginRefresh() {
  console.log('🔄 Force refreshing plugin components');
  window.dispatchEvent(new CustomEvent('pluginsReloaded', {
    detail: { source: 'manual' }
  }));
}

/**
 * Force reload all plugins with current configuration
 * This clears the registry and re-registers all plugins
 */
export async function forceReloadPlugins() {
  const { forceReloadPlugins } = await import('../pluginLoader/configReloader');
  return forceReloadPlugins();
}