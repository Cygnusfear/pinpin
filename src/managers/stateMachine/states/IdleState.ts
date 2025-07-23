import { BaseState } from "../BaseState";
import type {
  InteractionStateName,
  StateMachineEvent,
  StateTransition,
} from "../types";

export class IdleState extends BaseState {
  get name(): InteractionStateName {
    return "idle";
  }

  get cursor(): string {
    return "default";
  }

  onMouseDown(
    event: Extract<StateMachineEvent, { type: "mousedown" }>,
  ): StateTransition | null {
    const { point, button, modifiers, hitWidget } = event;

    // Middle mouse button - start panning
    if (button === 1) {
      return {
        nextState: "panning",
        context: {
          startPosition: event.screenPoint,
          currentPosition: event.screenPoint,
          previousState: "idle",
        },
      };
    }

    // Right mouse button - context menu (handled elsewhere)
    if (button === 2) {
      return null;
    }

    // Left mouse button
    if (button === 0) {
      if (hitWidget) {
        // Check if clicking on a transform handle
        const transformHandle = this.getTransformHandleAtPoint(
          point,
          hitWidget,
        );
        if (transformHandle) {
          return this.handleTransformHandleClick(transformHandle, point);
        }

        // Handle widget selection
        this.handleWidgetSelection(hitWidget, modifiers);

        // If widget is selected, start dragging
        if (this.isSelected(hitWidget.id)) {
          return {
            nextState: "dragging",
            context: {
              startPosition: point,
              currentPosition: point,
              initialWidgetPositions: this.getInitialWidgetPositions(),
            },
          };
        }
      } else {
        // Clicked on canvas - start area selection or clear selection
        if (!modifiers.shift && !modifiers.meta && !modifiers.ctrl) {
          this.clearSelection();
        }

        return {
          nextState: "areaSelect",
          context: {
            startPosition: point,
            currentPosition: point,
            selectionBox: {
              x: point.x,
              y: point.y,
              width: 0,
              height: 0,
            },
          },
        };
      }
    }

    return null;
  }

  onMouseMove(
    event: Extract<StateMachineEvent, { type: "mousemove" }>,
  ): StateTransition | null {
    // Update hover state
    const hitWidget = this.getWidgetAtPoint(event.point);
    this.setHover(hitWidget?.id || null);

    // Update cursor based on what's under the mouse
    const cursor = this.getCursorForPoint(event.point, hitWidget);
    if (cursor !== this.cursor) {
      this.callbacks.onCursorChange(cursor);
    }

    return null;
  }

  onKeyDown(
    event: Extract<StateMachineEvent, { type: "keydown" }>,
  ): StateTransition | null {
    // Space key - enter hand tool mode
    if (event.key === " ") {
      return {
        nextState: "panning",
        context: {
          previousState: "idle",
        },
      };
    }

    // Handle other keyboard shortcuts here if needed
    return super.onKeyDown(event);
  }

  onWheel(
    event: Extract<StateMachineEvent, { type: "wheel" }>,
  ): StateTransition | null {
    // Handle zoom and pan
    if (event.modifiers.ctrl || event.modifiers.meta) {
      // Zoom
      const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
      const newScale = Math.max(
        0.01,
        Math.min(100, this.context.canvasTransform.scale * zoomFactor),
      );

      // Calculate new offset to zoom towards the screen point
      const scaleRatio = newScale / this.context.canvasTransform.scale;
      const newTransform = {
        x:
          event.screenPoint.x -
          (event.screenPoint.x - this.context.canvasTransform.x) * scaleRatio,
        y:
          event.screenPoint.y -
          (event.screenPoint.y - this.context.canvasTransform.y) * scaleRatio,
        scale: newScale,
      };

      this.updateContext({ canvasTransform: newTransform });
      this.callbacks.onCanvasTransform(newTransform);
    } else {
      // Pan
      const newTransform = {
        ...this.context.canvasTransform,
        x: this.context.canvasTransform.x - event.deltaX,
        y: this.context.canvasTransform.y - event.deltaY,
      };

      this.updateContext({ canvasTransform: newTransform });
      this.callbacks.onCanvasTransform(newTransform);
    }

    return { nextState: "idle", preventDefault: true };
  }

  private handleWidgetSelection(
    widget: import("../../../types/canvas").Widget,
    modifiers: import("../../../types/canvas").KeyModifiers,
  ): void {
    if (modifiers.meta || modifiers.ctrl) {
      // Toggle selection
      this.selectWidget(widget.id, true);
    } else if (modifiers.shift) {
      // Add to selection
      if (!this.isSelected(widget.id)) {
        this.selectWidget(widget.id, true);
      }
    } else {
      // Single select
      this.selectWidget(widget.id, false);
    }
  }

  private getTransformHandleAtPoint(
    point: { x: number; y: number },
    widget: import("../../../types/canvas").Widget,
  ): import("../types").TransformHandle | null {
    // Only show transform handles for selected widgets
    if (!this.isSelected(widget.id)) {
      return null;
    }

    const handleSize = 8;
    const handleOffset = handleSize / 2;

    // Define handle positions
    const handles = [
      {
        type: "resize" as const,
        position: "nw" as const,
        x: widget.x - handleOffset,
        y: widget.y - handleOffset,
        cursor: "nw-resize",
      },
      {
        type: "resize" as const,
        position: "n" as const,
        x: widget.x + widget.width / 2 - handleOffset,
        y: widget.y - handleOffset,
        cursor: "n-resize",
      },
      {
        type: "resize" as const,
        position: "ne" as const,
        x: widget.x + widget.width - handleOffset,
        y: widget.y - handleOffset,
        cursor: "ne-resize",
      },
      {
        type: "resize" as const,
        position: "e" as const,
        x: widget.x + widget.width - handleOffset,
        y: widget.y + widget.height / 2 - handleOffset,
        cursor: "e-resize",
      },
      {
        type: "resize" as const,
        position: "se" as const,
        x: widget.x + widget.width - handleOffset,
        y: widget.y + widget.height - handleOffset,
        cursor: "se-resize",
      },
      {
        type: "resize" as const,
        position: "s" as const,
        x: widget.x + widget.width / 2 - handleOffset,
        y: widget.y + widget.height - handleOffset,
        cursor: "s-resize",
      },
      {
        type: "resize" as const,
        position: "sw" as const,
        x: widget.x - handleOffset,
        y: widget.y + widget.height - handleOffset,
        cursor: "sw-resize",
      },
      {
        type: "resize" as const,
        position: "w" as const,
        x: widget.x - handleOffset,
        y: widget.y + widget.height / 2 - handleOffset,
        cursor: "w-resize",
      },
      {
        type: "rotate" as const,
        position: "rotation" as const,
        x: widget.x + widget.width / 2 - handleOffset,
        y: widget.y - 30,
        cursor: "grab",
      },
    ];

    // Check if point is within any handle
    for (const handle of handles) {
      if (
        point.x >= handle.x &&
        point.x <= handle.x + handleSize &&
        point.y >= handle.y &&
        point.y <= handle.y + handleSize
      ) {
        return {
          type: handle.type,
          position: handle.position,
          cursor: handle.cursor,
          widgetId: widget.id,
        };
      }
    }

    return null;
  }

  private handleTransformHandleClick(
    handle: import("../types").TransformHandle,
    point: { x: number; y: number },
  ): StateTransition {
    if (handle.type === "resize") {
      return {
        nextState: "resizing",
        context: {
          startPosition: point,
          currentPosition: point,
          transformHandle: handle,
          transformOrigin: this.getTransformOrigin(handle),
        },
      };
    }
    if (handle.type === "rotate") {
      return {
        nextState: "rotating",
        context: {
          startPosition: point,
          currentPosition: point,
          transformHandle: handle,
          transformOrigin: this.getTransformOrigin(handle),
        },
      };
    }

    return { nextState: "idle" };
  }

  private getTransformOrigin(handle: import("../types").TransformHandle): {
    x: number;
    y: number;
  } {
    const widget = this.context.widgets.find((w) => w.id === handle.widgetId);
    if (!widget) return { x: 0, y: 0 };

    // For resize, origin is opposite corner/edge
    // For rotate, origin is center
    if (handle.type === "rotate") {
      return {
        x: widget.x + widget.width / 2,
        y: widget.y + widget.height / 2,
      };
    }

    // Resize origin mapping
    const originMap: Record<string, { x: number; y: number }> = {
      nw: { x: widget.x + widget.width, y: widget.y + widget.height },
      n: { x: widget.x + widget.width / 2, y: widget.y + widget.height },
      ne: { x: widget.x, y: widget.y + widget.height },
      e: { x: widget.x, y: widget.y + widget.height / 2 },
      se: { x: widget.x, y: widget.y },
      s: { x: widget.x + widget.width / 2, y: widget.y },
      sw: { x: widget.x + widget.width, y: widget.y },
      w: { x: widget.x + widget.width, y: widget.y + widget.height / 2 },
    };

    return originMap[handle.position] || { x: widget.x, y: widget.y };
  }

  private getCursorForPoint(
    point: { x: number; y: number },
    hitWidget?: import("../../../types/canvas").Widget,
  ): string {
    if (hitWidget && this.isSelected(hitWidget.id)) {
      const handle = this.getTransformHandleAtPoint(point, hitWidget);
      if (handle) {
        return handle.cursor;
      }
      return "move";
    }
    return "default";
  }

  private getInitialWidgetPositions(): Map<string, { x: number; y: number }> {
    const positions = new Map<string, { x: number; y: number }>();

    for (const widgetId of this.context.selectedIds) {
      const widget = this.context.widgets.find((w) => w.id === widgetId);
      if (widget) {
        positions.set(widgetId, { x: widget.x, y: widget.y });
      }
    }

    return positions;
  }
}
