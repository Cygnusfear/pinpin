/**
 * Stream Route Handlers
 * 
 * New JSON-lines streaming endpoints that provide a Claude Code-style
 * streaming experience with proper message ordering and clear boundaries.
 * 
 * Replaces the existing SSE-based streaming with a simpler, more reliable
 * JSON-lines protocol.
 */

import type { Request, Response } from "express";
import { unifiedStreamManager, type ChatStreamRequest } from "../services/streamManager.js";

/**
 * Request body interface for the new streaming endpoint
 */
interface StreamChatRequest {
  message: string;
  messages?: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
  conversationId: string;
  userId: string;
  sessionId?: string;
  userName?: string;
  maxSteps?: number;
  temperature?: number;
}

/**
 * New unified chat streaming endpoint
 * 
 * Returns a JSON-lines stream with ordered events:
 * - message_start: Begin processing
 * - content: AI-generated text chunks
 * - tool: Tool execution progress  
 * - message_complete: Final response with complete content
 * - error: Any processing errors
 * 
 * @example
 * POST /api/chat/stream
 * {
 *   "message": "Create a timer widget",
 *   "conversationId": "chat-123",
 *   "userId": "user-456"
 * }
 * 
 * Response (JSON-lines):
 * {"type": "message_start", "id": "msg_123", "timestamp": 1234567890}
 * {"type": "tool", "id": "msg_123", "tool": "widget creator", "status": "running"}
 * {"type": "content", "id": "msg_123", "data": "I'll create a timer widget for you..."}
 * {"type": "tool", "id": "msg_123", "tool": "widget creator", "status": "complete"}
 * {"type": "message_complete", "id": "msg_123", "final_content": "I'll create a timer widget for you..."}
 */
export const streamChatHandler = async (req: Request, res: Response) => {
  try {
    const {
      message,
      messages,
      conversationId,
      userId,
      sessionId,
      userName,
      maxSteps,
      temperature
    }: StreamChatRequest = req.body;

    // Validate required fields
    if (!message || !conversationId || !userId) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: message, conversationId, and userId are required",
      });
    }

    console.log("=== New Unified Chat Stream Request ===");
    console.log("User ID:", userId);
    console.log("Conversation ID:", conversationId);
    console.log("Message length:", message.length);
    console.log("Max steps:", maxSteps || 100);
    console.log("=====================================");

    // Set up streaming response headers for JSON-lines
    res.writeHead(200, {
      'Content-Type': 'application/x-ndjson', // Newline Delimited JSON
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Transfer-Encoding': 'chunked'
    });

    // Create unified stream request
    const streamRequest: ChatStreamRequest = {
      message,
      messages,
      conversationId,
      userId,
      sessionId,
      userName,
      maxSteps: maxSteps || 100,
      temperature: temperature || 0.7
    };

    try {
      // Get unified stream from manager
      const stream = await unifiedStreamManager.createUnifiedStream(streamRequest);
      
      // Pipe the stream directly to the response
      const reader = stream.getReader();
      
      const pump = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            // Write JSON-lines data directly to response
            res.write(value);
            
            // Force flush for real-time streaming
            if (res.flush) {
              res.flush();
            }
          }
          
          console.log("✅ Stream completed successfully");
          res.end();
          
        } catch (pumpError: any) {
          console.error("❌ Stream pump error:", pumpError);
          res.end();
        } finally {
          reader.releaseLock();
        }
      };
      
      await pump();
      
    } catch (streamError: any) {
      console.error("❌ Stream creation error:", streamError);
      
      // Send error as JSON-lines format
      const errorEvent = {
        type: 'error',
        id: `error_${Date.now()}`,
        error: streamError.message || 'Failed to create stream',
        timestamp: Date.now()
      };
      
      res.write(JSON.stringify(errorEvent) + '\n');
      res.end();
    }

  } catch (error: any) {
    console.error("=== Stream Chat Handler Error ===");
    console.error("Error type:", typeof error);
    console.error("Error constructor:", error.constructor.name);
    console.error("Error message:", error.message);
    console.error("Stack trace:", error.stack);
    console.error("===============================");

    // If headers haven't been sent, send JSON error
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: "Internal server error",
        message: error.message,
        errorType: error.constructor.name,
      });
    } else {
      // If streaming has started, send error event and close
      const errorEvent = {
        type: 'error',
        id: `error_${Date.now()}`,
        error: error.message || 'Internal server error',
        timestamp: Date.now()
      };
      
      res.write(JSON.stringify(errorEvent) + '\n');
      res.end();
    }
  }
};

/**
 * Health check endpoint for the new streaming system
 * 
 * @example
 * GET /api/chat/stream/health
 */
export const streamHealthHandler = async (_req: Request, res: Response) => {
  try {
    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      service: "unified-chat-stream",
      version: "1.0.0",
      protocol: "json-lines",
      features: [
        "ordered_events",
        "tool_progress",
        "content_streaming", 
        "clear_boundaries",
        "error_handling"
      ]
    });

  } catch (error: any) {
    console.error("❌ Stream health check error:", error);
    res.status(500).json({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      service: "unified-chat-stream",
      error: error.message,
    });
  }
};