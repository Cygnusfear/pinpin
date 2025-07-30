import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { streamMastraMessage } from "../../services/mastraService";
import {
  useWidgetActions,
  useWidgetContent,
} from "../../stores/selectiveHooks";
import type { WidgetRendererProps } from "../../types/widgets";
import MarkdownRenderer from "./components/MarkdownRenderer";
import type { ChatMessage } from "./types";

export const ChatRenderer: React.FC<WidgetRendererProps> = ({ widgetId }) => {
  // Selective subscriptions - only re-render when these specific values change
  const messages = useWidgetContent(
    widgetId,
    (content) => content.data.messages || [],
  );
  const isTyping = useWidgetContent(
    widgetId,
    (content) => content.data.isTyping || false,
  );

  // Get update actions
  const { updateContent } = useWidgetActions(widgetId);

  const [inputValue, setInputValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [conversationId, setConversationId] = useState<string>(
    () => `chat-${widgetId}-${Date.now()}`,
  );
  const [chunks, setChunks] = useState<string[]>([]);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const currentStreamingBubble = useRef<ChatMessage | null>(null);
  const lastContextType = useRef<"thinking" | "tool" | null>(null);
  const currentMessages = useRef<ChatMessage[]>([]);

  // Scroll functions removed - reverse flex layout automatically keeps latest content visible

  // No need for auto-scroll with reverse flex layout - content automatically appears at bottom

  // Minimal observer for content changes - reverse flex handles positioning automatically
  useEffect(() => {
    if (!messagesContainerRef.current) return;

    const resizeObserver = new ResizeObserver(() => {
      // With reverse flex, content automatically stays at bottom - no manual scrolling needed
    });

    // Observe message container for size changes
    resizeObserver.observe(messagesContainerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [messages]);

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
      isTyping: true,
    });

    setInputValue("");
    setError(null);

    // Immediately refocus the input field for smooth conversation flow
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);

    // No manual scrolling needed - reverse flex handles positioning

    try {
      currentMessages.current = [...updatedMessages];

      // Stream Mastra agent response - collect chunks silently
      const response = await streamMastraMessage(
        updatedMessages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
        conversationId,
        "chat-user", // Static user ID for chat widget
        (progressMessage: string) => {
          console.log("🔧 Tool progress:", progressMessage);
          // Tool progress is logged but no bubble is created - loading indicator shows instead
          const toolMsg: ChatMessage = {
            role: "assistant",
            content: progressMessage,
            timestamp: Date.now(),
            provider: "mastra",
            metadata: {
              isProgress: true,
              bubbleId: `tool-${Date.now()}-${Math.random()}`,
              temporary: false,
            },
          };

          // Add new tool bubble
          currentMessages.current = [...currentMessages.current, toolMsg];
          lastContextType.current = "tool";
          currentStreamingBubble.current = null; // Reset streaming bubble

          // Force synchronous React update
          flushSync(() => {
            updateContent({
              messages: currentMessages.current,
              isTyping: true,
            });
          });
        },
        (contentChunk: string) => {
          console.log("💭 AI thinking:", contentChunk);
          // Content chunks are logged but no bubble is created - loading indicator shows instead

          // AI thinking - create new bubble if context switched from tool, otherwise update existing
          if (
            lastContextType.current !== "thinking" ||
            !currentStreamingBubble.current
          ) {
            // Create new thinking bubble
            const thinkingMsg: ChatMessage = {
              role: "assistant",
              content: contentChunk,
              timestamp: Date.now(),
              provider: "mastra",
              metadata: {
                isStreaming: true,
                bubbleId: `thinking-${Date.now()}-${Math.random()}`,
                temporary: false,
              },
            };

            currentStreamingBubble.current = thinkingMsg;
            lastContextType.current = "thinking";
          } else {
            // Update existing thinking bubble - replace content instead of appending
            // const bubbleId = currentStreamingBubble.current?.metadata?.bubbleId;
            // currentMessages = currentMessages.map((msg) =>
            //   msg.metadata?.bubbleId === bubbleId
            //     ? { ...msg, content: contentChunk }
            //     : msg,
            // );
            // // Update our reference
            // currentStreamingBubble.current =
            //   currentMessages.find(
            //     (msg) => msg.metadata?.bubbleId === bubbleId,
            //   ) || null;
          }

          lastContextType.current = "thinking";
        },
      );

      if (response.success && response.message) {
        // Remove all temporary bubbles (both tool and thinking), add final response
        const finalMessages = currentMessages.current;

        const assistantMessage: ChatMessage = {
          role: "assistant",
          content: response.message,
          timestamp: Date.now(),
          provider: "mastra",
          metadata: {
            conversationId: response.conversationId,
          },
        };

        const completedMessages = [...finalMessages, assistantMessage];
        updateContent({
          messages: completedMessages,
          isTyping: false,
        });

        // Update conversationId if changed
        if (
          response.conversationId &&
          response.conversationId !== conversationId
        ) {
          setConversationId(response.conversationId);
        }

        // No manual scrolling needed - reverse flex handles positioning
      } else {
        console.error("Invalid response from Mastra agent:", response);
        throw new Error(response.error || "Invalid response from Mastra agent");
      }
    } catch (err) {
      console.error("Chat error:", err);
      setError(err instanceof Error ? err.message : "Failed to send message");

      // Remove typing indicator and any temporary bubbles on error
      const cleanMessages = updatedMessages;
      updateContent({
        messages: cleanMessages,
        isTyping: false,
      });
    } finally {
      // Extra safety: ensure isTyping is reset even if there were issues above
      setTimeout(() => {
        updateContent((currentContent) => ({
          ...currentContent,
          isTyping: false,
        }));
      }, 100);
    }
  }, [inputValue, messages, updateContent, conversationId]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
      // Ctrl+K to clear conversation
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
      // Focus input with Ctrl+/ or Cmd+/
      if (e.key === "/" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };

    document.addEventListener("keydown", handleGlobalKeyDown);
    return () => document.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  // Cleanup no longer needed - no scroll timeouts

  const handleClearConversation = useCallback(() => {
    if (!messages) return;

    updateContent({
      messages: [],
      isTyping: false,
    });

    setShowClearDialog(false);
    setError(null);
    // Reset conversation ID when clearing
    setConversationId(`chat-${widgetId}-${Date.now()}`);
  }, [messages, updateContent]);

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
            className="flex h-full flex-col-reverse space-y-2 space-y-reverse overflow-y-auto p-3"
            data-scrollable="true"
            style={{
              scrollBehavior: "smooth",
              scrollbarWidth: "thin",
              // Prevent layout shifts during content updates
              overflowAnchor: "auto",
            }}
          >
            {/* Show loading indicator when AI is typing */}
            {isTyping && (
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
                    <span className="ml-2">AI is thinking...</span>
                  </div>
                </div>
              </div>
            )}

            {[...messages].reverse().map((message, index) => (
              <div
                key={`${message.timestamp}-${index}`}
                data-message
                className={`flex ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2 shadow-sm ${
                    message.role === "user"
                      ? "rounded-br-md bg-blue-500 text-white"
                      : "rounded-bl-md border border-gray-200 bg-white text-gray-800"
                  }`}
                >
                  {message.role === "assistant" ? (
                    // Regular assistant message - full markdown
                    <MarkdownRenderer
                      content={message.content}
                      className="prose prose-sm max-w-none"
                      showThinkTags={true}
                      expandThinkTagsByDefault={false}
                      enableSyntaxHighlighting={true}
                    />
                  ) : (
                    <div className="whitespace-pre-wrap break-words text-sm">
                      {message.content}
                    </div>
                  )}
                  <div
                    className={`mt-1 text-xs ${
                      message.role === "user"
                        ? "text-blue-100"
                        : "text-gray-500"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>
                        {new Date(message.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      {message.role === "assistant" &&
                        message.toolCalls &&
                        message.toolCalls.length > 0 && (
                          <span
                            className="ml-2"
                            title={`Used ${message.toolCalls.length} MCP tools`}
                          >
                            🔧 {message.toolCalls.length}
                          </span>
                        )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
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
      <div className="border-gray-200 border-t bg-white pt-3">
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
            className="flex-1 rounded-full border border-gray-200 bg-gray-100 px-4 py-2 text-sm transition-all focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
