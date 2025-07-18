import { 
  StateMachineEvent, 
  StateContext, 
  StateTransition, 
  InteractionStateName,
  StateMachineCallbacks 
} from './types';

export abstract class BaseState {
  protected context: StateContext;
  protected callbacks: StateMachineCallbacks;

  constructor(context: StateContext, callbacks: StateMachineCallbacks) {
    this.context = context;
    this.callbacks = callbacks;
  }

  // Abstract methods that each state must implement
  abstract get name(): InteractionStateName;
  abstract get cursor(): string;

  // Event handlers - states can override these as needed
  onEnter(fromState?: InteractionStateName): void {
    // Default implementation - update cursor
    this.callbacks.onCursorChange(this.cursor);
  }

  onExit(toState?: InteractionStateName): void {
    // Default implementation - cleanup if needed
  }

  onMouseDown(event: Extract<StateMachineEvent, { type: 'mousedown' }>): StateTransition | null {
    return null; // No transition by default
  }

  onMouseMove(event: Extract<StateMachineEvent, { type: 'mousemove' }>): StateTransition | null {
    return null;
  }

  onMouseUp(event: Extract<StateMachineEvent, { type: 'mouseup' }>): StateTransition | null {
    return null;
  }

  onKeyDown(event: Extract<StateMachineEvent, { type: 'keydown' }>): StateTransition | null {
    // Default escape behavior - return to idle
    if (event.key === 'Escape') {
      return { nextState: 'idle' };
    }
    return null;
  }

  onKeyUp(event: Extract<StateMachineEvent, { type: 'keyup' }>): StateTransition | null {
    return null;
  }

  onWheel(event: Extract<StateMachineEvent, { type: 'wheel' }>): StateTransition | null {
    return null;
  }

  onContextMenu(event: Extract<StateMachineEvent, { type: 'contextmenu' }>): StateTransition | null {
    return null;
  }

  // Utility methods for states
  protected updateContext(updates: Partial<StateContext>): void {
    Object.assign(this.context, updates);
  }

  protected getWidgetAtPoint(point: { x: number; y: number }): import('../../types/canvas').Widget | undefined {
    // Find the topmost widget at the given point
    const sortedWidgets = [...this.context.widgets].sort((a, b) => b.zIndex - a.zIndex);

    for (const widget of sortedWidgets) {
      if (this.isPointInWidget(point, widget)) {
        return widget;
      }
    }

    return undefined;
  }

  protected isPointInWidget(point: { x: number; y: number }, widget: import('../../types/canvas').Widget): boolean {
    return (
      point.x >= widget.x &&
      point.x <= widget.x + widget.width &&
      point.y >= widget.y &&
      point.y <= widget.y + widget.height
    );
  }

  protected isSelected(widgetId: string): boolean {
    return this.context.selectedIds.includes(widgetId);
  }

  protected selectWidget(widgetId: string, additive = false): void {
    let newSelection: string[];
    
    if (additive) {
      newSelection = this.context.selectedIds.includes(widgetId)
        ? this.context.selectedIds.filter(id => id !== widgetId)
        : [...this.context.selectedIds, widgetId];
    } else {
      newSelection = [widgetId];
    }

    this.updateContext({ selectedIds: newSelection });
    this.callbacks.onSelectionChange(newSelection);
  }

  protected clearSelection(): void {
    this.updateContext({ selectedIds: [] });
    this.callbacks.onSelectionChange([]);
  }

  protected setHover(widgetId: string | null): void {
    if (this.context.hoveredId !== widgetId) {
      this.updateContext({ hoveredId: widgetId });
      this.callbacks.onHoverChange(widgetId);
    }
  }

  protected calculateDelta(from: { x: number; y: number }, to: { x: number; y: number }): { x: number; y: number } {
    return {
      x: to.x - from.x,
      y: to.y - from.y
    };
  }

  protected constrainToAxes(delta: { x: number; y: number }): { x: number; y: number } {
    const absX = Math.abs(delta.x);
    const absY = Math.abs(delta.y);

    if (absX > absY * 2) {
      // Horizontal movement
      return { x: delta.x, y: 0 };
    } else if (absY > absX * 2) {
      // Vertical movement
      return { x: 0, y: delta.y };
    } else {
      // Diagonal movement - make it exactly 45 degrees
      const sign = Math.sign(delta.x * delta.y);
      const magnitude = Math.max(absX, absY);
      return {
        x: Math.sign(delta.x) * magnitude,
        y: sign * Math.sign(delta.x) * magnitude
      };
    }
  }
}