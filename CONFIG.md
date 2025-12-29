# XJSON-BOT Configuration Guide

This document explains all configurable options in the XJSON-BOT system.

---

## Configuration Architecture

```
XJSON-BOT/
├── config/
│   ├── .htaccess             # Blocks sensitive files from web access
│   ├── config.json           # Frontend configuration (public)
│   ├── config.example.json   # Template for config.json
│   ├── .config.json          # Hidden local config (blocked by .htaccess)
│   └── kql-api-config.php.template  # PHP config template
│
├── SECURE_FOLDER/            # OUTSIDE public_html (server-side only)
│   └── kql-api-config.php    # MySQL credentials (NEVER in public_html)
│
└── public_html/              # Web-accessible files
    └── api/
        └── kql/
            └── index.php     # API endpoint (reads from SECURE_FOLDER)
```

### Hidden Config Files

You can use dot-prefix to hide files from `ls`:
- `.config.json` - Hidden but still web-accessible without protection!
- `.htaccess` protects dot-files from web access on Apache/LiteSpeed

**Security Layers:**
1. `.htaccess` blocks access to `.config.json` and `config.local.json`
2. `.gitignore` prevents committing sensitive files
3. `SECURE_FOLDER` outside public_html is the most secure option

**Security Rule:** API keys and database credentials NEVER go in frontend config. They stay in `SECURE_FOLDER` which is outside the web root.

---

## Frontend Configuration (config/config.json)

This file is loaded by the browser and should ONLY contain non-sensitive settings.

```json
{
  "app": {
    "name": "XJSON-BOT",
    "version": "2.0.0",
    "debug": false
  },

  "kql": {
    "backend": "idb",
    "syncInterval": 30000,
    "compression": true
  },

  "llm": {
    "defaultProvider": "ollama",
    "streamingEnabled": true,
    "maxTokens": 4096,
    "temperature": 0.7
  },

  "ui": {
    "theme": "dark",
    "language": "en",
    "voiceEnabled": true,
    "agentTeamEnabled": false
  }
}
```

### Configuration Options

#### `app` - Application Settings

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `name` | string | "XJSON-BOT" | Application display name |
| `version` | string | "2.0.0" | Current version |
| `debug` | boolean | false | Enable debug logging |

#### `kql` - Backend Settings

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `backend` | string | "idb" | Backend mode: `idb`, `mysql`, or `hybrid` |
| `mysqlEndpoint` | string | null | MySQL API endpoint URL (if using mysql/hybrid) |
| `syncInterval` | number | 30000 | Hybrid sync interval in ms |
| `compression` | boolean | true | Enable SCXQ2 compression |
| `dbName` | string | "kuhul_db" | IndexedDB database name |

#### `llm` - AI Provider Settings

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `defaultProvider` | string | "ollama" | Default LLM: `ollama`, `openai`, `anthropic` |
| `streamingEnabled` | boolean | true | Enable streaming responses |
| `maxTokens` | number | 4096 | Maximum response tokens |
| `temperature` | number | 0.7 | Response creativity (0.0-1.0) |
| `ollamaUrl` | string | "http://localhost:11434" | Ollama API URL |

#### `ui` - Interface Settings

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `theme` | string | "dark" | UI theme: `dark`, `light` |
| `language` | string | "en" | Interface language |
| `voiceEnabled` | boolean | true | Enable voice input/output |
| `agentTeamEnabled` | boolean | false | Multi-agent mode by default |

---

## Server-Side Configuration (PHP)

**Location:** `SECURE_FOLDER/kql-api-config.php` (OUTSIDE public_html!)

```php
<?php
// SECURE_FOLDER/kql-api-config.php
// This file is OUTSIDE the web root - never accessible via URL

return [
    // MySQL Database
    'mysql' => [
        'host' => 'localhost',
        'port' => 3306,
        'database' => 'kuhul_db',
        'username' => 'your_db_user',
        'password' => 'your_secure_password',
        'charset' => 'utf8mb4'
    ],

    // API Security
    'api' => [
        'key' => 'your-api-key-here',  // For authenticated requests
        'rateLimit' => 100,             // Requests per minute
        'allowedOrigins' => [
            'https://yourdomain.com',
            'http://localhost:8000'
        ]
    ],

    // LLM API Keys (for server-side proxy)
    'llm' => [
        'openai' => 'sk-...',
        'anthropic' => 'sk-ant-...'
    ]
];
```

### Using the Config in PHP

```php
<?php
// public_html/api/kql/index.php

// Load config from SECURE_FOLDER (outside web root)
$config = require __DIR__ . '/../../../SECURE_FOLDER/kql-api-config.php';

// Connect to MySQL
$pdo = new PDO(
    "mysql:host={$config['mysql']['host']};dbname={$config['mysql']['database']};charset={$config['mysql']['charset']}",
    $config['mysql']['username'],
    $config['mysql']['password'],
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
);

// Validate API key
$apiKey = $_SERVER['HTTP_X_API_KEY'] ?? '';
if ($config['api']['key'] && $apiKey !== $config['api']['key']) {
    http_response_code(401);
    die(json_encode(['error' => 'Unauthorized']));
}

// Handle KQL requests...
```

---

## Environment-Based Configuration

For different environments (dev, staging, production):

### Option 1: Multiple Config Files

```
config/
├── config.json           # Production (default)
├── config.dev.json       # Development
├── config.staging.json   # Staging
└── config.local.json     # Local (gitignored)
```

### Option 2: Environment Detection in JavaScript

```javascript
const Config = {
  async load() {
    const env = window.location.hostname === 'localhost' ? 'dev' : 'prod';
    const response = await fetch(`/config/config.${env}.json`);
    return response.json();
  }
};
```

---

## KQL Backend Modes

### Mode 1: IndexedDB Only (Default)

```json
{
  "kql": {
    "backend": "idb"
  }
}
```

- All data stored locally in browser
- No server required
- Data persists per-browser/device
- No sync between devices

### Mode 2: MySQL Only

```json
{
  "kql": {
    "backend": "mysql",
    "mysqlEndpoint": "https://yourdomain.com/api/kql"
  }
}
```

- All data stored on MySQL server
- Requires PHP API endpoint
- Syncs across all devices
- Requires internet connection

### Mode 3: Hybrid (Recommended for Production)

```json
{
  "kql": {
    "backend": "hybrid",
    "mysqlEndpoint": "https://yourdomain.com/api/kql",
    "syncInterval": 30000
  }
}
```

- IndexedDB for fast local access
- MySQL for persistence and sync
- Works offline, syncs when online
- Best of both worlds

---

## LLM Provider Configuration

### Ollama (Local)

No API key required. Just run `ollama serve` locally.

```json
{
  "llm": {
    "defaultProvider": "ollama",
    "ollamaUrl": "http://localhost:11434"
  }
}
```

### OpenAI

API key stored in browser (Settings page) or server-side proxy.

**Browser Storage (less secure, simpler):**
```javascript
Settings.set('openaiApiKey', 'sk-...');
```

**Server-Side Proxy (recommended for production):**
```json
{
  "llm": {
    "defaultProvider": "openai",
    "proxyEndpoint": "https://yourdomain.com/api/llm"
  }
}
```

### Anthropic

Same as OpenAI - use browser storage for dev, server proxy for production.

---

## SCXQ2 Compression Settings

```json
{
  "kql": {
    "compression": true,
    "compressionThreshold": 1024
  }
}
```

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `compression` | boolean | true | Enable SCXQ2 compression |
| `compressionThreshold` | number | 1024 | Min bytes before compressing |

---

## Database Schema (MySQL)

If using MySQL backend, create these tables:

```sql
-- KQL Database Schema
CREATE DATABASE IF NOT EXISTS kuhul_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE kuhul_db;

-- Chats
CREATE TABLE kql_chats (
    id VARCHAR(64) PRIMARY KEY,
    userId VARCHAR(64),
    title VARCHAR(255),
    created BIGINT,
    updated BIGINT,
    INDEX idx_userId (userId),
    INDEX idx_updated (updated)
);

-- Messages
CREATE TABLE kql_messages (
    id VARCHAR(64) PRIMARY KEY,
    chatId VARCHAR(64),
    role VARCHAR(16),
    content LONGTEXT,
    model VARCHAR(64),
    timestamp BIGINT,
    INDEX idx_chatId (chatId),
    INDEX idx_timestamp (timestamp),
    FOREIGN KEY (chatId) REFERENCES kql_chats(id) ON DELETE CASCADE
);

-- Models
CREATE TABLE kql_models (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255),
    provider VARCHAR(32),
    llmModel VARCHAR(64),
    url VARCHAR(512),
    added BIGINT,
    INDEX idx_provider (provider)
);

-- Settings
CREATE TABLE kql_settings (
    `key` VARCHAR(128) PRIMARY KEY,
    value JSON,
    updated BIGINT
);

-- Memory (Agent Learning)
CREATE TABLE kql_memory (
    `key` VARCHAR(128) PRIMARY KEY,
    value JSON,
    category VARCHAR(64),
    confidence FLOAT,
    accessed BIGINT,
    created BIGINT,
    INDEX idx_category (category),
    INDEX idx_confidence (confidence)
);

-- Events (Analytics)
CREATE TABLE kql_events (
    id VARCHAR(64) PRIMARY KEY,
    type VARCHAR(64),
    data JSON,
    source VARCHAR(32),
    timestamp BIGINT,
    INDEX idx_type (type),
    INDEX idx_timestamp (timestamp)
);

-- RLHF Data
CREATE TABLE kql_rlhf (
    id VARCHAR(64) PRIMARY KEY,
    type VARCHAR(32),
    data JSON,
    rating INT,
    timestamp BIGINT,
    INDEX idx_type (type),
    INDEX idx_rating (rating)
);

-- Weights (Optional - for model storage)
CREATE TABLE kql_weights (
    modelId VARCHAR(64) PRIMARY KEY,
    format VARCHAR(16),
    compressed TINYINT(1),
    data LONGBLOB,
    created BIGINT
);

-- Agents
CREATE TABLE kql_agents (
    id VARCHAR(64) PRIMARY KEY,
    type VARCHAR(32),
    status VARCHAR(16),
    config JSON,
    created BIGINT,
    INDEX idx_type (type),
    INDEX idx_status (status)
);
```

---

## Security Checklist

- [ ] API keys NEVER in frontend config.json
- [ ] MySQL credentials in SECURE_FOLDER outside public_html
- [ ] CORS configured for allowed origins only
- [ ] Rate limiting enabled on API endpoints
- [ ] HTTPS enabled in production
- [ ] API key validation on server endpoints
- [ ] Input sanitization on all database queries
- [ ] config.local.json in .gitignore

---

## Loading Configuration

The app loads configuration at startup:

```javascript
// In mx2lm-chat-app.js initialization
const AppConfig = {
  data: null,

  async load() {
    try {
      const response = await fetch('/config/config.json');
      this.data = await response.json();
      console.log('Config loaded:', this.data);
    } catch (error) {
      console.warn('Using default config');
      this.data = this.getDefaults();
    }
    return this.data;
  },

  get(key) {
    return key.split('.').reduce((o, k) => o?.[k], this.data);
  },

  getDefaults() {
    return {
      app: { name: 'XJSON-BOT', version: '2.0.0', debug: false },
      kql: { backend: 'idb', compression: true },
      llm: { defaultProvider: 'ollama', streamingEnabled: true },
      ui: { theme: 'dark', voiceEnabled: true }
    };
  }
};
```

---

## Quick Start

1. Copy `config/config.example.json` to `config/config.json`
2. Edit settings as needed
3. For MySQL: Set up database with schema above
4. For MySQL: Create `SECURE_FOLDER/kql-api-config.php` outside public_html
5. Deploy PHP API endpoint
6. Update `kql.mysqlEndpoint` in config.json

---

## Contact

For configuration help, see the main README.md or open an issue.

---

## PHP API Endpoints

XJSON-BOT includes PHP API endpoints for server-side AI processing and KQL persistence.

### Endpoint Structure

```
public_html/
├── api/
│   ├── chat.php      # REST API for chat (non-streaming)
│   ├── stream.php    # SSE streaming endpoint
│   └── kql/
│       └── index.php # KQL database operations
│
└── cline-jars/       # Java gRPC streaming backend (optional)
    ├── Main.java
    ├── stream.php
    └── *.jar
```

### stream.php - Server-Sent Events

Streaming endpoint for real-time AI responses.

**Request:**
```javascript
const eventSource = new EventSource('/api/stream.php?' + new URLSearchParams({
  message: 'Hello AI',
  model: 'llama3',
  provider: 'ollama',
  chatId: 'chat_123',
  userId: 'user_456'
}));

eventSource.addEventListener('connect', (e) => {
  console.log('Connected:', JSON.parse(e.data));
});

eventSource.addEventListener('message', (e) => {
  const chunk = JSON.parse(e.data);
  if (chunk.type === 'chunk') {
    appendToChat(chunk.content);
  }
});

eventSource.addEventListener('complete', (e) => {
  console.log('Done:', JSON.parse(e.data));
  eventSource.close();
});
```

**Events:**
| Event | Data | Description |
|-------|------|-------------|
| `connect` | `{status, model, timestamp}` | Connection established |
| `message` | `{type: 'thinking', content, progress}` | Processing status |
| `message` | `{type: 'chunk', content, chunk_index}` | Response chunk |
| `complete` | `{tokens_estimated, processing_time}` | Generation complete |
| `end` | `{status: 'stream_complete'}` | Stream closed |

### chat.php - REST API

Non-streaming chat endpoint with full KQL integration.

**Send Message:**
```bash
POST /api/chat.php
Content-Type: application/json

{
  "message": "Hello AI",
  "model": "llama3",
  "provider": "ollama",
  "chatId": "chat_123",
  "userId": "user_456"
}

# Response:
{
  "response": "Hello! How can I help you?",
  "model": "llama3",
  "provider": "ollama",
  "tokens_estimated": 42,
  "processing_time": 1234
}
```

**Get Chat History:**
```bash
GET /api/chat.php?action=history&chatId=chat_123

# Response:
{
  "messages": [
    {"id": "msg_1", "role": "user", "content": "Hello", "timestamp": 1234567890},
    {"id": "msg_2", "role": "assistant", "content": "Hi!", "timestamp": 1234567891}
  ]
}
```

**Get User Chats:**
```bash
GET /api/chat.php?action=chats&userId=user_456

# Response:
{
  "chats": [
    {"id": "chat_123", "title": "New Chat", "updated": 1234567890}
  ]
}
```

**Check Status:**
```bash
GET /api/chat.php?action=status

# Response:
{
  "status": "ok",
  "version": "2.0.0",
  "kql": "connected",
  "providers": ["openai", "anthropic", "ollama", "local"],
  "ollama": "running"
}
```

---

## MX2LM PHP Library (mx2lm.app)

> **Shared Server:** These PHP library files are hosted on mx2lm.app (shared server) and **available for community use** until further notice. The stack may evolve, so consider adding **GAS for a bigger personal mesh** with guaranteed personal control.

### Access Policy

The mx2lm.app PHP endpoints are **shared for now** - you can use them directly:
- `https://mx2lm.app/api/stream.php` - SSE streaming
- `https://mx2lm.app/api/chat.php` - REST chat API
- `https://mx2lm.app/lib/*` - Library files

**But for long-term stability:** Set up your own GAS backend as a personal fallback.

### Recommendation: Hybrid Approach

For maximum flexibility, combine shared PHP with personal GAS:
- **PHP** (mx2lm.app shared) - High-performance, MySQL-backed, community access
- **GAS** (your own) - Personal mesh node, guaranteed control, CDN-like backup

This gives users **cPanel-like control with FTP access equivalent** through Google Drive.

### Library Location
```
https://mx2lm.app/lib/
├── asx_execute.php   # ASX code execution engine
├── asx_ram.php       # ASX memory/RAM management
├── asx_verify.php    # ASX verification layer
├── mx2db.php         # MX2 database abstraction
├── mx2lm.php         # MX2LM core runtime
└── util.php          # Utilities and helpers
```

### Using the Library

```php
<?php
// api/chat.php or api/stream.php
require_once __DIR__ . '/../lib/mx2db.php';
require_once __DIR__ . '/../lib/mx2lm.php';
require_once __DIR__ . '/../lib/util.php';

// Initialize MX2 database layer
$db = new MX2DB($config);

// Use existing methods instead of raw PDO
$messages = $db->getMessages($chatId);
$db->saveMessage($chatId, $role, $content, $model);

// ASX execution
require_once __DIR__ . '/../lib/asx_execute.php';
$result = ASX::execute($code, $context);
```

### Stack Integration

```
Browser (XJSON-BOT)
    │
    ├─ KQL (IndexedDB) ──── Local persistence
    │
    └─ PHP API ─────────── Server persistence
         │
         ├─ mx2lm.php      Core runtime
         ├─ mx2db.php      Database layer
         ├─ asx_*.php      ASX execution
         └─ MySQL          Data storage
```

---

## Google Apps Script Alternative (No Server Required)

> **For users without PHP/cPanel:** Google Apps Script (GAS) provides free serverless backend functionality with Google Sheets as database.

### Why GAS? - Personal Mesh Control

GAS gives you **personal control** over your data backend - like having your own CDN for non-production sites:

- **Free** - No hosting costs, unlimited potential
- **No server needed** - Runs on Google's infrastructure
- **Google Sheets as DB** - Easy to view/edit data directly
- **HTTPS built-in** - Secure by default
- **Easy deployment** - Deploy as web app in clicks
- **Personal Mesh** - Each user controls their own backend node
- **cPanel-like Access** - Full control without FTP/SSH complexity

### Mesh Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    XJSON-BOT MESH                       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│   User A (GAS)        User B (GAS)        User C (GAS) │
│   ┌──────────┐        ┌──────────┐        ┌──────────┐ │
│   │ Sheet DB │        │ Sheet DB │        │ Sheet DB │ │
│   │ Personal │        │ Personal │        │ Personal │ │
│   └────┬─────┘        └────┬─────┘        └────┬─────┘ │
│        │                   │                   │        │
│        └───────────────────┼───────────────────┘        │
│                            │                            │
│                    ┌───────┴───────┐                   │
│                    │  MX2LM.APP    │                   │
│                    │  (Production) │                   │
│                    │  PHP + MySQL  │                   │
│                    └───────────────┘                   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Upcoming: Metering API

> **Coming Soon:** API-based metering system for usage tracking and resource allocation.

```javascript
// Future metering integration
const meter = {
  endpoint: 'https://mx2lm.app/api/meter',
  track: async (userId, usage) => {
    // Track GAS backend usage
    // Enables: quotas, analytics, mesh coordination
  }
};
```

This will provide:
- **Usage tracking** across your personal GAS backend
- **Mesh coordination** between personal and production backends
- **cPanel-like dashboard** for resource monitoring
- **FTP-equivalent access** through Google Drive integration

### Setting Up GAS Backend

1. **Create a new Google Sheet** for your data
2. **Open Extensions > Apps Script**
3. **Paste the KQL-GAS code** (below)
4. **Deploy as Web App**
5. **Copy the URL** to your config.json

### KQL-GAS Implementation

```javascript
// Google Apps Script - KQL Backend Alternative
// Deploy as: Web App (Anyone can access)

const SHEET_ID = 'YOUR_GOOGLE_SHEET_ID';

function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  const action = data.action;

  switch (action) {
    case 'saveChat':
      return saveChat(data);
    case 'getChats':
      return getChats(data.userId);
    case 'saveMessage':
      return saveMessage(data);
    case 'getMessages':
      return getMessages(data.chatId);
    case 'saveSetting':
      return saveSetting(data.key, data.value);
    case 'getSetting':
      return getSetting(data.key);
    default:
      return jsonResponse({ error: 'Unknown action' });
  }
}

function doGet(e) {
  const action = e.parameter.action;

  switch (action) {
    case 'status':
      return jsonResponse({ status: 'ok', backend: 'gas' });
    case 'chats':
      return getChats(e.parameter.userId);
    case 'messages':
      return getMessages(e.parameter.chatId);
    default:
      return jsonResponse({ error: 'Use POST for mutations' });
  }
}

// ============ CHAT OPERATIONS ============

function saveChat(data) {
  const sheet = getSheet('chats');
  const row = [
    data.id,
    data.userId || 'anonymous',
    data.title || 'New Chat',
    new Date().getTime(),
    new Date().getTime()
  ];

  // Check if exists (update) or new (append)
  const existing = findRow(sheet, 0, data.id);
  if (existing) {
    sheet.getRange(existing, 1, 1, 5).setValues([row]);
  } else {
    sheet.appendRow(row);
  }

  return jsonResponse({ success: true, chatId: data.id });
}

function getChats(userId) {
  const sheet = getSheet('chats');
  const data = sheet.getDataRange().getValues();

  const chats = data.slice(1) // Skip header
    .filter(row => !userId || row[1] === userId)
    .map(row => ({
      id: row[0],
      userId: row[1],
      title: row[2],
      created: row[3],
      updated: row[4]
    }))
    .sort((a, b) => b.updated - a.updated);

  return jsonResponse({ chats });
}

// ============ MESSAGE OPERATIONS ============

function saveMessage(data) {
  const sheet = getSheet('messages');
  const row = [
    data.id || 'msg_' + new Date().getTime(),
    data.chatId,
    data.role,
    data.content,
    data.model || '',
    new Date().getTime()
  ];

  sheet.appendRow(row);
  return jsonResponse({ success: true, messageId: row[0] });
}

function getMessages(chatId) {
  const sheet = getSheet('messages');
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

  return jsonResponse({ messages });
}

// ============ SETTINGS ============

function saveSetting(key, value) {
  const sheet = getSheet('settings');
  const existing = findRow(sheet, 0, key);

  if (existing) {
    sheet.getRange(existing, 2).setValue(JSON.stringify(value));
    sheet.getRange(existing, 3).setValue(new Date().getTime());
  } else {
    sheet.appendRow([key, JSON.stringify(value), new Date().getTime()]);
  }

  return jsonResponse({ success: true });
}

function getSetting(key) {
  const sheet = getSheet('settings');
  const rowNum = findRow(sheet, 0, key);

  if (rowNum) {
    const value = sheet.getRange(rowNum, 2).getValue();
    return jsonResponse({ key, value: JSON.parse(value) });
  }

  return jsonResponse({ key, value: null });
}

// ============ HELPERS ============

function getSheet(name) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName(name);

  if (!sheet) {
    sheet = ss.insertSheet(name);
    // Add headers
    const headers = {
      chats: ['id', 'userId', 'title', 'created', 'updated'],
      messages: ['id', 'chatId', 'role', 'content', 'model', 'timestamp'],
      settings: ['key', 'value', 'updated'],
      events: ['id', 'type', 'data', 'source', 'timestamp']
    };
    if (headers[name]) {
      sheet.appendRow(headers[name]);
    }
  }

  return sheet;
}

function findRow(sheet, col, value) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][col] === value) return i + 1;
  }
  return null;
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
```

### Frontend Config for GAS

```json
{
  "kql": {
    "backend": "gas",
    "gasEndpoint": "https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec"
  }
}
```

### KQL-GAS Adapter (JavaScript)

Add this to use GAS as your KQL backend:

```javascript
// core/kql-gas.js - Google Apps Script Backend Adapter

const KQL_GAS = {
  endpoint: null,

  init(endpoint) {
    this.endpoint = endpoint;
    console.log('KQL-GAS: Initialized with', endpoint);
  },

  async request(action, data = {}) {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...data })
    });
    return response.json();
  },

  // Mirror KQL interface
  async saveChat(chat) {
    return this.request('saveChat', chat);
  },

  async getChats(userId) {
    const result = await this.request('getChats', { userId });
    return result.chats || [];
  },

  async saveMessage(message) {
    return this.request('saveMessage', message);
  },

  async getMessages(chatId) {
    const result = await this.request('getMessages', { chatId });
    return result.messages || [];
  },

  async setSetting(key, value) {
    return this.request('saveSetting', { key, value });
  },

  async getSetting(key) {
    const result = await this.request('getSetting', { key });
    return result.value;
  }
};

// Extend KQL to support GAS backend
if (typeof KQL !== 'undefined') {
  KQL.setBackend = async function(mode, config = {}) {
    if (mode === 'gas' && config.gasEndpoint) {
      KQL_GAS.init(config.gasEndpoint);
      this.backendMode = 'gas';
      this.gas = KQL_GAS;
      console.log('KQL: Using Google Apps Script backend');
    }
    // ... existing backend modes
  };
}
```

### Backend Comparison

| Feature | PHP/cPanel | Google Apps Script |
|---------|------------|-------------------|
| Cost | Hosting fees | Free |
| Setup | Server config | Deploy as web app |
| Database | MySQL | Google Sheets |
| Streaming | SSE support | No native SSE |
| Speed | Fast | ~1-2s latency |
| Limits | Server limits | 6min/execution |
| Best for | Production | Prototyping, small apps |

---

## Java gRPC Backend (cline-jars)

For high-performance streaming, XJSON-BOT can connect to a Java gRPC backend.

### Location
```
https://mx2lm.app/cline-jars/
```

### Architecture
```
Browser ──SSE──> stream.php ──gRPC──> Java/Netty
                     │
                     └──> KQL/MySQL (persistence)
```

### Configuration

Add Java backend to server config:

```php
// SECURE_FOLDER/kql-api-config.php
return [
    // ... other config ...

    'java' => [
        'enabled' => true,
        'endpoint' => 'http://localhost:8080',
        'grpc_port' => 9090
    ]
];
```

### Frontend Config

```json
{
  "streaming": {
    "backend": "java-grpc",
    "endpoint": "https://mx2lm.app/cline-jars/stream.php",
    "protocol": "sse",
    "fallback": "php"
  }
}
```

### Java Dependencies (cline-jars)

| Library | Version | Purpose |
|---------|---------|---------|
| grpc-netty | 1.64.0 | gRPC transport |
| netty-* | 4.1.108 | Async I/O |
| protobuf-java | 3.25.1 | Message serialization |
| gson | 2.10.1 | JSON handling |
| guava | 32.1.3 | Utilities |

### Starting Java Backend

```bash
cd cline-jars
java -cp ".:lib/*" Main
```

Or use the start script:
```bash
cat start-chat-api.txt
# java -cp ".:lib/*" Main --port 8080 --grpc 9090
```

