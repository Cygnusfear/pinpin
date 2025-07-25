import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { sendChatMessage } from "../../services/claudeService";
import {
  useWidgetActions,
  useWidgetContent,
} from "../../stores/selectiveHooks";
import type { SelectiveWidgetRendererProps } from "../../types/widgets";
import type { ChatContent, ChatMessage } from "./types";

export const ChatRenderer: React.FC<SelectiveWidgetRendererProps> = ({
  widgetId,
}) => {
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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Function to scroll to bottom of chat
  const scrollToBottom = useCallback(() => {
    if (messagesContainerRef.current) {
      const container = messagesContainerRef.current;
      container.scrollTo({
        top: container.scrollHeight,
        behavior: "smooth",
      });
    }
  }, []);

  // Auto-scroll when messages change
  useEffect(() => {
    scrollToBottom();
  }, [scrollToBottom]);

  const handleSendMessage = useCallback(async () => {
    if (!inputValue.trim() || !messages || isLoading) return;

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

    // Scroll to bottom after adding user message
    setTimeout(scrollToBottom, 100);

    try {
      // Send to Claude API with simple context
      const response = await sendChatMessage(
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
        };

        const finalMessages = [...updatedMessages, assistantMessage];
        updateContent({
          messages: finalMessages,
          isTyping: false,
        });

        // Scroll to bottom after adding assistant message
        setTimeout(scrollToBottom, 100);
      } else {
        throw new Error("Invalid response from Claude API");
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
  }, [inputValue, messages, updateContent, isLoading, scrollToBottom]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
    },
    [handleSendMessage],
  );

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
      <div className="flex h-full items-center justify-center rounded-lg bg-blue-100 shadow">
        <div className="text-gray-500">Loading chat...</div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col rounded-lg border border-blue-200 bg-white shadow-md">
      {/* Header */}
      <div className="flex items-center justify-between border-gray-200 border-b p-3">
        <h3 className="font-medium text-gray-800">💬 Chat with Tonk</h3>
        <button
          type="button"
          onClick={() => setShowClearDialog(true)}
          className="text-gray-500 text-xs hover:text-red-500"
          disabled={messages.length === 0}
        >
          Clear
        </button>
      </div>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        className="flex-1 space-y-3 overflow-auto p-3"
      >
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-gray-400 text-sm">
            Start a conversation with Claude...
          </div>
        ) : (
          <>
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                    message.role === "user"
                      ? "bg-blue-500 text-white"
                      : "bg-gray-100 text-gray-800"
                  }`}
                >
                  <div className="whitespace-pre-wrap break-words">
                    {message.content}
                  </div>
                  <div
                    className={`mt-1 text-xs ${
                      message.role === "user"
                        ? "text-blue-100"
                        : "text-gray-500"
                    }`}
                  >
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {isTyping && (
              <div className="flex justify-start">
                <div className="rounded-lg bg-gray-100 px-3 py-2 text-gray-800 text-sm">
                  <div className="flex items-center space-x-1">
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
                    <span className="ml-2 text-gray-500 text-xs">
                      Tonk is typing...
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Error display */}
      {error && (
        <div className="border-gray-200 border-t bg-red-50 p-2">
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

      {/* Input */}
      <div className="border-gray-200 border-t p-3">
        <div className="flex space-x-2">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            disabled={isLoading}
            className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-gray-100"
          />
          <button
            type="button"
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isLoading}
            className="rounded bg-blue-500 px-4 py-2 text-sm text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {isLoading ? "..." : "Send"}
          </button>
        </div>
        <div className="mt-1 text-gray-500 text-xs">
          Press Enter to send, Shift+Enter for new line
        </div>
      </div>

      {/* Clear confirmation dialog */}
      {showClearDialog && (
        <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black bg-opacity-50">
          <div className="max-w-sm rounded-lg bg-white p-4 shadow-lg">
            <h4 className="mb-2 font-medium text-gray-800">
              Clear Conversation?
            </h4>
            <p className="mb-4 text-gray-600 text-sm">
              This will delete all messages in this chat. This action cannot be
              undone.
            </p>
            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setShowClearDialog(false)}
                className="px-3 py-1 text-gray-600 text-sm hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClearConversation}
                className="rounded bg-red-500 px-3 py-1 text-sm text-white hover:bg-red-600"
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

// Mark this component as using selective reactivity
(ChatRenderer as any).selectiveReactivity = true;
