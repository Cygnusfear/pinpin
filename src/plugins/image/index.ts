import type { WidgetPlugin, WidgetTypeDefinition } from "../../types/widgets";
import { ImageFactory } from "./factory";
import { ImageRenderer } from "./renderer";

// ============================================================================
// IMAGE WIDGET PLUGIN - CLEAN IMPLEMENTATION
// ============================================================================

export const imageTypeDefinition: WidgetTypeDefinition[] = [
  {
    type: "image",
    name: "Image",
    description: "Display and manage images with filters and effects",
    icon: "🖼️",
    category: "media",
    defaultSize: { width: 50, height: 200 },
    minSize: { width: 50, height: 200 },
    maxSize: { width: 800, height: 800 },
    aspectRatioLocked: false,
    resizable: true,
    rotatable: true,
    configurable: true,
    supportedMimeTypes: [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "image/svg+xml",
    ],
    supportedExtensions: [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"],
    autoCreateOnly: true,
  },
];

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
