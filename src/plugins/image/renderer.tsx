import type React from "react";
import { useCallback, useState } from "react";
import { PinataService } from "../../services/pinataService";
import { useFileUpload } from "../../stores/contentStore";
import { useWidgetContent, useWidgetState } from "../../stores/selectiveHooks";
import type { SelectiveWidgetRendererProps } from "../../types/widgets";
import type { ImageContent } from "./types";

// ============================================================================
// IMAGE WIDGET RENDERER - SELECTIVE REACTIVITY
// ============================================================================

export const ImageRenderer: React.FC<SelectiveWidgetRendererProps> = ({
  widgetId,
}) => {
  // Selective subscriptions - only re-render when these specific values change
  const src = useWidgetContent(widgetId, (content) => content.data.src);
  const alt = useWidgetContent(widgetId, (content) => content.data.alt);
  const filters = useWidgetContent(widgetId, (content) => content.data.filters);
  const originalDimensions = useWidgetContent(
    widgetId,
    (content) => content.data.originalDimensions,
  );

  // Subscribe to widget state
  const isSelected = useWidgetState(widgetId, (state) => state.isSelected);

  // Get content ID for upload state
  const contentId = useWidgetContent(widgetId, (content) => content.id);

  const { getUploadState, retryFileUpload } = useFileUpload();
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState<string | null>(null);

  // Get upload state for this widget's content
  const uploadState = contentId ? getUploadState(contentId) : null;

  const handleImageLoad = useCallback(() => {
    setImageLoading(false);
    setImageError(null);
  }, []);

  const handleImageError = useCallback(() => {
    setImageLoading(false);
    setImageError("Failed to load image");
  }, []);

  // Early returns for loading and error states
  if (!src) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg bg-gray-100">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  const handleImageClick = useCallback(
    (event: React.MouseEvent) => {
      // Mark as interactive to prevent widget selection
      event.stopPropagation();

      // Could add image viewing/editing functionality here
      if (src) {
        console.log("Image clicked:", src);
      }
    },
    [src],
  );

  // Build filter styles if filters are applied
  let filterStyle = "";
  if (filters) {
    const filterArray = [];
    if (filters.brightness !== undefined) {
      filterArray.push(`brightness(${filters.brightness}%)`);
    }
    if (filters.contrast !== undefined) {
      filterArray.push(`contrast(${filters.contrast}%)`);
    }
    if (filters.saturation !== undefined) {
      filterArray.push(`saturate(${filters.saturation}%)`);
    }
    if (filters.blur !== undefined) {
      filterArray.push(`blur(${filters.blur}px)`);
    }
    filterStyle = filterArray.join(" ");
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
            <div className="text-gray-500 text-xs">{src}</div>
          </div>
        </div>
      )}

      {/* Main image */}
      <img
        draggable={false}
        src={src}
        alt={alt || "Image"}
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
      {!isSelected && !imageLoading && !imageError && originalDimensions && (
        <div className="absolute right-0 bottom-0 left-0 bg-black bg-opacity-75 p-2 text-white text-xs opacity-0 transition-opacity hover:opacity-100">
          <div className="truncate">{alt || "Image"}</div>
          <div className="text-gray-300 text-xs">
            {originalDimensions.width} × {originalDimensions.height}
          </div>
        </div>
      )}

      {/* Filter indicator */}
      {filters && Object.keys(filters).length > 0 && (
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
                  if (contentId) {
                    retryFileUpload(contentId);
                  }
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
      {!uploadState && src && PinataService.isIpfsUrl(src) && (
        <div className="absolute top-2 left-2 flex items-center gap-1 rounded bg-green-600 bg-opacity-90 px-2 py-1 text-white text-xs">
          <span>🌐</span>
          <span>IPFS</span>
        </div>
      )}
    </div>
  );
};

// Mark this component as using selective reactivity
(ImageRenderer as any).selectiveReactivity = true;
