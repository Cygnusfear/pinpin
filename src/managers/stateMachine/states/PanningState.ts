import { BaseState } from "../BaseState";
import type {
  InteractionStateName,
  StateMachineEvent,
  StateTransition,
} from "../types";

export class PanningState extends BaseState {
  get name(): InteractionStateName {
    return "panning";
  }

  get cursor(): string {
    return "grab";
  }

  onEnter(fromState?: InteractionStateName): void {
    super.onEnter(fromState);

    // Store the previous state if not already set
    if (!this.context.previousState && fromState) {
      this.updateContext({ previousState: fromState });
    }

    // Update cursor to grabbing when actively panning
    this.callbacks.onCursorChange("grab");
  }

  onMouseDown(
    event: Extract<StateMachineEvent, { type: "mousedown" }>,
  ): StateTransition | null {
    // Start panning on any mouse button (but typically middle mouse or left with space)
    if (event.button === 0 || event.button === 1) {
      this.updateContext({
        startPosition: event.screenPoint,
        currentPosition: event.screenPoint,
      });

      this.callbacks.onCursorChange("grabbing");
      return null;
    }

    return null;
  }

  onMouseMove(
    event: Extract<StateMachineEvent, { type: "mousemove" }>,
  ): StateTransition | null {
    if (!this.context.startPosition) return null;

    const delta = this.calculateDelta(
      this.context.startPosition,
      event.screenPoint,
    );

    // Only update if there's meaningful movement to prevent spam
    if (Math.abs(delta.x) < 1 && Math.abs(delta.y) < 1) {
      return null;
    }

    // Update canvas transform
    const newTransform = {
      ...this.context.canvasTransform,
      x: this.context.canvasTransform.x + delta.x,
      y: this.context.canvasTransform.y + delta.y,
    };

    this.updateContext({
      canvasTransform: newTransform,
      startPosition: event.screenPoint, // Update start position for continuous panning
      currentPosition: event.screenPoint,
    });

    this.callbacks.onCanvasTransform(newTransform);

    return null;
  }

  onMouseUp(
    _event: Extract<StateMachineEvent, { type: "mouseup" }>,
  ): StateTransition | null {
    // End panning and return to previous state
    const previousState = this.context.previousState || "idle";

    return {
      nextState: previousState,
      context: {
        startPosition: undefined,
        currentPosition: undefined,
        previousState: undefined,
      },
    };
  }

  onKeyUp(
    event: Extract<StateMachineEvent, { type: "keyup" }>,
  ): StateTransition | null {
    // If space key is released, return to previous state
    if (event.key === " ") {
      const previousState = this.context.previousState || "idle";

      return {
        nextState: previousState,
        context: {
          startPosition: undefined,
          currentPosition: undefined,
          previousState: undefined,
        },
      };
    }

    return null;
  }

  onKeyDown(
    event: Extract<StateMachineEvent, { type: "keydown" }>,
  ): StateTransition | null {
    if (event.key === "Escape") {
      // Cancel panning and return to previous state
      const previousState = this.context.previousState || "idle";

      return {
        nextState: previousState,
        context: {
          startPosition: undefined,
          currentPosition: undefined,
          previousState: undefined,
        },
      };
    }

    return super.onKeyDown(event);
  }

  onWheel(
    event: Extract<StateMachineEvent, { type: "wheel" }>,
  ): StateTransition | null {
    // Handle zoom while panning
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
      // Pan with wheel
      const newTransform = {
        ...this.context.canvasTransform,
        x: this.context.canvasTransform.x - event.deltaX,
        y: this.context.canvasTransform.y - event.deltaY,
      };

      this.updateContext({ canvasTransform: newTransform });
      this.callbacks.onCanvasTransform(newTransform);
    }

    return { nextState: "panning", preventDefault: true };
  }
}
