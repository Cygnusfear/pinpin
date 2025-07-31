/**
 * Streaming Types and Interfaces
 * 
 * Type definitions for the new Claude Code-style streaming system.
 * Provides clear interfaces for message states, stream events, and callbacks.
 */

/**
 * Stream event types received from the backend JSON-lines stream
 */
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

/**
 * Tool execution state for tracking progress
 */
export interface ToolExecution {
  name: string;
  status: 'running' | 'complete' | 'error';
  timestamp: number;
}

/**
 * Complete message state during streaming
 */
export interface MessageState {
  id: string;
  content: string;
  tools: ToolExecution[];
  status: 'streaming' | 'complete' | 'error';
  startTime: number;
  finalContent?: string;
  error?: string;
}

/**
 * Callback function type for streaming updates
 */
export type StreamCallback = (messages: MessageState[]) => void;

/**
 * Request interface for chat streaming
 */
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
 * Response interface for completed streaming
 */
export interface ChatStreamResponse {
  success: boolean;
  finalContent?: string;
  messageId?: string;
  error?: string;
  tools?: ToolExecution[];
}

/**
 * Configuration for the ChatStreamManager
 */
export interface StreamManagerConfig {
  // Batching interval for UI updates (default: 16ms for ~60fps)
  updateInterval?: number;
  
  // Maximum time to wait for stream completion (default: 30 seconds)
  timeout?: number;
  
  // Whether to log detailed streaming events
  debug?: boolean;
}

/**
 * Internal state for managing stream connections
 */
export interface StreamConnection {
  id: string;
  reader: ReadableStreamDefaultReader<Uint8Array>;
  decoder: TextDecoder;
  messageState: MessageState | null;
  callbacks: Set<StreamCallback>;
  startTime: number;
}

/**
 * Statistics for stream performance monitoring
 */
export interface StreamStats {
  totalMessages: number;
  averageStreamTime: number;
  successRate: number;
  toolExecutions: number;
  lastStreamTime?: number;
}

/**
 * Error types that can occur during streaming
 */
export type StreamErrorType = 
  | 'connection_failed'
  | 'stream_timeout'
  | 'parse_error'
  | 'server_error'
  | 'unknown_error';

/**
 * Detailed error information for debugging
 */
export interface StreamError extends Error {
  type: StreamErrorType;
  messageId?: string;
  timestamp: number;
  originalError?: Error;
}

/**
 * Event data for stream lifecycle hooks
 */
export interface StreamLifecycleEvent {
  type: 'start' | 'progress' | 'complete' | 'error';
  messageId: string;
  timestamp: number;
  data?: any;
}

/**
 * Hook function type for stream lifecycle events
 */
export type StreamLifecycleHook = (event: StreamLifecycleEvent) => void;