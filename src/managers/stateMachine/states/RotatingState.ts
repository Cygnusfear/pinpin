import { BaseState } from '../BaseState';
import { 
  StateMachineEvent, 
  StateTransition, 
  InteractionStateName 
} from '../types';

export class RotatingState extends BaseState {
  get name(): InteractionStateName {
    return 'rotating';
  }

  get cursor(): string {
    return 'grab';
  }

  onMouseMove(event: Extract<StateMachineEvent, { type: 'mousemove' }>): StateTransition | null {
    if (!this.context.startPosition || !this.context.transformHandle || !this.context.transformOrigin) {
      return null;
    }

    const { point, modifiers } = event;
    const { transformOrigin } = this.context;
    
    // Find the widget being rotated
    const widget = this.context.widgets.find(w => w.id === this.context.transformHandle!.widgetId);
    if (!widget) return null;

    // Calculate rotation angle
    const startAngle = this.calculateAngle(transformOrigin, this.context.startPosition);
    const currentAngle = this.calculateAngle(transformOrigin, point);
    let deltaAngle = currentAngle - startAngle;

    // Snap to 15-degree increments if shift is held
    if (modifiers.shift) {
      const snapIncrement = 15; // degrees
      deltaAngle = Math.round(deltaAngle / snapIncrement) * snapIncrement;
    }

    // Calculate new rotation (in degrees)
    const currentRotation = widget.rotation || 0;
    let newRotation = currentRotation + deltaAngle;

    // Normalize rotation to 0-360 degrees
    newRotation = ((newRotation % 360) + 360) % 360;

    // Update widget rotation
    this.callbacks.onWidgetUpdate(widget.id, {
      rotation: newRotation
    });

    this.updateContext({ currentPosition: point });

    return null;
  }

  onMouseUp(event: Extract<StateMachineEvent, { type: 'mouseup' }>): StateTransition | null {
    if (event.button !== 0) return null;

    // Complete rotation operation
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
      // Cancel rotation - restore original rotation
      this.restoreOriginalRotation();
      
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

  private calculateAngle(center: { x: number; y: number }, point: { x: number; y: number }): number {
    const deltaX = point.x - center.x;
    const deltaY = point.y - center.y;
    
    // Calculate angle in radians, then convert to degrees
    const angleRad = Math.atan2(deltaY, deltaX);
    const angleDeg = (angleRad * 180) / Math.PI;
    
    // Normalize to 0-360 degrees
    return ((angleDeg % 360) + 360) % 360;
  }

  private restoreOriginalRotation(): void {
    if (!this.context.transformHandle) return;

    const widget = this.context.widgets.find(w => w.id === this.context.transformHandle!.widgetId);
    if (!widget) return;

    // In a real implementation, you'd store the original rotation when entering the state
    // For now, we'll just keep the current rotation (no restoration)
    console.log('Rotation cancelled - would restore original rotation');
  }
}