import type {
  CreateWidgetInput,
  Position,
  WidgetFactory,
} from "../types/widgets";
import { getWidgetRegistry } from "./WidgetRegistry";

// ============================================================================
// GENERIC WIDGET FACTORY - UNIFIED PATTERN
// ============================================================================

/**
 * Clean, unified generic widget factory implementation
 * Handles widget creation from various data sources using registered factories
 */
export class GenericWidgetFactory {
  /**
   * Provides default widget data that all plugin factories should inherit from
   * Plugin factories should only override what's specific to their widget type
   */
  getDefaultWidgetData(
    type: string,
    position: Position,
    size: { width: number; height: number },
  ): Partial<CreateWidgetInput> {
    return {
      type,
      x: position.x - size.width / 2,
      y: position.y - size.height / 2,
      width: size.width,
      height: size.height,
      rotation: (Math.random() - 0.5) * 138, // Slight random rotation
      locked: false,
      metadata: {
        createdFrom: "factory",
        createdAt: Date.now(),
      },
    };
  }

  /**
   * Attempts to create a widget from the provided data by checking all registered factories
   * Uses first-match strategy - iterates through factories in registration order
   */
  async createWidgetFromData(
    data: any,
    position: Position,
  ): Promise<CreateWidgetInput | null> {
    const registry = getWidgetRegistry();

    // Get all registered widget types
    const allTypes = registry.getAllTypes();

    // Try each factory in order until one can handle the data
    for (const typeDefinition of allTypes) {
      const factory = registry.getFactory(typeDefinition.type);

      if (factory?.canHandle(data)) {
        try {
          console.log(
            `🏭 Creating ${typeDefinition.type} widget from data:`,
            data,
          );

          // Create the widget using the factory
          const widgetInput = await factory.create(data, position);

          if (widgetInput) {
            console.log(
              `✅ Successfully created ${typeDefinition.type} widget input:`,
              widgetInput,
            );
            return widgetInput;
          }
        } catch (error) {
          console.error(
            `❌ Failed to create ${typeDefinition.type} widget:`,
            error,
          );
        }
      }
    }

    console.warn("⚠️ No widget factory could handle the provided data:", data);
    return null;
  }

  /**
   * Checks if any registered factory can handle the provided data
   */
  canHandleData(data: any): boolean {
    const registry = getWidgetRegistry();
    const allTypes = registry.getAllTypes();

    // Check if any factory can handle this data
    for (const typeDefinition of allTypes) {
      const factory = registry.getFactory(typeDefinition.type);
      if (factory?.canHandle(data)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Gets all widget types that can handle the provided data
   */
  getSupportedTypes(data: any): string[] {
    const registry = getWidgetRegistry();
    const allTypes = registry.getAllTypes();
    const supportedTypes: string[] = [];

    // Check which factories can handle this data
    for (const typeDefinition of allTypes) {
      const factory = registry.getFactory(typeDefinition.type);
      if (factory?.canHandle(data)) {
        supportedTypes.push(typeDefinition.type);
      }
    }

    return supportedTypes;
  }

  /**
   * Gets the best factory for the provided data (first match)
   */
  getBestFactory(data: any): WidgetFactory | null {
    const registry = getWidgetRegistry();
    const allTypes = registry.getAllTypes();

    // Return the first factory that can handle this data
    for (const typeDefinition of allTypes) {
      const factory = registry.getFactory(typeDefinition.type);
      if (factory?.canHandle(data)) {
        return factory;
      }
    }

    return null;
  }

  /**
   * Handles paste events - extracts data from clipboard and creates appropriate widgets
   */
  async handlePasteEvent(
    event: ClipboardEvent,
    position: Position,
  ): Promise<CreateWidgetInput[]> {
    const widgetInputs: CreateWidgetInput[] = [];

    if (!event.clipboardData) {
      return widgetInputs;
    }

    // Handle files from clipboard
    const files = Array.from(event.clipboardData.files);
    for (const file of files) {
      const widgetInput = await this.createWidgetFromData(file, position);
      if (widgetInput) {
        widgetInputs.push(widgetInput);
        // Offset position for multiple items
        position.x += 20;
        position.y += 20;
      }
    }

    // Handle text data if no files were processed
    if (widgetInputs.length === 0) {
      const textData = event.clipboardData.getData("text/plain");
      if (textData?.trim()) {
        const widgetInput = await this.createWidgetFromData(textData, position);
        if (widgetInput) {
          widgetInputs.push(widgetInput);
        }
      }
    }

    // Handle HTML data as fallback
    if (widgetInputs.length === 0) {
      const htmlData = event.clipboardData.getData("text/html");
      if (htmlData?.trim()) {
        const widgetInput = await this.createWidgetFromData(htmlData, position);
        if (widgetInput) {
          widgetInputs.push(widgetInput);
        }
      }
    }

    return widgetInputs;
  }

  /**
   * Handles drop events - extracts data from drag and creates appropriate widgets
   */
  async handleDropEvent(
    event: DragEvent,
    position: Position,
  ): Promise<CreateWidgetInput[]> {
    const widgetInputs: CreateWidgetInput[] = [];

    if (!event.dataTransfer) {
      return widgetInputs;
    }

    // Handle files from drag and drop
    const files = Array.from(event.dataTransfer.files);
    for (const file of files) {
      const widgetInput = await this.createWidgetFromData(file, position);
      if (widgetInput) {
        widgetInputs.push(widgetInput);
        // Offset position for multiple items
        position.x += 20;
        position.y += 20;
      }
    }

    // Handle text data if no files were processed
    if (widgetInputs.length === 0) {
      const textData = event.dataTransfer.getData("text/plain");
      if (textData?.trim()) {
        const widgetInput = await this.createWidgetFromData(textData, position);
        if (widgetInput) {
          widgetInputs.push(widgetInput);
        }
      }
    }

    // Handle URL data
    if (widgetInputs.length === 0) {
      const urlData = event.dataTransfer.getData("text/uri-list");
      if (urlData?.trim()) {
        const widgetInput = await this.createWidgetFromData(urlData, position);
        if (widgetInput) {
          widgetInputs.push(widgetInput);
        }
      }
    }

    return widgetInputs;
  }

  /**
   * Create a widget of a specific type with default content
   */
  async createDefaultWidget(
    type: string,
    position: Position,
  ): Promise<CreateWidgetInput | null> {
    const registry = getWidgetRegistry();
    const factory = registry.getFactory(type);

    if (!factory) {
      console.warn(`⚠️ No factory registered for widget type: ${type}`);
      return null;
    }

    try {
      // Create widget with empty/default data
      const widgetInput = await factory.create({}, position);
      console.log(`✅ Created default ${type} widget:`, widgetInput);
      return widgetInput;
    } catch (error) {
      console.error(`❌ Failed to create default ${type} widget:`, error);
      return null;
    }
  }

  /**
   * Get default size for a widget type
   */
  getDefaultSize(type: string): { width: number; height: number } {
    const registry = getWidgetRegistry();
    const factory = registry.getFactory(type);
    
    if (factory) {
      return factory.getDefaultSize();
    }

    // Fallback default size
    return { width: 200, height: 150 };
  }

  /**
   * Get capabilities for a widget type
   */
  getCapabilities(type: string) {
    const registry = getWidgetRegistry();
    const factory = registry.getFactory(type);
    
    if (factory) {
      return factory.getCapabilities();
    }

    // Fallback capabilities
    return {
      canResize: true,
      canRotate: true,
      canEdit: false,
      canConfigure: false,
      canGroup: true,
      canDuplicate: true,
      canExport: false,
      hasContextMenu: false,
      hasToolbar: false,
      hasInspector: false,
    };
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

// Export singleton instance
export const genericWidgetFactory = new GenericWidgetFactory();

// Helper function to get the global factory
export function getGenericWidgetFactory(): GenericWidgetFactory {
  return genericWidgetFactory;
}
