import type React from "react";
import type { WidgetRendererProps } from "../../types/widgets";
import type { DocumentWidget } from "./types";

export const DocumentWidgetRenderer: React.FC<
  WidgetRendererProps<DocumentWidget>
> = ({ widget, state, events }) => {
  return (
    <div className="flex h-full flex-col p-3">
      {/* File icon and name */}
      <div className="mb-2 flex items-center gap-2">
        <div className="text-lg">
          {widget.fileType === "pdf"
            ? "📄"
            : widget.fileType === "doc" || widget.fileType === "docx"
              ? "📝"
              : widget.fileType === "txt"
                ? "📃"
                : widget.fileType === "xls" || widget.fileType === "xlsx"
                  ? "📊"
                  : widget.fileType === "ppt" || widget.fileType === "pptx"
                    ? "📽️"
                    : "📄"}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium text-sm">{widget.fileName}</div>
          <div className="text-gray-500 text-xs">
            {widget.fileType.toUpperCase()} •{" "}
            {widget.fileSize
              ? `${(widget.fileSize / 1024).toFixed(1)}KB`
              : "Unknown size"}
          </div>
        </div>
      </div>

      {/* Thumbnail or preview */}
      {/* <div className="mb-2 min-h-0 flex-1">
        {widget.thumbnail !== undefined ? (
          <img
            src={widget.thumbnail}
            alt="Document preview"
            className="h-full w-full rounded object-cover"
          />
        ) : widget.content ? (
          <div className="line-clamp-4 rounded bg-gray-50 p-2 text-gray-600 text-xs">
            {widget.content.slice(0, 200)}...
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-gray-400">
            <div className="text-center">
              <div className="mb-1 text-2xl">📄</div>
              <div className="text-xs">No preview</div>
            </div>
          </div>
        )}
      </div> */}

      {/* Actions */}
      <div className="flex gap-1">
        {widget.downloadUrl && (
          <button
            type="button"
            className="rounded bg-blue-500 px-2 py-1 text-white text-xs hover:bg-blue-600"
            onClick={(e) => {
              e.stopPropagation();
              window.open(widget.downloadUrl, "_blank");
            }}
          >
            Download
          </button>
        )}
        {widget.previewUrl && (
          <button
            type="button"
            className="rounded bg-gray-500 px-2 py-1 text-white text-xs hover:bg-gray-600"
            onClick={(e) => {
              e.stopPropagation();
              window.open(widget.previewUrl, "_blank");
            }}
          >
            Preview
          </button>
        )}
      </div>
    </div>
  );
};
