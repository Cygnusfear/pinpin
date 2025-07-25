# Keepsync MCP Server Setup

This MCP server provides Claude with access to the zustand/keepsync stores used by the pinboard application.

## Features

The MCP server provides:

### Resources
- `keepsync://stores/widgets` - All widgets on the pinboard with their positions and properties
- `keepsync://stores/content` - Widget content data including text, images, and file references  
- `keepsync://stores/ui` - UI state including selection, canvas transform, and interaction mode
- `keepsync://documents/list` - List all available keepsync documents

### Tools
- `read_keepsync_doc` - Read any document from the keepsync store
- `write_keepsync_doc` - Write or update documents in the keepsync store
- `list_keepsync_docs` - List all documents in a directory
- `add_widget` - Add a new widget to the pinboard
- `update_widget` - Update an existing widget
- `remove_widget` - Remove a widget from the pinboard

## Setup Instructions

### 1. Start the MCP Server

From the server directory, run:

```bash
npm run mcp
```

This will start the MCP server in stdio mode, ready to receive connections from Claude.

### 2. Configure Claude Desktop

Add the following configuration to your Claude Desktop config file:

#### For macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
#### For Windows: `%APPDATA%/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "keepsync-store": {
      "command": "npm",
      "args": ["run", "mcp"],
      "cwd": "/path/to/your/project/server",
      "env": {
        "SYNC_URL": "http://localhost:3000"
      }
    }
  }
}
```

**Important**: Replace `/path/to/your/project/server` with the actual path to your server directory.

### 3. Environment Variables

The MCP server supports these environment variables:

- `SYNC_URL` - URL of the keepsync server (default: "http://localhost:3000")
- `SYNC_WS_URL` - WebSocket URL for sync (default: "ws://localhost:3000/sync")

### 4. Start Your Application

Make sure your pinboard application is running so the keepsync stores are available:

```bash
# From the root project directory
npm run dev
```

### 5. Test the Connection

1. Restart Claude Desktop after adding the configuration
2. Start a new conversation
3. Ask Claude something like: "Can you read the current widgets from the pinboard?"

Claude should now be able to access and manipulate your keepsync stores!

## Example Usage

Once configured, you can ask Claude to:

- "Show me all the widgets currently on the pinboard"
- "Add a new note widget at position (100, 200) with the text 'Hello World'"
- "Update the widget with ID 'widget_123' to change its position"
- "Remove the widget with ID 'widget_456'"
- "List all the keepsync documents"

## Troubleshooting

### MCP Server Won't Start
- Make sure all dependencies are installed: `npm install`
- Check that the keepsync library is available
- Verify environment variables are set correctly

### Claude Can't Connect
- Ensure the path in the Claude config is correct
- Check that the MCP server is running
- Restart Claude Desktop after configuration changes

### Sync Engine Errors
- Make sure your main application is running first
- Verify the SYNC_URL points to your running application
- Check that the keepsync sync engine is properly configured in your app

### Permission Issues
- Ensure the server directory is readable by Claude Desktop
- Check file permissions on the MCP server scripts

## Development

To modify the MCP server:

1. Edit `src/mcpServer.ts` to add new tools or resources
2. Update the standalone script in `src/mcp-standalone.ts` if needed
3. Test with `npm run mcp`
4. Restart Claude Desktop to pick up changes 