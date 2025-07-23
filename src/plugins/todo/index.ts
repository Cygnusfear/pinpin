import type {
  WidgetPlugin,
  WidgetTypeDefinition,
} from "../../types/widgets";
import { TodoFactory } from "./factory";
import { TodoRenderer } from "./renderer";

export const todoTypeDefinition: WidgetTypeDefinition[] = [
    {
      type: "todo",
      name: "Todo List",
      description: "A todo list for task management",
      icon: "✅",
      category: "app",
      defaultSize: { width: 280, height: 320 },
      minSize: { width: 220, height: 250 },
      maxSize: { width: 400, height: 600 },
      aspectRatioLocked: false,
      resizable: true,
      rotatable: false,
      configurable: true,
    },
  ];

export class TodoPlugin implements WidgetPlugin {
  id = "todo";
  name = "Todo Widget";
  version = "1.0.0";
  description = "A todo list widget for task management";
  author = "Pinboard Team";

  types: WidgetTypeDefinition[] = todoTypeDefinition;

  factories = [new TodoFactory()];
  renderers = [{ type: "todo", component: TodoRenderer }];

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
export const todoPlugin = new TodoPlugin();

// Export individual components for flexibility
export { TodoFactory } from "./factory";
export { TodoRenderer } from "./renderer";