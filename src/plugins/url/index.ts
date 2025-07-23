import type {
  WidgetPlugin,
  WidgetTypeDefinition,
} from "../../types/widgets";
import { UrlFactory } from "./factory";
import { UrlRenderer } from "./renderer";

// ============================================================================
// URL WIDGET PLUGIN - CLEAN IMPLEMENTATION
// ============================================================================

export const urlTypeDefinition: WidgetTypeDefinition[] = [{
  type: "url",
  name: "URL Link",
  description: "Display web links with previews and metadata",
  icon: "🔗",
  category: "web",
  defaultSize: { width: 320, height: 180 },
  minSize: { width: 200, height: 120 },
  maxSize: { width: 600, height: 400 },
  aspectRatioLocked: false,
  resizable: true,
  rotatable: false,
  configurable: true,
}];

export class UrlPlugin implements WidgetPlugin {
  id = "url";
  name = "URL Widget";
  version = "1.0.0";
  description = "A widget for displaying web links with previews and metadata";
  author = "Pinboard Team";

  types: WidgetTypeDefinition[] = urlTypeDefinition;

  factories = [new UrlFactory()];
  renderers = [{ type: "url", component: UrlRenderer }];

  async install(registry: any): Promise<void> {
    // Register type definition
    this.types.forEach(type => registry.registerType(type));
    
    // Register factory
    this.factories.forEach(factory => registry.registerFactory(factory));
    
    // Register renderer
    this.renderers.forEach(renderer => registry.registerRenderer(renderer));
    
    console.log(`✅ Installed ${this.name} v${this.version}`);
  }

  async uninstall(registry: any): Promise<void> {
    // Unregister in reverse order
    this.renderers.forEach(renderer => registry.unregisterRenderer(renderer.type));
    this.factories.forEach(factory => registry.unregisterFactory(factory.type));
    this.types.forEach(type => registry.unregisterType(type.type));
    
    console.log(`❌ Uninstalled ${this.name}`);
  }
}

// Export plugin instance
export const urlPlugin = new UrlPlugin();

// Export individual components for flexibility
export { UrlFactory } from "./factory";
export { UrlRenderer } from "./renderer";