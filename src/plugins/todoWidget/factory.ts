import { getGenericWidgetFactory } from "../../core/GenericWidgetFactory";
import type {
  WidgetCapabilities,
  WidgetCreateData,
  WidgetExportData,
  WidgetFactory,
  WidgetSerializationOptions,
  WidgetValidationResult,
} from "../../types/widgets";
import type { TodoItem, TodoWidget } from "./types";

export class TodoWidgetFactory implements WidgetFactory<TodoWidget> {
  type = "todo";

  canHandle(data: any): boolean {
    // Todo widgets are created manually via UI, not from dropped/pasted data
    // However, we can handle objects that explicitly request a todo widget
    if (typeof data === "object" && data !== null) {
      return data.type === "todo" || data.todo === true;
    }

    // Handle string commands for todo creation
    if (typeof data === "string") {
      const cleanData = data.trim().toLowerCase();
      return (
        cleanData === "todo" ||
        cleanData === "todo list" ||
        cleanData === "checklist"
      );
    }

    return false;
  }

  async create(
    data: any,
    position: { x: number; y: number },
  ): Promise<WidgetCreateData<TodoWidget>> {
    // Initialize todo state
    let items: TodoItem[] = [];
    let title = "Todo List";

    // If data contains initial todo state, use it
    if (typeof data === "object" && data !== null) {
      items = Array.isArray(data.items) ? data.items : [];
      title = data.title || "Todo List";
    }

    // Get default size for todo widget
    const size = this.getDefaultSize();

    // Get default widget data from GenericWidgetFactory
    const genericFactory = getGenericWidgetFactory();
    const defaultData = genericFactory.getDefaultWidgetData(
      "todo",
      position,
      size,
    );

    // Create todo widget data
    const widgetData: WidgetCreateData<TodoWidget> = {
      ...defaultData,
      items,
      title,
      metadata: {
        ...defaultData.metadata,
        todoVersion: "1.0.0",
        createdFrom: typeof data === "string" ? "command" : "object",
        lastUsed: Date.now(),
      },
    } as WidgetCreateData<TodoWidget>;

    return widgetData;
  }

  validate(widget: TodoWidget): WidgetValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate basic widget properties
    if (widget.width <= 0 || widget.height <= 0) {
      errors.push("Todo widget dimensions must be positive");
    }

    // Validate todo-specific properties
    if (typeof widget.title !== "string") {
      errors.push("Title must be a string");
    }

    if (!Array.isArray(widget.items)) {
      errors.push("Items must be an array");
    } else {
      // Validate each todo item
      widget.items.forEach((item, index) => {
        if (typeof item !== "object" || item === null) {
          errors.push(`Item at index ${index} must be an object`);
          return;
        }

        if (typeof item.id !== "string" || item.id.trim() === "") {
          errors.push(`Item at index ${index} must have a valid id`);
        }

        if (typeof item.text !== "string") {
          errors.push(`Item at index ${index} must have text as a string`);
        }

        if (typeof item.completed !== "boolean") {
          errors.push(
            `Item at index ${index} must have completed as a boolean`,
          );
        }

        if (typeof item.createdAt !== "number" || item.createdAt <= 0) {
          errors.push(
            `Item at index ${index} must have a valid createdAt timestamp`,
          );
        }

        if (item.text.length > 500) {
          warnings.push(
            `Item at index ${index} has very long text and may affect performance`,
          );
        }
      });
    }

    // Check for duplicate item IDs
    const itemIds = widget.items.map((item) => item.id);
    const uniqueIds = new Set(itemIds);
    if (itemIds.length !== uniqueIds.size) {
      errors.push("Duplicate item IDs found");
    }

    // Check total number of items
    if (widget.items.length > 100) {
      warnings.push("Todo list has many items and may affect performance");
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  async serialize(
    widget: TodoWidget,
    _options: WidgetSerializationOptions,
  ): Promise<WidgetExportData> {
    return {
      widget: { ...widget },
    };
  }

  async deserialize(data: WidgetExportData): Promise<TodoWidget> {
    return data.widget as TodoWidget;
  }

  getDefaultSize(): { width: number; height: number } {
    return { width: 300, height: 400 };
  }

  getCapabilities(): WidgetCapabilities {
    return {
      canResize: true,
      canRotate: false, // Todo lists should stay upright for usability
      canEdit: false, // Todo state is modified through interaction, not editing
      canConfigure: true, // Could allow title customization, theme options
      canGroup: true,
      canDuplicate: true,
      canExport: true,
      hasContextMenu: true,
      hasToolbar: false, // Todo has its own built-in controls
      hasInspector: true, // Could show statistics like completion rate
    };
  }

  // Helper methods for todo operations
  generateTodoId(): string {
    return `todo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  createTodoItem(text: string): TodoItem {
    return {
      id: this.generateTodoId(),
      text: text.trim(),
      completed: false,
      createdAt: Date.now(),
    };
  }

  // Public utility methods for todo state management
  addTodoItem(widget: TodoWidget, text: string): Partial<TodoWidget> {
    if (!text.trim()) {
      return {};
    }

    const newItem = this.createTodoItem(text);
    return {
      items: [...widget.items, newItem],
    };
  }

  toggleTodoItem(widget: TodoWidget, itemId: string): Partial<TodoWidget> {
    const updatedItems = widget.items.map((item) =>
      item.id === itemId ? { ...item, completed: !item.completed } : item,
    );

    return {
      items: updatedItems,
    };
  }

  deleteTodoItem(widget: TodoWidget, itemId: string): Partial<TodoWidget> {
    const updatedItems = widget.items.filter((item) => item.id !== itemId);

    return {
      items: updatedItems,
    };
  }

  updateTodoText(
    widget: TodoWidget,
    itemId: string,
    newText: string,
  ): Partial<TodoWidget> {
    if (!newText.trim()) {
      return this.deleteTodoItem(widget, itemId);
    }

    const updatedItems = widget.items.map((item) =>
      item.id === itemId ? { ...item, text: newText.trim() } : item,
    );

    return {
      items: updatedItems,
    };
  }

  clearCompletedItems(widget: TodoWidget): Partial<TodoWidget> {
    const updatedItems = widget.items.filter((item) => !item.completed);

    return {
      items: updatedItems,
    };
  }

  getCompletionStats(widget: TodoWidget): {
    completed: number;
    total: number;
    percentage: number;
  } {
    const total = widget.items.length;
    const completed = widget.items.filter((item) => item.completed).length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { completed, total, percentage };
  }
}
