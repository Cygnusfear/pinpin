import type { WidgetPlugin, WidgetTypeDefinition } from "../../types/widgets";
import { DocumentFactory } from "./factory";
import { DocumentRenderer } from "./renderer";

// ============================================================================
// DOCUMENT WIDGET PLUGIN - CLEAN IMPLEMENTATION
// ============================================================================

export const documentTypeDefinition: WidgetTypeDefinition[] = [
  {
    type: "document",
    name: "Document",
    description: "Display and manage documents and files",
    icon: "📄",
    category: "document",
    defaultSize: { width: 300, height: 200 },
    minSize: { width: 200, height: 150 },
    maxSize: { width: 500, height: 400 },
    aspectRatioLocked: false,
    resizable: true,
    rotatable: false,
    configurable: true,
    supportedMimeTypes: [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/plain",
      "text/markdown",
      "application/rtf",
      "application/vnd.oasis.opendocument.text",
      "text/csv",
    ],
    supportedExtensions: [
      ".pdf",
      ".doc",
      ".docx",
      ".ppt",
      ".pptx",
      ".xls",
      ".xlsx",
      ".txt",
      ".md",
      ".rtf",
      ".odt",
      ".csv",
    ],
    autoCreateOnly: true,
  },
];

export class DocumentPlugin implements WidgetPlugin {
  id = "document";
  name = "Document Widget";
  version = "1.0.0";
  description = "A widget for displaying and managing documents and files";
  author = "Pinboard Team";

  types: WidgetTypeDefinition[] = documentTypeDefinition;

  factories = [new DocumentFactory()];
  renderers = [{ type: "document", component: DocumentRenderer }];

  async install(registry: any): Promise<void> {
    // Register type definition
    this.types.forEach((type) => registry.registerType(type));

    // Register factory
    this.factories.forEach((factory) => registry.registerFactory(factory));

    // Register renderer
    this.renderers.forEach((renderer) => registry.registerRenderer(renderer));

    console.log(`✅ Installed ${this.name} v${this.version}`);
  }

  async uninstall(registry: any): Promise<void> {
    // Unregister in reverse order
    this.renderers.forEach((renderer) =>
      registry.unregisterRenderer(renderer.type),
    );
    this.factories.forEach((factory) =>
      registry.unregisterFactory(factory.type),
    );
    this.types.forEach((type) => registry.unregisterType(type.type));

    console.log(`❌ Uninstalled ${this.name}`);
  }
}

// Export plugin instance
export const documentPlugin = new DocumentPlugin();

// Export individual components for flexibility
export { DocumentFactory } from "./factory";
export { DocumentRenderer } from "./renderer";
