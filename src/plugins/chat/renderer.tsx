/**
 * Chat Renderer - Single Source of Truth Architecture
 * 
 * Simplified React component that maintains conversation state locally
 * and updates the store immediately on every change. This eliminates
 * the need for complex merging logic and final save operations.
 * 
 * Key Improvements:
 * - Single local conversation state (no separate streaming bubbles)
 * - Incremental store updates for real-time display
 * - No final save needed - everything saved incrementally
 * - Lucide React icons for elegant tool status indicators
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
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
  // Get messages from store
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
  
  // Refs for DOM interaction
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages]);
  
  const handleSendMessage = useCallback(async () => {
    if (!inputValue.trim() || !messages) return;
    
    const userMessage: ChatMessage = {
      role: "user",
      content: inputValue.trim(),
      timestamp: Date.now(),
    };
    
    // Single source of truth: Start with complete current conversation
    let conversationState = [...messages, userMessage];
    
    // Save immediately (real-time display via React hook)
    updateContent({
      messages: conversationState,
    });
    
    setInputValue("");
    setError(null);
    
    // Focus input for smooth conversation flow
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
    
    try {
      // Stream and update conversation incrementally
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          conversationId,
          userId: "chat-user",
          maxSteps: 100,
        }),
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
      let lastEventType: string | null = null;
      let currentContentBubbleId: string | null = null;
      
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
                
                console.log(`🔍 STREAM EVENT:`, event.type, event.tool || event.data?.substring(0, 20));
                
                switch (event.type) {
                  case 'tool':
                    console.log(`🔧 TOOL EVENT: ${event.tool} (${event.status})`);
                    
                    const toolKey = `tool-${event.tool}`;
                    const existingToolIndex = conversationState.findIndex(msg => 
                      msg.metadata?.toolKey === toolKey
                    );
                    
                    if (existingToolIndex >= 0) {
                      // Update existing tool bubble
                      conversationState[existingToolIndex] = {
                        ...conversationState[existingToolIndex],
                        content: event.tool,
                        metadata: {
                          ...conversationState[existingToolIndex].metadata,
                          toolStatus: event.status
                        }
                      };
                    } else {
                      // Create new tool bubble
                      const toolMsg: ChatMessage = {
                        role: "assistant",
                        content: event.tool,
                        timestamp: Date.now(),
                        provider: "mastra",
                        metadata: {
                          isProgress: true,
                          bubbleId: `tool-${Date.now()}-${Math.random()}`,
                          toolKey: toolKey,
                          toolStatus: event.status,
                          isToolBubble: true,
                          temporary: false,
                        },
                      };
                      conversationState.push(toolMsg);
                    }
                    
                    lastEventType = 'tool';
                    currentContentBubbleId = null; // Reset content tracking
                    break;
                    
                  case 'content':
                    console.log(`💭 CONTENT EVENT: "${event.data}"`);
                    
                    // Create NEW content bubble if previous event was tool or this is first content
                    const needNewBubble = lastEventType !== 'content' || !currentContentBubbleId;
                    
                    if (needNewBubble) {
                      // Create new content bubble
                      currentContentBubbleId = `thinking-${Date.now()}-${Math.random()}`;
                      const contentMsg: ChatMessage = {
                        role: "assistant",
                        content: event.data,
                        timestamp: Date.now(),
                        provider: "mastra",
                        metadata: {
                          isStreaming: true,
                          bubbleId: currentContentBubbleId,
                          isContentBubble: true,
                          temporary: false,
                        },
                      };
                      conversationState.push(contentMsg);
                    } else {
                      // Update existing content bubble
                      const existingContentIndex = conversationState.findIndex(msg =>
                        msg.metadata?.bubbleId === currentContentBubbleId && msg.metadata?.isContentBubble
                      );
                      
                      if (existingContentIndex >= 0) {
                        conversationState[existingContentIndex] = {
                          ...conversationState[existingContentIndex],
                          content: conversationState[existingContentIndex].content + event.data
                        };
                      }
                    }
                    
                    lastEventType = 'content';
                    break;
                    
                  case 'message_complete':
                    console.log(`✅ MESSAGE COMPLETE`);
                    // Mark all bubbles as complete
                    conversationState = conversationState.map(msg => ({
                      ...msg,
                      metadata: {
                        ...msg.metadata,
                        isStreaming: false,
                        ...(msg.metadata?.isToolBubble && msg.metadata?.toolStatus === 'running' ? 
                          { toolStatus: 'complete' as const } : {})
                      }
                    }));
                    break;
                    
                  case 'error':
                    console.log(`❌ ERROR:`, event.error);
                    throw new Error(event.error);
                }
                
                // Save to store immediately (real-time display via React hook)
                updateContent({ messages: conversationState });
                
              } catch (parseError) {
                console.warn('Failed to parse stream event:', line, parseError);
              }
            }
          }
        }
        
        console.log("🎯 Stream completed successfully");
        console.log("🎯 Final conversation state:", conversationState.length, "messages");
        
      } finally {
        reader.releaseLock();
      }
      
    } catch (err) {
      console.error("Chat error:", err);
      setError(err instanceof Error ? err.message : "Failed to send message");
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
    // Reset conversation ID when clearing
    setConversationId(`chat-${widgetId}-${Date.now()}`);
  }, [messages, updateContent, widgetId]);

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
        {messages.length === 0 ? (
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
            {/* All messages including streaming ones */}
            {messages.map((message, index) => (
              <MessageBubble
                key={`${message.timestamp}-${index}`}
                message={message}
                isLastMessage={index === messages.length - 1}
              />
            ))}
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
            disabled={false}
            className="flex-1 rounded-full border border-gray-200 bg-gray-100 px-4 py-2 text-sm transition-all focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
          <button
            type="button"
            onClick={handleSendMessage}
            disabled={!inputValue.trim()}
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
 * Message bubble component with lucide-react icons
 */
const MessageBubble: React.FC<{ message: ChatMessage; isLastMessage: boolean }> = ({ message, isLastMessage }) => {
  // Check if this is a running tool bubble for animation
  const isRunningTool = message.metadata?.isToolBubble && 
                       message.metadata?.toolStatus === 'running';
  
  // Check if this is a streaming content bubble AND it's the last message
  const isStreamingContent = message.metadata?.isContentBubble && 
                            message.metadata?.isStreaming && 
                            isLastMessage;
  
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
          message.metadata?.isToolBubble && "border-blue-200",
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
            {/* Show streaming indicator only for last message as a small spinner */}
            {isStreamingContent && (
              <Loader2 className="h-3 w-3 text-gray-400 animate-spin" />
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