import { Point, BoundingBox, Widget, KeyModifiers, InteractionMode, InteractionState, CanvasTransform, SnapTarget } from '../types/canvas';
import { SelectionManager } from './SelectionManager';
import { KeyboardManager, KeyboardCommand } from './KeyboardManager';
import { DragManager } from './DragManager';

export interface InteractionCallbacks {
  onWidgetUpdate: (id: string, updates: Partial<Widget>) => void;
  onWidgetsUpdate: (updates: Array<{ id: string; updates: Partial<Widget> }>) => void;
  onWidgetRemove: (id: string) => void;
  onCanvasTransform: (transform: CanvasTransform) => void;
  onModeChange: (mode: InteractionMode) => void;
  onSelectionChange: (selectedIds: string[]) => void;
  onHoverChange: (hoveredId: string | null) => void;
}

export class InteractionController {
  private selectionManager: SelectionManager;
  private keyboardManager: KeyboardManager;
  private dragManager: DragManager;
  
  private widgets: Widget[] = [];
  private canvasTransform: CanvasTransform = { x: 0, y: 0, scale: 1 };
  private interactionState: InteractionState = {
    mode: 'select',
    isActive: false,
    modifiers: { shift: false, ctrl: false, alt: false, meta: false }
  };
  
  private justEndedDrag = false;
  
  // Transform state
  private transformState: {
    isActive: boolean;
    type: 'resize' | 'rotate' | null;
    handle: string | null;
    startPosition: Point | null;
    initialBounds: BoundingBox | null;
    initialRotation: number;
  } = {
    isActive: false,
    type: null,
    handle: null,
    startPosition: null,
    initialBounds: null,
    initialRotation: 0
  };

  private callbacks: InteractionCallbacks;
  private canvasElement: HTMLElement | null = null;

  constructor(callbacks: InteractionCallbacks) {
    this.callbacks = callbacks;

    // Initialize managers
    this.selectionManager = new SelectionManager(
      this.handleSelectionChange.bind(this),
      this.handleHoverChange.bind(this)
    );

    this.keyboardManager = new KeyboardManager();
    this.setupKeyboardCommands();

    this.dragManager = new DragManager(
      this.handleDragStart.bind(this),
      this.handleDragUpdate.bind(this),
      this.handleDragEnd.bind(this)
    );
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
  setWidgets(widgets: Widget[]): void {
    this.widgets = [...widgets];
  }

  setCanvasTransform(transform: CanvasTransform): void {
    this.canvasTransform = { ...transform };
  }

  getInteractionState(): InteractionState {
    return { ...this.interactionState };
  }

  getSelectedWidgets(): Widget[] {
    const selectedIds = this.selectionManager.getSelectedIds();
    return this.widgets.filter(w => selectedIds.includes(w.id));
  }

  // Mode management
  setMode(mode: InteractionMode): void {
    if (this.interactionState.mode !== mode) {
      this.interactionState.mode = mode;
      this.callbacks.onModeChange(mode);
    }
  }

  // Canvas event handlers
  private bindCanvasEvents(): void {
    if (!this.canvasElement) return;

    this.canvasElement.addEventListener('mousedown', this.handleMouseDown.bind(this));
    this.canvasElement.addEventListener('mousemove', this.handleMouseMove.bind(this));
    this.canvasElement.addEventListener('mouseup', this.handleMouseUp.bind(this));
    this.canvasElement.addEventListener('wheel', this.handleWheel.bind(this));
    this.canvasElement.addEventListener('contextmenu', this.handleContextMenu.bind(this));

    // Global mouse events for dragging
    document.addEventListener('mousemove', this.handleGlobalMouseMove.bind(this));
    document.addEventListener('mouseup', this.handleGlobalMouseUp.bind(this));
  }

  private unbindCanvasEvents(): void {
    if (!this.canvasElement) return;

    this.canvasElement.removeEventListener('mousedown', this.handleMouseDown.bind(this));
    this.canvasElement.removeEventListener('mousemove', this.handleMouseMove.bind(this));
    this.canvasElement.removeEventListener('mouseup', this.handleMouseUp.bind(this));
    this.canvasElement.removeEventListener('wheel', this.handleWheel.bind(this));
    this.canvasElement.removeEventListener('contextmenu', this.handleContextMenu.bind(this));

    document.removeEventListener('mousemove', this.handleGlobalMouseMove.bind(this));
    document.removeEventListener('mouseup', this.handleGlobalMouseUp.bind(this));
  }

  public handleMouseDown(event: MouseEvent): void {
    const canvasPoint = this.getCanvasPoint(event);
    const screenPoint = this.getScreenPoint(event);
    const modifiers = this.getModifiers(event);
    const hitWidget = this.getWidgetAtPoint(canvasPoint);

    this.interactionState.modifiers = modifiers;
    this.interactionState.startPosition = canvasPoint;
    this.interactionState.currentPosition = canvasPoint;

    // Handle different interaction modes
    switch (this.interactionState.mode) {
      case 'select':
        this.handleSelectModeMouseDown(canvasPoint, modifiers, hitWidget);
        break;
      case 'hand':
        this.startPanning(screenPoint);
        break;
      default:
        break;
    }
  }

  private handleSelectModeMouseDown(point: Point, modifiers: KeyModifiers, hitWidget?: Widget): void {
    
    if (hitWidget) {
      // Handle widget selection and start potential drag
      this.selectionManager.handleClick(point, this.widgets, modifiers, hitWidget);
      
      // Start drag if widget is selected
      if (this.selectionManager.isSelected(hitWidget.id)) {
        const selectedIds = this.selectionManager.getSelectedIds();
        this.dragManager.startDrag(selectedIds, point, this.widgets);
        this.setMode('drag');
      } else {
      }
    } else {
      // Check if we just ended a drag - if so, don't clear selection immediately
      if (this.justEndedDrag) {
        this.justEndedDrag = false;
        return;
      }
      
      // Start area selection
      this.selectionManager.handleClick(point, this.widgets, modifiers);
      this.selectionManager.startAreaSelection(point);
      this.setMode('area-select');
    }
  }

  private handleMouseMove(event: MouseEvent): void {
    const point = this.getCanvasPoint(event);
    this.interactionState.currentPosition = point;

    // Update hover state
    const hitWidget = this.getWidgetAtPoint(point);
    this.selectionManager.setHovered(hitWidget?.id || null);
  }

  private handleGlobalMouseMove(event: MouseEvent): void {
    if (!this.interactionState.isActive) return;

    const canvasPoint = this.getCanvasPoint(event);
    const screenPoint = this.getScreenPoint(event);
    const modifiers = this.getModifiers(event);

    switch (this.interactionState.mode) {
      case 'drag':
        this.dragManager.updateDrag(canvasPoint, modifiers);
        break;
      case 'area-select':
        this.selectionManager.updateAreaSelection(canvasPoint);
        break;
      case 'hand':
        this.updatePanning(screenPoint);
        break;
      case 'transform':
        this.updateTransform(canvasPoint);
        break;
    }
  }

  public handleMouseUp(event: MouseEvent): void {
    this.handleGlobalMouseUp(event);
  }

  private handleGlobalMouseUp(event: MouseEvent): void {
    const modifiers = this.getModifiers(event);

    switch (this.interactionState.mode) {
      case 'drag':
        this.dragManager.endDrag();
        this.setMode('select');
        // Set flag to prevent immediate selection clearing
        this.justEndedDrag = true;
        // Clear the flag after a short delay to allow for the next mouse event
        setTimeout(() => {
          this.justEndedDrag = false;
        }, 10);
        break;
      case 'area-select':
        this.selectionManager.endAreaSelection(this.widgets, modifiers.meta || modifiers.ctrl);
        this.setMode('select');
        break;
      case 'hand':
        this.endPanning();
        this.setMode('select');
        break;
      case 'transform':
        this.endTransform();
        this.setMode('select');
        break;
      default:
        break;
    }

    this.interactionState.isActive = false;
  }

  private handleWheel(event: WheelEvent): void {
    if (event.ctrlKey || event.metaKey) {
      // Zoom
      event.preventDefault();
      const screenPoint = this.getScreenPoint(event);
      const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
      this.zoomToPoint(screenPoint, this.canvasTransform.scale * zoomFactor);
    } else {
      // Pan
      this.panBy({ x: -event.deltaX, y: -event.deltaY });
    }
  }

  private handleContextMenu(event: MouseEvent): void {
    event.preventDefault();
    // TODO: Show context menu
  }

  // Panning
  private startPanning(screenPoint: Point): void {
    this.interactionState.isActive = true;
    this.interactionState.startPosition = screenPoint;
  }

  private updatePanning(screenPoint: Point): void {
    if (!this.interactionState.startPosition) return;

    const delta = {
      x: screenPoint.x - this.interactionState.startPosition.x,
      y: screenPoint.y - this.interactionState.startPosition.y
    };

    const newTransform = {
      ...this.canvasTransform,
      x: this.canvasTransform.x + delta.x,
      y: this.canvasTransform.y + delta.y
    };

    this.setCanvasTransform(newTransform);
    this.callbacks.onCanvasTransform(newTransform);
    this.interactionState.startPosition = screenPoint;
  }

  private endPanning(): void {
    this.interactionState.isActive = false;
  }

  private panBy(delta: Point): void {
    const newTransform = {
      ...this.canvasTransform,
      x: this.canvasTransform.x + delta.x,
      y: this.canvasTransform.y + delta.y
    };

    this.setCanvasTransform(newTransform);
    this.callbacks.onCanvasTransform(newTransform);
  }

  // Zooming
  private zoomToPoint(screenPoint: Point, newScale: number): void {
    const clampedScale = Math.max(0.01, Math.min(100, newScale));
    
    // Calculate new offset to zoom towards the screen point
    const scaleRatio = clampedScale / this.canvasTransform.scale;
    const newTransform = {
      x: screenPoint.x - (screenPoint.x - this.canvasTransform.x) * scaleRatio,
      y: screenPoint.y - (screenPoint.y - this.canvasTransform.y) * scaleRatio,
      scale: clampedScale
    };

    this.setCanvasTransform(newTransform);
    this.callbacks.onCanvasTransform(newTransform);
  }

  // Utility methods
  private getCanvasPoint(event: MouseEvent): Point {
    if (!this.canvasElement) return { x: 0, y: 0 };

    const rect = this.canvasElement.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left - this.canvasTransform.x) / this.canvasTransform.scale,
      y: (event.clientY - rect.top - this.canvasTransform.y) / this.canvasTransform.scale
    };
  }

  private getScreenPoint(event: MouseEvent): Point {
    if (!this.canvasElement) return { x: 0, y: 0 };

    const rect = this.canvasElement.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  }

  private getModifiers(event: MouseEvent | KeyboardEvent): KeyModifiers {
    return {
      shift: event.shiftKey,
      ctrl: event.ctrlKey,
      alt: event.altKey,
      meta: event.metaKey
    };
  }

  private getWidgetAtPoint(point: Point): Widget | undefined {
    // Find the topmost widget at the given point
    const sortedWidgets = [...this.widgets].sort((a, b) => b.zIndex - a.zIndex);
    
    for (const widget of sortedWidgets) {
      if (this.isPointInWidget(point, widget)) {
        return widget;
      }
    }
    
    return undefined;
  }

  private isPointInWidget(point: Point, widget: Widget): boolean {
    return (
      point.x >= widget.x &&
      point.x <= widget.x + widget.width &&
      point.y >= widget.y &&
      point.y <= widget.y + widget.height
    );
  }

  // Keyboard command handlers
  private setupKeyboardCommands(): void {
    this.keyboardManager.registerCommand('selectAll', () => {
      this.selectionManager.selectAll(this.widgets);
    });

    this.keyboardManager.registerCommand('duplicate', () => {
      this.duplicateSelection();
    });

    this.keyboardManager.registerCommand('delete', () => {
      this.deleteSelection();
    });

    this.keyboardManager.registerCommand('copy', () => {
      this.copySelection();
    });

    this.keyboardManager.registerCommand('paste', () => {
      this.pasteSelection();
    });

    this.keyboardManager.registerCommand('handTool', () => {
      // Only toggle hand tool if we're not actively interacting
      if (!this.interactionState.isActive) {
        this.setMode(this.interactionState.mode === 'hand' ? 'select' : 'hand');
      }
    });

    this.keyboardManager.registerCommand('zoomToFit', () => {
      this.zoomToFit();
    });

    this.keyboardManager.registerCommand('zoomToSelection', () => {
      this.zoomToSelection();
    });

    this.keyboardManager.registerCommand('zoomToActualSize', () => {
      this.zoomToActualSize();
    });

    this.keyboardManager.registerCommand('zoomIn', () => {
      this.zoomIn();
    });

    this.keyboardManager.registerCommand('zoomOut', () => {
      this.zoomOut();
    });
  }

  // Command implementations
  private duplicateSelection(): void {
    const selectedWidgets = this.getSelectedWidgets();
    if (selectedWidgets.length === 0) return;

    const duplicates = selectedWidgets.map(widget => ({
      ...widget,
      id: `${widget.id}-copy-${Date.now()}`,
      x: widget.x + 20,
      y: widget.y + 20,
      selected: false
    }));

    // Add duplicates and select them
    duplicates.forEach(duplicate => {
      this.callbacks.onWidgetUpdate(duplicate.id, duplicate);
    });

    this.selectionManager.selectMultiple(duplicates.map(d => d.id));
  }

  private deleteSelection(): void {
    const selectedIds = this.selectionManager.getSelectedIds();
    if (selectedIds.length === 0) return;

    // Delete each selected widget
    selectedIds.forEach(id => {
      this.callbacks.onWidgetRemove(id);
    });

    // Clear selection after deletion
    this.selectionManager.clearSelection();
  }

  private copySelection(): void {
    const selectedWidgets = this.getSelectedWidgets();
    if (selectedWidgets.length === 0) return;

    // TODO: Implement clipboard functionality
    console.log('Copy widgets:', selectedWidgets);
  }

  private pasteSelection(): void {
    // TODO: Implement clipboard functionality
    console.log('Paste widgets');
  }

  private zoomToFit(): void {
    if (this.widgets.length === 0) return;

    // Calculate bounding box of all widgets
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    this.widgets.forEach(widget => {
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
      scale
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
      scale
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
    const center = this.canvasElement ? {
      x: this.canvasElement.clientWidth / 2,
      y: this.canvasElement.clientHeight / 2
    } : { x: 0, y: 0 };
    
    this.zoomToPoint(center, newScale);
  }

  private zoomOut(): void {
    const newScale = Math.max(this.canvasTransform.scale / 1.2, 0.01);
    const center = this.canvasElement ? {
      x: this.canvasElement.clientWidth / 2,
      y: this.canvasElement.clientHeight / 2
    } : { x: 0, y: 0 };
    
    this.zoomToPoint(center, newScale);
  }

  // Callback handlers
  private handleSelectionChange(selectedIds: string[]): void {
    this.callbacks.onSelectionChange(selectedIds);
  }

  private handleHoverChange(hoveredId: string | null): void {
    this.callbacks.onHoverChange(hoveredId);
  }

  private handleDragStart(widgetIds: string[]): void {
    this.interactionState.isActive = true;
  }

  private handleDragUpdate(delta: Point, widgetIds: string[]): void {
    // Get the initial positions from drag manager to calculate proper deltas
    const initialPositions = this.dragManager.getInitialWidgetPositions();
    
    if (initialPositions.size === 0) return;

    const updates = widgetIds.map(id => {
      const initialPos = initialPositions.get(id);
      if (!initialPos) return null;

      return {
        id,
        updates: {
          x: initialPos.x + delta.x,
          y: initialPos.y + delta.y
        }
      };
    }).filter(Boolean) as Array<{ id: string; updates: Partial<Widget> }>;

    this.callbacks.onWidgetsUpdate(updates);
  }

  private handleDragEnd(delta: Point, widgetIds: string[]): void {
    this.interactionState.isActive = false;
  }

  // Public methods for accessing manager state
  getSelectionBox(): BoundingBox | null {
    return this.selectionManager.getSelectionBox();
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

  // Transform methods
  startTransform(type: 'resize' | 'rotate', handle: string, startPosition: Point): void {
    const selectedWidgets = this.getSelectedWidgets();
    if (selectedWidgets.length === 0) return;

    const bounds = this.selectionManager.getSelectionBounds(this.widgets);
    if (!bounds) return;

    // The startPosition is already in screen coordinates from the SelectionIndicator
    // We need to convert it to canvas coordinates for proper scaling
    if (!this.canvasElement) return;
    
    const rect = this.canvasElement.getBoundingClientRect();
    const canvasStartPosition = {
      x: (startPosition.x - rect.left - this.canvasTransform.x) / this.canvasTransform.scale,
      y: (startPosition.y - rect.top - this.canvasTransform.y) / this.canvasTransform.scale
    };

    this.transformState = {
      isActive: true,
      type,
      handle,
      startPosition: canvasStartPosition,
      initialBounds: bounds,
      initialRotation: selectedWidgets[0]?.rotation || 0
    };

    this.setMode('transform');
    this.interactionState.isActive = true;
    console.log(`🔧 Started ${type} transform with handle: ${handle} at canvas position:`, canvasStartPosition);
  }

  updateTransform(currentPosition: Point): void {
    if (!this.transformState.isActive || !this.transformState.startPosition || !this.transformState.initialBounds) return;

    const selectedWidgets = this.getSelectedWidgets();
    if (selectedWidgets.length === 0) return;

    if (this.transformState.type === 'resize') {
      this.updateResize(currentPosition, selectedWidgets);
    } else if (this.transformState.type === 'rotate') {
      this.updateRotation(currentPosition, selectedWidgets);
    }
  }

  private updateResize(currentPosition: Point, selectedWidgets: Widget[]): void {
    if (!this.transformState.startPosition || !this.transformState.initialBounds) return;

    const handle = this.transformState.handle;
    const startPos = this.transformState.startPosition;
    const initialBounds = this.transformState.initialBounds;
    
    const deltaX = currentPosition.x - startPos.x;
    const deltaY = currentPosition.y - startPos.y;

    let newBounds = { ...initialBounds };

    // Calculate new bounds based on handle position
    switch (handle) {
      case 'nw':
        newBounds.x = initialBounds.x + deltaX;
        newBounds.y = initialBounds.y + deltaY;
        newBounds.width = initialBounds.width - deltaX;
        newBounds.height = initialBounds.height - deltaY;
        break;
      case 'n':
        newBounds.y = initialBounds.y + deltaY;
        newBounds.height = initialBounds.height - deltaY;
        break;
      case 'ne':
        newBounds.y = initialBounds.y + deltaY;
        newBounds.width = initialBounds.width + deltaX;
        newBounds.height = initialBounds.height - deltaY;
        break;
      case 'e':
        newBounds.width = initialBounds.width + deltaX;
        break;
      case 'se':
        newBounds.width = initialBounds.width + deltaX;
        newBounds.height = initialBounds.height + deltaY;
        break;
      case 's':
        newBounds.height = initialBounds.height + deltaY;
        break;
      case 'sw':
        newBounds.x = initialBounds.x + deltaX;
        newBounds.width = initialBounds.width - deltaX;
        newBounds.height = initialBounds.height + deltaY;
        break;
      case 'w':
        newBounds.x = initialBounds.x + deltaX;
        newBounds.width = initialBounds.width - deltaX;
        break;
    }

    // Ensure minimum size
    const minSize = 20;
    if (newBounds.width < minSize) {
      newBounds.width = minSize;
      if (handle.includes('w')) newBounds.x = initialBounds.x + initialBounds.width - minSize;
    }
    if (newBounds.height < minSize) {
      newBounds.height = minSize;
      if (handle.includes('n')) newBounds.y = initialBounds.y + initialBounds.height - minSize;
    }

    // Apply scaling to selected widgets
    const scaleX = newBounds.width / initialBounds.width;
    const scaleY = newBounds.height / initialBounds.height;

    const updates = selectedWidgets.map(widget => {
      const relativeX = (widget.x - initialBounds.x) / initialBounds.width;
      const relativeY = (widget.y - initialBounds.y) / initialBounds.height;
      const relativeWidth = widget.width / initialBounds.width;
      const relativeHeight = widget.height / initialBounds.height;

      return {
        id: widget.id,
        updates: {
          x: newBounds.x + relativeX * newBounds.width,
          y: newBounds.y + relativeY * newBounds.height,
          width: relativeWidth * newBounds.width,
          height: relativeHeight * newBounds.height,
        }
      };
    });

    this.callbacks.onWidgetsUpdate(updates);
  }

  private updateRotation(currentPosition: Point, selectedWidgets: Widget[]): void {
    if (!this.transformState.startPosition || !this.transformState.initialBounds) return;

    const bounds = this.transformState.initialBounds;
    const centerX = bounds.x + bounds.width / 2;
    const centerY = bounds.y + bounds.height / 2;

    // Calculate angles
    const startAngle = Math.atan2(
      this.transformState.startPosition.y - centerY,
      this.transformState.startPosition.x - centerX
    );
    const currentAngle = Math.atan2(
      currentPosition.y - centerY,
      currentPosition.x - centerX
    );

    const deltaAngle = (currentAngle - startAngle) * (180 / Math.PI);
    const newRotation = this.transformState.initialRotation + deltaAngle;

    // Apply rotation to selected widgets
    const updates = selectedWidgets.map(widget => ({
      id: widget.id,
      updates: {
        rotation: newRotation
      }
    }));

    this.callbacks.onWidgetsUpdate(updates);
  }

  endTransform(): void {
    this.transformState = {
      isActive: false,
      type: null,
      handle: null,
      startPosition: null,
      initialBounds: null,
      initialRotation: 0
    };
    this.interactionState.isActive = false;
    console.log('🔧 Transform ended');
  }
}