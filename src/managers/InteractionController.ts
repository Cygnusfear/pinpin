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

    // Create state machine event
    const stateMachineEvent: StateMachineEvent = {
      type: "wheel",
      point: canvasPoint,
      screenPoint: screenPoint,
      deltaX: event.deltaX,
      deltaY: event.deltaY,
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
  private duplicateSelection(): void {
    const selectedWidgets = this.getSelectedWidgets();
    if (selectedWidgets.length === 0) return;

    const duplicates = selectedWidgets.map((widget) => ({
      ...widget,
      id: `${widget.id}-copy-${Date.now()}`,
      x: widget.x + 20,
      y: widget.y + 20,
      selected: false,
    }));

    // Add duplicates and select them
    duplicates.forEach((duplicate) => {
      this.callbacks.onWidgetUpdate(duplicate.id, duplicate);
    });

    this.selectionManager.selectMultiple(duplicates.map((d) => d.id));
  }

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

  private copySelection(): void {
    const selectedWidgets = this.getSelectedWidgets();
    if (selectedWidgets.length === 0) return;

    // TODO: Implement clipboard functionality
    console.log("Copy widgets:", selectedWidgets);
  }

  private async pasteSelection(): Promise<void> {
    console.log("🎯 InteractionController paste command triggered");

    try {
      // Check if we have clipboard access
      if (!navigator.clipboard || !navigator.clipboard.read) {
        console.warn(
          "⚠️ Clipboard API not available, falling back to execCommand",
        );
        this.fallbackPaste();
        return;
      }

      // Read clipboard data
      const clipboardItems = await navigator.clipboard.read();
      console.log("📋 Clipboard items:", clipboardItems);

      if (clipboardItems.length === 0) {
        console.log("📋 No clipboard data available");
        return;
      }

      const genericFactory = getWidgetFactory();

      // Calculate paste position (center of viewport or near mouse)
      const canvasRect = this.canvasElement?.getBoundingClientRect();
      const centerPosition = canvasRect
        ? {
            x: canvasRect.left + canvasRect.width / 2,
            y: canvasRect.top + canvasRect.height / 2,
          }
        : { x: window.innerWidth / 2, y: window.innerHeight / 2 };

      // Convert to canvas coordinates
      const canvasPosition = {
        x:
          (centerPosition.x -
            (canvasRect?.left || 0) -
            this.canvasTransform.x) /
          this.canvasTransform.scale,
        y:
          (centerPosition.y - (canvasRect?.top || 0) - this.canvasTransform.y) /
          this.canvasTransform.scale,
      };

      // Process each clipboard item
      for (const clipboardItem of clipboardItems) {
        console.log("📋 Processing clipboard item types:", clipboardItem.types);

        // Try to handle images first - check for any image type
        const imageTypes = clipboardItem.types.filter((type) =>
          type.startsWith("image/"),
        );

        if (imageTypes.length > 0) {
          console.log("🖼️ Found image types in clipboard:", imageTypes);

          for (const imageType of imageTypes) {
            try {
              console.log(`🖼️ Processing image type: ${imageType}`);
              const blob = await clipboardItem.getType(imageType);
              console.log(`🖼️ Got blob for ${imageType}, size:`, blob.size);

              const file = new File([blob], "pasted-image", {
                type: imageType,
              });
              console.log(`🖼️ Created file object:`, {
                name: file.name,
                type: file.type,
                size: file.size,
              });

              const widget = await genericFactory.createWidgetFromData(
                file,
                canvasPosition,
              );
              if (widget) {
                console.log("✅ Created image widget from clipboard:", widget);
                this.callbacks.onWidgetAdd(widget);
                canvasPosition.x += 20;
                canvasPosition.y += 20;
                // Only process the first successful image
                break;
              }
              console.warn(`⚠️ No widget created for image type ${imageType}`);
            } catch (error) {
              console.warn(
                `⚠️ Failed to process clipboard image ${imageType}:`,
                error,
              );
            }
          }
        }

        // Try to handle text data
        if (clipboardItem.types.includes("text/plain")) {
          try {
            const blob = await clipboardItem.getType("text/plain");
            const text = await blob.text();

            if (text.trim()) {
              const widget = await genericFactory.createWidgetFromData(
                text.trim(),
                canvasPosition,
              );
              if (widget) {
                console.log(
                  "✅ Created text widget from clipboard:",
                  text.substring(0, 50),
                );
                this.callbacks.onWidgetAdd(widget);
                canvasPosition.x += 20;
                canvasPosition.y += 20;
              }
            }
          } catch (error) {
            console.warn("⚠️ Failed to process clipboard text:", error);
          }
        }
      }
    } catch (error) {
      console.error("❌ Paste operation failed:", error);
      // Try fallback
      this.fallbackPaste();
    }
  }

  private fallbackPaste(): void {
    console.log("🔄 Attempting fallback paste using document.execCommand");

    // Create a temporary textarea to capture paste content
    const tempElement = document.createElement("textarea");
    tempElement.style.position = "fixed";
    tempElement.style.left = "-9999px";
    tempElement.style.opacity = "0";
    document.body.appendChild(tempElement);

    tempElement.focus();

    // Execute paste command
    const success = document.execCommand("paste");

    if (success && tempElement.value) {
      console.log(
        "✅ Fallback paste successful:",
        tempElement.value.substring(0, 50),
      );

      // Calculate paste position
      const canvasRect = this.canvasElement?.getBoundingClientRect();
      const centerPosition = canvasRect
        ? {
            x: canvasRect.left + canvasRect.width / 2,
            y: canvasRect.top + canvasRect.height / 2,
          }
        : { x: window.innerWidth / 2, y: window.innerHeight / 2 };

      const canvasPosition = {
        x:
          (centerPosition.x -
            (canvasRect?.left || 0) -
            this.canvasTransform.x) /
          this.canvasTransform.scale,
        y:
          (centerPosition.y - (canvasRect?.top || 0) - this.canvasTransform.y) /
          this.canvasTransform.scale,
      };

      // Create widget from pasted text
      const genericFactory = getWidgetFactory();
      genericFactory
        .createWidgetFromData(tempElement.value.trim(), canvasPosition)
        .then((widget) => {
          if (widget) {
            console.log("✅ Created widget from fallback paste");
            this.callbacks.onWidgetAdd(widget);
          }
        })
        .catch((error) => {
          console.error(
            "❌ Failed to create widget from fallback paste:",
            error,
          );
        });
    } else {
      console.warn("⚠️ Fallback paste failed or no content");
    }

    // Clean up
    document.body.removeChild(tempElement);
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
