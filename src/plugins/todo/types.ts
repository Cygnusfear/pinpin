/**
 * Todo widget content
 */
export interface TodoContent {
  title: string;
  items: Array<{
    id: string;
    text: string;
    completed: boolean;
    createdAt: number;
  }>;
}
