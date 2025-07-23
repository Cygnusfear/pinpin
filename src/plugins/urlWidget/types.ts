import type { BaseWidget } from "../../types/widgets";

export interface UrlWidget extends BaseWidget {
  type: "url";
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
}

export interface UrlWidgetCreateData {
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
}
