import type {
  CanvasTransform,
  KeyModifiers,
  Point,
  Widget,
} from "../../types/canvas";

// State machine event types
export type StateMachineEvent =
  | MouseDownEvent
  | MouseMoveEvent
  | MouseUpEvent
  | KeyDownEvent
  | KeyUpEvent
  | WheelEvent
  | ContextMenuEvent;

export interface MouseDownEvent {
  type: "mousedown";
  point: Point;
  screenPoint: Point;
  button: number; // 0 = left, 1 = middle, 2 = right
  modifiers: KeyModifiers;
  hitWidget?: Widget;
}

export interface MouseMoveEvent {
  type: "mousemove";
  point: Point;
  screenPoint: Point;
  modifiers: KeyModifiers;
  hitWidget?: Widget;
}

export interface MouseUpEvent {
  type: "mouseup";
  point: Point;
  screenPoint: Point;
  button: number;
  modifiers: KeyModifiers;
}

export interface KeyDownEvent {
  type: "keydown";
  key: string;
  modifiers: KeyModifiers;
}

export interface KeyUpEvent {
  type: "keyup";
  key: string;
  modifiers: KeyModifiers;
}

export interface WheelEvent {
  type: "wheel";
  point: Point;
  screenPoint: Point;
  deltaX: number;
  deltaY: number;
  modifiers: KeyModifiers;
}

export interface ContextMenuEvent {
  type: "contextmenu";
  point: Point;
  screenPoint: Point;
  modifiers: KeyModifiers;
}

// State types
export type InteractionStateName =
  | "idle"
  | "areaSelect"
  | "dragging"
  | "panning"
  | "resizing"
  | "rotating"
  | "textEditing";

// State context - shared data between states
export interface StateContext {
  widgets: Widget[];
  canvasTransform: CanvasTransform;
  selectedIds: string[];
  hoveredId: string | null;

  // Interaction-specific data
  startPosition?: Point;
  currentPosition?: Point;
  initialWidgetPositions?: Map<string, Point>;
  previousState?: InteractionStateName;

  // Transformation data
  transformHandle?: TransformHandle;
  transformOrigin?: Point;

  // Area selection data
  selectionBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface TransformHandle {
  type: "resize" | "rotate";
  position: "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "rotation";
  cursor: string;
  widgetId: string;
}

// State transition result
export interface StateTransition {
  nextState: InteractionStateName;
  context?: Partial<StateContext>;
  preventDefault?: boolean;
  stopPropagation?: boolean;
}

// Callbacks for state machine to communicate with the outside world
export interface StateMachineCallbacks {
  onWidgetUpdate: (id: string, updates: Partial<Widget>) => void;
  onWidgetsUpdate: (
    updates: Array<{ id: string; updates: Partial<Widget> }>,
  ) => void;
  onWidgetRemove: (id: string) => void;
  onCanvasTransform: (transform: CanvasTransform) => void;
  onSelectionChange: (selectedIds: string[]) => void;
  onHoverChange: (hoveredId: string | null) => void;
  onCursorChange: (cursor: string) => void;
}
