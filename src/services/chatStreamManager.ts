/**
 * Chat Stream Manager
 * 
 * Frontend service for managing Claude Code-style streaming chat interactions.
 * Provides non-reactive message processing with batched UI updates for optimal performance.
 * 
 * Key Features:
 * - Non-reactive stream processing (outside React's reactivity system)
 * - Batched UI updates to prevent thrashing
 * - Clear message state management
 * - Proper error handling and cleanup
 * - Stream lifecycle hooks for debugging
 */

import type {
  StreamEvent,
  MessageState,
  ToolExecution,
  ChatStreamRequest,
  ChatStreamResponse,
  StreamCallback,
  StreamManagerConfig,
  StreamConnection,
  StreamStats,
  StreamError,
  StreamErrorType,
  StreamLifecycleEvent,
  StreamLifecycleHook
} from '../types/streaming';

/**
 * ChatStreamManager handles all streaming chat interactions with the backend.
 * It processes JSON-lines streams and manages message state outside of React's reactivity.
 */
export class ChatStreamManager {
  private connections = new Map<string, StreamConnection>();
  private updateTimer: NodeJS.Timeout | null = null;
  private pendingUpdates = new Set<MessageState>();
  private callbacks = new Set<StreamCallback>();
  private lifecycleHooks = new Set<StreamLifecycleHook>();
  private stats: StreamStats = {
    totalMessages: 0,
    averageStreamTime: 0,
    successRate: 0,
    toolExecutions: 0
  };
  
  private config: Required<StreamManagerConfig>;
  
  constructor(config: StreamManagerConfig = {}) {
    this.config = {
      updateInterval: config.updateInterval || 16, // ~60fps
      timeout: config.timeout || 300000, // 5 minutes - streams can take as long as needed
      debug: config.debug || false
    };
    
    if (this.config.debug) {
      console.log('🎯 ChatStreamManager initialized with config:', this.config);
    }
  }
  
  /**
   * Stream a chat message and return the final response
   */
  async streamMessage(
    request: ChatStreamRequest, 
    onUpdate?: StreamCallback
  ): Promise<ChatStreamResponse> {
    const startTime = Date.now();
    const connectionId = `stream_${startTime}_${Math.random().toString(36).substr(2, 9)}`;
    
    if (onUpdate) {
      this.callbacks.add(onUpdate);
    }
    
    this.emitLifecycleEvent({
      type: 'start',
      messageId: connectionId,
      timestamp: startTime,
      data: { request }
    });
    
    try {
      if (this.config.debug) {
        console.log('🚀 Starting stream request:', connectionId);
      }
      
      // Make request to new streaming endpoint
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });
      
      if (!response.ok) {
        throw this.createStreamError(
          'connection_failed',
          `HTTP ${response.status}: ${response.statusText}`,
          connectionId
        );
      }
      
      if (!response.body) {
        throw this.createStreamError(
          'connection_failed',
          'No response body received',
          connectionId
        );
      }
      
      // Set up stream connection
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      const connection: StreamConnection = {
        id: connectionId,
        reader,
        decoder,
        messageState: null,
        callbacks: new Set(),
        startTime
      };
      
      this.connections.set(connectionId, connection);
      
      // Process the stream
      const result = await this.processStream(connection);
      
      // Update statistics
      this.updateStats(startTime, result.success);
      
      this.emitLifecycleEvent({
        type: 'complete',
        messageId: connectionId,
        timestamp: Date.now(),
        data: { result, duration: Date.now() - startTime }
      });
      
      return result;
      
    } catch (error: any) {
      if (this.config.debug) {
        console.error('❌ Stream error:', error);
      }
      
      const streamError = error instanceof Error && 'type' in error
        ? error as StreamError
        : this.createStreamError('unknown_error', error.message || 'Unknown streaming error', connectionId);
      
      this.emitLifecycleEvent({
        type: 'error',
        messageId: connectionId,
        timestamp: Date.now(),
        data: { error: streamError }
      });
      
      return {
        success: false,
        error: streamError.message,
        messageId: connectionId
      };
      
    } finally {
      // Cleanup
      this.connections.delete(connectionId);
      if (onUpdate) {
        this.callbacks.delete(onUpdate);
      }
    }
  }
  
  /**
   * Process a single stream connection
   */
  private async processStream(connection: StreamConnection): Promise<ChatStreamResponse> {
    const { reader, decoder } = connection;
    let buffer = '';
    
    try {
      // Set up timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(this.createStreamError(
            'stream_timeout',
            `Stream timeout after ${this.config.timeout}ms`,
            connection.id
          ));
        }, this.config.timeout);
      });
      
      // Process stream with timeout
      const streamPromise = this.processStreamEvents(connection, buffer);
      
      return await Promise.race([streamPromise, timeoutPromise]);
      
    } finally {
      try {
        reader.releaseLock();
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }
  
  /**
   * Process individual stream events from JSON-lines
   */
  private async processStreamEvents(
    connection: StreamConnection, 
    buffer: string
  ): Promise<ChatStreamResponse> {
    const { reader, decoder } = connection;
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      // Decode chunk and add to buffer
      buffer += decoder.decode(value, { stream: true });
      
      // Process complete lines
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer
      
      for (const line of lines) {
        if (line.trim()) {
          try {
            const event: StreamEvent = JSON.parse(line);
            const updatedState = this.processEvent(event, connection);
            
            if (updatedState) {
              this.scheduleUpdate(updatedState);
              
              this.emitLifecycleEvent({
                type: 'progress',
                messageId: connection.id,
                timestamp: Date.now(),
                data: { event, state: updatedState }
              });
            }
            
            // Check for completion
            if (event.type === 'message_complete') {
              return {
                success: true,
                finalContent: event.final_content || connection.messageState?.content || '',
                messageId: event.id,
                tools: connection.messageState?.tools || []
              };
            }
            
            // Check for errors
            if (event.type === 'error') {
              throw this.createStreamError(
                'server_error',
                event.error || 'Server error',
                event.id
              );
            }
            
          } catch (parseError: any) {
            if (this.config.debug) {
              console.warn('⚠️ Failed to parse stream event:', line, parseError);
            }
            
            throw this.createStreamError(
              'parse_error',
              `Failed to parse stream event: ${parseError.message}`,
              connection.id
            );
          }
        }
      }
    }
    
    // Stream ended without completion
    const finalContent = connection.messageState?.content || '';
    
    return {
      success: finalContent.length > 0,
      finalContent,
      messageId: connection.messageState?.id || connection.id,
      error: finalContent.length === 0 ? 'Stream ended without content' : undefined,
      tools: connection.messageState?.tools || []
    };
  }
  
  /**
   * Process a single stream event and create separate message states like old system
   */
  private processEvent(event: StreamEvent, connection: StreamConnection): MessageState | null {
    // Initialize message tracking if needed
    if (!connection.messageState) {
      connection.messageState = {
        id: event.id,
        content: '',
        tools: [],
        status: 'streaming',
        startTime: Date.now()
      };
    }

    switch (event.type) {
      case 'message_start':
        connection.messageState = {
          id: event.id,
          content: '',
          tools: [],
          status: 'streaming',
          startTime: event.timestamp || Date.now()
        };
        
        if (this.config.debug) {
          console.log('📝 Message started:', event.id);
        }
        
        return connection.messageState;
        
      case 'content':
        if (event.data) {
          connection.messageState.content += event.data;
          
          if (this.config.debug) {
            console.log('💭 Content chunk:', event.data.substring(0, 50));
          }
          
          return connection.messageState;
        }
        break;
        
      case 'tool':
        if (event.tool) {
          // Update existing tool or add new one
          const existingToolIndex = connection.messageState.tools.findIndex(
            t => t.name === event.tool
          );
          
          const toolExecution: ToolExecution = {
            name: event.tool,
            status: event.status || 'running',
            timestamp: event.timestamp || Date.now()
          };
          
          if (existingToolIndex >= 0) {
            connection.messageState.tools[existingToolIndex] = toolExecution;
          } else {
            connection.messageState.tools.push(toolExecution);
          }
          
          if (this.config.debug) {
            console.log('🔧 Tool update:', event.tool, event.status);
          }
          
          return connection.messageState;
        }
        break;
        
      case 'message_complete':
        connection.messageState.status = 'complete';
        connection.messageState.finalContent = event.final_content;
        
        if (this.config.debug) {
          console.log('✅ Message completed:', event.id);
        }
        
        return connection.messageState;
        
      case 'error':
        connection.messageState.status = 'error';
        connection.messageState.error = event.error;
        
        if (this.config.debug) {
          console.log('❌ Message error:', event.error);
        }
        
        return connection.messageState;
    }
    
    return null;
  }
  
  /**
   * Schedule a batched UI update
   */
  private scheduleUpdate(messageState: MessageState) {
    this.pendingUpdates.add(messageState);
    
    if (!this.updateTimer) {
      this.updateTimer = setTimeout(() => {
        // Batch notify all pending updates
        const updates = Array.from(this.pendingUpdates);
        
        for (const callback of this.callbacks) {
          try {
            callback(updates);
          } catch (error) {
            console.error('❌ Stream callback error:', error);
          }
        }
        
        this.pendingUpdates.clear();
        this.updateTimer = null;
      }, this.config.updateInterval);
    }
  }
  
  /**
   * Create a structured stream error
   */
  private createStreamError(
    type: StreamErrorType, 
    message: string, 
    messageId?: string,
    originalError?: Error
  ): StreamError {
    const error = new Error(message) as StreamError;
    error.type = type;
    error.messageId = messageId;
    error.timestamp = Date.now();
    error.originalError = originalError;
    return error;
  }
  
  /**
   * Update streaming statistics
   */
  private updateStats(startTime: number, success: boolean) {
    const duration = Date.now() - startTime;
    this.stats.totalMessages++;
    this.stats.lastStreamTime = duration;
    
    // Update average (simple moving average)
    this.stats.averageStreamTime = 
      (this.stats.averageStreamTime * (this.stats.totalMessages - 1) + duration) / 
      this.stats.totalMessages;
    
    // Update success rate
    const previousSuccesses = Math.round(this.stats.successRate * (this.stats.totalMessages - 1));
    const newSuccesses = previousSuccesses + (success ? 1 : 0);
    this.stats.successRate = newSuccesses / this.stats.totalMessages;
  }
  
  /**
   * Emit a lifecycle event to all registered hooks
   */
  private emitLifecycleEvent(event: StreamLifecycleEvent) {
    for (const hook of this.lifecycleHooks) {
      try {
        hook(event);
      } catch (error) {
        console.error('❌ Lifecycle hook error:', error);
      }
    }
  }
  
  /**
   * Add a lifecycle hook for debugging/monitoring
   */
  addLifecycleHook(hook: StreamLifecycleHook) {
    this.lifecycleHooks.add(hook);
  }
  
  /**
   * Remove a lifecycle hook
   */
  removeLifecycleHook(hook: StreamLifecycleHook) {
    this.lifecycleHooks.delete(hook);
  }
  
  /**
   * Get current streaming statistics
   */
  getStats(): StreamStats {
    return { ...this.stats };
  }
  
  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      totalMessages: 0,
      averageStreamTime: 0,
      successRate: 0,
      toolExecutions: 0
    };
  }
  
  /**
   * Cleanup all active connections and timers
   */
  destroy() {
    // Cancel pending timer
    if (this.updateTimer) {
      clearTimeout(this.updateTimer);
      this.updateTimer = null;
    }
    
    // Cleanup all connections
    for (const [id, connection] of this.connections) {
      try {
        connection.reader.releaseLock();
      } catch (e) {
        // Ignore cleanup errors
      }
    }
    
    // Clear all collections
    this.connections.clear();
    this.callbacks.clear();
    this.lifecycleHooks.clear();
    this.pendingUpdates.clear();
    
    if (this.config.debug) {
      console.log('🧹 ChatStreamManager destroyed');
    }
  }
}

// Export singleton instance for global use
export const chatStreamManager = new ChatStreamManager({ debug: false });