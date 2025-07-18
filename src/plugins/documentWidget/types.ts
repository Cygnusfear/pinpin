import { BaseWidget } from '../../types/widgets';

export interface DocumentWidget extends BaseWidget {
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

export interface DocumentWidgetCreateData {
  fileName: string;
  fileType?: string;
  fileSize?: number;
  mimeType?: string;
  content?: string;
  thumbnail?: string;
  downloadUrl?: string;
  previewUrl?: string;
}