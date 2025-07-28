/**
 * Mastra Service
 * 
 * Service layer for communicating with the Mastra-based agent system.
 * Provides a unified interface for chat interactions with persistent memory and MCP tools.
 */

/**
 * Recursively sanitize any object to remove undefined values that can't be serialized by Automerge/keepsync
 */
const sanitizeForKeepsync = (obj: any): any => {
  if (obj === null || obj === undefined) {
    return null; // Convert undefined to null
  }
  
  if (Array.isArray(obj)) {
    return obj.map(sanitizeForKeepsync).filter(item => item !== null && item !== undefined);
  }
  
  if (typeof obj === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const sanitizedValue = sanitizeForKeepsync(value);
      // Only include values that are not undefined
      if (sanitizedValue !== undefined) {
        sanitized[key] = sanitizedValue;
      }
    }
    return sanitized;
  }
  
  // Primitive values (string, number, boolean) - return as-is
  return obj;
};


export interface MastraMessage {
  role: "user" | "assistant";
  content: string;
}

export interface MastraChatRequest {
  message: string;
  conversationId?: string;
  userId?: string;
}

export interface MastraChatResponse {
  success: boolean;
  data: {
    message: string;
    conversationId: string;
    tool_calls?: any[];
    tool_results?: any[];
  };
  provider: "mastra";
  timestamp: string;
}

export interface MastraHealthResponse {
  status: "healthy" | "unhealthy";
  agent: {
    id: string;
    name: string;
    model: string;
    memory: {
      provider: string;
      status: string;
    };
    mcp: {
      connected: boolean;
      tools: number;
    };
  };
  timestamp: string;
}

/**
 * Send a chat message to the Mastra agent
 */
export const sendMastraMessage = async (
  messages: MastraMessage[],
  conversationId?: string,
  userId?: string
): Promise<MastraChatResponse> => {
  try {
    // Get the latest user message
    const userMessages = messages.filter(msg => msg.role === "user");
    const latestMessage = userMessages[userMessages.length - 1];
    
    if (!latestMessage) {
      throw new Error("No user message found");
    }

    const request: MastraChatRequest = {
      message: latestMessage.content,
      conversationId: conversationId || `chat-${Date.now()}`,
      userId: userId || "default-user"
    };

    const response = await fetch('/api/agent/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();

    // Transform to expected ChatResponse format and sanitize all data
    const responseData = {
      message: data.data?.message || "No response received",
      conversationId: data.data?.metadata?.conversationId || request.conversationId,
      tool_calls: data.data?.tool_calls || [],
      tool_results: data.data?.tool_results || []
    };

    return {
      success: true,
      data: sanitizeForKeepsync(responseData),
      provider: "mastra",
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Mastra service error:', error);
    
    const errorData = {
      message: `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`,
      conversationId: conversationId || `error-${Date.now()}`,
    };

    return {
      success: false,
      data: sanitizeForKeepsync(errorData),
      provider: "mastra",
      timestamp: new Date().toISOString(),
    };
  }
};

/**
 * Check Mastra agent health
 */
export const checkMastraHealth = async (): Promise<MastraHealthResponse> => {
  try {
    const response = await fetch('/api/agent/health');
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    return {
      status: data.status === "healthy" ? "healthy" : "unhealthy",
      agent: {
        id: data.agent?.id || "unknown",
        name: data.agent?.name || "Pinboard Agent",
        model: data.agent?.model || "unknown",
        memory: {
          provider: data.agent?.memory?.provider || "unknown",
          status: data.agent?.memory?.status || "unknown"
        },
        mcp: {
          connected: data.agent?.mcp?.connected || false,
          tools: data.agent?.mcp?.tools || 0
        }
      },
      timestamp: data.timestamp || new Date().toISOString(),
    };
  } catch (error) {
    console.error('Mastra health check error:', error);
    
    return {
      status: "unhealthy",
      agent: {
        id: "error",
        name: "Mastra Agent",
        model: "unknown",
        memory: {
          provider: "unknown",
          status: "error"
        },
        mcp: {
          connected: false,
          tools: 0
        }
      },
      timestamp: new Date().toISOString(),
    };
  }
};

/**
 * Get Mastra agent capabilities
 */
export const getMastraCapabilities = async () => {
  try {
    const response = await fetch('/api/agent/capabilities');
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Mastra capabilities error:', error);
    return {
      tools: [],
      models: [],
      memory: false,
      mcp: false
    };
  }
};

/**
 * Get conversation history
 */
export const getMastraHistory = async (conversationId: string, userId?: string) => {
  try {
    const params = new URLSearchParams({
      conversationId,
      ...(userId && { userId })
    });

    const response = await fetch(`/api/agent/history?${params}`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Mastra history error:', error);
    return {
      messages: [],
      conversationId,
      userId: userId || "default-user"
    };
  }
};