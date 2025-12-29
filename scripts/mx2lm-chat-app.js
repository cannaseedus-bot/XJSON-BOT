/**
 * MX2LM CHAT APPLICATION
 * =======================
 * Chat interface logic using ASX Block Runtime (ASX) and K'UHUL engine
 */

/* ============================================================
   SCXQ2 LAYER - Hazard Cipher for Chat Components
   ============================================================ */
const SCXQ2 = {
  HAZ: "☣CHAT:",

  PACKETS: {
    SIDEBAR: "☣CHAT:SIDEBAR",
    CHAT_VIEW: "☣CHAT:VIEW",
    INPUT: "☣CHAT:INPUT",
    SETTINGS: "☣CHAT:SETTINGS",
    DASHBOARD: "☣CHAT:DASHBOARD"
  },

  decode(packetId) {
    if (!packetId?.startsWith(this.HAZ)) return [];

    switch(packetId) {
      case this.PACKETS.SIDEBAR:
        return this._sidebar();
      case this.PACKETS.CHAT_VIEW:
        return this._chatView();
      case this.PACKETS.INPUT:
        return this._input();
      case this.PACKETS.SETTINGS:
        return this._settings();
      case this.PACKETS.DASHBOARD:
        return this._dashboard();
      default:
        return [];
    }
  },

  _sidebar() {
    return [{
      type: "asx-block",
      id: "sidebar-main",
      component: "Sidebar",
      props: {
        user: User.current,
        chats: ChatHistory.getAll(),
        activeChat: ChatHistory.getActive()
      }
    }];
  },

  _chatView() {
    return [{
      type: "asx-block",
      id: "chat-view",
      component: "ChatView",
      props: {
        messages: ChatHistory.getActive()?.messages || [],
        isGenerating: AI.isGenerating
      }
    }];
  },

  _input() {
    return [{
      type: "asx-block",
      id: "chat-input",
      component: "ChatInput",
      props: {
        disabled: AI.isGenerating
      }
    }];
  },

  _settings() {
    return [{
      type: "asx-block",
      id: "settings-view",
      component: "SettingsView",
      props: {
        user: User.current,
        models: ModelManager.getAll(),
        huggingfaceToken: Settings.get('huggingfaceToken'),
        openaiApiKey: Settings.get('openaiApiKey'),
        anthropicApiKey: Settings.get('anthropicApiKey'),
        ollamaUrl: Settings.get('ollamaUrl')
      }
    }];
  },

  _dashboard() {
    return [{
      type: "asx-block",
      id: "user-dashboard",
      component: "UserDashboard",
      props: {
        user: User.current,
        stats: User.getStats()
      }
    }];
  }
};

/* ============================================================
   ASX BLOCK RUNTIME
   ============================================================ */
const ASX = {
  Components: {},

  registerComponent(name, renderFn) {
    this.Components[name] = renderFn;
  },

  renderBlock(block) {
    const component = this.Components[block.component];
    return component ? component(block.props) : `<div>Unknown: ${block.component}</div>`;
  },

  renderBlocks(blocks, containerId) {
    const container = document.getElementById(containerId);
    if (container) {
      container.innerHTML = blocks.map(b => this.renderBlock(b)).join('');
    }
  },

  renderPacket(packetId, containerId) {
    const blocks = SCXQ2.decode(packetId);
    this.renderBlocks(blocks, containerId);
  },

  initComponents() {
    // Sidebar Component
    this.registerComponent("Sidebar", (props) => `
      <div col gap="4" pad="3" h-full>
        <div row spread align-center>
          <div h2>Chats</div>
          <button x btn id="btn-new-chat">+ New</button>
        </div>

        <div col gap="2" flex-1 style="overflow-y: auto;">
          ${(props.chats || []).map(chat => `
            <div class="chat-history-item ${chat.id === props.activeChat?.id ? 'active' : ''}"
                 onclick="ChatHistory.setActive('${chat.id}'); App.render()">
              <div h3>${chat.title}</div>
              <div label>${new Date(chat.updated).toLocaleDateString()}</div>
            </div>
          `).join('')}
        </div>

        <div col gap="2">
          <button x btn onclick="App.showView('dashboard')">
            <xt>👤 Dashboard</xt>
          </button>
          <button x btn onclick="App.showView('settings')">
            <xt>⚙ Settings</xt>
          </button>
          <button x btn onclick="User.logout()">
            <xt>🚪 Logout</xt>
          </button>
        </div>
      </div>
    `);

    // Chat View Component
    this.registerComponent("ChatView", (props) => `
      <div col gap="4" h-full style="overflow-y: auto;">
        ${(props.messages || []).map(msg => `
          <div class="message message-${msg.role}">
            <div style="font-weight: 600; margin-bottom: 4px;">
              ${msg.role === 'user' ? '👤 You' : '🤖 Assistant'}
            </div>
            <div>${msg.content}</div>
            ${msg.model ? `<div label>Model: ${msg.model}</div>` : ''}
          </div>
        `).join('')}

        ${props.isGenerating ? `
          <div class="message message-assistant">
            <div class="loading-dots">
              <span></span><span></span><span></span>
            </div>
          </div>
        ` : ''}

        ${props.messages?.length === 0 ? `
          <div col center gap="3" style="height: 100%; color: var(--muted);">
            <div h1>Welcome to MX2LM Chat</div>
            <div>Start a conversation with your local AI models</div>
          </div>
        ` : ''}
      </div>
    `);

    // Chat Input Component
    this.registerComponent("ChatInput", (props) => `
      <div col gap="2">
        <div row gap="2">
          <input x input flex-1 id="chat-input" placeholder="Type your message..."
                 ${props.disabled ? 'disabled' : ''} />
          <button x btn btn-accent id="btn-send" ${props.disabled ? 'disabled' : ''}>
            <xt>Send</xt>
          </button>
        </div>
        <div row gap="2" align-center>
          <select x input style="flex: 1;" id="model-select">
            ${ModelManager.getAll().map(model => `
              <option value="${model.id}">${model.name}</option>
            `).join('')}
          </select>
          <button x btn onclick="App.showView('settings')">
            <xt>Add Model</xt>
          </button>
        </div>
      </div>
    `);

    // Settings Component
    this.registerComponent("SettingsView", (props) => `
      <div col gap="4" pad="3">
        <div row spread align-center>
          <div h1>Settings</div>
          <button x btn onclick="App.showView('chat')">← Back</button>
        </div>

        <div class="settings-section">
          <div h2>AI Providers</div>
          <div label style="margin-bottom: var(--s-2);">Configure your AI providers. At least one is required for real AI responses.</div>

          <!-- OpenAI -->
          <div class="provider-card" style="margin-bottom: var(--s-3);">
            <div row spread align-center>
              <div h3>OpenAI</div>
              <span class="provider-status" id="openai-status">Not configured</span>
            </div>
            <div col gap="2" style="margin-top: var(--s-2);">
              <input x input w-full id="openai-key" type="password"
                     placeholder="sk-..." value="${props.openaiApiKey ? '••••••••' : ''}" />
              <div row gap="2">
                <select x input id="openai-model" style="flex: 1;">
                  <option value="gpt-4o-mini">GPT-4o Mini (Fast)</option>
                  <option value="gpt-4o">GPT-4o (Best)</option>
                  <option value="gpt-4-turbo">GPT-4 Turbo</option>
                  <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                </select>
                <button x btn onclick="Settings.saveProvider('openai')">Save</button>
                <button x btn onclick="Settings.testProvider('openai')">Test</button>
              </div>
            </div>
          </div>

          <!-- Anthropic -->
          <div class="provider-card" style="margin-bottom: var(--s-3);">
            <div row spread align-center>
              <div h3>Anthropic</div>
              <span class="provider-status" id="anthropic-status">Not configured</span>
            </div>
            <div col gap="2" style="margin-top: var(--s-2);">
              <input x input w-full id="anthropic-key" type="password"
                     placeholder="sk-ant-..." value="${props.anthropicApiKey ? '••••••••' : ''}" />
              <div row gap="2">
                <select x input id="anthropic-model" style="flex: 1;">
                  <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</option>
                  <option value="claude-3-5-haiku-20241022">Claude 3.5 Haiku (Fast)</option>
                  <option value="claude-3-opus-20240229">Claude 3 Opus</option>
                </select>
                <button x btn onclick="Settings.saveProvider('anthropic')">Save</button>
                <button x btn onclick="Settings.testProvider('anthropic')">Test</button>
              </div>
            </div>
          </div>

          <!-- Ollama (Local) -->
          <div class="provider-card" style="margin-bottom: var(--s-3);">
            <div row spread align-center>
              <div h3>Ollama (Local)</div>
              <span class="provider-status" id="ollama-status">Checking...</span>
            </div>
            <div col gap="2" style="margin-top: var(--s-2);">
              <input x input w-full id="ollama-url"
                     placeholder="http://localhost:11434" value="${props.ollamaUrl || 'http://localhost:11434'}" />
              <div row gap="2">
                <select x input id="ollama-model" style="flex: 1;">
                  <option value="llama3.2">Llama 3.2</option>
                  <option value="llama3.1">Llama 3.1</option>
                  <option value="mistral">Mistral</option>
                  <option value="codellama">CodeLlama</option>
                  <option value="phi3">Phi-3</option>
                  <option value="gemma2">Gemma 2</option>
                </select>
                <button x btn onclick="Settings.saveProvider('ollama')">Save</button>
                <button x btn onclick="Settings.testProvider('ollama')">Test</button>
              </div>
              <div label>Run locally with: <code>ollama serve</code></div>
            </div>
          </div>
        </div>

        <div class="settings-section">
          <div h2>HuggingFace Integration</div>
          <div col gap="2">
            <input x input w-full id="hf-token" placeholder="HuggingFace Token"
                   value="${props.huggingfaceToken || ''}" />
            <button x btn onclick="Settings.saveHuggingFaceToken()">Save Token</button>
          </div>
        </div>

        <div class="settings-section">
          <div h2>Configured Models</div>
          <div col gap="2">
            ${(props.models || []).map(model => `
              <div class="model-item">
                <div row spread>
                  <div h3>${model.name}</div>
                  <div row gap="2">
                    <span class="badge">${model.provider || 'local'}</span>
                    <button x btn onclick="ModelManager.remove('${model.id}')">Remove</button>
                  </div>
                </div>
                <div label>${model.llmModel || model.url || 'Default model'}</div>
              </div>
            `).join('')}
          </div>

          <div col gap="2" style="margin-top: var(--s-3);">
            <div h3>Add Custom Model</div>
            <input x input id="model-name" placeholder="Display Name" />
            <div row gap="2">
              <select x input id="model-provider" style="flex: 1;">
                <option value="ollama">Ollama (Local)</option>
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
              </select>
              <input x input id="model-id" placeholder="Model ID (e.g., gpt-4o)" style="flex: 2;" />
            </div>
            <button x btn onclick="ModelManager.addWithProvider()">Add Model</button>
          </div>
        </div>
      </div>
    `);

    // Dashboard Component
    this.registerComponent("UserDashboard", (props) => `
      <div col gap="4" pad="3">
        <div row spread align-center>
          <div h1>User Dashboard</div>
          <button x btn onclick="App.showView('chat')">← Back</button>
        </div>

        <div row gap="4">
          <div x panel flex-1>
            <div h2>Welcome, ${props.user?.username || 'User'}</div>
            <div label>${props.user?.email || 'Local User'}</div>
          </div>

          <div x panel flex-1>
            <div h2>Statistics</div>
            <div col gap="2">
              <div>Total Chats: ${props.stats?.totalChats || 0}</div>
              <div>Messages Sent: ${props.stats?.totalMessages || 0}</div>
              <div>Models Available: ${props.stats?.modelsCount || 0}</div>
            </div>
          </div>
        </div>

        <div x panel>
          <div h2>Recent Activity</div>
          <div col gap="2">
            ${ChatHistory.getAll().slice(0, 5).map(chat => `
              <div row spread>
                <div>${chat.title}</div>
                <div label>${new Date(chat.updated).toLocaleDateString()}</div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `);
  }
};

/* ============================================================
   APPLICATION STATE MANAGEMENT
   ============================================================ */
const App = {
  currentView: 'chat',

  init() {
    ASX.initComponents();
    this.checkAuth();
    this.setupEventListeners();
  },

  checkAuth() {
    if (User.current) {
      this.showApp();
    } else {
      this.showAuth();
    }
  },

  showAuth() {
    document.getElementById('app').style.display = 'none';
    document.getElementById('auth-screen').style.display = 'flex';
  },

  showApp() {
    document.getElementById('app').style.display = 'grid';
    document.getElementById('auth-screen').style.display = 'none';
    this.render();
  },

  showView(view) {
    this.currentView = view;
    this.render();
  },

  render() {
    // Always render sidebar
    ASX.renderPacket(SCXQ2.PACKETS.SIDEBAR, 'sidebar');

    // Render main content based on current view
    const chatArea = document.getElementById('chat-area');
    const inputArea = document.getElementById('input-area');

    switch(this.currentView) {
      case 'chat':
        ASX.renderPacket(SCXQ2.PACKETS.CHAT_VIEW, 'chat-area');
        ASX.renderPacket(SCXQ2.PACKETS.INPUT, 'input-area');
        break;
      case 'settings':
        ASX.renderPacket(SCXQ2.PACKETS.SETTINGS, 'chat-area');
        inputArea.innerHTML = '';
        break;
      case 'dashboard':
        ASX.renderPacket(SCXQ2.PACKETS.DASHBOARD, 'chat-area');
        inputArea.innerHTML = '';
        break;
    }

    // Scroll chat to bottom
    if (this.currentView === 'chat') {
      setTimeout(() => {
        const chatArea = document.getElementById('chat-area');
        chatArea.scrollTop = chatArea.scrollHeight;
      }, 100);
    }
  },

  setupEventListeners() {
    document.addEventListener('click', (e) => {
      if (e.target.id === 'btn-send') {
        e.preventDefault();
        this.sendMessage();
      }

      if (e.target.id === 'btn-new-chat') {
        ChatHistory.createNew();
        this.render();
      }

      if (e.target.id === 'btn-test-api') {
        this.testApiConnection();
      }
    });

    document.addEventListener('keypress', (e) => {
      if (e.target.id === 'chat-input' && e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });
  },

  async sendMessage() {
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    const modelSelect = document.getElementById('model-select');
    const modelId = modelSelect?.value;

    if (!message) return;

    // Add user message
    ChatHistory.addMessage('user', message);
    input.value = '';
    this.render();

    // Generate AI response using K'UHUL
    try {
      const response = await AI.generateResponse(message, modelId);
      ChatHistory.addMessage('assistant', response, modelId);
    } catch (error) {
      ChatHistory.addMessage('system', `Error: ${error.message}`);
    }

    this.render();
  },

  async testApiConnection() {
    const url = document.getElementById('api-url')?.value;
    if (!url) return;

    try {
      const response = await fetch(`${url}/api/tags`);
      if (response.ok) {
        alert('API connection successful!');
      } else {
        alert('API connection failed');
      }
    } catch (error) {
      alert('API connection error: ' + error.message);
    }
  }
};

/* ============================================================
   USER MANAGEMENT
   ============================================================ */
const User = {
  current: null,

  async loginGoogle() {
    // Simulate Google OAuth
    this.current = {
      id: 'user_' + Date.now(),
      username: 'google_user',
      email: 'user@gmail.com',
      avatar: null,
      provider: 'google'
    };
    await this.saveToStorage();
    App.showApp();
  },

  async loginLocal(username, password) {
    // Simulate local auth
    const users = await this.getUsersFromStorage();
    let user = users.find(u => u.username === username);

    if (!user) {
      user = {
        id: 'local_' + Date.now(),
        username,
        email: null,
        avatar: null,
        provider: 'local',
        createdAt: new Date().toISOString()
      };
      users.push(user);
      await this.saveUsersToStorage(users);
    }

    this.current = user;
    await this.saveToStorage();
    App.showApp();
  },

  logout() {
    this.current = null;
    localStorage.removeItem('mx2lm_current_user');
    App.showAuth();
  },

  getStats() {
    const chats = ChatHistory.getAll();
    return {
      totalChats: chats.length,
      totalMessages: chats.reduce((sum, chat) => sum + chat.messages.length, 0),
      modelsCount: ModelManager.getAll().length
    };
  },

  async saveToStorage() {
    if (this.current) {
      localStorage.setItem('mx2lm_current_user', JSON.stringify(this.current));
    }
  },

  async getUsersFromStorage() {
    try {
      const encrypted = localStorage.getItem('mx2lm_users');
      if (!encrypted) return [];
      return JSON.parse(encrypted);
    } catch {
      return [];
    }
  },

  async saveUsersToStorage(users) {
    localStorage.setItem('mx2lm_users', JSON.stringify(users));
  }
};

/* ============================================================
   CHAT HISTORY MANAGEMENT
   ============================================================ */
const ChatHistory = {
  chats: [],
  activeChatId: null,

  getAll() {
    if (this.chats.length === 0) {
      this.loadFromStorage();
    }
    return this.chats;
  },

  getActive() {
    if (!this.activeChatId && this.chats.length > 0) {
      this.activeChatId = this.chats[0].id;
    }
    return this.chats.find(chat => chat.id === this.activeChatId);
  },

  setActive(chatId) {
    this.activeChatId = chatId;
    this.saveToStorage();
  },

  createNew() {
    const chat = {
      id: 'chat_' + Date.now(),
      title: 'New Chat',
      messages: [],
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    };

    this.chats.unshift(chat);
    this.activeChatId = chat.id;
    this.saveToStorage();
    return chat;
  },

  addMessage(role, content, model = null) {
    const chat = this.getActive();
    if (!chat) return;

    const message = {
      role,
      content,
      model,
      timestamp: new Date().toISOString()
    };

    chat.messages.push(message);
    chat.updated = new Date().toISOString();

    // Update title if first assistant message
    if (role === 'assistant' && chat.messages.length === 2) {
      chat.title = content.substring(0, 30) + (content.length > 30 ? '...' : '');
    }

    this.saveToStorage();
  },

  loadFromStorage() {
    try {
      const saved = localStorage.getItem('mx2lm_chat_history');
      if (saved) {
        const data = JSON.parse(saved);
        this.chats = data.chats || [];
        this.activeChatId = data.activeChatId;
      }

      if (this.chats.length === 0) {
        this.createNew();
      }
    } catch {
      this.createNew();
    }
  },

  saveToStorage() {
    const data = {
      chats: this.chats,
      activeChatId: this.activeChatId
    };
    localStorage.setItem('mx2lm_chat_history', JSON.stringify(data));
  }
};

/* ============================================================
   AI SERVICE INTEGRATION - Multi-Provider LLM Support
   ============================================================ */
const AI = {
  isGenerating: false,
  streamingContent: '',
  initialized: false,

  // Initialize LLM providers from settings
  async init() {
    if (this.initialized) return;

    try {
      // Auto-configure from saved settings
      if (typeof LLM !== 'undefined') {
        await LLM.autoConfig();
        this.initialized = true;
        console.log('AI: Providers initialized:', LLM.getAvailableProviders());
      }
    } catch (error) {
      console.warn('AI: Provider initialization warning:', error.message);
    }
  },

  // Get current conversation context
  getConversationContext() {
    const chat = ChatHistory.getActive();
    if (!chat || !chat.messages) return [];

    // Convert to LLM format, limit to last 10 messages for context
    return chat.messages.slice(-10).map(msg => ({
      role: msg.role === 'system' ? 'system' : msg.role,
      content: msg.content
    }));
  },

  // Main response generation
  async generateResponse(message, modelId = null, options = {}) {
    this.isGenerating = true;
    this.streamingContent = '';
    App.render();

    try {
      const model = ModelManager.get(modelId) || ModelManager.getAll()[0];

      // Check if LLM is available
      if (typeof LLM === 'undefined' || LLM.getAvailableProviders().length === 0) {
        // Fallback to simulated response if no providers configured
        return await this.simulatedResponse(message);
      }

      // Determine provider from model
      const providerType = model?.provider || LLM.activeProvider || 'ollama';

      // Build messages with context
      const context = this.getConversationContext();
      const messages = [
        ...context,
        { role: 'user', content: message }
      ];

      // Use streaming if enabled
      if (options.stream !== false) {
        return await this.streamResponse(messages, {
          provider: providerType,
          model: model?.llmModel || model?.name,
          conversationId: ChatHistory.getActive()?.id
        });
      } else {
        const response = await LLM.chat(messages, {
          provider: providerType,
          model: model?.llmModel || model?.name,
          conversationId: ChatHistory.getActive()?.id
        });
        return response.content;
      }

    } catch (error) {
      console.error('AI: Generation error:', error);

      // Provide helpful error message
      if (error.status === 401) {
        throw new Error('Invalid API key. Please check your settings.');
      } else if (error.message?.includes('fetch')) {
        throw new Error('Cannot connect to AI service. Check your connection or API endpoint.');
      } else {
        throw new Error(error.message || 'Failed to generate response');
      }
    } finally {
      this.isGenerating = false;
    }
  },

  // Streaming response with live updates
  async streamResponse(messages, options) {
    return new Promise((resolve, reject) => {
      LLM.chatStream(messages, options, (chunk, fullContent) => {
        this.streamingContent = fullContent;
        // Update UI with streaming content
        this.updateStreamingUI(fullContent);
      })
      .then(response => resolve(response.content))
      .catch(reject);
    });
  },

  // Update UI during streaming
  updateStreamingUI(content) {
    const chatArea = document.getElementById('chat-area');
    if (!chatArea) return;

    // Find or create streaming message element
    let streamingEl = chatArea.querySelector('.message-streaming');
    if (!streamingEl) {
      streamingEl = document.createElement('div');
      streamingEl.className = 'message message-assistant message-streaming';
      streamingEl.innerHTML = `
        <div style="font-weight: 600; margin-bottom: 4px;">
          <span class="streaming-indicator"></span> Assistant
        </div>
        <div class="streaming-content"></div>
      `;
      chatArea.appendChild(streamingEl);
    }

    const contentEl = streamingEl.querySelector('.streaming-content');
    if (contentEl) {
      contentEl.textContent = content;
    }

    // Auto-scroll
    chatArea.scrollTop = chatArea.scrollHeight;
  },

  // Fallback simulated response when no providers available
  async simulatedResponse(message) {
    await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 1200));

    const responses = [
      "I understand your question. To connect to a real AI, please configure your API keys in Settings.",
      "This is a simulated response. Add your OpenAI, Anthropic, or start Ollama locally for real AI conversations.",
      "To enable AI responses, go to Settings and add your API key, or run Ollama locally on port 11434.",
      "Configure an AI provider in Settings to get real responses. Supports OpenAI, Anthropic, and local Ollama.",
      "No AI provider configured. Visit Settings to add your API key or connect to a local model."
    ];

    return responses[Math.floor(Math.random() * responses.length)];
  },

  // Test provider connection
  async testProvider(providerType) {
    if (typeof LLM === 'undefined') {
      return { success: false, error: 'LLM module not loaded' };
    }

    const provider = LLM.getProvider(providerType);
    if (!provider) {
      return { success: false, error: 'Provider not initialized' };
    }

    return await provider.testConnection();
  },

  // Configure a specific provider
  configureProvider(providerType, config) {
    if (typeof LLM === 'undefined') {
      console.error('LLM module not loaded');
      return false;
    }

    try {
      LLM.init(providerType, config);
      this.initialized = true;
      return true;
    } catch (error) {
      console.error('Failed to configure provider:', error);
      return false;
    }
  }
};

/* ============================================================
   MODEL MANAGEMENT
   ============================================================ */
const ModelManager = {
  models: [],

  getAll() {
    if (this.models.length === 0) {
      this.loadFromStorage();
    }
    return this.models;
  },

  get(id) {
    return this.models.find(model => model.id === id);
  },

  add() {
    const name = document.getElementById('model-name')?.value;
    const url = document.getElementById('model-url')?.value;

    if (!name || !url) {
      alert('Please provide both name and URL');
      return;
    }

    const model = {
      id: 'model_' + Date.now(),
      name,
      url,
      type: url.includes('huggingface') ? 'huggingface' : 'local',
      added: new Date().toISOString()
    };

    this.models.push(model);
    this.saveToStorage();
    App.render();

    document.getElementById('model-name').value = '';
    document.getElementById('model-url').value = '';
  },

  // Add model with provider support
  addWithProvider() {
    const name = document.getElementById('model-name')?.value;
    const provider = document.getElementById('model-provider')?.value;
    const llmModel = document.getElementById('model-id')?.value;

    if (!name) {
      alert('Please provide a display name');
      return;
    }

    const model = {
      id: 'model_' + Date.now(),
      name,
      provider,
      llmModel: llmModel || this.getDefaultModel(provider),
      added: new Date().toISOString()
    };

    this.models.push(model);
    this.saveToStorage();
    App.render();

    // Clear inputs
    document.getElementById('model-name').value = '';
    document.getElementById('model-id').value = '';
  },

  // Get default model for provider
  getDefaultModel(provider) {
    const defaults = {
      openai: 'gpt-4o-mini',
      anthropic: 'claude-3-5-sonnet-20241022',
      ollama: 'llama3.2'
    };
    return defaults[provider] || 'default';
  },

  remove(id) {
    this.models = this.models.filter(model => model.id !== id);
    this.saveToStorage();
    App.render();
  },

  loadFromStorage() {
    try {
      const saved = localStorage.getItem('mx2lm_models');
      if (saved) {
        this.models = JSON.parse(saved);
      }

      if (this.models.length === 0) {
        this.models.push({
          id: 'default_model',
          name: 'Local AI',
          url: 'http://localhost:11434',
          type: 'local',
          added: new Date().toISOString()
        });
      }
    } catch {
      this.models = [];
    }
  },

  saveToStorage() {
    localStorage.setItem('mx2lm_models', JSON.stringify(this.models));
  }
};

/* ============================================================
   SETTINGS MANAGEMENT
   ============================================================ */
const Settings = {
  get(key) {
    try {
      const settings = JSON.parse(localStorage.getItem('mx2lm_settings') || '{}');
      return settings[key];
    } catch {
      return null;
    }
  },

  set(key, value) {
    try {
      const settings = JSON.parse(localStorage.getItem('mx2lm_settings') || '{}');
      settings[key] = value;
      localStorage.setItem('mx2lm_settings', JSON.stringify(settings));
      return true;
    } catch {
      return false;
    }
  },

  getAll() {
    try {
      return JSON.parse(localStorage.getItem('mx2lm_settings') || '{}');
    } catch {
      return {};
    }
  },

  saveHuggingFaceToken() {
    const token = document.getElementById('hf-token')?.value;
    if (token) {
      this.set('huggingfaceToken', token);
      alert('Token saved successfully!');
    }
  },

  // Save provider configuration
  async saveProvider(provider) {
    let success = false;

    switch (provider) {
      case 'openai': {
        const keyInput = document.getElementById('openai-key');
        const key = keyInput?.value;
        // Only save if it's a new key (not masked)
        if (key && !key.includes('••')) {
          this.set('openaiApiKey', key);
          const model = document.getElementById('openai-model')?.value;
          this.set('openaiModel', model);

          // Initialize provider
          if (typeof LLM !== 'undefined') {
            LLM.init('openai', { apiKey: key, model });
            success = true;
          }
        } else if (this.get('openaiApiKey')) {
          success = true; // Already configured
        }
        break;
      }

      case 'anthropic': {
        const keyInput = document.getElementById('anthropic-key');
        const key = keyInput?.value;
        if (key && !key.includes('••')) {
          this.set('anthropicApiKey', key);
          const model = document.getElementById('anthropic-model')?.value;
          this.set('anthropicModel', model);

          if (typeof LLM !== 'undefined') {
            LLM.init('anthropic', { apiKey: key, model });
            success = true;
          }
        } else if (this.get('anthropicApiKey')) {
          success = true;
        }
        break;
      }

      case 'ollama': {
        const url = document.getElementById('ollama-url')?.value || 'http://localhost:11434';
        this.set('ollamaUrl', url);
        const model = document.getElementById('ollama-model')?.value;
        this.set('ollamaModel', model);

        if (typeof LLM !== 'undefined') {
          LLM.init('ollama', { baseUrl: url, model });
          success = true;
        }
        break;
      }
    }

    if (success) {
      this.updateProviderStatus(provider, 'Configured', 'success');
      alert(`${provider.charAt(0).toUpperCase() + provider.slice(1)} provider saved!`);
    } else {
      alert('Please enter a valid API key');
    }

    return success;
  },

  // Test provider connection
  async testProvider(provider) {
    this.updateProviderStatus(provider, 'Testing...', 'testing');

    // First save the provider if needed
    await this.saveProvider(provider);

    const result = await AI.testProvider(provider);

    if (result.success) {
      this.updateProviderStatus(provider, 'Connected', 'success');
      alert(`${provider} connection successful!`);
    } else {
      this.updateProviderStatus(provider, 'Failed', 'error');
      alert(`${provider} connection failed: ${result.error}`);
    }

    return result;
  },

  // Update provider status in UI
  updateProviderStatus(provider, status, state) {
    const statusEl = document.getElementById(`${provider}-status`);
    if (statusEl) {
      statusEl.textContent = status;
      statusEl.className = `provider-status provider-${state}`;
    }
  },

  // Check all provider statuses on load
  async checkProviderStatuses() {
    // Check OpenAI
    if (this.get('openaiApiKey')) {
      this.updateProviderStatus('openai', 'Configured', 'success');
    }

    // Check Anthropic
    if (this.get('anthropicApiKey')) {
      this.updateProviderStatus('anthropic', 'Configured', 'success');
    }

    // Check Ollama (always try to connect)
    try {
      const response = await fetch(`${this.get('ollamaUrl') || 'http://localhost:11434'}/api/tags`);
      if (response.ok) {
        this.updateProviderStatus('ollama', 'Running', 'success');
      } else {
        this.updateProviderStatus('ollama', 'Not running', 'warning');
      }
    } catch {
      this.updateProviderStatus('ollama', 'Not running', 'warning');
    }
  }
};

/* ============================================================
   INITIALIZATION
   ============================================================ */
document.addEventListener('DOMContentLoaded', async () => {
  // Check for existing user session
  try {
    const savedUser = localStorage.getItem('mx2lm_current_user');
    if (savedUser) {
      User.current = JSON.parse(savedUser);
    }
  } catch (e) {
    console.log('No existing user session');
  }

  // Initialize chat history
  ChatHistory.loadFromStorage();

  // Initialize models
  ModelManager.loadFromStorage();

  // Initialize AI providers
  await AI.init();

  // Setup auth event listeners
  document.getElementById('btn-google-auth')?.addEventListener('click', () => {
    User.loginGoogle();
  });

  document.getElementById('btn-local-auth')?.addEventListener('click', () => {
    const username = document.getElementById('local-username')?.value;
    const password = document.getElementById('local-password')?.value;

    if (username && password) {
      User.loginLocal(username, password);
    } else {
      alert('Please enter both username and password');
    }
  });

  // Initialize the application
  App.init();

  // Check provider statuses after a brief delay
  setTimeout(() => Settings.checkProviderStatuses(), 500);
});

console.log('MX2LM CHAT APPLICATION - READY');
console.log('Multi-Provider LLM Support: OpenAI, Anthropic, Ollama');
