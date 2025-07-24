import type {
  CreateWidgetInput,
  HydratedWidget,
  Position,
  WidgetCapabilities,
  WidgetFactory,
} from "../../types/widgets";
import type { YouTubeContent } from "./types";

// Define the type definition directly to avoid circular dependency
const youTubeTypeDefinition = [
  {
    type: "youtube",
    name: "YouTube Player",
    description:
      "Synchronized YouTube video player with real-time position sharing",
    icon: "▶️",
    category: "media" as const,
    defaultSize: { width: 560, height: 315 },
    minSize: { width: 320, height: 180 },
    maxSize: { width: 1280, height: 720 },
    aspectRatioLocked: true,
    resizable: true,
    rotatable: false,
    configurable: true,
    autoCreateOnly: false,
  },
];

export class YouTubeFactory implements WidgetFactory<YouTubeContent> {
  type = "youtube";

  /**
   * Determines if this factory can handle the provided data
   */
  canHandle(data: any): boolean {
    // Handle explicit YouTube requests
    if (data?.type === "youtube") {
      return true;
    }

    // Handle YouTube URL strings
    if (typeof data === "string") {
      return this.isYouTubeUrl(data);
    }

    // Handle YouTube data objects
    if (data && typeof data === "object" && data.url) {
      return this.isYouTubeUrl(data.url);
    }

    return false;
  }

  /**
   * Create a YouTube widget from the provided data
   */
  async create(data: any, position: Position): Promise<CreateWidgetInput> {
    let url = "";
    let videoId = "";
    let title = "";
    let thumbnail = "";
    let startTime = 0;

    // Extract YouTube data based on input type
    if (typeof data === "string") {
      url = data;
      videoId = this.extractVideoId(url);
      startTime = this.extractStartTime(url);
    } else if (data && typeof data === "object") {
      url = data.url || "";
      videoId = this.extractVideoId(url);
      title = data.title || "";
      thumbnail = data.thumbnail || "";
      startTime = data.startTime || this.extractStartTime(url);
    }

    // Generate thumbnail URL if not provided
    if (!thumbnail && videoId) {
      thumbnail = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
    }

    // Try to fetch video metadata for better experience
    if (!title && videoId) {
      try {
        title = await this.fetchVideoTitle(videoId);
      } catch (error) {
        console.warn("Failed to fetch YouTube video title:", error);
        title = `YouTube Video (${videoId})`;
      }
    }

    const content: YouTubeContent = {
      url,
      videoId,
      title: title || `YouTube Video (${videoId})`,
      thumbnail,
      currentTime: startTime,
      isPlaying: false,
      startTime,
    };

    return {
      type: this.type,
      x: position.x,
      y: position.y,
      width: youTubeTypeDefinition[0].defaultSize.width,
      height: youTubeTypeDefinition[0].defaultSize.height,
      content,
    };
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

  /**
   * Extract video ID from YouTube URL
   */
  private extractVideoId(url: string): string {
    const patterns = [
      // Standard YouTube URLs
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      // YouTube short URLs
      /youtube\.com\/v\/([^&\n?#]+)/,
      // YouTube playlist URLs
      /youtube\.com\/watch\?.*v=([^&\n?#]+)/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return "";
  }

  /**
   * Extract start time from YouTube URL (t parameter)
   */
  private extractStartTime(url: string): number {
    try {
      const urlObj = new URL(url);
      const tParam = urlObj.searchParams.get("t");

      if (tParam) {
        // Handle formats like "1h2m3s", "123s", "123"
        const timeMatch = tParam.match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?/);
        if (timeMatch) {
          const hours = parseInt(timeMatch[1] || "0");
          const minutes = parseInt(timeMatch[2] || "0");
          const seconds = parseInt(timeMatch[3] || "0");
          return hours * 3600 + minutes * 60 + seconds;
        }

        // Fallback: try to parse as plain number (seconds)
        const numericTime = parseInt(tParam);
        if (!isNaN(numericTime)) {
          return numericTime;
        }
      }
    } catch (error) {
      console.warn("Failed to extract start time from URL:", error);
    }

    return 0;
  }

  /**
   * Fetch video title from YouTube (using oEmbed API)
   */
  private async fetchVideoTitle(videoId: string): Promise<string> {
    try {
      const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
      const response = await fetch(oembedUrl);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      return data.title || `YouTube Video (${videoId})`;
    } catch (error) {
      console.warn("Failed to fetch video title from oEmbed:", error);
      throw error;
    }
  }

  /**
   * Get default size for the widget
   */
  getDefaultSize(): { width: number; height: number } {
    return youTubeTypeDefinition[0].defaultSize;
  }

  /**
   * Define what capabilities this widget has
   */
  getCapabilities(): WidgetCapabilities {
    return {
      canResize: true,
      canRotate: false,
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

  /**
   * Validate widget content
   */
  validate(widget: HydratedWidget<YouTubeContent>) {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!widget.content || !widget.content.data) {
      errors.push("YouTube content is missing");
    } else {
      const data = widget.content.data;

      if (!data.url || typeof data.url !== "string") {
        errors.push("YouTube URL is required and must be a string");
      } else if (!this.isYouTubeUrl(data.url)) {
        errors.push("URL must be a valid YouTube URL");
      }

      if (!data.videoId || typeof data.videoId !== "string") {
        errors.push("Video ID is required and must be a string");
      }

      if (typeof data.currentTime !== "number" || data.currentTime < 0) {
        warnings.push("Current time should be a non-negative number");
      }

      if (typeof data.isPlaying !== "boolean") {
        warnings.push("isPlaying should be a boolean value");
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }
}
