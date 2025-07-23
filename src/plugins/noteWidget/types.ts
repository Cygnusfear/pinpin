import type { BaseWidget } from "../../types/widgets";

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

export interface NoteWidgetCreateData {
  content: string;
  backgroundColor?: string;
  textColor?: string;
  fontSize?: number;
  fontFamily?: string;
  textAlign?: "left" | "center" | "right";
  formatting?: {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
  };
}
