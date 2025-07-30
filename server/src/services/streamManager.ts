/**
 * Unified Stream Manager
 * 
 * Provides a Claude Code-style streaming experience by merging tool progress
 * and AI content into a single ordered stream with clear message boundaries.
 * 
 * Key Features:
 * - Ordered event processing (no race conditions)
 * - JSON-lines protocol (not SSE)
 * - Clear message lifecycle (start -> content/tools -> complete)
 * - Proper error handling and cleanup
 */

import { getPinboardAgent } from '../mastra/index.js';
import { RuntimeContext } from '@mastra/core/runtime-context';

export interface StreamEvent {
  type: 'message_start' | 'content' | 'tool' | 'message_complete' | 'error';
  id: string;
  timestamp?: number;
  data?: string;
  tool?: string;
  status?: 'running' | 'complete' | 'error';
  final_content?: string;
  error?: string;
}

export interface ChatStreamRequest {
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
 * OrderedEventQueue ensures all events are emitted in the correct sequence
 * to prevent race conditions between tool progress and AI content.
 */
class OrderedEventQueue {
  private events: Array<{order: number, event: StreamEvent}> = [];
  private orderCounter = 0;
  private contentBuffer = "";
  
  getNextOrder(): number {
    return this.orderCounter++;
  }
  
  addEvent(event: StreamEvent, order: number) {
    this.events.push({ order, event });
    
    // Build content buffer for final message
    if (event.type === 'content' && event.data) {
      this.contentBuffer += event.data;
    }
  }
  
  getAllOrderedEvents(): StreamEvent[] {
    return this.events
      .sort((a, b) => a.order - b.order)
      .map(item => item.event);
  }
  
  getFinalContent(): string {
    return this.contentBuffer;
  }
  
  clear() {
    this.events = [];
    this.orderCounter = 0;
    this.contentBuffer = "";
  }
}

/**
 * UnifiedStreamManager processes chat requests and returns an ordered stream
 * of events that merge tool progress and AI content chronologically.
 */
export class UnifiedStreamManager {
  private currentMessageId: string = '';
  
  /**
   * Process a chat request and return a ReadableStream of ordered events
   */
  async createUnifiedStream(request: ChatStreamRequest): Promise<ReadableStream<Uint8Array>> {
    this.currentMessageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return new ReadableStream({
      start: (controller) => {
        this.processMessageStream(controller, request)
          .catch(error => {
            console.error('❌ Stream processing error:', error);
            this.emitEvent(controller, {
              type: 'error',
              id: this.currentMessageId,
              error: error.message || 'Unknown streaming error',
              timestamp: Date.now()
            });
            controller.close();
          });
      }
    });
  }
  
  /**
   * Main processing logic that coordinates Mastra agent streaming
   * with ordered event emission
   */
  private async processMessageStream(
    controller: ReadableStreamDefaultController<Uint8Array>, 
    request: ChatStreamRequest
  ) {
    // Start message
    this.emitEvent(controller, {
      type: 'message_start',
      id: this.currentMessageId,
      timestamp: Date.now()
    });
    
    try {
      const agent = getPinboardAgent();
      
      // Create runtime context
      const runtimeContext = new RuntimeContext();
      runtimeContext.set('userId', request.userId);
      runtimeContext.set('sessionId', request.sessionId || request.conversationId);
      runtimeContext.set('userName', request.userName || 'User');
      
      // Prepare messages
      const messages = request.messages || [
        { role: 'user' as const, content: request.message }
      ];
      
      console.log(`🎯 Starting unified stream for message: ${this.currentMessageId}`);
      
      // Create Mastra stream with ordered event processing
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
        maxSteps: request.maxSteps || 100,
        temperature: request.temperature || 0.7,
        
        // Emit tool executions immediately as they happen
        onStepFinish: ({ toolCalls, toolResults }) => {
          if (toolCalls?.length) {
            toolCalls.forEach((toolCall: any) => {
              const toolEvent: StreamEvent = {
                type: 'tool',
                id: this.currentMessageId,
                tool: this.getFriendlyToolName(toolCall.toolName || 'unknown'),
                status: 'running',
                timestamp: Date.now()
              };
              
              // Emit immediately, don't queue
              this.emitEvent(controller, toolEvent);
              console.log(`🔧 Emitted tool event:`, toolCall.toolName);
            });
            
            // Mark tools as complete immediately
            if (toolResults?.length) {
              toolResults.forEach((result: any, index: number) => {
                const completionEvent: StreamEvent = {
                  type: 'tool',
                  id: this.currentMessageId,
                  tool: this.getFriendlyToolName(toolCalls[index]?.toolName || 'unknown'),
                  status: result.success !== false ? 'complete' : 'error',
                  timestamp: Date.now()
                };
                
                // Emit immediately, don't queue
                this.emitEvent(controller, completionEvent);
                console.log(`✅ Emitted tool completion:`, completionEvent.status);
              });
            }
          }
        }
      });
      
      // Process text stream and emit content immediately
      let finalContent = '';
      if (stream.textStream) {
        console.log(`📡 Processing text stream for message: ${this.currentMessageId}`);
        
        for await (const chunk of stream.textStream) {
          const contentEvent: StreamEvent = {
            type: 'content',
            id: this.currentMessageId,
            data: chunk,
            timestamp: Date.now()
          };
          
          // Emit immediately for real-time streaming
          this.emitEvent(controller, contentEvent);
          finalContent += chunk;
          // console.log(`💭 Emitted content chunk:`, chunk.substring(0, 50));
        }
      }
      
      // Emit completion with final content
      this.emitEvent(controller, {
        type: 'message_complete',
        id: this.currentMessageId,
        final_content: finalContent,
        timestamp: Date.now()
      });
      
      console.log(`✅ Stream completed for message: ${this.currentMessageId}`);
      controller.close();
      
    } catch (error: any) {
      console.error(`❌ Error processing stream ${this.currentMessageId}:`, error);
      
      this.emitEvent(controller, {
        type: 'error',
        id: this.currentMessageId,
        error: error.message || 'Failed to process message stream',
        timestamp: Date.now()
      });
      
      controller.close();
    }
  }
  
  /**
   * Emit a single event as a JSON-lines formatted string
   */
  private emitEvent(controller: ReadableStreamDefaultController<Uint8Array>, event: StreamEvent) {
    const jsonLine = JSON.stringify(event) + '\n';
    const encoder = new TextEncoder();
    controller.enqueue(encoder.encode(jsonLine));
    
    // console.log(`📡 Emitted event:`, event.type, event.tool || event.data?.substring(0, 30) || '');
  }
  
  /**
   * Convert technical tool names to user-friendly descriptions
   */
  private getFriendlyToolName(toolName: string): string {
    const toolMap: Record<string, string> = {
      // Pinboard tools
      'viewAllPinboardWidgets': 'pinboard viewer',
      'addPinboardWidget': 'widget creator',
      'updateWidgetContent': 'content editor',
      'updateWidgetProperties': 'widget configurator',
      'removeWidget': 'widget remover',
      'getPinboardUIState': 'UI state inspector',
      
      // File tools
      'filesystem_read_file': 'file reader',
      'filesystem_write_file': 'file writer',
      'filesystem_create_directory': 'directory creator',
      'filesystem_list_directory': 'directory browser',
      
      // Plugin tools
      'plugin-filesystem_read_file': 'plugin file reader',
      'plugin-filesystem_write_file': 'plugin file writer',
    };
    
    return toolMap[toolName] || toolName.replace(/_/g, ' ').toLowerCase();
  }
}

// Export singleton instance
export const unifiedStreamManager = new UnifiedStreamManager();