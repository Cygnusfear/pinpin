import type { WidgetPlugin, WidgetTypeDefinition } from "../../types/widgets";
import { ChatFactory, chatTypeDefinition } from "./factory";
import { ChatRenderer } from "./renderer";

export class ChatPlugin implements WidgetPlugin {
  id = chatTypeDefinition[0].type;
  name = chatTypeDefinition[0].name;
  version = "2.0.0";
  description = chatTypeDefinition[0].description;
  author = "Pinboard Team";

  types: WidgetTypeDefinition[] = chatTypeDefinition;
  factories = [new ChatFactory()];
  
  get renderers() {
    return [{ 
      type: "chat", 
      component: ChatRenderer
    }];
  }

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
export const chatPlugin = new ChatPlugin();
