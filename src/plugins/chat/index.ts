import type { WidgetPlugin, WidgetTypeDefinition } from "../../types/widgets";
import { ChatFactory } from "./factory";
import { ChatRenderer } from "./renderer";

export const chatTypeDefinition: WidgetTypeDefinition[] = [
  {
    type: "chat",
    name: "AI Chat",
    description: "WhatsApp-style chat interface",
    icon: "💬",
    category: "app",
    defaultSize: { width: 400, height: 600 },
    minSize: { width: 300, height: 600 },
    maxSize: { width: 800, height: 800 },
    aspectRatioLocked: false,
    resizable: true,
    rotatable: false,
    configurable: true,
    autoCreateOnly: false,
    allowOverflow: false,
    allowSelection: true
  },
];

export class ChatPlugin implements WidgetPlugin {
  id = chatTypeDefinition[0].type;
  name = chatTypeDefinition[0].name;
  version = "1.0.0";
  description = chatTypeDefinition[0].description;
  author = "Pinboard Team";

  types: WidgetTypeDefinition[] = chatTypeDefinition;
  factories = [new ChatFactory()];
  renderers = [{ type: "chat", component: ChatRenderer }];

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

// Export individual components for flexibility
export { ChatFactory } from "./factory";
export { ChatRenderer } from "./renderer";
export type { ChatContent, ChatMessage } from "./types";
