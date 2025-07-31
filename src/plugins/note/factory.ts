import type {
  CreateWidgetInput,
  HydratedWidget,
  Position,
  WidgetCapabilities,
  WidgetFactory,
  WidgetTypeDefinition,
} from "../../types/widgets";
import type { NoteContent } from "./types";

// Type definition moved here to avoid circular dependency
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

export class NoteFactory implements WidgetFactory<NoteContent> {
  type = "note";

  canHandle(data: any): boolean {
    // Handle explicit note requests
    if (data?.type === "note" || data?.note === true) {
      return true;
    }

    // Handle plain text
    if (typeof data === "string" && data.trim().length > 0) {
      // Don't handle URLs or math expressions (let other widgets handle those)
      const isUrl = /^https?:\/\//.test(data.trim());
      const isMath = /^[\d+\-*\/\(\)\.\s]+$/.test(data.trim());
      return !isUrl && !isMath;
    }

    return false;
  }

  getDemoDefaults(): any {
    return {
      type: "note",
      content: "New note",
    };
  }

  async create(data: any, position: Position): Promise<CreateWidgetInput> {
    let content = "";

    if (typeof data === "string") {
      content = data.trim();
    } else if (data?.content) {
      content = data.content;
    }

    const noteContent: NoteContent = {
      content,
      backgroundColor: "#fef3c7", // Light yellow like sticky note
      textColor: "#1f2937",
      fontSize: 14,
      fontFamily: "system-ui, sans-serif",
      textAlign: "left",
      formatting: {
        bold: false,
        italic: false,
        underline: false,
      },
    };

    return {
      type: this.type,
      x: position.x,
      y: position.y,
      width: 200,
      height: 200,
      content: noteContent,
    };
  }

  getDefaultSize(): { width: number; height: number } {
    return noteTypeDefinition[0].defaultSize;
  }

  getCapabilities(): WidgetCapabilities {
    return {
      canResize: true,
      canRotate: true,
      canEdit: true,
      canConfigure: true,
      canGroup: true,
      canDuplicate: false,
      canExport: true,
      hasContextMenu: true,
      hasToolbar: true,
      hasInspector: true,
    };
  }

  validate(widget: HydratedWidget<NoteContent>) {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!widget.content || !widget.content.data) {
      errors.push("Note content is missing");
    } else {
      const data = widget.content.data;
      if (typeof data.content !== "string") {
        errors.push("Note content must be a string");
      }
      if (typeof data.backgroundColor !== "string") {
        errors.push("Background color must be a string");
      }
      if (typeof data.textColor !== "string") {
        errors.push("Text color must be a string");
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }
}
