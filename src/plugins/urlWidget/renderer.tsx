import type React from "react";
import type { WidgetRendererProps } from "../../types/widgets";
import type { UrlWidget } from "./types";

export const UrlWidgetRenderer: React.FC<WidgetRendererProps<UrlWidget>> = ({
  widget,
  state,
  events,
}) => {
  const domain = new URL(widget.url).hostname;

  return (
    <div className="flex h-full flex-col">
      {/* Preview card */}
      <div className="min-h-0 flex-1 overflow-hidden rounded border border-gray-200 bg-white">
        {/* Preview image */}
        {widget.preview && (
          <div className="h-24 w-full bg-gray-100">
            <img
              src={widget.preview}
              alt=""
              className="h-full w-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          </div>
        )}

        {/* Card content */}
        <div className="p-3">
          {/* Title */}
          <div className="mb-1 line-clamp-2 font-medium text-gray-900 text-sm">
            {widget.title || domain}
          </div>

          {/* Description */}
          {widget.description && (
            <div className="mb-2 line-clamp-2 text-gray-600 text-xs">
              {widget.description}
            </div>
          )}

          {/* Domain and favicon */}
          <div className="flex items-center gap-2">
            {widget.favicon && (
              <img
                src={widget.favicon}
                alt=""
                className="h-3 w-3 flex-shrink-0"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            )}
            <div className="truncate text-gray-500 text-xs">{domain}</div>
          </div>
        </div>
      </div>

      {/* URL bar */}
      <div className="mt-2 truncate px-1 text-blue-500 text-xs">
        {widget.url}
      </div>
    </div>
  );
};
