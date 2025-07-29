import { useContentStore } from "../../stores/contentStore";
import type {
  WidgetFactory,
  CreateWidgetInput,
  Position,
  WidgetCapabilities,
  HydratedWidget,
} from "../../types/widgets";
import { imageTypeDefinition } from "./index";
import type { ImageContent } from "./types";

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

    // Handle File objects that are images
    if (data instanceof File) {
      // Check MIME type first
      if (data.type.startsWith("image/")) {
        return true;
      }
      // Check file extension as fallback
      const imageExtensions = /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)$/i;
      return imageExtensions.test(data.name);
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
    let isFileUpload = false;

    // Extract image data based on input type
    if (data instanceof File) {
      // Handle File objects (from drag & drop) - use Storacha upload
      isFileUpload = true;
      src = URL.createObjectURL(data); // Temporary local URL for immediate preview
      alt = data.name;

      // Try to get dimensions from the image
      try {
        const img = new Image();
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = src;
        });
        originalDimensions = {
          width: img.naturalWidth,
          height: img.naturalHeight,
        };
      } catch (error) {
        console.warn("Could not determine image dimensions:", error);
        originalDimensions = { width: 400, height: 300 };
      }
    } else if (typeof data === "string") {
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
            height: parseInt(placeholderMatch[2]),
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
      ...(data?.filters && { filters: data.filters }),
      ...(isFileUpload && { isFileUpload: true, originalFile: data }),
    };

    // Calculate widget dimensions that account for 8px padding (16px total)
    // and maintain the image's aspect ratio
    const padding = 16; // 8px on each side
    const maxWidth = 400;
    const maxHeight = 300;

    // Calculate available space for image (minus padding)
    const availableWidth = maxWidth - padding;
    const availableHeight = maxHeight - padding;

    // Scale to fit within available space while maintaining aspect ratio
    let targetWidth, targetHeight;

    if (
      originalDimensions.width <= availableWidth &&
      originalDimensions.height <= availableHeight
    ) {
      // Image fits naturally
      targetWidth = originalDimensions.width;
      targetHeight = originalDimensions.height;
    } else {
      // Need to scale down
      const widthScale = availableWidth / originalDimensions.width;
      const heightScale = availableHeight / originalDimensions.height;
      const scale = Math.min(widthScale, heightScale);

      targetWidth = Math.round(originalDimensions.width * scale);
      targetHeight = Math.round(originalDimensions.height * scale);
    }

    // Add padding back to get final widget dimensions
    const finalWidth = targetWidth + padding;
    const finalHeight = targetHeight + padding;

    return {
      type: this.type,
      x: position.x,
      y: position.y,
      width: finalWidth,
      height: finalHeight,
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
      canDuplicate: false,
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
      if (
        !data.originalDimensions ||
        typeof data.originalDimensions.width !== "number" ||
        typeof data.originalDimensions.height !== "number"
      ) {
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
