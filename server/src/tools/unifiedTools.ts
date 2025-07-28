/**
 * Unified Tool Interface
 * 
 * Provides a common abstraction layer for tools that works with both
 * Claude and Groq AI providers, enabling consistent tool definitions
 * and execution across different AI models.
 */

import { mcpAdapter } from "../mcp/mcpAdapter.js";

export interface UnifiedTool {
  name: string;
  description: string;
  parameters: Record<string, any>;
  category: "pinboard" | "filesystem" | "system" | "custom";
  provider_support: ("claude" | "groq")[];
}

export interface ToolExecutionResult {
  success: boolean;
  content: string;
  metadata?: Record<string, any>;
  error?: string;
}

export interface ProviderToolFormat {
  claude: any;
  groq: any;
}

/**
 * Unified Tool Manager
 * 
 * Manages tool definitions and execution for multiple AI providers
 */
export class UnifiedToolManager {
  private tools: Map<string, UnifiedTool> = new Map();
  private initialized = false;

  constructor() {
    // Auto-initialize when accessed
  }

  /**
   * Initialize the tool manager with MCP tools
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      console.log("🔧 Initializing Unified Tool Manager...");
      
      // Initialize MCP adapter
      await mcpAdapter.initialize();

      // Load MCP tools and convert to unified format
      const mcpTools = await mcpAdapter.listTools();
      
      for (const mcpTool of mcpTools) {
        const unifiedTool = this.convertMCPToUnified(mcpTool);
        this.tools.set(unifiedTool.name, unifiedTool);
      }

      this.initialized = true;
      console.log(`✅ Unified Tool Manager initialized with ${this.tools.size} tools`);
    } catch (error) {
      console.error("❌ Failed to initialize Unified Tool Manager:", error);
      throw error;
    }
  }

  /**
   * Convert MCP tool to unified tool format
   */
  private convertMCPToUnified(mcpTool: any): UnifiedTool {
    // Categorize tools based on their name and description
    let category: UnifiedTool["category"] = "custom";
    
    if (mcpTool.name.includes("pinboard") || mcpTool.name.includes("widget")) {
      category = "pinboard";
    } else if (mcpTool.name.includes("file") || mcpTool.name.includes("directory")) {
      category = "filesystem";
    } else if (mcpTool.name.includes("system") || mcpTool.name.includes("health")) {
      category = "system";
    }

    return {
      name: mcpTool.name,
      description: mcpTool.description,
      parameters: mcpTool.inputSchema,
      category,
      provider_support: ["claude", "groq"], // Most MCP tools support both
    };
  }

  /**
   * Get all available tools
   */
  async getTools(): Promise<UnifiedTool[]> {
    await this.initialize();
    return Array.from(this.tools.values());
  }

  /**
   * Get tools by category
   */
  async getToolsByCategory(category: UnifiedTool["category"]): Promise<UnifiedTool[]> {
    await this.initialize();
    return Array.from(this.tools.values()).filter(tool => tool.category === category);
  }

  /**
   * Get tools supported by a specific provider
   */
  async getToolsForProvider(provider: "claude" | "groq"): Promise<UnifiedTool[]> {
    await this.initialize();
    return Array.from(this.tools.values()).filter(tool => 
      tool.provider_support.includes(provider)
    );
  }

  /**
   * Convert unified tools to Claude format
   */
  async getClaudeTools(): Promise<any[]> {
    const tools = await this.getToolsForProvider("claude");
    
    return tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.parameters,
    }));
  }

  /**
   * Convert unified tools to Groq format
   */
  async getGroqTools(): Promise<any[]> {
    const tools = await this.getToolsForProvider("groq");
    
    return tools.map(tool => ({
      type: "function" as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));
  }

  /**
   * Execute a tool using the unified interface
   */
  async executeTool(
    toolName: string, 
    parameters: Record<string, unknown> = {},
    context?: {
      provider: "claude" | "groq";
      messageId?: string;
      userId?: string;
    }
  ): Promise<ToolExecutionResult> {
    await this.initialize();

    const tool = this.tools.get(toolName);
    if (!tool) {
      return {
        success: false,
        content: `Tool '${toolName}' not found`,
        error: "TOOL_NOT_FOUND",
      };
    }

    try {
      console.log(`🔧 Executing tool: ${toolName}`);
      console.log(`📝 Parameters:`, parameters);
      
      // Execute via MCP adapter
      const result = await mcpAdapter.callTool(toolName, parameters);
      
      // Extract content from MCP result
      const content = result.content?.[0]?.text || "Tool executed successfully";
      
      console.log(`✅ Tool ${toolName} executed successfully`);
      
      return {
        success: true,
        content,
        metadata: {
          tool: toolName,
          category: tool.category,
          provider: context?.provider,
          executedAt: new Date().toISOString(),
        },
      };
    } catch (error: any) {
      console.error(`❌ Tool ${toolName} execution failed:`, error.message);
      
      return {
        success: false,
        content: `Tool execution failed: ${error.message}`,
        error: error.message,
        metadata: {
          tool: toolName,
          category: tool.category,
          provider: context?.provider,
          failedAt: new Date().toISOString(),
        },
      };
    }
  }

  /**
   * Validate tool parameters against schema
   */
  validateParameters(toolName: string, parameters: Record<string, unknown>): {
    valid: boolean;
    errors: string[];
  } {
    const tool = this.tools.get(toolName);
    if (!tool) {
      return {
        valid: false,
        errors: [`Tool '${toolName}' not found`],
      };
    }

    // Basic validation - could be enhanced with a proper JSON schema validator
    const required = tool.parameters.required || [];
    const errors: string[] = [];

    for (const requiredParam of required) {
      if (!(requiredParam in parameters)) {
        errors.push(`Missing required parameter: ${requiredParam}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get tool usage statistics
   */
  getStats(): {
    totalTools: number;
    categoryCounts: Record<string, number>;
    providerSupport: Record<string, number>;
  } {
    const tools = Array.from(this.tools.values());
    
    const categoryCounts: Record<string, number> = {};
    const providerSupport: Record<string, number> = {};

    for (const tool of tools) {
      // Count by category
      categoryCounts[tool.category] = (categoryCounts[tool.category] || 0) + 1;
      
      // Count by provider support
      for (const provider of tool.provider_support) {
        providerSupport[provider] = (providerSupport[provider] || 0) + 1;
      }
    }

    return {
      totalTools: tools.length,
      categoryCounts,
      providerSupport,
    };
  }

  /**
   * Register a custom tool
   */
  registerCustomTool(tool: UnifiedTool): void {
    this.tools.set(tool.name, tool);
    console.log(`🔧 Registered custom tool: ${tool.name}`);
  }

  /**
   * Remove a tool
   */
  removeTool(toolName: string): boolean {
    const removed = this.tools.delete(toolName);
    if (removed) {
      console.log(`🗑️ Removed tool: ${toolName}`);
    }
    return removed;
  }
}

// Export singleton instance
export const unifiedToolManager = new UnifiedToolManager();

/**
 * Helper function to execute tools with proper error handling
 */
export async function executeUnifiedTool(
  toolName: string,
  parameters: Record<string, unknown> = {},
  context?: {
    provider: "claude" | "groq";
    messageId?: string;
    userId?: string;
  }
): Promise<ToolExecutionResult> {
  try {
    return await unifiedToolManager.executeTool(toolName, parameters, context);
  } catch (error: any) {
    return {
      success: false,
      content: `Unexpected error executing tool: ${error.message}`,
      error: error.message,
    };
  }
}

/**
 * Helper function to get formatted tools for a specific provider
 */
export async function getFormattedToolsForProvider(
  provider: "claude" | "groq"
): Promise<any[]> {
  try {
    if (provider === "claude") {
      return await unifiedToolManager.getClaudeTools();
    } else {
      return await unifiedToolManager.getGroqTools();
    }
  } catch (error) {
    console.error(`Failed to get tools for ${provider}:`, error);
    return [];
  }
}

/**
 * Tool execution middleware for consistent logging and error handling
 */
export function withToolExecution<T extends (...args: any[]) => Promise<any>>(
  originalFunction: T,
  toolName: string
): T {
  return (async (...args: any[]) => {
    const startTime = Date.now();
    
    try {
      console.log(`🔧 [${toolName}] Starting execution...`);
      const result = await originalFunction(...args);
      const duration = Date.now() - startTime;
      console.log(`✅ [${toolName}] Completed in ${duration}ms`);
      return result;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error(`❌ [${toolName}] Failed after ${duration}ms:`, error.message);
      throw error;
    }
  }) as T;
}