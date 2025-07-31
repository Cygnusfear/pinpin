import type {
  WidgetRegistry as IWidgetRegistry,
  WidgetFactory,
  WidgetRenderer,
  WidgetTypeDefinition,
} from "../types/widgets";

// ============================================================================
// WIDGET REGISTRY - SIMPLIFIED IMPLEMENTATION
// ============================================================================

/**
 * Clean, simplified widget registry implementation
 * Manages widget types, factories, and renderers in a unified way
 */
export class WidgetRegistry implements IWidgetRegistry {
  private types = new Map<string, WidgetTypeDefinition>();
  private factories = new Map<string, WidgetFactory>();
  private renderers = new Map<string, WidgetRenderer>();

  // ============================================================================
  // TYPE REGISTRATION
  // ============================================================================

  registerType(definition: WidgetTypeDefinition): void {
    if (this.types.has(definition.type)) {
      console.warn(`Widget type "${definition.type}" is already registered`);
    }

    this.types.set(definition.type, definition);
  }

  unregisterType(type: string): void {
    if (!this.types.has(type)) {
      console.warn(`Widget type "${type}" is not registered`);
      return;
    }

    this.types.delete(type);
    console.log(`❌ Unregistered widget type: ${type}`);
  }

  getType(type: string): WidgetTypeDefinition | undefined {
    return this.types.get(type);
  }

  getAllTypes(): WidgetTypeDefinition[] {
    return Array.from(this.types.values());
  }

  getTypesByCategory(category: string): WidgetTypeDefinition[] {
    return Array.from(this.types.values()).filter(
      (type) => type.category === category,
    );
  }

  // ============================================================================
  // FACTORY REGISTRATION
  // ============================================================================

  registerFactory<T>(factory: WidgetFactory<T>): void {
    if (this.factories.has(factory.type)) {
      console.warn(
        `Factory for widget type "${factory.type}" is already registered`,
      );
    }

    this.factories.set(factory.type, factory as WidgetFactory);
  }

  unregisterFactory(type: string): void {
    if (!this.factories.has(type)) {
      console.warn(`Factory for widget type "${type}" is not registered`);
      return;
    }

    this.factories.delete(type);
    console.log(`❌ Unregistered factory: ${type}`);
  }

  getFactory<T>(type: string): WidgetFactory<T> | undefined {
    return this.factories.get(type) as WidgetFactory<T> | undefined;
  }

  // ============================================================================
  // RENDERER REGISTRATION
  // ============================================================================

  registerRenderer<T>(renderer: WidgetRenderer<T>): void {
    if (this.renderers.has(renderer.type)) {
      console.warn(
        `Renderer for widget type "${renderer.type}" is already registered`,
      );
    }

    this.renderers.set(renderer.type, renderer as WidgetRenderer);
  }

  unregisterRenderer(type: string): void {
    if (!this.renderers.has(type)) {
      console.warn(`Renderer for widget type "${type}" is not registered`);
      return;
    }

    this.renderers.delete(type);
    console.log(`❌ Unregistered renderer: ${type}`);
  }

  getRenderer<T>(type: string): WidgetRenderer<T> | undefined {
    return this.renderers.get(type) as WidgetRenderer<T> | undefined;
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Get all registered widget types
   */
  getRegisteredTypes(): string[] {
    return Array.from(this.types.keys());
  }

  /**
   * Check if a widget type is fully registered (has type, factory, and renderer)
   */
  isTypeFullyRegistered(type: string): boolean {
    return (
      this.types.has(type) &&
      this.factories.has(type) &&
      this.renderers.has(type)
    );
  }

  /**
   * Get registration status for a widget type
   */
  getRegistrationStatus(type: string) {
    return {
      hasType: this.types.has(type),
      hasFactory: this.factories.has(type),
      hasRenderer: this.renderers.has(type),
      isFullyRegistered: this.isTypeFullyRegistered(type),
    };
  }

  /**
   * Clear all registrations
   */
  clear(): void {
    this.types.clear();
    this.factories.clear();
    this.renderers.clear();
    console.log("🧹 Cleared all widget registrations");
  }

  /**
   * Get registry statistics
   */
  getStats() {
    const typeCount = this.types.size;
    const factoryCount = this.factories.size;
    const rendererCount = this.renderers.size;
    const fullyRegistered = Array.from(this.types.keys()).filter((type) =>
      this.isTypeFullyRegistered(type),
    ).length;

    return {
      types: typeCount,
      factories: factoryCount,
      renderers: rendererCount,
      fullyRegistered,
      registrationRate: typeCount > 0 ? (fullyRegistered / typeCount) * 100 : 0,
    };
  }
}

// ============================================================================
// GLOBAL REGISTRY INSTANCE
// ============================================================================

let globalRegistry: WidgetRegistry | null = null;

/**
 * Get the global widget registry instance
 */
export function getWidgetRegistry(): WidgetRegistry {
  if (!globalRegistry) {
    globalRegistry = new WidgetRegistry();
  }
  return globalRegistry;
}

/**
 * Reset the global widget registry (useful for testing)
 */
export function resetWidgetRegistry(): void {
  globalRegistry = null;
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Register a complete widget plugin with type, factory, and renderer
 */
export function registerWidget<T>(
  type: WidgetTypeDefinition,
  factory: WidgetFactory<T>,
  renderer: WidgetRenderer<T>,
): void {
  const registry = getWidgetRegistry();

  registry.registerType(type);
  registry.registerFactory(factory);
  registry.registerRenderer(renderer);

  console.log(`🎯 Fully registered widget: ${type.type}`);
}

/**
 * Unregister a complete widget by type
 */
export function unregisterWidget(type: string): void {
  const registry = getWidgetRegistry();

  registry.unregisterType(type);
  registry.unregisterFactory(type);
  registry.unregisterRenderer(type);

  console.log(`🗑️ Fully unregistered widget: ${type}`);
}

/**
 * Check if a widget type can be created (has factory)
 */
export function canCreateWidget(type: string): boolean {
  const registry = getWidgetRegistry();
  return registry.getFactory(type) !== undefined;
}

/**
 * Check if a widget type can be rendered (has renderer)
 */
export function canRenderWidget(type: string): boolean {
  const registry = getWidgetRegistry();
  return registry.getRenderer(type) !== undefined;
}
