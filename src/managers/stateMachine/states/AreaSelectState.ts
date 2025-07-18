import { BaseState } from '../BaseState';
import { 
  StateMachineEvent, 
  StateTransition, 
  InteractionStateName 
} from '../types';

export class AreaSelectState extends BaseState {
  get name(): InteractionStateName {
    return 'areaSelect';
  }

  get cursor(): string {
    return 'crosshair';
  }

  onMouseMove(event: Extract<StateMachineEvent, { type: 'mousemove' }>): StateTransition | null {
    if (!this.context.startPosition) return null;

    const { point } = event;
    const startPos = this.context.startPosition;

    // Update selection box
    const selectionBox = {
      x: Math.min(startPos.x, point.x),
      y: Math.min(startPos.y, point.y),
      width: Math.abs(point.x - startPos.x),
      height: Math.abs(point.y - startPos.y)
    };

    this.updateContext({ 
      currentPosition: point,
      selectionBox 
    });

    return null;
  }

  onMouseUp(event: Extract<StateMachineEvent, { type: 'mouseup' }>): StateTransition | null {
    if (event.button !== 0) return null; // Only handle left mouse button

    // Complete area selection
    this.completeAreaSelection(event.modifiers.meta || event.modifiers.ctrl);

    return {
      nextState: 'idle',
      context: {
        startPosition: undefined,
        currentPosition: undefined,
        selectionBox: undefined
      }
    };
  }

  onKeyDown(event: Extract<StateMachineEvent, { type: 'keydown' }>): StateTransition | null {
    if (event.key === 'Escape') {
      // Cancel area selection
      return {
        nextState: 'idle',
        context: {
          startPosition: undefined,
          currentPosition: undefined,
          selectionBox: undefined
        }
      };
    }

    return super.onKeyDown(event);
  }

  private completeAreaSelection(additive: boolean): void {
    if (!this.context.selectionBox) return;

    const { selectionBox } = this.context;
    
    // Find widgets that intersect with the selection box
    const selectedWidgetIds: string[] = [];
    
    for (const widget of this.context.widgets) {
      if (this.isWidgetInSelectionBox(widget, selectionBox)) {
        selectedWidgetIds.push(widget.id);
      }
    }

    // Update selection
    let newSelection: string[];
    
    if (additive) {
      // Add to existing selection (toggle widgets that are already selected)
      newSelection = [...this.context.selectedIds];
      
      for (const widgetId of selectedWidgetIds) {
        const index = newSelection.indexOf(widgetId);
        if (index >= 0) {
          newSelection.splice(index, 1); // Remove if already selected
        } else {
          newSelection.push(widgetId); // Add if not selected
        }
      }
    } else {
      // Replace selection
      newSelection = selectedWidgetIds;
    }

    this.updateContext({ selectedIds: newSelection });
    this.callbacks.onSelectionChange(newSelection);
  }

  private isWidgetInSelectionBox(
    widget: import('../../../types/canvas').Widget, 
    selectionBox: { x: number; y: number; width: number; height: number }
  ): boolean {
    // Check if widget intersects with selection box
    return !(
      widget.x > selectionBox.x + selectionBox.width ||
      widget.x + widget.width < selectionBox.x ||
      widget.y > selectionBox.y + selectionBox.height ||
      widget.y + widget.height < selectionBox.y
    );
  }
}