/**
 * MCP Internal Adapter
 * 
 * Provides internal server services with direct access to MCP tools,
 * enabling Groq and Claude services to use the same unified MCP infrastructure
 * without external CLI dependencies.
 */

import { KeepsyncMCPServer } from "../mcpServer.js";
import { DOCUMENT_IDS } from "../config/documentIds.js";
import type {
  Tool,
  CallToolResult,
  Resource,
  ResourceContents
} from "@modelcontextprotocol/sdk/types.js";

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
}

export interface MCPToolResult {
  content: Array<{
    type: string;
    text: string;
  }>;
}

export interface MCPResource {
  uri: string;
  mimeType: string;
  name: string;
  description: string;
}

/**
 * Internal MCP Adapter for server-side tool access
 */
export class MCPInternalAdapter {
  private mcpServer: KeepsyncMCPServer;
  private initialized = false;
  private syncEngineInitialized = false;

  constructor() {
    this.mcpServer = new KeepsyncMCPServer();
  }

  /**
   * Initialize the SyncEngine for keepsync operations
   */
  private async initializeSyncEngine(): Promise<void> {
    if (this.syncEngineInitialized) return;

    try {
      // Import keepsync configuration functions
      const { configureSyncEngine, getSyncEngine } = await import("@tonk/keepsync");
      const { BrowserWebSocketClientAdapter } = await import("@automerge/automerge-repo-network-websocket");
      const WebSocket = await import("ws");

      // Polyfill WebSocket for Node.js environment
      (global as any).WebSocket = WebSocket.default;

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

      console.log("⏳ MCP Adapter: Waiting for sync engine to be ready...");
      await engine.whenReady();

      this.syncEngineInitialized = true;
      console.log("✅ MCP Adapter: Keepsync connection initialized");
    } catch (error) {
      console.error("❌ MCP Adapter: Failed to initialize keepsync connection:", error);
      throw error;
    }
  }

  /**
   * Initialize the MCP adapter and start the internal server
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      console.log("🔧 Initializing MCP Internal Adapter...");
      
      // Initialize the sync engine for keepsync operations
      await this.initializeSyncEngine();
      
      this.initialized = true;
      console.log("✅ MCP Internal Adapter initialized");
    } catch (error) {
      console.error("❌ Failed to initialize MCP adapter:", error);
      throw error;
    }
  }

  /**
   * Get list of available MCP tools
   */
  async listTools(): Promise<MCPTool[]> {
    await this.initialize();

    // Define available tools (matching mcpServer.ts tools)
    const tools: MCPTool[] = [
      {
        name: "view_all_pinboard_widgets",
        description: "See all widgets currently on the pinboard (notes, todos, calculators, images, etc.) with their positions and properties",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "view_widget_content",
        description: "Get the actual content/text of widgets (what's written inside notes, todo items, etc.)",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "view_pinboard_ui_state",
        description: "See the current UI state: what's selected, canvas position/zoom, and interaction mode",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "add_pinboard_widget",
        description: "Add a new widget to the pinboard (note, todo list, calculator, image, etc.)",
        inputSchema: {
          type: "object",
          properties: {
            type: {
              type: "string",
              description: "Type of widget to add",
              enum: ["note", "todo", "calculator", "image", "document", "url", "chat", "youtube"],
            },
            position: {
              type: "object",
              properties: {
                x: { type: "number", description: "X coordinate on the pinboard" },
                y: { type: "number", description: "Y coordinate on the pinboard" },
              },
              required: ["x", "y"],
            },
            size: {
              type: "object",
              properties: {
                width: { type: "number", description: "Widget width in pixels" },
                height: { type: "number", description: "Widget height in pixels" },
              },
              required: ["width", "height"],
            },
            content: {
              type: "object",
              description: "Initial content (e.g., text for notes, items for todos)",
            },
          },
          required: ["type", "position", "size"],
        },
      },
      {
        name: "update_pinboard_widget",
        description: "Update widget properties like position, size, rotation, z-index (NOT content - use update_widget_content for that)",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "string", description: "Widget ID to update" },
            updates: { 
              type: "object", 
              description: "Widget properties to update (x, y, width, height, rotation, zIndex, locked, etc.)" 
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
            id: { type: "string", description: "ID of the widget to remove" },
          },
          required: ["id"],
        },
      },
      {
        name: "update_widget_content",
        description: "Update the content/text inside a widget (separate from widget properties like position/size)",
        inputSchema: {
          type: "object",
          properties: {
            contentId: {
              type: "string",
              description: "Content ID of the widget content to update",
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
            path: { type: "string", description: "File path relative to project root" },
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
            path: { type: "string", description: "File path relative to project root" },
            content: { type: "string", description: "Content to write to the file" },
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
    ];

    return tools;
  }

  /**
   * Get list of available MCP resources
   */
  async listResources(): Promise<MCPResource[]> {
    await this.initialize();

    const resources: MCPResource[] = [
      {
        uri: "pinboard://widgets",
        mimeType: "application/json",
        name: "📌 All Pinboard Widgets",
        description: "All widgets currently on the pinboard: notes, todos, calculators, images, etc. with their positions and properties",
      },
      {
        uri: "pinboard://content",
        mimeType: "application/json",
        name: "📝 Widget Content & Text",
        description: "The actual content inside widgets: note text, todo items, calculator values, image URLs, etc.",
      },
      {
        uri: "pinboard://ui-state",
        mimeType: "application/json",
        name: "🖱️ Current UI State",
        description: "What's currently selected, canvas zoom/position, and interaction mode",
      },
    ];

    return resources;
  }

  /**
   * Execute an MCP tool
   */
  async callTool(name: string, args: Record<string, unknown> = {}): Promise<MCPToolResult> {
    await this.initialize();

    try {
      // Use the server's internal tool handling by calling the private method via reflection
      // This is a workaround since we can't easily expose the internal methods
      const result = await this.executeToolDirectly(name, args);
      return result;
    } catch (error) {
      console.error(`MCP tool execution failed for ${name}:`, error);
      throw new Error(`Tool execution failed: ${error}`);
    }
  }

  /**
   * Read an MCP resource
   */
  async readResource(uri: string): Promise<string> {
    await this.initialize();

    try {
      const result = await this.readResourceDirectly(uri);
      return result;
    } catch (error) {
      console.error(`MCP resource read failed for ${uri}:`, error);
      throw new Error(`Resource read failed: ${error}`);
    }
  }

  /**
   * Direct tool execution (internal implementation)
   * This replicates the MCP server's tool logic for internal use
   */
  private async executeToolDirectly(name: string, args: Record<string, unknown>): Promise<MCPToolResult> {
    // Ensure sync engine is initialized before executing tools
    await this.initializeSyncEngine();
    
    // Import keepsync functions
    const { readDoc, writeDoc, ls } = await import("@tonk/keepsync");
    const fs = await import("fs/promises");
    const path = await import("path");

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
        const content = await readDoc(DOCUMENT_IDS.CONTENT);
        return {
          content: [
            {
              type: "text",
              text: `## 📝 Widget Content\n\n${JSON.stringify(content || { content: {}, lastModified: 0 }, null, 2)}`,
            },
          ],
        };
      }

      case "view_pinboard_ui_state": {
        const uiState = await readDoc(DOCUMENT_IDS.UI_STATE);
        return {
          content: [
            {
              type: "text",
              text: `## 🖱️ Pinboard UI State\n\n${JSON.stringify(uiState || { selection: [], canvasTransform: { x: 0, y: 0, scale: 1 } }, null, 2)}`,
            },
          ],
        };
      }

      case "add_pinboard_widget": {
        const widgetStore: any = (await readDoc(DOCUMENT_IDS.WIDGETS)) || { widgets: [], lastModified: 0 };
        
        // Extract position and size from args to match frontend structure
        const position = args.position as { x: number; y: number };
        const size = args.size as { width: number; height: number };
        
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
          contentId: args.content ? `content_${Date.now()}` : undefined,
          metadata: {},
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        // Create completely clean objects with deep serialization to avoid Automerge reference issues
        const cleanWidget = JSON.parse(JSON.stringify(newWidget));
        const existingWidgets = JSON.parse(JSON.stringify(widgetStore.widgets || []));
        
        const updatedWidgetStore = {
          widgets: [...existingWidgets, cleanWidget],
          lastModified: Date.now(),
        };

        // Ensure the entire store is clean
        const cleanStore = JSON.parse(JSON.stringify(updatedWidgetStore));
        
        await writeDoc(DOCUMENT_IDS.WIDGETS, cleanStore);

        if (args.content) {
          const contentStore: any = (await readDoc(DOCUMENT_IDS.CONTENT)) || { content: {}, lastModified: 0 };
          // Structure content to match frontend WidgetContent interface
          // Ensure content is JSON-serializable and safe for Automerge
          const contentData = JSON.parse(JSON.stringify(args.content || {}));
          const contentEntry = {
            id: newWidget.contentId!,
            type: args.type as string,
            data: contentData, // Wrap content in data field to match frontend
            lastModified: Date.now(),
            size: JSON.stringify(contentData).length, // Calculate approximate size
          };
          
          // Create completely clean objects to avoid Automerge reference issues
          const existingContent = JSON.parse(JSON.stringify(contentStore.content || {}));
          const cleanContentEntry = JSON.parse(JSON.stringify(contentEntry));
          
          const updatedContentStore = {
            content: {
              ...existingContent,
              [newWidget.contentId!]: cleanContentEntry
            },
            lastModified: Date.now(),
          };
          
          // Ensure the entire content store is clean
          const cleanContentStore = JSON.parse(JSON.stringify(updatedContentStore));
          
          await writeDoc(DOCUMENT_IDS.CONTENT, cleanContentStore);
        }

        return {
          content: [
            {
              type: "text",
              text: `Successfully added widget: ${JSON.stringify(newWidget, null, 2)}`,
            },
          ],
        };
      }

      case "update_pinboard_widget": {
        const widgetStore: any = (await readDoc(DOCUMENT_IDS.WIDGETS)) || { widgets: [], lastModified: 0 };
        const widgetIndex = widgetStore.widgets.findIndex((w: any) => w.id === args.id);
        
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
        const cleanStore = JSON.parse(JSON.stringify(updatedWidgetStore));
        
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

      case "update_widget_content": {
        const contentId = args.contentId as string;
        const updates = args.updates as Record<string, unknown>;

        // Read current content store
        const contentStore: any = (await readDoc(DOCUMENT_IDS.CONTENT)) || { content: {}, lastModified: 0 };

        // Check if content exists
        if (!contentStore.content[contentId]) {
          throw new Error(`Content not found: ${contentId}`);
        }

        // Create completely clean objects to avoid Automerge reference issues
        const existingContent = JSON.parse(JSON.stringify(contentStore.content || {}));
        const cleanUpdates = JSON.parse(JSON.stringify(updates));
        
        // Update the specific content with clean data
        existingContent[contentId] = {
          ...existingContent[contentId],
          data: {
            ...existingContent[contentId].data,
            ...cleanUpdates,
          },
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

      case "remove_pinboard_widget": {
        const widgetStore: any = (await readDoc(DOCUMENT_IDS.WIDGETS)) || { widgets: [], lastModified: 0 };
        const widgetIndex = widgetStore.widgets.findIndex((w: any) => w.id === args.id);
        
        if (widgetIndex === -1) {
          throw new Error(`Widget not found: ${args.id}`);
        }

        // Create completely clean objects to avoid Automerge reference issues
        const existingWidgets = JSON.parse(JSON.stringify(widgetStore.widgets || []));
        const removedWidget = existingWidgets[widgetIndex];
        
        // Remove the widget from clean array
        existingWidgets.splice(widgetIndex, 1);
        
        const updatedWidgetStore = {
          widgets: existingWidgets,
          lastModified: Date.now(),
        };

        // Ensure the entire store is clean
        const cleanStore = JSON.parse(JSON.stringify(updatedWidgetStore));
        
        await writeDoc(DOCUMENT_IDS.WIDGETS, cleanStore);

        if (removedWidget.contentId) {
          const contentStore: any = (await readDoc(DOCUMENT_IDS.CONTENT)) || { content: {}, lastModified: 0 };
          // Create clean content store
          const existingContent = JSON.parse(JSON.stringify(contentStore.content || {}));
          delete existingContent[removedWidget.contentId];
          
          const updatedContentStore = {
            content: existingContent,
            lastModified: Date.now(),
          };
          
          const cleanContentStore = JSON.parse(JSON.stringify(updatedContentStore));
          await writeDoc(DOCUMENT_IDS.CONTENT, cleanContentStore);
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

      case "read_file": {
        const filePath = args.path as string;
        const encoding = (args.encoding as string) || "utf8";
        
        if (!filePath) {
          throw new Error("Path is required");
        }
        
        const normalizedPath = path.normalize(filePath);
        if (normalizedPath.includes("..")) {
          throw new Error("Path traversal not allowed");
        }

        const projectRoot = process.cwd();
        const absolutePath = path.resolve(projectRoot, normalizedPath);
        
        if (!absolutePath.startsWith(projectRoot)) {
          throw new Error("Access outside project directory not allowed");
        }

        const content = await fs.readFile(absolutePath, encoding as any);
        const stats = await fs.stat(absolutePath);

        return {
          content: [
            {
              type: "text",
              text: `## 📄 File: ${filePath}\n\n**Size:** ${stats.size} bytes\n**Encoding:** ${encoding}\n**Last Modified:** ${stats.mtime.toISOString()}\n\n\`\`\`\n${content}\n\`\`\``,
            },
          ],
        };
      }

      case "write_file": {
        const filePath = args.path as string;
        const content = args.content as string;
        const encoding = (args.encoding as string) || "utf8";
        
        if (!filePath || content === undefined) {
          throw new Error("Path and content are required");
        }
        
        const normalizedPath = path.normalize(filePath);
        if (normalizedPath.includes("..")) {
          throw new Error("Path traversal not allowed");
        }

        const projectRoot = process.cwd();
        const absolutePath = path.resolve(projectRoot, normalizedPath);
        
        if (!absolutePath.startsWith(projectRoot)) {
          throw new Error("Access outside project directory not allowed");
        }

        const dir = path.dirname(absolutePath);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(absolutePath, content, encoding as any);
        const stats = await fs.stat(absolutePath);

        return {
          content: [
            {
              type: "text",
              text: `## ✅ File Written\n\n**Path:** ${filePath}\n**Size:** ${stats.size} bytes\n**Encoding:** ${encoding}\n**Timestamp:** ${stats.mtime.toISOString()}`,
            },
          ],
        };
      }

      case "list_directory": {
        const dirPath = (args.path as string) || ".";
        
        const normalizedPath = path.normalize(dirPath);
        if (normalizedPath.includes("..")) {
          throw new Error("Path traversal not allowed");
        }

        const projectRoot = process.cwd();
        const absolutePath = path.resolve(projectRoot, normalizedPath);
        
        if (!absolutePath.startsWith(projectRoot)) {
          throw new Error("Access outside project directory not allowed");
        }

        const items = await fs.readdir(absolutePath, { withFileTypes: true });
        const fileCount = items.filter(item => item.isFile()).length;
        const dirCount = items.filter(item => item.isDirectory()).length;
        
        const itemsList = items
          .map(item => `${item.isDirectory() ? "📁" : "📄"} ${item.name}`)
          .join("\n");

        return {
          content: [
            {
              type: "text",
              text: `## 📂 Directory: ${dirPath}\n\n**Files:** ${fileCount} | **Directories:** ${dirCount}\n\n${itemsList}`,
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  /**
   * Direct resource reading (internal implementation)
   */
  private async readResourceDirectly(uri: string): Promise<string> {
    // Ensure sync engine is initialized before reading resources
    await this.initializeSyncEngine();
    
    const { readDoc, ls } = await import("@tonk/keepsync");

    switch (uri) {
      case "pinboard://widgets": {
        const widgetData = await readDoc(DOCUMENT_IDS.WIDGETS);
        return JSON.stringify(
          widgetData || { widgets: [], lastModified: 0 },
          null,
          2,
        );
      }

      case "pinboard://content": {
        const contentData = await readDoc(DOCUMENT_IDS.CONTENT);
        return JSON.stringify(
          contentData || { content: {}, lastModified: 0 },
          null,
          2,
        );
      }

      case "pinboard://ui-state": {
        const uiData = await readDoc(DOCUMENT_IDS.UI_STATE);
        return JSON.stringify(
          uiData || {
            selection: [],
            canvasTransform: { x: 0, y: 0, scale: 1 },
          },
          null,
          2,
        );
      }

      case "keepsync://documents/list": {
        const documents = await ls("/");
        return JSON.stringify({ documents }, null, 2);
      }

      default:
        throw new Error(`Unknown resource: ${uri}`);
    }
  }
}

// Export singleton instance
export const mcpAdapter = new MCPInternalAdapter();