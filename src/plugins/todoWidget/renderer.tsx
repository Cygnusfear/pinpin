import type React from "react";
import { useCallback, useState } from "react";
import { useContentOperations } from "../../stores/contentStore";
import type { WidgetRendererProps } from "../../types/widgets";
import type { TodoItem } from "./types";

export const TodoWidgetRenderer: React.FC<WidgetRendererProps<any>> = ({
  widget,
  state,
  events,
}) => {
  const [newTodoText, setNewTodoText] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const { updateContent } = useContentOperations();

  // Get the contentId from the widget
  const contentId = (widget as any).contentId;

  // Handle separated architecture - get todo data from content
  const todoContent = widget.content;
  const items = todoContent?.items || [];
  const title = todoContent?.title || "Todo List";

  const generateTodoId = useCallback((): string => {
    return `todo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  const handleAddTodo = useCallback(() => {
    if (!newTodoText.trim()) return;

    const newItem: TodoItem = {
      id: generateTodoId(),
      text: newTodoText.trim(),
      completed: false,
      createdAt: Date.now(),
    };

    console.log("📝 Adding new todo item:", newItem, contentId);

    if (contentId) {
      updateContent(contentId, {
        type: 'todo',
        items: [...items, newItem],
        title, // Preserve the title
      });
    } else {
      console.warn("📝 No contentId found for todo widget");
    }

    setNewTodoText("");
    setIsAdding(false);
  }, [newTodoText, items, contentId, updateContent, generateTodoId, title]);

  const handleToggleTodo = useCallback(
    (itemId: string) => {
      const updatedItems = items.map((item) =>
        item.id === itemId ? { ...item, completed: !item.completed } : item,
      );

      console.log("✅ Toggling todo item:", itemId, contentId);

      if (contentId) {
        updateContent(contentId, {
          type: 'todo',
          items: updatedItems,
          title, // Preserve the title
        });
      } else {
        console.warn("📝 No contentId found for todo widget");
      }
    },
    [items, contentId, updateContent, title],
  );

  const handleDeleteTodo = useCallback(
    (itemId: string) => {
      const updatedItems = items.filter((item) => item.id !== itemId);

      console.log("🗑️ Deleting todo item:", itemId, contentId);

      if (contentId) {
        updateContent(contentId, {
          type: 'todo',
          items: updatedItems,
          title, // Preserve the title
        });
      } else {
        console.warn("📝 No contentId found for todo widget");
      }
    },
    [items, contentId, updateContent, title],
  );

  const handleKeyPress = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        handleAddTodo();
      }
      if (event.key === "Escape") {
        setNewTodoText("");
        setIsAdding(false);
      }
    },
    [handleAddTodo],
  );

  const handleButtonEvent = useCallback(
    (event: React.MouseEvent, action: () => void) => {
      event.preventDefault();
      event.stopPropagation();
      action();
    },
    [],
  );

  const completedCount = items.filter((item) => item.completed).length;
  const totalCount = items.length;
  const completionPercentage =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-gray-100 border-b bg-gray-50 p-4">
        <div className="flex-1">
          <h3 className="truncate font-semibold text-gray-900 text-lg">
            {title}
          </h3>
          {totalCount > 0 && (
            <div className="mt-1 text-gray-500 text-sm">
              {completedCount} of {totalCount} completed ({completionPercentage}
              %)
            </div>
          )}
        </div>
      </div>

      {/* Add Todo Input */}
      <div className="border-gray-100 border-b p-3">
        {isAdding ? (
          <div className="flex gap-2">
            <input
              type="text"
              value={newTodoText}
              onChange={(e) => setNewTodoText(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Enter todo item..."
              className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={(e) => handleButtonEvent(e, handleAddTodo)}
              disabled={!newTodoText.trim()}
              className="rounded-md bg-blue-600 px-3 py-2 font-medium text-sm text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              Add
            </button>
            <button
              type="button"
              onClick={(e) =>
                handleButtonEvent(e, () => {
                  setNewTodoText("");
                  setIsAdding(false);
                })
              }
              className="rounded-md bg-gray-100 px-3 py-2 font-medium text-gray-600 text-sm transition-colors hover:bg-gray-200"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={(e) => handleButtonEvent(e, () => setIsAdding(true))}
            className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-left text-gray-600 text-sm transition-colors hover:bg-gray-100"
          >
            + Add todo item
          </button>
        )}
      </div>

      {/* Todo List */}
      <div className="flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <div className="flex h-full items-center justify-center text-gray-500 text-sm">
            <div className="text-center">
              <div className="mb-2 text-2xl">📝</div>
              <div>No todos yet</div>
              <div className="mt-1 text-gray-400 text-xs">
                Click "Add todo item" to get started
              </div>
            </div>
          </div>
        ) : (
          <div className="p-2">
            {items.map((item) => (
              <div
                key={item.id}
                className={`group mb-2 flex items-center gap-3 rounded-lg border p-3 transition-all duration-200 last:mb-0 ${
                  item.completed
                    ? "border-gray-200 bg-gray-50"
                    : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
                }`}
              >
                {/* Checkbox */}
                <button
                  type="button"
                  onClick={(e) =>
                    handleButtonEvent(e, () => handleToggleTodo(item.id))
                  }
                  className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border-2 transition-colors ${
                    item.completed
                      ? "border-green-500 bg-green-500 text-white"
                      : "border-gray-300 hover:border-green-400"
                  }`}
                >
                  {item.completed && (
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 12 12"
                      fill="currentColor"
                    >
                      <path
                        d="M10 3L4.5 8.5L2 6"
                        stroke="currentColor"
                        strokeWidth="2"
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </button>

                {/* Todo Text */}
                <div
                  className={`flex-1 text-sm ${
                    item.completed
                      ? "text-gray-500 line-through"
                      : "text-gray-900"
                  }`}
                >
                  {item.text}
                </div>

                {/* Delete Button */}
                <button
                  type="button"
                  onClick={(e) =>
                    handleButtonEvent(e, () => handleDeleteTodo(item.id))
                  }
                  className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 opacity-0 transition-all duration-200 hover:bg-red-200 group-hover:opacity-100"
                  title="Delete todo"
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 12 12"
                    fill="currentColor"
                  >
                    <path
                      d="M9 3L3 9M3 3l6 6"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Progress Bar */}
      {totalCount > 0 && (
        <div className="border-gray-100 border-t bg-gray-50 p-3">
          <div className="flex items-center gap-2">
            <div className="h-2 flex-1 rounded-full bg-gray-200">
              <div
                className="h-2 rounded-full bg-green-500 transition-all duration-300"
                style={{ width: `${completionPercentage}%` }}
              />
            </div>
            <span className="font-medium text-gray-600 text-xs">
              {completionPercentage}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
