import type { WidgetPlugin, WidgetTypeDefinition } from "../../types/widgets";
import { NoteFactory, noteTypeDefinition } from "./factory";
import { NoteRenderer } from "./renderer";

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
