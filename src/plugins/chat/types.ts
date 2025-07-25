// Chat widget content types
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export interface ChatContent {
  messages: ChatMessage[];
  isTyping: boolean;
  settings: {
    maxMessages?: number;
    autoScroll?: boolean;
  };
}
