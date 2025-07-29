import { getWidgetFactory } from "../core/GenericWidgetFactory";
import type {
  BoundingBox,
  CanvasTransform,
  InteractionMode,
  InteractionState,
  KeyModifiers,
  Point,
  SnapTarget,
} from "../types/canvas";
import type { HydratedWidget } from "../types/widgets";
import { DragManager } from "./DragManager";
import { KeyboardManager } from "./KeyboardManager";
import { SelectionManager } from "./SelectionManager";
import {
  AreaSelectState,
  DraggingState,
  IdleState,
  type InteractionStateName,
  PanningState,
  ResizingState,
  RotatingState,
  type StateContext,
  StateMachine,
  type StateMachineCallbacks,
  type StateMachineEvent,
  TextEditingState,
} from "./stateMachine";

export interface InteractionCallbacks {
  onWidgetUpdate: (id: string, updates: Partial<HydratedWidget>) => void;
  onWidgetsUpdate: (
    updates: Array<{ id: string; updates: Partial<HydratedWidget> }>,
  ) => void;
  onWidgetRemove: (id: string) => void;
  onWidgetAdd: (widget: any) => void;
  onCanvasTransform: (transform: CanvasTransform) => void;
  onModeChange: (mode: InteractionMode) => void;
  onSelectionChange: (selectedIds: string[]) => void;
  onHoverChange: (hoveredId: string | null) => void;
}

export class InteractionController {
  private selectionManager: SelectionManager;
  private keyboardManager: KeyboardManager;
  private dragManager: DragManager;
  private stateMachine: StateMachine;

  private widgets: HydratedWidget[] = [];
  private canvasTransform: CanvasTransform = { x: 0, y: 0, scale: 1 };
  private interactionState: InteractionState = {
    mode: "select",
    isActive: false,
    modifiers: { shift: false, ctrl: false, alt: false, meta: false },
  };

  private callbacks: InteractionCallbacks;
  private canvasElement: HTMLElement | null = null;

  constructor(callbacks: InteractionCallbacks) {
    this.callbacks = callbacks;

    // Initialize managers
    this.selectionManager = new SelectionManager(
      this.handleSelectionChange.bind(this),
      this.handleHoverChange.bind(this),
    );

    this.keyboardManager = new KeyboardManager();
    this.setupKeyboardCommands();

    // Initialize DragManager with performance-optimized callbacks
    this.dragManager = new DragManager(
      this.handleDragStart.bind(this),
      this.handleDragUpdate.bind(this),
      this.handleDragEnd.bind(this),
      undefined, // onSnapChange - will be handled by state machine
      this.getOptimizedMultipleWidgetTransformUpdate(),
    );

    // Initialize state machine
    this.initializeStateMachine();
  }

  // Get optimized multiple widget transform update function for DragManager
  private getOptimizedMultipleWidgetTransformUpdate() {
    return (
      updates: Array<{
        id: string;
        transform: {
          x?: number;
          y?: number;
          width?: number;
          height?: number;
          rotation?: number;
        };
      }>,
    ) => {
      // Convert to the format expected by onWidgetsUpdate
      const widgetUpdates = updates.map(({ id, transform }) => ({
        id,
        updates: transform as any,
      }));
      this.callbacks.onWidgetsUpdate(widgetUpdates);
    };
  }

  private initializeStateMachine(): void {
    const stateContext: StateContext = {
      widgets: this.widgets,
      canvasTransform: this.canvasTransform,
      selectedIds: [],
      hoveredId: null,
    };

    const stateMachineCallbacks: StateMachineCallbacks = {
      onWidgetUpdate: this.callbacks.onWidgetUpdate,
      onWidgetsUpdate: this.callbacks.onWidgetsUpdate,
      onWidgetRemove: this.callbacks.onWidgetRemove,
      onCanvasTransform: (transform) => {
        this.canvasTransform = transform;
        this.callbacks.onCanvasTransform(transform);
      },
      onSelectionChange: (selectedIds) => {
        this.selectionManager.selectMultiple(selectedIds, false);
        this.callbacks.onSelectionChange(selectedIds);
        // Force a re-render by triggering a mode change
        this.updateLegacyInteractionState();
      },
      onHoverChange: (hoveredId) => {
        this.selectionManager.setHovered(hoveredId);
        this.callbacks.onHoverChange(hoveredId);
      },
      onCursorChange: (cursor) => {
        // Update cursor through DOM or callback
        if (this.canvasElement) {
          this.canvasElement.style.cursor = cursor;
        }
      },
    };

    this.stateMachine = new StateMachine(
      "idle",
      stateContext,
      stateMachineCallbacks,
    );

    // Register all states
    this.stateMachine.registerState("idle", IdleState);
    this.stateMachine.registerState("areaSelect", AreaSelectState);
    this.stateMachine.registerState("dragging", DraggingState);
    this.stateMachine.registerState("panning", PanningState);
    this.stateMachine.registerState("resizing", ResizingState);
    this.stateMachine.registerState("rotating", RotatingState);
    this.stateMachine.registerState("textEditing", TextEditingState);

    // Initialize with idle state
    this.stateMachine.initialize("idle");
  }

  // Setup and teardown
  setCanvasElement(element: HTMLElement): void {
    this.canvasElement = element;
    this.bindCanvasEvents();
  }

  destroy(): void {
    this.keyboardManager.destroy();
    this.unbindCanvasEvents();
  }

  // State management
  setWidgets(widgets: HydratedWidget[]): void {
    this.widgets = [...widgets];
    // Update state machine context
    this.stateMachine.updateContext({ widgets: this.widgets });
  }

  setCanvasTransform(transform: CanvasTransform): void {
    this.canvasTransform = { ...transform };
    // Update state machine context
    this.stateMachine.updateContext({ canvasTransform: this.canvasTransform });
  }

  getInteractionState(): InteractionState {
    // Map state machine state to legacy InteractionState
    const currentState = this.stateMachine.getCurrentStateName();
    const legacyMode = this.mapStateToMode(currentState);

    return {
      ...this.interactionState,
      mode: legacyMode,
    };
  }

  getSelectedWidgets(): HydratedWidget[] {
    const selectedIds = this.selectionManager.getSelectedIds();
    return this.widgets.filter((w) => selectedIds.includes(w.id));
  }

  // Mode management
  setMode(mode: InteractionMode): void {
    if (this.interactionState.mode !== mode) {
      this.interactionState.mode = mode;
      this.callbacks.onModeChange(mode);

      // Map legacy mode to state machine state if needed
      const stateName = this.mapModeToState(mode);
      if (stateName && stateName !== this.stateMachine.getCurrentStateName()) {
        this.stateMachine.forceTransition(stateName);
      }
    }
  }

  private mapStateToMode(stateName: InteractionStateName): InteractionMode {
    const stateToModeMap: Record<InteractionStateName, InteractionMode> = {
      idle: "select",
      areaSelect: "area-select",
      dragging: "drag",
      panning: "hand",
      resizing: "resize",
      rotating: "rotate",
      textEditing: "text",
    };
    return stateToModeMap[stateName] || "select";
  }

  private mapModeToState(mode: InteractionMode): InteractionStateName | null {
    const modeToStateMap: Record<InteractionMode, InteractionStateName> = {
      select: "idle",
      "area-select": "areaSelect",
      drag: "dragging",
      hand: "panning",
      resize: "resizing",
      rotate: "rotating",
      text: "textEditing",
      zoom: "idle", // No specific zoom state, handle in idle
      draw: "idle", // No draw state yet
      transform: "idle", // Generic transform maps to idle
      "drop-target": "idle", // Drop target maps to idle
    };
    return modeToStateMap[mode] || null;
  }

  private updateLegacyInteractionState(): void {
    // Update legacy interaction state based on current state machine state
    const currentState = this.stateMachine.getCurrentStateName();
    const legacyMode = this.mapStateToMode(currentState);

    if (this.interactionState.mode !== legacyMode) {
      this.interactionState.mode = legacyMode;
      this.callbacks.onModeChange(legacyMode);
    }

    // Update isActive based on state
    this.interactionState.isActive = currentState !== "idle";
  }

  // Canvas event handlers
  private bindCanvasEvents(): void {
    if (!this.canvasElement) return;

    this.canvasElement.addEventListener(
      "mousedown",
      this.handleMouseDown.bind(this),
    );
    this.canvasElement.addEventListener(
      "mousemove",
      this.handleMouseMove.bind(this),
    );
    this.canvasElement.addEventListener(
      "mouseup",
      this.handleMouseUp.bind(this),
    );
    this.canvasElement.addEventListener("wheel", this.handleWheel.bind(this));
    this.canvasElement.addEventListener(
      "contextmenu",
      this.handleContextMenu.bind(this),
    );

    // Global mouse events for dragging
    document.addEventListener(
      "mousemove",
      this.handleGlobalMouseMove.bind(this),
    );
    document.addEventListener("mouseup", this.handleGlobalMouseUp.bind(this));

    // Keyboard events for state machine
    document.addEventListener("keydown", this.handleKeyDown.bind(this));
    document.addEventListener("keyup", this.handleKeyUp.bind(this));
  }

  private unbindCanvasEvents(): void {
    if (!this.canvasElement) return;

    this.canvasElement.removeEventListener(
      "mousedown",
      this.handleMouseDown.bind(this),
    );
    this.canvasElement.removeEventListener(
      "mousemove",
      this.handleMouseMove.bind(this),
    );
    this.canvasElement.removeEventListener(
      "mouseup",
      this.handleMouseUp.bind(this),
    );
    this.canvasElement.removeEventListener(
      "wheel",
      this.handleWheel.bind(this),
    );
    this.canvasElement.removeEventListener(
      "contextmenu",
      this.handleContextMenu.bind(this),
    );

    document.removeEventListener(
      "mousemove",
      this.handleGlobalMouseMove.bind(this),
    );
    document.removeEventListener(
      "mouseup",
      this.handleGlobalMouseUp.bind(this),
    );

    // Remove keyboard event listeners
    document.removeEventListener("keydown", this.handleKeyDown.bind(this));
    document.removeEventListener("keyup", this.handleKeyUp.bind(this));
  }

  public handleMouseDown(event: MouseEvent): void {
    const canvasPoint = this.getCanvasPoint(event);
    const screenPoint = this.getScreenPoint(event);
    const modifiers = this.getModifiers(event);
    const hitWidget = this.getWidgetAtPoint(canvasPoint);

    this.interactionState.modifiers = modifiers;
    this.interactionState.startPosition = canvasPoint;
    this.interactionState.currentPosition = canvasPoint;

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

    // Update legacy interaction state for backward compatibility
    this.updateLegacyInteractionState();
  }

  private handleMouseMove(event: MouseEvent): void {
    const point = this.getCanvasPoint(event);
    const screenPoint = this.getScreenPoint(event);
    const modifiers = this.getModifiers(event);
    const hitWidget = this.getWidgetAtPoint(point);

    this.interactionState.currentPosition = point;

    // Create state machine event
    const stateMachineEvent: StateMachineEvent = {
      type: "mousemove",
      point: point,
      screenPoint: screenPoint,
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

    this.updateLegacyInteractionState();
  }

  private handleGlobalMouseMove(event: MouseEvent): void {
    // Route through regular mouse move handler
    this.handleMouseMove(event);
  }

  public handleMouseUp(event: MouseEvent): void {
    this.handleGlobalMouseUp(event);
  }

  private handleGlobalMouseUp(event: MouseEvent): void {
    const canvasPoint = this.getCanvasPoint(event);
    const screenPoint = this.getScreenPoint(event);
    const modifiers = this.getModifiers(event);

    // Create state machine event
    const stateMachineEvent: StateMachineEvent = {
      type: "mouseup",
      point: canvasPoint,
      screenPoint: screenPoint,
      button: event.button,
      modifiers: modifiers,
    };

    // Process through state machine
    const result = this.stateMachine.processEvent(stateMachineEvent);

    if (result.preventDefault) {
      event.preventDefault();
    }
    if (result.stopPropagation) {
      event.stopPropagation();
    }

    this.updateLegacyInteractionState();
  }

  private handleWheel(event: WheelEvent): void {
    const canvasPoint = this.getCanvasPoint(event);
    const screenPoint = this.getScreenPoint(event);
    const modifiers = this.getModifiers(event);

    // Check if the wheel event is over scrollable content within a widget
    const shouldAllowScrolling = this.isWheelEventOverScrollableContent(event);

    // Create state machine event with scrollable content information
    const stateMachineEvent: StateMachineEvent = {
      type: "wheel",
      point: canvasPoint,
      screenPoint: screenPoint,
      deltaX: event.deltaX,
      deltaY: event.deltaY,
      modifiers: modifiers,
      overScrollableContent: shouldAllowScrolling,
    };

    // Process through state machine
    const result = this.stateMachine.processEvent(stateMachineEvent);

    // Only prevent default if we're not over scrollable content OR the state machine explicitly requests it
    if (result.preventDefault && !shouldAllowScrolling) {
      event.preventDefault();
    } else {
      // Allow natural scroll if not over scrollable content or state machine allows it
      // The state machine handles the actual scrolling if it's not over scrollable content
    }
    if (result.stopPropagation) {
      event.stopPropagation();
    }

    this.updateLegacyInteractionState();
  }

  /**
   * Check if a wheel event target is within scrollable content inside a widget
   */
  private isWheelEventOverScrollableContent(event: WheelEvent): boolean {
    const target = event.target as HTMLElement;
    if (!target) return false;

    // Walk up the DOM tree to find scrollable elements within widgets
    let element: HTMLElement | null = target;
    let foundWidget = false;

    while (element && element !== this.canvasElement) {
      // Check if we're inside a widget container
      if (element.hasAttribute("data-widget-id")) {
        foundWidget = true;
      }

      // Check for scrollable elements throughout the traversal
      // (not just after finding widget container)
      if (this.isElementScrollableInWidget(element, event)) {
        // Only allow scrolling if we're inside a widget
        if (foundWidget || this.isWithinWidget(element)) {
          return true;
        }
      }

      element = element.parentElement;
    }

    return false;
  }

  /**
   * Check if an element is within a widget by looking for widget container in its ancestors
   */
  private isWithinWidget(element: HTMLElement): boolean {
    let current = element.parentElement;
    while (current && current !== this.canvasElement) {
      if (current.hasAttribute("data-widget-id")) {
        return true;
      }
      current = current.parentElement;
    }
    return false;
  }

  /**
   * Check if an element within a widget is scrollable
   */
  private isElementScrollableInWidget(
    element: HTMLElement,
    event: WheelEvent,
  ): boolean {
    // Check for explicit scrollable markers (like our chat widget)
    if (element.hasAttribute("data-scrollable")) {
      return true;
    }

    // Check if element is naturally scrollable
    if (this.isElementScrollable(element)) {
      if (this.canElementScrollInDirection(element, event)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if an element is scrollable
   */
  private isElementScrollable(element: HTMLElement): boolean {
    const computedStyle = window.getComputedStyle(element);
    const overflowY = computedStyle.overflowY;
    const overflowX = computedStyle.overflowX;

    const isScrollableY =
      (overflowY === "auto" || overflowY === "scroll") &&
      element.scrollHeight > element.clientHeight;
    const isScrollableX =
      (overflowX === "auto" || overflowX === "scroll") &&
      element.scrollWidth > element.clientWidth;

    return isScrollableY || isScrollableX;
  }

  /**
   * Check if an element can scroll in the direction of the wheel event
   */
  private canElementScrollInDirection(
    element: HTMLElement,
    event: WheelEvent,
  ): boolean {
    const computedStyle = window.getComputedStyle(element);
    const overflowY = computedStyle.overflowY;
    const overflowX = computedStyle.overflowX;

    const isScrollableY =
      (overflowY === "auto" || overflowY === "scroll") &&
      element.scrollHeight > element.clientHeight;
    const isScrollableX =
      (overflowX === "auto" || overflowX === "scroll") &&
      element.scrollWidth > element.clientWidth;

    // Check vertical scrolling
    if (isScrollableY && Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
      return this.canScrollVertically(element, event.deltaY);
    }

    // Check horizontal scrolling
    if (isScrollableX && Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
      return this.canScrollHorizontally(element, event.deltaX);
    }

    return false;
  }

  /**
   * Check if an element can scroll vertically in the given direction
   */
  private canScrollVertically(element: HTMLElement, deltaY: number): boolean {
    const canScrollUp = element.scrollTop > 0;
    const canScrollDown =
      element.scrollTop < element.scrollHeight - element.clientHeight;

    return (deltaY < 0 && canScrollUp) || (deltaY > 0 && canScrollDown);
  }

  /**
   * Check if an element can scroll horizontally in the given direction
   */
  private canScrollHorizontally(element: HTMLElement, deltaX: number): boolean {
    const canScrollLeft = element.scrollLeft > 0;
    const canScrollRight =
      element.scrollLeft < element.scrollWidth - element.clientWidth;

    return (deltaX < 0 && canScrollLeft) || (deltaX > 0 && canScrollRight);
  }

  private handleContextMenu(event: MouseEvent): void {
    const canvasPoint = this.getCanvasPoint(event);
    const screenPoint = this.getScreenPoint(event);
    const modifiers = this.getModifiers(event);

    // Create state machine event
    const stateMachineEvent: StateMachineEvent = {
      type: "contextmenu",
      point: canvasPoint,
      screenPoint: screenPoint,
      modifiers: modifiers,
    };

    // Process through state machine
    const result = this.stateMachine.processEvent(stateMachineEvent);

    if (result.preventDefault) {
      event.preventDefault();
    }
    if (result.stopPropagation) {
      event.stopPropagation();
    }

    this.updateLegacyInteractionState();
  }

  private handleKeyDown(event: KeyboardEvent): void {
    const modifiers = this.getModifiers(event);

    // Create state machine event
    const stateMachineEvent: StateMachineEvent = {
      type: "keydown",
      key: event.key,
      modifiers: modifiers,
    };

    // Process through state machine
    const result = this.stateMachine.processEvent(stateMachineEvent);

    if (result.preventDefault) {
      event.preventDefault();
    }
    if (result.stopPropagation) {
      event.stopPropagation();
    }

    this.updateLegacyInteractionState();
  }

  private handleKeyUp(event: KeyboardEvent): void {
    const modifiers = this.getModifiers(event);

    // Create state machine event
    const stateMachineEvent: StateMachineEvent = {
      type: "keyup",
      key: event.key,
      modifiers: modifiers,
    };

    // Process through state machine
    const result = this.stateMachine.processEvent(stateMachineEvent);

    if (result.preventDefault) {
      event.preventDefault();
    }
    if (result.stopPropagation) {
      event.stopPropagation();
    }

    this.updateLegacyInteractionState();
  }

  // Zooming
  private zoomToPoint(screenPoint: Point, newScale: number): void {
    const clampedScale = Math.max(0.01, Math.min(100, newScale));

    // Calculate new offset to zoom towards the screen point
    const scaleRatio = clampedScale / this.canvasTransform.scale;
    const newTransform = {
      x: screenPoint.x - (screenPoint.x - this.canvasTransform.x) * scaleRatio,
      y: screenPoint.y - (screenPoint.y - this.canvasTransform.y) * scaleRatio,
      scale: clampedScale,
    };

    this.setCanvasTransform(newTransform);
    this.callbacks.onCanvasTransform(newTransform);
  }

  // Utility methods
  private getCanvasPoint(event: MouseEvent): Point {
    if (!this.canvasElement) return { x: 0, y: 0 };

    const rect = this.canvasElement.getBoundingClientRect();
    return {
      x:
        (event.clientX - rect.left - this.canvasTransform.x) /
        this.canvasTransform.scale,
      y:
        (event.clientY - rect.top - this.canvasTransform.y) /
        this.canvasTransform.scale,
    };
  }

  private getScreenPoint(event: MouseEvent): Point {
    if (!this.canvasElement) return { x: 0, y: 0 };

    const rect = this.canvasElement.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }

  private getModifiers(event: MouseEvent | KeyboardEvent): KeyModifiers {
    return {
      shift: event.shiftKey,
      ctrl: event.ctrlKey,
      alt: event.altKey,
      meta: event.metaKey,
    };
  }

  private getWidgetAtPoint(point: Point): HydratedWidget | undefined {
    // Find the topmost widget at the given point
    const sortedWidgets = [...this.widgets].sort((a, b) => b.zIndex - a.zIndex);

    for (const widget of sortedWidgets) {
      if (this.isPointInWidget(point, widget)) {
        return widget;
      }
    }

    return undefined;
  }

  private isPointInWidget(point: Point, widget: HydratedWidget): boolean {
    return (
      point.x >= widget.x &&
      point.x <= widget.x + widget.width &&
      point.y >= widget.y &&
      point.y <= widget.y + widget.height
    );
  }

  // Keyboard command handlers
  private setupKeyboardCommands(): void {
    this.keyboardManager.registerCommand("selectAll", () => {
      this.selectionManager.selectAll(this.widgets);
    });

    this.keyboardManager.registerCommand("delete", () => {
      this.deleteSelection();
    });

    this.keyboardManager.registerCommand("handTool", () => {
      // Only toggle hand tool if we're not actively interacting
      if (!this.interactionState.isActive) {
        this.setMode(this.interactionState.mode === "hand" ? "select" : "hand");
      }
    });

    this.keyboardManager.registerCommand("zoomToFit", () => {
      this.zoomToFit();
    });

    this.keyboardManager.registerCommand("zoomToSelection", () => {
      this.zoomToSelection();
    });

    this.keyboardManager.registerCommand("zoomToActualSize", () => {
      this.zoomToActualSize();
    });

    this.keyboardManager.registerCommand("zoomIn", () => {
      this.zoomIn();
    });

    this.keyboardManager.registerCommand("zoomOut", () => {
      this.zoomOut();
    });
  }

  // Command implementations

  private deleteSelection(): void {
    const selectedIds = this.selectionManager.getSelectedIds();
    if (selectedIds.length === 0) return;

    // Delete each selected widget
    selectedIds.forEach((id) => {
      this.callbacks.onWidgetRemove(id);
    });

    // Clear selection after deletion
    this.selectionManager.clearSelection();
  }




  private zoomToFit(): void {
    if (this.widgets.length === 0) return;

    // Calculate bounding box of all widgets
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    this.widgets.forEach((widget) => {
      minX = Math.min(minX, widget.x);
      minY = Math.min(minY, widget.y);
      maxX = Math.max(maxX, widget.x + widget.width);
      maxY = Math.max(maxY, widget.y + widget.height);
    });

    if (!this.canvasElement) return;

    const padding = 50;
    const canvasRect = this.canvasElement.getBoundingClientRect();
    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;

    const scaleX = (canvasRect.width - padding * 2) / contentWidth;
    const scaleY = (canvasRect.height - padding * 2) / contentHeight;
    const scale = Math.min(scaleX, scaleY, 1);

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    const newTransform = {
      x: canvasRect.width / 2 - centerX * scale,
      y: canvasRect.height / 2 - centerY * scale,
      scale,
    };

    this.setCanvasTransform(newTransform);
    this.callbacks.onCanvasTransform(newTransform);
  }

  private zoomToSelection(): void {
    const bounds = this.selectionManager.getSelectionBounds(this.widgets);
    if (!bounds || !this.canvasElement) return;

    const padding = 50;
    const canvasRect = this.canvasElement.getBoundingClientRect();

    const scaleX = (canvasRect.width - padding * 2) / bounds.width;
    const scaleY = (canvasRect.height - padding * 2) / bounds.height;
    const scale = Math.min(scaleX, scaleY, 1);

    const centerX = bounds.x + bounds.width / 2;
    const centerY = bounds.y + bounds.height / 2;

    const newTransform = {
      x: canvasRect.width / 2 - centerX * scale,
      y: canvasRect.height / 2 - centerY * scale,
      scale,
    };

    this.setCanvasTransform(newTransform);
    this.callbacks.onCanvasTransform(newTransform);
  }

  private zoomToActualSize(): void {
    const newTransform = { ...this.canvasTransform, scale: 1 };
    this.setCanvasTransform(newTransform);
    this.callbacks.onCanvasTransform(newTransform);
  }

  private zoomIn(): void {
    const newScale = Math.min(this.canvasTransform.scale * 1.2, 100);
    const center = this.canvasElement
      ? {
          x: this.canvasElement.clientWidth / 2,
          y: this.canvasElement.clientHeight / 2,
        }
      : { x: 0, y: 0 };

    this.zoomToPoint(center, newScale);
  }

  private zoomOut(): void {
    const newScale = Math.max(this.canvasTransform.scale / 1.2, 0.01);
    const center = this.canvasElement
      ? {
          x: this.canvasElement.clientWidth / 2,
          y: this.canvasElement.clientHeight / 2,
        }
      : { x: 0, y: 0 };

    this.zoomToPoint(center, newScale);
  }

  // Callback handlers
  private handleSelectionChange(selectedIds: string[]): void {
    this.callbacks.onSelectionChange(selectedIds);
  }

  private handleHoverChange(hoveredId: string | null): void {
    this.callbacks.onHoverChange(hoveredId);
  }

  private handleDragStart(_widgetIds: string[]): void {
    this.interactionState.isActive = true;
  }

  private handleDragUpdate(delta: Point, widgetIds: string[]): void {
    // Get the initial positions from drag manager to calculate proper deltas
    const initialPositions = this.dragManager.getInitialWidgetPositions();

    if (initialPositions.size === 0) return;

    const updates = widgetIds
      .map((id) => {
        const initialPos = initialPositions.get(id);
        if (!initialPos) return null;

        return {
          id,
          updates: {
            x: initialPos.x + delta.x,
            y: initialPos.y + delta.y,
          },
        };
      })
      .filter(Boolean) as Array<{
      id: string;
      updates: Partial<HydratedWidget>;
    }>;

    this.callbacks.onWidgetsUpdate(updates);
  }

  private handleDragEnd(_delta: Point, _widgetIds: string[]): void {
    this.interactionState.isActive = false;
  }

  // Public methods for accessing manager state
  getSelectionBox(): BoundingBox | null {
    // Get selection box from state machine context
    const context = this.stateMachine.getContext();
    return context.selectionBox || null;
  }

  getSnapIndicators(): SnapTarget[] {
    return this.dragManager.getSnapIndicators();
  }

  getSelectedIds(): string[] {
    return this.selectionManager.getSelectedIds();
  }

  getHoveredId(): string | null {
    return this.selectionManager.getHoveredId();
  }
}
