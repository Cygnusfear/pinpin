import { BaseWidget } from '../../types/widgets';

export interface ImageWidget extends BaseWidget {
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

export interface ImageWidgetCreateData {
  src: string;
  alt?: string;
  originalDimensions?: { width: number; height: number };
  filters?: {
    brightness?: number;
    contrast?: number;
    saturation?: number;
    blur?: number;
  };
}