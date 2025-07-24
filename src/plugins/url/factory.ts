import { OGMetadataService } from "../../services/ogMetadataService";
import type {
  CreateWidgetInput,
  HydratedWidget,
  Position,
  WidgetCapabilities,
  WidgetFactory,
} from "../../types/widgets";
import { urlTypeDefinition } from ".";
import type { UrlContent } from "./types";

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
      // Exclude YouTube URLs - they should be handled by the YouTube plugin
      if (this.isYouTubeUrl(data)) {
        return false;
      }

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
      // Exclude YouTube URLs - they should be handled by the YouTube plugin
      if (this.isYouTubeUrl(data.url)) {
        return false;
      }
      return true;
    }

    return false;
  }

  /**
   * Check if a URL is a YouTube URL
   */
  private isYouTubeUrl(url: string): boolean {
    const youtubePatterns = [
      /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)/,
      /^(https?:\/\/)?(m\.youtube\.com)/,
      /^(https?:\/\/)?(gaming\.youtube\.com)/,
    ];

    return youtubePatterns.some((pattern) => pattern.test(url));
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

    // Create basic content immediately for instant feedback
    const content: UrlContent = {
      url,
      title: title || this.extractDomainFromUrl(url),
      embedType,
      ...(description ? { description } : {}),
      ...(favicon ? { favicon } : {}),
      ...(data?.preview ? { preview: data.preview, image: data.preview } : {}),
      ...(data?.embedData ? { embedData: data.embedData } : {}),
    };

    // Check for existing metadata first, then enrich if needed
    setTimeout(() => {
      this.checkAndEnrichMetadata(url, content);
    }, 100);

    return {
      type: this.type,
      x: position.x,
      y: position.y,
      width: 320,
      height: 200,
      content,
    };
  }

  /**
   * Enrich metadata in the background without blocking widget creation
   */
  private async enrichMetadataInBackground(
    url: string,
    initialContent: UrlContent,
  ): Promise<void> {
    try {
      console.log(`🔗 Starting background metadata enrichment for: ${url}`);

      // Wait a bit longer to ensure content is stored
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Import content store dynamically to avoid circular dependencies
      const { useContentStore } = await import("../../stores/contentStore");

      // First, let's check what's in the store
      const contentStore = useContentStore.getState();
      const allContent = contentStore.content;

      console.log(`🔍 Current content store state:`, {
        totalEntries: Object.keys(allContent).length,
        urlEntries: Object.entries(allContent).filter(
          ([_, content]) => content.type === "url",
        ).length,
        allEntries: Object.entries(allContent).map(([id, content]) => ({
          id,
          type: content.type,
          hasData: !!content.data,
          dataKeys: content.data ? Object.keys(content.data) : [],
          url:
            content.data && (content.data as any).url
              ? (content.data as any).url
              : "no-url",
        })),
      });

      // Find the content entry that matches our URL
      const contentEntry = Object.entries(allContent).find(
        ([_, content]) =>
          content.type === "url" &&
          content.data &&
          (content.data as any).url === url,
      );

      if (!contentEntry) {
        console.error(`❌ Could not find content entry for URL: ${url}`);
        console.log(`🔍 Looking for URL:`, url);
        console.log(
          `🔍 Available URLs:`,
          Object.entries(allContent)
            .filter(([_, content]) => content.type === "url")
            .map(([id, content]) => ({
              id,
              url: content.data ? (content.data as any).url : "no-data",
            })),
        );
        return;
      }

      const [contentId] = contentEntry;
      console.log(`✅ Found content entry ${contentId} for URL: ${url}`);

      // Fetch OG metadata
      console.log(`🌐 Fetching OG metadata for: ${url}`);
      const ogMetadata = await OGMetadataService.fetchMetadata(url);
      console.log(`✅ OG metadata fetched:`, ogMetadata);

      // Merge with existing content (OG metadata takes precedence when available)
      const enrichedContent: UrlContent = {
        ...initialContent,
        title: ogMetadata?.title || initialContent.title,
        ...(ogMetadata?.description
          ? { description: ogMetadata.description }
          : {}),
        ...(ogMetadata?.favicon ? { favicon: ogMetadata.favicon } : {}),
        ...(ogMetadata?.image
          ? { preview: ogMetadata.image, image: ogMetadata.image }
          : {}),
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

      console.log(
        `🔄 Updating content ${contentId} with enriched metadata:`,
        enrichedContent,
      );

      // Update content by merging the enriched data into the existing data field
      contentStore.updateContent(contentId, {
        data: enrichedContent,
      });

      console.log(`✅ Content enriched and updated successfully for: ${url}`);

      // Verify the update
      const updatedContent = contentStore.getContent(contentId);
      console.log(`🔍 Verification - updated content:`, updatedContent);
    } catch (error) {
      console.error(`❌ Failed to enrich metadata for ${url}:`, error);
      // Don't throw - this is background enrichment, failure shouldn't affect the widget
    }
  }

  /**
   * Check for existing metadata first, then enrich if needed
   */
  private async checkAndEnrichMetadata(
    url: string,
    initialContent: UrlContent,
  ): Promise<void> {
    try {
      console.log(`🔍 Checking for existing metadata for: ${url}`);

      // Import content store dynamically to avoid circular dependencies
      const { useContentStore } = await import("../../stores/contentStore");
      const contentStore = useContentStore.getState();
      const allContent = contentStore.content;

      // Look for existing URL content with rich metadata
      const existingUrlContent = Object.values(allContent).find(
        (content) =>
          content.type === "url" &&
          content.data &&
          (content.data as any).url === url &&
          // Check if it has rich metadata (not just basic info)
          ((content.data as any).siteName ||
            (content.data as any).description ||
            (content.data as any).image ||
            (content.data as any).preview),
      );

      if (existingUrlContent) {
        console.log(
          `✅ Found existing metadata for: ${url}`,
          existingUrlContent.data,
        );

        // Wait a bit to ensure our content is stored
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Find our newly created content entry
        const currentContentEntry = Object.entries(allContent).find(
          ([_, content]) =>
            content.type === "url" &&
            content.data &&
            (content.data as any).url === url,
        );

        if (currentContentEntry) {
          const [contentId] = currentContentEntry;
          console.log(`🔄 Reusing existing metadata for content ${contentId}`);

          // Update our content with the existing rich metadata
          contentStore.updateContent(contentId, {
            data: existingUrlContent.data,
          });

          console.log(`✅ Applied cached metadata successfully for: ${url}`);
        }
      } else {
        console.log(
          `🌐 No existing metadata found, fetching fresh data for: ${url}`,
        );
        // No existing metadata found, fetch fresh
        await this.enrichMetadataInBackground(url, initialContent);
      }
    } catch (error) {
      console.error(`❌ Failed to check/enrich metadata for ${url}:`, error);
      // Fallback to normal enrichment
      await this.enrichMetadataInBackground(url, initialContent);
    }
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
