import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { sendAIMessage } from "../../services/aiServiceManager";
import {
  useWidgetActions,
  useWidgetContent,
} from "../../stores/selectiveHooks";
import type { WidgetRendererProps } from "../../types/widgets";
import type { ChatContent, ChatMessage } from "./types";
import MarkdownRenderer from "./components/MarkdownRenderer";

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
  const settings = useWidgetContent(
    widgetId,
    (content) => content.data.settings || {},
  );

  // Get update actions
  const { updateContent } = useWidgetActions(widgetId);

  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Function to scroll to bottom of chat
  const scrollToBottom = useCallback((immediate = false) => {
    if (messagesContainerRef.current) {
      const container = messagesContainerRef.current;
      container.scrollTo({
        top: container.scrollHeight,
        behavior: immediate ? "auto" : "smooth",
      });
    }
  }, []);

  // Enhanced auto-scroll when messages change
  useEffect(() => {
    // Scroll immediately for new messages
    scrollToBottom(true);
    
    // Then smooth scroll after a short delay to account for dynamic content rendering
    const timeoutId = setTimeout(() => {
      scrollToBottom(false);
    }, 150);
    
    return () => clearTimeout(timeoutId);
  }, [messages, scrollToBottom]);

  // Observer for dynamic content changes (like think section expansions)
  useEffect(() => {
    if (!messagesContainerRef.current) return;
    
    const resizeObserver = new ResizeObserver((entries) => {
      // Only auto-scroll if user is near the bottom (within 100px)
      const container = messagesContainerRef.current;
      if (container) {
        const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
        if (isNearBottom) {
          scrollToBottom(false);
        }
      }
    });
    
    // Observe all message content for size changes
    const messageElements = messagesContainerRef.current.querySelectorAll('[data-message]');
    messageElements.forEach(element => {
      resizeObserver.observe(element);
    });
    
    return () => {
      resizeObserver.disconnect();
    };
  }, [messages, scrollToBottom]);

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
    setIsLoading(true);
    setError(null);

    // Immediately refocus the input field for smooth conversation flow
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);

    // Scroll to bottom after adding user message
    setTimeout(scrollToBottom, 100);

    try {
      // Send to Groq AI service with MCP tool support
      const response = await sendAIMessage(
        updatedMessages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
        [], // Empty locations array for simple chat
        [], // Empty characters array for simple chat
      );

      if (response.success && response.data?.message) {
        const assistantMessage: ChatMessage = {
          role: "assistant",
          content: response.data.message,
          timestamp: Date.now(),
          provider: response.provider,
          toolCalls: response.data.tool_calls,
          metadata: {
            toolResults: response.data.tool_results,
            timestamp: response.timestamp,
          },
        };

        const finalMessages = [...updatedMessages, assistantMessage];
        updateContent({
          messages: finalMessages,
          isTyping: false,
        });

        // Scroll to bottom after adding assistant message
        setTimeout(scrollToBottom, 100);
      } else {
        throw new Error("Invalid response from Groq API");
      }
    } catch (err) {
      console.error("Chat error:", err);
      setError(err instanceof Error ? err.message : "Failed to send message");

      // Remove typing indicator on error
      updateContent({
        messages: updatedMessages,
        isTyping: false,
      });
    } finally {
      setIsLoading(false);
    }
  }, [inputValue, messages, updateContent, scrollToBottom]);

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

  const handleClearConversation = useCallback(() => {
    if (!messages) return;

    updateContent({
      messages: [],
      isTyping: false,
    });

    setShowClearDialog(false);
    setError(null);
  }, [messages, updateContent]);

  // Loading state
  if (!messages) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-full border border-gray-300 bg-gray-100 p-3 shadow">
        <div className="text-gray-500 text-sm text-center">Loading chat...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full bg-gray-50">

      {/* Messages Area */}
      <div className="flex-1 overflow-hidden relative">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-500 p-4">
              <div className="text-4xl mb-2">🌈</div>
              <p className="text-sm">Talk to Tonk</p>
            </div>
          </div>
        ) : (
          <div
            ref={messagesContainerRef}
            className="flex flex-col space-y-2 overflow-y-auto p-3 h-full"
            style={{ scrollBehavior: "smooth" }}
          >
            {messages.map((message, index) => (
              <div
                key={index}
                data-message
                className={`flex ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2 shadow-sm ${
                    message.role === "user"
                      ? "bg-blue-500 text-white rounded-br-md"
                      : "bg-white text-gray-800 rounded-bl-md border border-gray-200"
                  }`}
                >
                  {message.role === "assistant" ? (
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
                          hour: '2-digit',
                          minute: '2-digit'
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

            {/* Typing indicator */}
            {isTyping && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-md bg-white border border-gray-200 px-4 py-3 shadow-sm">
                  <div className="flex items-center space-x-2">
                    <div className="flex space-x-1">
                      <div className="h-2 w-2 animate-bounce rounded-full bg-gray-400" />
                      <div
                        className="h-2 w-2 animate-bounce rounded-full bg-gray-400"
                        style={{ animationDelay: "0.1s" }}
                      />
                      <div
                        className="h-2 w-2 animate-bounce rounded-full bg-gray-400"
                        style={{ animationDelay: "0.2s" }}
                      />
                    </div>
                    <span className="text-gray-500 text-xs">
                      Tonk is thinking...
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Error display */}
        {error && (
          <div className="absolute top-0 left-0 right-0 m-3 rounded-lg bg-red-50 border border-red-200 p-2 shadow-sm">
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
      <div className="pt-3 bg-white border-t border-gray-200">
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setShowClearDialog(true)}
            className="p-1.5 text-gray-400 hover:text-red-500 transition-colors rounded-lg"
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
            className="flex-1 rounded-full bg-gray-100 px-4 py-2 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 border border-gray-200 transition-all"
          />
          <button
            type="button"
            onClick={handleSendMessage}
            disabled={!inputValue.trim()}
            className="rounded-full bg-blue-500 p-2 text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-gray-300 transition-colors flex-shrink-0"
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
                className="px-4 py-2 text-gray-600 text-sm hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClearConversation}
                className="rounded-lg bg-red-500 px-4 py-2 text-sm text-white hover:bg-red-600 transition-colors"
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
