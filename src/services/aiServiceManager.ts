/**
 * AI Service Manager
 * 
 * Provides a unified abstraction layer for hot-swapping between different
 * AI providers (Claude, Groq) with consistent interfaces and shared MCP tools.
 */

import { sendChatMessage as sendClaudeMessage, generateStartingLocation, checkServiceHealth as checkClaudeHealth } from './claudeService.js';
import { sendGroqMessage, getGroqTools, getGroqResources, checkGroqServiceHealth } from './groqService.js';

// Common types for all AI providers
export type AIProvider = 'claude' | 'groq';

export interface ChatMessage {
  role: string;
  content: string;
  location?: string;
  roll?: number;
  [key: string]: any;
}

export interface ChatResponse {
  success: boolean;
  data: {
    message: string;
    tool_calls?: any[];
    tool_results?: any[];
    [key: string]: any;
  };
  provider: AIProvider;
  timestamp: string;
}

export interface HealthStatus {
  status: string;
  provider: AIProvider;
  configured: boolean;
  available: boolean;
  capabilities: string[];
  timestamp: string;
}

export interface ProviderCapabilities {
  name: string;
  supports_tools: boolean;
  supports_streaming: boolean;
  supports_location_generation: boolean;
  supports_dnd: boolean;
  max_tokens: number;
  models: string[];
}

export interface AIServiceConfig {
  defaultProvider: AIProvider;
  fallbackProvider?: AIProvider;
  enableAutoFallback: boolean;
  timeout: number;
  retryAttempts: number;
}

/**
 * Abstract interface for AI service providers
 */
export interface IAIService {
  provider: AIProvider;
  
  sendMessage(
    messages: ChatMessage[],
    locations?: any[],
    characters?: any[]
  ): Promise<ChatResponse>;
  
  checkHealth(): Promise<HealthStatus>;
  getCapabilities(): Promise<ProviderCapabilities>;
  
  // Optional provider-specific methods
  getTools?(): Promise<any>;
  getResources?(): Promise<any>;
  generateLocation?(character: any, backstory: string): Promise<any>;
}

/**
 * Claude AI Service Implementation
 */
class ClaudeService implements IAIService {
  provider: AIProvider = 'claude';

  async sendMessage(
    messages: ChatMessage[],
    locations?: any[],
    characters?: any[]
  ): Promise<ChatResponse> {
    const response = await sendClaudeMessage(messages, locations || [], characters || []);
    
    return {
      ...response,
      provider: this.provider,
      timestamp: new Date().toISOString(),
    };
  }

  async checkHealth(): Promise<HealthStatus> {
    try {
      const health = await checkClaudeHealth();
      
      return {
        status: health.status,
        provider: this.provider,
        configured: health.anthropic_configured,
        available: health.status === 'ok',
        capabilities: ['chat', 'tools', 'dnd', 'location_generation'],
        timestamp: health.timestamp,
      };
    } catch (error) {
      return {
        status: 'error',
        provider: this.provider,
        configured: false,
        available: false,
        capabilities: [],
        timestamp: new Date().toISOString(),
      };
    }
  }

  async getCapabilities(): Promise<ProviderCapabilities> {
    return {
      name: 'Claude Sonnet 4',
      supports_tools: true,
      supports_streaming: false,
      supports_location_generation: true,
      supports_dnd: true,
      max_tokens: 8000,
      models: ['claude-sonnet-4-20250514'],
    };
  }

  async generateLocation(character: any, backstory: string): Promise<any> {
    return await generateStartingLocation(character, backstory);
  }
}

/**
 * Groq AI Service Implementation
 */
class GroqService implements IAIService {
  provider: AIProvider = 'groq';

  async sendMessage(
    messages: ChatMessage[],
    locations?: any[],
    characters?: any[]
  ): Promise<ChatResponse> {
    const response = await sendGroqMessage(messages, locations, characters);
    
    return {
      ...response,
      provider: this.provider,
      timestamp: new Date().toISOString(),
    };
  }

  async checkHealth(): Promise<HealthStatus> {
    try {
      const health = await checkGroqServiceHealth();
      
      return {
        status: health.status,
        provider: this.provider,
        configured: health.groq_configured,
        available: health.status === 'ok',
        capabilities: ['chat', 'tools', 'mcp_integration'],
        timestamp: health.timestamp,
      };
    } catch (error) {
      return {
        status: 'error',
        provider: this.provider,
        configured: false,
        available: false,
        capabilities: [],
        timestamp: new Date().toISOString(),
      };
    }
  }

  async getCapabilities(): Promise<ProviderCapabilities> {
    return {
      name: 'Llama 3.1 70B Versatile',
      supports_tools: true,
      supports_streaming: false,
      supports_location_generation: false,
      supports_dnd: false,
      max_tokens: 4000,
      models: ['llama-3.1-70b-versatile'],
    };
  }

  async getTools(): Promise<any> {
    return await getGroqTools();
  }

  async getResources(): Promise<any> {
    return await getGroqResources();
  }
}

/**
 * AI Service Manager - Main abstraction layer
 */
export class AIServiceManager {
  private services: Map<AIProvider, IAIService> = new Map();
  private currentProvider: AIProvider;
  private config: AIServiceConfig;

  constructor(config: Partial<AIServiceConfig> = {}) {
    this.config = {
      defaultProvider: 'groq',
      enableAutoFallback: true,
      timeout: 30000,
      retryAttempts: 2,
      ...config,
    };

    // Initialize services
    this.services.set('claude', new ClaudeService());
    this.services.set('groq', new GroqService());

    this.currentProvider = this.config.defaultProvider;
  }

  /**
   * Switch to a specific AI provider
   */
  switchProvider(provider: AIProvider): void {
    if (!this.services.has(provider)) {
      throw new Error(`Unknown AI provider: ${provider}`);
    }
    
    const oldProvider = this.currentProvider;
    this.currentProvider = provider;
    
    console.log(`🔄 Switched AI provider: ${oldProvider} → ${provider}`);
  }

  /**
   * Get the current active provider
   */
  getCurrentProvider(): AIProvider {
    return this.currentProvider;
  }

  /**
   * Get the current service instance
   */
  private getCurrentService(): IAIService {
    const service = this.services.get(this.currentProvider);
    if (!service) {
      throw new Error(`Service not found for provider: ${this.currentProvider}`);
    }
    return service;
  }

  /**
   * Send a message using the current provider with fallback support
   */
  async sendMessage(
    messages: ChatMessage[],
    locations?: any[],
    characters?: any[]
  ): Promise<ChatResponse> {
    return await this.executeWithFallback(
      async (service) => await service.sendMessage(messages, locations, characters),
      'sendMessage'
    );
  }

  /**
   * Check health of current provider
   */
  async checkHealth(): Promise<HealthStatus> {
    const service = this.getCurrentService();
    return await service.checkHealth();
  }

  /**
   * Check health of all providers
   */
  async checkAllProvidersHealth(): Promise<Record<AIProvider, HealthStatus>> {
    const results: Record<string, HealthStatus> = {};
    
    for (const [provider, service] of this.services.entries()) {
      try {
        results[provider] = await service.checkHealth();
      } catch (error) {
        results[provider] = {
          status: 'error',
          provider,
          configured: false,
          available: false,
          capabilities: [],
          timestamp: new Date().toISOString(),
        };
      }
    }
    
    return results as Record<AIProvider, HealthStatus>;
  }

  /**
   * Get capabilities of current provider
   */
  async getCapabilities(): Promise<ProviderCapabilities> {
    const service = this.getCurrentService();
    return await service.getCapabilities();
  }

  /**
   * Get capabilities of all providers
   */
  async getAllCapabilities(): Promise<Record<AIProvider, ProviderCapabilities>> {
    const results: Record<string, ProviderCapabilities> = {};
    
    for (const [provider, service] of this.services.entries()) {
      try {
        results[provider] = await service.getCapabilities();
      } catch (error) {
        console.error(`Failed to get capabilities for ${provider}:`, error);
      }
    }
    
    return results as Record<AIProvider, ProviderCapabilities>;
  }

  /**
   * Get tools for current provider (if supported)
   */
  async getTools(): Promise<any> {
    const service = this.getCurrentService();
    
    if ('getTools' in service && typeof service.getTools === 'function') {
      return await service.getTools();
    }
    
    throw new Error(`Provider ${this.currentProvider} does not support getTools`);
  }

  /**
   * Get resources for current provider (if supported)
   */
  async getResources(): Promise<any> {
    const service = this.getCurrentService();
    
    if ('getResources' in service && typeof service.getResources === 'function') {
      return await service.getResources();
    }
    
    throw new Error(`Provider ${this.currentProvider} does not support getResources`);
  }

  /**
   * Generate location using current provider (if supported)
   */
  async generateLocation(character: any, backstory: string): Promise<any> {
    const service = this.getCurrentService();
    
    if ('generateLocation' in service && typeof service.generateLocation === 'function') {
      return await service.generateLocation(character, backstory);
    }
    
    throw new Error(`Provider ${this.currentProvider} does not support location generation`);
  }

  /**
   * Automatically select the best available provider
   */
  async autoSelectProvider(): Promise<AIProvider> {
    const healthStatuses = await this.checkAllProvidersHealth();
    
    // Sort providers by availability and capabilities
    const sortedProviders = Object.entries(healthStatuses)
      .filter(([_, health]) => health.available)
      .sort(([_, a], [__, b]) => {
        // Prefer providers with more capabilities
        return b.capabilities.length - a.capabilities.length;
      })
      .map(([provider]) => provider as AIProvider);

    if (sortedProviders.length === 0) {
      throw new Error('No AI providers are currently available');
    }

    const bestProvider = sortedProviders[0];
    if (bestProvider !== this.currentProvider) {
      this.switchProvider(bestProvider);
    }

    return bestProvider;
  }

  /**
   * Execute operation with automatic fallback if enabled
   */
  private async executeWithFallback<T>(
    operation: (service: IAIService) => Promise<T>,
    operationName: string
  ): Promise<T> {
    const service = this.getCurrentService();

    try {
      return await this.withTimeout(operation(service), this.config.timeout);
    } catch (error) {
      console.error(`${operationName} failed with ${this.currentProvider}:`, error);

      // Try fallback if enabled and available
      if (this.config.enableAutoFallback && this.config.fallbackProvider) {
        const fallbackProvider = this.config.fallbackProvider;
        
        if (fallbackProvider !== this.currentProvider) {
          console.log(`🔄 Attempting fallback to ${fallbackProvider}...`);
          
          try {
            const fallbackService = this.services.get(fallbackProvider);
            if (fallbackService) {
              const result = await this.withTimeout(
                operation(fallbackService), 
                this.config.timeout
              );
              
              console.log(`✅ Fallback to ${fallbackProvider} succeeded`);
              return result;
            }
          } catch (fallbackError) {
            console.error(`Fallback to ${fallbackProvider} also failed:`, fallbackError);
          }
        }
      }

      throw error;
    }
  }

  /**
   * Add timeout to promises
   */
  private withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)
      ),
    ]);
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<AIServiceConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('🔧 AI Service Manager configuration updated:', this.config);
  }

  /**
   * Get current configuration
   */
  getConfig(): AIServiceConfig {
    return { ...this.config };
  }
}

// Export singleton instance
export const aiServiceManager = new AIServiceManager();

/**
 * Convenience functions for easy usage
 */

/**
 * Send a message using the current AI provider
 */
export const sendAIMessage = async (
  messages: ChatMessage[],
  locations?: any[],
  characters?: any[]
): Promise<ChatResponse> => {
  return await aiServiceManager.sendMessage(messages, locations, characters);
};

/**
 * Switch AI provider
 */
export const switchAIProvider = (provider: AIProvider): void => {
  aiServiceManager.switchProvider(provider);
};

/**
 * Get current AI provider
 */
export const getCurrentAIProvider = (): AIProvider => {
  return aiServiceManager.getCurrentProvider();
};

/**
 * Auto-select best available provider
 */
export const autoSelectBestProvider = async (): Promise<AIProvider> => {
  return await aiServiceManager.autoSelectProvider();
};

/**
 * Check health of all AI providers
 */
export const checkAllAIProviders = async (): Promise<Record<AIProvider, HealthStatus>> => {
  return await aiServiceManager.checkAllProvidersHealth();
};