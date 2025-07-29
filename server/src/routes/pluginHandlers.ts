/**
 * Plugin Configuration Handlers
 * 
 * Serves plugin configuration from the filesystem to avoid
 * static imports and enable dynamic plugin loading
 */

import { Request, Response } from 'express';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const PLUGINS_CONFIG_PATH = join(process.cwd(), '../src/plugins/plugins.json');

export interface PluginConfig {
  name: string;
  path: string;
  enabled: boolean;
}

export interface PluginsConfiguration {
  plugins: PluginConfig[];
}

/**
 * Get plugin configuration
 */
export const getPluginConfigHandler = async (req: Request, res: Response) => {
  try {
    console.log('📋 Reading plugin configuration from:', PLUGINS_CONFIG_PATH);
    
    if (!existsSync(PLUGINS_CONFIG_PATH)) {
      console.warn('⚠️ Plugin configuration file not found, creating default');
      
      const defaultConfig: PluginsConfiguration = {
        plugins: [
          { name: 'calculator', path: './calculator', enabled: true },
          { name: 'chat', path: './chat', enabled: true },
          { name: 'note', path: './note', enabled: true },
          { name: 'todo', path: './todo', enabled: true },
          { name: 'image', path: './image', enabled: true },
          { name: 'terminal', path: './terminal', enabled: true },
          { name: 'youtube', path: './youtube', enabled: true },
          { name: 'url', path: './url', enabled: true },
          { name: 'document', path: './document', enabled: true },
          { name: 'drawing', path: './drawing', enabled: true },
        ]
      };
      
      writeFileSync(PLUGINS_CONFIG_PATH, JSON.stringify(defaultConfig, null, 2));
      return res.json(defaultConfig);
    }
    
    const configData = readFileSync(PLUGINS_CONFIG_PATH, 'utf-8');
    const config: PluginsConfiguration = JSON.parse(configData);
    
    console.log(`✅ Loaded ${config.plugins.length} plugins from configuration`);
    
    res.json(config);
    
  } catch (error) {
    console.error('❌ Error reading plugin configuration:', error);
    res.status(500).json({
      error: 'Failed to read plugin configuration',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Update plugin configuration
 */
export const updatePluginConfigHandler = async (req: Request, res: Response) => {
  try {
    const config: PluginsConfiguration = req.body;
    
    // Validate the configuration
    if (!config.plugins || !Array.isArray(config.plugins)) {
      return res.status(400).json({
        error: 'Invalid configuration format',
        message: 'Configuration must have a plugins array'
      });
    }
    
    // Validate each plugin entry
    for (const plugin of config.plugins) {
      if (!plugin.name || !plugin.path || typeof plugin.enabled !== 'boolean') {
        return res.status(400).json({
          error: 'Invalid plugin entry',
          message: 'Each plugin must have name, path, and enabled properties'
        });
      }
    }
    
    console.log(`📝 Updating plugin configuration with ${config.plugins.length} plugins`);
    
    // Write the configuration
    writeFileSync(PLUGINS_CONFIG_PATH, JSON.stringify(config, null, 2));
    
    console.log('✅ Plugin configuration updated successfully');
    
    res.json({
      success: true,
      message: 'Plugin configuration updated',
      pluginCount: config.plugins.length
    });
    
  } catch (error) {
    console.error('❌ Error updating plugin configuration:', error);
    res.status(500).json({
      error: 'Failed to update plugin configuration',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Get enabled plugins only
 */
export const getEnabledPluginsHandler = async (req: Request, res: Response) => {
  try {
    const configData = readFileSync(PLUGINS_CONFIG_PATH, 'utf-8');
    const config: PluginsConfiguration = JSON.parse(configData);
    
    const enabledPlugins = config.plugins.filter(plugin => plugin.enabled);
    
    console.log(`📋 Found ${enabledPlugins.length} enabled plugins out of ${config.plugins.length} total`);
    
    res.json({
      plugins: enabledPlugins,
      total: config.plugins.length,
      enabled: enabledPlugins.length
    });
    
  } catch (error) {
    console.error('❌ Error reading enabled plugins:', error);
    res.status(500).json({
      error: 'Failed to read enabled plugins',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};