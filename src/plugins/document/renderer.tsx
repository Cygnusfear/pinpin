import React, { useCallback } from "react";
import type {
  WidgetRendererProps,
  DocumentContent,
} from "../../types/widgets";
import { useFileUpload } from "../../stores/contentStore";
import { PinataService } from "../../services/pinataService";
import { useContentActions } from "../../stores/widgetStore";

// ============================================================================
// DOCUMENT WIDGET RENDERER - CLEAN IMPLEMENTATION
// ============================================================================

export const DocumentRenderer: React.FC<WidgetRendererProps<DocumentContent>> = ({
  widget,
  state,
  events,
}) => {
  const { getUploadState, retryFileUpload } = useFileUpload();
  
  // Get upload state for this widget's content
  const uploadState = getUploadState(widget.contentId);
  const { updateContent } = useContentActions();

  const handleDownload = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    
    if (widget.content.data.downloadUrl) {
      window.open(widget.content.data.downloadUrl, '_blank');
    } else if (widget.content.data.content) {
      // Create a blob and download for text content
      const blob = new Blob([widget.content.data.content], { type: widget.content.data.mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = widget.content.data.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }, [widget.content.data]);

  const handlePreview = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    
    if (widget.content.data.previewUrl) {
      window.open(widget.content.data.previewUrl, '_blank');
    } else if (widget.content.data.content && widget.content.data.mimeType.startsWith('text/')) {
      // Show text content in a modal or new window
      const newWindow = window.open('', '_blank');
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
  }, [widget.content.data]);

  const getFileIcon = (fileType: string): string => {
    switch (fileType) {
      case 'pdf': return '📕';
      case 'word': return '📘';
      case 'powerpoint': return '📙';
      case 'excel': return '📗';
      case 'text': return '📄';
      case 'csv': return '📊';
      default: return '📄';
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

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
        <div className="text-red-500 text-center p-4">
          <div className="text-2xl mb-2">⚠️</div>
          <div className="text-sm">Error: {widget.contentError}</div>
        </div>
      </div>
    );
  }

  const data = widget.content?.data;

  if (!data) {
    return (
      <div className="flex items-center justify-center h-full bg-white rounded-lg shadow">
        <div className="text-gray-500 text-center p-4">
          <div className="text-2xl mb-2">📄</div>
          <div className="text-sm">No document data available</div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full bg-white rounded-lg shadow overflow-hidden border border-gray-200 hover:border-blue-300 transition-colors">
      <div className="flex flex-col h-full">
        {/* Header with file icon and name */}
        <div className="flex items-center gap-3 p-3 border-b border-gray-100">
          <div className="text-2xl flex-shrink-0">
            {getFileIcon(data.fileType)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-gray-900 truncate">
              {data.fileName}
            </div>
            <div className="text-xs text-gray-500">
              {data.fileType.toUpperCase()} • {formatFileSize(data.fileSize)}
            </div>
          </div>
        </div>

        {/* Preview area */}
        <div className="flex-1 p-3 min-h-0">
          {data.thumbnail && (
            <div className="mb-3">
              <img 
                src={data.thumbnail} 
                alt="Document preview" 
                className="w-full h-20 object-cover rounded border"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          )}
          
          {data.content && data.mimeType.startsWith('text/') && (
            <div className="bg-gray-50 p-3 rounded text-sm text-gray-700 max-h-20 overflow-hidden">
              <div className="line-clamp-3">
                {data.content}
              </div>
            </div>
          )}

          {!data.content && !data.thumbnail && (
            <div className="flex items-center justify-center h-full text-gray-400">
              <div className="text-center">
                <div className="text-4xl mb-2">{getFileIcon(data.fileType)}</div>
                <div className="text-sm">Document preview not available</div>
              </div>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="p-3 border-t border-gray-100">
          <div className="flex gap-2">
            {(data.previewUrl || (data.content && data.mimeType.startsWith('text/'))) && (
              <button
                onClick={handlePreview}
                className="flex-1 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded transition-colors"
                data-interactive="true"
              >
                👁️ Preview
              </button>
            )}
            {(data.downloadUrl || data.content) && (
              <button
                onClick={handleDownload}
                className="flex-1 px-3 py-2 bg-green-500 hover:bg-green-600 text-white text-sm rounded transition-colors"
                data-interactive="true"
              >
                📥 Download
              </button>
            )}
            {!data.downloadUrl && !data.content && !data.previewUrl && (
              <div className="flex-1 px-3 py-2 bg-gray-100 text-gray-500 text-sm rounded text-center">
                No actions available
              </div>
            )}
          </div>
        </div>

        {/* Upload status indicator */}
        {uploadState && (
          <div className="absolute top-2 left-2 bg-black bg-opacity-90 text-white px-2 py-1 rounded text-xs flex items-center gap-1">
            {uploadState.status === 'uploading' && (
              <>
                <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                <span>{uploadState.progress}%</span>
              </>
            )}
            {uploadState.status === 'completed' && uploadState.ipfsUrl && (
              <>
                <span>🌐</span>
                <span>IPFS</span>
              </>
            )}
            {uploadState.status === 'failed' && (
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
        {!uploadState && data.downloadUrl && PinataService.isIpfsUrl(data.downloadUrl) && (
          <div className="absolute top-2 left-2 bg-green-600 bg-opacity-90 text-white px-2 py-1 rounded text-xs flex items-center gap-1">
            <span>🌐</span>
            <span>IPFS</span>
          </div>
        )}

        {/* File type indicator */}
        <div className="absolute top-2 right-2 bg-gray-800 text-white px-2 py-1 rounded text-xs">
          {data.fileType.toUpperCase()}
        </div>
      </div>
    </div>
  );
};