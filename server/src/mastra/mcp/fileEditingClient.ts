/**
 * MCP Client for File Editing Tools
 * 
 * Configures an MCP client to connect to the mcp-edit-file-lines server,
 * providing advanced file editing capabilities to the Mastra agent.
 */

import { MCPClient } from '@mastra/mcp';
import path from "path"

/**
 * MCP Client for file editing operations
 * 
 * Provides tools for:
 * - Line-based file editing with regex pattern matching
 * - Safe two-step editing process (dry run + approve)
 * - File inspection and search capabilities
 * - Structured diff output
 */
export const fileEditingMcpClient = new MCPClient({
  servers: {
    'file-editor': {
      command: 'bunx',
      args: [
        // Use the installed package via npx with allowed directories
        'edit-file-lines',
        path.join(process.cwd(),'../src/plugins'), // Allow editing files in the plugins directory
        path.join(process.cwd(),'public'), // Allow editing files in the public directory
      ],
      // Note: Working directory is set to the process cwd by default
      env: {
        // Inherit environment variables (filter out undefined values)
        ...Object.fromEntries(
          Object.entries(process.env).filter(([_, value]) => value !== undefined)
        ) as Record<string, string>,
      },
    },
    'filesystem': {
      command: 'bunx',
      args: [
        '-y',
        '@modelcontextprotocol/server-filesystem',
        path.join(process.cwd(),'../src/plugins'), // Allow filesystem access to the plugins directory
        path.join(process.cwd(),'public'), // Allow filesystem access to the public directory
      ],
    },
  },
});

/**
 * Initialize and get tools from the file editing MCP server
 * 
 * This should be called during Mastra initialization to make
 * file editing tools available to the agent.
 */
export const getFileEditingTools = async () => {
  try {
    console.log('🔧 Initializing file editing MCP client...');
    const tools = await fileEditingMcpClient.getTools();
    console.log(`✅ File editing MCP client initialized with ${Object.keys(tools).length} tools`);
    
    // Log available tools
    const toolNames = Object.keys(tools);
    console.log(`📝 Available file editing tools: ${toolNames.join(', ')}`);
    
    return tools;
  } catch (error) {
    console.error('❌ Failed to initialize file editing MCP client:', error);
    // Return empty object to prevent breaking the agent
    return {};
  }
};

/**
 * Get dynamic toolsets for per-request file editing operations
 * 
 * Use this when you need different file editing configurations
 * for different users or requests.
 */
export const getFileEditingToolsets = async () => {
  try {
    const toolsets = await fileEditingMcpClient.getToolsets();
    return toolsets;
  } catch (error) {
    console.error('❌ Failed to get file editing toolsets:', error);
    return [];
  }
};

/**
 * Cleanup function to disconnect the MCP client
 */
export const disconnectFileEditingClient = async () => {
  try {
    await fileEditingMcpClient.disconnect();
    console.log('✅ File editing MCP client disconnected');
  } catch (error) {
    console.error('❌ Error disconnecting file editing MCP client:', error);
  }
};