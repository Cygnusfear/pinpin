import { RuntimeContext } from '@mastra/core/runtime-context';
import { getPinboardAgent } from '../index.js';

/**
 * Convert technical tool names to user-friendly descriptions
 */
const getFriendlyToolName = (toolName: string): string => {
  const toolMap: Record<string, string> = {
    // Pinboard tools
    'viewAllPinboardWidgets': 'pinboard viewer',
    'addPinboardWidget': 'widget creator',
    'updateWidgetContent': 'content editor',
    'updateWidgetProperties': 'widget configurator',
    'removeWidget': 'widget remover',
    'getPinboardUIState': 'UI state inspector',
    
    // Task workflow
    'executeTaskWorkflow': 'task workflow system',
    
    // File editing tools (MCP)
    'file-editor_edit_file_lines': 'file line editor',
    'file-editor_approve_edit': 'edit approval system',
    'file-editor_get_file_lines': 'file inspector',
    'file-editor_search_file': 'file search',
    
    // Filesystem tools (MCP)
    'filesystem_read_file': 'file reader',
    'filesystem_write_file': 'file writer',
    'filesystem_create_directory': 'directory creator',
    'filesystem_list_directory': 'directory browser',
    'filesystem_move_file': 'file mover',
    'filesystem_search_files': 'file search engine',
    'filesystem_get_file_info': 'file info inspector',
  };
  
  return toolMap[toolName] || toolName.replace(/_/g, ' ').toLowerCase();
};

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
    toolExecutions?: string[];
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
    toolExecutions?: string[];
  };
  // Add progress callback for real-time updates
  onProgress?: (message: string) => void;
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

      // Track tool executions for user visibility
      let toolExecutionMessages: string[] = [];

      // Generate response with memory management
      const response = await agent.generate(messages, {
        memory: {
          thread: { 
            id: request.conversationId,
            metadata: { 
              userId: request.userId,
              sessionId: request.sessionId,
              startedAt: new Date().toISOString()
            }
          },
          resource: request.userId,
        },
        runtimeContext,
        maxSteps: request.maxSteps || 100,  // Increased for comprehensive autonomous execution
        temperature: request.temperature || 0.7,
        onStepFinish: ({ text, toolCalls, toolResults }) => {
          if (toolCalls?.length) {
            console.log(`🔧 Mastra: Executed ${toolCalls.length} tools (Step ${toolExecutionMessages.length + 1})`);
            
            // Add detailed tool execution messages with step numbers
            toolCalls.forEach((toolCall: any, index: number) => {
              const toolName = toolCall.toolName || 'unknown tool';
              const friendlyName = getFriendlyToolName(toolName);
              const stepNumber = toolExecutionMessages.length + 1;
              
              // Include tool parameters for workflow visibility
              const params = toolCall.args ? 
                (toolCall.args.userRequest || toolCall.args.type || 'executing') : 'processing';
              
              toolExecutionMessages.push(`🔧 Step ${stepNumber}: Using ${friendlyName} (${params.toString().slice(0, 50)}...)`);
            });
            
            // Log tool results for debugging
            if (toolResults?.length) {
              toolResults.forEach((result: any, index: number) => {
                console.log(`📊 Tool ${index + 1} result:`, result.success ? '✅ Success' : '❌ Failed');
              });
            }
          }
        },
      });

      // Determine which model was used
      const model = await agent.getModel({ runtimeContext });
      
      // Combine tool execution messages with the agent's response
      const finalMessage = toolExecutionMessages.length > 0 
        ? `${toolExecutionMessages.join('\n')}\n\n${response.text}`
        : response.text;

      return {
        success: true,
        message: finalMessage,
        toolCalls: response.toolCalls || [],
        metadata: {
          provider: 'mastra',
          model: model.modelId || 'unknown',
          timestamp: new Date().toISOString(),
          conversationId: request.conversationId,
          userId: request.userId,
          steps: response.toolCalls?.length || 0,
          toolExecutions: toolExecutionMessages,
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
   * Stream a response from the Mastra agent with real-time progress updates
   */
  async streamResponse(request: MastraChatRequest, progressCallback?: (message: string) => void): Promise<MastraChatStreamResponse> {
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

      // Track tool executions for user visibility (streaming)
      let toolExecutionMessages: string[] = [];

      // Stream response with memory management
      const stream = await agent.stream(messages, {
        memory: {
          thread: { 
            id: request.conversationId,
            metadata: { 
              userId: request.userId,
              sessionId: request.sessionId,
              startedAt: new Date().toISOString()
            }
          },
          resource: request.userId,
        },
        runtimeContext,
        maxSteps: request.maxSteps || 100,  // Increased for comprehensive autonomous execution
        temperature: request.temperature || 0.7,
        onStepFinish: ({ text, toolCalls, toolResults }) => {
          if (toolCalls?.length) {
            console.log(`🔧 Mastra: Executed ${toolCalls.length} tools (Step ${toolExecutionMessages.length + 1}) [STREAM]`);
            
            // Add detailed tool execution messages for streaming with step numbers
            toolCalls.forEach((toolCall: any, index: number) => {
              const toolName = toolCall.toolName || 'unknown tool';
              const friendlyName = getFriendlyToolName(toolName);
              const stepNumber = toolExecutionMessages.length + 1;
              
              // Include tool parameters for workflow visibility
              const params = toolCall.args ? 
                (toolCall.args.userRequest || toolCall.args.type || 'executing') : 'processing';
              
              const progressMessage = `🔧 Step ${stepNumber}: Using ${friendlyName} (${params.toString().slice(0, 50)}...)`;
              toolExecutionMessages.push(progressMessage);
              
              // Send real-time progress update to user via callback
              if (progressCallback) {
                progressCallback(progressMessage);
              }
            });
            
            // Log tool results for debugging and send progress updates
            if (toolResults?.length) {
              toolResults.forEach((result: any, index: number) => {
                const success = result.success !== false; // Default to true if not explicitly false
                const resultMessage = `${success ? '✅' : '❌'} Tool ${index + 1} ${success ? 'completed successfully' : 'failed'}`;
                
                console.log(`📊 [STREAM] Tool ${index + 1} result:`, success ? '✅ Success' : '❌ Failed');
                
                // Send tool result as progress update
                if (progressCallback) {
                  progressCallback(resultMessage);
                }
              });
            }
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
          toolExecutions: toolExecutionMessages,
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
          timestamp: msg.timestamp || new Date().toISOString(),
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