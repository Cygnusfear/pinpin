import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  useWidgetActions,
  useWidgetContent,
} from "../../stores/selectiveHooks";
import type { WidgetRendererProps } from "../../types/widgets";
import type { NoteContent } from "./types";

export const NoteRenderer: React.FC<WidgetRendererProps> = ({ widgetId }) => {
  // Selective subscriptions - only re-render when these specific values change
  const content = useWidgetContent(widgetId, (content) => content.data.content);
  const backgroundColor = useWidgetContent(
    widgetId,
    (content) => content.data.backgroundColor,
  );
  const textColor = useWidgetContent(
    widgetId,
    (content) => content.data.textColor,
  );
  const fontSize = useWidgetContent(
    widgetId,
    (content) => content.data.fontSize,
  );
  const fontFamily = useWidgetContent(
    widgetId,
    (content) => content.data.fontFamily,
  );
  const textAlign = useWidgetContent(
    widgetId,
    (content) => content.data.textAlign,
  );
  const formatting = useWidgetContent(
    widgetId,
    (content) => content.data.formatting,
  );

  // Get update actions
  const { updateContent } = useWidgetActions(widgetId);

  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleStartEdit = useCallback(() => {
    if (content === undefined) return;

    setEditValue(content || "");
    setIsEditing(true);
  }, [content]);

  const handleSaveEdit = useCallback(() => {
    if (content === undefined) return;

    updateContent({
      content: editValue,
    });
    setIsEditing(false);
  }, [content, editValue, updateContent]);

  const handleCancelEdit = useCallback(() => {
    if (content === undefined) return;

    setEditValue(content || "");
    setIsEditing(false);
  }, [content]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleSaveEdit();
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleCancelEdit();
      }
    },
    [handleSaveEdit, handleCancelEdit],
  );

  // Auto-focus textarea when editing starts
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isEditing]);

  // Loading state
  if (content === undefined) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg bg-yellow-100 shadow">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  const noteStyle = {
    backgroundColor: backgroundColor || "#fef3c7",
    color: textColor || "#000000",
    fontSize: `${fontSize || 14}px`,
    fontFamily: fontFamily || "Arial, sans-serif",
    textAlign: (textAlign || "left") as "left" | "center" | "right",
    fontWeight: formatting?.bold ? "bold" : "normal",
    fontStyle: formatting?.italic ? "italic" : "normal",
    textDecoration: formatting?.underline ? "underline" : "none",
  };

  return (
    <div
      className="h-full overflow-hidden rounded-lg border border-yellow-200 shadow-md"
      style={{ backgroundColor: backgroundColor || "#fef3c7" }}
    >
      {isEditing ? (
        <div className="h-full p-3">
          <textarea
            ref={textareaRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleSaveEdit}
            onKeyDown={handleKeyDown}
            className="h-full w-full resize-none border-none bg-transparent outline-none"
            style={{
              color: textColor || "#000000",
              fontSize: `${fontSize || 14}px`,
              fontFamily: fontFamily || "Arial, sans-serif",
              fontWeight: formatting?.bold ? "bold" : "normal",
              fontStyle: formatting?.italic ? "italic" : "normal",
              textDecoration: formatting?.underline ? "underline" : "none",
            }}
            placeholder="Type your note here..."
          />
          <div className="mt-1 text-gray-500 text-xs">
            Ctrl+Enter to save, Escape to cancel
          </div>
        </div>
      ) : (
        <div
          className="h-full cursor-text overflow-auto p-3"
          style={noteStyle}
          onClick={handleStartEdit}
          onDoubleClick={handleStartEdit}
        >
          {content ? (
            <div className="whitespace-pre-wrap break-words">{content}</div>
          ) : (
            <div className="text-gray-400 italic">Click to add a note...</div>
          )}
        </div>
      )}
    </div>
  );
};
