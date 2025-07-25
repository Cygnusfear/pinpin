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

// Polyfill WebSocket for Node.js environment
global.WebSocket = WebSocket as any;

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

          if (uri === "pinboard://content") {
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

          if (uri === "pinboard://ui-state") {
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
              "Update an existing widget on the pinboard (move it, resize it, or change its content)",
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
        ],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      await this.initializeSyncEngine();

      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case "view_all_pinboard_widgets": {
            const widgets = await readDoc("pinboard-widgets");
            return {
              content: [
                {
                  type: "text",
                  text: `## 📌 Pinboard Widgets\n\n${JSON.stringify(widgets || { widgets: [], lastModified: 0 }, null, 2)}`,
                },
              ],
            };
          }

          case "view_widget_content": {
            const content = await readDoc("pinboard-content");
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
            const uiState = await readDoc("pinboard-ui");
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

          case "update_pinboard_widget": {
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

          case "remove_pinboard_widget": {
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
