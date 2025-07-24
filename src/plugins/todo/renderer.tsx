import type React from "react";
import { useCallback, useState } from "react";
import { useContentActions } from "../../stores/widgetStore";
import type { WidgetRendererProps } from "../../types/widgets";
import type { TodoContent } from "./types";

export const TodoRenderer: React.FC<WidgetRendererProps<TodoContent>> = ({
  widget,
  state,
  events,
}) => {
  const { updateContent } = useContentActions();
  const [newItemText, setNewItemText] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState("");

  const handleToggleItem = useCallback(
    (itemId: string) => {
      if (!widget.isContentLoaded || !widget.content.data) return;

      const data = widget.content.data;
      const updatedItems = data.items.map((item) =>
        item.id === itemId ? { ...item, completed: !item.completed } : item,
      );

      updateContent(widget.contentId, {
        data: { ...data, items: updatedItems },
      });
    },
    [widget, updateContent],
  );

  const handleAddItem = useCallback(() => {
    if (!widget.isContentLoaded || !widget.content.data || !newItemText.trim())
      return;

    const data = widget.content.data;
    const newItem = {
      id: `item-${Date.now()}`,
      text: newItemText.trim(),
      completed: false,
      createdAt: Date.now(),
    };

    const updatedItems = [...data.items, newItem];
    updateContent(widget.contentId, {
      data: { ...data, items: updatedItems },
    });
    setNewItemText("");
  }, [widget, newItemText, updateContent]);

  const handleDeleteItem = useCallback(
    (itemId: string) => {
      if (!widget.isContentLoaded || !widget.content.data) return;

      const data = widget.content.data;
      const updatedItems = data.items.filter((item) => item.id !== itemId);

      updateContent(widget.contentId, {
        data: { ...data, items: updatedItems },
      });
    },
    [widget, updateContent],
  );

  const handleTitleEdit = useCallback(() => {
    if (!widget.isContentLoaded || !widget.content.data) return;

    setTitleValue(widget.content.data.title);
    setEditingTitle(true);
  }, [widget]);

  const handleTitleSave = useCallback(() => {
    if (!widget.isContentLoaded || !widget.content.data) return;

    const data = widget.content.data;
    updateContent(widget.contentId, {
      data: { ...data, title: titleValue },
    });
    setEditingTitle(false);
  }, [widget, titleValue, updateContent]);

  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent, action: () => void) => {
      if (e.key === "Enter") {
        e.preventDefault();
        action();
      }
    },
    [],
  );

  if (!widget.isContentLoaded) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg bg-white shadow">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (widget.contentError) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg bg-white shadow">
        <div className="text-red-500">Error: {widget.contentError}</div>
      </div>
    );
  }

  const data = widget.content.data;
  const completedCount = data.items.filter((item) => item.completed).length;

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg bg-white shadow">
      {/* Header */}
      <div className="border-blue-100 border-b bg-blue-50 p-3">
        {editingTitle ? (
          <input
            value={titleValue}
            onChange={(e) => setTitleValue(e.target.value)}
            onBlur={handleTitleSave}
            onKeyPress={(e) => handleKeyPress(e, handleTitleSave)}
            className="w-full border-none bg-transparent font-semibold text-lg outline-none"
            autoFocus
          />
        ) : (
          <h3
            className="cursor-pointer font-semibold text-gray-800 text-lg"
            onClick={handleTitleEdit}
          >
            {data.title}
          </h3>
        )}
        <div className="text-gray-500 text-sm">
          {completedCount} of {data.items.length} completed
        </div>
      </div>

      {/* Todo Items */}
      <div className="flex-1 overflow-auto p-2">
        {data.items.map((item) => (
          <div
            key={item.id}
            className="group flex items-center gap-2 rounded p-2 hover:bg-gray-50"
          >
            <input
              type="checkbox"
              checked={item.completed}
              onChange={() => handleToggleItem(item.id)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span
              className={`flex-1 ${
                item.completed ? "text-gray-500 line-through" : "text-gray-800"
              }`}
            >
              {item.text}
            </span>
            <button
              onClick={() => handleDeleteItem(item.id)}
              className="text-red-500 text-sm opacity-0 hover:text-red-700 group-hover:opacity-100"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* Add New Item */}
      <div className="border-gray-100 border-t p-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={newItemText}
            onChange={(e) => setNewItemText(e.target.value)}
            onKeyPress={(e) => handleKeyPress(e, handleAddItem)}
            placeholder="Add new item..."
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleAddItem}
            disabled={!newItemText.trim()}
            className="rounded-md bg-blue-500 px-3 py-2 text-sm text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
};
