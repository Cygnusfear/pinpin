import type { WidgetPlugin, WidgetTypeDefinition } from "../../types/widgets";
import { UrlWidgetFactory } from "./factory";
import { UrlWidgetRenderer } from "./renderer";

export class UrlWidgetPlugin implements WidgetPlugin {
  id = "url-widget";
  name = "URL Widget";
  version = "1.0.0";
  description = "Display web links with previews";
  author = "Pinboard Team";

  types: WidgetTypeDefinition[] = [
    {
      type: "url",
      name: "Web Link",
      description: "Display web links with previews",
      icon: "🔗",
      category: "web",
      defaultSize: { width: 300, height: 200 },
      minSize: { width: 200, height: 100 },
      maxSize: { width: 600, height: 200 },
      aspectRatioLocked: false,
      resizable: true,
      rotatable: false,
      configurable: true,
    },
  ];

  factories = [new UrlWidgetFactory()];

  renderers = [
    {
      type: "url",
      component: UrlWidgetRenderer,
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
export const urlWidgetPlugin = new UrlWidgetPlugin();
export { UrlWidgetFactory } from "./factory";
export { UrlWidgetRenderer } from "./renderer";
export type { UrlWidget, UrlWidgetCreateData } from "./types";
