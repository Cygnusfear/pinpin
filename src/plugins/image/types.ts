/**
 * Image widget content
 */
export interface ImageContent {
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
