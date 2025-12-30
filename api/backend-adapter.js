/**
 * XJSON-BOT Backend Adapter
 * =========================
 * Unified API client that works with Python, PHP, or GAS backend.
 *
 * Usage:
 *   const api = new XJSONBackend('gas', 'https://script.google.com/.../exec');
 *   const response = await api.chat('Hello!');
 */

class XJSONBackend {
  /**
   * Create a backend adapter
   * @param {string} type - Backend type: 'python', 'php', 'gas'
   * @param {string} baseUrl - Backend URL
   * @param {object} options - Additional options
   */
  constructor(type = 'gas', baseUrl = '', options = {}) {
    this.type = type;
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.apiKey = options.apiKey || null;
    this.defaultModel = options.defaultModel || 'gpt-4o-mini';
    this.timeout = options.timeout || 120000;

    // Detect backend if not specified
    if (!baseUrl) {
      this.baseUrl = this.detectBackend();
    }
  }

  /**
   * Detect available backend
   */
  detectBackend() {
    // Check localStorage for saved backend
    const saved = localStorage.getItem('xjson_backend');
    if (saved) {
      const config = JSON.parse(saved);
      this.type = config.type;
      return config.url;
    }

    // Default to relative PHP path
    return '/api/php';
  }

  /**
   * Configure backend
   */
  configure(type, baseUrl) {
    this.type = type;
    this.baseUrl = baseUrl;
    localStorage.setItem('xjson_backend', JSON.stringify({ type, url: baseUrl }));
  }

  /**
   * Get headers for request
   */
  getHeaders() {
    const headers = {
      'Content-Type': 'application/json'
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    return headers;
  }

  /**
   * Make API request
   */
  async request(endpoint, data = null, method = 'POST') {
    const url = this.type === 'gas'
      ? this.baseUrl  // GAS uses single endpoint
      : `${this.baseUrl}${endpoint}`;

    const options = {
      method,
      headers: this.getHeaders()
    };

    if (data) {
      // For GAS, add action to data
      if (this.type === 'gas') {
        data.action = endpoint.replace('/v1/', '').replace(/\//g, '_');
      }
      options.body = JSON.stringify(data);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    options.signal = controller.signal;

    try {
      const response = await fetch(url, options);
      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw error;
    }
  }

  // ==================== CHAT API ====================

  /**
   * Chat completion
   */
  async chat(messages, options = {}) {
    // Allow string shorthand
    if (typeof messages === 'string') {
      messages = [{ role: 'user', content: messages }];
    }

    const data = {
      model: options.model || this.defaultModel,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 4096,
      stream: options.stream ?? false
    };

    if (this.type === 'gas') {
      data.action = 'chat';
      return this.request('', data);
    }

    return this.request('/v1/chat/completions', data);
  }

  /**
   * Stream chat completion
   */
  async *streamChat(messages, options = {}) {
    if (this.type === 'gas') {
      // GAS doesn't support streaming, fall back to regular
      const response = await this.chat(messages, options);
      yield response.choices[0].message.content;
      return;
    }

    const data = {
      model: options.model || this.defaultModel,
      messages: typeof messages === 'string'
        ? [{ role: 'user', content: messages }]
        : messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 4096,
      stream: true
    };

    const url = `${this.baseUrl}/v1/chat/completions`;
    const response = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data)
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') return;

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) yield content;
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    }
  }

  // ==================== MODELS API ====================

  /**
   * List available models
   */
  async listModels() {
    if (this.type === 'gas') {
      return this.request('', { action: 'models' }, 'GET');
    }
    return this.request('/v1/models', null, 'GET');
  }

  /**
   * Get model details
   */
  async getModel(modelId) {
    if (this.type === 'gas') {
      const models = await this.listModels();
      return models.data.find(m => m.id === modelId);
    }
    return this.request(`/v1/models/${modelId}`, null, 'GET');
  }

  // ==================== IMAGES API ====================

  /**
   * Generate images
   */
  async generateImage(prompt, options = {}) {
    const data = {
      model: options.model || 'dall-e-3',
      prompt,
      n: options.n || 1,
      size: options.size || '1024x1024'
    };

    if (this.type === 'gas') {
      throw new Error('Image generation not supported in GAS backend');
    }

    return this.request('/v1/images/generations', data);
  }

  // ==================== K'UHUL API ====================

  /**
   * Run K'UHUL operation
   */
  async kuhulRun(code, context = {}) {
    const data = {
      op_id: `op_${Date.now()}`,
      code,
      context
    };

    if (this.type === 'gas') {
      throw new Error('K\'UHUL operations require Python or PHP backend');
    }

    return this.request('/v1/kuhul/run', data);
  }

  /**
   * SCXQ2 compress
   */
  async compress(data) {
    if (this.type === 'gas') {
      return this.request('', { action: 'compress', data });
    }
    return this.request('/v1/kuhul/compress', { data });
  }

  /**
   * SCXQ2 decompress
   */
  async decompress(data) {
    if (this.type === 'gas') {
      return this.request('', { action: 'decompress', data });
    }
    return this.request('/v1/kuhul/decompress', { data });
  }

  // ==================== MEMORY API ====================

  /**
   * Remember (store in memory)
   */
  async remember(key, value, category = 'general', confidence = 1.0) {
    const data = { key, value, category, confidence };

    if (this.type === 'gas') {
      return this.request('', { action: 'remember', ...data });
    }
    return this.request('/v1/kuhul/memory/remember', data);
  }

  /**
   * Recall from memory
   */
  async recall(key, category = 'general') {
    if (this.type === 'gas') {
      return this.request('', { action: 'recall', key, category });
    }
    return this.request(`/v1/kuhul/memory/recall/${category}/${key}`, null, 'GET');
  }

  // ==================== STORAGE API ====================

  /**
   * Save chat
   */
  async saveChat(chatId, userId, title) {
    const data = { id: chatId, userId, title };

    if (this.type === 'gas') {
      return this.request('', { action: 'saveChat', ...data });
    }
    return this.request('/v1/chats', data);
  }

  /**
   * Get chats
   */
  async getChats(userId) {
    if (this.type === 'gas') {
      return this.request(`?action=chats&userId=${userId}`, null, 'GET');
    }
    return this.request(`/v1/chats?userId=${userId}`, null, 'GET');
  }

  /**
   * Save message
   */
  async saveMessage(chatId, role, content, model) {
    const data = { chatId, role, content, model };

    if (this.type === 'gas') {
      return this.request('', { action: 'saveMessage', ...data });
    }
    return this.request('/v1/messages', data);
  }

  /**
   * Get messages
   */
  async getMessages(chatId) {
    if (this.type === 'gas') {
      return this.request(`?action=messages&chatId=${chatId}`, null, 'GET');
    }
    return this.request(`/v1/messages?chatId=${chatId}`, null, 'GET');
  }

  // ==================== UTILITY ====================

  /**
   * Health check
   */
  async health() {
    if (this.type === 'gas') {
      return this.request('?action=status', null, 'GET');
    }
    return this.request('/health', null, 'GET');
  }

  /**
   * Get backend info
   */
  getInfo() {
    return {
      type: this.type,
      baseUrl: this.baseUrl,
      defaultModel: this.defaultModel,
      capabilities: this.getCapabilities()
    };
  }

  /**
   * Get backend capabilities
   */
  getCapabilities() {
    switch (this.type) {
      case 'python':
        return ['chat', 'stream', 'images', 'vision', 'kuhul', 'memory', 'local_models'];
      case 'php':
        return ['chat', 'stream', 'images', 'kuhul', 'memory'];
      case 'gas':
        return ['chat', 'memory', 'storage'];
      default:
        return [];
    }
  }
}

// ==================== FACTORY ====================

/**
 * Create backend from config
 */
function createBackend(config = {}) {
  const type = config.type || 'gas';
  const url = config.url || '';

  return new XJSONBackend(type, url, {
    apiKey: config.apiKey,
    defaultModel: config.defaultModel || 'gpt-4o-mini'
  });
}

// Export for different environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { XJSONBackend, createBackend };
}
if (typeof window !== 'undefined') {
  window.XJSONBackend = XJSONBackend;
  window.createBackend = createBackend;
}
