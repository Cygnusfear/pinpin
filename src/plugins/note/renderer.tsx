import type React from "react";
import { useCallback, useState, useRef, useEffect } from "react";
import { useContentActions } from "../../stores/widgetStore";
import type { WidgetRendererProps } from "../../types/widgets";
import type { NoteContent } from "./types";

export const NoteRenderer: React.FC<WidgetRendererProps<NoteContent>> = ({
  widget,
  state,
  events,
}) => {
  const { updateContent } = useContentActions();
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleStartEdit = useCallback(() => {
    if (!widget.isContentLoaded || !widget.content.data) return;

    setEditValue(widget.content.data.content);
    setIsEditing(true);
  }, [widget]);

  const handleSaveEdit = useCallback(() => {
    if (!widget.isContentLoaded || !widget.content.data) return;

    const newData = {
      ...widget.content.data,
      content: editValue,
    };

    updateContent(widget.contentId, { data: newData });
    setIsEditing(false);
  }, [widget, editValue, updateContent]);

  const handleCancelEdit = useCallback(() => {
    if (!widget.isContentLoaded || !widget.content.data) return;

    setEditValue(widget.content.data.content);
    setIsEditing(false);
  }, [widget]);

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

  if (!widget.isContentLoaded) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg bg-yellow-100 shadow">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (widget.contentError) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg bg-red-100 shadow">
        <div className="text-red-500">Error: {widget.contentError}</div>
      </div>
    );
  }

  const data = widget.content.data;

  const noteStyle = {
    backgroundColor: data.backgroundColor,
    color: data.textColor,
    fontSize: `${data.fontSize}px`,
    fontFamily: data.fontFamily,
    textAlign: data.textAlign as "left" | "center" | "right",
    fontWeight: data.formatting?.bold ? "bold" : "normal",
    fontStyle: data.formatting?.italic ? "italic" : "normal",
    textDecoration: data.formatting?.underline ? "underline" : "none",
  };

  return (
    <div
      className="h-full overflow-hidden rounded-lg border border-yellow-200 shadow-md"
      style={{ backgroundColor: data.backgroundColor }}
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
              color: data.textColor,
              fontSize: `${data.fontSize}px`,
              fontFamily: data.fontFamily,
              fontWeight: data.formatting?.bold ? "bold" : "normal",
              fontStyle: data.formatting?.italic ? "italic" : "normal",
              textDecoration: data.formatting?.underline ? "underline" : "none",
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
          {data.content ? (
            <div className="whitespace-pre-wrap break-words">
              {data.content}
            </div>
          ) : (
            <div className="text-gray-400 italic">Click to add a note...</div>
          )}
        </div>
      )}
    </div>
  );
};
