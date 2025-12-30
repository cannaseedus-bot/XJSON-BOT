<?php
/**
 * XJSON-BOT PHP API Server
 * ========================
 * OpenAI-compatible REST API with K'UHUL engine support.
 *
 * Endpoints:
 * - POST /v1/chat/completions - Chat with streaming
 * - POST /v1/images/generations - Image generation
 * - GET /v1/models - List models
 * - POST /v1/kuhul/* - K'UHUL operations
 *
 * Requirements:
 * - PHP 8.0+
 * - cURL extension
 * - JSON extension
 *
 * Usage:
 * 1. Copy to your web server
 * 2. Configure config.php
 * 3. Access via https://your-domain.com/api/v1/
 */

// ==================== CONFIGURATION ====================

// Load config from parent directory (outside public_html for security)
$configPath = __DIR__ . '/../../config/api-config.php';
if (file_exists($configPath)) {
    require_once $configPath;
} else {
    // Default config
    define('OPENAI_API_KEY', getenv('OPENAI_API_KEY') ?: '');
    define('ANTHROPIC_API_KEY', getenv('ANTHROPIC_API_KEY') ?: '');
    define('DEEPSEEK_API_KEY', getenv('DEEPSEEK_API_KEY') ?: '');
    define('OLLAMA_BASE_URL', getenv('OLLAMA_BASE_URL') ?: 'http://localhost:11434');
    define('API_KEY_REQUIRED', false);
    define('ALLOWED_API_KEYS', []);
    define('RATE_LIMIT_ENABLED', true);
    define('RATE_LIMIT_REQUESTS', 100);
    define('RATE_LIMIT_WINDOW', 60);
}

// ==================== CORS & HEADERS ====================

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-API-Key');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// ==================== ROUTING ====================

$requestUri = $_SERVER['REQUEST_URI'];
$method = $_SERVER['REQUEST_METHOD'];

// Parse path
$path = parse_url($requestUri, PHP_URL_PATH);
$path = preg_replace('#^/api/php#', '', $path); // Remove base path

// Route request
try {
    // Auth check
    if (API_KEY_REQUIRED && !checkApiKey()) {
        jsonError('Invalid or missing API key', 401, 'authentication_error');
    }

    // Rate limiting
    if (RATE_LIMIT_ENABLED && !checkRateLimit()) {
        jsonError('Rate limit exceeded', 429, 'rate_limit_error');
    }

    // Routes
    switch (true) {
        // Health check
        case $path === '/' || $path === '':
            jsonResponse([
                'name' => 'XJSON-BOT PHP API',
                'version' => '1.0.0',
                'status' => 'healthy',
                'endpoints' => [
                    'chat' => '/v1/chat/completions',
                    'images' => '/v1/images/generations',
                    'models' => '/v1/models',
                    'kuhul' => '/v1/kuhul/*'
                ]
            ]);
            break;

        // Chat completions
        case preg_match('#^/v1/chat/completions$#', $path) && $method === 'POST':
            handleChatCompletions();
            break;

        // Image generations
        case preg_match('#^/v1/images/generations$#', $path) && $method === 'POST':
            handleImageGenerations();
            break;

        // Models list
        case preg_match('#^/v1/models$#', $path) && $method === 'GET':
            handleListModels();
            break;

        // Model details
        case preg_match('#^/v1/models/(.+)$#', $path, $matches) && $method === 'GET':
            handleGetModel($matches[1]);
            break;

        // K'UHUL operations
        case preg_match('#^/v1/kuhul/(.+)$#', $path, $matches):
            handleKuhul($matches[1]);
            break;

        default:
            jsonError('Not found', 404, 'not_found');
    }
} catch (Exception $e) {
    jsonError($e->getMessage(), 500, 'internal_error');
}

// ==================== HANDLERS ====================

function handleChatCompletions() {
    $input = getJsonInput();

    $model = $input['model'] ?? 'gpt-4o-mini';
    $messages = $input['messages'] ?? [];
    $stream = $input['stream'] ?? false;
    $temperature = $input['temperature'] ?? 0.7;
    $maxTokens = $input['max_tokens'] ?? 4096;

    // Determine provider
    $provider = getProviderForModel($model);

    if ($stream) {
        streamChatResponse($provider, $model, $messages, $temperature, $maxTokens);
    } else {
        $response = callProvider($provider, $model, $messages, $temperature, $maxTokens);
        jsonResponse($response);
    }
}

function handleImageGenerations() {
    $input = getJsonInput();

    $model = $input['model'] ?? 'dall-e-3';
    $prompt = $input['prompt'] ?? '';
    $n = $input['n'] ?? 1;
    $size = $input['size'] ?? '1024x1024';

    // For image generation, use OpenAI or local Janus
    if (strpos($model, 'janus') !== false) {
        // Janus requires Python backend
        jsonError('Janus image generation requires Python backend', 400, 'unsupported');
    }

    // OpenAI DALL-E
    $response = callOpenAI('/v1/images/generations', [
        'model' => $model,
        'prompt' => $prompt,
        'n' => $n,
        'size' => $size,
        'response_format' => 'b64_json'
    ]);

    jsonResponse($response);
}

function handleListModels() {
    $models = getModelRegistry();

    $data = [];
    foreach ($models as $id => $info) {
        $data[] = [
            'id' => $id,
            'object' => 'model',
            'created' => 1700000000,
            'owned_by' => $info['provider']
        ];
    }

    jsonResponse([
        'object' => 'list',
        'data' => $data
    ]);
}

function handleGetModel($modelId) {
    $models = getModelRegistry();

    if (!isset($models[$modelId])) {
        jsonError("Model not found: $modelId", 404, 'not_found');
    }

    $info = $models[$modelId];
    jsonResponse([
        'id' => $modelId,
        'object' => 'model',
        'created' => 1700000000,
        'owned_by' => $info['provider'],
        'capabilities' => $info['capabilities'] ?? [],
        'context_length' => $info['context_length'] ?? 4096
    ]);
}

function handleKuhul($operation) {
    $input = getJsonInput();

    // K'UHUL operations (simplified PHP implementation)
    $kuhul = new KuhulEngine();

    switch ($operation) {
        case 'run':
            $result = $kuhul->run($input['op_id'], $input['code'], $input['context'] ?? []);
            jsonResponse($result);
            break;

        case 'status':
            jsonResponse($kuhul->getStatus());
            break;

        case 'compress':
            $compressed = $kuhul->compress($input['data']);
            jsonResponse(['compressed' => $compressed]);
            break;

        case 'decompress':
            $decompressed = $kuhul->decompress($input['data']);
            jsonResponse(['decompressed' => $decompressed]);
            break;

        default:
            jsonError("Unknown K'UHUL operation: $operation", 400, 'invalid_operation');
    }
}

// ==================== PROVIDER CALLS ====================

function callProvider($provider, $model, $messages, $temperature, $maxTokens) {
    switch ($provider) {
        case 'openai':
            return callOpenAI('/v1/chat/completions', [
                'model' => $model,
                'messages' => $messages,
                'temperature' => $temperature,
                'max_tokens' => $maxTokens
            ]);

        case 'anthropic':
            return callAnthropic($model, $messages, $temperature, $maxTokens);

        case 'deepseek':
            return callDeepSeek($model, $messages, $temperature, $maxTokens);

        case 'ollama':
            return callOllama($model, $messages, $temperature, $maxTokens);

        default:
            throw new Exception("Unknown provider: $provider");
    }
}

function callOpenAI($endpoint, $data) {
    $apiKey = OPENAI_API_KEY;
    if (!$apiKey) {
        throw new Exception('OpenAI API key not configured');
    }

    return curlRequest("https://api.openai.com$endpoint", $data, [
        "Authorization: Bearer $apiKey"
    ]);
}

function callAnthropic($model, $messages, $temperature, $maxTokens) {
    $apiKey = ANTHROPIC_API_KEY;
    if (!$apiKey) {
        throw new Exception('Anthropic API key not configured');
    }

    // Extract system message
    $system = '';
    $chatMessages = [];
    foreach ($messages as $msg) {
        if ($msg['role'] === 'system') {
            $system = $msg['content'];
        } else {
            $chatMessages[] = $msg;
        }
    }

    $response = curlRequest('https://api.anthropic.com/v1/messages', [
        'model' => $model,
        'max_tokens' => $maxTokens,
        'system' => $system,
        'messages' => $chatMessages
    ], [
        "x-api-key: $apiKey",
        "anthropic-version: 2023-06-01"
    ]);

    // Convert to OpenAI format
    return [
        'id' => 'chatcmpl-' . uniqid(),
        'object' => 'chat.completion',
        'created' => time(),
        'model' => $model,
        'choices' => [[
            'index' => 0,
            'message' => [
                'role' => 'assistant',
                'content' => $response['content'][0]['text'] ?? ''
            ],
            'finish_reason' => $response['stop_reason'] ?? 'stop'
        ]],
        'usage' => [
            'prompt_tokens' => $response['usage']['input_tokens'] ?? 0,
            'completion_tokens' => $response['usage']['output_tokens'] ?? 0,
            'total_tokens' => ($response['usage']['input_tokens'] ?? 0) + ($response['usage']['output_tokens'] ?? 0)
        ]
    ];
}

function callDeepSeek($model, $messages, $temperature, $maxTokens) {
    $apiKey = DEEPSEEK_API_KEY;
    if (!$apiKey) {
        throw new Exception('DeepSeek API key not configured');
    }

    return curlRequest('https://api.deepseek.com/v1/chat/completions', [
        'model' => $model,
        'messages' => $messages,
        'temperature' => $temperature,
        'max_tokens' => $maxTokens
    ], [
        "Authorization: Bearer $apiKey"
    ]);
}

function callOllama($model, $messages, $temperature, $maxTokens) {
    $baseUrl = OLLAMA_BASE_URL;

    $response = curlRequest("$baseUrl/api/chat", [
        'model' => $model,
        'messages' => $messages,
        'stream' => false,
        'options' => [
            'temperature' => $temperature,
            'num_predict' => $maxTokens
        ]
    ]);

    // Convert to OpenAI format
    return [
        'id' => 'chatcmpl-' . uniqid(),
        'object' => 'chat.completion',
        'created' => time(),
        'model' => $model,
        'choices' => [[
            'index' => 0,
            'message' => $response['message'] ?? ['role' => 'assistant', 'content' => ''],
            'finish_reason' => 'stop'
        ]]
    ];
}

function streamChatResponse($provider, $model, $messages, $temperature, $maxTokens) {
    header('Content-Type: text/event-stream');
    header('Cache-Control: no-cache');
    header('Connection: keep-alive');

    // Flush headers
    ob_end_flush();
    flush();

    $completionId = 'chatcmpl-' . uniqid();
    $created = time();

    // For streaming, we need to handle each provider differently
    // This is a simplified version - real streaming requires chunked transfer

    try {
        $response = callProvider($provider, $model, $messages, $temperature, $maxTokens);
        $content = $response['choices'][0]['message']['content'] ?? '';

        // Simulate streaming by sending chunks
        $chunks = str_split($content, 10);
        foreach ($chunks as $chunk) {
            $data = json_encode([
                'id' => $completionId,
                'object' => 'chat.completion.chunk',
                'created' => $created,
                'model' => $model,
                'choices' => [[
                    'index' => 0,
                    'delta' => ['content' => $chunk],
                    'finish_reason' => null
                ]]
            ]);
            echo "data: $data\n\n";
            flush();
            usleep(50000); // 50ms delay
        }

        // Final chunk
        $finalData = json_encode([
            'id' => $completionId,
            'object' => 'chat.completion.chunk',
            'created' => $created,
            'model' => $model,
            'choices' => [[
                'index' => 0,
                'delta' => [],
                'finish_reason' => 'stop'
            ]]
        ]);
        echo "data: $finalData\n\n";
        echo "data: [DONE]\n\n";
        flush();

    } catch (Exception $e) {
        $errorData = json_encode(['error' => ['message' => $e->getMessage()]]);
        echo "data: $errorData\n\n";
        flush();
    }

    exit;
}

// ==================== K'UHUL ENGINE ====================

class KuhulEngine {
    const GLYPH = '⟁';
    const HAZARD = '☣';

    private $weights = [];
    private $memory = [];

    public function run($opId, $code, $context = []) {
        $parsed = $this->parseGlyph($code);

        switch ($parsed['operation']) {
            case 'store_weights':
                return $this->storeWeights($context);
            case 'load_weights':
                return $this->loadWeights($context);
            case 'remember':
                return $this->remember($context);
            case 'recall':
                return $this->recall($context);
            default:
                return ['op' => $parsed['operation'], 'status' => 'complete', 'result' => []];
        }
    }

    public function parseGlyph($code) {
        $parts = explode(self::GLYPH, $code);
        $parts = array_filter($parts);
        $parts = array_values($parts);

        return [
            'category' => $parts[0] ?? '',
            'operation' => $parts[1] ?? '',
            'params' => array_slice($parts, 2)
        ];
    }

    public function compress($data) {
        $json = json_encode($data);
        $compressed = gzcompress($json, 9);
        $encoded = base64_encode($compressed);
        $checksum = substr(md5($json), 0, 8);

        return self::HAZARD . "SCXQ2:2.0:gzip:$checksum:$encoded";
    }

    public function decompress($packet) {
        if (strpos($packet, self::HAZARD . 'SCXQ2:') !== 0) {
            throw new Exception('Invalid SCXQ2 packet');
        }

        $parts = explode(':', substr($packet, 1), 5);
        $encoded = $parts[4] ?? '';

        $compressed = base64_decode($encoded);
        $json = gzuncompress($compressed);

        return json_decode($json, true);
    }

    public function getStatus() {
        return [
            'initialized' => true,
            'engine' => 'php',
            'weights_count' => count($this->weights),
            'memory_count' => count($this->memory)
        ];
    }

    private function storeWeights($ctx) {
        $modelId = $ctx['model_id'] ?? '';
        $this->weights[$modelId] = $ctx['weights'] ?? [];
        return ['op' => 'store_weights', 'status' => 'complete', 'result' => ['stored' => true]];
    }

    private function loadWeights($ctx) {
        $modelId = $ctx['model_id'] ?? '';
        return ['op' => 'load_weights', 'status' => 'complete', 'result' => $this->weights[$modelId] ?? null];
    }

    private function remember($ctx) {
        $key = $ctx['key'] ?? '';
        $this->memory[$key] = $ctx['value'] ?? null;
        return ['op' => 'remember', 'status' => 'complete', 'result' => ['remembered' => true]];
    }

    private function recall($ctx) {
        $key = $ctx['key'] ?? '';
        return ['op' => 'recall', 'status' => 'complete', 'result' => ['value' => $this->memory[$key] ?? null]];
    }
}

// ==================== UTILITIES ====================

function getJsonInput() {
    $input = file_get_contents('php://input');
    return json_decode($input, true) ?: [];
}

function jsonResponse($data, $status = 200) {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function jsonError($message, $status = 400, $type = 'error') {
    jsonResponse([
        'error' => [
            'message' => $message,
            'type' => $type,
            'code' => $type
        ]
    ], $status);
}

function curlRequest($url, $data, $headers = []) {
    $ch = curl_init($url);

    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($data),
        CURLOPT_HTTPHEADER => array_merge([
            'Content-Type: application/json'
        ], $headers),
        CURLOPT_TIMEOUT => 120
    ]);

    $response = curl_exec($ch);
    $error = curl_error($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($error) {
        throw new Exception("cURL error: $error");
    }

    $decoded = json_decode($response, true);

    if ($httpCode >= 400) {
        $errorMsg = $decoded['error']['message'] ?? "HTTP $httpCode error";
        throw new Exception($errorMsg);
    }

    return $decoded;
}

function checkApiKey() {
    $apiKey = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    $apiKey = str_replace('Bearer ', '', $apiKey);

    if (!$apiKey) {
        $apiKey = $_SERVER['HTTP_X_API_KEY'] ?? '';
    }

    return in_array($apiKey, ALLOWED_API_KEYS);
}

function checkRateLimit() {
    // Simple file-based rate limiting
    $ip = $_SERVER['REMOTE_ADDR'];
    $cacheFile = sys_get_temp_dir() . '/xjson_rate_' . md5($ip);

    $now = time();
    $window = RATE_LIMIT_WINDOW;
    $limit = RATE_LIMIT_REQUESTS;

    $data = [];
    if (file_exists($cacheFile)) {
        $data = json_decode(file_get_contents($cacheFile), true) ?: [];
    }

    // Clean old entries
    $data = array_filter($data, fn($t) => $t > $now - $window);

    if (count($data) >= $limit) {
        return false;
    }

    $data[] = $now;
    file_put_contents($cacheFile, json_encode($data));

    return true;
}

function getProviderForModel($model) {
    $registry = getModelRegistry();
    return $registry[$model]['provider'] ?? 'openai';
}

function getModelRegistry() {
    return [
        // OpenAI
        'gpt-4o' => ['provider' => 'openai', 'capabilities' => ['text', 'code'], 'context_length' => 128000],
        'gpt-4o-mini' => ['provider' => 'openai', 'capabilities' => ['text', 'code'], 'context_length' => 128000],

        // Anthropic
        'claude-3-5-sonnet-20241022' => ['provider' => 'anthropic', 'capabilities' => ['text', 'code', 'reasoning'], 'context_length' => 200000],
        'claude-3-5-haiku-20241022' => ['provider' => 'anthropic', 'capabilities' => ['text', 'code'], 'context_length' => 200000],

        // DeepSeek
        'deepseek-r1' => ['provider' => 'deepseek', 'capabilities' => ['text', 'code', 'reasoning'], 'context_length' => 64000],
        'deepseek-chat' => ['provider' => 'deepseek', 'capabilities' => ['text', 'code'], 'context_length' => 64000],

        // Ollama
        'llama3.2' => ['provider' => 'ollama', 'capabilities' => ['text', 'code'], 'context_length' => 128000],
        'qwen2.5' => ['provider' => 'ollama', 'capabilities' => ['text', 'code'], 'context_length' => 32000],
    ];
}
