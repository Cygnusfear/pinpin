import type { WidgetPlugin, WidgetTypeDefinition } from "../../types/widgets";
import { TodoWidgetFactory } from "./factory";
import { TodoWidgetRenderer } from "./renderer";

export class TodoWidgetPlugin implements WidgetPlugin {
  id = "todo-widget";
  name = "Todo Widget";
  version = "1.0.0";
  description =
    "A fully functional todo list widget with add, complete, and delete functionality";
  author = "Pinboard Team";

  types: WidgetTypeDefinition[] = [
    {
      type: "todo",
      name: "Todo List",
      description: "A todo list for managing tasks and checklists",
      icon: "✅",
      category: "app",
      defaultSize: { width: 300, height: 400 },
      minSize: { width: 250, height: 300 },
      maxSize: { width: 500, height: 800 },
      aspectRatioLocked: false,
      resizable: true,
      rotatable: false, // Todo lists should stay upright for usability
      configurable: true,
    },
  ];

  factories = [new TodoWidgetFactory()];

  renderers = [
    {
      type: "todo",
      component: TodoWidgetRenderer,
    },
  ];

  async install(): Promise<void> {
    console.log(`Installing ${this.name} v${this.version}...`);
  }

  async uninstall(): Promise<void> {
    console.log(`Uninstalling ${this.name}...`);
  }
}

// Export plugin instance and components
export const todoWidgetPlugin = new TodoWidgetPlugin();
export { TodoWidgetFactory } from "./factory";
export { TodoWidgetRenderer } from "./renderer";
export type { TodoItem, TodoWidget, TodoWidgetCreateData } from "./types";
