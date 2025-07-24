import type React from "react";
import { useCallback, useState } from "react";
import { PinataService } from "../../services/pinataService";
import { useFileUpload } from "../../stores/contentStore";
import { useContentActions } from "../../stores/widgetStore";
import type { WidgetRendererProps } from "../../types/widgets";
import type { ImageContent } from "./types";

// ============================================================================
// IMAGE WIDGET RENDERER - CLEAN IMPLEMENTATION
// ============================================================================

export const ImageRenderer: React.FC<WidgetRendererProps<ImageContent>> = ({
  widget,
  state,
  events,
}) => {
  const { updateContent } = useContentActions();
  const { getUploadState, retryFileUpload } = useFileUpload();
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState<string | null>(null);

  // Get upload state for this widget's content
  const uploadState = getUploadState(widget.contentId);

  const handleImageLoad = useCallback(() => {
    setImageLoading(false);
    setImageError(null);
  }, []);

  const handleImageError = useCallback(() => {
    setImageLoading(false);
    setImageError("Failed to load image");
  }, []);

  // Early returns for loading and error states
  if (!widget.isContentLoaded) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg bg-gray-100">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (widget.contentError) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg bg-gray-100">
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
      <div className="flex h-full items-center justify-center rounded-lg bg-gray-100">
        <div className="p-4 text-center text-red-500">
          <div className="mb-2 text-2xl">⚠️</div>
          <div className="text-sm">Error: Image content is missing</div>
        </div>
      </div>
    );
  }

  const data = widget.content.data;

  const handleImageClick = useCallback(
    (event: React.MouseEvent) => {
      // Mark as interactive to prevent widget selection
      event.stopPropagation();

      // Could add image viewing/editing functionality here
      if (widget.content?.data?.src) {
        console.log("Image clicked:", widget.content.data.src);
      }
    },
    [widget.content?.data?.src],
  );

  // Build filter styles if filters are applied
  let filterStyle = "";
  if (data.filters) {
    const filters = [];
    if (data.filters.brightness !== undefined) {
      filters.push(`brightness(${data.filters.brightness}%)`);
    }
    if (data.filters.contrast !== undefined) {
      filters.push(`contrast(${data.filters.contrast}%)`);
    }
    if (data.filters.saturation !== undefined) {
      filters.push(`saturate(${data.filters.saturation}%)`);
    }
    if (data.filters.blur !== undefined) {
      filters.push(`blur(${data.filters.blur}px)`);
    }
    filterStyle = filters.join(" ");
  }

  return (
    <div className="relative h-full w-full overflow-hidden rounded bg-white">
      {/* Loading indicator */}
      {imageLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <div className="flex flex-col items-center gap-2">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
            <div className="text-gray-600 text-sm">Loading image...</div>
          </div>
        </div>
      )}

      {/* Error state */}
      {imageError && (
        <div className="absolute inset-0 flex items-center justify-center rounded bg-gray-100">
          <div className="p-4 text-center">
            <div className="mb-2 text-4xl">🖼️</div>
            <div className="mb-2 text-red-500 text-sm">{imageError}</div>
            <div className="text-gray-500 text-xs">{data.src}</div>
          </div>
        </div>
      )}

      {/* Main image */}
      <img
        draggable={false}
        src={data.src}
        alt={data.alt || "Image"}
        className="h-full w-full cursor-pointer object-contain"
        style={{
          filter: filterStyle || undefined,
          display: imageLoading || imageError ? "none" : "block",
        }}
        onLoad={handleImageLoad}
        onError={handleImageError}
        onClick={handleImageClick}
        data-interactive="true"
      />

      {/* Image info overlay (shown on hover if not selected) */}
      {!state.isSelected &&
        !imageLoading &&
        !imageError &&
        data.originalDimensions && (
          <div className="absolute right-0 bottom-0 left-0 bg-black bg-opacity-75 p-2 text-white text-xs opacity-0 transition-opacity hover:opacity-100">
            <div className="truncate">{data.alt || "Image"}</div>
            <div className="text-gray-300 text-xs">
              {data.originalDimensions.width} × {data.originalDimensions.height}
            </div>
          </div>
        )}

      {/* Filter indicator */}
      {data.filters && Object.keys(data.filters).length > 0 && (
        <div className="absolute top-2 right-2 rounded bg-black bg-opacity-75 px-2 py-1 text-white text-xs">
          <span>🎨</span>
        </div>
      )}

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
      {!uploadState && PinataService.isIpfsUrl(data.src) && (
        <div className="absolute top-2 left-2 flex items-center gap-1 rounded bg-green-600 bg-opacity-90 px-2 py-1 text-white text-xs">
          <span>🌐</span>
          <span>IPFS</span>
        </div>
      )}
    </div>
  );
};
