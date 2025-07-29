import type { WidgetPlugin } from "../../types/widgets";
import { ImageFactory, imageTypeDefinition } from "./factory";
import { ImageRenderer } from "./renderer";

// ============================================================================
// IMAGE WIDGET PLUGIN - CLEAN IMPLEMENTATION
// ============================================================================

export class ImagePlugin implements WidgetPlugin {
  id = "image";
  name = "Image Widget";
  version = "1.0.0";
  description =
    "A widget for displaying and managing images with filters and effects";
  author = "Pinboard Team";

  types: WidgetTypeDefinition[] = imageTypeDefinition;

  factories = [new ImageFactory()];
  renderers = [{ type: "image", component: ImageRenderer }];

  async install(registry: any): Promise<void> {
    // Register type definition
    this.types.forEach((type) => registry.registerType(type));

    // Register factory
    this.factories.forEach((factory) => registry.registerFactory(factory));

    // Register renderer
    this.renderers.forEach((renderer) => registry.registerRenderer(renderer));

    console.log(`✅ Installed ${this.name} v${this.version}`);
  }

  async uninstall(registry: any): Promise<void> {
    // Unregister in reverse order
    this.renderers.forEach((renderer) =>
      registry.unregisterRenderer(renderer.type),
    );
    this.factories.forEach((factory) =>
      registry.unregisterFactory(factory.type),
    );
    this.types.forEach((type) => registry.unregisterType(type.type));

    console.log(`❌ Uninstalled ${this.name}`);
  }
}

// Export plugin instance
export const imagePlugin = new ImagePlugin();

// Export individual components for flexibility
export { ImageFactory } from "./factory";
export { ImageRenderer } from "./renderer";
