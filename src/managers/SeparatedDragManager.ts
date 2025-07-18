import { Point, BoundingBox, KeyModifiers, SnapTarget } from '../types/canvas';
import { WidgetData } from '../types/separatedWidgets';
import { useWidgetTransforms } from '../stores/separatedPinboardStore';

export interface SeparatedDragState {
  isDragging: boolean;
  draggedWidgetIds: string[];
  startPosition: Point;
  currentPosition: Point;
  initialWidgetPositions: Map<string, Point>;
  snapTargets: SnapTarget[];
  activeSnap: SnapTarget | null;
}

/**
 * Optimized drag manager for separated widget architecture
 * Only updates widget-data store for maximum performance
 */
export class SeparatedDragManager {
  protected dragState: SeparatedDragState = {
    isDragging: false,
    draggedWidgetIds: [],
    startPosition: { x: 0, y: 0 },
    currentPosition: { x: 0, y: 0 },
    initialWidgetPositions: new Map(),
    snapTargets: [],
    activeSnap: null
  };

  private snapThreshold = 8; // pixels
  private snapEnabled = true;
  private onDragStart?: (widgetIds: string[]) => void;
  private onDragUpdate?: (delta: Point, widgetIds: string[]) => void;
  private onDragEnd?: (delta: Point, widgetIds: string[]) => void;
  private onSnapChange?: (snap: SnapTarget | null) => void;

  // Performance optimization: direct access to widget transform updates
  private updateWidgetTransform: (id: string, transform: { x?: number; y?: number; width?: number; height?: number; rotation?: number }) => void;
  private updateMultipleWidgetTransforms: (updates: Array<{ id: string; transform: { x?: number; y?: number; width?: number; height?: number; rotation?: number } }>) => void;

  constructor(
    onDragStart?: (widgetIds: string[]) => void,
    onDragUpdate?: (delta: Point, widgetIds: string[]) => void,
    onDragEnd?: (delta: Point, widgetIds: string[]) => void,
    onSnapChange?: (snap: SnapTarget | null) => void,
    updateWidgetTransform?: (id: string, transform: { x?: number; y?: number; width?: number; height?: number; rotation?: number }) => void,
    updateMultipleWidgetTransforms?: (updates: Array<{ id: string; transform: { x?: number; y?: number; width?: number; height?: number; rotation?: number } }>) => void
  ) {
    this.onDragStart = onDragStart;
    this.onDragUpdate = onDragUpdate;
    this.onDragEnd = onDragEnd;
    this.onSnapChange = onSnapChange;

    // Get direct access to transform update functions for performance
    this.updateWidgetTransform = updateWidgetTransform || (() => {});
    this.updateMultipleWidgetTransforms = updateMultipleWidgetTransforms || (() => {});
  }

  // Drag state getters
  isDragging(): boolean {
    return this.dragState.isDragging;
  }

  getDraggedWidgetIds(): string[] {
    return [...this.dragState.draggedWidgetIds];
  }

  getActiveSnap(): SnapTarget | null {
    return this.dragState.activeSnap;
  }

  // Configuration
  setSnapEnabled(enabled: boolean): void {
    this.snapEnabled = enabled;
  }

  setSnapThreshold(threshold: number): void {
    this.snapThreshold = threshold;
  }

  // Start dragging
  startDrag(
    widgetIds: string[], 
    startPosition: Point, 
    widgets: WidgetData[]
  ): void {
    if (this.dragState.isDragging) return;

    console.log("🎯 Starting optimized drag for", widgetIds.length, "widgets");

    // Store initial positions
    const initialPositions = new Map<string, Point>();
    widgetIds.forEach(id => {
      const widget = widgets.find(w => w.id === id);
      if (widget) {
        initialPositions.set(id, { x: widget.x, y: widget.y });
      }
    });

    this.dragState = {
      isDragging: true,
      draggedWidgetIds: [...widgetIds],
      startPosition: { ...startPosition },
      currentPosition: { ...startPosition },
      initialWidgetPositions: initialPositions,
      snapTargets: this.generateSnapTargets(widgets, widgetIds),
      activeSnap: null
    };

    this.onDragStart?.(widgetIds);
  }

  // Update drag position with optimized widget updates
  updateDrag(
    currentPosition: Point, 
    modifiers: KeyModifiers
  ): void {
    if (!this.dragState.isDragging) return;

    this.dragState.currentPosition = { ...currentPosition };

    // Calculate raw delta
    let delta = {
      x: currentPosition.x - this.dragState.startPosition.x,
      y: currentPosition.y - this.dragState.startPosition.y
    };

    // Apply constraints
    delta = this.applyConstraints(delta, modifiers);

    // Apply snapping
    if (this.snapEnabled && !modifiers.meta) {
      const snapResult = this.applySnapping(delta);
      delta = snapResult.delta;
      
      if (snapResult.snap !== this.dragState.activeSnap) {
        this.dragState.activeSnap = snapResult.snap;
        this.onSnapChange?.(snapResult.snap);
      }
    } else {
      if (this.dragState.activeSnap) {
        this.dragState.activeSnap = null;
        this.onSnapChange?.(null);
      }
    }

    // PERFORMANCE OPTIMIZATION: Update widget positions directly in widget store
    // This bypasses the general update mechanism and only syncs position data
    this.updateWidgetPositions(delta);

    this.onDragUpdate?.(delta, this.dragState.draggedWidgetIds);
  }

  // End dragging with final position update
  endDrag(): void {
    if (!this.dragState.isDragging) return;

    const delta = {
      x: this.dragState.currentPosition.x - this.dragState.startPosition.x,
      y: this.dragState.currentPosition.y - this.dragState.startPosition.y
    };

    const draggedIds = [...this.dragState.draggedWidgetIds];

    console.log("✅ Ending optimized drag with final delta:", delta);

    // Final position update
    this.updateWidgetPositions(delta);

    // Reset state
    this.dragState = {
      isDragging: false,
      draggedWidgetIds: [],
      startPosition: { x: 0, y: 0 },
      currentPosition: { x: 0, y: 0 },
      initialWidgetPositions: new Map(),
      snapTargets: [],
      activeSnap: null
    };

    this.onSnapChange?.(null);
    this.onDragEnd?.(delta, draggedIds);
  }

  // Cancel dragging and reset positions
  cancelDrag(): void {
    if (!this.dragState.isDragging) return;

    console.log("❌ Canceling drag, resetting positions");

    // Reset to initial positions
    this.updateWidgetPositions({ x: 0, y: 0 });

    this.dragState = {
      isDragging: false,
      draggedWidgetIds: [],
      startPosition: { x: 0, y: 0 },
      currentPosition: { x: 0, y: 0 },
      initialWidgetPositions: new Map(),
      snapTargets: [],
      activeSnap: null
    };

    this.onSnapChange?.(null);
  }

  // PERFORMANCE CRITICAL: Direct widget position updates
  protected updateWidgetPositions(delta: Point): void {
    const updates = this.dragState.draggedWidgetIds.map(id => {
      const initialPos = this.dragState.initialWidgetPositions.get(id);
      if (!initialPos) return null;

      return {
        id,
        transform: {
          x: initialPos.x + delta.x,
          y: initialPos.y + delta.y,
        }
      };
    }).filter(Boolean) as Array<{ id: string; transform: { x: number; y: number } }>;

    // Batch update all widget positions in a single store operation
    // This is much more efficient than individual updates
    this.updateMultipleWidgetTransforms(updates);
  }

  // Apply movement constraints
  private applyConstraints(delta: Point, modifiers: KeyModifiers): Point {
    let constrainedDelta = { ...delta };

    // Shift key: constrain to 45-degree angles
    if (modifiers.shift) {
      constrainedDelta = this.constrainTo45Degrees(delta);
    }

    return constrainedDelta;
  }

  // Constrain movement to 45-degree angles
  private constrainTo45Degrees(delta: Point): Point {
    const absX = Math.abs(delta.x);
    const absY = Math.abs(delta.y);

    if (absX > absY * 2) {
      // Horizontal movement
      return { x: delta.x, y: 0 };
    } else if (absY > absX * 2) {
      // Vertical movement
      return { x: 0, y: delta.y };
    } else {
      // Diagonal movement - make it exactly 45 degrees
      const sign = Math.sign(delta.x * delta.y);
      const magnitude = Math.max(absX, absY);
      return {
        x: Math.sign(delta.x) * magnitude,
        y: sign * Math.sign(delta.x) * magnitude
      };
    }
  }

  // Generate snap targets from other widgets (only using widget data)
  private generateSnapTargets(widgets: WidgetData[], excludeIds: string[]): SnapTarget[] {
    const targets: SnapTarget[] = [];
    const excludeSet = new Set(excludeIds);

    widgets.forEach(widget => {
      if (excludeSet.has(widget.id)) return;

      // Add edge snap targets
      targets.push(
        // Left edge
        {
          type: 'widget',
          position: { x: widget.x, y: widget.y + widget.height / 2 },
          orientation: 'vertical',
          strength: 1
        },
        // Right edge
        {
          type: 'widget',
          position: { x: widget.x + widget.width, y: widget.y + widget.height / 2 },
          orientation: 'vertical',
          strength: 1
        },
        // Top edge
        {
          type: 'widget',
          position: { x: widget.x + widget.width / 2, y: widget.y },
          orientation: 'horizontal',
          strength: 1
        },
        // Bottom edge
        {
          type: 'widget',
          position: { x: widget.x + widget.width / 2, y: widget.y + widget.height },
          orientation: 'horizontal',
          strength: 1
        },
        // Center lines
        {
          type: 'widget',
          position: { x: widget.x + widget.width / 2, y: widget.y + widget.height / 2 },
          orientation: 'vertical',
          strength: 0.8
        },
        {
          type: 'widget',
          position: { x: widget.x + widget.width / 2, y: widget.y + widget.height / 2 },
          orientation: 'horizontal',
          strength: 0.8
        }
      );
    });

    // Add grid snap targets (every 10 pixels)
    const gridSize = 10;
    for (let x = 0; x <= 2000; x += gridSize) {
      targets.push({
        type: 'grid',
        position: { x, y: 0 },
        orientation: 'vertical',
        strength: 0.3
      });
    }
    for (let y = 0; y <= 2000; y += gridSize) {
      targets.push({
        type: 'grid',
        position: { x: 0, y },
        orientation: 'horizontal',
        strength: 0.3
      });
    }

    return targets;
  }

  // Apply snapping to movement delta
  private applySnapping(delta: Point): { delta: Point; snap: SnapTarget | null } {
    if (!this.snapEnabled || this.dragState.draggedWidgetIds.length === 0) {
      return { delta, snap: null };
    }

    // Get the first dragged widget's new position for snapping calculations
    const firstWidgetId = this.dragState.draggedWidgetIds[0];
    const initialPos = this.dragState.initialWidgetPositions.get(firstWidgetId);
    if (!initialPos) return { delta, snap: null };

    const newPos = {
      x: initialPos.x + delta.x,
      y: initialPos.y + delta.y
    };

    let bestSnap: SnapTarget | null = null;
    let bestDistance = this.snapThreshold;
    let snapDelta = { ...delta };

    // Check horizontal snaps
    for (const target of this.dragState.snapTargets) {
      if (target.orientation === 'horizontal') {
        const distance = Math.abs(newPos.y - target.position.y);
        if (distance < bestDistance * target.strength) {
          bestDistance = distance;
          bestSnap = target;
          snapDelta.y = target.position.y - initialPos.y;
        }
      }
    }

    // Check vertical snaps
    bestDistance = this.snapThreshold;
    for (const target of this.dragState.snapTargets) {
      if (target.orientation === 'vertical') {
        const distance = Math.abs(newPos.x - target.position.x);
        if (distance < bestDistance * target.strength) {
          bestDistance = distance;
          if (!bestSnap || target.strength >= bestSnap.strength) {
            bestSnap = target;
            snapDelta.x = target.position.x - initialPos.x;
          }
        }
      }
    }

    return { delta: snapDelta, snap: bestSnap };
  }

  // Get snap indicators for rendering
  getSnapIndicators(): SnapTarget[] {
    return this.dragState.activeSnap ? [this.dragState.activeSnap] : [];
  }

  // Utility method to check if a point is being dragged
  isPointBeingDragged(point: Point): boolean {
    if (!this.dragState.isDragging) return false;

    const threshold = 5; // pixels
    const distance = Math.sqrt(
      Math.pow(point.x - this.dragState.currentPosition.x, 2) +
      Math.pow(point.y - this.dragState.currentPosition.y, 2)
    );

    return distance < threshold;
  }

  // Get initial widget positions for proper delta calculation
  getInitialWidgetPositions(): Map<string, Point> {
    return new Map(this.dragState.initialWidgetPositions);
  }

  // Performance monitoring
  getPerformanceMetrics(): {
    isDragging: boolean;
    draggedCount: number;
    snapTargetCount: number;
    hasActiveSnap: boolean;
  } {
    return {
      isDragging: this.dragState.isDragging,
      draggedCount: this.dragState.draggedWidgetIds.length,
      snapTargetCount: this.dragState.snapTargets.length,
      hasActiveSnap: !!this.dragState.activeSnap,
    };
  }
}

// ============================================================================
// PERFORMANCE COMPARISON UTILITIES
// ============================================================================

/**
 * Performance monitor for drag operations
 */
export class DragPerformanceMonitor {
  private metrics = {
    updateTimes: [] as number[],
    updateCount: 0,
    totalDataSynced: 0, // bytes
    averageUpdateTime: 0,
  };

  recordUpdate(startTime: number, dataSynced: number): void {
    const duration = performance.now() - startTime;
    this.metrics.updateTimes.push(duration);
    this.metrics.updateCount++;
    this.metrics.totalDataSynced += dataSynced;

    // Keep only last 100 measurements
    if (this.metrics.updateTimes.length > 100) {
      this.metrics.updateTimes.shift();
    }

    // Update average
    this.metrics.averageUpdateTime = 
      this.metrics.updateTimes.reduce((a, b) => a + b, 0) / this.metrics.updateTimes.length;
  }

  getMetrics() {
    return {
      ...this.metrics,
      maxUpdateTime: this.metrics.updateTimes.length > 0 ? Math.max(...this.metrics.updateTimes) : 0,
      minUpdateTime: this.metrics.updateTimes.length > 0 ? Math.min(...this.metrics.updateTimes) : 0,
      averageDataPerUpdate: this.metrics.updateCount > 0 ? this.metrics.totalDataSynced / this.metrics.updateCount : 0,
    };
  }

  reset(): void {
    this.metrics = {
      updateTimes: [],
      updateCount: 0,
      totalDataSynced: 0,
      averageUpdateTime: 0,
    };
  }
}

// Global performance monitor
export const dragPerformanceMonitor = new DragPerformanceMonitor();

/**
 * Create a monitored drag manager instance
 */
export function createMonitoredDragManager(
  onDragStart?: (widgetIds: string[]) => void,
  onDragUpdate?: (delta: Point, widgetIds: string[]) => void,
  onDragEnd?: (delta: Point, widgetIds: string[]) => void,
  onSnapChange?: (snap: SnapTarget | null) => void,
  updateWidgetTransform?: (id: string, transform: { x?: number; y?: number; width?: number; height?: number; rotation?: number }) => void,
  updateMultipleWidgetTransforms?: (updates: Array<{ id: string; transform: { x?: number; y?: number; width?: number; height?: number; rotation?: number } }>) => void
): SeparatedDragManager {
  const manager = new SeparatedDragManager(
    onDragStart,
    onDragUpdate,
    onDragEnd,
    onSnapChange,
    updateWidgetTransform,
    updateMultipleWidgetTransforms
  );

  // Wrap updateWidgetPositions with monitoring
  const originalUpdatePositions = manager['updateWidgetPositions'].bind(manager);
  manager['updateWidgetPositions'] = function(delta: Point) {
    const startTime = performance.now();
    originalUpdatePositions(delta);
    
    // Estimate data synced (only position data for each widget)
    const dataSynced = manager['dragState'].draggedWidgetIds.length * 16; // 2 numbers * 8 bytes each
    dragPerformanceMonitor.recordUpdate(startTime, dataSynced);
  };

  return manager;
}