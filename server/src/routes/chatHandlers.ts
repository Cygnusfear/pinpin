/**
 * Claude AI Chat Route Handlers
 *
 * Main route handler functions for the Claude chat system, utilizing
 * separated modules for types, validation, context generation, and tools.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { Request, Response } from "express";
// Import Claude tools
import {
  chatNarrativeTool,
  listDirectoryTool,
  locationGenerationTool,
  readFileTool,
  writeFileTool,
} from "../claude/tools.js";
// Import context generation functions
import {
  createChatSystemMessage,
  createLocationSystemMessage,
  generateCharacterAnalysis,
  generateCharacterContext,
  generateDiceRollContext,
  generateLocationContext,
  rollD20,
} from "../context/chatContext.js";
// Import types
import type { ChatRequestBody, LocationRequestBody } from "../types/chat.js";
// Import validation functions
import {
  validateChatRequest,
  validateLocationRequest,
  validateLocationResponse,
} from "../validation/chatValidation.js";
import { validateChatResponse } from "../validation/responseValidation.js";

/**
 * Handle filesystem operations by calling the appropriate internal API
 */
async function handleFilesystemOperation(
  toolName: string,
  input: any,
): Promise<any> {
  const baseUrl =
    process.env.NODE_ENV === "production"
      ? "https://your-domain.com" // Replace with your actual domain
      : "http://localhost:6080";

  try {
    switch (toolName) {
      case "listDirectory": {
        const { path } = input;
        const response = await fetch(
          `${baseUrl}/api/fs/list?path=${encodeURIComponent(path)}`,
        );
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to list directory");
        }
        return await response.json();
      }

      case "readFile": {
        const { path, encoding = "utf8" } = input;
        const url = `${baseUrl}/api/fs/read?path=${encodeURIComponent(path)}&encoding=${encoding}`;
        const response = await fetch(url);
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to read file");
        }
        return await response.json();
      }

      case "writeFile": {
        const { path, content, encoding = "utf8" } = input;
        const response = await fetch(`${baseUrl}/api/fs/write`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ path, content, encoding }),
        });
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to write file");
        }
        return await response.json();
      }

      default:
        throw new Error(`Unknown filesystem operation: ${toolName}`);
    }
  } catch (error: any) {
    console.error(`Filesystem operation error (${toolName}):`, error.message);
    throw error;
  }
}

/**
 * Format filesystem operation results into user-friendly messages
 */
function formatFilesystemResponse(toolName: string, result: any): string {
  switch (toolName) {
    case "listDirectory":
      if (result.items && Array.isArray(result.items)) {
        const fileCount = result.items.filter(
          (item: any) => item.type === "file",
        ).length;
        const dirCount = result.items.filter(
          (item: any) => item.type === "directory",
        ).length;
        const itemsList = result.items
          .map(
            (item: any) =>
              `${item.type === "directory" ? "📁" : "📄"} ${item.name}`,
          )
          .join("\n");
        return `Directory listing for "${result.currentPath}":\n\nFound ${fileCount} files and ${dirCount} directories:\n\n${itemsList}`;
      }
      return `Listed directory: ${JSON.stringify(result)}`;

    case "readFile":
      if (result.content) {
        const preview =
          result.content.length > 500
            ? `${result.content.substring(0, 500)}...\n\n[Content truncated]`
            : result.content;
        return `File content (${result.size} bytes, ${result.encoding} encoding):\n\n\`\`\`\n${preview}\n\`\`\``;
      }
      return `Read file: ${JSON.stringify(result)}`;

    case "writeFile":
      return `Successfully wrote ${result.size} bytes to "${result.path}"`;

    default:
      return `Filesystem operation completed: ${JSON.stringify(result)}`;
  }
}

/**
 * Process Claude tool response and return appropriate result
 */
async function processToolResponse(toolUse: any, res: Response): Promise<void> {
  console.log("=== Claude Tool Use Debug ===");
  console.log("Tool name:", toolUse.name);
  console.log("==============================");

  // Handle different tool types
  if (toolUse.name === "returnNarrative") {
    const structuredResponse = toolUse.input as any;

    // Validate response
    const responseValidation = validateChatResponse(structuredResponse);
    if (!responseValidation.isValid) {
      console.error("=== Response Validation Failed ===");
      console.error("Validation errors:", responseValidation.errors);
      throw new Error(
        `Response validation failed: ${responseValidation.errors.join(", ")}`,
      );
    }

    console.log("=== Claude D&D Response Success ===");
    console.log("Response keys:", Object.keys(structuredResponse));
    console.log("Message length:", structuredResponse.message?.length || 0);
    if (structuredResponse.character_moved !== undefined) {
      console.log("Character moved:", structuredResponse.character_moved);
      if (structuredResponse.character_moved === "unexplored_location") {
        console.log(
          "Creating new location:",
          structuredResponse.new_location?.location?.name || "Unknown",
        );
      }
    }
    console.log("==================================");

    res.json({
      success: true,
      data: structuredResponse,
    });
  } else if (
    ["listDirectory", "readFile", "writeFile"].includes(toolUse.name)
  ) {
    // Handle filesystem operations
    const result = await handleFilesystemOperation(
      toolUse.name,
      toolUse.input as any,
    );

    // Format filesystem response to match expected client structure
    const formattedMessage = formatFilesystemResponse(toolUse.name, result);

    res.json({
      success: true,
      data: {
        message: formattedMessage,
        tool: toolUse.name,
        filesystem_result: result,
      },
    });
  } else {
    throw new Error(`Unknown tool: ${toolUse.name}`);
  }
}

// Initialize Anthropic client (lazy initialization to ensure env vars are loaded)
let anthropic: Anthropic | null = null;

const getAnthropicClient = (): Anthropic => {
  if (!anthropic) {
    console.log("=== Anthropic Client Debug ===");
    console.log("API Key exists:", !!process.env.VITE_ANTHROPIC_API_KEY);
    console.log(
      "API Key length:",
      process.env.VITE_ANTHROPIC_API_KEY?.length || 0,
    );
    console.log("============================");

    if (!process.env.VITE_ANTHROPIC_API_KEY) {
      throw new Error("VITE_ANTHROPIC_API_KEY environment variable is not set");
    }

    anthropic = new Anthropic({
      apiKey: process.env.VITE_ANTHROPIC_API_KEY,
    });
  }
  return anthropic;
};

/**
 * Claude chat endpoint handler
 *
 * Handles D&D chat conversations with Claude 4, managing character interactions,
 * location tracking, dice mechanics, and narrative generation.
 *
 * @example
 * POST /api/claude/chat
 * {
 *   "messages": [{"role": "user", "content": "I look around the tavern"}],
 *   "locations": [...],
 *   "characters": [...]
 * }
 */
export const claudeChatHandler = async (req: Request, res: Response) => {
  try {
    const validation = validateChatRequest(req.body);
    if (!validation.isValid) {
      return res.status(400).json({
        error: validation.errors.join(", "),
      });
    }

    const { messages, locations, characters }: ChatRequestBody = req.body;

    // Generate context strings
    const { context: locationContext } = generateLocationContext(
      locations,
      messages,
    );
    const characterContext = generateCharacterContext(characters);

    // Roll dice for world response
    const worldRoll = rollD20();

    // Extract character roll from the last message if it's a character message
    let characterRoll: number | null = null;
    const lastMessage = messages[messages.length - 1];
    if (
      lastMessage &&
      typeof lastMessage === "object" &&
      "roll" in lastMessage
    ) {
      characterRoll = lastMessage.roll as number;
    }

    const diceRollContext = generateDiceRollContext(worldRoll, characterRoll);
    const systemMessage = createChatSystemMessage(
      locationContext,
      characterContext,
      diceRollContext,
    );

    // Convert messages to Claude format
    const claudeMessages = messages.map((msg) => ({
      role: msg.role === "user" ? ("user" as const) : ("assistant" as const),
      content: msg.content,
    }));

    console.log("=== Claude Chat Request Debug ===");
    console.log("Total messages:", claudeMessages.length);
    console.log("Using tool use for chat response");
    console.log("===============================");

    // Make request to Claude with tool use
    const response = await getAnthropicClient().messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8000,
      temperature: 0.3,
      system: systemMessage,
      messages: claudeMessages,
      tools: [
        chatNarrativeTool, // Primary tool for conversation and D&D
        listDirectoryTool,
        readFileTool,
        writeFileTool,
      ],
      tool_choice: { type: "any" },
    });

    console.log("=== Claude Chat Completion Debug ===");
    console.log("Response type:", response.type);
    console.log(
      "Tool uses:",
      response.content.filter((c) => c.type === "tool_use").length,
    );
    console.log("==================================");

    // Find tool use in response (forced by tool_choice: "any")
    const toolUse = response.content.find((c) => c.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      throw new Error("No tool use found in Claude response");
    }

    // Process the tool response
    await processToolResponse(toolUse, res);
  } catch (error: any) {
    console.error("=== Claude Chat API Error Debug ===");
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
        error: "Invalid Anthropic API key",
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
 * Claude starting location generation endpoint handler
 *
 * Generates immersive starting locations for D&D characters based on their
 * background, abilities, and backstory using Claude 4.
 *
 * @example
 * POST /api/claude/generate-starting-location
 * {
 *   "character": {...},
 *   "backstory": "A young wizard seeking knowledge..."
 * }
 */
export const claudeLocationHandler = async (req: Request, res: Response) => {
  try {
    const validation = validateLocationRequest(req.body);
    if (!validation.isValid) {
      return res.status(400).json({
        error: validation.errors.join(", "),
      });
    }

    const { character, backstory }: LocationRequestBody = req.body;

    // Create character analysis and system message
    const characterAnalysis = generateCharacterAnalysis(character, backstory);
    const systemMessage = createLocationSystemMessage(characterAnalysis);

    console.log("=== Claude Location Request Debug ===");
    console.log("Character name:", character.core.name);
    console.log("Character class:", character.class?.name || "None");
    console.log("Using tool use for location generation");
    console.log("===================================");

    // Make request to Claude with tool use
    const response = await getAnthropicClient().messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8000,
      temperature: 0.5,
      system: systemMessage,
      messages: [],
      tools: [locationGenerationTool],
      tool_choice: { type: "tool", name: "generateLocation" },
    });

    console.log("=== Claude Location Completion Debug ===");
    console.log("Response type:", response.type);
    console.log(
      "Tool uses:",
      response.content.filter((c) => c.type === "tool_use").length,
    );
    console.log("======================================");

    // Find tool use in response
    const toolUse = response.content.find(
      (c) => c.type === "tool_use" && c.name === "generateLocation",
    );
    if (!toolUse || toolUse.type !== "tool_use") {
      throw new Error("No generateLocation tool use found in Claude response");
    }

    const locationNode = toolUse.input as any;

    // Validate location response
    const locationValidation = validateLocationResponse(locationNode);
    if (!locationValidation.isValid) {
      console.error("=== Location Response Validation Failed ===");
      console.error("Validation errors:", locationValidation.errors);
      throw new Error(
        `Location response validation failed: ${locationValidation.errors.join(", ")}`,
      );
    }

    console.log("=== Claude Location Tool Use Success ===");
    console.log("Tool name:", toolUse.name);
    console.log("Location name:", locationNode.location?.name || "Unknown");
    console.log("Edges count:", locationNode.edges?.length || 0);
    console.log("======================================");

    res.json({
      success: true,
      data: locationNode,
    });
  } catch (error: any) {
    console.error("=== Claude Location Generation Error Debug ===");
    console.error("Error type:", typeof error);
    console.error("Error constructor:", error.constructor.name);
    console.error("Error message:", error.message);
    if (error.response) {
      console.error("Error response:", error.response);
    }
    console.error("==========================================");

    // Handle different types of errors
    if (error.status === 401) {
      return res.status(401).json({
        error: "Invalid Anthropic API key",
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
 * Health check endpoint handler
 *
 * Provides server health status and configuration information.
 * Used by the hosting platform for health monitoring.
 */
export const healthHandler = (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    anthropic_configured: !!process.env.VITE_ANTHROPIC_API_KEY,
  });
};
