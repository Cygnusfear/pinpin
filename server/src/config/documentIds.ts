/**
 * Document ID constants for keepsync synchronization
 * 
 * These constants must match the frontend configuration to ensure
 * proper data synchronization between client and server.
 */

export const DOCUMENT_IDS = {
  /** Main widget store document - contains widget positions, sizes, and metadata */
  WIDGETS: "pinboard-main",
  
  /** Content store document - contains the actual content of widgets (text, data, etc.) */
  CONTENT: "pinboard-content",
  
  /** UI state document - contains canvas transform, selection state, etc. */
  UI_STATE: "pinboard-ui",
} as const;

export type DocumentIdKey = keyof typeof DOCUMENT_IDS;
export type DocumentIdValue = typeof DOCUMENT_IDS[DocumentIdKey];