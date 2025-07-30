/**
 * Chat Renderer - Simplified Claude Code Style
 * 
 * Simplified React component using the new ChatStreamManager for
 * a smooth, predictable streaming experience like Claude Code.
 * 
 * Key Improvements:
 * - Minimal reactive state (only messages + currentStream)
 * - Non-reactive streaming via ChatStreamManager
 * - Batched UI updates for better performance
 * - Clear message boundaries and lifecycle
 * - Simple, maintainable code structure
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
// import { chatStreamManager } from "../../services/chatStreamManager";
// import type { MessageState } from "../../types/streaming";
import {
  useWidgetActions,
  useWidgetContent,
} from "../../stores/selectiveHooks";
import type { WidgetRendererProps } from "../../types/widgets";
import MarkdownRenderer from "./components/MarkdownRenderer";
import { cn } from "@/lib/utils";
import { Check, X, Loader2, Settings } from "lucide-react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  provider?: string;
  metadata?: {
    conversationId?: string;
    tools?: Array<{ name: string; status: string }>;
    // Streaming metadata
    isProgress?: boolean;
    isStreaming?: boolean;
    isContentBubble?: boolean;
    isToolBubble?: boolean;
    toolStatus?: 'running' | 'complete' | 'error';
    toolKey?: string;
    bubbleId?: string;
    temporary?: boolean;
  };
}

export const ChatRenderer: React.FC<WidgetRendererProps> = ({ widgetId }) => {
  // Minimal reactive state - only what React needs to know about
  const messages = useWidgetContent(
    widgetId,
    (content) => content.data.messages || [],
  );
  
  const { updateContent } = useWidgetActions(widgetId);
  
  // Simple component state
  const [inputValue, setInputValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [conversationId, setConversationId] = useState<string>(
    () => `chat-${widgetId}-${Date.now()}`,
  );
  
  // Track streaming bubbles - separate tool and content bubbles
  const [streamingBubbles, setStreamingBubbles] = useState<ChatMessage[]>([]);
  
  // Refs for DOM interaction
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages, streamingBubbles]);
  
  const handleSendMessage = useCallback(async () => {
    if (!inputValue.trim() || !messages) return;
    
    const userMessage: ChatMessage = {
      role: "user",
      content: inputValue.trim(),
      timestamp: Date.now(),
    };
    
    // Add user message immediately
    const updatedMessages = [...messages, userMessage];
    updateContent({
      messages: updatedMessages,
    });
    
    setInputValue("");
    setError(null);
    
    // Focus input for smooth conversation flow
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
    
    try {
      // Process raw stream events to create separate bubbles like old system
      const response = await processStreamWithSeparateBubbles(
        {
          message: userMessage.content,
          conversationId,
          userId: "chat-user",
          maxSteps: 100,
        }
      );
      
      if (response.success) {
        console.log("🎯 Stream completed successfully");
        console.log("🎯 Current updatedMessages:", updatedMessages.length);
        console.log("🎯 Collected bubbles from stream:", response.bubbles?.length || 0);
        
        // Convert collected bubbles to permanent messages by updating metadata
        const permanentBubbles = (response.bubbles || []).map(bubble => ({
          ...bubble,
          metadata: {
            ...bubble.metadata,
            isStreaming: false,
            temporary: false,
            // Mark tool bubbles as completed if they're still running
            ...(bubble.metadata?.isToolBubble && bubble.metadata?.toolStatus === 'running' ? 
              { toolStatus: 'complete' as const } : {})
          }
        }));
        
        console.log("🎯 PermanentBubbles created:", permanentBubbles.length);
        
        // Convert streaming bubbles to permanent and ADD to conversation with user message
        console.log("🎯 Updated messages (with user):", updatedMessages.length);
        console.log("🎯 Current streaming bubbles to make permanent:", streamingBubbles.length);
        
        // Make streaming bubbles permanent by removing temporary flags
        const permanentStreamingBubbles = streamingBubbles.map(bubble => ({
          ...bubble,
          metadata: {
            ...bubble.metadata,
            isStreaming: false,
            temporary: false,
            // Mark tool bubbles as completed if they're still running
            ...(bubble.metadata?.isToolBubble && bubble.metadata?.toolStatus === 'running' ? 
              { toolStatus: 'complete' as const } : {})
          }
        }));
        
        // Use updatedMessages (which includes user message) + streaming bubbles
        const allMessages = [...updatedMessages, ...permanentStreamingBubbles];
        console.log("🎯 Total messages to save:", allMessages.length);
        
        updateContent({
          messages: allMessages,
        });
        
        // Clear streaming bubbles since they're now permanent
        console.log("🎯 Clearing streaming bubbles (now saved as permanent)");
        setStreamingBubbles([]);
        
      } else {
        console.error("Stream failed:", response);
        throw new Error("Failed to get response from AI agent");
      }
      
    } catch (err) {
      console.error("Chat error:", err);
      setError(err instanceof Error ? err.message : "Failed to send message");
      setStreamingBubbles([]);
    }
  }, [inputValue, messages, updateContent, conversationId]);
  
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
      // Ctrl/Cmd+K to clear conversation
      if (e.key === "k" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setShowClearDialog(true);
      }
      // Escape to close clear dialog
      if (e.key === "Escape" && showClearDialog) {
        e.preventDefault();
        setShowClearDialog(false);
      }
    },
    [handleSendMessage, showClearDialog],
  );
  
  // Global keyboard shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Focus input with Ctrl/Cmd+/
      if (e.key === "/" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    
    document.addEventListener("keydown", handleGlobalKeyDown);
    return () => document.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);
  
  const handleClearConversation = useCallback(() => {
    if (!messages) return;
    
    updateContent({
      messages: [],
    });
    
    setShowClearDialog(false);
    setError(null);
    setStreamingBubbles([]);
    // Reset conversation ID when clearing
    setConversationId(`chat-${widgetId}-${Date.now()}`);
  }, [messages, updateContent, widgetId]);

  // Custom stream processing that creates separate bubbles by reading event stream
  const processStreamWithSeparateBubbles = useCallback(async (request: any) => {
    const response = await fetch('/api/chat/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("Failed to get response reader");
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let finalContent = '';
    let lastEventType: string | null = null; // Track event stream directly
    let currentContentBubbleId: string | null = null;
    
    // Track bubbles created during streaming - independent of React state
    let collectedBubbles: ChatMessage[] = [];

    // Local bubble handlers that work directly with collectedBubbles array - NO REACT STATE UPDATES
    function handleToolEventStreamLocal(event: any, lastEventType: string | null, bubbles: ChatMessage[]) {
      const toolKey = `tool-${event.tool}`;
      
      console.log(`🔧 LOCAL TOOL HANDLER: ${event.tool} (${event.status}) - toolKey: ${toolKey}`);
      
      // Check if we already have a bubble for this tool
      const existingIndex = bubbles.findIndex(msg => 
        msg.metadata?.toolKey === toolKey
      );
      
      console.log(`🔍 Looking for existing tool bubble with key ${toolKey}: found at index ${existingIndex}`);
      
      if (existingIndex >= 0) {
        // Update existing tool bubble
        console.log(`🔄 UPDATING EXISTING TOOL BUBBLE: ${toolKey} to ${event.status} ${event.tool}`);
        bubbles[existingIndex] = {
          ...bubbles[existingIndex],
          content: event.tool,
          metadata: {
            ...bubbles[existingIndex].metadata,
            toolStatus: event.status
          }
        };
      } else {
        // Create new tool bubble
        const bubbleId = `tool-${Date.now()}-${Math.random()}`;
        const toolMsg: ChatMessage = {
          role: "assistant",
          content: event.tool,
          timestamp: Date.now(),
          provider: "mastra",
          metadata: {
            isProgress: true,
            bubbleId: bubbleId,
            toolKey: toolKey,
            toolStatus: event.status,
            isToolBubble: true,
            temporary: false,
          },
        };
        
        console.log(`🆕 CREATING NEW TOOL BUBBLE: ${bubbleId} with tool "${event.tool}"`);
        console.log(`📊 Current bubbles before adding tool: ${bubbles.length}`);
        bubbles.push(toolMsg);
        console.log(`📊 Current bubbles after adding tool: ${bubbles.length}`);
        console.log(`✅ TOOL BUBBLE ADDED SUCCESSFULLY`);
      }
    }

    function handleContentEventStreamLocal(
      event: any, 
      lastEventType: string | null, 
      currentContentBubbleId: string | null,
      bubbles: ChatMessage[]
    ): string {
      // Create NEW content bubble if:
      // 1. This is the first content event (lastEventType is null)
      // 2. Previous event was a tool (lastEventType === 'tool')
      // 3. We don't have a current content bubble
      const needNewBubble = lastEventType !== 'content' || !currentContentBubbleId;
      
      console.log(`📝 LOCAL CONTENT HANDLER: needNewBubble=${needNewBubble} (lastEventType: ${lastEventType}, currentBubbleId: ${currentContentBubbleId})`);
      
      if (needNewBubble) {
        // Create NEW content bubble (always separate from tools)
        const bubbleId = `thinking-${Date.now()}-${Math.random()}`;
        const thinkingMsg: ChatMessage = {
          role: "assistant",
          content: event.data,
          timestamp: Date.now(),
          provider: "mastra",
          metadata: {
            isStreaming: true,
            bubbleId: bubbleId,
            isContentBubble: true,
            temporary: false,
          },
        };

        console.log(`🆕 CREATING NEW CONTENT BUBBLE: ${bubbleId} with content "${event.data}"`);
        console.log(`📊 Current bubbles before adding: ${bubbles.length}`);
        bubbles.push(thinkingMsg);
        console.log(`📊 Current bubbles after adding: ${bubbles.length}`);
        console.log(`✅ CONTENT BUBBLE ADDED SUCCESSFULLY`);
        
        return bubbleId; // Return the new bubble ID
      } else {
        // Update existing content bubble
        console.log(`🔄 UPDATING EXISTING CONTENT BUBBLE: ${currentContentBubbleId} with "${event.data}"`);
        
        const existingIndex = bubbles.findIndex(msg =>
          msg.metadata?.bubbleId === currentContentBubbleId && msg.metadata?.isContentBubble
        );
        
        if (existingIndex >= 0) {
          bubbles[existingIndex] = {
            ...bubbles[existingIndex],
            content: bubbles[existingIndex].content + event.data
          };
          console.log(`✅ CONTENT BUBBLE UPDATED SUCCESSFULLY`);
        }
        
        console.log(`📊 Updated ${bubbles.length} bubbles`);
        return currentContentBubbleId; // Return the same bubble ID
      }
    }

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            try {
              const event = JSON.parse(line);
              
              console.log(`🔍 STREAM EVENT:`, event.type, event.tool || event.data?.substring(0, 20), `lastEventType: ${lastEventType}`);
              
              switch (event.type) {
                case 'tool':
                  console.log(`🔧 TOOL EVENT: ${event.tool} (${event.status}) - lastEventType: ${lastEventType}`);
                  try {
                    // Call BOTH handlers - local for collection AND React state for real-time display
                    handleToolEventStreamLocal(event, lastEventType, collectedBubbles);
                    handleToolEventStream(event, lastEventType);
                    lastEventType = 'tool';
                    currentContentBubbleId = null; // Reset content tracking
                    console.log(`🔧 After tool event - lastEventType: ${lastEventType}`);
                  } catch (toolError) {
                    console.error(`🚨 TOOL HANDLER ERROR:`, toolError);
                    throw toolError;
                  }
                  break;
                case 'content':
                  console.log(`💭 CONTENT EVENT: "${event.data}" - lastEventType: ${lastEventType}, currentBubbleId: ${currentContentBubbleId}`);
                  try {
                    // Call BOTH handlers - local for collection AND React state for real-time display
                    currentContentBubbleId = handleContentEventStreamLocal(
                      event, 
                      lastEventType, 
                      currentContentBubbleId,
                      collectedBubbles
                    );
                    handleContentEventStream(event, lastEventType, currentContentBubbleId);
                    lastEventType = 'content';
                    finalContent += event.data;
                    console.log(`💭 After content event - lastEventType: ${lastEventType}, currentBubbleId: ${currentContentBubbleId}`);
                  } catch (contentError) {
                    console.error(`🚨 CONTENT HANDLER ERROR:`, contentError);
                    throw contentError;
                  }
                  break;
                case 'message_complete':
                  console.log(`✅ MESSAGE COMPLETE`);
                  console.log(`🎯 About to return from processStreamWithSeparateBubbles`);
                  console.log(`🎯 Current collectedBubbles count:`, collectedBubbles.length);
                  return { success: true, finalContent: event.final_content || finalContent, bubbles: collectedBubbles };
                case 'error':
                  console.log(`❌ ERROR:`, event.error);
                  throw new Error(event.error);
              }
            } catch (parseError) {
              // Only catch JSON parsing errors, re-throw handler errors
              if (parseError.message?.includes('HANDLER ERROR') || parseError.name === 'TypeError') {
                throw parseError;
              }
              console.warn('Failed to parse stream event:', line, parseError);
            }
          }
        }
      }

      return { success: true, finalContent, bubbles: collectedBubbles };
    } finally {
      reader.releaseLock();
    }
  }, []);

  // Handle tool events based on event stream context
  const handleToolEventStream = useCallback((event: any, lastEventType: string | null) => {
    const toolKey = `tool-${event.tool}`;
    
    console.log(`🔧 TOOL HANDLER: ${event.tool} (${event.status}) - toolKey: ${toolKey}`);
    
    setStreamingBubbles(current => {
      // Check if we already have a bubble for this tool
      const existingIndex = current.findIndex(msg => 
        msg.metadata?.toolKey === toolKey
      );
      
      console.log(`🔍 Looking for existing tool bubble with key ${toolKey}: found at index ${existingIndex}`);
      
      if (existingIndex >= 0) {
        // Update existing tool bubble
        const updated = [...current];
        
        console.log(`🔄 UPDATING EXISTING TOOL BUBBLE: ${toolKey} to ${event.status} ${event.tool}`);
        updated[existingIndex] = {
          ...updated[existingIndex],
          content: event.tool,
          metadata: {
            ...updated[existingIndex].metadata,
            toolStatus: event.status
          }
        };
        return updated;
      } else {
        // Create new tool bubble - always separate from content
        const bubbleId = `tool-${Date.now()}-${Math.random()}`;
        const toolMsg: ChatMessage = {
          role: "assistant",
          content: event.tool,
          timestamp: Date.now(),
          provider: "mastra",
          metadata: {
            isProgress: true,
            bubbleId: bubbleId,
            toolKey: toolKey,
            toolStatus: event.status,
            isToolBubble: true,
            temporary: false,
          },
        };
        
        console.log(`🆕 CREATING NEW TOOL BUBBLE: ${bubbleId} with tool "${event.tool}"`);
        console.log(`📊 Current bubbles before adding tool: ${current.length}`);
        const newBubbles = [...current, toolMsg];
        console.log(`📊 Current bubbles after adding tool: ${newBubbles.length}`);
        return newBubbles;
      }
    });
  }, []);

  // Handle content events based on event stream context  
  const handleContentEventStream = useCallback((
    event: any, 
    lastEventType: string | null, 
    currentContentBubbleId: string | null
  ): string => {
    // Create NEW content bubble if:
    // 1. This is the first content event (lastEventType is null)
    // 2. Previous event was a tool (lastEventType === 'tool')
    // 3. We don't have a current content bubble
    const needNewBubble = lastEventType !== 'content' || !currentContentBubbleId;
    
    console.log(`📝 CONTENT HANDLER: needNewBubble=${needNewBubble} (lastEventType: ${lastEventType}, currentBubbleId: ${currentContentBubbleId})`);
    
    if (needNewBubble) {
      // Create NEW content bubble (always separate from tools)
      const bubbleId = `thinking-${Date.now()}-${Math.random()}`;
      const thinkingMsg: ChatMessage = {
        role: "assistant",
        content: event.data,
        timestamp: Date.now(),
        provider: "mastra",
        metadata: {
          isStreaming: true,
          bubbleId: bubbleId,
          isContentBubble: true,
          temporary: false,
        },
      };

      console.log(`🆕 CREATING NEW CONTENT BUBBLE: ${bubbleId} with content "${event.data}"`);
      setStreamingBubbles(current => {
        console.log(`📊 Current bubbles before adding: ${current.length}`);
        const newBubbles = [...current, thinkingMsg];
        console.log(`📊 Current bubbles after adding: ${newBubbles.length}`);
        return newBubbles;
      });
      return bubbleId; // Return the new bubble ID
    } else {
      // Update existing content bubble
      console.log(`🔄 UPDATING EXISTING CONTENT BUBBLE: ${currentContentBubbleId} with "${event.data}"`);
      setStreamingBubbles(current => {
        const updated = current.map(msg =>
          msg.metadata?.bubbleId === currentContentBubbleId && msg.metadata?.isContentBubble
            ? { ...msg, content: msg.content + event.data }
            : msg
        );
        console.log(`📊 Updated ${updated.length} bubbles`);
        return updated;
      });
      
      return currentContentBubbleId; // Return the same bubble ID
    }
  }, []);
  
  // Loading state
  if (!messages) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-full border border-gray-300 bg-gray-100 p-3 shadow">
        <div className="text-center text-gray-500 text-sm">Loading chat...</div>
      </div>
    );
  }
  
  return (
    <div className="flex h-full w-full flex-col bg-gray-50">
      {/* Messages Area */}
      <div className="relative flex-1 overflow-hidden">
        {messages.length === 0 && streamingBubbles.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="p-4 text-center text-gray-500">
              <div className="mb-2 text-4xl">🌈</div>
              <p className="text-sm">Talk to Tonk</p>
            </div>
          </div>
        ) : (
          <div
            ref={messagesContainerRef}
            className="flex h-full flex-col space-y-3 overflow-y-auto p-4"
            data-scrollable="true"
          >
            {/* Regular message history */}
            {messages.map((message, index) => (
              <MessageBubble
                key={`${message.timestamp}-${index}`}
                message={message}
              />
            ))}
            
            {/* Current streaming bubbles - separate tool and content bubbles */}
            {streamingBubbles.map((bubble, index) => (
              <MessageBubble
                key={`${bubble.timestamp}-${index}`}
                message={bubble}
              />
            ))}
            
            {/* Show "AI is thinking..." when we have streaming bubbles */}
            {streamingBubbles.length > 0 && (
              <div className="flex justify-start">
                <div className="max-w-[85%] animate-pulse rounded-2xl rounded-bl-md border border-gray-200 bg-gray-100 px-4 py-2 text-gray-600 shadow-sm">
                  <div className="flex items-center gap-2 whitespace-pre-wrap break-words text-sm">
                    <div className="h-2 w-2 flex-shrink-0 animate-bounce rounded-full bg-gray-400" />
                    <div
                      className="h-2 w-2 flex-shrink-0 animate-bounce rounded-full bg-gray-400"
                      style={{ animationDelay: "0.1s" }}
                    />
                    <div
                      className="h-2 w-2 flex-shrink-0 animate-bounce rounded-full bg-gray-400"
                      style={{ animationDelay: "0.2s" }}
                    />
                    <span className="ml-2">Tonk is thinking...</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Error display */}
        {error && (
          <div className="absolute top-0 right-0 left-0 m-3 rounded-lg border border-red-200 bg-red-50 p-2 shadow-sm">
            <div className="text-red-600 text-xs">{error}</div>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-red-500 text-xs underline hover:text-red-700"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>
      
      {/* Input Area */}
      <div className="border-gray-200 border-t bg-white p-3">
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setShowClearDialog(true)}
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:text-red-500"
            title="Clear conversation"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="What shall we do..."
            disabled={streamingBubbles.length > 0}
            className="flex-1 rounded-full border border-gray-200 bg-gray-100 px-4 py-2 text-sm transition-all focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
          <button
            type="button"
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || streamingBubbles.length > 0}
            className="flex-shrink-0 rounded-full bg-blue-500 p-2 text-white transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-gray-300"
            title="Send message"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
              />
            </svg>
          </button>
        </div>
      </div>
      
      {/* Clear confirmation dialog */}
      {showClearDialog && (
        <div
          className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          style={{ zIndex: 9999 }}
        >
          <div className="max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h4 className="mb-3 font-medium text-gray-800">
              Clear Conversation?
            </h4>
            <p className="mb-4 text-gray-600 text-sm">
              This will delete all messages in this chat. This action cannot be
              undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowClearDialog(false)}
                className="px-4 py-2 text-gray-600 text-sm transition-colors hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClearConversation}
                className="rounded-lg bg-red-500 px-4 py-2 text-sm text-white transition-colors hover:bg-red-600"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Regular message bubble component
 */
const MessageBubble: React.FC<{ message: ChatMessage }> = ({ message }) => {
  // Check if this is a running tool bubble for animation
  const isRunningTool = message.metadata?.isToolBubble && 
                       message.metadata?.toolStatus === 'running';
  
  // Check if this is a streaming content bubble
  const isStreamingContent = message.metadata?.isContentBubble && 
                            message.metadata?.isStreaming;
  
  return (
    <div
      className={cn(
        "flex",
        message.role === "user" ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-3 shadow-sm",
          message.role === "user"
            ? "rounded-br-md bg-blue-500 text-white"
            : "rounded-bl-md border border-gray-200 bg-white text-gray-800",
          // Add pulse animation for running tools
          isRunningTool && "animate-pulse border-blue-300",
          // Add subtle glow for streaming content
          isStreamingContent && "border-blue-200"
        )}
      >
{message.role === "assistant" ? (
        message.metadata?.isToolBubble ? (
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-gray-600" />
            {message.metadata?.toolStatus === 'complete' ? (
              <Check className="h-3 w-3 text-green-500" />
            ) : message.metadata?.toolStatus === 'error' ? (
              <X className="h-3 w-3 text-red-500" />
            ) : (
              <Loader2 className="h-3 w-3 text-blue-500 animate-spin" />
            )}
            <span className="text-sm">{message.content}</span>
          </div>
        ) : (
          <MarkdownRenderer
            content={message.content}
            className="prose prose-sm max-w-none"
            showThinkTags={true}
            expandThinkTagsByDefault={false}
            enableSyntaxHighlighting={true}
          />
        )
      ) : (
        <div className="whitespace-pre-wrap break-words text-sm">
          {message.content}
        </div>
      )}
      
      {/* Message footer */}
      <div
        className={cn(
          "mt-2 flex items-center justify-between text-xs",
          message.role === "user" ? "text-blue-100" : "text-gray-500"
        )}
      >
        <span>
          {new Date(message.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
        <div className="flex items-center gap-2">
          {/* Show streaming indicator for content bubbles */}
          {isStreamingContent && (
            <span className="animate-pulse text-blue-500 text-xs">Streaming...</span>
          )}
          {/* Show tool count for completed messages */}
          {message.role === "assistant" &&
            message.metadata?.tools &&
            message.metadata.tools.length > 0 && (
              <span
                className="ml-2 text-xs"
                title={`Used ${message.metadata.tools.length} tools`}
              >
                <Settings className="h-3 w-3 inline mr-1" />{message.metadata.tools.length}
              </span>
            )}
        </div>
      </div>
    </div>
  </div>
  );
};

