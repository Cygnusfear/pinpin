import type { WidgetPlugin, WidgetTypeDefinition } from "../../types/widgets";
import { NoteFactory } from "./factory";
import { NoteRenderer } from "./renderer";

export const noteTypeDefinition: WidgetTypeDefinition[] = [
  {
    type: "note",
    name: "Note",
    description: "A simple sticky note for text content",
    icon: "📝",
    category: "text",
    defaultSize: { width: 200, height: 200 },
    minSize: { width: 150, height: 100 },
    maxSize: { width: 500, height: 400 },
    aspectRatioLocked: false,
    resizable: true,
    rotatable: true,
    configurable: true,
    autoCreateOnly: false,
  },
];

export class NotePlugin implements WidgetPlugin {
  id = "note";
  name = "Note Widget";
  version = "1.0.0";
  description = "A simple sticky note widget for text content";
  author = "Pinboard Team";

  types: WidgetTypeDefinition[] = noteTypeDefinition;

  factories = [new NoteFactory()];
  renderers = [{ type: "note", component: NoteRenderer }];

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
export const notePlugin = new NotePlugin();

// Export individual components for flexibility
export { NoteFactory } from "./factory";
export { NoteRenderer } from "./renderer";
