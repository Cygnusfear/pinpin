import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { useContentActions } from "../../stores/widgetStore";
import type { UrlContent, WidgetRendererProps } from "../../types/widgets";

// ============================================================================
// URL WIDGET RENDERER - CLEAN IMPLEMENTATION
// ============================================================================

// Helper function moved outside component to avoid dependency issues
const extractDomainFromUrl = (url: string): string => {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, "");
  } catch {
    return "Unknown Site";
  }
};

export const UrlRenderer: React.FC<WidgetRendererProps<UrlContent>> = ({
  widget,
  state,
  events,
}) => {
  const data = useMemo(() => widget.content.data, [widget.content.data]);
  const [previewImage, setHasPreview] = useState(
    data.image || data.preview || null,
  );

  // Update preview image when data changes (for metadata enrichment)
  useEffect(() => {
    const newPreviewImage = data.image || data.preview || null;
    setHasPreview(newPreviewImage);
  }, [data.image, data.preview]);

  const handleLinkClick = useCallback(
    (event: React.MouseEvent) => {
      // Mark as interactive to prevent widget selection
      event.stopPropagation();

      // Open link in new tab
      if (widget.content?.data.url) {
        window.open(widget.content.data.url, "_blank", "noopener,noreferrer");
      }
    },
    [widget.content?.data.url],
  );

  // Early returns for loading and error states
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

  // Additional null safety check
  if (!widget.content || !widget.content.data) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg bg-white shadow">
        <div className="p-4 text-center text-red-500">
          <div className="mb-2 text-2xl">⚠️</div>
          <div className="text-sm">Error: URL content is missing</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-md transition-all duration-200 hover:border-blue-300 hover:shadow-lg">
      {/* Twitter Card-like Layout */}
      <div className="relative flex h-full flex-col">
        {/* Preview Image (if available) */}
        {previewImage && (
          <div className="relative top-0 left-0 z-0 min-h-0 w-full overflow-hidden bg-gray-50">
            <img
              draggable={false}
              src={previewImage}
              alt="Preview"
              className="max-h-[160px] min-h-0 w-full object-cover"
              crossOrigin="anonymous"
              referrerPolicy="no-referrer"
              onError={(e) => {
                setHasPreview(null);
              }}
            />
            {/* Embed type badge */}
            {data.embedType && data.embedType !== "link" && (
              <div className="absolute top-2 right-2 rounded bg-black/70 px-2 py-1 font-medium text-white text-xs">
                {data.embedType.toUpperCase()}
              </div>
            )}
          </div>
        )}

        {/* Content area */}
        <div
          className={cn(
            "z-1 flex h-full min-h-0 flex-col gap-3 p-4",
            previewImage &&
              "absolute bottom-0 h-auto gap-2 border-gray-200 border-t bg-gradient-to-t from-white to-white py-2",
          )}
        >
          {/* Header with favicon and site info */}
          <div className="flex items-center gap-2">
            {data.favicon && (
              <img
                src={data.favicon}
                alt=""
                className="h-4 w-4 flex-shrink-0 rounded"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-gray-500 text-xs">
                {data.siteName || extractDomainFromUrl(data.url)}
              </div>
            </div>
          </div>

          {/* Title */}
          <h3 className="line-clamp-2 font-semibold text-gray-900 text-xs leading-tight">
            {data.title || extractDomainFromUrl(data.url)}
          </h3>

          {/* Description */}
          {!previewImage && data.description && (
            <p
              className={cn(
                "mb-3 line-clamp-2 text-gray-600 text-xs leading-relaxed",
                previewImage && "text-xs",
              )}
            >
              {data.description}
            </p>
          )}

          {/* Metadata row */}
          {!previewImage && (
            <div className="flex items-center gap-3 text-gray-500 text-xs">
              {data.author && (
                <span className="flex items-center gap-1">
                  <span>👤</span>
                  <span className="max-w-20 truncate">{data.author}</span>
                </span>
              )}
              {data.publishedTime && (
                <span className="flex items-center gap-1">
                  <span>📅</span>
                  <span>
                    {new Date(data.publishedTime).toLocaleDateString()}
                  </span>
                </span>
              )}
              {data.twitterCreator && (
                <span className="flex items-center gap-1">
                  <span>🐦</span>
                  <span className="max-w-20 truncate">
                    {data.twitterCreator}
                  </span>
                </span>
              )}
            </div>
          )}

          {/* URL display */}
          {!previewImage && (
            <div className="truncate text-gray-400 text-xs">{data.url}</div>
          )}
        </div>
        {/* Action buttons */}
        <div className="absolute top-0 right-0">
          <button
            type="button"
            onClick={handleLinkClick}
            className="flex flex-1 items-center justify-center gap-1 rounded-bl p-3 font-medium text-white text-xs transition-colors hover:bg-black"
            data-interactive="true"
          >
            <span>🔗</span>
          </button>
        </div>
      </div>
    </div>
  );
};
