import type { WidgetPlugin, WidgetTypeDefinition } from "../../types/widgets";
import { ChatFactory } from "./factory";
import { ChatRenderer } from "./renderer";

export const chatTypeDefinition: WidgetTypeDefinition[] = [
  {
    type: "chat",
    name: "AI Chat",
    description: "WhatsApp-style floating chat interface",
    icon: "💬",
    category: "app",
    defaultSize: { width: 320, height: 50 },
    minSize: { width: 250, height: 40 },
    maxSize: { width: 500, height: 70 },
    aspectRatioLocked: false,
    resizable: true,
    rotatable: false,
    configurable: true,
    autoCreateOnly: false,
    allowOverflow: true,
  },
];

export class ChatPlugin implements WidgetPlugin {
  id = "chat";
  name = "AI Chat";
  version = "1.0.0";
  description = "Interactive chat widget for conversing with Claude AI";
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
