import type { WidgetPlugin, WidgetTypeDefinition } from "../../types/widgets";
import { YouTubeFactory } from "./factory";
import { YouTubeRenderer } from "./renderer";

export const youTubeTypeDefinition: WidgetTypeDefinition[] = [
  {
    type: "youtube",
    name: "YouTube Player",
    description:
      "Synchronized YouTube video player with real-time position sharing",
    icon: "/icons/youtube.svg",
    category: "media",
    defaultSize: { width: 560, height: 315 },
    minSize: { width: 320, height: 180 },
    maxSize: { width: 1280, height: 720 },
    aspectRatioLocked: true,
    resizable: true,
    rotatable: false,
    configurable: true,
    autoCreateOnly: false,
  },
];

export class YouTubePlugin implements WidgetPlugin {
  id = "youtube";
  name = "YouTube Player";
  version = "1.0.0";
  description =
    "Synchronized YouTube video player with real-time position sharing";
  author = "Pinboard Team";

  types: WidgetTypeDefinition[] = youTubeTypeDefinition;
  factories = [new YouTubeFactory()];
  renderers = [{ type: "youtube", component: YouTubeRenderer }];

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
export const youTubePlugin = new YouTubePlugin();

// Export individual components for flexibility
export { YouTubeFactory } from "./factory";
export { YouTubeRenderer } from "./renderer";
