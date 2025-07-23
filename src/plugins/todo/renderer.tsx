import React, { useCallback, useState } from "react";
import type {
  WidgetRendererProps,
  TodoContent,
} from "../../types/widgets";
import { useContentActions } from "../../stores/widgetStore";

export const TodoRenderer: React.FC<WidgetRendererProps<TodoContent>> = ({
  widget,
  state,
  events,
}) => {
  const { updateContent } = useContentActions();
  const [newItemText, setNewItemText] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState("");

  const handleToggleItem = useCallback((itemId: string) => {
    if (!widget.isContentLoaded || !widget.content.data) return;

    const data = widget.content.data;
    const updatedItems = data.items.map(item =>
      item.id === itemId ? { ...item, completed: !item.completed } : item
    );

    updateContent(widget.contentId, {
      data: { ...data, items: updatedItems }
    });
  }, [widget, updateContent]);

  const handleAddItem = useCallback(() => {
    if (!widget.isContentLoaded || !widget.content.data || !newItemText.trim()) return;

    const data = widget.content.data;
    const newItem = {
      id: `item-${Date.now()}`,
      text: newItemText.trim(),
      completed: false,
      createdAt: Date.now(),
    };

    const updatedItems = [...data.items, newItem];
    updateContent(widget.contentId, {
      data: { ...data, items: updatedItems }
    });
    setNewItemText("");
  }, [widget, newItemText, updateContent]);

  const handleDeleteItem = useCallback((itemId: string) => {
    if (!widget.isContentLoaded || !widget.content.data) return;

    const data = widget.content.data;
    const updatedItems = data.items.filter(item => item.id !== itemId);

    updateContent(widget.contentId, {
      data: { ...data, items: updatedItems }
    });
  }, [widget, updateContent]);

  const handleTitleEdit = useCallback(() => {
    if (!widget.isContentLoaded || !widget.content.data) return;
    
    setTitleValue(widget.content.data.title);
    setEditingTitle(true);
  }, [widget]);

  const handleTitleSave = useCallback(() => {
    if (!widget.isContentLoaded || !widget.content.data) return;

    const data = widget.content.data;
    updateContent(widget.contentId, {
      data: { ...data, title: titleValue }
    });
    setEditingTitle(false);
  }, [widget, titleValue, updateContent]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent, action: () => void) => {
    if (e.key === "Enter") {
      e.preventDefault();
      action();
    }
  }, []);

  if (!widget.isContentLoaded) {
    return (
      <div className="flex items-center justify-center h-full bg-white rounded-lg shadow">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (widget.contentError) {
    return (
      <div className="flex items-center justify-center h-full bg-white rounded-lg shadow">
        <div className="text-red-500">Error: {widget.contentError}</div>
      </div>
    );
  }

  const data = widget.content.data;
  const completedCount = data.items.filter(item => item.completed).length;

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow overflow-hidden">
      {/* Header */}
      <div className="p-3 bg-blue-50 border-b border-blue-100">
        {editingTitle ? (
          <input
            value={titleValue}
            onChange={(e) => setTitleValue(e.target.value)}
            onBlur={handleTitleSave}
            onKeyPress={(e) => handleKeyPress(e, handleTitleSave)}
            className="w-full text-lg font-semibold bg-transparent border-none outline-none"
            autoFocus
          />
        ) : (
          <h3
            className="text-lg font-semibold text-gray-800 cursor-pointer"
            onClick={handleTitleEdit}
          >
            {data.title}
          </h3>
        )}
        <div className="text-sm text-gray-500">
          {completedCount} of {data.items.length} completed
        </div>
      </div>

      {/* Todo Items */}
      <div className="flex-1 overflow-auto p-2">
        {data.items.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded group"
          >
            <input
              type="checkbox"
              checked={item.completed}
              onChange={() => handleToggleItem(item.id)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span
              className={`flex-1 ${
                item.completed
                  ? "line-through text-gray-500"
                  : "text-gray-800"
              }`}
            >
              {item.text}
            </span>
            <button
              onClick={() => handleDeleteItem(item.id)}
              className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 text-sm"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* Add New Item */}
      <div className="p-3 border-t border-gray-100">
        <div className="flex gap-2">
          <input
            type="text"
            value={newItemText}
            onChange={(e) => setNewItemText(e.target.value)}
            onKeyPress={(e) => handleKeyPress(e, handleAddItem)}
            placeholder="Add new item..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleAddItem}
            disabled={!newItemText.trim()}
            className="px-3 py-2 bg-blue-500 text-white rounded-md text-sm hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
};