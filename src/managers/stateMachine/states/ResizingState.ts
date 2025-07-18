import { BaseState } from '../BaseState';
import { 
  StateMachineEvent, 
  StateTransition, 
  InteractionStateName 
} from '../types';

export class ResizingState extends BaseState {
  get name(): InteractionStateName {
    return 'resizing';
  }

  get cursor(): string {
    return this.context.transformHandle?.cursor || 'nw-resize';
  }

  onMouseMove(event: Extract<StateMachineEvent, { type: 'mousemove' }>): StateTransition | null {
    if (!this.context.startPosition || !this.context.transformHandle || !this.context.transformOrigin) {
      return null;
    }

    const { point, modifiers } = event;
    const { transformHandle, transformOrigin } = this.context;
    
    // Find the widget being resized
    const widget = this.context.widgets.find(w => w.id === transformHandle.widgetId);
    if (!widget) return null;

    // Calculate new dimensions based on handle position and mouse movement
    const newBounds = this.calculateNewBounds(
      widget,
      transformHandle.position,
      transformOrigin,
      point,
      modifiers.shift // Maintain aspect ratio
    );

    // Apply minimum size constraints
    const minSize = 10;
    if (newBounds.width < minSize || newBounds.height < minSize) {
      return null;
    }

    // Update widget
    this.callbacks.onWidgetUpdate(widget.id, {
      x: newBounds.x,
      y: newBounds.y,
      width: newBounds.width,
      height: newBounds.height
    });

    this.updateContext({ currentPosition: point });

    return null;
  }

  onMouseUp(event: Extract<StateMachineEvent, { type: 'mouseup' }>): StateTransition | null {
    if (event.button !== 0) return null;

    // Complete resize operation
    return {
      nextState: 'idle',
      context: {
        startPosition: undefined,
        currentPosition: undefined,
        transformHandle: undefined,
        transformOrigin: undefined
      }
    };
  }

  onKeyDown(event: Extract<StateMachineEvent, { type: 'keydown' }>): StateTransition | null {
    if (event.key === 'Escape') {
      // Cancel resize - restore original size
      this.restoreOriginalSize();
      
      return {
        nextState: 'idle',
        context: {
          startPosition: undefined,
          currentPosition: undefined,
          transformHandle: undefined,
          transformOrigin: undefined
        }
      };
    }

    return super.onKeyDown(event);
  }

  private calculateNewBounds(
    widget: import('../../../types/canvas').Widget,
    handlePosition: string,
    origin: { x: number; y: number },
    mousePoint: { x: number; y: number },
    maintainAspectRatio: boolean
  ): { x: number; y: number; width: number; height: number } {
    
    let newBounds = {
      x: widget.x,
      y: widget.y,
      width: widget.width,
      height: widget.height
    };

    const originalAspectRatio = widget.width / widget.height;

    switch (handlePosition) {
      case 'nw':
        newBounds.width = origin.x - mousePoint.x;
        newBounds.height = origin.y - mousePoint.y;
        newBounds.x = mousePoint.x;
        newBounds.y = mousePoint.y;
        break;
      case 'n':
        newBounds.height = origin.y - mousePoint.y;
        newBounds.y = mousePoint.y;
        break;
      case 'ne':
        newBounds.width = mousePoint.x - origin.x;
        newBounds.height = origin.y - mousePoint.y;
        newBounds.y = mousePoint.y;
        break;
      case 'e':
        newBounds.width = mousePoint.x - origin.x;
        break;
      case 'se':
        newBounds.width = mousePoint.x - origin.x;
        newBounds.height = mousePoint.y - origin.y;
        break;
      case 's':
        newBounds.height = mousePoint.y - origin.y;
        break;
      case 'sw':
        newBounds.width = origin.x - mousePoint.x;
        newBounds.height = mousePoint.y - origin.y;
        newBounds.x = mousePoint.x;
        break;
      case 'w':
        newBounds.width = origin.x - mousePoint.x;
        newBounds.x = mousePoint.x;
        break;
    }

    // Maintain aspect ratio if shift is held
    if (maintainAspectRatio) {
      const isCornerHandle = ['nw', 'ne', 'se', 'sw'].includes(handlePosition);
      
      if (isCornerHandle) {
        // For corner handles, adjust both dimensions to maintain aspect ratio
        const newAspectRatio = newBounds.width / newBounds.height;
        
        if (newAspectRatio > originalAspectRatio) {
          // Width is too large, adjust it
          newBounds.width = newBounds.height * originalAspectRatio;
        } else {
          // Height is too large, adjust it
          newBounds.height = newBounds.width / originalAspectRatio;
        }

        // Adjust position for handles that move the origin
        if (handlePosition === 'nw') {
          newBounds.x = origin.x - newBounds.width;
          newBounds.y = origin.y - newBounds.height;
        } else if (handlePosition === 'ne') {
          newBounds.y = origin.y - newBounds.height;
        } else if (handlePosition === 'sw') {
          newBounds.x = origin.x - newBounds.width;
        }
      }
    }

    // Ensure positive dimensions
    if (newBounds.width < 0) {
      newBounds.x += newBounds.width;
      newBounds.width = Math.abs(newBounds.width);
    }
    if (newBounds.height < 0) {
      newBounds.y += newBounds.height;
      newBounds.height = Math.abs(newBounds.height);
    }

    return newBounds;
  }

  private restoreOriginalSize(): void {
    if (!this.context.transformHandle) return;

    const widget = this.context.widgets.find(w => w.id === this.context.transformHandle!.widgetId);
    if (!widget) return;

    // In a real implementation, you'd store the original size when entering the state
    // For now, we'll just keep the current size (no restoration)
    console.log('Resize cancelled - would restore original size');
  }
}