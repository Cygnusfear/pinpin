import { motion } from "framer-motion";
import type React from "react";
import type { BoundingBox, SnapTarget, Widget } from "../types/canvas";

interface SelectionIndicatorProps {
  selectedWidgets: Widget[];
  hoveredWidget: Widget | null;
  selectionBox: BoundingBox | null;
  snapTargets: SnapTarget[];
}

export const SelectionIndicator: React.FC<SelectionIndicatorProps> = ({
  selectedWidgets,
  hoveredWidget,
  selectionBox,
  snapTargets,
}) => {
  const calculateSelectionBounds = (widgets: Widget[]): BoundingBox | null => {
    if (widgets.length === 0) return null;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    widgets.forEach((widget) => {
      minX = Math.min(minX, widget.x);
      minY = Math.min(minY, widget.y);
      maxX = Math.max(maxX, widget.x + widget.width);
      maxY = Math.max(maxY, widget.y + widget.height);
    });

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  };

  // Transformation handles removed - will be rebuilt later

  const selectionBounds = calculateSelectionBounds(selectedWidgets);

  return (
    <div
      className="pointer-events-none absolute inset-0"
      style={{ zIndex: 1001 }}
    >
      {/* Hover indicator */}
      {hoveredWidget &&
        !selectedWidgets.some((w) => w.id === hoveredWidget.id) && (
          <motion.div
            className="pointer-events-none absolute border-2 border-blue-300"
            style={{
              left: hoveredWidget.x - 2,
              top: hoveredWidget.y - 2,
              width: hoveredWidget.width + 4,
              height: hoveredWidget.height + 4,
              borderRadius: "4px",
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1, ease: "easeOut" }}
          />
        )}

      {/* Individual widget selection outlines */}
      {selectedWidgets.map((widget) => (
        <motion.div
          key={`selection-${widget.id}`}
          className="pointer-events-none absolute border-2 border-blue-500"
          style={{
            left: widget.x - 2,
            top: widget.y - 2,
            width: widget.width + 4,
            height: widget.height + 4,
            borderRadius: "4px",
          }}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
        />
      ))}

      {/* Multi-selection bounds and handles */}
      {selectionBounds && selectedWidgets.length > 1 && (
        <motion.div
          className="pointer-events-none absolute"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
        >
          {/* Selection bounds outline */}
          <div
            className="absolute border-2 border-blue-600"
            style={{
              left: selectionBounds.x - 4,
              top: selectionBounds.y - 4,
              width: selectionBounds.width + 8,
              height: selectionBounds.height + 8,
              borderRadius: "6px",
              borderStyle: "dashed",
            }}
          />

          {/* Transform handles removed - will be rebuilt later */}

          {/* Selection count indicator */}
          <div
            className="absolute rounded bg-blue-500 px-2 py-1 font-medium text-white text-xs"
            style={{
              left: selectionBounds.x,
              top: selectionBounds.y - 28,
            }}
          >
            {selectedWidgets.length} selected
          </div>
        </motion.div>
      )}

      {/* Single selection handles */}
      {selectionBounds && selectedWidgets.length === 1 && (
        <motion.div
          className="pointer-events-none absolute"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
        >
          {/* Transform handles removed - will be rebuilt later */}
        </motion.div>
      )}

      {/* Area selection box */}
      {selectionBox && (
        <motion.div
          className="pointer-events-none absolute border-2 border-blue-500 bg-blue-500/10"
          style={{
            left: selectionBox.x,
            top: selectionBox.y,
            width: selectionBox.width,
            height: selectionBox.height,
            borderRadius: "2px",
          }}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.1, ease: "easeOut" }}
        />
      )}

      {/* Snap indicators */}
      {snapTargets.map((target, _index) => (
        <motion.div
          key={`snap-${target.type}-${target.orientation}-${target.position.x}-${target.position.y}`}
          className="pointer-events-none absolute"
          style={{
            left:
              target.orientation === "vertical" ? target.position.x - 0.5 : 0,
            top:
              target.orientation === "horizontal" ? target.position.y - 0.5 : 0,
            width: target.orientation === "vertical" ? 1 : "100%",
            height: target.orientation === "horizontal" ? 1 : "100%",
            backgroundColor: target.type === "grid" ? "#ff0080" : "#00ff80",
            opacity: target.strength,
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: target.strength }}
          exit={{ opacity: 0 }}
        />
      ))}
    </div>
  );
};

export default SelectionIndicator;
