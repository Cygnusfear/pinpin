// ============================================================================
// WIDGET DATA - Lightweight, frequently updated properties
// ============================================================================
// Generic widget architecture for extensible content types

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

// Specific widget types
export interface ImageWidget extends BaseWidget {
  type: "image";
  src: string;
  alt?: string;
  originalDimensions: { width: number; height: number };
  filters?: {
    brightness?: number;
    contrast?: number;
    saturation?: number;
    blur?: number;
  };
}

export interface DocumentWidget extends BaseWidget {
  type: "document";
  fileName: string;
  fileType: string;
  fileSize: number;
  mimeType: string;
  content?: string; // For text files
  thumbnail?: string;
  downloadUrl?: string;
  previewUrl?: string;
}

export interface UrlWidget extends BaseWidget {
  type: "url";
  url: string;
  title?: string;
  description?: string;
  favicon?: string;
  preview?: string;
  embedType?: "link" | "iframe" | "video" | "image";
  embedData?: {
    html?: string;
    aspectRatio?: number;
    autoplay?: boolean;
  };
}

export interface NoteWidget extends BaseWidget {
  type: "note";
  content: string;
  backgroundColor: string;
  textColor: string;
  fontSize: number;
  fontFamily: string;
  textAlign: "left" | "center" | "right";
  formatting?: {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
  };
}

export interface AppWidget extends BaseWidget {
  type: "app";
  appId: string;
  appName: string;
  appVersion: string;
  config: Record<string, any>;
  iframe?: string;
  permissions?: string[];
  state?: Record<string, any>;
}

export interface GroupWidget extends BaseWidget {
  type: "group";
  children: string[]; // Widget IDs
  collapsed: boolean;
  backgroundColor?: string;
  borderColor?: string;
  label?: string;
}

export interface UnknownWidget extends BaseWidget {
  type: "unknown";
  originalData: any;
  originalType?: string;
  fallbackRepresentation: "icon" | "text" | "preview";
  errorMessage?: string;
}

export interface LoadingWidget extends BaseWidget {
  type: "loading";
  message?: string;
}

export interface ErrorWidget extends BaseWidget {
  type: "error";
  errorMessage: string;
  originalType?: string;
}

// Union type for all widgets
export type Widget =
  | ImageWidget
  | DocumentWidget
  | UrlWidget
  | NoteWidget
  | AppWidget
  | GroupWidget
  | UnknownWidget
  | LoadingWidget
  | ErrorWidget;

// Widget creation data (without id, timestamps, etc.)
export type WidgetCreateData<T extends Widget = Widget> = Omit<
  T,
  "id" | "createdAt" | "updatedAt" | "selected" | "zIndex"
>;

// Widget update data (partial updates)
export type WidgetUpdateData<T extends Widget = Widget> = Partial<
  Omit<T, "id" | "type" | "createdAt">
> & {
  updatedAt: number;
};

// Widget type registry for extensibility
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
}

// Widget capabilities
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

// Widget state for rendering
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

// Widget events
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

// Widget validation
export interface WidgetValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// Widget serialization
export interface WidgetSerializationOptions {
  includeMetadata: boolean;
  includeContent: boolean;
  compressImages: boolean;
  format: "json" | "binary";
}

// Widget import/export
export interface WidgetExportData {
  widget: Widget;
  assets?: Array<{
    id: string;
    type: string;
    data: string | ArrayBuffer;
    mimeType: string;
  }>;
  dependencies?: string[];
}

// Widget factory interface
export interface WidgetFactory<T extends Widget = Widget> {
  type: string;
  canHandle(data: any): boolean;
  create(
    data: any,
    position: { x: number; y: number },
  ): Promise<WidgetCreateData<T>>;
  validate(widget: T): WidgetValidationResult;
  serialize(
    widget: T,
    options: WidgetSerializationOptions,
  ): Promise<WidgetExportData>;
  deserialize(data: WidgetExportData): Promise<T>;
  getDefaultSize(): { width: number; height: number };
  getCapabilities(): WidgetCapabilities;
}

// Widget renderer interface
export interface WidgetRenderer<T extends Widget = Widget> {
  type: string;
  component: React.ComponentType<WidgetRendererProps<T>>;
  toolbar?: React.ComponentType<WidgetToolbarProps<T>>;
  inspector?: React.ComponentType<WidgetInspectorProps<T>>;
  contextMenu?: React.ComponentType<WidgetContextMenuProps<T>>;
}

export interface WidgetRendererProps<T extends Widget = Widget> {
  widget: T;
  state: WidgetRenderState;
  events: WidgetEvents;
  canvasTransform: { x: number; y: number; scale: number };
}

export interface WidgetToolbarProps<T extends Widget = Widget> {
  widget: T;
  onUpdate: (updates: Partial<T>) => void;
}

export interface WidgetInspectorProps<T extends Widget = Widget> {
  widget: T;
  onUpdate: (updates: Partial<T>) => void;
}

export interface WidgetContextMenuProps<T extends Widget = Widget> {
  widget: T;
  position: { x: number; y: number };
  onAction: (action: string) => void;
  onClose: () => void;
}

// Widget registry for managing types
export interface WidgetRegistry {
  registerType(definition: WidgetTypeDefinition): void;
  unregisterType(type: string): void;
  getType(type: string): WidgetTypeDefinition | undefined;
  getAllTypes(): WidgetTypeDefinition[];
  getTypesByCategory(category: string): WidgetTypeDefinition[];

  registerFactory<T extends Widget>(factory: WidgetFactory<T>): void;
  unregisterFactory(type: string): void;
  getFactory<T extends Widget>(type: string): WidgetFactory<T> | undefined;

  registerRenderer<T extends Widget>(renderer: WidgetRenderer<T>): void;
  unregisterRenderer(type: string): void;
  getRenderer<T extends Widget>(type: string): WidgetRenderer<T> | undefined;
}

// Widget plugin interface for extensibility
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

/**
 * Widget data contains only the lightweight properties that change frequently
 * during interactions (drag, resize, rotate, etc.)
 */
export interface WidgetData {
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
  metadata: Record<string, unknown>;

  // Timestamps
  createdAt: number;
  updatedAt: number;
}

// ============================================================================
// CONTENT DATA - Heavy, rarely updated properties
// ============================================================================

/**
 * Base content data interface
 */
export interface BaseContentData {
  id: string; // Content hash for deduplication
  type: string; // Widget type
  lastModified: number;
  size?: number; // Content size in bytes for cache management
}

/**
 * Image widget content data
 */
export interface ImageContentData extends BaseContentData {
  type: "image";
  src: string;
  alt?: string;
  originalDimensions: { width: number; height: number };
  filters?: {
    brightness?: number;
    contrast?: number;
    saturation?: number;
    blur?: number;
  };
}

/**
 * Note widget content data
 */
export interface NoteContentData extends BaseContentData {
  type: "note";
  content: string;
  backgroundColor: string;
  textColor: string;
  fontSize: number;
  fontFamily: string;
  textAlign: "left" | "center" | "right";
  formatting?: {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
  };
}

/**
 * Document widget content data
 */
export interface DocumentContentData extends BaseContentData {
  type: "document";
  fileName: string;
  fileType: string;
  fileSize: number;
  mimeType: string;
  content?: string; // For text files
  thumbnail?: string;
  downloadUrl?: string;
  previewUrl?: string;
}

/**
 * URL widget content data
 */
export interface UrlContentData extends BaseContentData {
  type: "url";
  url: string;
  title?: string;
  description?: string;
  favicon?: string;
  preview?: string;
  embedType?: "link" | "iframe" | "video" | "image";
  embedData?: {
    html?: string;
    aspectRatio?: number;
    autoplay?: boolean;
  };
}

/**
 * App widget content data
 */
export interface AppContentData extends BaseContentData {
  type: "app";
  appId: string;
  appName: string;
  appVersion: string;
  config: Record<string, unknown>;
  iframe?: string;
  permissions?: string[];
  state?: Record<string, unknown>;
}

/**
 * Group widget content data
 */
export interface GroupContentData extends BaseContentData {
  type: "group";
  children: string[]; // Widget IDs
  collapsed: boolean;
  backgroundColor?: string;
  borderColor?: string;
  label?: string;
}

/**
 * Unknown widget content data
 */
export interface UnknownContentData extends BaseContentData {
  type: "unknown";
  originalData: unknown;
  originalType?: string;
  fallbackRepresentation: "icon" | "text" | "preview";
  errorMessage?: string;
}

// Union type for all content data
export type ContentData =
  | ImageContentData
  | NoteContentData
  | DocumentContentData
  | UrlContentData
  | AppContentData
  | GroupContentData
  | UnknownContentData;

// ============================================================================
// COMPOSED WIDGET - Combines widget data and content data
// ============================================================================

/**
 * Composed widget that combines widget data with content data
 * This is what components will receive for rendering
 */
export interface ComposedWidget extends WidgetData {
  content: ContentData;
  isContentLoaded: boolean;
  contentError?: string;
}

// ============================================================================
// CREATION AND UPDATE TYPES
// ============================================================================

/**
 * Widget data creation type (without id, timestamps, etc.)
 */
export type WidgetDataCreateData = Omit<
  WidgetData,
  "id" | "createdAt" | "updatedAt" | "selected" | "zIndex" | "contentId"
>;

/**
 * Content data creation type (without id, timestamps, etc.)
 */
export type ContentDataCreateData<T extends ContentData = ContentData> = Omit<
  T,
  "id" | "lastModified" | "size"
>;

/**
 * Widget data update type (partial updates)
 */
export type WidgetDataUpdateData = Partial<
  Omit<WidgetData, "id" | "type" | "createdAt" | "contentId">
> & {
  updatedAt: number;
};

/**
 * Content data update type (partial updates)
 */
export type ContentDataUpdateData<T extends ContentData = ContentData> =
  Partial<Omit<T, "id" | "type">> & {
    lastModified: number;
  };

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Content hash function result
 */
export interface ContentHash {
  hash: string;
  size: number;
}

/**
 * Widget creation input that will be split into widget data and content data
 */
export interface LocalWidgetCreateInput {
  // Widget data properties
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  locked?: boolean;
  metadata?: Record<string, unknown>;

  // Content data (type-specific)
  content: unknown;
}
