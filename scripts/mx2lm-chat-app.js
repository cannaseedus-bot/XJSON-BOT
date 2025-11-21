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
        huggingfaceToken: Settings.get('huggingfaceToken')
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
          <div h2>HuggingFace Integration</div>
          <div col gap="2">
            <input x input w-full id="hf-token" placeholder="HuggingFace Token"
                   value="${props.huggingfaceToken || ''}" />
            <button x btn onclick="Settings.saveHuggingFaceToken()">Save Token</button>
          </div>
        </div>

        <div class="settings-section">
          <div h2>Local Models</div>
          <div col gap="2">
            ${(props.models || []).map(model => `
              <div class="model-item">
                <div row spread>
                  <div h3>${model.name}</div>
                  <button x btn onclick="ModelManager.remove('${model.id}')">Remove</button>
                </div>
                <div label>ID: ${model.id} | URL: ${model.url}</div>
              </div>
            `).join('')}
          </div>

          <div col gap="2" style="margin-top: var(--s-3);">
            <input x input id="model-name" placeholder="Model Name" />
            <input x input id="model-url" placeholder="Model URL (HuggingFace or local)" />
            <button x btn onclick="ModelManager.add()">Add Model</button>
          </div>
        </div>

        <div class="settings-section">
          <div h2>Local REST API</div>
          <div col gap="2">
            <div row gap="2">
              <input x input flex-1 id="api-url" placeholder="http://localhost:11434" value="http://localhost:11434" />
              <button x btn id="btn-test-api">Test Connection</button>
            </div>
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
   AI SERVICE INTEGRATION
   ============================================================ */
const AI = {
  isGenerating: false,

  async generateResponse(message, modelId = null) {
    this.isGenerating = true;
    App.render();

    try {
      const model = ModelManager.get(modelId) || ModelManager.getAll()[0];

      if (!model) {
        throw new Error('No models available');
      }

      // Use K'UHUL agent spawning for AI response
      const agent = await Ω.spawn('chat', {topic: 'conversation'});

      // Simulate AI response
      await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

      const responses = [
        "I understand your question. Based on my knowledge, this is a complex subject that requires careful consideration of multiple factors.",
        "That's an interesting point! From my perspective, there are several approaches we could take.",
        "I appreciate you sharing this with me. Let me provide some insights that might help clarify the situation.",
        "Based on the information you've provided, I can offer the following analysis and recommendations.",
        "This is a common question. The solution typically involves considering these key aspects..."
      ];

      return responses[Math.floor(Math.random() * responses.length)];

    } finally {
      this.isGenerating = false;
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

  saveHuggingFaceToken() {
    const token = document.getElementById('hf-token')?.value;
    if (token) {
      this.set('huggingfaceToken', token);
      alert('Token saved successfully!');
    }
  }
};

/* ============================================================
   INITIALIZATION
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
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
});

console.log('MX2LM CHAT APPLICATION - READY');
