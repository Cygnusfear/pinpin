import { getWidgetRegistry } from './WidgetRegistry';
import { Widget, WidgetCreateData } from '../types/widgets';

export class GenericWidgetFactory {
  /**
   * Attempts to create a widget from the provided data by checking all registered plugins
   * Uses first-match strategy - iterates through plugins in registration order
   */
  async createWidgetFromData(
    data: any,
    position: { x: number; y: number }
  ): Promise<Widget | null> {
    const registry = getWidgetRegistry();
    
    // Get all registered factories
    const allTypes = registry.getAllTypes();
    
    // Try each factory in order until one can handle the data
    for (const typeDefinition of allTypes) {
      const factory = registry.getFactory(typeDefinition.type);
      
      if (factory && factory.canHandle(data)) {
        try {
          console.log(`🏭 Creating ${typeDefinition.type} widget from data:`, data);
          
          // Create the widget using the factory
          const widget = await registry.createWidget(
            typeDefinition.type,
            data,
            position
          );
          
          if (widget) {
            console.log(`✅ Successfully created ${typeDefinition.type} widget:`, widget);
            return widget;
          }
        } catch (error) {
          console.error(`❌ Failed to create ${typeDefinition.type} widget:`, error);
          // Continue to next factory instead of failing completely
          continue;
        }
      }
    }
    
    console.warn('⚠️ No widget factory could handle the provided data:', data);
    return null;
  }

  /**
   * Checks if any registered plugin can handle the provided data
   */
  canHandleData(data: any): boolean {
    const registry = getWidgetRegistry();
    const supportedTypes = registry.canHandleData(data);
    return supportedTypes.length > 0;
  }

  /**
   * Gets all widget types that can handle the provided data
   */
  getSupportedTypes(data: any): string[] {
    const registry = getWidgetRegistry();
    return registry.canHandleData(data);
  }

  /**
   * Handles paste events - extracts data from clipboard and creates appropriate widgets
   */
  async handlePasteEvent(
    event: ClipboardEvent,
    position: { x: number; y: number }
  ): Promise<Widget[]> {
    const widgets: Widget[] = [];
    
    if (!event.clipboardData) {
      return widgets;
    }

    // Handle files from clipboard
    const files = Array.from(event.clipboardData.files);
    for (const file of files) {
      const widget = await this.createWidgetFromData(file, position);
      if (widget) {
        widgets.push(widget);
        // Offset position for multiple items
        position.x += 20;
        position.y += 20;
      }
    }

    // Handle text data if no files were processed
    if (widgets.length === 0) {
      const textData = event.clipboardData.getData('text/plain');
      if (textData && textData.trim()) {
        const widget = await this.createWidgetFromData(textData, position);
        if (widget) {
          widgets.push(widget);
        }
      }
    }

    // Handle HTML data as fallback
    if (widgets.length === 0) {
      const htmlData = event.clipboardData.getData('text/html');
      if (htmlData && htmlData.trim()) {
        const widget = await this.createWidgetFromData(htmlData, position);
        if (widget) {
          widgets.push(widget);
        }
      }
    }

    return widgets;
  }

  /**
   * Handles drop events - extracts data from drag and creates appropriate widgets
   */
  async handleDropEvent(
    event: DragEvent,
    position: { x: number; y: number }
  ): Promise<Widget[]> {
    const widgets: Widget[] = [];
    
    if (!event.dataTransfer) {
      return widgets;
    }

    // Handle files from drag and drop
    const files = Array.from(event.dataTransfer.files);
    for (const file of files) {
      const widget = await this.createWidgetFromData(file, position);
      if (widget) {
        widgets.push(widget);
        // Offset position for multiple items
        position.x += 20;
        position.y += 20;
      }
    }

    // Handle text data if no files were processed
    if (widgets.length === 0) {
      const textData = event.dataTransfer.getData('text/plain');
      if (textData && textData.trim()) {
        const widget = await this.createWidgetFromData(textData, position);
        if (widget) {
          widgets.push(widget);
        }
      }
    }

    // Handle URL data
    if (widgets.length === 0) {
      const urlData = event.dataTransfer.getData('text/uri-list');
      if (urlData && urlData.trim()) {
        const widget = await this.createWidgetFromData(urlData, position);
        if (widget) {
          widgets.push(widget);
        }
      }
    }

    return widgets;
  }
}

// Export singleton instance
export const genericWidgetFactory = new GenericWidgetFactory();

// Helper function to get the global factory
export function getGenericWidgetFactory(): GenericWidgetFactory {
  return genericWidgetFactory;
}