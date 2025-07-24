import type {
  CreateWidgetInput,
  HydratedWidget,
  Position,
  WidgetCapabilities,
  WidgetFactory,
} from "../../types/widgets";
import type { TodoContent } from "./types";

export class TodoFactory implements WidgetFactory<TodoContent> {
  type = "todo";

  canHandle(data: any): boolean {
    // Handle explicit todo requests
    if (data?.type === "todo" || data?.todo === true) {
      return true;
    }

    // Handle checklist-like text
    if (typeof data === "string") {
      const lines = data.split("\n");
      const hasCheckboxes = lines.some(
        (line) =>
          /^\s*[-*]\s*\[[\sx]\]/i.test(line) || /^\s*\d+\.\s/.test(line),
      );
      return hasCheckboxes;
    }

    return false;
  }

  getDemoDefaults(): any {
    return {
      type: "todo",
      items: [],
      title: "Todo List",
    };
  }

  async create(data: any, position: Position): Promise<CreateWidgetInput> {
    let title = "Todo List";
    let items: TodoContent["items"] = [];

    if (typeof data === "string" && this.canHandle(data)) {
      const lines = data.split("\n").filter((line) => line.trim());
      title = lines[0]?.replace(/^\s*[-*]\s*\[[\sx]\]\s*/i, "") || "Todo List";

      items = lines.slice(1).map((line, index) => ({
        id: `item-${Date.now()}-${index}`,
        text: line.replace(/^\s*[-*]\s*\[[\sx]\]\s*/i, "").trim(),
        completed: /\[x\]/i.test(line),
        createdAt: Date.now(),
      }));
    } else if (data?.title || data?.items) {
      title = data.title || "Todo List";
      items = data.items || [];
    }

    const content: TodoContent = {
      title,
      items,
    };

    return {
      type: this.type,
      x: position.x,
      y: position.y,
      width: 280,
      height: 320,
      content,
    };
  }

  getDefaultSize(): { width: number; height: number } {
    return { width: 280, height: 320 };
  }

  getCapabilities(): WidgetCapabilities {
    return {
      canResize: true,
      canRotate: false,
      canEdit: true,
      canConfigure: true,
      canGroup: true,
      canDuplicate: true,
      canExport: true,
      hasContextMenu: true,
      hasToolbar: true,
      hasInspector: true,
    };
  }

  validate(widget: HydratedWidget<TodoContent>) {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!widget.content || !widget.content.data) {
      errors.push("Todo content is missing");
    } else {
      const data = widget.content.data;
      if (typeof data.title !== "string") {
        errors.push("Todo title must be a string");
      }
      if (!Array.isArray(data.items)) {
        errors.push("Todo items must be an array");
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }
}
