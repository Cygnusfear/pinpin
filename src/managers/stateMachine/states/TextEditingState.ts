import { BaseState } from '../BaseState';
import { 
  StateMachineEvent, 
  StateTransition, 
  InteractionStateName 
} from '../types';

export class TextEditingState extends BaseState {
  get name(): InteractionStateName {
    return 'textEditing';
  }

  get cursor(): string {
    return 'text';
  }

  onMouseDown(event: Extract<StateMachineEvent, { type: 'mousedown' }>): StateTransition | null {
    // Check if clicking outside the text widget being edited
    const editingWidget = this.getEditingWidget();
    if (!editingWidget) {
      return { nextState: 'idle' };
    }

    const hitWidget = this.getWidgetAtPoint(event.point);
    if (!hitWidget || hitWidget.id !== editingWidget.id) {
      // Clicked outside - exit text editing
      return { nextState: 'idle' };
    }

    return null;
  }

  onKeyDown(event: Extract<StateMachineEvent, { type: 'keydown' }>): StateTransition | null {
    if (event.key === 'Escape') {
      // Exit text editing mode
      return { nextState: 'idle' };
    }

    // Handle text editing keys here
    // For now, we'll just pass through to the widget's text editing logic
    return null;
  }

  private getEditingWidget(): import('../../../types/canvas').Widget | null {
    // In a real implementation, you'd track which widget is being edited
    // For now, we'll assume the first selected text widget
    const selectedWidgets = this.context.widgets.filter(w => 
      this.context.selectedIds.includes(w.id) && w.type === 'note'
    );
    
    return selectedWidgets[0] || null;
  }
}