/**
 * Pinboard Chat Route Handlers
 *
 * Simple chat handlers for the pinboard system using unified tools.
 */

import type { Request, Response } from "express";
// Import unified tool manager
import {
  unifiedToolManager,
  executeUnifiedTool,
  getFormattedToolsForProvider
} from "../tools/unifiedTools.js";
import ENV from "../env.js";

/**
 * Handle filesystem and MCP operations using unified tool manager
 */
async function handleUnifiedToolOperation(
  toolName: string,
  input: any,
): Promise<any> {
  try {
    console.log(`=== Executing Unified Tool: ${toolName} ===`);
    
    const result = await executeUnifiedTool(
      toolName,
      input,
      { provider: "claude" }
    );

    if (!result.success) {
      throw new Error(result.error || "Tool execution failed");
    }

    // Parse JSON content if it looks like structured data
    let parsedContent = result.content;
    try {
      if (result.content.startsWith('{') || result.content.startsWith('[')) {
        parsedContent = JSON.parse(result.content);
      }
    } catch {
      // Keep as string if not valid JSON
    }

    return {
      success: true,
      content: parsedContent,
      metadata: result.metadata,
    };
  } catch (error: any) {
    console.error(`Unified tool operation error (${toolName}):`, error.message);
    throw error;
  }
}

/**
 * Format unified tool operation results into user-friendly messages
 */
function formatUnifiedToolResponse(toolName: string, result: any): string {
  // If the result is already formatted (contains markdown), use it directly
  if (typeof result.content === "string" && result.content.includes("##")) {
    return result.content;
  }

  // Legacy formatting for filesystem tools
  if (toolName === "list_directory" && result.content) {
    try {
      const parsed = typeof result.content === "string"
        ? JSON.parse(result.content)
        : result.content;
      
      if (parsed.items && Array.isArray(parsed.items)) {
        const fileCount = parsed.items.filter(
          (item: any) => item.type === "file",
        ).length;
        const dirCount = parsed.items.filter(
          (item: any) => item.type === "directory",
        ).length;
        const itemsList = parsed.items
          .map(
            (item: any) =>
              `${item.type === "directory" ? "📁" : "📄"} ${item.name}`,
          )
          .join("\n");
        return `Directory listing for "${parsed.currentPath}":\n\nFound ${fileCount} files and ${dirCount} directories:\n\n${itemsList}`;
      }
    } catch {
      // Fall through to default formatting
    }
  }

  // Default formatting
  if (typeof result.content === "string") {
    return result.content;
  }

  return `Tool operation completed: ${JSON.stringify(result.content)}`;
}

/**
 * Simple chat endpoint handler for pinboard system
 */
export const simpleChatHandler = async (req: Request, res: Response) => {
  try {
    const { message } = req.body;

    if (!message || typeof message !== "string") {
      return res.status(400).json({
        error: "Message is required and must be a string",
      });
    }

    console.log("=== Simple Chat Request ===");
    console.log("Message:", message);
    console.log("==========================");

    // Initialize unified tools
    await unifiedToolManager.initialize();
    const unifiedTools = await getFormattedToolsForProvider("claude");
    
    console.log("=== Available Tools ===");
    console.log("Unified MCP tools:", unifiedTools.length);
    console.log("======================");

    // Simple response for now - can be enhanced later
    res.json({
      success: true,
      data: {
        message: "Chat functionality is ready! Tools available: " + unifiedTools.length,
        tools_available: unifiedTools.length,
      },
    });

  } catch (error: any) {
    console.error("=== Chat Error ===");
    console.error("Error:", error.message);
    console.error("==================");

    res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
};

/**
 * Health check endpoint handler
 */
export const healthHandler = (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "pinboard-chat",
  });
};