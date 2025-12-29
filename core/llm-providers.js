/**
 * LLM PROVIDERS - Multi-Provider AI Integration Layer
 * ====================================================
 * Supports: OpenAI, Anthropic, Ollama (local), and custom endpoints
 *
 * Features:
 * - Unified API for all providers
 * - Streaming support
 * - Error handling and retries
 * - Rate limiting
 * - Provider-specific optimizations
 */

/* ============================================================
   PROVIDER CONFIGURATION
   ============================================================ */

const LLMConfig = {
  // Default settings
  defaults: {
    maxTokens: 2048,
    temperature: 0.7,
    topP: 1.0,
    timeout: 30000,
    retries: 3,
    retryDelay: 1000
  },

  // Provider endpoints
  endpoints: {
    openai: 'https://api.openai.com/v1',
    anthropic: 'https://api.anthropic.com/v1',
    ollama: 'http://localhost:11434'
  },

  // Model mappings
  models: {
    openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    anthropic: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
    ollama: ['llama3.2', 'llama3.1', 'mistral', 'codellama', 'phi3', 'gemma2']
  }
};

/* ============================================================
   BASE PROVIDER CLASS
   ============================================================ */

class LLMProvider {
  constructor(config = {}) {
    this.config = { ...LLMConfig.defaults, ...config };
    this.rateLimiter = new RateLimiter(config.rateLimit || { maxRequests: 60, windowMs: 60000 });
  }

  async chat(messages, options = {}) {
    throw new Error('chat() must be implemented by provider');
  }

  async chatStream(messages, options = {}, onChunk) {
    throw new Error('chatStream() must be implemented by provider');
  }

  async listModels() {
    throw new Error('listModels() must be implemented by provider');
  }

  async testConnection() {
    throw new Error('testConnection() must be implemented by provider');
  }

  // Shared retry logic
  async withRetry(fn, retries = this.config.retries) {
    let lastError;
    for (let i = 0; i <= retries; i++) {
      try {
        await this.rateLimiter.acquire();
        return await fn();
      } catch (error) {
        lastError = error;
        if (i < retries && this.isRetryable(error)) {
          await this.delay(this.config.retryDelay * Math.pow(2, i));
        } else {
          throw error;
        }
      }
    }
    throw lastError;
  }

  isRetryable(error) {
    const retryableCodes = [429, 500, 502, 503, 504];
    return retryableCodes.includes(error.status) || error.message?.includes('network');
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  formatError(error) {
    if (error.response) {
      return `API Error: ${error.response.status} - ${error.response.statusText}`;
    }
    return error.message || 'Unknown error occurred';
  }
}

/* ============================================================
   OPENAI PROVIDER
   ============================================================ */

class OpenAIProvider extends LLMProvider {
  constructor(config = {}) {
    super(config);
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || LLMConfig.endpoints.openai;
    this.defaultModel = config.model || 'gpt-4o-mini';
  }

  async chat(messages, options = {}) {
    return this.withRetry(async () => {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: options.model || this.defaultModel,
          messages: this.formatMessages(messages),
          max_tokens: options.maxTokens || this.config.maxTokens,
          temperature: options.temperature ?? this.config.temperature,
          top_p: options.topP ?? this.config.topP,
          stream: false
        }),
        signal: AbortSignal.timeout(this.config.timeout)
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw { status: response.status, message: error.error?.message || response.statusText };
      }

      const data = await response.json();
      return {
        content: data.choices[0].message.content,
        model: data.model,
        usage: data.usage,
        finishReason: data.choices[0].finish_reason
      };
    });
  }

  async chatStream(messages, options = {}, onChunk) {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: options.model || this.defaultModel,
        messages: this.formatMessages(messages),
        max_tokens: options.maxTokens || this.config.maxTokens,
        temperature: options.temperature ?? this.config.temperature,
        stream: true
      }),
      signal: AbortSignal.timeout(this.config.timeout * 3)
    });

    if (!response.ok) {
      throw { status: response.status, message: response.statusText };
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.startsWith('data: '));

        for (const line of lines) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices[0]?.delta?.content || '';
            if (content) {
              fullContent += content;
              onChunk(content, fullContent);
            }
          } catch (e) {
            // Skip malformed JSON
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return { content: fullContent, model: options.model || this.defaultModel };
  }

  async listModels() {
    const response = await fetch(`${this.baseUrl}/models`, {
      headers: { 'Authorization': `Bearer ${this.apiKey}` }
    });

    if (!response.ok) throw new Error('Failed to list models');

    const data = await response.json();
    return data.data
      .filter(m => m.id.includes('gpt'))
      .map(m => ({ id: m.id, name: m.id, provider: 'openai' }));
  }

  async testConnection() {
    try {
      await this.listModels();
      return { success: true, provider: 'openai' };
    } catch (error) {
      return { success: false, provider: 'openai', error: this.formatError(error) };
    }
  }

  formatMessages(messages) {
    return messages.map(msg => ({
      role: msg.role === 'system' ? 'system' : msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.content
    }));
  }
}

/* ============================================================
   ANTHROPIC PROVIDER
   ============================================================ */

class AnthropicProvider extends LLMProvider {
  constructor(config = {}) {
    super(config);
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || LLMConfig.endpoints.anthropic;
    this.defaultModel = config.model || 'claude-3-5-sonnet-20241022';
  }

  async chat(messages, options = {}) {
    return this.withRetry(async () => {
      const { systemMessage, chatMessages } = this.extractSystemMessage(messages);

      const response = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: options.model || this.defaultModel,
          max_tokens: options.maxTokens || this.config.maxTokens,
          temperature: options.temperature ?? this.config.temperature,
          system: systemMessage,
          messages: this.formatMessages(chatMessages)
        }),
        signal: AbortSignal.timeout(this.config.timeout)
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw { status: response.status, message: error.error?.message || response.statusText };
      }

      const data = await response.json();
      return {
        content: data.content[0].text,
        model: data.model,
        usage: {
          prompt_tokens: data.usage.input_tokens,
          completion_tokens: data.usage.output_tokens,
          total_tokens: data.usage.input_tokens + data.usage.output_tokens
        },
        finishReason: data.stop_reason
      };
    });
  }

  async chatStream(messages, options = {}, onChunk) {
    const { systemMessage, chatMessages } = this.extractSystemMessage(messages);

    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: options.model || this.defaultModel,
        max_tokens: options.maxTokens || this.config.maxTokens,
        temperature: options.temperature ?? this.config.temperature,
        system: systemMessage,
        messages: this.formatMessages(chatMessages),
        stream: true
      }),
      signal: AbortSignal.timeout(this.config.timeout * 3)
    });

    if (!response.ok) {
      throw { status: response.status, message: response.statusText };
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.startsWith('data: '));

        for (const line of lines) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'content_block_delta' && data.delta?.text) {
              fullContent += data.delta.text;
              onChunk(data.delta.text, fullContent);
            }
          } catch (e) {
            // Skip malformed JSON
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return { content: fullContent, model: options.model || this.defaultModel };
  }

  async listModels() {
    // Anthropic doesn't have a models endpoint, return known models
    return LLMConfig.models.anthropic.map(id => ({
      id,
      name: id,
      provider: 'anthropic'
    }));
  }

  async testConnection() {
    try {
      // Test with a minimal request
      await this.chat([{ role: 'user', content: 'Hi' }], { maxTokens: 5 });
      return { success: true, provider: 'anthropic' };
    } catch (error) {
      return { success: false, provider: 'anthropic', error: this.formatError(error) };
    }
  }

  extractSystemMessage(messages) {
    const systemMsg = messages.find(m => m.role === 'system');
    const chatMessages = messages.filter(m => m.role !== 'system');
    return {
      systemMessage: systemMsg?.content || '',
      chatMessages
    };
  }

  formatMessages(messages) {
    return messages.map(msg => ({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.content
    }));
  }
}

/* ============================================================
   OLLAMA PROVIDER (LOCAL)
   ============================================================ */

class OllamaProvider extends LLMProvider {
  constructor(config = {}) {
    super(config);
    this.baseUrl = config.baseUrl || LLMConfig.endpoints.ollama;
    this.defaultModel = config.model || 'llama3.2';
  }

  async chat(messages, options = {}) {
    return this.withRetry(async () => {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: options.model || this.defaultModel,
          messages: this.formatMessages(messages),
          options: {
            num_predict: options.maxTokens || this.config.maxTokens,
            temperature: options.temperature ?? this.config.temperature,
            top_p: options.topP ?? this.config.topP
          },
          stream: false
        }),
        signal: AbortSignal.timeout(this.config.timeout * 2)
      });

      if (!response.ok) {
        throw { status: response.status, message: response.statusText };
      }

      const data = await response.json();
      return {
        content: data.message.content,
        model: data.model,
        usage: {
          prompt_tokens: data.prompt_eval_count || 0,
          completion_tokens: data.eval_count || 0,
          total_tokens: (data.prompt_eval_count || 0) + (data.eval_count || 0)
        },
        finishReason: data.done ? 'stop' : 'length'
      };
    });
  }

  async chatStream(messages, options = {}, onChunk) {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: options.model || this.defaultModel,
        messages: this.formatMessages(messages),
        options: {
          num_predict: options.maxTokens || this.config.maxTokens,
          temperature: options.temperature ?? this.config.temperature
        },
        stream: true
      }),
      signal: AbortSignal.timeout(this.config.timeout * 5)
    });

    if (!response.ok) {
      throw { status: response.status, message: response.statusText };
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim());

        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            if (data.message?.content) {
              fullContent += data.message.content;
              onChunk(data.message.content, fullContent);
            }
          } catch (e) {
            // Skip malformed JSON
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return { content: fullContent, model: options.model || this.defaultModel };
  }

  async listModels() {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      if (!response.ok) throw new Error('Failed to list models');

      const data = await response.json();
      return (data.models || []).map(m => ({
        id: m.name,
        name: m.name,
        size: m.size,
        modified: m.modified_at,
        provider: 'ollama'
      }));
    } catch (error) {
      return [];
    }
  }

  async testConnection() {
    try {
      const models = await this.listModels();
      return { success: true, provider: 'ollama', models: models.length };
    } catch (error) {
      return { success: false, provider: 'ollama', error: this.formatError(error) };
    }
  }

  async pullModel(modelName, onProgress) {
    const response = await fetch(`${this.baseUrl}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: modelName, stream: true })
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const lines = decoder.decode(value).split('\n').filter(l => l);
      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          if (onProgress) onProgress(data);
        } catch (e) {}
      }
    }

    return { success: true, model: modelName };
  }

  formatMessages(messages) {
    return messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
  }
}

/* ============================================================
   RATE LIMITER
   ============================================================ */

class RateLimiter {
  constructor(config = {}) {
    this.maxRequests = config.maxRequests || 60;
    this.windowMs = config.windowMs || 60000;
    this.requests = [];
  }

  async acquire() {
    const now = Date.now();
    this.requests = this.requests.filter(time => now - time < this.windowMs);

    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = this.requests[0];
      const waitTime = this.windowMs - (now - oldestRequest);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return this.acquire();
    }

    this.requests.push(now);
    return true;
  }
}

/* ============================================================
   LLM MANAGER - Unified Interface
   ============================================================ */

const LLM = {
  providers: new Map(),
  activeProvider: null,
  conversationMemory: new Map(),

  // Initialize a provider
  init(providerType, config = {}) {
    let provider;
    switch (providerType) {
      case 'openai':
        provider = new OpenAIProvider(config);
        break;
      case 'anthropic':
        provider = new AnthropicProvider(config);
        break;
      case 'ollama':
        provider = new OllamaProvider(config);
        break;
      default:
        throw new Error(`Unknown provider: ${providerType}`);
    }

    this.providers.set(providerType, provider);
    if (!this.activeProvider) {
      this.activeProvider = providerType;
    }

    return provider;
  },

  // Get provider instance
  getProvider(providerType) {
    return this.providers.get(providerType || this.activeProvider);
  },

  // Set active provider
  setActiveProvider(providerType) {
    if (!this.providers.has(providerType)) {
      throw new Error(`Provider not initialized: ${providerType}`);
    }
    this.activeProvider = providerType;
  },

  // Chat with automatic provider selection
  async chat(messages, options = {}) {
    const provider = this.getProvider(options.provider);
    if (!provider) {
      throw new Error('No provider available. Initialize a provider first.');
    }

    // Add conversation context if enabled
    const conversationId = options.conversationId;
    if (conversationId && this.conversationMemory.has(conversationId)) {
      const history = this.conversationMemory.get(conversationId);
      messages = [...history, ...messages];
    }

    const response = await provider.chat(messages, options);

    // Store in conversation memory
    if (conversationId) {
      const history = this.conversationMemory.get(conversationId) || [];
      history.push(...messages);
      history.push({ role: 'assistant', content: response.content });

      // Limit memory to last N messages
      const maxMemory = options.maxMemory || 20;
      if (history.length > maxMemory) {
        history.splice(0, history.length - maxMemory);
      }

      this.conversationMemory.set(conversationId, history);
    }

    return response;
  },

  // Streaming chat
  async chatStream(messages, options = {}, onChunk) {
    const provider = this.getProvider(options.provider);
    if (!provider) {
      throw new Error('No provider available. Initialize a provider first.');
    }

    return provider.chatStream(messages, options, onChunk);
  },

  // List all available models across providers
  async listAllModels() {
    const allModels = [];
    for (const [name, provider] of this.providers) {
      try {
        const models = await provider.listModels();
        allModels.push(...models);
      } catch (e) {
        console.warn(`Failed to list models for ${name}:`, e);
      }
    }
    return allModels;
  },

  // Test all providers
  async testAllProviders() {
    const results = {};
    for (const [name, provider] of this.providers) {
      results[name] = await provider.testConnection();
    }
    return results;
  },

  // Clear conversation memory
  clearMemory(conversationId) {
    if (conversationId) {
      this.conversationMemory.delete(conversationId);
    } else {
      this.conversationMemory.clear();
    }
  },

  // Get available provider types
  getAvailableProviders() {
    return Array.from(this.providers.keys());
  },

  // Auto-configure from settings
  async autoConfig() {
    const settings = JSON.parse(localStorage.getItem('mx2lm_settings') || '{}');

    // Check for API keys and configure providers
    if (settings.openaiApiKey) {
      this.init('openai', { apiKey: settings.openaiApiKey });
    }

    if (settings.anthropicApiKey) {
      this.init('anthropic', { apiKey: settings.anthropicApiKey });
    }

    // Always try Ollama (local)
    try {
      const ollama = this.init('ollama', { baseUrl: settings.ollamaUrl || 'http://localhost:11434' });
      const test = await ollama.testConnection();
      if (!test.success) {
        this.providers.delete('ollama');
      }
    } catch (e) {
      this.providers.delete('ollama');
    }

    return this.getAvailableProviders();
  }
};

/* ============================================================
   EXPORTS
   ============================================================ */

// Make available globally
if (typeof window !== 'undefined') {
  window.LLM = LLM;
  window.LLMConfig = LLMConfig;
  window.OpenAIProvider = OpenAIProvider;
  window.AnthropicProvider = AnthropicProvider;
  window.OllamaProvider = OllamaProvider;
}

// Module exports for potential bundling
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    LLM,
    LLMConfig,
    OpenAIProvider,
    AnthropicProvider,
    OllamaProvider,
    RateLimiter
  };
}

console.log('LLM PROVIDERS v1.0 - LOADED');
console.log('- OpenAI: Ready');
console.log('- Anthropic: Ready');
console.log('- Ollama: Ready');
