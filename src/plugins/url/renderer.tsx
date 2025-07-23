import React, { useCallback } from "react";
import type {
  WidgetRendererProps,
  UrlContent,
} from "../../types/widgets";
import { useContentActions } from "../../stores/widgetStore";

// ============================================================================
// URL WIDGET RENDERER - CLEAN IMPLEMENTATION
// ============================================================================

export const UrlRenderer: React.FC<WidgetRendererProps<UrlContent>> = ({
  widget,
  state,
  events,
}) => {
  const { updateContent } = useContentActions();

  const handleLinkClick = useCallback((event: React.MouseEvent) => {
    // Mark as interactive to prevent widget selection
    event.stopPropagation();
    
    // Open link in new tab
    if (widget.content.data.url) {
      window.open(widget.content.data.url, '_blank', 'noopener,noreferrer');
    }
  }, [widget.content.data.url]);

  const handleEdit = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    
    // Simple URL editing - could be enhanced with a proper modal
    const newUrl = prompt("Enter new URL:", widget.content.data.url);
    if (newUrl && newUrl !== widget.content.data.url) {
      const updatedData = {
        ...widget.content.data,
        url: newUrl,
        title: extractDomainFromUrl(newUrl)
      };
      updateContent(widget.contentId, { data: updatedData });
    }
  }, [widget.contentId, widget.content.data, updateContent]);

  const extractDomainFromUrl = (url: string): string => {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace(/^www\./, "");
    } catch {
      return "Unknown Site";
    }
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

  const data = widget.content.data;

  return (
    <div className="h-full bg-white rounded-lg shadow overflow-hidden border border-gray-200 hover:border-blue-300 transition-colors">
      {/* URL Content */}
      <div className="flex flex-col h-full">
        {/* Header with favicon and domain */}
        <div className="flex items-center gap-2 p-3 border-b border-gray-100">
          {data.favicon && (
            <img 
              src={data.favicon} 
              alt="" 
              className="w-4 h-4 flex-shrink-0"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          )}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-700 truncate">
              {data.title || extractDomainFromUrl(data.url)}
            </div>
            <div className="text-xs text-gray-500 truncate">
              {data.url}
            </div>
          </div>
        </div>

        {/* Content area */}
        <div className="flex-1 p-3">
          {data.description && (
            <p className="text-sm text-gray-600 mb-3 line-clamp-3">
              {data.description}
            </p>
          )}
          
          {data.preview && (
            <div className="mb-3">
              <img 
                src={data.preview} 
                alt="Preview" 
                className="w-full h-20 object-cover rounded border"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 mt-auto">
            <button
              onClick={handleLinkClick}
              className="flex-1 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded transition-colors"
              data-interactive="true"
            >
              🔗 Visit
            </button>
            <button
              onClick={handleEdit}
              className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded transition-colors"
              data-interactive="true"
            >
              ✏️
            </button>
          </div>
        </div>

        {/* Embed indicator */}
        {data.embedType && data.embedType !== "link" && (
          <div className="absolute top-2 right-2 bg-blue-500 text-white px-2 py-1 rounded text-xs">
            {data.embedType.toUpperCase()}
          </div>
        )}
      </div>
    </div>
  );
};