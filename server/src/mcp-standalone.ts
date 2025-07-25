#!/usr/bin/env tsx

/**
 * Standalone MCP Server for Keepsync Store Access
 *
 * Run this script to start the MCP server that provides Claude
 * with access to the zustand/keepsync stores.
 *
 * Usage:
 *   npm run mcp
 *   # or
 *   tsx src/mcp-standalone.ts
 */

import { KeepsyncMCPServer } from "./mcpServer.js";

console.log("🚀 Starting Keepsync MCP Server...");

const server = new KeepsyncMCPServer();

// Handle process termination
process.on("SIGINT", () => {
  console.log("\n🛑 Shutting down MCP server...");
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\n🛑 Shutting down MCP server...");
  process.exit(0);
});

// Start the server
server
  .start()
  .then(() => {
    console.log("✅ MCP server started successfully");
  })
  .catch((error) => {
    console.error("❌ Failed to start MCP server:", error);
    process.exit(1);
  });
