import { BrowserWebSocketClientAdapter } from "@automerge/automerge-repo-network-websocket";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {
  configureSyncEngine,
  getSyncEngine,
  ls,
  readDoc,
  writeDoc,
} from "@tonk/keepsync";
import WebSocket from "ws";
import * as fs from "fs/promises";
import * as path from "path";
import { DOCUMENT_IDS } from "./config/documentIds.js";
import { pluginDevelopmentTools } from "./tools/pluginDevelopmentTools.js";

// Polyfill WebSocket for Node.js environment
global.WebSocket = WebSocket as any;

/**
 * MCP Server for Keepsync Store Access & Filesystem Operations
 *
 * Provides Claude/Groq with access to read and write zustand/keepsync stores
 * as well as filesystem operations. Used by the pinboard application for 
 * collaborative state management and file operations.
 */

// Type definitions for keepsync documents
interface WidgetStoreData {
  widgets: any[];
  lastModified: number;
}

interface ContentStoreData {
  content: Record<string, any>;
  lastModified: number;
}

class KeepsyncMCPServer {
  private server: Server;
  private syncEngineInitialized = false;
  private widgetWriteLock = false;
  private contentWriteLock = false;

  /**
   * Helper function to remove undefined values recursively
   */
  private removeUndefined(obj: any): any {
    if (obj === null || typeof obj !== "object") return obj;
    if (Array.isArray(obj)) return obj.map(this.removeUndefined.bind(this));
    
    const cleaned: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = this.removeUndefined(value);
      }
    }
    return cleaned;
  }

  constructor() {
    this.server = new Server(
      {
        name: "keepsync-store-server",
        version: "1.0.0",
      },
      {
        capabilities: {
          resources: {},
          tools: {},
        },
      },
    );

    this.setupHandlers();
  }

  private async initializeSyncEngine() {
    if (this.syncEngineInitialized) return;

    try {
      // Connect to the keepsync server on port 7777 (same as frontend)
      const wsUrl = "ws://localhost:7777/sync";
      const wsAdapter = new BrowserWebSocketClientAdapter(wsUrl);

      await configureSyncEngine({
        url: "http://localhost:7777",
        network: [wsAdapter as any],
        storage: undefined, // No storage for MCP server, just read-only access
      });

      const engine = await getSyncEngine();
      if (!engine) {
        throw new Error("Failed to get sync engine");
      }

      console.log("⏳ Waiting for sync engine to be ready...");
      await engine.whenReady();

      this.syncEngineInitialized = true;
      console.log("✅ MCP Server: Keepsync connection initialized");
    } catch (error) {
      console.error(
        "❌ MCP Server: Failed to initialize keepsync connection:",
        error,
      );
      throw error;
    }
  }

  private async handleReadDoc(args: Record<string, unknown>) {
    const doc = await readDoc(args.path as string);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(doc, null, 2),
        },
      ],
    };
  }

  private async handleWriteDoc(args: Record<string, unknown>) {
    await writeDoc(args.path as string, args.content);
    return {
      content: [
        {
          type: "text",
          text: `Successfully wrote to document: ${args.path}`,
        },
      ],
    };
  }

  private async handleListDocs(args: Record<string, unknown>) {
    const docs = await ls((args.path as string) || "/");
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(docs, null, 2),
        },
      ],
    };
  }

  private async handleAddWidget(args: Record<string, unknown>) {
    // Read current widget store
    const widgetStoreRaw = await readDoc(DOCUMENT_IDS.WIDGETS);
    const widgetStore: WidgetStoreData = (widgetStoreRaw as WidgetStoreData) || {
      widgets: [],
      lastModified: 0,
    };

    // Extract position and size from args to match frontend Widget structure
    const position = args.position as { x: number; y: number };
    const size = args.size as { width: number; height: number };
    
    // Generate new widget matching frontend Widget interface
    const newWidget = {
      id: `widget_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: args.type as string,
      // Frontend expects flat structure, not nested position/size objects
      x: position.x,
      y: position.y,
      width: size.width,
      height: size.height,
      rotation: 0,
      zIndex: widgetStore.widgets.length,
      locked: false,
      selected: false,
      contentId: `content_${Date.now()}`, // Always create contentId for all widgets
      metadata: {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // Create completely clean objects with deep serialization to avoid Automerge reference issues
    const cleanWidget = this.removeUndefined(JSON.parse(JSON.stringify(newWidget)));
    const existingWidgets = this.removeUndefined(JSON.parse(JSON.stringify(widgetStore.widgets || [])));
    
    const updatedWidgetStore = {
      widgets: [...existingWidgets, cleanWidget],
      lastModified: Date.now(),
    };

    // Ensure the entire store is clean
    const cleanStore = this.removeUndefined(JSON.parse(JSON.stringify(updatedWidgetStore)));
    
    // Save updated store
    await writeDoc(DOCUMENT_IDS.WIDGETS, cleanStore);

    // Always create content if contentId exists, even if args.content is empty
    if (newWidget.contentId) {
      console.log(`🔍 Creating content for widget ${newWidget.id} with contentId ${newWidget.contentId}`);
      console.log(`🔍 args.content:`, args.content);
      
      const contentStoreRaw = await readDoc(DOCUMENT_IDS.CONTENT);
      const contentStore: ContentStoreData = (contentStoreRaw as ContentStoreData) || {
        content: {},
        lastModified: 0,
      };
      
      // Ensure content is always created with proper defaults based on widget type
      let contentData;
      const widgetType = args.type as string;
      
      if (args.content && typeof args.content === 'object') {
        const providedContent = JSON.parse(JSON.stringify(args.content));
        
        // Apply field name mapping based on widget type to match frontend expectations
        switch (widgetType) {
          case 'note':
            contentData = {
              content: providedContent.text || providedContent.content || '', // Map 'text' to 'content'
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
              title: providedContent.title || 'New Todo List', // Ensure title always exists
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
            contentData = providedContent; // Use as-is for unknown types
        }
      } else {
        // Create appropriate default content based on widget type
        switch (widgetType) {
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
            contentData = {
              title: 'New Todo List',
              items: []
            };
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
            contentData = {}; // Fallback for unknown types
        }
      }
        
      console.log(`🔍 Processed contentData:`, contentData);
      
      const contentEntry = {
        id: newWidget.contentId,
        type: args.type as string,
        data: contentData, // Wrap content in data field to match frontend
        lastModified: Date.now(),
        size: JSON.stringify(contentData).length, // Calculate approximate size
      };
      
      // Create completely clean objects to avoid Automerge reference issues
      const existingContent = this.removeUndefined(JSON.parse(JSON.stringify(contentStore.content || {})));
      const cleanContentEntry = this.removeUndefined(JSON.parse(JSON.stringify(contentEntry)));
      
      const updatedContentStore = {
        content: {
          ...existingContent,
          [newWidget.contentId!]: cleanContentEntry
        },
        lastModified: Date.now(),
      };
      
      // Ensure the entire content store is clean
      const cleanContentStore = this.removeUndefined(JSON.parse(JSON.stringify(updatedContentStore)));
      
      await writeDoc(DOCUMENT_IDS.CONTENT, cleanContentStore);
    }

    const contentInfo = args.content ? " with content" : "";
    const summary = `## ✅ Widget Added Successfully

**Widget Details:**
- Type: **${newWidget.type}**
- ID: \`${newWidget.id}\`
- Position: (${newWidget.x}, ${newWidget.y})
- Size: ${newWidget.width} × ${newWidget.height}
- Z-Index: ${newWidget.zIndex}
- Has Content: ${newWidget.contentId ? 'Yes' : 'No'}

The widget has been added to the pinboard${contentInfo} and is now available for interaction.`;

    return {
      content: [
        {
          type: "text",
          text: `${summary}\n\n**Technical Data:**\n\`\`\`json\n${JSON.stringify(newWidget, null, 2)}\n\`\`\``,
        },
      ],
    };
  }

  private async handleUpdateWidget(args: Record<string, unknown>) {
    // Read current widget store
    const widgetStoreRaw = await readDoc(DOCUMENT_IDS.WIDGETS);
    const widgetStore: WidgetStoreData = (widgetStoreRaw as WidgetStoreData) || {
      widgets: [],
      lastModified: 0,
    };

    // Find and update widget
    const widgetIndex = widgetStore.widgets.findIndex(
      (w: any) => w.id === args.id,
    );
    if (widgetIndex === -1) {
      throw new Error(`Widget not found: ${args.id}`);
    }

    // Create completely clean objects to avoid Automerge reference issues
    const existingWidgets = JSON.parse(JSON.stringify(widgetStore.widgets || []));
    const updates = JSON.parse(JSON.stringify(args.updates || {}));
    
    // Update the specific widget with clean data
    existingWidgets[widgetIndex] = {
      ...existingWidgets[widgetIndex],
      ...updates,
      updatedAt: Date.now(),
    };
    
    const updatedWidgetStore = {
      widgets: existingWidgets,
      lastModified: Date.now(),
    };

    // Ensure the entire store is clean
    const cleanStore = this.removeUndefined(JSON.parse(JSON.stringify(updatedWidgetStore)));
    
    // Save updated store
    await writeDoc(DOCUMENT_IDS.WIDGETS, cleanStore);

    return {
      content: [
        {
          type: "text",
          text: `Successfully updated widget: ${args.id}`,
        },
      ],
    };
  }

  private async handleUpdateWidgetContent(args: Record<string, unknown>) {
    let contentId = args.contentId as string;
    const updates = args.updates as Record<string, unknown>;

    // Read current content store
    const contentStoreRaw = await readDoc(DOCUMENT_IDS.CONTENT);
    const contentStore: ContentStoreData = (contentStoreRaw as ContentStoreData) || {
      content: {},
      lastModified: 0,
    };

    // Auto-correct if widget ID was passed instead of content ID
    if (contentId.startsWith('widget_')) {
      console.log(`⚠️  Widget ID passed instead of content ID: ${contentId}`);
      
      // Read widget store to find the correct content ID
      const widgetStoreRaw = await readDoc(DOCUMENT_IDS.WIDGETS);
      const widgetStore: WidgetStoreData = (widgetStoreRaw as WidgetStoreData) || {
        widgets: [],
        lastModified: 0,
      };
      const widget = widgetStore.widgets.find((w: any) => w.id === contentId);
      
      if (widget && widget.contentId) {
        console.log(`🔄 Auto-correcting to content ID: ${widget.contentId}`);
        contentId = widget.contentId;
      } else {
        throw new Error(`Widget not found or has no content: ${contentId}`);
      }
    }

    // Check if content exists
    if (!contentStore.content[contentId]) {
      throw new Error(`Content not found: ${contentId}`);
    }

    // Create completely clean objects to avoid Automerge reference issues
    const existingContent = JSON.parse(JSON.stringify(contentStore.content || {}));
    const cleanUpdates = JSON.parse(JSON.stringify(updates));
    
    // Update the specific content with clean data
    // Map 'text' field to 'content' field for note widgets to match frontend expectations
    const mappedUpdates = { ...cleanUpdates };
    if (mappedUpdates.text && existingContent[contentId].type === 'note') {
      mappedUpdates.content = mappedUpdates.text;
      delete mappedUpdates.text;
    }
    
    // Enhanced smart merge: handle deeply nested structures from AI models
    let mergedData;
    
    // Detect and flatten recursive nesting (Kimi model tends to do this)
    const flattenNestedData = (data: any): any => {
      // If data contains another data object, recursively flatten
      if (data && typeof data === 'object' && data.data && typeof data.data === 'object') {
        console.log('🔄 Detected recursive nesting, flattening...');
        return flattenNestedData(data.data);
      }
      return data;
    };
    
    if (mappedUpdates.data && typeof mappedUpdates.data === 'object') {
      // AI passed a nested data structure, flatten and merge at data level
      const flattenedData = flattenNestedData(mappedUpdates.data);
      mergedData = {
        ...existingContent[contentId].data,
        ...flattenedData,
      };
    } else {
      // AI passed flat updates, merge directly into data
      mergedData = {
        ...existingContent[contentId].data,
        ...mappedUpdates,
      };
    }
    
    // Additional safety check: if the final merged data contains recursive nesting, flatten it
    mergedData = flattenNestedData(mergedData);
    
    existingContent[contentId] = {
      ...existingContent[contentId],
      data: mergedData,
      lastModified: Date.now(),
    };
    
    const updatedContentStore = {
      content: existingContent,
      lastModified: Date.now(),
    };

    // Ensure the entire store is clean
    const cleanStore = JSON.parse(JSON.stringify(updatedContentStore));
    
    // Save updated content store
    await writeDoc(DOCUMENT_IDS.CONTENT, cleanStore);

    return {
      content: [
        {
          type: "text",
          text: `## ✅ Widget Content Updated Successfully

**Content ID:** \`${contentId}\`
**Updated fields:** ${Object.keys(cleanUpdates).join(', ')}

The widget content has been updated and changes should be visible on the pinboard.`,
        },
      ],
    };
  }

  private async handleRemoveWidget(args: Record<string, unknown>) {
    // Read current widget store
    const widgetStoreRaw = await readDoc(DOCUMENT_IDS.WIDGETS);
    const widgetStore: WidgetStoreData = (widgetStoreRaw as WidgetStoreData) || {
      widgets: [],
      lastModified: 0,
    };

    // Find widget
    const widgetIndex = widgetStore.widgets.findIndex(
      (w: any) => w.id === args.id,
    );
    if (widgetIndex === -1) {
      throw new Error(`Widget not found: ${args.id}`);
    }

    // Remove widget
    const removedWidget = widgetStore.widgets.splice(widgetIndex, 1)[0];
    widgetStore.lastModified = Date.now();

    // Save updated store
    await writeDoc(DOCUMENT_IDS.WIDGETS, widgetStore);

    // Also remove content if it exists
    if (removedWidget.contentId) {
      const contentStoreRaw = await readDoc(DOCUMENT_IDS.CONTENT);
      const contentStore: ContentStoreData = (contentStoreRaw as ContentStoreData) || {
        content: {},
        lastModified: 0,
      };
      delete contentStore.content[removedWidget.contentId];
      contentStore.lastModified = Date.now();
      await writeDoc(DOCUMENT_IDS.CONTENT, contentStore);
    }

    return {
      content: [
        {
          type: "text",
          text: `Successfully removed widget: ${args.id}`,
        },
      ],
    };
  }

  private async handleReadFile(args: Record<string, unknown>) {
    try {
      const filePath = args.path as string;
      const encoding = (args.encoding as string) || "utf8";
      
      if (!filePath) {
        throw new Error("Path is required");
      }
      
      // Security: Prevent path traversal attacks
      const normalizedPath = path.normalize(filePath);
      if (normalizedPath.includes("..")) {
        throw new Error("Path traversal not allowed");
      }

      // Get absolute path from project root
      const projectRoot = process.cwd();
      const absolutePath = path.resolve(projectRoot, normalizedPath);
      
      // Ensure path is within project directory
      if (!absolutePath.startsWith(projectRoot)) {
        throw new Error("Access outside project directory not allowed");
      }

      const content = await fs.readFile(absolutePath, encoding as BufferEncoding);
      const stats = await fs.stat(absolutePath);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              path: filePath,
              content,
              size: stats.size,
              encoding,
              lastModified: stats.mtime.toISOString(),
            }, null, 2),
          },
        ],
      };
    } catch (error: any) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to read file: ${error.message}`,
      );
    }
  }

  private async handleWriteFile(args: Record<string, unknown>) {
    try {
      const filePath = args.path as string;
      const content = args.content as string;
      const encoding = (args.encoding as string) || "utf8";
      
      if (!filePath || content === undefined) {
        throw new Error("Path and content are required");
      }
      
      // Security: Prevent path traversal attacks
      const normalizedPath = path.normalize(filePath);
      if (normalizedPath.includes("..")) {
        throw new Error("Path traversal not allowed");
      }

      // Get absolute path from project root
      const projectRoot = process.cwd();
      const absolutePath = path.resolve(projectRoot, normalizedPath);
      
      // Ensure path is within project directory
      if (!absolutePath.startsWith(projectRoot)) {
        throw new Error("Access outside project directory not allowed");
      }

      // Ensure directory exists
      const dir = path.dirname(absolutePath);
      await fs.mkdir(dir, { recursive: true });

      await fs.writeFile(absolutePath, content, encoding as BufferEncoding);
      const stats = await fs.stat(absolutePath);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              path: filePath,
              size: stats.size,
              encoding,
              lastModified: stats.mtime.toISOString(),
              message: `Successfully wrote ${stats.size} bytes to ${filePath}`,
            }, null, 2),
          },
        ],
      };
    } catch (error: any) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to write file: ${error.message}`,
      );
    }
  }

  private async handleListDirectory(args: Record<string, unknown>) {
    try {
      const dirPath = (args.path as string) || ".";
      
      // Security: Prevent path traversal attacks
      const normalizedPath = path.normalize(dirPath);
      if (normalizedPath.includes("..")) {
        throw new Error("Path traversal not allowed");
      }

      // Get absolute path from project root
      const projectRoot = process.cwd();
      const absolutePath = path.resolve(projectRoot, normalizedPath);
      
      // Ensure path is within project directory
      if (!absolutePath.startsWith(projectRoot)) {
        throw new Error("Access outside project directory not allowed");
      }

      const items = await fs.readdir(absolutePath, { withFileTypes: true });
      const result = {
        currentPath: dirPath,
        items: items.map((item) => ({
          name: item.name,
          type: item.isDirectory() ? "directory" : "file",
          isSymlink: item.isSymbolicLink(),
        })),
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error: any) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to list directory: ${error.message}`,
      );
    }
  }

  private setupHandlers() {
    // List available resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      await this.initializeSyncEngine();

      try {
        const resources = [
          {
            uri: "pinboard://widgets",
            mimeType: "application/json",
            name: "📌 All Pinboard Widgets",
            description:
              "All widgets currently on the pinboard: notes, todos, calculators, images, etc. with their positions and properties",
          },
          {
            uri: "pinboard://content",
            mimeType: "application/json",
            name: "📝 Widget Content & Text",
            description:
              "The actual content inside widgets: note text, todo items, calculator values, image URLs, etc.",
          },
          {
            uri: "pinboard://ui-state",
            mimeType: "application/json",
            name: "🖱️ Current UI State",
            description:
              "What's currently selected, canvas zoom/position, and interaction mode",
          },
        ];

        return { resources };
      } catch (error) {
        throw new McpError(
          ErrorCode.InternalError,
          `Failed to list resources: ${error}`,
        );
      }
    });

    // Read resource content
    this.server.setRequestHandler(
      ReadResourceRequestSchema,
      async (request) => {
        await this.initializeSyncEngine();

        const { uri } = request.params;

        try {
          if (uri === "pinboard://widgets") {
            const widgetData = await readDoc(DOCUMENT_IDS.WIDGETS);
            return {
              contents: [
                {
                  uri,
                  mimeType: "application/json",
                  text: JSON.stringify(
                    widgetData || { widgets: [], lastModified: 0 },
                    null,
                    2,
                  ),
                },
              ],
            };
          }

          if (uri === "pinboard://content") {
            const contentData = await readDoc(DOCUMENT_IDS.CONTENT);
            return {
              contents: [
                {
                  uri,
                  mimeType: "application/json",
                  text: JSON.stringify(
                    contentData || { content: {}, lastModified: 0 },
                    null,
                    2,
                  ),
                },
              ],
            };
          }

          if (uri === "pinboard://ui-state") {
            const uiData = await readDoc(DOCUMENT_IDS.UI_STATE);
            return {
              contents: [
                {
                  uri,
                  mimeType: "application/json",
                  text: JSON.stringify(
                    uiData || {
                      selection: [],
                      canvasTransform: { x: 0, y: 0, scale: 1 },
                    },
                    null,
                    2,
                  ),
                },
              ],
            };
          }

          if (uri === "keepsync://documents/list") {
            const documents = await ls("/");
            return {
              contents: [
                {
                  uri,
                  mimeType: "application/json",
                  text: JSON.stringify({ documents }, null, 2),
                },
              ],
            };
          }

          throw new McpError(
            ErrorCode.InvalidRequest,
            `Unknown resource: ${uri}`,
          );
        } catch (error) {
          throw new McpError(
            ErrorCode.InternalError,
            `Failed to read resource: ${error}`,
          );
        }
      },
    );

    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: "view_all_pinboard_widgets",
            description:
              "See all widgets currently on the pinboard (notes, todos, calculators, images, etc.) with their positions and properties",
            inputSchema: {
              type: "object",
              properties: {},
            },
          },
          {
            name: "view_widget_content",
            description:
              "Get the actual content/text of widgets (what's written inside notes, todo items, etc.)",
            inputSchema: {
              type: "object",
              properties: {},
            },
          },
          {
            name: "view_pinboard_ui_state",
            description:
              "See the current UI state: what's selected, canvas position/zoom, and interaction mode",
            inputSchema: {
              type: "object",
              properties: {},
            },
          },
          {
            name: "add_pinboard_widget",
            description:
              "Add a new widget to the pinboard (note, todo list, calculator, image, etc.)",
            inputSchema: {
              type: "object",
              properties: {
                type: {
                  type: "string",
                  description: "Type of widget to add",
                  enum: [
                    "note",
                    "todo",
                    "calculator",
                    "image",
                    "document",
                    "url",
                    "chat",
                    "youtube",
                  ],
                },
                position: {
                  type: "object",
                  properties: {
                    x: {
                      type: "number",
                      description: "X coordinate on the pinboard",
                    },
                    y: {
                      type: "number",
                      description: "Y coordinate on the pinboard",
                    },
                  },
                  required: ["x", "y"],
                },
                size: {
                  type: "object",
                  properties: {
                    width: {
                      type: "number",
                      description: "Widget width in pixels",
                    },
                    height: {
                      type: "number",
                      description: "Widget height in pixels",
                    },
                  },
                  required: ["width", "height"],
                },
                content: {
                  type: "object",
                  description:
                    "Initial content (e.g., text for notes, items for todos)",
                },
              },
              required: ["type", "position", "size"],
            },
          },
          {
            name: "update_pinboard_widget",
            description:
              "Update widget properties like position, size, rotation, z-index (NOT content - use update_widget_content for that). IMPORTANT: Use exact widget ID from view_all_pinboard_widgets and nest properties inside 'updates' object.",
            inputSchema: {
              type: "object",
              properties: {
                id: {
                  type: "string",
                  description: "EXACT Widget ID from view_all_pinboard_widgets (format: widget_XXXXX_XXXXX). NOT contentId!",
                },
                updates: {
                  type: "object",
                  description: "Widget properties to update. Example: {\"x\": 100, \"y\": 200, \"width\": 300, \"height\": 150}",
                  properties: {
                    id: { type: "string", description: "EXACT Widget ID from view_all_pinboard_widgets (format: widget_XXXXX_XXXXX). NOT contentId!" },
                    x: { type: "number", description: "X coordinate" },
                    y: { type: "number", description: "Y coordinate" },
                    width: { type: "number", description: "Widget width" },
                    height: { type: "number", description: "Widget height" },
                    rotation: { type: "number", description: "Rotation in degrees" },
                    zIndex: { type: "number", description: "Z-index for layering" },
                    locked: { type: "boolean", description: "Whether widget is locked" }
                  }
                },
              },
              required: ["id", "updates"],
            },
          },
          {
            name: "remove_pinboard_widget",
            description: "Remove/delete a widget from the pinboard completely",
            inputSchema: {
              type: "object",
              properties: {
                id: {
                  type: "string",
                  description: "ID of the widget to remove",
                },
              },
              required: ["id"],
            },
          },
          {
            name: "update_widget_content",
            description: "Update the content/text inside a widget (separate from widget properties like position/size). IMPORTANT: Use the exact contentId shown in view_all_pinboard_widgets output.",
            inputSchema: {
              type: "object",
              properties: {
                contentId: {
                  type: "string",
                  description: "EXACT Content ID from view_all_pinboard_widgets (format: content_ck2act_XXXXXXXXX or similar). Do NOT modify or guess the ID.",
                },
                updates: {
                  type: "object",
                  description: "Content data to update (e.g., text, items, settings)",
                },
              },
              required: ["contentId", "updates"],
            },
          },
          {
            name: "read_file",
            description: "Read contents of a file in the project",
            inputSchema: {
              type: "object",
              properties: {
                path: {
                  type: "string",
                  description: "File path relative to project root",
                },
                encoding: {
                  type: "string",
                  description: "File encoding (default: utf8)",
                  enum: ["utf8", "ascii", "base64", "hex"],
                },
              },
              required: ["path"],
            },
          },
          {
            name: "write_file",
            description: "Write content to a file in the project",
            inputSchema: {
              type: "object",
              properties: {
                path: {
                  type: "string",
                  description: "File path relative to project root",
                },
                content: {
                  type: "string",
                  description: "Content to write to the file",
                },
                encoding: {
                  type: "string",
                  description: "File encoding (default: utf8)",
                  enum: ["utf8", "ascii", "base64", "hex"],
                },
              },
              required: ["path", "content"],
            },
          },
          {
            name: "list_directory",
            description: "List contents of a directory in the project",
            inputSchema: {
              type: "object",
              properties: {
                path: {
                  type: "string",
                  description: "Directory path relative to project root (default: current directory)",
                },
              },
            },
          },
          // Plugin Development Tools
          {
            name: "analyze_existing_plugins",
            description: "Analyze existing plugins to understand patterns and structures for generating new plugins",
            inputSchema: {
              type: "object",
              properties: {
                category: {
                  type: "string",
                  description: "Plugin category to focus analysis on",
                  enum: ["text", "media", "document", "web", "app", "layout", "other"],
                },
              },
            },
          },
          {
            name: "scaffold_plugin",
            description: "Generate complete plugin directory structure and base files",
            inputSchema: {
              type: "object",
              properties: {
                name: {
                  type: "string",
                  description: "Plugin name (e.g., 'weather', 'countdown-timer')",
                },
                description: {
                  type: "string",
                  description: "What the plugin does",
                },
                category: {
                  type: "string",
                  description: "Plugin category",
                  enum: ["text", "media", "document", "web", "app", "layout", "other"],
                },
                features: {
                  type: "array",
                  items: { type: "string" },
                  description: "List of features the plugin should have",
                },
              },
              required: ["name", "description", "category"],
            },
          },
          {
            name: "generate_plugin_code",
            description: "Generate TypeScript code for plugin factory, renderer, and types",
            inputSchema: {
              type: "object",
              properties: {
                name: {
                  type: "string",
                  description: "Plugin name",
                },
                description: {
                  type: "string",
                  description: "Plugin description",
                },
                category: {
                  type: "string",
                  description: "Plugin category",
                },
                features: {
                  type: "array",
                  items: { type: "string" },
                  description: "Plugin features",
                },
                apiIntegrations: {
                  type: "array",
                  items: { type: "string" },
                  description: "External APIs to integrate",
                },
              },
              required: ["name", "description", "category"],
            },
          },
          {
            name: "update_plugin_index",
            description: "Update the main plugin index file to register the new plugin",
            inputSchema: {
              type: "object",
              properties: {
                pluginName: {
                  type: "string",
                  description: "Name of the plugin to register",
                },
              },
              required: ["pluginName"],
            },
          },
          {
            name: "validate_plugin_code",
            description: "Validate generated plugin code for TypeScript errors and best practices",
            inputSchema: {
              type: "object",
              properties: {
                pluginPath: {
                  type: "string",
                  description: "Path to the plugin directory to validate",
                },
              },
              required: ["pluginPath"],
            },
          },
          {
            name: "trigger_hmr_reload",
            description: "Trigger Hot Module Replacement to reload the application with new plugin",
            inputSchema: {
              type: "object",
              properties: {},
            },
          },
        ],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      await this.initializeSyncEngine();

      const { name, arguments: args } = request.params;

      if (!args) {
        throw new McpError(ErrorCode.InvalidParams, "Missing arguments");
      }

      try {
        switch (name) {
          case "view_all_pinboard_widgets": {
            const widgetData = await readDoc(DOCUMENT_IDS.WIDGETS) as any;
            const contentData = await readDoc(DOCUMENT_IDS.CONTENT) as any;
            
            const safeWidgetData = widgetData || { widgets: [], lastModified: 0 };
            const safeContentData = contentData || { content: {}, lastModified: 0 };
            
            const summary = safeWidgetData.widgets.length > 0 
              ? `Found ${safeWidgetData.widgets.length} widgets on the pinboard:`
              : "The pinboard is currently empty.";
              
            const widgetList = safeWidgetData.widgets.map((w: any, idx: number) => {
              // Look up actual content from content store if contentId exists
              const hasContentId = w.contentId && w.contentId !== undefined;
              const actualContent = hasContentId ? safeContentData.content[w.contentId] : null;
              const contentStatus = actualContent 
                ? `Yes - ${actualContent.type} content` 
                : hasContentId 
                ? `Missing (contentId: ${w.contentId})` 
                : 'No';
              
              let contentPreview = '';
              if (actualContent) {
                // Show a preview of the content based on type
                if (actualContent.data) {
                  const contentKeys = Object.keys(actualContent.data);
                  contentPreview = `\n   - Content preview: ${contentKeys.slice(0, 3).join(', ')}${contentKeys.length > 3 ? '...' : ''}`;
                }
              }
              
              return `${idx + 1}. **${w.type}** widget (ID: ${w.id})
   - Position: (${w.x}, ${w.y})
   - Size: ${w.width} × ${w.height}
   - Created: ${new Date(w.createdAt || 0).toLocaleString()}
   - **CONTENT ID FOR UPDATES: \`${w.contentId}\`** (use this exact ID for update_widget_content tool)
   - Content status: ${contentStatus}${contentPreview}`;
            }).join('\n\n');
            
            return {
              content: [
                {
                  type: "text",
                  text: `## 📌 Pinboard Widgets Overview\n\n${summary}\n\n${widgetList}\n\n**Widget Store Data:**\n\`\`\`json\n${JSON.stringify(safeWidgetData, null, 2)}\n\`\`\`\n\n**Content Store Data:**\n\`\`\`json\n${JSON.stringify(safeContentData, null, 2)}\n\`\`\``,
                },
              ],
            };
          }

          case "view_widget_content": {
            const contentData = await readDoc(DOCUMENT_IDS.CONTENT) as any;
            const safeData = contentData || { content: {}, lastModified: 0 };
            const contentEntries = Object.entries(safeData.content || {});
            
            const summary = contentEntries.length > 0 
              ? `Found content for ${contentEntries.length} widgets:`
              : "No widget content stored yet.";
              
            const contentList = contentEntries.map(([contentId, content]: [string, any], idx: number) => 
              `${idx + 1}. **${content.type}** content (ID: ${contentId})
   - Type: ${content.type}
   - Last modified: ${new Date(content.lastModified || 0).toLocaleString()}
   - Data keys: ${Object.keys(content.data || content).filter(k => k !== 'id' && k !== 'type' && k !== 'lastModified').join(', ') || 'None'}`
            ).join('\n\n');
            
            return {
              content: [
                {
                  type: "text",
                  text: `## 📝 Widget Content Overview\n\n${summary}\n\n${contentList}\n\n**Technical Data:**\n\`\`\`json\n${JSON.stringify(safeData, null, 2)}\n\`\`\``,
                },
              ],
            };
          }

          case "view_pinboard_ui_state": {
            const uiStateData = await readDoc(DOCUMENT_IDS.UI_STATE) as any;
            const safeData = uiStateData || { selection: [], canvasTransform: { x: 0, y: 0, scale: 1 } };
            
            const transform = safeData.canvasTransform || { x: 0, y: 0, scale: 1 };
            const selection = safeData.selection || [];
            
            const summary = `## 🖱️ Pinboard UI State Overview

**Canvas View:**
- Position: (${transform.x}, ${transform.y})
- Zoom level: ${transform.scale}x

**Selection:**
- Selected widgets: ${selection.length > 0 ? selection.join(', ') : 'None'}

**Current Mode:** ${safeData.mode || 'Default'}`;

            return {
              content: [
                {
                  type: "text",
                  text: `${summary}\n\n**Technical Data:**\n\`\`\`json\n${JSON.stringify(safeData, null, 2)}\n\`\`\``,
                },
              ],
            };
          }

          case "add_pinboard_widget": {
            return await this.handleAddWidget(args);
          }

          case "update_pinboard_widget": {
            return await this.handleUpdateWidget(args);
          }

          case "remove_pinboard_widget": {
            return await this.handleRemoveWidget(args);
          }

          case "update_widget_content": {
            return await this.handleUpdateWidgetContent(args);
          }

          case "read_file": {
            return await this.handleReadFile(args);
          }

          case "write_file": {
            return await this.handleWriteFile(args);
          }

          case "list_directory": {
            return await this.handleListDirectory(args);
          }

          // Plugin Development Tools
          case "analyze_existing_plugins": {
            return await pluginDevelopmentTools.analyzeExistingPlugins(args);
          }

          case "scaffold_plugin": {
            return await pluginDevelopmentTools.scaffoldPlugin(args);
          }

          case "generate_plugin_code": {
            return await pluginDevelopmentTools.generatePluginCode(args);
          }

          case "update_plugin_index": {
            return await pluginDevelopmentTools.updatePluginIndex(args);
          }

          case "validate_plugin_code": {
            return await pluginDevelopmentTools.validatePluginCode(args);
          }

          case "trigger_hmr_reload": {
            return await pluginDevelopmentTools.triggerHmrReload(args);
          }

          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`,
            );
        }
      } catch (error) {
        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${error}`,
        );
      }
    });
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.log("🚀 Keepsync MCP Server started");

    // Initialize sync engine immediately to test connection
    try {
      await this.initializeSyncEngine();
    } catch (error) {
      console.error(
        "⚠️ Warning: Could not connect to keepsync on startup:",
        error,
      );
    }
  }
}

// Export for use in other modules
export { KeepsyncMCPServer };

// If this file is run directly, start the server
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new KeepsyncMCPServer();
  server.start().catch((error) => {
    console.error("Failed to start MCP server:", error);
    process.exit(1);
  });
}
