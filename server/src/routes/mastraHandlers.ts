/**
 * Mastra AI Chat Route Handlers
 *
 * Modern route handler functions for the Mastra-based agent system,
 * replacing the previous Groq implementation with enhanced capabilities
 * including persistent memory, dynamic model selection, and MCP integration.
 */

import type { Request, Response } from "express";
import { mastraChatService } from "../mastra/services/chatService.js";
import ENV from "../env.js";

/**
 * Request body interface for agent chat endpoint
 */
interface AgentChatRequest {
  message: string;
  messages?: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp?: number;
    metadata?: Record<string, any>;
  }>;
  conversationId: string;
  userId: string;
  sessionId?: string;
  userName?: string;
  taskComplexity?: 'low' | 'normal' | 'high';
  userTier?: 'standard' | 'premium';
  maxSteps?: number;
  temperature?: number;
  stream?: boolean;
}

/**
 * Mastra agent chat endpoint handler
 *
 * Handles chat conversations using the sophisticated Mastra framework with:
 * - Persistent memory across sessions
 * - Dynamic model selection (GPT-4o/Claude Sonnet)
 * - MCP tool integration for pinboard operations
 * - Working memory for user context
 * - Semantic recall capabilities
 * - Support for both regular and streaming responses
 *
 * @example
 * POST /api/agent/chat
 * {
 *   "message": "Hey Tonk! Can you help me create a simple timer widget?",
 *   "conversationId": "session-123",
 *   "userId": "user-456"
 * }
 */
export const mastraAgentChatHandler = async (req: Request, res: Response) => {
  try {
    const {
      message,
      messages,
      conversationId,
      userId,
      sessionId,
      userName,
      taskComplexity,
      userTier,
      maxSteps,
      temperature,
      stream
    }: AgentChatRequest = req.body;

    // Default to 100 steps for autonomous task execution
    const effectiveMaxSteps = maxSteps || 100;

    // Validate required fields
    if (!message || !conversationId || !userId) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: message, conversationId, and userId are required",
      });
    }

    console.log("=== Mastra Agent Chat Request ===");
    console.log("User ID:", userId);
    console.log("Conversation ID:", conversationId);
    console.log("Message length:", message.length);
    console.log("Task complexity:", taskComplexity || 'normal');
    console.log("User tier:", userTier || 'standard');
    console.log("Stream mode:", !!stream);
    console.log("===============================");

    // Handle streaming responses
    if (stream) {
      // Set up Server-Sent Events for streaming BEFORE calling streamResponse
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      });

      // Progress callback to send real-time updates to user
      const sendProgress = (message: string) => {
        console.log("📡 SSE Progress:", message);
        res.write(`data: ${JSON.stringify({
          type: 'progress',
          data: message
        })}\n\n`);
        // Force flush the buffer to ensure immediate delivery
        if (res.flush) {
          res.flush();
        }
      };

      const streamResult = await mastraChatService.streamResponse({
        message,
        messages,
        conversationId,
        userId,
        sessionId,
        userName,
        taskComplexity,
        userTier,
        maxSteps: effectiveMaxSteps,
        temperature
      }, sendProgress);

      if (!streamResult.success) {
        res.write(`data: ${JSON.stringify({
          type: 'error',
          data: { error: streamResult.error }
        })}\n\n`);
        res.end();
        return;
      }

      // Send initial metadata
      res.write(`data: ${JSON.stringify({
        type: 'metadata',
        data: streamResult.metadata
      })}\n\n`);

      try {
        if (streamResult.stream) {
          console.log("📡 Stream available, starting to read chunks...");
          let chunkCount = 0;
          for await (const chunk of streamResult.stream) {
            chunkCount++;
            res.write(`data: ${JSON.stringify({
              type: 'content',
              data: chunk
            })}\n\n`);
            // Force flush each content chunk for real-time streaming
            if (res.flush) {
              res.flush();
            }
          }
            res.write(`data: ${JSON.stringify({
              type: 'end-stream',
              data: 'end-stream'
            })}\n\n`);
          console.log(`📡 Stream completed - sent ${chunkCount} chunks`);
        } else {
          console.log("❌ No stream available in streamResult");
        }

        // Send completion signal
        res.write(`data: ${JSON.stringify({
          type: 'done',
          data: { success: true }
        })}\n\n`);

        res.end();
      } catch (streamError: any) {
        console.error("❌ Streaming error:", streamError);
        res.write(`data: ${JSON.stringify({
          type: 'error',
          data: { error: streamError.message }
        })}\n\n`);
        res.end();
      }

      return;
    }

    // Handle regular (non-streaming) responses
    const result = await mastraChatService.generateResponse({
      message,
      messages,
      conversationId,
      userId,
      sessionId,
      userName,
      taskComplexity,
      userTier,
      maxSteps: effectiveMaxSteps,
      temperature
    });

    console.log("=== Mastra Agent Chat Response ===");
    console.log("Success:", result.success);
    console.log("Response length:", result.message?.length || 0);
    console.log("Tool calls:", result.toolCalls?.length || 0);
    console.log("Model used:", result.metadata?.model);
    console.log("Provider:", result.metadata?.provider);
    console.log("================================");

    if (result.success) {
      res.json({
        success: true,
        data: {
          message: result.message,
          tool_calls: result.toolCalls,
          metadata: result.metadata,
        },
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
        metadata: result.metadata,
      });
    }

  } catch (error: any) {
    console.error("=== Mastra Agent Chat Handler Error ===");
    console.error("Error type:", typeof error);
    console.error("Error constructor:", error.constructor.name);
    console.error("Error message:", error.message);
    console.error("Stack trace:", error.stack);
    console.error("=====================================");

    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message,
      errorType: error.constructor.name,
    });
  }
};

/**
 * Get conversation history endpoint handler
 *
 * Retrieves conversation history for a specific user and conversation thread.
 *
 * @example
 * GET /api/agent/history?userId=user-123&conversationId=session-456&limit=50
 */
export const mastraConversationHistoryHandler = async (req: Request, res: Response) => {
  try {
    const { userId, conversationId, limit } = req.query;

    if (!userId || !conversationId) {
      return res.status(400).json({
        success: false,
        error: "Missing required query parameters: userId and conversationId are required",
      });
    }

    const limitNum = limit ? parseInt(limit as string, 10) : 50;

    console.log("=== Getting Conversation History ===");
    console.log("User ID:", userId);
    console.log("Conversation ID:", conversationId);
    console.log("Limit:", limitNum);
    console.log("==================================");

    const result = await mastraChatService.getConversationHistory(
      userId as string,
      conversationId as string,
      limitNum
    );

    res.json(result);

  } catch (error: any) {
    console.error("❌ Error getting conversation history:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get conversation history",
      message: error.message,
    });
  }
};

/**
 * Clear conversation history endpoint handler
 *
 * Clears conversation history for a specific user and conversation thread.
 *
 * @example
 * DELETE /api/agent/history
 * {
 *   "userId": "user-123",
 *   "conversationId": "session-456"
 * }
 */
export const mastraClearHistoryHandler = async (req: Request, res: Response) => {
  try {
    const { userId, conversationId } = req.body;

    if (!userId || !conversationId) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: userId and conversationId are required",
      });
    }

    console.log("=== Clearing Conversation History ===");
    console.log("User ID:", userId);
    console.log("Conversation ID:", conversationId);
    console.log("====================================");

    const result = await mastraChatService.clearConversationHistory(userId, conversationId);

    res.json(result);

  } catch (error: any) {
    console.error("❌ Error clearing conversation history:", error);
    res.status(500).json({
      success: false,
      error: "Failed to clear conversation history",
      message: error.message,
    });
  }
};

/**
 * Agent status endpoint handler
 *
 * Provides detailed information about the Mastra agent's capabilities,
 * health status, and available features.
 *
 * @example
 * GET /api/agent/status
 */
export const mastraAgentStatusHandler = async (_req: Request, res: Response) => {
  try {
    console.log("=== Getting Agent Status ===");

    const result = await mastraChatService.getAgentStatus();

    res.json(result);

  } catch (error: any) {
    console.error("❌ Error getting agent status:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get agent status",
      message: error.message,
    });
  }
};

/**
 * Agent capabilities endpoint handler
 *
 * Returns a detailed overview of the agent's capabilities, tools, and features.
 * Useful for frontend integration and feature discovery.
 *
 * @example
 * GET /api/agent/capabilities
 */
export const mastraAgentCapabilitiesHandler = async (_req: Request, res: Response) => {
  try {
    const result = await mastraChatService.getAgentStatus();

    if (result.success) {
      res.json({
        success: true,
        capabilities: result.capabilities,
        features: {
          chat: {
            description: "Advanced conversational AI with memory",
            endpoints: ["/api/agent/chat"],
            supports: ["streaming", "tool_calling", "memory_persistence"]
          },
          memory: {
            description: "Persistent conversation memory with semantic recall",
            endpoints: ["/api/agent/history"],
            supports: ["working_memory", "semantic_search", "thread_management"]
          },
          tools: {
            description: "MCP-integrated tools for pinboard operations",
            available: [
              "viewAllPinboardWidgets",
              "addPinboardWidget", 
              "updateWidgetContent",
              "updateWidgetProperties",
              "removeWidget",
              "getPinboardUIState"
            ],
            supports: ["widget_management", "ui_state_sync", "structured_outputs"]
          },
          models: {
            description: "Dynamic model selection based on task complexity",
            available: result.capabilities?.supportedModels || ["gpt-4o", "claude-3-5-sonnet-20241022"],
            selection: "automatic_based_on_context"
          }
        },
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(500).json(result);
    }

  } catch (error: any) {
    console.error("❌ Error getting agent capabilities:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get agent capabilities",
      message: error.message,
    });
  }
};

/**
 * Health check endpoint handler for Mastra agent service
 *
 * Provides comprehensive health status including API keys, memory system,
 * and MCP integration status.
 */
export const mastraAgentHealthHandler = async (_req: Request, res: Response) => {
  try {
    const agentStatus = await mastraChatService.getAgentStatus();
    
    res.json({
      status: agentStatus.success ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      service: "mastra-agent",
      version: "1.0.0",
      configuration: {
        groq_configured: !!ENV.VITE_GROQ_API_KEY,
        anthropic_configured: !!ENV.VITE_ANTHROPIC_API_KEY,
        memory_system: agentStatus.capabilities?.hasMemory || false,
        mcp_integration: true,
        tool_count: agentStatus.capabilities?.toolCount || 0,
      },
      features: agentStatus.capabilities?.features || [],
      agent_status: agentStatus.success ? "operational" : "error",
      agent_error: agentStatus.success ? null : agentStatus.error,
    });

  } catch (error: any) {
    console.error("❌ Health check error:", error);
    res.status(500).json({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      service: "mastra-agent",
      error: error.message,
    });
  }
};