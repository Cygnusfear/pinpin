import { imageTypeDefinition } from ".";
import type {
  WidgetFactory,
  CreateWidgetInput,
  Position,
  WidgetCapabilities,
  ImageContent,
  HydratedWidget,
} from "../../types/widgets";

// ============================================================================
// IMAGE WIDGET FACTORY - CLEAN IMPLEMENTATION
// ============================================================================

export class ImageFactory implements WidgetFactory<ImageContent> {
  type = "image";

  canHandle(data: any): boolean {
    // Handle explicit image requests
    if (data?.type === "image") {
      return true;
    }

    // Handle URL strings that appear to be images
    if (typeof data === "string") {
      const imageExtensions = /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)$/i;
      try {
        const url = new URL(data);
        return imageExtensions.test(url.pathname);
      } catch {
        return imageExtensions.test(data);
      }
    }

    // Handle image data objects
    if (data && typeof data === "object" && data.src) {
      return true;
    }

    return false;
  }

  async create(data: any, position: Position): Promise<CreateWidgetInput> {
    let src = "";
    let alt = "";
    let originalDimensions = { width: 200, height: 150 };

    // Extract image data based on input type
    if (typeof data === "string") {
      src = data;
      alt = "Image";
    } else if (data && typeof data === "object") {
      src = data.src || data.url || "";
      alt = data.alt || data.title || "Image";
      originalDimensions = data.originalDimensions || originalDimensions;
    }

    // If we have a URL, try to determine dimensions
    if (src && !data.originalDimensions) {
      try {
        // For placeholder services, extract dimensions from URL
        const placeholderMatch = src.match(/(\d+)x(\d+)/);
        if (placeholderMatch) {
          originalDimensions = {
            width: parseInt(placeholderMatch[1]),
            height: parseInt(placeholderMatch[2])
          };
        }
      } catch (error) {
        console.warn("Could not determine image dimensions:", error);
      }
    }

    const content: ImageContent = {
      src,
      alt,
      originalDimensions,
      filters: data?.filters || undefined,
    };

    return {
      type: this.type,
      x: position.x,
      y: position.y,
      width: Math.min(originalDimensions.width, 400),
      height: Math.min(originalDimensions.height, 300),
      content,
    };
  }

  getDefaultSize(): { width: number; height: number } {
    return imageTypeDefinition[0].defaultSize;
  }

  getCapabilities(): WidgetCapabilities {
    return {
      canResize: true,
      canRotate: true,
      canEdit: false,
      canConfigure: true,
      canGroup: true,
      canDuplicate: true,
      canExport: true,
      hasContextMenu: true,
      hasToolbar: false,
      hasInspector: true,
    };
  }

  validate(widget: HydratedWidget<ImageContent>) {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!widget.content || !widget.content.data) {
      errors.push("Image content is missing");
    } else {
      const data = widget.content.data;
      if (!data.src || typeof data.src !== "string") {
        errors.push("Image source is required and must be a string");
      }
      if (!data.originalDimensions || 
          typeof data.originalDimensions.width !== "number" ||
          typeof data.originalDimensions.height !== "number") {
        errors.push("Original dimensions are required");
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }
}