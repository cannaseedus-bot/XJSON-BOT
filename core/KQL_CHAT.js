/* KQL_CHAT.js — K'UHUL Query Language for Chat/Inference
   SRP-integrated chat forms, history, and inference routing

   Usage:
     KQL.boot();
     KQL.submit({ prompt: "Hello", model: "mx2lm" });
     KQL.query("⟁LOAD⟁ ⟁CHATS⟁ ⟁LIMIT⟁ 25");
     KQL.search("quantum physics");
     KQL.getModels(); // Returns all registered models
*/
(() => {
  const DB_NAME = 'asx_kql_chat';
  const DB_VERSION = 1;
  const REGISTRY_PATH = '../schemas/kql.model-registry.v1.json';
  const MX2LM_API_BASE = 'https://mx2lm.app/api.php';
  let db = null;
  let modelRegistry = null;

  // ---- IndexedDB Setup ----
  async function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => { db = req.result; resolve(db); };
      req.onupgradeneeded = (e) => {
        const d = e.target.result;
        if (!d.objectStoreNames.contains('messages')) {
          const store = d.createObjectStore('messages', { keyPath: 'id' });
          store.createIndex('chat_id', 'chat_id', { unique: false });
          store.createIndex('ts', 'ts', { unique: false });
          store.createIndex('role', 'role', { unique: false });
        }
        if (!d.objectStoreNames.contains('chats')) {
          const store = d.createObjectStore('chats', { keyPath: 'id' });
          store.createIndex('ts', 'ts', { unique: false });
          store.createIndex('model', 'model', { unique: false });
        }
        if (!d.objectStoreNames.contains('models')) {
          d.createObjectStore('models', { keyPath: 'id' });
        }
      };
    });
  }

  // ---- KQL Parser ----
  function parseKQL(query) {
    // Format: ⟁COMMAND⟁ ⟁ARG⟁ value ⟁ARG2⟁ value2
    const tokens = query.split('⟁').filter(t => t.trim());
    const cmd = { op: tokens[0]?.toUpperCase(), args: {} };
    for (let i = 1; i < tokens.length; i += 2) {
      const key = tokens[i]?.toUpperCase();
      const val = tokens[i + 1]?.trim();
      if (key) cmd.args[key] = val;
    }
    return cmd;
  }

  // ---- KQL Executor ----
  async function executeKQL(query) {
    const cmd = typeof query === 'string' ? parseKQL(query) : query;

    switch (cmd.op) {
      case 'LOAD':
        return await kqlLoad(cmd.args);
      case 'SAVE':
        return await kqlSave(cmd.args);
      case 'SEARCH':
        return await kqlSearch(cmd.args);
      case 'DELETE':
        return await kqlDelete(cmd.args);
      case 'INFER':
        return await kqlInfer(cmd.args);
      default:
        return { ok: false, error: `Unknown KQL op: ${cmd.op}` };
    }
  }

  async function kqlLoad(args) {
    const store = args.STORE || args.CHATS ? 'chats' : 'messages';
    const limit = parseInt(args.LIMIT) || 50;
    const chatId = args.CHAT_ID;

    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readonly');
      const os = tx.objectStore(store);
      const results = [];

      let cursor;
      if (chatId && store === 'messages') {
        const idx = os.index('chat_id');
        cursor = idx.openCursor(IDBKeyRange.only(chatId), 'prev');
      } else {
        cursor = os.openCursor(null, 'prev');
      }

      cursor.onsuccess = (e) => {
        const c = e.target.result;
        if (c && results.length < limit) {
          results.push(c.value);
          c.continue();
        } else {
          resolve({ ok: true, data: results.reverse(), count: results.length });
        }
      };
      cursor.onerror = () => reject({ ok: false, error: cursor.error });
    });
  }

  async function kqlSave(args) {
    const store = args.STORE || 'messages';
    const data = args.DATA ? JSON.parse(args.DATA) : args;

    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite');
      const os = tx.objectStore(store);
      const req = os.put(data);
      req.onsuccess = () => resolve({ ok: true, id: data.id });
      req.onerror = () => reject({ ok: false, error: req.error });
    });
  }

  async function kqlSearch(args) {
    const term = (args.TERM || args.Q || '').toLowerCase();
    const store = args.STORE || 'messages';
    const limit = parseInt(args.LIMIT) || 20;

    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readonly');
      const os = tx.objectStore(store);
      const results = [];

      const cursor = os.openCursor();
      cursor.onsuccess = (e) => {
        const c = e.target.result;
        if (c && results.length < limit) {
          const content = JSON.stringify(c.value).toLowerCase();
          if (content.includes(term)) {
            results.push(c.value);
          }
          c.continue();
        } else {
          resolve({ ok: true, data: results, count: results.length, term });
        }
      };
      cursor.onerror = () => reject({ ok: false, error: cursor.error });
    });
  }

  async function kqlDelete(args) {
    const store = args.STORE || 'messages';
    const id = args.ID;

    if (!id) return { ok: false, error: 'ID required' };

    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite');
      const os = tx.objectStore(store);
      const req = os.delete(id);
      req.onsuccess = () => resolve({ ok: true, deleted: id });
      req.onerror = () => reject({ ok: false, error: req.error });
    });
  }

  async function kqlInfer(args) {
    const prompt = args.PROMPT || args.Q;
    const model = args.MODEL || 'mx2lm';
    const chatId = args.CHAT_ID || `chat_${Date.now()}`;

    // Create user message
    const userMsg = {
      id: `msg_${Date.now()}_user`,
      chat_id: chatId,
      role: 'user',
      content: prompt,
      model,
      ts: Date.now()
    };

    // Save user message
    await kqlSave({ STORE: 'messages', ...userMsg, DATA: JSON.stringify(userMsg) });

    // Route to inference backend (stub - replace with actual API calls)
    const response = await routeInference(prompt, model);

    // Create assistant message
    const assistantMsg = {
      id: `msg_${Date.now()}_assistant`,
      chat_id: chatId,
      role: 'assistant',
      content: response.content,
      model,
      ts: Date.now(),
      tokens: response.tokens || 0
    };

    // Save assistant message
    await kqlSave({ STORE: 'messages', ...assistantMsg, DATA: JSON.stringify(assistantMsg) });

    return {
      ok: true,
      chat_id: chatId,
      user: userMsg,
      assistant: assistantMsg
    };
  }

  // ---- Model Registry Loader ----
  async function loadModelRegistry() {
    if (modelRegistry) return modelRegistry;

    try {
      const res = await fetch(REGISTRY_PATH);
      if (res.ok) {
        modelRegistry = await res.json();
        console.log(`[KQL] Loaded ${modelRegistry.models?.length || 0} models from registry`);
        return modelRegistry;
      }
    } catch (e) {
      console.warn('[KQL] Registry load failed, using defaults:', e.message);
    }

    // Fallback registry - MX2LM 11 production models
    modelRegistry = {
      models: [
        { "@id": "asx://model/janus-pro.v1", id: "janus-pro", name: "Janus Pro", provider: "mx2lm", icon: "🧠", quantum_enhanced: true, status: "active" },
        { "@id": "asx://model/janus-flow.v1", id: "janus-flow", name: "Janus Flow", provider: "mx2lm", icon: "⚡", quantum_enhanced: false, status: "active" },
        { "@id": "asx://model/deepseek-r1.v1", id: "deepseek-r1", name: "DeepSeek R1", provider: "deepseek", icon: "🔮", quantum_enhanced: true, status: "active" },
        { "@id": "asx://model/deepseek-coder.v1", id: "deepseek-coder", name: "DeepSeek Coder", provider: "deepseek", icon: "💻", quantum_enhanced: true, status: "active" },
        { "@id": "asx://model/llama3.v1", id: "llama3", name: "Llama 3", provider: "meta", icon: "🦙", quantum_enhanced: false, status: "active" },
        { "@id": "asx://model/mistral.v1", id: "mistral", name: "Mistral", provider: "mistral", icon: "🌪️", quantum_enhanced: false, status: "active" },
        { "@id": "asx://model/codellama.v1", id: "codellama", name: "CodeLlama", provider: "meta", icon: "🦙", quantum_enhanced: false, status: "active" },
        { "@id": "asx://model/qwen-coder.v1", id: "qwen-coder", name: "Qwen Coder", provider: "qwen", icon: "🌟", quantum_enhanced: false, status: "active" },
        { "@id": "asx://model/cline-agent.v1", id: "cline-agent", name: "Cline Agent", provider: "mx2lm", icon: "🤖", quantum_enhanced: true, status: "active" },
        { "@id": "asx://model/mx2-inference.v1", id: "mx2-inference", name: "MX2 Inference", provider: "mx2lm", icon: "⚙️", quantum_enhanced: true, status: "active" },
        { "@id": "asx://model/kuhul-quantum.v1", id: "kuhul-quantum", name: "K'UHUL Quantum", provider: "mx2lm", icon: "⚛️", quantum_enhanced: true, status: "active" }
      ],
      default_model: "janus-pro"
    };
    return modelRegistry;
  }

  function getModelById(modelId) {
    if (!modelRegistry) return null;
    // Support both short names (mx2lm) and full IDs (asx://model/mx2lm.v1)
    return modelRegistry.models.find(m =>
      m["@id"] === modelId ||
      m["@id"].includes(`/${modelId}.`) ||
      m.name.toLowerCase().replace(/\s+/g, '') === modelId.toLowerCase()
    );
  }

  // ---- Inference Router ----
  async function routeInference(prompt, model) {
    await loadModelRegistry();

    // Find model in registry
    const modelDef = getModelById(model);
    const modelId = modelDef?.id || model;
    const modelName = modelDef?.name || model;
    const provider = modelDef?.provider || 'mx2lm';
    const isQuantum = modelDef?.quantum_enhanced || false;

    // Build MX2LM API URL
    const apiUrl = `${MX2LM_API_BASE}?route=chat&model=${encodeURIComponent(modelId)}`;

    try {
      // POST to MX2LM unified API
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Model': modelId,
          'X-Quantum': isQuantum ? 'true' : 'false'
        },
        body: JSON.stringify({
          message: prompt,
          model: modelId,
          options: {
            temperature: modelDef?.parameters?.temperature || 0.7,
            max_tokens: modelDef?.parameters?.max_tokens || 2000,
            stream: false
          }
        })
      }).catch(() => null);

      if (response?.ok) {
        const data = await response.json();

        // Parse MX2LM API response format
        const content = data.response?.response ||
                       data.response?.content ||
                       data.response?.text ||
                       data.response ||
                       '';

        return {
          content: typeof content === 'string' ? content : JSON.stringify(content),
          tokens: data.response?.tokens || data.tokens || 0,
          provider,
          model: modelName,
          quantum_enhanced: isQuantum,
          backend: 'mx2lm-unified-api-v7'
        };
      }

      // API call failed - return informative stub
      return {
        content: `[${modelName}] Backend temporarily unavailable. Model: ${modelId}, Provider: ${provider}`,
        tokens: 0,
        provider,
        model: modelName,
        quantum_enhanced: isQuantum,
        stub: true,
        api_url: apiUrl
      };
    } catch (e) {
      return {
        content: `[Error] MX2LM API failed: ${e.message}`,
        tokens: 0,
        provider,
        model: modelName,
        error: true
      };
    }
  }

  // ---- Chat Form Handler ----
  function createChatForm(container, options = {}) {
    const form = document.createElement('form');
    form.className = 'kql-chat-form';
    form.innerHTML = `
      <div class="kql-chat-messages" id="kql-messages"></div>
      <div class="kql-chat-input-row">
        <input type="text" name="prompt" placeholder="${options.placeholder || 'Type a message...'}" autocomplete="off">
        <button type="submit" class="kql-send-btn">➤</button>
      </div>
      <div class="kql-chat-actions">
        <button type="button" class="kql-action" data-action="search">🔍 Search</button>
        <button type="button" class="kql-action" data-action="history">📜 History</button>
        <button type="button" class="kql-action" data-action="clear">🗑️ Clear</button>
      </div>
    `;

    const messagesDiv = form.querySelector('#kql-messages');
    const input = form.querySelector('input[name="prompt"]');
    let currentChatId = options.chatId || `chat_${Date.now()}`;
    let currentModel = options.model || 'mx2lm';

    // Render message
    function renderMsg(msg) {
      const div = document.createElement('div');
      div.className = `kql-msg kql-msg-${msg.role}`;
      div.innerHTML = `
        <div class="kql-msg-header">
          <span class="kql-msg-role">${msg.role}</span>
          <span class="kql-msg-time">${new Date(msg.ts).toLocaleTimeString()}</span>
        </div>
        <div class="kql-msg-content">${msg.content}</div>
      `;
      messagesDiv.appendChild(div);
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
      return div;
    }

    // Submit handler
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const prompt = input.value.trim();
      if (!prompt) return;

      input.value = '';
      input.disabled = true;

      // Show user message immediately
      renderMsg({ role: 'user', content: prompt, ts: Date.now() });

      // Show loading
      const loadingDiv = renderMsg({ role: 'assistant', content: '⏳ Thinking...', ts: Date.now() });

      // SRP event submission
      if (typeof SRP !== 'undefined') {
        await SRP.submit({
          event_type: 'kql/infer',
          payload: { prompt, model: currentModel, chat_id: currentChatId }
        });
      }

      // KQL inference
      const result = await executeKQL({
        op: 'INFER',
        args: { PROMPT: prompt, MODEL: currentModel, CHAT_ID: currentChatId }
      });

      // Update loading to response
      if (result.ok) {
        loadingDiv.querySelector('.kql-msg-content').textContent = result.assistant.content;
      } else {
        loadingDiv.querySelector('.kql-msg-content').textContent = `Error: ${result.error}`;
      }

      input.disabled = false;
      input.focus();
    });

    // Action buttons
    form.addEventListener('click', async (e) => {
      const action = e.target.dataset?.action;
      if (!action) return;

      switch (action) {
        case 'search':
          const term = prompt('Search messages:');
          if (term) {
            const res = await executeKQL(`⟁SEARCH⟁ ⟁TERM⟁ ${term}`);
            console.log('Search results:', res);
            alert(`Found ${res.count} messages`);
          }
          break;
        case 'history':
          const hist = await executeKQL(`⟁LOAD⟁ ⟁CHATS⟁ ⟁LIMIT⟁ 10`);
          console.log('Chat history:', hist);
          break;
        case 'clear':
          if (confirm('Clear current chat?')) {
            messagesDiv.innerHTML = '';
            currentChatId = `chat_${Date.now()}`;
          }
          break;
      }
    });

    // Load existing messages
    async function loadHistory() {
      const res = await executeKQL({
        op: 'LOAD',
        args: { STORE: 'messages', CHAT_ID: currentChatId, LIMIT: '50' }
      });
      if (res.ok) {
        res.data.forEach(renderMsg);
      }
    }

    // Model setter
    form.setModel = (model) => { currentModel = model; };
    form.setChatId = (id) => { currentChatId = id; };
    form.loadHistory = loadHistory;
    form.renderMsg = renderMsg;

    container.appendChild(form);
    return form;
  }

  // ---- KQL Public API ----
  const KQL = window.KQL = {
    db: null,
    registry: null,

    async boot() {
      this.db = await openDB();
      this.registry = await loadModelRegistry();
      console.log('[KQL] Chat database initialized');
      console.log(`[KQL] ${this.registry.models?.length || 0} models registered`);
      return this;
    },

    // Model Registry API
    getModels() {
      return modelRegistry?.models || [];
    },

    getActiveModels() {
      return (modelRegistry?.models || []).filter(m => m.status === 'active');
    },

    getModel(id) {
      return getModelById(id);
    },

    getDefaultModel() {
      return modelRegistry?.default_model || 'mx2lm';
    },

    query(kqlString) {
      return executeKQL(kqlString);
    },

    async submit({ prompt, model = 'mx2lm', chatId }) {
      return executeKQL({
        op: 'INFER',
        args: { PROMPT: prompt, MODEL: model, CHAT_ID: chatId }
      });
    },

    async search(term, limit = 20) {
      return executeKQL(`⟁SEARCH⟁ ⟁TERM⟁ ${term} ⟁LIMIT⟁ ${limit}`);
    },

    async loadChats(limit = 25) {
      return executeKQL(`⟁LOAD⟁ ⟁CHATS⟁ ⟁LIMIT⟁ ${limit}`);
    },

    async loadMessages(chatId, limit = 50) {
      return executeKQL({
        op: 'LOAD',
        args: { STORE: 'messages', CHAT_ID: chatId, LIMIT: String(limit) }
      });
    },

    async saveMessage(msg) {
      return executeKQL({
        op: 'SAVE',
        args: { STORE: 'messages', DATA: JSON.stringify(msg) }
      });
    },

    createForm(container, options) {
      return createChatForm(container, options);
    },

    // SRP Integration
    async srpSubmit(event) {
      if (event.event_type === 'kql/infer') {
        return this.submit(event.payload);
      }
      return { ok: false, error: 'Unknown event type' };
    }
  };

  // ---- CSS for Chat Form ----
  const style = document.createElement('style');
  style.textContent = `
    .kql-chat-form {
      display: flex;
      flex-direction: column;
      height: 100%;
      font-family: system-ui, sans-serif;
    }

    .kql-chat-messages {
      flex: 1;
      overflow-y: auto;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .kql-msg {
      padding: 8px 12px;
      border-radius: 12px;
      max-width: 85%;
      border: 1px solid rgba(148, 163, 184, 0.3);
    }

    .kql-msg-user {
      align-self: flex-end;
      background: linear-gradient(135deg, rgba(22, 242, 170, 0.2), rgba(34, 211, 238, 0.1));
      border-color: rgba(22, 242, 170, 0.4);
    }

    .kql-msg-assistant {
      align-self: flex-start;
      background: rgba(15, 23, 42, 0.8);
    }

    .kql-msg-header {
      display: flex;
      justify-content: space-between;
      font-size: 10px;
      opacity: 0.7;
      margin-bottom: 4px;
    }

    .kql-msg-content {
      font-size: 13px;
      line-height: 1.5;
      white-space: pre-wrap;
    }

    .kql-chat-input-row {
      display: flex;
      gap: 8px;
      padding: 12px;
      border-top: 1px solid rgba(148, 163, 184, 0.3);
      background: rgba(15, 23, 42, 0.5);
    }

    .kql-chat-input-row input {
      flex: 1;
      background: rgba(15, 23, 42, 0.8);
      border: 1px solid rgba(148, 163, 184, 0.4);
      border-radius: 8px;
      padding: 10px 14px;
      color: #e6fffa;
      font-size: 14px;
      outline: none;
    }

    .kql-chat-input-row input:focus {
      border-color: rgba(22, 242, 170, 0.6);
    }

    .kql-send-btn {
      background: linear-gradient(135deg, rgba(22, 242, 170, 0.3), rgba(16, 185, 129, 0.2));
      border: 1px solid rgba(22, 242, 170, 0.6);
      border-radius: 8px;
      padding: 10px 16px;
      color: #bbf7d0;
      cursor: pointer;
      font-size: 16px;
    }

    .kql-send-btn:hover {
      background: linear-gradient(135deg, rgba(22, 242, 170, 0.4), rgba(16, 185, 129, 0.3));
    }

    .kql-chat-actions {
      display: flex;
      gap: 8px;
      padding: 8px 12px;
      border-top: 1px solid rgba(148, 163, 184, 0.2);
    }

    .kql-action {
      background: transparent;
      border: 1px solid rgba(148, 163, 184, 0.3);
      border-radius: 6px;
      padding: 4px 10px;
      color: rgba(148, 163, 184, 0.9);
      font-size: 11px;
      cursor: pointer;
    }

    .kql-action:hover {
      border-color: rgba(22, 242, 170, 0.5);
      color: #bbf7d0;
    }
  `;
  document.head.appendChild(style);
})();
