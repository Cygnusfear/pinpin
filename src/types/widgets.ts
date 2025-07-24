import type React from "react";

/**
 * Widget - Lightweight positioning and metadata
 * Contains only frequently updated properties for optimal performance
 */
export interface Widget {
  // Core identification
  id: string;
  type: string;

  // Position and transform properties (frequently updated)
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;

  // State properties (frequently updated)
  locked: boolean;
  selected: boolean;

  // Content reference (links to content store)
  contentId: string; // Hash-based reference to content

  // Metadata (lightweight only)
  metadata: Record<string, any>;

  // Timestamps
  createdAt: number;
  updatedAt: number;
}

/**
 * WidgetContent - Heavy content data
 * Stored separately for performance and deduplication
 */
export interface WidgetContent<T = any> {
  // Content identification
  id: string; // Content hash for deduplication
  type: string; // Widget type
  data: T; // Type-specific content data
  lastModified: number;
  size?: number; // Content size in bytes for cache management
}

/**
 * HydratedWidget - Combined widget and content for rendering
 * This is what components receive for rendering
 */
export interface HydratedWidget<T = any> extends Widget {
  content: WidgetContent<T>; // Loaded content data
  isContentLoaded: boolean; // Whether content is loaded
  contentError?: string; // Error message if content failed to load
}

/**
 * CreateWidgetInput - Input for creating new widgets
 */
export interface CreateWidgetInput {
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  locked?: boolean;
  metadata?: Record<string, any>;
  content: any; // Widget-specific content data
}

// ============================================================================
// WIDGET LIFECYCLE AND INTERACTION TYPES
// ============================================================================

/**
 * Widget render state for components
 */
export interface WidgetRenderState {
  isSelected: boolean;
  isHovered: boolean;
  isEditing: boolean;
  isLoading: boolean;
  hasError: boolean;
  errorMessage?: string;
  transform: {
    x: number;
    y: number;
    scale: number;
    rotation: number;
  };
}

/**
 * Widget events for component interaction
 */
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

/**
 * Canvas transform for rendering context
 */
export interface CanvasTransform {
  x: number; // Pan X
  y: number; // Pan Y
  scale: number; // Zoom scale
}

// ============================================================================
// WIDGET FACTORY INTERFACE - UNIFIED PATTERN
// ============================================================================

/**
 * Position input for widget creation
 */
export interface Position {
  x: number;
  y: number;
}

/**
 * Widget capabilities definition
 */
export interface WidgetCapabilities {
  canResize: boolean;
  canRotate: boolean;
  canEdit: boolean;
  canConfigure: boolean;
  canGroup: boolean;
  canDuplicate: boolean;
  canExport: boolean;
  hasContextMenu: boolean;
  hasToolbar: boolean;
  hasInspector: boolean;
}

/**
 * Widget validation result
 */
export interface WidgetValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Widget serialization options
 */
export interface SerializationOptions {
  includeMetadata: boolean;
  includeContent: boolean;
  compressImages: boolean;
  format: "json" | "binary";
}

/**
 * Widget export data
 */
export interface WidgetExportData {
  widget: HydratedWidget;
  assets?: Array<{
    id: string;
    type: string;
    data: string | ArrayBuffer;
    mimeType: string;
  }>;
  dependencies?: string[];
}

export type RootWidgetFactory = {};

/**
 * Widget factory interface - unified pattern
 */
export interface WidgetFactory<T = any> {
  type: string; // Widget type handled by factory

  canHandle(data: any): boolean; // Whether factory can handle input
  create(data: any, position: Position): Promise<CreateWidgetInput>;
  getDemoDefaults?(): any; // Get demo defaults for manual widget creation
  validate?(widget: HydratedWidget<T>): WidgetValidationResult;
  serialize?(
    widget: HydratedWidget<T>,
    options: SerializationOptions,
  ): Promise<WidgetExportData>;
  deserialize?(data: WidgetExportData): Promise<HydratedWidget<T>>;
  getDefaultSize(type?: string): { width: number; height: number };
  getCapabilities(type?: string): WidgetCapabilities;
}

// ============================================================================
// WIDGET RENDERER INTERFACE - UNIFIED PATTERN
// ============================================================================

/**
 * Widget renderer props
 */
export interface WidgetRendererProps<T = any> {
  widget: HydratedWidget<T>; // Widget with loaded content
  state: WidgetRenderState; // Render state
  events: WidgetEvents; // Event handlers
  canvasTransform: CanvasTransform; // Canvas transform
}

/**
 * Widget toolbar props
 */
export interface WidgetToolbarProps<T = any> {
  widget: HydratedWidget<T>;
  onUpdate: (updates: Partial<T>) => void;
}

/**
 * Widget inspector props
 */
export interface WidgetInspectorProps<T = any> {
  widget: HydratedWidget<T>;
  onUpdate: (updates: Partial<T>) => void;
}

/**
 * Widget context menu props
 */
export interface WidgetContextMenuProps<T = any> {
  widget: HydratedWidget<T>;
  position: { x: number; y: number };
  onAction: (action: string) => void;
  onClose: () => void;
}

/**
 * Widget renderer interface
 */
export interface WidgetRenderer<T = any> {
  type: string; // Widget type handled by renderer
  component: React.ComponentType<WidgetRendererProps<T>>;
  toolbar?: React.ComponentType<WidgetToolbarProps<T>>;
  inspector?: React.ComponentType<WidgetInspectorProps<T>>;
  contextMenu?: React.ComponentType<WidgetContextMenuProps<T>>;
}

// ============================================================================
// WIDGET REGISTRY INTERFACE - SIMPLIFIED
// ============================================================================

/**
 * Widget type definition for registry
 */
export interface WidgetTypeDefinition {
  type: string;
  name: string;
  description: string;
  icon: string;
  category: "media" | "document" | "web" | "text" | "app" | "layout" | "other";
  defaultSize: { width: number; height: number };
  minSize: { width: number; height: number };
  maxSize?: { width: number; height: number };
  aspectRatioLocked?: boolean;
  resizable: boolean;
  rotatable: boolean;
  configurable: boolean;
  supportedMimeTypes?: string[];
  supportedExtensions?: string[];
  autoCreateOnly?: boolean;
}

/**
 * Widget registry interface - simplified
 */
export interface WidgetRegistry {
  registerType(definition: WidgetTypeDefinition): void;
  unregisterType(type: string): void;
  getType(type: string): WidgetTypeDefinition | undefined;
  getAllTypes(): WidgetTypeDefinition[];
  getTypesByCategory(category: string): WidgetTypeDefinition[];

  registerFactory<T>(factory: WidgetFactory<T>): void;
  unregisterFactory(type: string): void;
  getFactory<T>(type: string): WidgetFactory<T> | undefined;

  registerRenderer<T>(renderer: WidgetRenderer<T>): void;
  unregisterRenderer(type: string): void;
  getRenderer<T>(type: string): WidgetRenderer<T> | undefined;
}

// ============================================================================
// WIDGET PLUGIN INTERFACE - UNIFIED PATTERN
// ============================================================================

/**
 * Widget plugin interface for extensibility
 */
export interface WidgetPlugin {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;

  types?: WidgetTypeDefinition[];
  factories?: WidgetFactory[];
  renderers?: WidgetRenderer[];

  install(registry: WidgetRegistry): Promise<void>;
  uninstall(registry: WidgetRegistry): Promise<void>;
}

// ============================================================================
// UPDATE AND TRANSFORM TYPES
// ============================================================================

/**
 * Transform update for performance-critical operations
 */
export interface TransformUpdate {
  id: string;
  transform: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    rotation?: number;
  };
}

/**
 * Cache statistics for content store
 */
export interface CacheStats {
  totalSize: number;
  itemCount: number;
  hitRate: number;
  lastCleanup: number;
}

// ============================================================================
// ERROR TYPES
// ============================================================================

/**
 * Widget not found error
 */
export class WidgetNotFoundError extends Error {
  constructor(id: string) {
    super(`Widget with ID "${id}" not found`);
    this.name = "WidgetNotFoundError";
  }
}

/**
 * Content not found error
 */
export class ContentNotFoundError extends Error {
  constructor(contentId: string) {
    super(`Content with ID "${contentId}" not found`);
    this.name = "ContentNotFoundError";
  }
}

/**
 * Factory not found error
 */
export class FactoryNotFoundError extends Error {
  constructor(type: string) {
    super(`Factory for widget type "${type}" not found`);
    this.name = "FactoryNotFoundError";
  }
}

/**
 * Renderer not found error
 */
export class RendererNotFoundError extends Error {
  constructor(type: string) {
    super(`Renderer for widget type "${type}" not found`);
    this.name = "RendererNotFoundError";
  }
}

// ============================================================================
// EXPORTS - All types are exported inline above
// ============================================================================
