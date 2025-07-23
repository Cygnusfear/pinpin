import { BaseState } from "../BaseState";
import type {
  InteractionStateName,
  StateMachineEvent,
  StateTransition,
} from "../types";

export class DraggingState extends BaseState {
  private snapThreshold = 8; // pixels
  private snapEnabled = true;

  get name(): InteractionStateName {
    return "dragging";
  }

  get cursor(): string {
    return "grabbing";
  }

  onMouseMove(
    event: Extract<StateMachineEvent, { type: "mousemove" }>,
  ): StateTransition | null {
    if (!this.context.startPosition || !this.context.initialWidgetPositions) {
      return null;
    }

    const { point, modifiers } = event;
    let delta = this.calculateDelta(this.context.startPosition, point);

    // Apply constraints if shift is held
    if (modifiers.shift) {
      delta = this.constrainToAxes(delta);
    }

    // Apply snapping if enabled and meta/cmd is not held
    if (this.snapEnabled && !modifiers.meta && !modifiers.ctrl) {
      delta = this.applySnapping(delta);
    }

    // Update widget positions
    this.updateWidgetPositions(delta);

    this.updateContext({ currentPosition: point });

    return null;
  }

  onMouseUp(
    event: Extract<StateMachineEvent, { type: "mouseup" }>,
  ): StateTransition | null {
    if (event.button !== 0) return null; // Only handle left mouse button

    // Complete the drag operation
    return {
      nextState: "idle",
      context: {
        startPosition: undefined,
        currentPosition: undefined,
        initialWidgetPositions: undefined,
      },
    };
  }

  onKeyDown(
    event: Extract<StateMachineEvent, { type: "keydown" }>,
  ): StateTransition | null {
    if (event.key === "Escape") {
      // Cancel drag - restore original positions
      this.restoreOriginalPositions();

      return {
        nextState: "idle",
        context: {
          startPosition: undefined,
          currentPosition: undefined,
          initialWidgetPositions: undefined,
        },
      };
    }

    return super.onKeyDown(event);
  }

  private updateWidgetPositions(delta: { x: number; y: number }): void {
    if (!this.context.initialWidgetPositions) return;

    const updates: Array<{
      id: string;
      updates: Partial<import("../../../types/canvas").Widget>;
    }> = [];

    for (const [widgetId, initialPos] of this.context.initialWidgetPositions) {
      updates.push({
        id: widgetId,
        updates: {
          x: initialPos.x + delta.x,
          y: initialPos.y + delta.y,
        },
      });
    }

    this.callbacks.onWidgetsUpdate(updates);
  }

  private restoreOriginalPositions(): void {
    if (!this.context.initialWidgetPositions) return;

    const updates: Array<{
      id: string;
      updates: Partial<import("../../../types/canvas").Widget>;
    }> = [];

    for (const [widgetId, initialPos] of this.context.initialWidgetPositions) {
      updates.push({
        id: widgetId,
        updates: {
          x: initialPos.x,
          y: initialPos.y,
        },
      });
    }

    this.callbacks.onWidgetsUpdate(updates);
  }

  private applySnapping(delta: { x: number; y: number }): {
    x: number;
    y: number;
  } {
    if (
      !this.context.initialWidgetPositions ||
      this.context.selectedIds.length === 0
    ) {
      return delta;
    }

    // Get the first selected widget for snapping calculations
    const firstWidgetId = this.context.selectedIds[0];
    const initialPos = this.context.initialWidgetPositions.get(firstWidgetId);
    if (!initialPos) return delta;

    const newPos = {
      x: initialPos.x + delta.x,
      y: initialPos.y + delta.y,
    };

    const snapTargets = this.generateSnapTargets();
    const snapDelta = { ...delta };

    // Check horizontal snaps
    let bestDistance = this.snapThreshold;
    for (const target of snapTargets) {
      if (target.orientation === "horizontal") {
        const distance = Math.abs(newPos.y - target.position.y);
        if (distance < bestDistance * target.strength) {
          bestDistance = distance;
          snapDelta.y = target.position.y - initialPos.y;
        }
      }
    }

    // Check vertical snaps
    bestDistance = this.snapThreshold;
    for (const target of snapTargets) {
      if (target.orientation === "vertical") {
        const distance = Math.abs(newPos.x - target.position.x);
        if (distance < bestDistance * target.strength) {
          bestDistance = distance;
          snapDelta.x = target.position.x - initialPos.x;
        }
      }
    }

    return snapDelta;
  }

  private generateSnapTargets(): Array<{
    position: { x: number; y: number };
    orientation: "horizontal" | "vertical";
    strength: number;
  }> {
    const targets: Array<{
      position: { x: number; y: number };
      orientation: "horizontal" | "vertical";
      strength: number;
    }> = [];
    const excludeSet = new Set(this.context.selectedIds);

    // Add widget snap targets
    for (const widget of this.context.widgets) {
      if (excludeSet.has(widget.id)) continue;

      // Add edge snap targets
      targets.push(
        // Left edge
        {
          position: { x: widget.x, y: widget.y + widget.height / 2 },
          orientation: "vertical",
          strength: 1,
        },
        // Right edge
        {
          position: {
            x: widget.x + widget.width,
            y: widget.y + widget.height / 2,
          },
          orientation: "vertical",
          strength: 1,
        },
        // Top edge
        {
          position: { x: widget.x + widget.width / 2, y: widget.y },
          orientation: "horizontal",
          strength: 1,
        },
        // Bottom edge
        {
          position: {
            x: widget.x + widget.width / 2,
            y: widget.y + widget.height,
          },
          orientation: "horizontal",
          strength: 1,
        },
        // Center lines
        {
          position: {
            x: widget.x + widget.width / 2,
            y: widget.y + widget.height / 2,
          },
          orientation: "vertical",
          strength: 0.8,
        },
        {
          position: {
            x: widget.x + widget.width / 2,
            y: widget.y + widget.height / 2,
          },
          orientation: "horizontal",
          strength: 0.8,
        },
      );
    }

    // Add grid snap targets (every 10 pixels)
    const gridSize = 10;
    for (let x = 0; x <= 2000; x += gridSize) {
      targets.push({
        position: { x, y: 0 },
        orientation: "vertical",
        strength: 0.3,
      });
    }
    for (let y = 0; y <= 2000; y += gridSize) {
      targets.push({
        position: { x: 0, y },
        orientation: "horizontal",
        strength: 0.3,
      });
    }

    return targets;
  }
}
