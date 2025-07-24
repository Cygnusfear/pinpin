/**
 * Note widget content
 */
export interface NoteContent {
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
