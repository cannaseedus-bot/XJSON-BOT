<?php
/**
 * XJSON-BOT PHP API Configuration
 * ================================
 * Copy this file to your SECURE_FOLDER (outside public_html)
 * and rename to api-config.php
 *
 * Example structure:
 *   /home/user/
 *   ├── config/              ← SECURE_FOLDER (not web accessible)
 *   │   └── api-config.php   ← This file
 *   └── public_html/
 *       └── api/
 *           └── index.php    ← API entry point
 */

// ==================== MODEL PROVIDERS ====================

// OpenAI
define('OPENAI_API_KEY', 'sk-your-openai-key');

// Anthropic
define('ANTHROPIC_API_KEY', 'sk-ant-your-anthropic-key');

// DeepSeek
define('DEEPSEEK_API_KEY', 'sk-your-deepseek-key');

// Ollama (local)
define('OLLAMA_BASE_URL', 'http://localhost:11434');

// ==================== SECURITY ====================

// Require API key for requests
define('API_KEY_REQUIRED', false);

// Allowed API keys (generate your own)
define('ALLOWED_API_KEYS', [
    'xjson-sk-your-key-1',
    'xjson-sk-your-key-2'
]);

// ==================== RATE LIMITING ====================

define('RATE_LIMIT_ENABLED', true);
define('RATE_LIMIT_REQUESTS', 100);  // Requests per window
define('RATE_LIMIT_WINDOW', 60);      // Window in seconds

// ==================== DATABASE (Optional) ====================

// MySQL for persistent storage
define('DB_HOST', 'localhost');
define('DB_NAME', 'xjson_bot');
define('DB_USER', 'your_db_user');
define('DB_PASS', 'your_db_password');

// ==================== DEFAULTS ====================

define('DEFAULT_CHAT_MODEL', 'gpt-4o-mini');
define('DEFAULT_MAX_TOKENS', 4096);
define('DEFAULT_TEMPERATURE', 0.7);
