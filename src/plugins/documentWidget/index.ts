import type { WidgetPlugin, WidgetTypeDefinition } from "../../types/widgets";
import { DocumentWidgetFactory } from "./factory";
import { DocumentWidgetRenderer } from "./renderer";

export class DocumentWidgetPlugin implements WidgetPlugin {
  id = "document-widget";
  name = "Document Widget";
  version = "1.0.0";
  description = "Display documents, files, and other content";
  author = "Pinboard Team";

  types: WidgetTypeDefinition[] = [
    {
      type: "document",
      name: "Document",
      description: "Display documents, files, and other content",
      icon: "📄",
      category: "document",
      defaultSize: { width: 200, height: 50 },
      minSize: { width: 150, height: 50 },
      maxSize: { width: 400, height: 500 },
      aspectRatioLocked: false,
      resizable: true,
      rotatable: true,
      configurable: true,
      supportedMimeTypes: [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-powerpoint",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "text/plain",
        "text/csv",
        "application/json",
        "application/xml",
        "text/xml",
        "text/html",
        "text/css",
        "text/javascript",
        "application/javascript",
        "application/zip",
        "audio/mpeg",
        "audio/wav",
        "video/mp4",
        "video/webm",
        "application/octet-stream",
      ],
      supportedExtensions: [
        ".pdf",
        ".doc",
        ".docx",
        ".xls",
        ".xlsx",
        ".ppt",
        ".pptx",
        ".txt",
        ".csv",
        ".json",
        ".xml",
        ".html",
        ".css",
        ".js",
        ".ts",
        ".zip",
        ".rar",
        ".7z",
        ".mp3",
        ".wav",
        ".mp4",
        ".webm",
        ".avi",
      ],
    },
  ];

  factories = [new DocumentWidgetFactory()];

  renderers = [
    {
      type: "document",
      component: DocumentWidgetRenderer,
    },
  ];

  async install(): Promise<void> {
    console.log(`Installing ${this.name} v${this.version}...`);
  }

  async uninstall(): Promise<void> {
    console.log(`Uninstalling ${this.name}...`);
  }
}

// Export plugin instance and components
export const documentWidgetPlugin = new DocumentWidgetPlugin();
export { DocumentWidgetFactory } from "./factory";
export { DocumentWidgetRenderer } from "./renderer";
export type { DocumentWidget, DocumentWidgetCreateData } from "./types";
