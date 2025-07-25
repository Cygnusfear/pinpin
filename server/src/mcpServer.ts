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

// Note: Using HTTP API instead of direct keepsync connection
// import { configureSyncEngine, ls, mkDir, readDoc, writeDoc } from "@tonk/keepsync";

/**
 * MCP Server for Keepsync Store Access
 *
 * Provides Claude with access to read and write zustand/keepsync stores
 * Used by the pinboard application for collaborative state management.
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
      // Configure sync engine for server environment
      await configureSyncEngine({
        url: process.env.SYNC_URL || "http://localhost:3000",
        // Server-side sync engine configuration
        network: [],
      });

      // Wait for sync engine to be ready
      const { getSyncEngine } = await import("@tonk/keepsync");
      const engine = await getSyncEngine();
      if (engine) {
        console.log("⏳ MCP Server: Waiting for sync engine to be ready...");
        await engine.whenReady();
        console.log("✅ MCP Server: Sync engine ready");
      }

      this.syncEngineInitialized = true;
      console.log("✅ MCP Server: Sync engine initialized");
    } catch (error) {
      console.error("❌ MCP Server: Failed to initialize sync engine:", error);
      throw error;
    }
  }

  private async handleToolCall(name: string, args: any) {
    switch (name) {
      case "read_keepsync_doc":
        return await this.handleReadDoc(args);
      case "write_keepsync_doc":
        return await this.handleWriteDoc(args);
      case "list_keepsync_docs":
        return await this.handleListDocs(args);
      case "add_widget":
        return await this.handleAddWidget(args);
      case "update_widget":
        return await this.handleUpdateWidget(args);
      case "remove_widget":
        return await this.handleRemoveWidget(args);
      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
  }

  private async handleReadDoc(args: any) {
    const doc = await readDoc(args.path);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(doc, null, 2),
        },
      ],
    };
  }

  private async handleWriteDoc(args: any) {
    await writeDoc(args.path, args.content);
    return {
      content: [
        {
          type: "text",
          text: `Successfully wrote to document: ${args.path}`,
        },
      ],
    };
  }

  private async handleListDocs(args: any) {
    const docs = await ls(args.path || "/");
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(docs, null, 2),
        },
      ],
    };
  }

  private async handleAddWidget(args: any) {
    // Read current widget store
    const widgetStore: WidgetStoreData = (await readDoc(
      "pinboard-widgets",
    )) || {
      widgets: [],
      lastModified: 0,
    };

    // Generate new widget
    const newWidget = {
      id: `widget_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: args.type,
      position: args.position,
      size: args.size,
      transform: {
        rotation: 0,
        scale: 1,
      },
      zIndex: widgetStore.widgets.length,
      selected: false,
      contentId: args.content ? `content_${Date.now()}` : undefined,
    };

    // Add widget to store
    widgetStore.widgets.push(newWidget);
    widgetStore.lastModified = Date.now();

    // Save updated store
    await writeDoc("pinboard-widgets", widgetStore);

    // If content provided, save it too
    if (args.content) {
      const contentStore: ContentStoreData = (await readDoc(
        "pinboard-content",
      )) || {
        content: {},
        lastModified: 0,
      };
      contentStore.content[newWidget.contentId!] = {
        id: newWidget.contentId!,
        type: args.type,
        ...args.content,
        lastModified: Date.now(),
      };
      contentStore.lastModified = Date.now();
      await writeDoc("pinboard-content", contentStore);
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

  private async handleUpdateWidget(args: any) {
    // Read current widget store
    const widgetStore: WidgetStoreData = (await readDoc(
      "pinboard-widgets",
    )) || {
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

    // Update widget
    widgetStore.widgets[widgetIndex] = {
      ...widgetStore.widgets[widgetIndex],
      ...args.updates,
      lastModified: Date.now(),
    };
    widgetStore.lastModified = Date.now();

    // Save updated store
    await writeDoc("pinboard-widgets", widgetStore);

    return {
      content: [
        {
          type: "text",
          text: `Successfully updated widget: ${args.id}`,
        },
      ],
    };
  }

  private async handleRemoveWidget(args: any) {
    // Read current widget store
    const widgetStore: WidgetStoreData = (await readDoc(
      "pinboard-widgets",
    )) || {
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
    await writeDoc("pinboard-widgets", widgetStore);

    // Also remove content if it exists
    if (removedWidget.contentId) {
      const contentStore: ContentStoreData = (await readDoc(
        "pinboard-content",
      )) || {
        content: {},
        lastModified: 0,
      };
      delete contentStore.content[removedWidget.contentId];
      contentStore.lastModified = Date.now();
      await writeDoc("pinboard-content", contentStore);
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

  private setupHandlers() {
    // List available resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      await this.initializeSyncEngine();

      try {
        const resources = [
          {
            uri: "keepsync://stores/widgets",
            mimeType: "application/json",
            name: "Widget Store",
            description:
              "All widgets on the pinboard with their positions and properties",
          },
          {
            uri: "keepsync://stores/content",
            mimeType: "application/json",
            name: "Content Store",
            description:
              "Widget content data including text, images, and file references",
          },
          {
            uri: "keepsync://stores/ui",
            mimeType: "application/json",
            name: "UI Store",
            description:
              "UI state including selection, canvas transform, and interaction mode",
          },
          {
            uri: "keepsync://documents/list",
            mimeType: "application/json",
            name: "Document List",
            description: "List all available keepsync documents",
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
          if (uri === "keepsync://stores/widgets") {
            const widgetData = await readDoc("pinboard-widgets");
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

          if (uri === "keepsync://stores/content") {
            const contentData = await readDoc("pinboard-content");
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

          if (uri === "keepsync://stores/ui") {
            const uiData = await readDoc("pinboard-ui");
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
            name: "read_keepsync_doc",
            description: "Read a document from the keepsync store by path",
            inputSchema: {
              type: "object",
              properties: {
                path: {
                  type: "string",
                  description:
                    "Document path (e.g., 'pinboard-widgets', 'pinboard-content')",
                },
              },
              required: ["path"],
            },
          },
          {
            name: "write_keepsync_doc",
            description: "Write or update a document in the keepsync store",
            inputSchema: {
              type: "object",
              properties: {
                path: {
                  type: "string",
                  description: "Document path to write to",
                },
                content: {
                  type: "object",
                  description: "Content to write to the document",
                },
              },
              required: ["path", "content"],
            },
          },
          {
            name: "list_keepsync_docs",
            description: "List all documents in a keepsync directory",
            inputSchema: {
              type: "object",
              properties: {
                path: {
                  type: "string",
                  description: "Directory path to list (default: '/')",
                  default: "/",
                },
              },
            },
          },
          {
            name: "add_widget",
            description: "Add a new widget to the pinboard",
            inputSchema: {
              type: "object",
              properties: {
                type: {
                  type: "string",
                  description:
                    "Widget type (note, todo, calculator, image, etc.)",
                },
                position: {
                  type: "object",
                  properties: {
                    x: { type: "number" },
                    y: { type: "number" },
                  },
                  required: ["x", "y"],
                },
                size: {
                  type: "object",
                  properties: {
                    width: { type: "number" },
                    height: { type: "number" },
                  },
                  required: ["width", "height"],
                },
                content: {
                  type: "object",
                  description: "Initial content for the widget",
                },
              },
              required: ["type", "position", "size"],
            },
          },
          {
            name: "update_widget",
            description: "Update an existing widget on the pinboard",
            inputSchema: {
              type: "object",
              properties: {
                id: {
                  type: "string",
                  description: "Widget ID to update",
                },
                updates: {
                  type: "object",
                  description: "Properties to update on the widget",
                },
              },
              required: ["id", "updates"],
            },
          },
          {
            name: "remove_widget",
            description: "Remove a widget from the pinboard",
            inputSchema: {
              type: "object",
              properties: {
                id: {
                  type: "string",
                  description: "Widget ID to remove",
                },
              },
              required: ["id"],
            },
          },
        ],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      await this.initializeSyncEngine();

      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case "read_keepsync_doc": {
            const doc = await readDoc(args.path);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(doc, null, 2),
                },
              ],
            };
          }

          case "write_keepsync_doc": {
            await writeDoc(args.path, args.content);
            return {
              content: [
                {
                  type: "text",
                  text: `Successfully wrote to document: ${args.path}`,
                },
              ],
            };
          }

          case "list_keepsync_docs": {
            const docs = await ls(args.path || "/");
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(docs, null, 2),
                },
              ],
            };
          }

          case "add_widget": {
            // Read current widget store
            const widgetStore = (await readDoc("pinboard-widgets")) || {
              widgets: [],
              lastModified: 0,
            };

            // Generate new widget
            const newWidget = {
              id: `widget_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              type: args.type,
              position: args.position,
              size: args.size,
              transform: {
                rotation: 0,
                scale: 1,
              },
              zIndex: widgetStore.widgets.length,
              selected: false,
              contentId: args.content ? `content_${Date.now()}` : undefined,
            };

            // Add widget to store
            widgetStore.widgets.push(newWidget);
            widgetStore.lastModified = Date.now();

            // Save updated store
            await writeDoc("pinboard-widgets", widgetStore);

            // If content provided, save it too
            if (args.content) {
              const contentStore = (await readDoc("pinboard-content")) || {
                content: {},
                lastModified: 0,
              };
              contentStore.content[newWidget.contentId!] = {
                id: newWidget.contentId!,
                type: args.type,
                ...args.content,
                lastModified: Date.now(),
              };
              contentStore.lastModified = Date.now();
              await writeDoc("pinboard-content", contentStore);
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

          case "update_widget": {
            // Read current widget store
            const widgetStore = (await readDoc("pinboard-widgets")) || {
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

            // Update widget
            widgetStore.widgets[widgetIndex] = {
              ...widgetStore.widgets[widgetIndex],
              ...args.updates,
              lastModified: Date.now(),
            };
            widgetStore.lastModified = Date.now();

            // Save updated store
            await writeDoc("pinboard-widgets", widgetStore);

            return {
              content: [
                {
                  type: "text",
                  text: `Successfully updated widget: ${args.id}`,
                },
              ],
            };
          }

          case "remove_widget": {
            // Read current widget store
            const widgetStore = (await readDoc("pinboard-widgets")) || {
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
            await writeDoc("pinboard-widgets", widgetStore);

            // Also remove content if it exists
            if (removedWidget.contentId) {
              const contentStore = (await readDoc("pinboard-content")) || {
                content: {},
                lastModified: 0,
              };
              delete contentStore.content[removedWidget.contentId];
              contentStore.lastModified = Date.now();
              await writeDoc("pinboard-content", contentStore);
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
