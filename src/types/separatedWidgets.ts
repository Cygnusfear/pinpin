// Separated widget architecture types
// This file defines the new dual-store architecture for widgets

import { BaseWidget } from './widgets';

// ============================================================================
// WIDGET DATA - Lightweight, frequently updated properties
// ============================================================================

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
  metadata: Record<string, any>;
  
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
  type: 'image';
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
  type: 'note';
  content: string;
  backgroundColor: string;
  textColor: string;
  fontSize: number;
  fontFamily: string;
  textAlign: 'left' | 'center' | 'right';
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
  type: 'document';
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
  type: 'url';
  url: string;
  title?: string;
  description?: string;
  favicon?: string;
  preview?: string;
  embedType?: 'link' | 'iframe' | 'video' | 'image';
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
  type: 'app';
  appId: string;
  appName: string;
  appVersion: string;
  config: Record<string, any>;
  iframe?: string;
  permissions?: string[];
  state?: Record<string, any>;
}

/**
 * Group widget content data
 */
export interface GroupContentData extends BaseContentData {
  type: 'group';
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
  type: 'unknown';
  originalData: any;
  originalType?: string;
  fallbackRepresentation: 'icon' | 'text' | 'preview';
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
  'id' | 'createdAt' | 'updatedAt' | 'selected' | 'zIndex' | 'contentId'
>;

/**
 * Content data creation type (without id, timestamps, etc.)
 */
export type ContentDataCreateData<T extends ContentData = ContentData> = Omit<
  T, 
  'id' | 'lastModified' | 'size'
>;

/**
 * Widget data update type (partial updates)
 */
export type WidgetDataUpdateData = Partial<
  Omit<WidgetData, 'id' | 'type' | 'createdAt' | 'contentId'>
> & {
  updatedAt: number;
};

/**
 * Content data update type (partial updates)
 */
export type ContentDataUpdateData<T extends ContentData = ContentData> = Partial<
  Omit<T, 'id' | 'type'>
> & {
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
export interface SeparatedWidgetCreateInput {
  // Widget data properties
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  locked?: boolean;
  metadata?: Record<string, any>;
  
  // Content data (type-specific)
  content: any;
}

/**
 * Migration data for converting existing widgets
 */
export interface WidgetMigrationData {
  widgetData: WidgetData;
  contentData: ContentData;
  originalWidget: BaseWidget;
}

// ============================================================================
// BACKWARDS COMPATIBILITY
// ============================================================================

/**
 * Legacy widget type for backwards compatibility
 * This allows gradual migration from the old system
 */
export type LegacyWidget = BaseWidget;

/**
 * Type guard to check if a widget is using the new separated architecture
 */
export function isSeparatedWidget(widget: any): widget is WidgetData {
  return widget && typeof widget.contentId === 'string';
}

/**
 * Type guard to check if a widget is using the legacy architecture
 */
export function isLegacyWidget(widget: any): widget is LegacyWidget {
  return widget && !isSeparatedWidget(widget);
}