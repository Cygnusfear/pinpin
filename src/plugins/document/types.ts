/**
 * Document widget content
 */
export interface DocumentContent {
  fileName: string;
  fileType: string;
  fileSize: number;
  mimeType: string;
  content?: string; // For text files
  thumbnail?: string;
  downloadUrl?: string;
  previewUrl?: string;
}
