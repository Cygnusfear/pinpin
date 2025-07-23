import type { BaseWidget } from "../../types/widgets";

export interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
}

export interface TodoWidget extends BaseWidget {
  type: "todo";
  items: TodoItem[];
  title: string;
}

export interface TodoWidgetCreateData {
  items?: TodoItem[];
  title?: string;
}

export interface TodoState {
  items: TodoItem[];
  title: string;
}
