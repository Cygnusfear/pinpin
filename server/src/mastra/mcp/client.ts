import { MCPClient } from '@mastra/mcp';

export const mcp = new MCPClient({
  servers: {
    // Internal keepsync MCP server
    keepsync: {
      command: 'tsx',
      args: ['src/mcp-standalone.ts'],
    },
  },
});