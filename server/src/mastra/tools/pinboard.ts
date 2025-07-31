import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { 
  configureSyncEngine, 
  getSyncEngine, 
  readDoc, 
  writeDoc, 
  ls 
} from '@tonk/keepsync';
import { BrowserWebSocketClientAdapter } from '@automerge/automerge-repo-network-websocket';
import WebSocket from 'ws';
import superjson from 'superjson';
import { DOCUMENT_IDS } from '../../config/documentIds.js';

// Polyfill WebSocket for Node.js environment
global.WebSocket = WebSocket as any;

// Keepsync initialization
let syncEngineInitialized = false;

// Helper function to safely serialize data for keepsync
function safeSerialize(data: any) {
  try {
    // Use superjson to handle complex objects, then parse/stringify to ensure clean JSON
    const serialized = superjson.stringify(data);
    const parsed = superjson.parse(serialized);
    return JSON.parse(JSON.stringify(parsed));
  } catch (error) {
    console.warn('Superjson serialization failed, falling back to JSON:', error);
    return JSON.parse(JSON.stringify(data));
  }
}

async function initializeSyncEngine() {
  if (syncEngineInitialized) return;

  try {
    const wsUrl = "ws://localhost:7777/sync";
    const wsAdapter = new BrowserWebSocketClientAdapter(wsUrl);

    await configureSyncEngine({
      url: "http://localhost:7777",
      network: [wsAdapter as any],
      storage: undefined,
    });

    const engine = await getSyncEngine();
    if (!engine) {
      throw new Error("Failed to get sync engine");
    }

    await engine.whenReady();
    syncEngineInitialized = true;
    console.log("✅ Mastra Tools: Keepsync connection initialized");
  } catch (error) {
    console.error("❌ Mastra Tools: Failed to initialize keepsync connection:", error);
    throw error;
  }
}

// Helper function to clean objects for Automerge
function removeUndefined(obj: any): any {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(removeUndefined);
  
  const cleaned: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      cleaned[key] = removeUndefined(value);
    }
  }
  return cleaned;
}

// View all pinboard widgets
export const viewAllPinboardWidgets = createTool({
  id: 'view_all_pinboard_widgets',
  description: 'Get all widgets currently on the pinboard with their positions, properties, and content information',
  inputSchema: z.object({}),
  outputSchema: z.object({
    summary: z.string(),
    widgetCount: z.number(),
    widgets: z.array(z.object({
      id: z.string(),
      type: z.string(),
      position: z.object({ x: z.number(), y: z.number() }),
      size: z.object({ width: z.number(), height: z.number() }),
      contentId: z.string().optional(),
      hasContent: z.boolean(),
      createdAt: z.number(),
    })),
  }),
  execute: async () => {
    await initializeSyncEngine();
    
    const widgetData = await readDoc(DOCUMENT_IDS.WIDGETS) as any;
    const contentData = await readDoc(DOCUMENT_IDS.CONTENT) as any;
    
    const safeWidgetData = widgetData || { widgets: [], lastModified: 0 };
    const safeContentData = contentData || { content: {}, lastModified: 0 };
    
    const widgets = safeWidgetData.widgets.map((w: any) => ({
      id: w.id,
      type: w.type,
      position: { x: w.x, y: w.y },
      size: { width: w.width, height: w.height },
      contentId: w.contentId,
      hasContent: !!(w.contentId && safeContentData.content[w.contentId]),
      createdAt: w.createdAt || new Date().toISOString(),
    }));

    return {
      summary: widgets.length > 0 
        ? `Found ${widgets.length} widgets on the pinboard`
        : "The pinboard is currently empty",
      widgetCount: widgets.length,
      widgets,
    };
  },
});

// Add new widget to pinboard
export const addPinboardWidget = createTool({
  id: 'add_pinboard_widget',
  description: 'Add a new widget to the pinboard with specified type, position, size, and optional content',
  inputSchema: z.object({
    type: z.enum(['note', 'todo', 'calculator', 'image', 'document', 'url', 'chat', 'youtube'])
      .describe('Type of widget to create'),
    position: z.object({
      x: z.number().describe('X coordinate on the pinboard'),
      y: z.number().describe('Y coordinate on the pinboard'),
    }),
    size: z.object({
      width: z.number().describe('Widget width in pixels'),
      height: z.number().describe('Widget height in pixels'),
    }),
    content: z.record(z.any()).optional()
      .describe('Initial content for the widget (varies by widget type)'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    widgetId: z.string(),
    contentId: z.string().optional(),
    message: z.string(),
  }),
  execute: async ({ context }) => {
    await initializeSyncEngine();
    
    const { type, position, size, content } = context;
    
    // Read current widget store
    const widgetStoreRaw = await readDoc(DOCUMENT_IDS.WIDGETS);
    const widgetStore = (widgetStoreRaw as any) || { widgets: [], lastModified: 0 };

    // Generate new widget
    const newWidget = {
      id: `widget_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      x: position.x,
      y: position.y,
      width: size.width,
      height: size.height,
      rotation: 0,
      zIndex: widgetStore.widgets.length,
      locked: false,
      selected: false,
      contentId: `content_${Date.now()}`,
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Clean and save widget using safe serialization
    const cleanWidget = removeUndefined(safeSerialize(newWidget));
    const existingWidgets = removeUndefined(safeSerialize(widgetStore.widgets || []));
    
    const updatedWidgetStore = {
      widgets: [...existingWidgets, cleanWidget],
      lastModified: new Date().toISOString(),
    };

    const cleanStore = removeUndefined(safeSerialize(updatedWidgetStore));
    await writeDoc(DOCUMENT_IDS.WIDGETS, cleanStore);

    // Create content if provided
    if (newWidget.contentId) {
      const contentStoreRaw = await readDoc(DOCUMENT_IDS.CONTENT);
      const contentStore = (contentStoreRaw as any) || { content: {}, lastModified: 0 };
      
      // Set up default content based on widget type
      let contentData;
      if (content && typeof content === 'object') {
        const providedContent = safeSerialize(content);
        
        switch (type) {
          case 'note':
            contentData = {
              content: providedContent.text || providedContent.content || '',
              backgroundColor: providedContent.backgroundColor || '#fef3c7',
              textColor: providedContent.textColor || '#1f2937',
              fontSize: providedContent.fontSize || 14,
              fontFamily: providedContent.fontFamily || 'system-ui, sans-serif',
              textAlign: providedContent.textAlign || 'left',
              formatting: providedContent.formatting || { bold: false, italic: false, underline: false }
            };
            break;
          case 'todo':
            contentData = {
              title: providedContent.title || 'New Todo List',
              items: providedContent.items || []
            };
            break;
          case 'chat':
            contentData = {
              messages: providedContent.messages || [],
              isTyping: providedContent.isTyping || false,
              settings: providedContent.settings || {
                maxMessages: 100,
                autoScroll: true,
                markdownRendering: { enabled: true, showThinkTags: true, expandThinkTagsByDefault: false, enableSyntaxHighlighting: true }
              }
            };
            break;
          case 'calculator':
            contentData = {
              display: providedContent.display || '0',
              history: providedContent.history || []
            };
            break;
          default:
            contentData = providedContent;
        }
      } else {
        // Default content for each widget type
        switch (type) {
          case 'note':
            contentData = {
              content: '',
              backgroundColor: '#fef3c7',
              textColor: '#1f2937',
              fontSize: 14,
              fontFamily: 'system-ui, sans-serif',
              textAlign: 'left',
              formatting: { bold: false, italic: false, underline: false }
            };
            break;
          case 'todo':
            contentData = { title: 'New Todo List', items: [] };
            break;
          case 'chat':
            contentData = {
              messages: [],
              isTyping: false,
              settings: {
                maxMessages: 100,
                autoScroll: true,
                markdownRendering: { enabled: true, showThinkTags: true, expandThinkTagsByDefault: false, enableSyntaxHighlighting: true }
              }
            };
            break;
          case 'calculator':
            contentData = { display: '0', history: [] };
            break;
          default:
            contentData = {};
        }
      }
      
      const contentEntry = {
        id: newWidget.contentId,
        type,
        data: contentData,
        lastModified: new Date().toISOString(),
        size: JSON.stringify(contentData).length,
      };
      
      const existingContent = removeUndefined(safeSerialize(contentStore.content || {}));
      const cleanContentEntry = removeUndefined(safeSerialize(contentEntry));
      
      const updatedContentStore = {
        content: {
          ...existingContent,
          [newWidget.contentId]: cleanContentEntry
        },
        lastModified: new Date().toISOString(),
      };
      
      const cleanContentStore = removeUndefined(safeSerialize(updatedContentStore));
      await writeDoc(DOCUMENT_IDS.CONTENT, cleanContentStore);
    }

    return {
      success: true,
      widgetId: newWidget.id,
      contentId: newWidget.contentId,
      message: `Successfully created ${type} widget at position (${position.x}, ${position.y})`,
    };
  },
});

// Update widget content
export const updateWidgetContent = createTool({
  id: 'update_widget_content',
  description: 'Update the content/text inside a widget using its content ID',
  inputSchema: z.object({
    contentId: z.string().describe('Content ID of the widget to update'),
    updates: z.record(z.any()).describe('Content updates to apply'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
    updatedFields: z.array(z.string()),
  }),
  execute: async ({ context }) => {
    await initializeSyncEngine();
    
    const { contentId, updates } = context;
    
    // Read current content store
    const contentStoreRaw = await readDoc(DOCUMENT_IDS.CONTENT);
    const contentStore = (contentStoreRaw as any) || { content: {}, lastModified: 0 };

    // Check if content exists
    if (!contentStore.content[contentId]) {
      throw new Error(`Content not found: ${contentId}`);
    }

    // Clean and merge updates using safe serialization
    const existingContent = safeSerialize(contentStore.content || {});
    const cleanUpdates = safeSerialize(updates);
    
    // Map 'text' field to 'content' field for note widgets
    const mappedUpdates = { ...cleanUpdates };
    if (mappedUpdates.text && existingContent[contentId].type === 'note') {
      mappedUpdates.content = mappedUpdates.text;
      delete mappedUpdates.text;
    }
    
    // Smart merge for nested data structures
    let mergedData;
    if (mappedUpdates.data && typeof mappedUpdates.data === 'object') {
      mergedData = {
        ...existingContent[contentId].data,
        ...mappedUpdates.data,
      };
    } else {
      mergedData = {
        ...existingContent[contentId].data,
        ...mappedUpdates,
      };
    }
    
    existingContent[contentId] = {
      ...existingContent[contentId],
      data: mergedData,
      lastModified: new Date().toISOString(),
    };
    
    const updatedContentStore = {
      content: existingContent,
      lastModified: new Date().toISOString(),
    };

    const cleanStore = safeSerialize(updatedContentStore);
    await writeDoc(DOCUMENT_IDS.CONTENT, cleanStore);

    return {
      success: true,
      message: `Successfully updated content for ${contentId}`,
      updatedFields: Object.keys(cleanUpdates),
    };
  },
});

// Update widget properties (position, size, etc.)
export const updateWidgetProperties = createTool({
  id: 'update_widget_properties',
  description: 'Update widget properties like position, size, rotation, z-index (not content)',
  inputSchema: z.object({
    widgetId: z.string().describe('Widget ID to update'),
    updates: z.object({
      x: z.number().optional(),
      y: z.number().optional(),
      width: z.number().optional(),
      height: z.number().optional(),
      rotation: z.number().optional(),
      zIndex: z.number().optional(),
      locked: z.boolean().optional(),
    }).describe('Properties to update'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  execute: async ({ context }) => {
    await initializeSyncEngine();
    
    const { widgetId, updates } = context;
    
    // Read current widget store
    const widgetStoreRaw = await readDoc(DOCUMENT_IDS.WIDGETS);
    const widgetStore = (widgetStoreRaw as any) || { widgets: [], lastModified: 0 };

    // Find widget
    const widgetIndex = widgetStore.widgets.findIndex((w: any) => w.id === widgetId);
    if (widgetIndex === -1) {
      throw new Error(`Widget not found: ${widgetId}`);
    }

    // Update widget using safe serialization
    const existingWidgets = safeSerialize(widgetStore.widgets || []);
    const cleanUpdates = safeSerialize(updates);
    
    existingWidgets[widgetIndex] = {
      ...existingWidgets[widgetIndex],
      ...cleanUpdates,
      updatedAt: new Date().toISOString(),
    };
    
    const updatedWidgetStore = {
      widgets: existingWidgets,
      lastModified: new Date().toISOString(),
    };

    const cleanStore = removeUndefined(safeSerialize(updatedWidgetStore));
    await writeDoc(DOCUMENT_IDS.WIDGETS, cleanStore);

    return {
      success: true,
      message: `Successfully updated widget ${widgetId}`,
    };
  },
});

// Remove widget from pinboard
export const removeWidget = createTool({
  id: 'remove_widget',
  description: 'Remove/delete a widget from the pinboard completely',
  inputSchema: z.object({
    widgetId: z.string().describe('ID of the widget to remove'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
    removedContentId: z.string().optional(),
  }),
  execute: async ({ context }) => {
    await initializeSyncEngine();
    
    const { widgetId } = context;
    
    // Read current widget store
    const widgetStoreRaw = await readDoc(DOCUMENT_IDS.WIDGETS);
    const widgetStore = (widgetStoreRaw as any) || { widgets: [], lastModified: 0 };

    // Find widget
    const widgetIndex = widgetStore.widgets.findIndex((w: any) => w.id === widgetId);
    if (widgetIndex === -1) {
      throw new Error(`Widget not found: ${widgetId}`);
    }

    // Remove widget
    const removedWidget = widgetStore.widgets.splice(widgetIndex, 1)[0];
    widgetStore.lastModified = new Date().toISOString();

    await writeDoc(DOCUMENT_IDS.WIDGETS, widgetStore);

    // Also remove content if it exists
    let removedContentId;
    if (removedWidget.contentId) {
      const contentStoreRaw = await readDoc(DOCUMENT_IDS.CONTENT);
      const contentStore = (contentStoreRaw as any) || { content: {}, lastModified: 0 };
      delete contentStore.content[removedWidget.contentId];
      contentStore.lastModified = new Date().toISOString();
      await writeDoc(DOCUMENT_IDS.CONTENT, contentStore);
      removedContentId = removedWidget.contentId;
    }

    return {
      success: true,
      message: `Successfully removed widget ${widgetId}`,
      removedContentId,
    };
  },
});

// Get pinboard UI state
export const getPinboardUIState = createTool({
  id: 'get_pinboard_ui_state',
  description: 'Get the current UI state including selection, canvas position, and zoom level',
  inputSchema: z.object({}),
  outputSchema: z.object({
    selection: z.array(z.string()),
    canvasTransform: z.object({
      x: z.number(),
      y: z.number(),
      scale: z.number(),
    }),
    mode: z.string().optional(),
  }),
  execute: async () => {
    await initializeSyncEngine();
    
    const uiStateData = await readDoc(DOCUMENT_IDS.UI_STATE) as any;
    const safeData = uiStateData || { 
      selection: [], 
      canvasTransform: { x: 0, y: 0, scale: 1 } 
    };
    
    return {
      selection: safeData.selection || [],
      canvasTransform: safeData.canvasTransform || { x: 0, y: 0, scale: 1 },
      mode: safeData.mode || 'default',
    };
  },
});

// Import workflow executor
import { executeWidgetCreationWorkflow } from './workflowExecutor.js';

// Export all tools as a collection
export const pinboardTools = {
  viewAllPinboardWidgets,
  addPinboardWidget,
  updateWidgetContent,
  updateWidgetProperties,
  removeWidget,
  getPinboardUIState,
  executeWidgetCreationWorkflow,
};