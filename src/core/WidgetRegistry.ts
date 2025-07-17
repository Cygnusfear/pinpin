import { 
  WidgetRegistry as IWidgetRegistry,
  WidgetTypeDefinition,
  WidgetFactory,
  WidgetRenderer,
  Widget,
  WidgetPlugin
} from '../types/widgets';

export class WidgetRegistry implements IWidgetRegistry {
  private types = new Map<string, WidgetTypeDefinition>();
  private factories = new Map<string, WidgetFactory>();
  private renderers = new Map<string, WidgetRenderer>();
  private plugins = new Map<string, WidgetPlugin>();

  // Type management
  registerType(definition: WidgetTypeDefinition): void {
    if (this.types.has(definition.type)) {
      console.warn(`Widget type '${definition.type}' is already registered. Overwriting.`);
    }
    this.types.set(definition.type, definition);
  }

  unregisterType(type: string): void {
    this.types.delete(type);
    this.factories.delete(type);
    this.renderers.delete(type);
  }

  getType(type: string): WidgetTypeDefinition | undefined {
    return this.types.get(type);
  }

  getAllTypes(): WidgetTypeDefinition[] {
    return Array.from(this.types.values());
  }

  getTypesByCategory(category: string): WidgetTypeDefinition[] {
    return Array.from(this.types.values()).filter(type => type.category === category);
  }

  // Factory management
  registerFactory<T extends Widget>(factory: WidgetFactory<T>): void {
    if (this.factories.has(factory.type)) {
      console.warn(`Widget factory for type '${factory.type}' is already registered. Overwriting.`);
    }
    this.factories.set(factory.type, factory as WidgetFactory);
  }

  unregisterFactory(type: string): void {
    this.factories.delete(type);
  }

  getFactory<T extends Widget>(type: string): WidgetFactory<T> | undefined {
    return this.factories.get(type) as WidgetFactory<T> | undefined;
  }

  // Renderer management
  registerRenderer<T extends Widget>(renderer: WidgetRenderer<T>): void {
    if (this.renderers.has(renderer.type)) {
      console.warn(`Widget renderer for type '${renderer.type}' is already registered. Overwriting.`);
    }
    this.renderers.set(renderer.type, renderer as WidgetRenderer);
  }

  unregisterRenderer(type: string): void {
    this.renderers.delete(type);
  }

  getRenderer<T extends Widget>(type: string): WidgetRenderer<T> | undefined {
    return this.renderers.get(type) as WidgetRenderer<T> | undefined;
  }

  // Plugin management
  async installPlugin(plugin: WidgetPlugin): Promise<void> {
    if (this.plugins.has(plugin.id)) {
      throw new Error(`Plugin '${plugin.id}' is already installed`);
    }

    try {
      // Register types
      if (plugin.types) {
        plugin.types.forEach(type => this.registerType(type));
      }

      // Register factories
      if (plugin.factories) {
        plugin.factories.forEach(factory => this.registerFactory(factory));
      }

      // Register renderers
      if (plugin.renderers) {
        plugin.renderers.forEach(renderer => this.registerRenderer(renderer));
      }

      // Call plugin install hook
      await plugin.install(this);

      this.plugins.set(plugin.id, plugin);
      console.log(`Plugin '${plugin.name}' v${plugin.version} installed successfully`);
    } catch (error) {
      console.error(`Failed to install plugin '${plugin.name}':`, error);
      throw error;
    }
  }

  async uninstallPlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin '${pluginId}' is not installed`);
    }

    try {
      // Call plugin uninstall hook
      await plugin.uninstall(this);

      // Unregister types
      if (plugin.types) {
        plugin.types.forEach(type => this.unregisterType(type.type));
      }

      this.plugins.delete(pluginId);
      console.log(`Plugin '${plugin.name}' uninstalled successfully`);
    } catch (error) {
      console.error(`Failed to uninstall plugin '${plugin.name}':`, error);
      throw error;
    }
  }

  getInstalledPlugins(): WidgetPlugin[] {
    return Array.from(this.plugins.values());
  }

  getPlugin(pluginId: string): WidgetPlugin | undefined {
    return this.plugins.get(pluginId);
  }

  // Utility methods
  canHandleData(data: any): string[] {
    const supportedTypes: string[] = [];
    
    for (const [type, factory] of this.factories) {
      if (factory.canHandle(data)) {
        supportedTypes.push(type);
      }
    }
    
    return supportedTypes;
  }

  async createWidget(
    type: string, 
    data: any, 
    position: { x: number; y: number }
  ): Promise<Widget | null> {
    const factory = this.getFactory(type);
    if (!factory) {
      console.error(`No factory found for widget type: ${type}`);
      return null;
    }

    try {
      const widgetData = await factory.create(data, position);
      
      // Add required fields
      const widget: Widget = {
        ...widgetData,
        id: this.generateWidgetId(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        selected: false,
        zIndex: Date.now(), // Simple z-index based on creation time
      } as Widget;

      // Validate the widget
      const validation = factory.validate(widget);
      if (!validation.isValid) {
        console.error(`Widget validation failed:`, validation.errors);
        return null;
      }

      return widget;
    } catch (error) {
      console.error(`Failed to create widget of type '${type}':`, error);
      return null;
    }
  }

  private generateWidgetId(): string {
    return `widget-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Debug and inspection methods
  getRegistryStats(): {
    types: number;
    factories: number;
    renderers: number;
    plugins: number;
  } {
    return {
      types: this.types.size,
      factories: this.factories.size,
      renderers: this.renderers.size,
      plugins: this.plugins.size,
    };
  }

  validateRegistry(): {
    isValid: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    // Check that all types have corresponding factories and renderers
    for (const type of this.types.keys()) {
      if (!this.factories.has(type)) {
        issues.push(`Type '${type}' has no factory`);
      }
      if (!this.renderers.has(type)) {
        issues.push(`Type '${type}' has no renderer`);
      }
    }

    // Check for orphaned factories
    for (const type of this.factories.keys()) {
      if (!this.types.has(type)) {
        issues.push(`Factory for type '${type}' has no type definition`);
      }
    }

    // Check for orphaned renderers
    for (const type of this.renderers.keys()) {
      if (!this.types.has(type)) {
        issues.push(`Renderer for type '${type}' has no type definition`);
      }
    }

    return {
      isValid: issues.length === 0,
      issues,
    };
  }

  // Export/import registry state
  exportRegistry(): {
    types: WidgetTypeDefinition[];
    plugins: Array<{ id: string; name: string; version: string }>;
  } {
    return {
      types: this.getAllTypes(),
      plugins: this.getInstalledPlugins().map(p => ({
        id: p.id,
        name: p.name,
        version: p.version,
      })),
    };
  }

  // Clear all registrations (useful for testing)
  clear(): void {
    this.types.clear();
    this.factories.clear();
    this.renderers.clear();
    this.plugins.clear();
  }
}

// Global registry instance
export const widgetRegistry = new WidgetRegistry();

// Helper function to get the global registry
export function getWidgetRegistry(): WidgetRegistry {
  return widgetRegistry;
}