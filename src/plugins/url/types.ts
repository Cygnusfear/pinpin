/**
 * URL widget content
 */
export interface UrlContent {
  url: string;
  title?: string;
  description?: string;
  favicon?: string;
  preview?: string;
  embedType?: "link" | "iframe" | "video" | "image";
  embedData?: {
    html?: string;
    aspectRatio?: number;
    autoplay?: boolean;
  };
  // OG Metadata fields
  siteName?: string;
  type?: string;
  author?: string;
  publishedTime?: string;
  twitterCard?: string;
  twitterSite?: string;
  twitterCreator?: string;
  // Enhanced metadata
  image?: string; // Alias for preview for consistency with OG spec
}
