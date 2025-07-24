import { OGMetadataService } from "../../services/ogMetadataService";
import type {
  CreateWidgetInput,
  HydratedWidget,
  Position,
  UrlContent,
  WidgetCapabilities,
  WidgetFactory,
} from "../../types/widgets";
import { urlTypeDefinition } from ".";

// ============================================================================
// URL WIDGET FACTORY - CLEAN IMPLEMENTATION
// ============================================================================

export class UrlFactory implements WidgetFactory<UrlContent> {
  type = "url";

  canHandle(data: any): boolean {
    // Handle explicit URL requests
    if (data?.type === "url") {
      return true;
    }

    // Handle URL strings
    if (typeof data === "string") {
      try {
        new URL(data);
        return true;
      } catch {
        // Also check for common URL patterns without protocol
        const urlPattern =
          /^(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)$/;
        return urlPattern.test(data);
      }
    }

    // Handle URL data objects
    if (data && typeof data === "object" && data.url) {
      return true;
    }

    return false;
  }

  async create(data: any, position: Position): Promise<CreateWidgetInput> {
    let url = "";
    let title = "";
    let description = "";
    let favicon = "";
    let embedType: "link" | "iframe" | "video" | "image" = "link";

    // Extract URL data based on input type
    if (typeof data === "string") {
      // Add protocol if missing
      url = data.startsWith("http") ? data : `https://${data}`;
      title = this.extractDomainFromUrl(url);
    } else if (data && typeof data === "object") {
      url = data.url || "";
      title = data.title || this.extractDomainFromUrl(url);
      description = data.description || "";
      favicon = data.favicon || this.getFaviconUrl(url);
      embedType = data.embedType || "link";
    }

    // Try to get favicon if not provided
    if (!favicon && url) {
      favicon = this.getFaviconUrl(url);
    }

    // Fetch OG metadata asynchronously
    let ogMetadata = null;
    try {
      console.log(`🔗 Fetching OG metadata for: ${url}`);
      ogMetadata = await OGMetadataService.fetchMetadata(url);
      console.log(`✅ OG metadata fetched successfully:`, ogMetadata);
    } catch (error) {
      console.warn(`⚠️ Failed to fetch OG metadata for ${url}:`, error);
    }

    // Merge OG metadata with existing data (OG metadata takes precedence when available)
    // Only include fields that have actual values to avoid undefined in sync store
    const content: UrlContent = {
      url,
      title: ogMetadata?.title || title || this.extractDomainFromUrl(url),
      embedType,
      ...(ogMetadata?.description || description
        ? { description: ogMetadata?.description || description }
        : {}),
      ...(ogMetadata?.favicon || favicon
        ? { favicon: ogMetadata?.favicon || favicon }
        : {}),
      ...(ogMetadata?.image || data?.preview
        ? {
            preview: ogMetadata?.image || data?.preview,
            image: ogMetadata?.image || data?.preview,
          }
        : {}),
      ...(data?.embedData ? { embedData: data.embedData } : {}),
      // OG metadata fields - only include if they have values
      ...(ogMetadata?.siteName ? { siteName: ogMetadata.siteName } : {}),
      ...(ogMetadata?.type ? { type: ogMetadata.type } : {}),
      ...(ogMetadata?.author ? { author: ogMetadata.author } : {}),
      ...(ogMetadata?.publishedTime
        ? { publishedTime: ogMetadata.publishedTime }
        : {}),
      ...(ogMetadata?.twitterCard
        ? { twitterCard: ogMetadata.twitterCard }
        : {}),
      ...(ogMetadata?.twitterSite
        ? { twitterSite: ogMetadata.twitterSite }
        : {}),
      ...(ogMetadata?.twitterCreator
        ? { twitterCreator: ogMetadata.twitterCreator }
        : {}),
    };

    return {
      type: this.type,
      x: position.x,
      y: position.y,
      width: 320,
      height: 200, // Slightly taller to accommodate more metadata
      content,
    };
  }

  private extractDomainFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace(/^www\./, "");
    } catch {
      return "Unknown Site";
    }
  }

  private getFaviconUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}`;
    } catch {
      return "";
    }
  }

  getDefaultSize(): { width: number; height: number } {
    return urlTypeDefinition[0].defaultSize;
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
      hasToolbar: false,
      hasInspector: true,
    };
  }

  validate(widget: HydratedWidget<UrlContent>) {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!widget.content || !widget.content.data) {
      errors.push("URL content is missing");
    } else {
      const data = widget.content.data;
      if (!data.url || typeof data.url !== "string") {
        errors.push("URL is required and must be a string");
      } else {
        try {
          new URL(data.url);
        } catch {
          errors.push("URL must be a valid URL");
        }
      }
      if (
        data.embedType &&
        !["link", "iframe", "video", "image"].includes(data.embedType)
      ) {
        warnings.push("Invalid embed type, defaulting to 'link'");
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }
}
