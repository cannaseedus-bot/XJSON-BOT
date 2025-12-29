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
