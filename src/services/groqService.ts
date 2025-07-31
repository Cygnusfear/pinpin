/**
 * Groq AI Service for Chat Integration
 *
 * Provides client-side functions to interact with the Groq AI endpoints
 * running on the server for chat conversations with MCP tool integration.
 */

// Types compatible with Claude service for easy switching
type ChatMessage = {
  role: string;
  content: string;
  location?: string;
  roll?: number;
  [key: string]: any;
};

type ChatResponse = {
  success: boolean;
  data: {
    message: string;
    tool_calls?: any[];
    tool_results?: any[];
    [key: string]: any;
  };
};

type HealthResponse = {
  status: string;
  timestamp: string;
  service: string;
  groq_configured: boolean;
  unified_tools_available: boolean;
};

type ToolsResponse = {
  success: boolean;
  data: {
    tools: Array<{
      name: string;
      description: string;
      parameters: Record<string, any>;
      category: string;
      provider_support: string[];
    }>;
    count: number;
    stats: {
      totalTools: number;
      categoryCounts: Record<string, number>;
      providerSupport: Record<string, number>;
    };
  };
};

type ResourcesResponse = {
  success: boolean;
  data: {
    resources: {
      pinboard: any[];
      filesystem: any[];
      system: any[];
    };
    categories: string[];
    totalTools: number;
  };
};

/**
 * Configuration for the Groq service
 */
const GROQ_API_BASE = "/api/groq";

/**
 * Send a chat message to Groq and get a response with MCP tool support
 *
 * @param messages - Array of chat messages in the conversation
 * @param locations - Optional location data for compatibility with Claude
 * @param characters - Optional character data for compatibility with Claude
 * @returns Promise with Groq's response and any tool execution results
 *
 * @example
 * ```typescript
 * const response = await sendGroqMessage(
 *   [{ role: 'user', content: 'Create a note widget with "Hello from Groq!"' }]
 * );
 *
 * console.log(response.data.message); // Groq's response
 * if (response.data.tool_calls) {
 *   console.log('Tools used:', response.data.tool_calls);
 * }
 * ```
 */
export const sendGroqMessage = async (
  messages: ChatMessage[],
  locations?: any[],
  characters?: any[],
): Promise<ChatResponse> => {
  try {
    const response = await fetch(`${GROQ_API_BASE}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages,
        locations,
        characters,
      }),
    });

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ error: "Unknown error" }));
      throw new Error(
        errorData.error || `HTTP ${response.status}: ${response.statusText}`,
      );
    }

    return await response.json();
  } catch (error) {
    console.error("Error sending chat message to Groq:", error);
    throw error;
  }
};

/**
 * Get the list of available MCP tools that Groq can use
 *
 * @returns Promise with the list of available tools and statistics
 *
 * @example
 * ```typescript
 * const toolsResponse = await getGroqTools();
 * console.log(`Available tools: ${toolsResponse.data.count}`);
 * console.log('Tool categories:', toolsResponse.data.stats.categoryCounts);
 * ```
 */
export const getGroqTools = async (): Promise<ToolsResponse> => {
  try {
    const response = await fetch(`${GROQ_API_BASE}/tools`);
    
    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ error: "Unknown error" }));
      throw new Error(
        errorData.error || `HTTP ${response.status}: ${response.statusText}`,
      );
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching Groq tools:", error);
    throw error;
  }
};

/**
 * Get the list of available MCP resources organized by category
 *
 * @returns Promise with the list of available resources by category
 *
 * @example
 * ```typescript
 * const resourcesResponse = await getGroqResources();
 * console.log('Pinboard tools:', resourcesResponse.data.resources.pinboard);
 * console.log('Filesystem tools:', resourcesResponse.data.resources.filesystem);
 * ```
 */
export const getGroqResources = async (): Promise<ResourcesResponse> => {
  try {
    const response = await fetch(`${GROQ_API_BASE}/resources`);
    
    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ error: "Unknown error" }));
      throw new Error(
        errorData.error || `HTTP ${response.status}: ${response.statusText}`,
      );
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching Groq resources:", error);
    throw error;
  }
};

/**
 * Check the health status of the Groq service
 *
 * @returns Promise with service health information
 *
 * @example
 * ```typescript
 * const health = await checkGroqServiceHealth();
 * if (health.groq_configured) {
 *   console.log('Groq service is ready!');
 * }
 * ```
 */
export const checkGroqServiceHealth = async (): Promise<HealthResponse> => {
  try {
    const response = await fetch(`${GROQ_API_BASE}/health`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Error checking Groq service health:", error);
    throw error;
  }
};

/**
 * Utility function to create a simple chat message
 *
 * @param content - The message content
 * @param role - The message role (default: "user")
 * @returns A formatted chat message
 *
 * @example
 * ```typescript
 * const message = createGroqMessage("Hello, Groq!");
 * const response = await sendGroqMessage([message]);
 * ```
 */
export const createGroqMessage = (
  content: string,
  role: string = "user"
): ChatMessage => {
  return {
    role,
    content,
  };
};

/**
 * Utility function to create a message with pinboard widget interaction
 *
 * @param content - The message content
 * @param widgetAction - The type of widget action to suggest
 * @returns A formatted chat message
 *
 * @example
 * ```typescript
 * const message = createWidgetMessage(
 *   "Create a todo list with items: Buy groceries, Walk the dog", 
 *   "create"
 * );
 * const response = await sendGroqMessage([message]);
 * ```
 */
export const createWidgetMessage = (
  content: string,
  widgetAction: "create" | "update" | "remove" | "view" = "create"
): ChatMessage => {
  const actionHints = {
    create: "Please create a new widget on the pinboard with this content:",
    update: "Please update an existing widget on the pinboard:",
    remove: "Please remove a widget from the pinboard:",
    view: "Please show me the current widgets on the pinboard:",
  };

  return {
    role: "user",
    content: `${actionHints[widgetAction]} ${content}`,
  };
};

/**
 * Utility function to create a message for filesystem operations
 *
 * @param operation - The filesystem operation type
 * @param path - The file or directory path
 * @param content - Optional content for write operations
 * @returns A formatted chat message
 *
 * @example
 * ```typescript
 * const message = createFileMessage("read", "src/app.ts");
 * const response = await sendGroqMessage([message]);
 * ```
 */
export const createFileMessage = (
  operation: "read" | "write" | "list",
  path: string,
  content?: string
): ChatMessage => {
  let messageContent = "";
  
  switch (operation) {
    case "read":
      messageContent = `Please read the file at path: ${path}`;
      break;
    case "write":
      messageContent = `Please write the following content to ${path}:\n\n${content}`;
      break;
    case "list":
      messageContent = `Please list the contents of directory: ${path}`;
      break;
  }

  return {
    role: "user",
    content: messageContent,
  };
};

/**
 * Example usage patterns for the Groq service
 */
export const groqExamples = {
  /**
   * Basic chat interaction
   */
  async basicChat() {
    const message = createGroqMessage("Hello! Can you help me organize my pinboard?");
    const response = await sendGroqMessage([message]);
    console.log("Groq Response:", response.data.message);
    return response;
  },

  /**
   * Widget creation example
   */
  async createNoteWidget() {
    const message = createWidgetMessage(
      "Meeting Notes - Discuss Q4 roadmap, review budget allocation, plan team expansion",
      "create"
    );
    const response = await sendGroqMessage([message]);
    console.log("Widget Creation:", response.data.message);
    
    if (response.data.tool_calls) {
      console.log("Tools used:", response.data.tool_calls.map(t => t.function.name));
    }
    
    return response;
  },

  /**
   * File operations example
   */
  async readProjectFile() {
    const message = createFileMessage("read", "package.json");
    const response = await sendGroqMessage([message]);
    console.log("File Content:", response.data.message);
    return response;
  },

  /**
   * Multi-turn conversation example
   */
  async multiTurnConversation() {
    const messages = [
      createGroqMessage("What widgets are currently on my pinboard?"),
    ];
    
    let response = await sendGroqMessage(messages);
    console.log("Turn 1:", response.data.message);
    
    // Add Groq's response to conversation history
    messages.push({
      role: "assistant",
      content: response.data.message,
    });
    
    // Ask a follow-up question
    messages.push(createGroqMessage("Create a calculator widget in the top-left corner"));
    
    response = await sendGroqMessage(messages);
    console.log("Turn 2:", response.data.message);
    
    return response;
  },

  /**
   * Service capabilities discovery
   */
  async discoverCapabilities() {
    try {
      const [health, tools, resources] = await Promise.all([
        checkGroqServiceHealth(),
        getGroqTools(),
        getGroqResources(),
      ]);

      console.log("=== Groq Service Capabilities ===");
      console.log("Health Status:", health.status);
      console.log("Groq Configured:", health.groq_configured);
      console.log("Unified Tools Available:", health.unified_tools_available);
      console.log("");
      console.log("Available Tools:", tools.data.count);
      console.log("Tool Categories:", Object.keys(tools.data.stats.categoryCounts));
      console.log("");
      console.log("Resource Categories:", resources.data.categories);
      console.log("Total Resource Tools:", resources.data.totalTools);
      console.log("===============================");

      return { health, tools, resources };
    } catch (error) {
      console.error("Failed to discover Groq capabilities:", error);
      throw error;
    }
  },

  /**
   * Tool-specific interactions
   */
  async toolSpecificInteractions() {
    // Pinboard widget management
    const widgetResponse = await sendGroqMessage([
      createWidgetMessage("Shopping List: Milk, Eggs, Bread, Apples", "create"),
    ]);
    
    // Filesystem operations
    const fileResponse = await sendGroqMessage([
      createFileMessage("list", "."),
    ]);
    
    // System information
    const systemResponse = await sendGroqMessage([
      createGroqMessage("Show me the current pinboard UI state"),
    ]);

    return {
      widget: widgetResponse,
      file: fileResponse,
      system: systemResponse,
    };
  },
};

/**
 * Error handling utility for Groq service calls
 */
export const withGroqErrorHandling = async <T>(
  operation: () => Promise<T>,
  operationName: string = "Groq operation"
): Promise<T | null> => {
  try {
    return await operation();
  } catch (error: any) {
    console.error(`${operationName} failed:`, error.message);
    
    // Provide user-friendly error messages
    if (error.message.includes("401")) {
      console.error("Authentication failed - check GROQ_API_KEY");
    } else if (error.message.includes("429")) {
      console.error("Rate limit exceeded - please wait before retrying");
    } else if (error.message.includes("500")) {
      console.error("Server error - please try again later");
    }
    
    return null;
  }
};