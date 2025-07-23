import type { BoundingBox, KeyModifiers, Point, Widget } from "../types/canvas";

export class SelectionManager {
  private selectedIds = new Set<string>();
  private hoveredId: string | null = null;
  private selectionBox: BoundingBox | null = null;
  private onSelectionChange?: (selectedIds: string[]) => void;
  private onHoverChange?: (hoveredId: string | null) => void;

  constructor(
    onSelectionChange?: (selectedIds: string[]) => void,
    onHoverChange?: (hoveredId: string | null) => void,
  ) {
    this.onSelectionChange = onSelectionChange;
    this.onHoverChange = onHoverChange;
  }

  // Selection state getters
  getSelectedIds(): string[] {
    return Array.from(this.selectedIds);
  }

  getHoveredId(): string | null {
    return this.hoveredId;
  }

  getSelectionBox(): BoundingBox | null {
    return this.selectionBox;
  }

  isSelected(id: string): boolean {
    return this.selectedIds.has(id);
  }

  hasSelection(): boolean {
    return this.selectedIds.size > 0;
  }

  getSelectionCount(): number {
    return this.selectedIds.size;
  }

  // Core selection methods
  selectSingle(id: string): void {
    this.selectedIds.clear();
    this.selectedIds.add(id);
    this.notifySelectionChange();
  }

  selectMultiple(ids: string[], additive = false): void {
    if (!additive) {
      this.selectedIds.clear();
    }
    ids.forEach((id) => this.selectedIds.add(id));
    this.notifySelectionChange();
  }

  toggleSelection(id: string): void {
    if (this.selectedIds.has(id)) {
      this.selectedIds.delete(id);
    } else {
      this.selectedIds.add(id);
    }
    this.notifySelectionChange();
  }

  addToSelection(id: string): void {
    this.selectedIds.add(id);
    this.notifySelectionChange();
  }

  removeFromSelection(id: string): void {
    this.selectedIds.delete(id);
    this.notifySelectionChange();
  }

  selectAll(widgets: Widget[]): void {
    this.selectedIds.clear();
    widgets.forEach((widget) => this.selectedIds.add(widget.id));
    this.notifySelectionChange();
  }

  clearSelection(): void {
    this.selectedIds.clear();
    this.notifySelectionChange();
  }

  // Area selection
  selectInArea(area: BoundingBox, widgets: Widget[], additive = false): void {
    if (!additive) {
      this.selectedIds.clear();
    }

    widgets.forEach((widget) => {
      if (this.isWidgetInArea(widget, area)) {
        this.selectedIds.add(widget.id);
      }
    });

    this.notifySelectionChange();
  }

  startAreaSelection(startPoint: Point): void {
    this.selectionBox = {
      x: startPoint.x,
      y: startPoint.y,
      width: 0,
      height: 0,
    };
  }

  updateAreaSelection(currentPoint: Point): void {
    if (!this.selectionBox) return;

    const startX = this.selectionBox.x;
    const startY = this.selectionBox.y;

    this.selectionBox = {
      x: Math.min(startX, currentPoint.x),
      y: Math.min(startY, currentPoint.y),
      width: Math.abs(currentPoint.x - startX),
      height: Math.abs(currentPoint.y - startY),
    };
  }

  endAreaSelection(widgets: Widget[], additive = false): void {
    if (this.selectionBox) {
      this.selectInArea(this.selectionBox, widgets, additive);
    }
    this.selectionBox = null;
  }

  cancelAreaSelection(): void {
    this.selectionBox = null;
  }

  // Hover management
  setHovered(id: string | null): void {
    if (this.hoveredId !== id) {
      this.hoveredId = id;
      this.onHoverChange?.(id);
    }
  }

  // Advanced selection methods
  selectSimilar(targetId: string, widgets: Widget[]): void {
    const targetWidget = widgets.find((w) => w.id === targetId);
    if (!targetWidget) return;

    this.selectedIds.clear();
    widgets.forEach((widget) => {
      if (widget.type === targetWidget.type) {
        this.selectedIds.add(widget.id);
      }
    });

    this.notifySelectionChange();
  }

  selectByType(type: string, widgets: Widget[]): void {
    this.selectedIds.clear();
    widgets.forEach((widget) => {
      if (widget.type === type) {
        this.selectedIds.add(widget.id);
      }
    });

    this.notifySelectionChange();
  }

  // Figma-style click behavior
  handleClick(
    point: Point,
    widgets: Widget[],
    modifiers: KeyModifiers,
    hitWidget?: Widget,
  ): void {
    if (!hitWidget) {
      // Clicked on canvas
      if (!modifiers.meta && !modifiers.shift) {
        this.clearSelection();
      }
      return;
    }

    if (modifiers.alt) {
      // Deep select - select through groups (for future group support)
      this.selectDeep(point, widgets);
    } else if (modifiers.meta || modifiers.ctrl) {
      // Toggle selection
      this.toggleSelection(hitWidget.id);
    } else if (modifiers.shift) {
      // Add to selection
      this.addToSelection(hitWidget.id);
    } else {
      // Single select
      this.selectSingle(hitWidget.id);
    }
  }

  // Helper methods
  private isWidgetInArea(widget: Widget, area: BoundingBox): boolean {
    // Check if widget intersects with selection area
    return !(
      widget.x > area.x + area.width ||
      widget.x + widget.width < area.x ||
      widget.y > area.y + area.height ||
      widget.y + widget.height < area.y
    );
  }

  private selectDeep(point: Point, widgets: Widget[]): void {
    // For now, just select the topmost widget at the point
    // Later this will handle selecting through groups
    const hitWidget = this.getWidgetAtPoint(point, widgets);
    if (hitWidget) {
      this.selectSingle(hitWidget.id);
    }
  }

  private getWidgetAtPoint(point: Point, widgets: Widget[]): Widget | null {
    // Find the topmost widget at the given point
    const sortedWidgets = [...widgets].sort((a, b) => b.zIndex - a.zIndex);

    for (const widget of sortedWidgets) {
      if (this.isPointInWidget(point, widget)) {
        return widget;
      }
    }

    return null;
  }

  private isPointInWidget(point: Point, widget: Widget): boolean {
    return (
      point.x >= widget.x &&
      point.x <= widget.x + widget.width &&
      point.y >= widget.y &&
      point.y <= widget.y + widget.height
    );
  }

  private notifySelectionChange(): void {
    this.onSelectionChange?.(this.getSelectedIds());
  }

  // Calculate bounds of current selection
  getSelectionBounds(widgets: Widget[]): BoundingBox | null {
    if (this.selectedIds.size === 0) return null;

    const selectedWidgets = widgets.filter((w) => this.selectedIds.has(w.id));
    if (selectedWidgets.length === 0) return null;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    selectedWidgets.forEach((widget) => {
      minX = Math.min(minX, widget.x);
      minY = Math.min(minY, widget.y);
      maxX = Math.max(maxX, widget.x + widget.width);
      maxY = Math.max(maxY, widget.y + widget.height);
    });

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }
}
