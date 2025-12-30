/**
 * XJSON-BOT Google Apps Script API
 * =================================
 * Free serverless backend using Google Sheets as database.
 *
 * Setup:
 * 1. Create a new Google Sheet
 * 2. Extensions → Apps Script
 * 3. Paste this code
 * 4. Deploy → New Deployment → Web App
 * 5. Copy the URL to your frontend config
 *
 * Endpoints (via doPost/doGet):
 * - action=chat         - Chat completions
 * - action=models       - List models
 * - action=saveChat     - Save chat to Sheets
 * - action=getChats     - Get chat history
 * - action=saveMessage  - Save message
 * - action=remember     - Store in memory
 * - action=recall       - Recall from memory
 */

// ==================== CONFIGURATION ====================

const CONFIG = {
  // API Keys (store in Script Properties for security)
  OPENAI_API_KEY: PropertiesService.getScriptProperties().getProperty('OPENAI_API_KEY') || '',
  ANTHROPIC_API_KEY: PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY') || '',
  DEEPSEEK_API_KEY: PropertiesService.getScriptProperties().getProperty('DEEPSEEK_API_KEY') || '',

  // Default model
  DEFAULT_MODEL: 'gpt-4o-mini',

  // Sheet names
  SHEETS: {
    CHATS: 'Chats',
    MESSAGES: 'Messages',
    MEMORY: 'Memory',
    USAGE: 'Usage'
  }
};

// ==================== MAIN HANDLERS ====================

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;

    switch (action) {
      case 'chat':
        return handleChat(data);
      case 'saveChat':
        return handleSaveChat(data);
      case 'saveMessage':
        return handleSaveMessage(data);
      case 'remember':
        return handleRemember(data);
      case 'recall':
        return handleRecall(data);
      case 'compress':
        return handleCompress(data);
      case 'decompress':
        return handleDecompress(data);
      default:
        return jsonResponse({ error: 'Unknown action: ' + action });
    }
  } catch (error) {
    return jsonResponse({ error: error.message });
  }
}

function doGet(e) {
  try {
    const action = e.parameter.action || 'status';

    switch (action) {
      case 'status':
        return jsonResponse({
          name: 'XJSON-BOT GAS API',
          version: '1.0.0',
          status: 'healthy',
          backend: 'google-apps-script'
        });
      case 'models':
        return handleListModels();
      case 'chats':
        return handleGetChats(e.parameter.userId);
      case 'messages':
        return handleGetMessages(e.parameter.chatId);
      default:
        return jsonResponse({ error: 'Unknown action' });
    }
  } catch (error) {
    return jsonResponse({ error: error.message });
  }
}

// ==================== CHAT HANDLER ====================

function handleChat(data) {
  const model = data.model || CONFIG.DEFAULT_MODEL;
  const messages = data.messages || [];
  const temperature = data.temperature || 0.7;
  const maxTokens = data.max_tokens || 4096;

  const provider = getProviderForModel(model);

  let response;
  switch (provider) {
    case 'openai':
      response = callOpenAI(model, messages, temperature, maxTokens);
      break;
    case 'anthropic':
      response = callAnthropic(model, messages, temperature, maxTokens);
      break;
    case 'deepseek':
      response = callDeepSeek(model, messages, temperature, maxTokens);
      break;
    default:
      return jsonResponse({ error: 'Unknown provider: ' + provider });
  }

  // Log usage
  logUsage(data.userId || 'anonymous', model, response.usage);

  return jsonResponse(response);
}

// ==================== PROVIDER CALLS ====================

function callOpenAI(model, messages, temperature, maxTokens) {
  const apiKey = CONFIG.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key not configured');
  }

  const response = UrlFetchApp.fetch('https://api.openai.com/v1/chat/completions', {
    method: 'post',
    headers: {
      'Authorization': 'Bearer ' + apiKey,
      'Content-Type': 'application/json'
    },
    payload: JSON.stringify({
      model: model,
      messages: messages,
      temperature: temperature,
      max_tokens: maxTokens
    }),
    muteHttpExceptions: true
  });

  return JSON.parse(response.getContentText());
}

function callAnthropic(model, messages, temperature, maxTokens) {
  const apiKey = CONFIG.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('Anthropic API key not configured');
  }

  // Extract system message
  let system = '';
  const chatMessages = [];
  messages.forEach(msg => {
    if (msg.role === 'system') {
      system = msg.content;
    } else {
      chatMessages.push(msg);
    }
  });

  const response = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json'
    },
    payload: JSON.stringify({
      model: model,
      max_tokens: maxTokens,
      system: system,
      messages: chatMessages
    }),
    muteHttpExceptions: true
  });

  const data = JSON.parse(response.getContentText());

  // Convert to OpenAI format
  return {
    id: 'chatcmpl-' + Utilities.getUuid(),
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: model,
    choices: [{
      index: 0,
      message: {
        role: 'assistant',
        content: data.content?.[0]?.text || ''
      },
      finish_reason: data.stop_reason || 'stop'
    }],
    usage: {
      prompt_tokens: data.usage?.input_tokens || 0,
      completion_tokens: data.usage?.output_tokens || 0,
      total_tokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0)
    }
  };
}

function callDeepSeek(model, messages, temperature, maxTokens) {
  const apiKey = CONFIG.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error('DeepSeek API key not configured');
  }

  const response = UrlFetchApp.fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'post',
    headers: {
      'Authorization': 'Bearer ' + apiKey,
      'Content-Type': 'application/json'
    },
    payload: JSON.stringify({
      model: model,
      messages: messages,
      temperature: temperature,
      max_tokens: maxTokens
    }),
    muteHttpExceptions: true
  });

  return JSON.parse(response.getContentText());
}

// ==================== STORAGE (Google Sheets) ====================

function getSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);

  if (!sheet) {
    sheet = ss.insertSheet(name);
    // Add headers based on sheet type
    if (name === CONFIG.SHEETS.CHATS) {
      sheet.appendRow(['id', 'userId', 'title', 'created', 'updated']);
    } else if (name === CONFIG.SHEETS.MESSAGES) {
      sheet.appendRow(['id', 'chatId', 'role', 'content', 'model', 'timestamp']);
    } else if (name === CONFIG.SHEETS.MEMORY) {
      sheet.appendRow(['key', 'value', 'category', 'confidence', 'created', 'accessed']);
    } else if (name === CONFIG.SHEETS.USAGE) {
      sheet.appendRow(['userId', 'model', 'promptTokens', 'completionTokens', 'timestamp']);
    }
  }

  return sheet;
}

function findRow(sheet, column, value) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][column] === value) {
      return i + 1; // 1-indexed
    }
  }
  return null;
}

function handleSaveChat(data) {
  const sheet = getSheet(CONFIG.SHEETS.CHATS);
  const row = [
    data.id || Utilities.getUuid(),
    data.userId || 'anonymous',
    data.title || 'New Chat',
    Date.now(),
    Date.now()
  ];

  const existing = findRow(sheet, 0, data.id);
  if (existing) {
    sheet.getRange(existing, 1, 1, 5).setValues([row]);
  } else {
    sheet.appendRow(row);
  }

  return jsonResponse({ success: true, chatId: row[0] });
}

function handleGetChats(userId) {
  const sheet = getSheet(CONFIG.SHEETS.CHATS);
  const data = sheet.getDataRange().getValues();

  const chats = data.slice(1)
    .filter(row => !userId || row[1] === userId)
    .map(row => ({
      id: row[0],
      userId: row[1],
      title: row[2],
      created: row[3],
      updated: row[4]
    }))
    .sort((a, b) => b.updated - a.updated);

  return jsonResponse({ chats: chats });
}

function handleSaveMessage(data) {
  const sheet = getSheet(CONFIG.SHEETS.MESSAGES);
  const row = [
    data.id || 'msg_' + Date.now(),
    data.chatId,
    data.role,
    data.content,
    data.model || '',
    Date.now()
  ];

  sheet.appendRow(row);
  return jsonResponse({ success: true, messageId: row[0] });
}

function handleGetMessages(chatId) {
  const sheet = getSheet(CONFIG.SHEETS.MESSAGES);
  const data = sheet.getDataRange().getValues();

  const messages = data.slice(1)
    .filter(row => row[1] === chatId)
    .map(row => ({
      id: row[0],
      chatId: row[1],
      role: row[2],
      content: row[3],
      model: row[4],
      timestamp: row[5]
    }))
    .sort((a, b) => a.timestamp - b.timestamp);

  return jsonResponse({ messages: messages });
}

// ==================== MEMORY (K'UHUL) ====================

function handleRemember(data) {
  const sheet = getSheet(CONFIG.SHEETS.MEMORY);
  const row = [
    data.key,
    JSON.stringify(data.value),
    data.category || 'general',
    data.confidence || 1.0,
    Date.now(),
    Date.now()
  ];

  const existing = findRow(sheet, 0, data.key);
  if (existing) {
    sheet.getRange(existing, 1, 1, 6).setValues([row]);
  } else {
    sheet.appendRow(row);
  }

  return jsonResponse({ success: true, key: data.key });
}

function handleRecall(data) {
  const sheet = getSheet(CONFIG.SHEETS.MEMORY);
  const rowNum = findRow(sheet, 0, data.key);

  if (!rowNum) {
    return jsonResponse({ found: false, key: data.key });
  }

  const row = sheet.getRange(rowNum, 1, 1, 6).getValues()[0];

  // Update access time
  sheet.getRange(rowNum, 6).setValue(Date.now());

  return jsonResponse({
    found: true,
    key: row[0],
    value: JSON.parse(row[1]),
    category: row[2],
    confidence: row[3]
  });
}

// ==================== COMPRESSION (SCXQ2) ====================

const SCXQ2 = {
  HAZARD: '☣',

  compress: function(data) {
    const json = JSON.stringify(data);
    const encoded = Utilities.base64Encode(json);
    const checksum = this.checksum(json);
    return this.HAZARD + 'SCXQ2:2.0:base64:' + checksum + ':' + encoded;
  },

  decompress: function(packet) {
    if (!packet.startsWith(this.HAZARD + 'SCXQ2:')) {
      throw new Error('Invalid SCXQ2 packet');
    }
    const parts = packet.substring(1).split(':');
    const encoded = parts[4];
    const json = Utilities.newBlob(Utilities.base64Decode(encoded)).getDataAsString();
    return JSON.parse(json);
  },

  checksum: function(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).substring(0, 8);
  }
};

function handleCompress(data) {
  const compressed = SCXQ2.compress(data.data);
  return jsonResponse({
    compressed: compressed,
    originalSize: JSON.stringify(data.data).length,
    compressedSize: compressed.length
  });
}

function handleDecompress(data) {
  const decompressed = SCXQ2.decompress(data.data);
  return jsonResponse({ decompressed: decompressed });
}

// ==================== UTILITIES ====================

function handleListModels() {
  const models = [
    { id: 'gpt-4o', provider: 'openai', capabilities: ['text', 'code'] },
    { id: 'gpt-4o-mini', provider: 'openai', capabilities: ['text', 'code'] },
    { id: 'claude-3-5-sonnet-20241022', provider: 'anthropic', capabilities: ['text', 'code', 'reasoning'] },
    { id: 'deepseek-r1', provider: 'deepseek', capabilities: ['text', 'code', 'reasoning'] },
    { id: 'deepseek-chat', provider: 'deepseek', capabilities: ['text', 'code'] }
  ];

  return jsonResponse({
    object: 'list',
    data: models.map(m => ({
      id: m.id,
      object: 'model',
      owned_by: m.provider
    }))
  });
}

function getProviderForModel(model) {
  if (model.startsWith('gpt-') || model.startsWith('o1')) return 'openai';
  if (model.startsWith('claude')) return 'anthropic';
  if (model.startsWith('deepseek')) return 'deepseek';
  return 'openai';
}

function logUsage(userId, model, usage) {
  if (!usage) return;

  const sheet = getSheet(CONFIG.SHEETS.USAGE);
  sheet.appendRow([
    userId,
    model,
    usage.prompt_tokens || 0,
    usage.completion_tokens || 0,
    Date.now()
  ]);
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ==================== SETUP FUNCTIONS ====================

/**
 * Run this once to set up API keys
 */
function setupApiKeys() {
  const props = PropertiesService.getScriptProperties();

  // Set your API keys here (or use Script Properties in the UI)
  props.setProperties({
    'OPENAI_API_KEY': 'sk-your-openai-key',
    'ANTHROPIC_API_KEY': 'sk-ant-your-anthropic-key',
    'DEEPSEEK_API_KEY': 'sk-your-deepseek-key'
  });

  Logger.log('API keys configured!');
}

/**
 * Initialize sheets with headers
 */
function initializeSheets() {
  Object.values(CONFIG.SHEETS).forEach(name => getSheet(name));
  Logger.log('Sheets initialized!');
}

/**
 * Test the API
 */
function testApi() {
  const result = handleChat({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'user', content: 'Say hello!' }
    ]
  });

  Logger.log(result.getContent());
}
