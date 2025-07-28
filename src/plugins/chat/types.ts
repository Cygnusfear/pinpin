// Chat widget content types
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  provider?: "claude" | "groq";
  toolCalls?: any[];
  metadata?: Record<string, any>;
}

export interface ChatContent {
  messages: ChatMessage[];
  isTyping: boolean;
  settings: {
    maxMessages?: number;
    autoScroll?: boolean;
    provider?: "claude" | "groq";
    enableProviderSwitching?: boolean;
    showProviderInMessages?: boolean;
  };
}

export interface ProviderStatus {
  provider: "claude" | "groq";
  available: boolean;
  configured: boolean;
  capabilities: string[];
  lastChecked?: number;
}
