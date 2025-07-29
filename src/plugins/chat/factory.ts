import { chatTypeDefinition } from ".";
import type {
  CreateWidgetInput,
  HydratedWidget,
  Position,
  WidgetCapabilities,
  WidgetFactory,
} from "../../types/widgets";
import type { ChatContent } from "./types";

export class ChatFactory implements WidgetFactory<ChatContent> {
  type = "chat";

  /**
   * Determines if this factory can handle the provided data
   */
  canHandle(data: any): boolean {
    // Handle explicit requests for chat widgets
    if (data?.type === "chat") {
      return true;
    }

    // Handle requests for "llm", "ai", "claude" etc.
    if (typeof data === "string") {
      const lowerData = data.toLowerCase();
      return (
        lowerData.includes("chat") ||
        lowerData.includes("llm") ||
        lowerData.includes("ai") ||
        lowerData.includes("claude") ||
        lowerData.includes("assistant")
      );
    }

    return false;
  }

  /**
   * Create a chat widget with empty conversation state
   */
  async create(data: any, position: Position): Promise<CreateWidgetInput> {
    const content: ChatContent = {
      messages: [],
      isTyping: false,
      settings: {
        maxMessages: 100,
        autoScroll: true,
        markdownRendering: {
          enabled: true,
          showThinkTags: true,
          expandThinkTagsByDefault: false,
          enableSyntaxHighlighting: true,
        },
      },
    };

    return {
      type: this.type,
      x: position.x,
      y: position.y,
      width: this.getDefaultSize().width,
      height: this.getDefaultSize().height,
      content,
    };
  }

  /**
   * Get default size for the chat widget
   */
  getDefaultSize(): { width: number; height: number } {
    return chatTypeDefinition[0].defaultSize;
  }

  /**
   * Define capabilities for the chat widget
   */
  getCapabilities(): WidgetCapabilities {
    return {
      canResize: true,
      canRotate: false,
      canEdit: false,
      canConfigure: true,
      canGroup: true,
      canDuplicate: false,
      canExport: true,
      hasContextMenu: true,
      hasToolbar: false,
      hasInspector: false,
    };
  }

  /**
   * Validate chat widget content
   */
  validate(widget: HydratedWidget<ChatContent>) {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!widget.content || !widget.content.data) {
      errors.push("Widget content is missing");
    } else {
      const data = widget.content.data;

      if (!Array.isArray(data.messages)) {
        errors.push("Messages must be an array");
      }

      if (typeof data.isTyping !== "boolean") {
        errors.push("isTyping must be a boolean");
      }

      if (data.settings && typeof data.settings !== "object") {
        errors.push("settings must be an object");
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }
}
