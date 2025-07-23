import { getGenericWidgetFactory } from "../../core/GenericWidgetFactory";
import type {
  WidgetCapabilities,
  WidgetCreateData,
  WidgetExportData,
  WidgetFactory,
  WidgetSerializationOptions,
  WidgetValidationResult,
} from "../../types/widgets";
import type { NoteWidget } from "./types";

export class NoteWidgetFactory implements WidgetFactory<NoteWidget> {
  type = "note";

  private readonly defaultColors = [
    "#FFF740", // Yellow
    "#FF7043", // Orange
    "#66BB6A", // Green
    "#42A5F5", // Blue
    "#AB47BC", // Purple
    "#EF5350", // Red
    "#26A69A", // Teal
    "#FFEE58", // Light Yellow
  ];

  canHandle(data: any): boolean {
    // Don't handle File objects - those should go to DocumentWidgetFactory
    if (data instanceof File) {
      return false;
    }

    // Handle plain text strings only
    if (typeof data === "string" && data.trim().length > 0) {
      // Don't handle URLs - those should go to UrlWidgetFactory
      try {
        new URL(data.trim());
        return false; // This is a URL, not plain text
      } catch {
        // Not a URL, this is plain text
        return true;
      }
    }

    // Handle objects with text content (but not File objects)
    if (typeof data === "object" && data !== null && !(data instanceof File)) {
      return "text" in data || "content" in data || "note" in data;
    }

    return false;
  }

  async create(
    data: any,
    position: { x: number; y: number },
  ): Promise<WidgetCreateData<NoteWidget>> {
    let content: string;
    let backgroundColor: string;
    let textColor: string;
    let fontSize: number;
    let fontFamily: string;
    let textAlign: "left" | "center" | "right";

    if (typeof data === "string") {
      content = data.trim();
      backgroundColor = this.getRandomColor();
      textColor = this.getContrastingTextColor(backgroundColor);
      fontSize = 14;
      fontFamily = "Inter, system-ui, sans-serif";
      textAlign = "left";
    } else if (typeof data === "object") {
      content = data.text || data.content || data.note || "";
      backgroundColor = data.backgroundColor || this.getRandomColor();
      textColor =
        data.textColor || this.getContrastingTextColor(backgroundColor);
      fontSize = data.fontSize || 14;
      fontFamily = data.fontFamily || "Inter, system-ui, sans-serif";
      textAlign = data.textAlign || "left";
    } else {
      throw new Error("Invalid note data provided");
    }

    // Calculate size based on content length
    const size = this.calculateNoteSize(content);

    // Get default widget data from GenericWidgetFactory
    const genericFactory = getGenericWidgetFactory();
    const defaultData = genericFactory.getDefaultWidgetData(
      "note",
      position,
      size,
    );

    // Merge with note-specific data
    const widgetData: WidgetCreateData<NoteWidget> = {
      ...defaultData,
      content,
      backgroundColor,
      textColor,
      fontSize,
      fontFamily,
      textAlign,
      formatting: {
        bold: false,
        italic: false,
        underline: false,
      },
      metadata: {
        ...defaultData.metadata,
        wordCount: content.split(/\s+/).filter((word) => word.length > 0)
          .length,
        characterCount: content.length,
        createdFrom: typeof data === "string" ? "text" : "object",
      },
    } as WidgetCreateData<NoteWidget>;

    return widgetData;
  }

  validate(widget: NoteWidget): WidgetValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (typeof widget.content !== "string") {
      errors.push("Note content must be a string");
    }

    if (widget.content.length > 10000) {
      warnings.push("Note content is very long and may affect performance");
    }

    if (widget.width <= 0 || widget.height <= 0) {
      errors.push("Note dimensions must be positive");
    }

    if (widget.fontSize <= 0 || widget.fontSize > 72) {
      errors.push("Font size must be between 1 and 72");
    }

    if (!this.isValidColor(widget.backgroundColor)) {
      errors.push("Invalid background color format");
    }

    if (!this.isValidColor(widget.textColor)) {
      errors.push("Invalid text color format");
    }

    if (!["left", "center", "right"].includes(widget.textAlign)) {
      errors.push("Text alignment must be left, center, or right");
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  async serialize(
    widget: NoteWidget,
    _options: WidgetSerializationOptions,
  ): Promise<WidgetExportData> {
    return {
      widget: { ...widget },
    };
  }

  async deserialize(data: WidgetExportData): Promise<NoteWidget> {
    return data.widget as NoteWidget;
  }

  getDefaultSize(): { width: number; height: number } {
    return { width: 200, height: 150 };
  }

  getCapabilities(): WidgetCapabilities {
    return {
      canResize: true,
      canRotate: true,
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

  // Helper methods
  private getRandomColor(): string {
    return this.defaultColors[
      Math.floor(Math.random() * this.defaultColors.length)
    ];
  }

  private getContrastingTextColor(backgroundColor: string): string {
    // Simple contrast calculation
    const hex = backgroundColor.replace("#", "");
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);

    // Calculate luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    return luminance > 0.5 ? "#000000" : "#FFFFFF";
  }

  private calculateNoteSize(content: string): {
    width: number;
    height: number;
  } {
    const minWidth = 150;
    const minHeight = 100;
    const maxWidth = 400;
    const maxHeight = 600;

    // Estimate size based on content length
    const charCount = content.length;
    const lineCount = Math.max(1, content.split("\n").length);

    // Base calculations
    let width = Math.min(maxWidth, Math.max(minWidth, charCount * 8 + 40));
    let height = Math.min(maxHeight, Math.max(minHeight, lineCount * 20 + 40));

    // Adjust for very short content
    if (charCount < 20) {
      width = minWidth;
      height = minHeight;
    }

    // Adjust for very long content
    if (charCount > 200) {
      width = maxWidth;
      height = Math.min(maxHeight, (charCount / 50) * 20 + 60);
    }

    return { width, height };
  }

  private isValidColor(color: string): boolean {
    // Simple hex color validation
    return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
  }

  // Public utility methods for note management
  updateNoteContent(
    widget: NoteWidget,
    newContent: string,
  ): Partial<NoteWidget> {
    const newSize = this.calculateNoteSize(newContent);
    return {
      content: newContent,
      width: newSize.width,
      height: newSize.height,
      metadata: {
        ...widget.metadata,
        wordCount: newContent.split(/\s+/).filter((word) => word.length > 0)
          .length,
        characterCount: newContent.length,
      },
    };
  }

  changeNoteColor(
    _widget: NoteWidget,
    backgroundColor: string,
  ): Partial<NoteWidget> {
    return {
      backgroundColor,
      textColor: this.getContrastingTextColor(backgroundColor),
    };
  }

  formatText(
    widget: NoteWidget,
    formatting: Partial<{ bold: boolean; italic: boolean; underline: boolean }>,
  ): Partial<NoteWidget> {
    return {
      formatting: {
        ...widget.formatting,
        ...formatting,
      },
    };
  }
}
