// Chat widget content types
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  provider?: "claude" | "groq" | "mastra";
  toolCalls?: any[];
  metadata?: Record<string, any>;
}

export interface ChatContent {
  messages: ChatMessage[];
  isTyping: boolean;
  settings: {
    maxMessages?: number;
    autoScroll?: boolean;
    provider?: "claude" | "groq" | "mastra";
    enableProviderSwitching?: boolean;
    showProviderInMessages?: boolean;
    markdownRendering?: {
      enabled: boolean;
      showThinkTags: boolean;
      expandThinkTagsByDefault: boolean;
      enableSyntaxHighlighting: boolean;
    };
  };
}

export interface ProviderStatus {
  provider: "claude" | "groq" | "mastra";
  available: boolean;
  configured: boolean;
  capabilities: string[];
  lastChecked?: number;
}
