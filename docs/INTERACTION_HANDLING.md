# Interaction Handling Guide

This guide covers how to handle user interactions in Pinboard plugins, including the state machine architecture, event handling patterns, and widget interaction management.

## Table of Contents

1. [Overview](#overview)
2. [Interaction Architecture](#interaction-architecture)
3. [State Machine](#state-machine)
4. [Event Handling](#event-handling)
5. [Widget Interaction Patterns](#widget-interaction-patterns)
6. [Plugin Integration](#plugin-integration)
7. [Custom Interactions](#custom-interactions)
8. [Best Practices](#best-practices)
9. [Debugging Interactions](#debugging-interactions)

## Overview

The Pinboard interaction system is built around a centralized [`InteractionController`](../managers/InteractionController.ts:43) that manages all user interactions with widgets and the canvas. It uses a state machine architecture to handle complex interaction flows and provides consistent behavior across all widgets.

### Key Components

- **InteractionController**: Central controller managing all interactions
- **State Machine**: Handles interaction states and transitions
- **Selection Manager**: Manages widget selection and hover states
- **Drag Manager**: Handles drag and drop operations
- **Keyboard Manager**: Processes keyboard shortcuts and commands

## Interaction Architecture

### Controller Structure

```typescript
export interface InteractionCallbacks {
  onWidgetUpdate: (id: string, updates: Partial<HydratedWidget>) => void;
  onWidgetsUpdate: (updates: Array<{ id: string; updates: Partial<HydratedWidget> }>) => void;
  onWidgetRemove: (id: string) => void;
  onWidgetAdd: (widget: any) => void;
  onCanvasTransform: (transform: CanvasTransform) => void;
  onModeChange: (mode: InteractionMode) => void;
  onSelectionChange: (selectedIds: string[]) => void;
  onHoverChange: (hoveredId: string | null) => void;
}
```

The [`InteractionController`](../managers/InteractionController.ts:43) coordinates between multiple managers:

```typescript
export class InteractionController {
  private selectionManager: SelectionManager;
  private keyboardManager: KeyboardManager;
  private dragManager: DragManager;
  private stateMachine: StateMachine;

  constructor(callbacks: InteractionCallbacks) {
    // Initialize all managers and wire them together
  }
}
```

### Interaction Modes

The system supports various interaction modes mapped from state machine states:

```typescript
type InteractionMode = 
  | "select"        // Default selection mode
  | "area-select"   // Area selection
  | "drag"          // Dragging widgets
  | "hand"          // Panning canvas
  | "resize"        // Resizing widgets
  | "rotate"        // Rotating widgets
  | "text"          // Text editing
  | "zoom"          // Zooming
  | "draw"          // Drawing mode
  | "transform"     // Generic transform
  | "drop-target";  // Drop target mode
```

## State Machine

The interaction system uses a state machine to manage complex interaction flows. Each state handles specific user actions and can transition to other states.

### State Architecture

```typescript
export type InteractionStateName = 
  | "idle"          // No active interaction
  | "areaSelect"    // Area selection in progress
  | "dragging"      // Dragging widgets
  | "panning"       // Panning canvas
  | "resizing"      // Resizing widgets
  | "rotating"      // Rotating widgets
  | "textEditing";  // Text editing mode
```

### State Context

Each state operates on a shared context:

```typescript
export interface StateContext {
  widgets: HydratedWidget[];
  canvasTransform: CanvasTransform;
  selectedIds: string[];
  hoveredId: string | null;
  selectionBox?: BoundingBox;
  dragStartPosition?: Point;
  initialWidgetPositions?: Map<string, Point>;
}
```

### State Events

States respond to various events:

```typescript
export interface StateMachineEvent {
  type: 'mousedown' | 'mousemove' | 'mouseup' | 'keydown' | 'keyup' | 'wheel' | 'contextmenu';
  point?: Point;
  screenPoint?: Point;
  button?: number;
  key?: string;
  modifiers?: KeyModifiers;
  hitWidget?: HydratedWidget;
  deltaX?: number;
  deltaY?: number;
}
```

### Example State Implementation

```typescript
// Example: Idle state implementation
export class IdleState extends BaseState {
  enter(context: StateContext): void {
    console.log('Entering idle state');
  }

  handleMouseDown(event: StateMachineEvent, context: StateContext): StateTransition {
    const { point, modifiers, hitWidget } = event;

    if (hitWidget) {
      if (modifiers?.shift) {
        // Add to selection
        return {
          nextState: 'idle',
          actions: ['toggleSelection'],
        };
      } else {
        // Start dragging
        return {
          nextState: 'dragging',
          actions: ['selectWidget', 'startDrag'],
        };
      }
    } else {
      // Start area selection
      return {
        nextState: 'areaSelect',
        actions: ['clearSelection', 'startAreaSelect'],
      };
    }
  }

  handleKeyDown(event: StateMachineEvent, context: StateContext): StateTransition {
    if (event.key === ' ') {
      return {
        nextState: 'panning',
        actions: ['enablePanMode'],
      };
    }
    
    return { nextState: 'idle' };
  }
}
```

## Event Handling

### Widget Events Interface

Widgets receive event handlers through the [`WidgetEvents`](../types/widgets.ts:200) interface:

```typescript
export interface WidgetEvents {
  onUpdate: (updates: Partial<Widget>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onEdit: () => void;
  onConfigure: () => void;
  onSelect: () => void;
  onDeselect: () => void;
  onHover: () => void;
  onUnhover: () => void;
}
```

### Canvas Event Flow

1. **Event Capture**: Canvas element captures mouse/keyboard events
2. **Coordinate Translation**: Screen coordinates converted to canvas coordinates
3. **Hit Testing**: Determine which widget (if any) is at the interaction point
4. **State Machine Processing**: Event processed by current state
5. **Action Execution**: State machine actions trigger updates
6. **Callback Invocation**: Results propagated through callbacks

### Mouse Event Handling

```typescript
public handleMouseDown(event: MouseEvent): void {
  const canvasPoint = this.getCanvasPoint(event);
  const screenPoint = this.getScreenPoint(event);
  const modifiers = this.getModifiers(event);
  const hitWidget = this.getWidgetAtPoint(canvasPoint);

  // Create state machine event
  const stateMachineEvent: StateMachineEvent = {
    type: "mousedown",
    point: canvasPoint,
    screenPoint: screenPoint,
    button: event.button,
    modifiers: modifiers,
    hitWidget: hitWidget,
  };

  // Process through state machine
  const result = this.stateMachine.processEvent(stateMachineEvent);

  if (result.preventDefault) {
    event.preventDefault();
  }
  if (result.stopPropagation) {
    event.stopPropagation();
  }
}
```

### Keyboard Event Handling

The system provides keyboard shortcuts through the [`KeyboardManager`](../managers/KeyboardManager.ts):

```typescript
// Setup keyboard commands
private setupKeyboardCommands(): void {
  this.keyboardManager.registerCommand("selectAll", () => {
    this.selectionManager.selectAll(this.widgets);
  });

  this.keyboardManager.registerCommand("duplicate", () => {
    this.duplicateSelection();
  });

  this.keyboardManager.registerCommand("delete", () => {
    this.deleteSelection();
  });

  this.keyboardManager.registerCommand("copy", () => {
    this.copySelection();
  });

  this.keyboardManager.registerCommand("paste", () => {
    this.pasteSelection();
  });
}
```

## Widget Interaction Patterns

### Basic Widget Renderer

Here's how to implement basic interactions in your widget renderer:

```typescript
export const MyWidgetRenderer: React.FC<WidgetRendererProps<MyWidgetContent>> = ({
  widget,
  state,
  events,
}) => {
  // Handle basic widget events
  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent canvas deselection
    events.onSelect();
  }, [events]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    events.onEdit();
  }, [events]);

  const handleMouseEnter = useCallback(() => {
    events.onHover();
  }, [events]);

  const handleMouseLeave = useCallback(() => {
    events.onUnhover();
  }, [events]);

  // Render with interaction handlers
  return (
    <div
      className={`widget ${state.isSelected ? 'selected' : ''} ${state.isHovered ? 'hovered' : ''}`}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Widget content */}
    </div>
  );
};
```

### Editable Widget Pattern

For widgets that support inline editing:

```typescript
export const EditableWidgetRenderer: React.FC<WidgetRendererProps<NoteContent>> = ({
  widget,
  state,
  events,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");

  // Start editing on double-click or edit event
  const handleEdit = useCallback(() => {
    setEditValue(widget.content.data.content);
    setIsEditing(true);
  }, [widget.content.data.content]);

  // Save changes
  const handleSave = useCallback(() => {
    events.onUpdate({
      content: {
        ...widget.content,
        data: {
          ...widget.content.data,
          content: editValue,
        },
      },
    });
    setIsEditing(false);
  }, [editValue, events, widget.content]);

  // Cancel editing
  const handleCancel = useCallback(() => {
    setEditValue(widget.content.data.content);
    setIsEditing(false);
  }, [widget.content.data.content]);

  // Keyboard handling for editing
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleCancel();
    }
  }, [handleSave, handleCancel]);

  return (
    <div>
      {isEditing ? (
        <textarea
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          autoFocus
        />
      ) : (
        <div onDoubleClick={handleEdit}>
          {widget.content.data.content}
        </div>
      )}
    </div>
  );
};
```

### Custom Drag Behavior

For widgets with custom drag behavior:

```typescript
export const CustomDragWidget: React.FC<WidgetRendererProps<MyWidgetContent>> = ({
  widget,
  state,
  events,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<Point | null>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Only handle left mouse button
    if (e.button !== 0) return;

    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    
    // Prevent default canvas dragging
    e.stopPropagation();
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !dragStart) return;

    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;

    // Custom drag logic here
    events.onUpdate({
      x: widget.x + deltaX,
      y: widget.y + deltaY,
    });

    setDragStart({ x: e.clientX, y: e.clientY });
  }, [isDragging, dragStart, events, widget.x, widget.y]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setDragStart(null);
  }, []);

  // Global mouse event handlers for dragging
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div
      onMouseDown={handleMouseDown}
      style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
    >
      {/* Widget content */}
    </div>
  );
};
```

## Plugin Integration

### Registering Event Handlers

When creating widgets through factories, you can set up default event handling:

```typescript
export class MyWidgetFactory implements WidgetFactory<MyWidgetContent> {
  async create(data: any, position: Position): Promise<CreateWidgetInput> {
    // Create widget with interaction metadata
    return {
      type: this.type,
      x: position.x,
      y: position.y,
      width: 300,
      height: 200,
      content: data,
      metadata: {
        interactions: {
          clickToEdit: true,
          customDrag: false,
          contextMenu: true,
        },
      },
    };
  }

  getCapabilities(): WidgetCapabilities {
    return {
      canResize: true,
      canRotate: true,
      canEdit: true,        // Enables double-click to edit
      canConfigure: true,   // Enables configuration UI
      canGroup: true,
      canDuplicate: true,
      canExport: true,
      hasContextMenu: true, // Enables right-click menu
      hasToolbar: false,
      hasInspector: true,
    };
  }
}
```

### Custom Context Menu

Implement custom context menu for your widget:

```typescript
export const MyWidgetContextMenu: React.FC<WidgetContextMenuProps<MyWidgetContent>> = ({
  widget,
  position,
  onAction,
  onClose,
}) => {
  const menuItems = [
    { id: 'edit', label: 'Edit Content', icon: '✏️' },
    { id: 'duplicate', label: 'Duplicate', icon: '📋' },
    { id: 'export', label: 'Export', icon: '📤' },
    { id: 'delete', label: 'Delete', icon: '🗑️', danger: true },
  ];

  const handleItemClick = (actionId: string) => {
    onAction(actionId);
    onClose();
  };

  return (
    <div 
      className="context-menu"
      style={{ 
        position: 'fixed',
        left: position.x,
        top: position.y,
        zIndex: 1000,
      }}
    >
      {menuItems.map(item => (
        <button
          key={item.id}
          className={`context-menu-item ${item.danger ? 'danger' : ''}`}
          onClick={() => handleItemClick(item.id)}
        >
          <span className="icon">{item.icon}</span>
          <span className="label">{item.label}</span>
        </button>
      ))}
    </div>
  );
};

// Register context menu in your renderer definition
export const myWidgetRenderer = {
  type: "my-widget",
  component: MyWidgetRenderer,
  contextMenu: MyWidgetContextMenu,
};
```

### Clipboard Operations

Implement custom clipboard behavior:

```typescript
// In your widget renderer or factory
const handleCopy = useCallback(async () => {
  const exportData = {
    type: widget.type,
    content: widget.content.data,
    metadata: widget.metadata,
  };

  try {
    await navigator.clipboard.writeText(JSON.stringify(exportData));
    console.log('Widget copied to clipboard');
  } catch (error) {
    console.error('Failed to copy widget:', error);
  }
}, [widget]);

const handlePaste = useCallback(async () => {
  try {
    const clipboardText = await navigator.clipboard.readText();
    const pasteData = JSON.parse(clipboardText);
    
    if (pasteData.type === widget.type) {
      events.onUpdate({
        content: {
          ...widget.content,
          data: pasteData.content,
        },
      });
    }
  } catch (error) {
    console.error('Failed to paste widget:', error);
  }
}, [widget, events]);
```

## Custom Interactions

### Creating Custom Interaction Modes

For complex plugins that need custom interaction modes:

```typescript
// Custom interaction state for your plugin
export class CustomInteractionState extends BaseState {
  private startPoint: Point | null = null;

  enter(context: StateContext): void {
    console.log('Entering custom interaction mode');
    // Set custom cursor or UI state
  }

  exit(context: StateContext): void {
    console.log('Exiting custom interaction mode');
    this.startPoint = null;
  }

  handleMouseDown(event: StateMachineEvent, context: StateContext): StateTransition {
    this.startPoint = event.point!;
    
    return {
      nextState: 'customInteraction',
      actions: ['startCustomInteraction'],
    };
  }

  handleMouseMove(event: StateMachineEvent, context: StateContext): StateTransition {
    if (this.startPoint && event.point) {
      // Handle custom interaction logic
      const deltaX = event.point.x - this.startPoint.x;
      const deltaY = event.point.y - this.startPoint.y;
      
      // Apply custom transformation
      return {
        nextState: 'customInteraction',
        actions: [{ type: 'customTransform', payload: { deltaX, deltaY } }],
      };
    }
    
    return { nextState: 'customInteraction' };
  }

  handleMouseUp(event: StateMachineEvent, context: StateContext): StateTransition {
    return {
      nextState: 'idle',
      actions: ['completeCustomInteraction'],
    };
  }
}
```

### Multi-Touch Support

For touch-enabled interactions:

```typescript
export const TouchEnabledWidget: React.FC<WidgetRendererProps<MyWidgetContent>> = ({
  widget,
  state,
  events,
}) => {
  const [touches, setTouches] = useState<TouchList | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    setTouches(e.touches);
    e.preventDefault(); // Prevent scrolling
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touches || touches.length === 0) return;

    if (e.touches.length === 1 && touches.length === 1) {
      // Single touch - move widget
      const deltaX = e.touches[0].clientX - touches[0].clientX;
      const deltaY = e.touches[0].clientY - touches[0].clientY;
      
      events.onUpdate({
        x: widget.x + deltaX,
        y: widget.y + deltaY,
      });
    } else if (e.touches.length === 2 && touches.length === 2) {
      // Two touches - scale widget
      const currentDistance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      
      const initialDistance = Math.hypot(
        touches[0].clientX - touches[1].clientX,
        touches[0].clientY - touches[1].clientY
      );
      
      const scale = currentDistance / initialDistance;
      
      events.onUpdate({
        width: widget.width * scale,
        height: widget.height * scale,
      });
    }

    setTouches(e.touches);
  }, [touches, events, widget]);

  const handleTouchEnd = useCallback(() => {
    setTouches(null);
  }, []);

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ touchAction: 'none' }} // Prevent default touch behaviors
    >
      {/* Widget content */}
    </div>
  );
};
```

## Best Practices

### 1. Event Propagation

Always consider event propagation in your widgets:

```typescript
const handleWidgetClick = (e: React.MouseEvent) => {
  // Stop propagation to prevent canvas deselection
  e.stopPropagation();
  
  // Handle widget-specific logic
  events.onSelect();
};

const handleInternalButtonClick = (e: React.MouseEvent) => {
  // Stop propagation for internal elements
  e.stopPropagation();
  
  // Handle button logic without affecting widget selection
  handleButtonAction();
};
```

### 2. Keyboard Accessibility

Make your widgets keyboard accessible:

```typescript
const handleKeyDown = (e: React.KeyboardEvent) => {
  switch (e.key) {
    case 'Enter':
    case ' ':
      e.preventDefault();
      events.onSelect();
      break;
    case 'Delete':
    case 'Backspace':
      e.preventDefault();
      events.onDelete();
      break;
    case 'F2':
      e.preventDefault();
      events.onEdit();
      break;
  }
};

return (
  <div
    tabIndex={0}
    role="button"
    aria-label={`${widget.content.data.title} widget`}
    onKeyDown={handleKeyDown}
  >
    {/* Widget content */}
  </div>
);
```

### 3. Performance Optimization

Optimize interaction performance:

```typescript
// Debounce frequent updates
const debouncedUpdate = useMemo(
  () => debounce((updates: Partial<Widget>) => {
    events.onUpdate(updates);
  }, 16), // ~60fps
  [events.onUpdate]
);

// Use React.memo for expensive renders
export const OptimizedWidget = React.memo<WidgetRendererProps<MyWidgetContent>>(({
  widget,
  state,
  events,
}) => {
  // Component implementation
}, (prevProps, nextProps) => {
  // Custom comparison for optimization
  return (
    prevProps.widget.id === nextProps.widget.id &&
    prevProps.state.isSelected === nextProps.state.isSelected &&
    prevProps.state.isHovered === nextProps.state.isHovered
  );
});
```

### 4. Error Boundaries

Wrap widgets in error boundaries for interaction failures:

```typescript
class WidgetInteractionErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Widget interaction error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="widget-error">
          <p>Interaction failed</p>
          <button onClick={() => this.setState({ hasError: false })}>
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

## Debugging Interactions

### Debug Event Flow

Add logging to trace event flow:

```typescript
// In your widget renderer
useEffect(() => {
  console.log(`[${widget.type}:${widget.id}] State changed:`, {
    isSelected: state.isSelected,
    isHovered: state.isHovered,
    isEditing: state.isEditing,
  });
}, [widget.type, widget.id, state]);

// In event handlers
const handleClick = (e: React.MouseEvent) => {
  console.log(`[${widget.type}:${widget.id}] Click event:`, {
    button: e.button,
    ctrlKey: e.ctrlKey,
    shiftKey: e.shiftKey,
  });
  
  events.onSelect();
};
```

### Interaction State Inspector

Create a debug component to inspect interaction state:

```typescript
export const InteractionDebugger: React.FC<{
  interactionController: InteractionController;
}> = ({ interactionController }) => {
  const [state, setState] = useState(interactionController.getInteractionState());
  
  useEffect(() => {
    const interval = setInterval(() => {
      setState(interactionController.getInteractionState());
    }, 100);
    
    return () => clearInterval(interval);
  }, [interactionController]);

  return (
    <div className="interaction-debugger">
      <h3>Interaction State</h3>
      <div>Mode: {state.mode}</div>
      <div>Active: {state.isActive ? 'Yes' : 'No'}</div>
      <div>Selected: {interactionController.getSelectedIds().join(', ')}</div>
      <div>Hovered: {interactionController.getHoveredId() || 'None'}</div>
      
      <h4>Modifiers</h4>
      <div>Shift: {state.modifiers.shift ? 'Yes' : 'No'}</div>
      <div>Ctrl: {state.modifiers.ctrl ? 'Yes' : 'No'}</div>
      <div>Alt: {state.modifiers.alt ? 'Yes' : 'No'}</div>
      <div>Meta: {state.modifiers.meta ? 'Yes' : 'No'}</div>
    </div>
  );
};
```

This guide provides comprehensive coverage of the interaction handling system in Pinboard, enabling you to create sophisticated and responsive widget interactions in your plugins.