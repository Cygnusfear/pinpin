import type React from "react";
import { useCallback } from "react";
import { PinataService } from "../../services/pinataService";
import { useFileUpload } from "../../stores/contentStore";
import { useContentActions } from "../../stores/widgetStore";
import type { WidgetRendererProps } from "../../types/widgets";
import type { DocumentContent } from "./types";

// ============================================================================
// DOCUMENT WIDGET RENDERER - CLEAN IMPLEMENTATION
// ============================================================================

export const DocumentRenderer: React.FC<
  WidgetRendererProps<DocumentContent>
> = ({ widget, state, events }) => {
  const { getUploadState, retryFileUpload } = useFileUpload();

  // Get upload state for this widget's content
  const uploadState = getUploadState(widget.contentId);
  const { updateContent } = useContentActions();

  const handleDownload = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();

      if (widget.content.data.downloadUrl) {
        window.open(widget.content.data.downloadUrl, "_blank");
      } else if (widget.content.data.content) {
        // Create a blob and download for text content
        const blob = new Blob([widget.content.data.content], {
          type: widget.content.data.mimeType,
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = widget.content.data.fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    },
    [widget.content.data],
  );

  const handlePreview = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();

      if (widget.content.data.previewUrl) {
        window.open(widget.content.data.previewUrl, "_blank");
      } else if (
        widget.content.data.content &&
        widget.content.data.mimeType.startsWith("text/")
      ) {
        // Show text content in a modal or new window
        const newWindow = window.open("", "_blank");
        if (newWindow) {
          newWindow.document.write(`
          <html>
            <head>
              <title>${widget.content.data.fileName}</title>
              <style>
                body { font-family: monospace; padding: 20px; white-space: pre-wrap; }
              </style>
            </head>
            <body>${widget.content.data.content}</body>
          </html>
        `);
        }
      }
    },
    [widget.content.data],
  );

  const getFileIcon = (fileType: string): string => {
    switch (fileType) {
      case "pdf":
        return "📕";
      case "word":
        return "📘";
      case "powerpoint":
        return "📙";
      case "excel":
        return "📗";
      case "text":
        return "📄";
      case "csv":
        return "📊";
      default:
        return "📄";
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / k ** i).toFixed(1)) + " " + sizes[i];
  };

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
        <div className="p-4 text-center text-red-500">
          <div className="mb-2 text-2xl">⚠️</div>
          <div className="text-sm">Error: {widget.contentError}</div>
        </div>
      </div>
    );
  }

  const data = widget.content?.data;

  if (!data) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg bg-white shadow">
        <div className="p-4 text-center text-gray-500">
          <div className="mb-2 text-2xl">📄</div>
          <div className="text-sm">No document data available</div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow transition-colors hover:border-blue-300">
      <div className="flex h-full flex-col">
        {/* Header with file icon and name */}
        <div className="flex items-center gap-3 border-gray-100 border-b p-3">
          <div className="flex-shrink-0 text-2xl">
            {getFileIcon(data.fileType)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium text-gray-900">
              {data.fileName}
            </div>
            <div className="text-gray-500 text-xs">
              {data.fileType.toUpperCase()} • {formatFileSize(data.fileSize)}
            </div>
          </div>
        </div>

        {/* Preview area */}
        <div className="min-h-0 flex-1 p-3">
          {data.thumbnail && (
            <div className="mb-3">
              <img
                src={data.thumbnail}
                alt="Document preview"
                className="h-20 w-full rounded border object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
          )}

          {data.content && data.mimeType.startsWith("text/") && (
            <div className="max-h-20 overflow-hidden rounded bg-gray-50 p-3 text-gray-700 text-sm">
              <div className="line-clamp-3">{data.content}</div>
            </div>
          )}

          {!data.content && !data.thumbnail && (
            <div className="flex h-full items-center justify-center text-gray-400">
              <div className="text-center">
                <div className="mb-2 text-4xl">
                  {getFileIcon(data.fileType)}
                </div>
                <div className="text-sm">Document preview not available</div>
              </div>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="border-gray-100 border-t p-3">
          <div className="flex gap-2">
            {(data.previewUrl ||
              (data.content && data.mimeType.startsWith("text/"))) && (
              <button
                onClick={handlePreview}
                className="flex-1 rounded bg-blue-500 px-3 py-2 text-sm text-white transition-colors hover:bg-blue-600"
                data-interactive="true"
              >
                👁️ Preview
              </button>
            )}
            {(data.downloadUrl || data.content) && (
              <button
                onClick={handleDownload}
                className="flex-1 rounded bg-green-500 px-3 py-2 text-sm text-white transition-colors hover:bg-green-600"
                data-interactive="true"
              >
                📥 Download
              </button>
            )}
            {!data.downloadUrl && !data.content && !data.previewUrl && (
              <div className="flex-1 rounded bg-gray-100 px-3 py-2 text-center text-gray-500 text-sm">
                No actions available
              </div>
            )}
          </div>
        </div>

        {/* Upload status indicator */}
        {uploadState && (
          <div className="absolute top-2 left-2 flex items-center gap-1 rounded bg-black bg-opacity-90 px-2 py-1 text-white text-xs">
            {uploadState.status === "uploading" && (
              <>
                <div className="h-3 w-3 animate-spin rounded-full border border-white border-t-transparent" />
                <span>{uploadState.progress}%</span>
              </>
            )}
            {uploadState.status === "completed" && uploadState.ipfsUrl && (
              <>
                <span>🌐</span>
                <span>IPFS</span>
              </>
            )}
            {uploadState.status === "failed" && (
              <>
                <span>❌</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    retryFileUpload(widget.contentId);
                  }}
                  className="underline hover:text-yellow-300"
                  title="Retry upload"
                >
                  Retry
                </button>
              </>
            )}
          </div>
        )}

        {/* Show IPFS indicator for completed uploads */}
        {!uploadState &&
          data.downloadUrl &&
          PinataService.isIpfsUrl(data.downloadUrl) && (
            <div className="absolute top-2 left-2 flex items-center gap-1 rounded bg-green-600 bg-opacity-90 px-2 py-1 text-white text-xs">
              <span>🌐</span>
              <span>IPFS</span>
            </div>
          )}

        {/* File type indicator */}
        <div className="absolute top-2 right-2 rounded bg-gray-800 px-2 py-1 text-white text-xs">
          {data.fileType.toUpperCase()}
        </div>
      </div>
    </div>
  );
};
