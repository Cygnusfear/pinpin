// Core canvas and interaction types
export interface Point {
  x: number;
  y: number;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CanvasTransform {
  x: number;
  y: number;
  scale: number;
}

export type InteractionMode =
  | 'select'      // Default mode - selection and manipulation
  | 'hand'        // Pan mode (space key held)
  | 'zoom'        // Zoom mode (z key or zoom tool)
  | 'text'        // Text editing mode
  | 'draw'        // Drawing/annotation mode
  | 'resize'      // Active resizing
  | 'rotate'      // Active rotation
  | 'transform'   // Active transformation (resize/rotate handles)
  | 'drag'        // Active dragging widgets
  | 'area-select' // Area selection (marquee)
  | 'drop-target'; // File drop mode

export interface KeyModifiers {
  shift: boolean;
  ctrl: boolean;
  alt: boolean;
  meta: boolean;
}

export interface InteractionState {
  mode: InteractionMode;
  isActive: boolean;
  startPosition?: Point;
  currentPosition?: Point;
  modifiers: KeyModifiers;
  tool?: string;
  context?: any;
}

export interface TransformHandle {
  type: 'resize' | 'rotate' | 'move';
  position: 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'center' | 'rotation';
  cursor: string;
  bounds: BoundingBox;
}

export interface SnapTarget {
  type: 'widget' | 'grid' | 'guide';
  position: Point;
  orientation: 'horizontal' | 'vertical';
  strength: number; // Snap strength/priority
}

// Widget base interface (will be expanded later)
export interface BaseWidget {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  locked: boolean;
  selected: boolean;
  metadata: Record<string, any>;
  createdAt: number;
  updatedAt: number;
}

// Re-export Widget from widgets.ts to maintain compatibility
export type { Widget } from './widgets';