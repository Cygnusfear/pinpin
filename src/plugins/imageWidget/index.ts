import type { WidgetPlugin, WidgetTypeDefinition } from "../../types/widgets";
import { ImageWidgetFactory } from "./factory";
import { ImageWidgetRenderer } from "./renderer";

export class ImageWidgetPlugin implements WidgetPlugin {
  id = "image-widget";
  name = "Image Widget";
  version = "1.0.0";
  description = "Display images from files or URLs";
  author = "Pinboard Team";

  types: WidgetTypeDefinition[] = [
    {
      type: "image",
      name: "Image",
      description: "Display images from files or URLs",
      icon: "🖼️",
      category: "media",
      defaultSize: { width: 200, height: 150 },
      minSize: { width: 50, height: 50 },
      maxSize: { width: 1000, height: 1000 },
      aspectRatioLocked: false,
      resizable: true,
      rotatable: true,
      configurable: true,
      supportedMimeTypes: [
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/webp",
        "image/svg+xml",
        "image/bmp",
      ],
      supportedExtensions: [
        ".jpg",
        ".jpeg",
        ".png",
        ".gif",
        ".webp",
        ".svg",
        ".bmp",
      ],
    },
  ];

  factories = [new ImageWidgetFactory()];

  renderers = [
    {
      type: "image",
      component: ImageWidgetRenderer,
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
export const imageWidgetPlugin = new ImageWidgetPlugin();
export { ImageWidgetFactory } from "./factory";
export { ImageWidgetRenderer } from "./renderer";
export type { ImageWidget, ImageWidgetCreateData } from "./types";
