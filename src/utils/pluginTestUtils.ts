/**
 * Utility functions for testing plugin hot reload functionality
 * These can be called from browser console or used in development
 */

import { getWidgetRegistry } from '../core/WidgetRegistry';
import { triggerPluginReload, forceReloadPlugins } from '../hooks/usePluginHotReload';

/**
 * Test the complete plugin hot reload flow
 */
export async function testPluginHotReload() {
  console.log('🧪 Testing plugin hot reload flow...');
  
  // Get initial state
  const registry = getWidgetRegistry();
  const initialStats = registry.getStats();
  const initialTypes = registry.getAllTypes();
  
  console.log('📊 Initial state:');
  console.log('  Registry stats:', initialStats);
  console.log('  Available types:', initialTypes.map(t => t.type));
  
  try {
    // Trigger plugin reload
    console.log('🔄 Triggering plugin reload...');
    await forceReloadPlugins();
    
    // Get final state
    const finalStats = registry.getStats();
    const finalTypes = registry.getAllTypes();
    
    console.log('📊 Final state:');
    console.log('  Registry stats:', finalStats);
    console.log('  Available types:', finalTypes.map(t => t.type));
    
    // Compare
    const statsMatch = JSON.stringify(initialStats) === JSON.stringify(finalStats);
    const typesMatch = initialTypes.length === finalTypes.length;
    
    console.log('✅ Plugin hot reload test completed:');
    console.log('  Stats preserved:', statsMatch);
    console.log('  Types preserved:', typesMatch);
    
    if (statsMatch && typesMatch) {
      console.log('🎉 Plugin hot reload working correctly!');
    } else {
      console.warn('⚠️ Plugin hot reload may have issues');
    }
    
    return { success: true, initialStats, finalStats, initialTypes, finalTypes };
    
  } catch (error) {
    console.error('❌ Plugin hot reload test failed:', error);
    return { success: false, error };
  }
}

/**
 * Monitor plugin reload events for debugging
 */
export function startPluginReloadMonitoring() {
  console.log('👀 Starting plugin reload monitoring...');
  
  const events = ['pluginConfigUpdated', 'pluginsReloaded'];
  
  events.forEach(eventName => {
    window.addEventListener(eventName, (event) => {
      console.log(`📡 Event: ${eventName}`, (event as CustomEvent).detail);
    });
  });
  
  console.log('✅ Plugin reload monitoring active');
  console.log('   Listening for:', events.join(', '));
}

/**
 * Get current plugin system status
 */
export function getPluginSystemStatus() {
  const registry = getWidgetRegistry();
  const stats = registry.getStats();
  const types = registry.getAllTypes();
  
  return {
    timestamp: new Date().toISOString(),
    registryStats: stats,
    availableTypes: types.map(t => ({
      type: t.type,
      name: t.name,
      category: t.category,
      enabled: t.enabled
    })),
    fullyRegisteredTypes: types.filter(t => 
      registry.isTypeFullyRegistered(t.type)
    ).map(t => t.type)
  };
}

// Expose utilities to global scope for console access
if (typeof window !== 'undefined') {
  (window as any).pluginTestUtils = {
    testPluginHotReload,
    startPluginReloadMonitoring,
    getPluginSystemStatus,
    triggerPluginReload,
    forceReloadPlugins
  };
  
  console.log('🛠️ Plugin test utilities available at window.pluginTestUtils');
}