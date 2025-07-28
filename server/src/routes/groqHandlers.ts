/**
 * Groq AI Chat Route Handlers
 *
 * Main route handler functions for the Groq chat system, utilizing
 * the MCP adapter for unified tool access and following the same
 * patterns as Claude handlers but with Groq-specific implementation.
 */

import type { Request, Response } from "express";
import { Groq } from "groq-sdk";
import ENV from "../env.js";
import {
  executeUnifiedTool,
  getFormattedToolsForProvider,
  unifiedToolManager,
} from "../tools/unifiedTools.js";

// Import types from Claude handlers for compatibility
type ChatMessage = {
  role: string;
  content: string;
  location?: string;
  roll?: number;
  [key: string]: any;
};

type ChatRequestBody = {
  messages: ChatMessage[];
  locations?: any[];
  characters?: any[];
};

type ChatResponse = {
  success: boolean;
  data: {
    message: string;
    tool_calls?: any[];
    [key: string]: any;
  };
};

// Initialize Groq client (lazy initialization to ensure env vars are loaded)
let groq: Groq | null = null;

const getGroqClient = (): Groq => {
  if (!groq) {
    groq = new Groq({
      apiKey: ENV.VITE_GROQ_API_KEY,
    });
  }
  return groq;
};

/**
 * Get Groq-formatted tools from unified tool manager
 */
async function getToolsForGroq() {
  return await getFormattedToolsForProvider("groq");
}

/**
 * Process Groq tool calls using unified tool manager
 */
async function processGroqToolCalls(toolCalls: any[]): Promise<any[]> {
  const results = [];

  for (const toolCall of toolCalls) {
    try {
      console.log(`=== Executing Unified Tool: ${toolCall.function.name} ===`);

      const args = JSON.parse(toolCall.function.arguments);
      const result = await executeUnifiedTool(toolCall.function.name, args, {
        provider: "groq",
      });

      results.push({
        tool_call_id: toolCall.id,
        role: "tool" as const,
        content: result.success ? result.content : `Error: ${result.error}`,
      });

      if (result.success) {
        console.log(`✅ Tool ${toolCall.function.name} executed successfully`);
      } else {
        console.error(
          `❌ Tool ${toolCall.function.name} failed:`,
          result.error,
        );
      }
    } catch (error: any) {
      console.error(`❌ Tool ${toolCall.function.name} failed:`, error.message);

      results.push({
        tool_call_id: toolCall.id,
        role: "tool" as const,
        content: `Error: ${error.message}`,
      });
    }
  }

  return results;
}

/**
 * Groq chat endpoint handler
 *
 * Handles chat conversations with Groq models, integrating with MCP tools
 * for widget management, filesystem operations, and other capabilities.
 *
 * @example
 * POST /api/groq/chat
 * {
 *   "messages": [{"role": "user", "content": "Create a note widget with 'Hello World'"}],
 *   "locations": [...],  // Optional, for compatibility
 *   "characters": [...]  // Optional, for compatibility
 * }
 */
export const groqChatHandler = async (req: Request, res: Response) => {
  try {
    const { messages, locations, characters }: ChatRequestBody = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({
        error: "Messages array is required",
      });
    }

    // Initialize unified tool manager
    await unifiedToolManager.initialize();

    // Get available tools for Groq
    const tools = await getToolsForGroq();

    // Convert messages to Groq format
    const groqMessages = messages.map((msg) => ({
      role: msg.role === "user" ? ("user" as const) : ("assistant" as const),
      content: msg.content,
    }));

    console.log("=== Groq Chat Request Debug ===");
    console.log("Total messages:", groqMessages.length);
    console.log("Available unified tools:", tools.length);
    console.log("===============================");

    // Make initial request to Groq with tool support
    const completion = await getGroqClient().chat.completions.create({
      model: "qwen/qwen3-32b", // Fast, capable model
      messages: groqMessages,
      tools: tools.length > 0 ? tools : undefined,
      tool_choice: tools.length > 0 ? "auto" : undefined,
      max_tokens: 4000,
      temperature: 0.7,
    });

    const assistantMessage = completion.choices[0]?.message;
    if (!assistantMessage) {
      throw new Error("No response from Groq");
    }

    console.log("=== Groq Response Debug ===");
    console.log("Has content:", !!assistantMessage.content);
    console.log("Has tool calls:", !!assistantMessage.tool_calls);
    console.log("Tool calls count:", assistantMessage.tool_calls?.length || 0);
    console.log("==========================");

    // Check if the AI outputted JSON tool calls in text content instead of using proper tool calling
    let detectedToolCalls: any[] = [];
    if (assistantMessage.content && !assistantMessage.tool_calls) {
      const toolCallRegex = /\{"name":\s*"([^"]+)",\s*"arguments":\s*(\{[^}]*\})\}/g;
      let match;
      while ((match = toolCallRegex.exec(assistantMessage.content)) !== null) {
        try {
          const [fullMatch, toolName, argsString] = match;
          const args = JSON.parse(argsString);
          
          detectedToolCalls.push({
            id: `detected_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: "function",
            function: {
              name: toolName,
              arguments: argsString
            }
          });
          
          console.log(`🔍 Detected raw JSON tool call: ${toolName}`);
        } catch (error) {
          console.log(`⚠️  Failed to parse detected tool call: ${match[0]}`);
        }
      }
    }

    // Handle tool calls if present (either from proper tool calling or detected in text)
    const toolCallsToProcess = assistantMessage.tool_calls || detectedToolCalls;
    if (toolCallsToProcess && toolCallsToProcess.length > 0) {
      // Process tool calls
      const toolResults = await processGroqToolCalls(
        toolCallsToProcess,
      );

      // Create follow-up conversation with tool results
      const followUpMessages = [
        ...groqMessages,
        {
          role: "assistant" as const,
          content: assistantMessage.content,
          tool_calls: toolCallsToProcess,
        },
        ...toolResults,
      ];

      // Get final response from Groq after tool execution
      const finalCompletion = await getGroqClient().chat.completions.create({
        model: "qwen/qwen3-32b",
        messages: followUpMessages,
        max_tokens: 4000,
        temperature: 0.7,
      });

      const finalMessage = finalCompletion.choices[0]?.message;

      console.log("=== Groq Final Response Debug ===");
      console.log("Final message length:", finalMessage?.content?.length || 0);
      console.log("===============================");

      res.json({
        success: true,
        data: {
          message: finalMessage?.content || "Task completed successfully",
          tool_calls: toolCallsToProcess,
          tool_results: toolResults,
        },
      });
    } else {
      // No tool calls, return direct response
      res.json({
        success: true,
        data: {
          message: assistantMessage.content || "No response available",
        },
      });
    }
  } catch (error: any) {
    console.error("=== Groq Chat API Error Debug ===");
    console.error("Error type:", typeof error);
    console.error("Error constructor:", error.constructor.name);
    console.error("Error message:", error.message);
    if (error.response) {
      console.error("Error response:", error.response);
    }
    console.error("================================");

    // Handle different types of errors
    if (error.status === 401) {
      return res.status(401).json({
        error: "Invalid Groq API key",
      });
    }

    if (error.status === 429) {
      return res.status(429).json({
        error: "Rate limit exceeded. Please try again later.",
      });
    }

    if (error.status === 400) {
      return res.status(400).json({
        error: "Invalid request parameters",
        details: error.message,
      });
    }

    res.status(500).json({
      error: "Internal server error",
      message: error.message,
      errorType: error.constructor.name,
    });
  }
};

/**
 * Groq tools list endpoint handler
 *
 * Returns the list of available MCP tools that can be used with Groq.
 *
 * @example
 * GET /api/groq/tools
 */
export const groqToolsHandler = async (_req: Request, res: Response) => {
  try {
    await unifiedToolManager.initialize();
    const tools = await unifiedToolManager.getToolsForProvider("groq");
    const stats = unifiedToolManager.getStats();

    res.json({
      success: true,
      data: {
        tools: tools,
        count: tools.length,
        stats: stats,
      },
    });
  } catch (error: any) {
    console.error("=== Groq Tools List Error ===");
    console.error("Error:", error.message);
    console.error("============================");

    res.status(500).json({
      error: "Failed to list tools",
      message: error.message,
    });
  }
};

/**
 * Groq resources list endpoint handler
 *
 * Returns the list of available MCP resources.
 *
 * @example
 * GET /api/groq/resources
 */
export const groqResourcesHandler = async (_req: Request, res: Response) => {
  try {
    await unifiedToolManager.initialize();
    // Get tools by category as a proxy for resources
    const pinboardTools =
      await unifiedToolManager.getToolsByCategory("pinboard");
    const filesystemTools =
      await unifiedToolManager.getToolsByCategory("filesystem");
    const systemTools = await unifiedToolManager.getToolsByCategory("system");

    const resources = {
      pinboard: pinboardTools,
      filesystem: filesystemTools,
      system: systemTools,
    };

    res.json({
      success: true,
      data: {
        resources: resources,
        categories: Object.keys(resources),
        totalTools:
          pinboardTools.length + filesystemTools.length + systemTools.length,
      },
    });
  } catch (error: any) {
    console.error("=== Groq Resources List Error ===");
    console.error("Error:", error.message);
    console.error("==============================");

    res.status(500).json({
      error: "Failed to list resources",
      message: error.message,
    });
  }
};

/**
 * Health check endpoint handler for Groq service
 *
 * Provides Groq service health status and configuration information.
 */
export const groqHealthHandler = (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "groq",
    groq_configured: !!ENV.VITE_GROQ_API_KEY,
    unified_tools_available: true,
  });
};
