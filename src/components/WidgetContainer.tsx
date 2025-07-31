import { motion } from "framer-motion";
import type React from "react";
import { useCallback, useMemo } from "react";
import { getWidgetRegistry } from "../core/WidgetRegistry";
import type {
  HydratedWidget,
  WidgetEvents,
  WidgetRenderState,
} from "../types/widgets";
import WidgetErrorBoundary from "./WidgetErrorBoundary";
import { useSyncContext } from "./SyncProvider";

interface WidgetContainerProps {
  widget: HydratedWidget;
  state: WidgetRenderState;
  events: WidgetEvents;
}

export const WidgetContainer: React.FC<WidgetContainerProps> = ({
  widget,
  state,
  events,
}) => {
  const registry = getWidgetRegistry();
  const renderer = registry.getRenderer(widget.type);
  const widgetTypeDefinition = registry.getType(widget.type);
  const { status } = useSyncContext();

  // Render widget content using plugin renderer or fallback
  const renderWidgetContent = useMemo(() => {
    if (widget.type === "loading" || status !== "synced") {
      return (
        <div className="flex h-full flex-col items-center justify-center p-4 text-center">
          <div className="mb-2 h-8 w-8 animate-spin rounded-full border-blue-500 border-b-2" />
          <div className="mb-1 font-medium text-sm">Loading Content</div>
          <div className="text-gray-500 text-xs">
            {(widget as any).message || "Please wait..."}
          </div>
        </div>
      );
    }

    if (widget.type === "error") {
      return (
        <div className="flex h-full flex-col items-center justify-center p-4 text-center">
          <div className="mb-2 text-2xl">⚠️</div>
          <div className="mb-1 font-medium text-red-600 text-sm">
            Content Error
          </div>
          <div className="text-gray-500 text-xs">
            {(widget as any).errorMessage || "Failed to load content"}
          </div>
          {(widget as any).originalType && (
            <div className="mt-1 text-gray-400 text-xs">
              Type: {(widget as any).originalType}
            </div>
          )}
        </div>
      );
    }

    // Check if renderer exists and is available
    if (renderer?.component) {
      // Check if content is actually available before rendering
      if (!widget.isContentLoaded || !widget.content) {
        // If we have a content error and we're not actively loading, show error
        if (widget.contentError && widget.isContentLoaded) {
          return (
            <div className="flex h-full flex-col items-center justify-center p-4 text-center">
              <div className="mb-2 text-2xl">⚠️</div>
              <div className="mb-1 font-medium text-red-600 text-sm">
                Content Error
              </div>
              <div className="text-gray-500 text-xs">
                {widget.contentError}
              </div>
            </div>
          );
        }
        
        // Otherwise, show loading state
        return (
          <div className="flex h-full flex-col items-center justify-center p-4 text-center">
            <div className="mb-2 h-8 w-8 animate-spin rounded-full border-blue-500 border-b-2" />
            <div className="mb-1 font-medium text-sm">Loading Content</div>
            <div className="text-gray-500 text-xs">
              Hydrating widget data...
            </div>
          </div>
        );
      }

      const RendererComponent = renderer.component;

      // All widgets now use the selective reactivity interface - wrapped in error boundary
      return (
        <WidgetErrorBoundary
          widgetId={widget.id}
          widgetType={widget.type}
          fallback={
            <div className="flex h-full flex-col items-center justify-center p-4 text-center bg-orange-50 border border-orange-200 rounded">
              <div className="mb-3 text-3xl">🔧</div>
              <div className="mb-2 font-semibold text-orange-700 text-sm">
                Plugin Error
              </div>
              <div className="mb-2 text-gray-600 text-xs">
                The "{widget.type}" plugin encountered an error
              </div>
              <div className="mt-2 text-gray-400 text-xs">
                Widget will retry automatically
              </div>
            </div>
          }
        >
          <RendererComponent key={widget.id} widgetId={widget.id} />
        </WidgetErrorBoundary>
      );
    }

    // Enhanced fallback renderer for unknown/failed widget types
    return (
      <div className="flex h-full flex-col items-center justify-center p-4 text-center bg-gray-50 border border-gray-200 rounded">
        <div className="mb-2 text-2xl">📦</div>
        <div className="mb-1 font-medium text-sm">{widget.type}</div>
        <div className="mb-2 text-gray-500 text-xs">Plugin not available</div>
        
        <div className="flex gap-2">
          <button
            onClick={() => {
              // Copy widget info for debugging
              const debugInfo = {
                widgetId: widget.id,
                widgetType: widget.type,
                hasRenderer: !!renderer,
                isContentLoaded: widget.isContentLoaded,
                timestamp: new Date().toISOString()
              };
              navigator.clipboard.writeText(JSON.stringify(debugInfo, null, 2));
              alert('Widget debug info copied to clipboard');
            }}
            className="px-3 py-1 bg-gray-500 text-white text-xs rounded hover:bg-gray-600 transition-colors"
          >
            📋 Debug
          </button>
        </div>
        
        <div className="mt-2 text-gray-400 text-xs">
          ID: {widget.id.slice(-8)}
        </div>
      </div>
    );
  }, [widget, state, events, renderer?.component]);

  // Handle widget container clicks with interactive content detection
  const handleWidgetClick = useCallback(
    (event: React.MouseEvent) => {
      console.log("📦 WidgetContainer clicked:", {
        widgetId: widget.id,
        widgetType: widget.type,
        target: event.target,
        targetTagName: (event.target as HTMLElement).tagName,
        currentTarget: event.currentTarget,
        defaultPrevented: event.defaultPrevented,
        propagationStopped: event.isPropagationStopped?.() || "unknown",
      });

      // Check if the click is on interactive content
      const target = event.target as HTMLElement;
      const isButton = target.tagName === "BUTTON";
      const closestButton = target.closest("button");
      const hasInteractiveAttr = target.hasAttribute("data-interactive");
      const closestInteractive = target.closest("[data-interactive]");

      const isInteractiveContent =
        isButton || closestButton || hasInteractiveAttr || closestInteractive;

      console.log("📦 Interactive content detection:", {
        isButton,
        closestButton: !!closestButton,
        hasInteractiveAttr,
        closestInteractive: !!closestInteractive,
        isInteractiveContent,
      });

      // If clicking on interactive content, don't trigger onSelect
      if (isInteractiveContent) {
        console.log("📦 Interactive content detected - stopping propagation");
        event.stopPropagation();
        return;
      }

      console.log("📦 Non-interactive content - calling events.onSelect()");
      // Otherwise, proceed with normal widget selection
      events.onSelect();
    },
    [widget.id, events.onSelect, widget.type],
  );

  return (
    <motion.div
      style={{
        position: "absolute",
        left: widget.x,
        top: widget.y,
        width: widget.width,
        height: widget.height + 20, // Extra space for pin
        transformOrigin: "center",
        zIndex: state.isSelected ? 1000 : widget.zIndex,
        opacity: state.isSelected ? 0.9 : widget.locked ? 0.7 : 1,
        cursor: widget.locked
          ? "not-allowed"
          : state.isSelected
            ? "move"
            : "pointer",
        pointerEvents: widget.locked ? "none" : "auto",
      }}
      className={widgetTypeDefinition?.allowSelection ? "select-text" : "select-none"}
      data-widget-id={widget.id}
      initial={{ opacity: 0, scale: 0.8, rotateY: widget.rotation }}
      animate={{
        opacity: 1,
        scale: 1,
        transition: { duration: 0.2 },
        rotateY: widget.rotation,
      }}
      exit={{ opacity: 0, scale: 0.8 }}
      onClick={widget.locked ? undefined : handleWidgetClick}
      onMouseEnter={widget.locked ? undefined : events.onHover}
      onMouseLeave={widget.locked ? undefined : events.onUnhover}
    >
      {/* Pin/Thumbtack */}
      <div
        style={{
          position: "absolute",
          top: "5px",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 10,
          width: "12px",
          height: "12px",
          backgroundColor: widget.locked
            ? "#9ca3af"
            : state.isSelected
              ? "#3b82f6"
              : "#dc2626",
          borderRadius: "50%",
          border: `2px solid ${widget.locked ? "#6b7280" : state.isSelected ? "#1d4ed8" : "#b91c1c"}`,
          boxShadow:
            "0 2px 4px rgba(0,0,0,0.3), inset 0 1px 2px rgba(255,255,255,0.3)",
        }}
      />

      {/* Widget Content Container */}
      <div
        style={{
          position: "relative",
          top: "10px",
          width: "100%",
          height: widget.height,
          backgroundColor: "white",
          padding: "8px",
          borderRadius: "2px",
          boxShadow: `
            0 4px 8px rgba(0,0,0,0.15),
            0 2px 4px rgba(0,0,0,0.1),
            0 8px 16px rgba(0,0,0,0.1)
          `,
          border: state.isSelected
            ? "2px solid #3b82f6"
            : "2px solid transparent",
          overflow: widgetTypeDefinition?.allowOverflow ? "visible" : "hidden",
        }}
      >
        {renderWidgetContent}
      </div>

      {/* Pin Shadow */}
      <div
        style={{
          position: "absolute",
          top: "7px",
          left: "50%",
          transform: "translateX(-50%)",
          width: "8px",
          height: "8px",
          backgroundColor: "rgba(0,0,0,0.2)",
          borderRadius: "50%",
          filter: "blur(4px)",
          zIndex: -1,
        }}
      />

      {/* Locked indicator */}
      {widget.locked && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-500/20">
          <div className="p-2 text-center text-gray-600">
            <div className="text-lg">🔒</div>
            <div className="text-xs">Locked</div>
          </div>
        </div>
      )}

      {/* Loading indicator */}
      {state.isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80">
          <div className="h-6 w-6 animate-spin rounded-full border-blue-500 border-b-2" />
        </div>
      )}

      {/* Error indicator */}
      {state.hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-50">
          <div className="p-2 text-center text-red-500">
            <div className="text-lg">⚠️</div>
            <div className="text-xs">
              {state.errorMessage || "Error loading widget"}
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default WidgetContainer;
