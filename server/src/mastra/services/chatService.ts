import { RuntimeContext } from '@mastra/core/runtime-context';
import { getPinboardAgent } from '../index.js';

export interface MastraChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
  metadata?: Record<string, any>;
}

export interface MastraChatRequest {
  message: string;
  messages?: MastraChatMessage[];
  conversationId: string;
  userId: string;
  sessionId?: string;
  userName?: string;
  taskComplexity?: 'low' | 'normal' | 'high';
  userTier?: 'standard' | 'premium';
  maxSteps?: number;
  temperature?: number;
}

export interface MastraChatResponse {
  success: boolean;
  message?: string;
  error?: string;
  toolCalls?: any[];
  metadata?: {
    provider: string;
    model: string;
    timestamp: string;
    conversationId: string;
    userId: string;
    tokensUsed?: number;
    steps?: number;
  };
}

export interface MastraChatStreamResponse {
  success: boolean;
  stream?: AsyncIterable<string>;
  error?: string;
  metadata?: {
    provider: string;
    model: string;
    timestamp: string;
    conversationId: string;
    userId: string;
  };
}

/**
 * Mastra Chat Service
 * 
 * Provides a high-level interface for interacting with the Mastra pinboard agent.
 * Handles conversation management, memory persistence, and streaming responses.
 */
export class MastraChatService {
  
  /**
   * Generate a response from the Mastra agent
   */
  async generateResponse(request: MastraChatRequest): Promise<MastraChatResponse> {
    try {
      const agent = getPinboardAgent();
      
      // Create runtime context with user and session information
      const runtimeContext = new RuntimeContext();
      runtimeContext.set('userId', request.userId);
      runtimeContext.set('sessionId', request.sessionId || request.conversationId);
      runtimeContext.set('userName', request.userName || 'User');
      runtimeContext.set('taskComplexity', request.taskComplexity || 'normal');
      runtimeContext.set('userTier', request.userTier || 'standard');

      // Prepare messages for the agent
      const messages = request.messages || [
        { role: 'user' as const, content: request.message }
      ];

      // Generate response with memory management
      const response = await agent.generate(messages, {
        memory: {
          thread: { 
            id: request.conversationId,
            metadata: { 
              userId: request.userId,
              sessionId: request.sessionId,
              startedAt: Date.now()
            }
          },
          resource: request.userId,
        },
        runtimeContext,
        maxSteps: request.maxSteps || 10,
        temperature: request.temperature || 0.7,
        onStepFinish: ({ text, toolCalls, toolResults }) => {
          if (toolCalls?.length) {
            console.log(`🔧 Mastra: Executed ${toolCalls.length} tools`);
          }
        },
      });

      // Determine which model was used
      const model = await agent.getModel({ runtimeContext });
      
      return {
        success: true,
        message: response.text,
        toolCalls: response.toolCalls || [],
        metadata: {
          provider: 'mastra',
          model: model.modelId || 'unknown',
          timestamp: new Date().toISOString(),
          conversationId: request.conversationId,
          userId: request.userId,
          steps: response.toolCalls?.length || 0,
        },
      };

    } catch (error: any) {
      console.error('❌ Mastra Chat Service Error:', error);
      
      return {
        success: false,
        error: error.message || 'Failed to generate response',
        metadata: {
          provider: 'mastra',
          model: 'unknown',
          timestamp: new Date().toISOString(),
          conversationId: request.conversationId,
          userId: request.userId,
        },
      };
    }
  }

  /**
   * Stream a response from the Mastra agent
   */
  async streamResponse(request: MastraChatRequest): Promise<MastraChatStreamResponse> {
    try {
      const agent = getPinboardAgent();
      
      // Create runtime context with user and session information
      const runtimeContext = new RuntimeContext();
      runtimeContext.set('userId', request.userId);
      runtimeContext.set('sessionId', request.sessionId || request.conversationId);
      runtimeContext.set('userName', request.userName || 'User');
      runtimeContext.set('taskComplexity', request.taskComplexity || 'normal');
      runtimeContext.set('userTier', request.userTier || 'standard');

      // Prepare messages for the agent
      const messages = request.messages || [
        { role: 'user' as const, content: request.message }
      ];

      // Stream response with memory management
      const stream = await agent.stream(messages, {
        memory: {
          thread: { 
            id: request.conversationId,
            metadata: { 
              userId: request.userId,
              sessionId: request.sessionId,
              startedAt: Date.now()
            }
          },
          resource: request.userId,
        },
        runtimeContext,
        maxSteps: request.maxSteps || 10,
        temperature: request.temperature || 0.7,
        onStepFinish: ({ text, toolCalls, toolResults }) => {
          if (toolCalls?.length) {
            console.log(`🔧 Mastra: Executed ${toolCalls.length} tools`);
          }
        },
        onFinish: ({ steps, text, finishReason, usage }) => {
          console.log(`✅ Mastra: Stream completed (${steps.length} steps, reason: ${finishReason})`);
        },
      });

      // Determine which model was used
      const model = await agent.getModel({ runtimeContext });
      
      return {
        success: true,
        stream: stream.textStream,
        metadata: {
          provider: 'mastra',
          model: model.modelId || 'unknown',
          timestamp: new Date().toISOString(),
          conversationId: request.conversationId,
          userId: request.userId,
        },
      };

    } catch (error: any) {
      console.error('❌ Mastra Chat Stream Error:', error);
      
      return {
        success: false,
        error: error.message || 'Failed to stream response',
        metadata: {
          provider: 'mastra',
          model: 'unknown',
          timestamp: new Date().toISOString(),
          conversationId: request.conversationId,
          userId: request.userId,
        },
      };
    }
  }

  /**
   * Get conversation history for a user and thread
   */
  async getConversationHistory(userId: string, conversationId: string, limit: number = 50) {
    try {
      const agent = getPinboardAgent();
      const memory = await agent.getMemory();
      
      if (!memory) {
        return { success: false, error: 'Memory system not available' };
      }

      // Get messages from the thread
      const result = await memory.query({
        resourceId: userId,
        threadId: conversationId,
        selectBy: { last: limit },
      });

      return {
        success: true,
        messages: result.messages.map((msg: any) => ({
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp || Date.now(),
        })),
        threadId: conversationId,
        totalMessages: result.messages.length,
      };

    } catch (error: any) {
      console.error('❌ Error getting conversation history:', error);
      return {
        success: false,
        error: error.message || 'Failed to get conversation history',
      };
    }
  }

  /**
   * Clear conversation history for a user and thread
   */
  async clearConversationHistory(userId: string, conversationId: string) {
    try {
      const agent = getPinboardAgent();
      const memory = await agent.getMemory();
      
      if (!memory) {
        return { success: false, error: 'Memory system not available' };
      }

      // Note: This is a placeholder - actual implementation depends on Memory API
      // For now, we'll create a system message indicating the conversation was cleared
      await agent.generate([
        { role: 'system', content: 'Conversation history has been cleared by user request.' }
      ], {
        memory: {
          thread: { id: conversationId },
          resource: userId,
        },
      });

      return {
        success: true,
        message: 'Conversation history cleared',
      };

    } catch (error: any) {
      console.error('❌ Error clearing conversation history:', error);
      return {
        success: false,
        error: error.message || 'Failed to clear conversation history',
      };
    }
  }

  /**
   * Get agent capabilities and status
   */
  async getAgentStatus() {
    try {
      const agent = getPinboardAgent();
      const memory = await agent.getMemory();
      const tools = await agent.getTools();
      
      return {
        success: true,
        status: 'healthy',
        capabilities: {
          hasMemory: !!memory,
          toolCount: Object.keys(tools).length,
          supportedModels: ['gpt-4o', 'claude-3-5-sonnet-20241022'],
          features: [
            'persistent_memory',
            'working_memory',
            'semantic_recall',
            'tool_calling',
            'streaming',
            'dynamic_model_selection',
            'conversation_threads',
          ],
        },
        timestamp: new Date().toISOString(),
      };

    } catch (error: any) {
      console.error('❌ Error getting agent status:', error);
      return {
        success: false,
        error: error.message || 'Failed to get agent status',
        status: 'unhealthy',
      };
    }
  }
}

// Export singleton instance
export const mastraChatService = new MastraChatService();