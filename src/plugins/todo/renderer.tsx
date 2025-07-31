import type React from "react";
import { useCallback, useState } from "react";
import {
  useWidgetActions,
  useWidgetContent,
} from "../../stores/selectiveHooks";
import type { WidgetRendererProps } from "../../types/widgets";
import type { TodoContent } from "./types";

export const TodoRenderer: React.FC<WidgetRendererProps> = ({ widgetId }) => {
  // ALL HOOKS MUST BE CALLED FIRST - before any conditional logic
  // Selective subscriptions - only re-render when these specific values change
  const title = useWidgetContent(widgetId, (content) => content?.data?.title);
  const items = useWidgetContent(widgetId, (content) => content?.data?.items);

  // Get update actions
  const { updateContent } = useWidgetActions(widgetId);

  // Local state hooks
  const [newItemText, setNewItemText] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState("");

  const handleToggleItem = useCallback(
    (itemId: string) => {
      if (!items) return;

      const updatedItems = items.map((item) =>
        item.id === itemId ? { ...item, completed: !item.completed } : item,
      );

      updateContent({
        items: updatedItems,
      });
    },
    [items, updateContent],
  );

  const handleAddItem = useCallback(() => {
    if (!items || !newItemText.trim()) return;

    const newItem = {
      id: `item-${Date.now()}`,
      text: newItemText.trim(),
      completed: false,
      createdAt: Date.now(),
    };

    const updatedItems = [...items, newItem];
    updateContent({
      items: updatedItems,
    });
    setNewItemText("");
  }, [items, newItemText, updateContent]);

  const handleDeleteItem = useCallback(
    (itemId: string) => {
      if (!items) return;

      const updatedItems = items.filter((item) => item.id !== itemId);
      updateContent({
        items: updatedItems,
      });
    },
    [items, updateContent],
  );

  const handleTitleEdit = useCallback(() => {
    if (!title) return;

    setTitleValue(title);
    setEditingTitle(true);
  }, [title]);

  const handleTitleSave = useCallback(() => {
    if (!title) return;

    updateContent({
      title: titleValue,
    });
    setEditingTitle(false);
  }, [title, titleValue, updateContent]);

  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent, action: () => void) => {
      if (e.key === "Enter") {
        e.preventDefault();
        action();
      }
    },
    [],
  );

  // Loading state
  if (!title || !items) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg bg-white shadow">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  const completedCount = items.filter((item) => item.completed).length;

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
            {title}
          </h3>
        )}
        <div className="text-gray-500 text-sm">
          {completedCount} of {items.length} completed
        </div>
      </div>

      {/* Todo Items */}
      <div className="flex-1 overflow-auto p-2" data-scrollable="true">
        {items.map((item) => (
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
              type="button"
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
            type="button"
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
