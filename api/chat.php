<?php
/* ========================================================
   XJSON-BOT / MX2LM Chat Endpoint
   =====================================================
   Non-streaming chat API
   Integrates with KQL backend for persistence

   Endpoint: /api/chat.php
   Protocol: JSON REST API

   Methods:
   - POST /chat.php - Send message, get response
   - GET  /chat.php?action=history&chatId=xxx - Get chat history
   - GET  /chat.php?action=chats&userId=xxx - Get user's chats
   ======================================================== */

// Load secure config (outside public_html)
$config_path = dirname(dirname(dirname(__FILE__))) . '/secure/kql-api-config.php';
$config = file_exists($config_path) ? require $config_path : [];

// CORS Headers
$allowed_origins = $config['api']['allowedOrigins'] ?? ['*'];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '*';
if (in_array('*', $allowed_origins) || in_array($origin, $allowed_origins)) {
    header("Access-Control-Allow-Origin: $origin");
}
header('Content-Type: application/json');
header('Access-Control-Allow-Headers: Content-Type, X-API-Key');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');

// Handle preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// ========================================================
// DATABASE CONNECTION
// ========================================================

$pdo = null;
if (!empty($config['mysql'])) {
    try {
        $pdo = new PDO(
            "mysql:host={$config['mysql']['host']};dbname={$config['mysql']['database']};charset=utf8mb4",
            $config['mysql']['username'],
            $config['mysql']['password'],
            $config['mysql']['options'] ?? [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
        );
    } catch (PDOException $e) {
        respond(['error' => 'database_connection_failed', 'message' => $e->getMessage()], 500);
    }
}

// ========================================================
// HELPERS
// ========================================================

function respond($data, $status = 200) {
    http_response_code($status);
    echo json_encode($data);
    exit;
}

function generateId($prefix = 'id') {
    return $prefix . '_' . time() . '_' . bin2hex(random_bytes(4));
}

function logEvent($pdo, $type, $data, $source = 'chat') {
    if (!$pdo) return;
    try {
        $stmt = $pdo->prepare("INSERT INTO kql_events (id, type, data, source, timestamp) VALUES (?, ?, ?, ?, ?)");
        $stmt->execute([generateId('evt'), $type, json_encode($data), $source, time() * 1000]);
    } catch (PDOException $e) {
        error_log("Event log failed: " . $e->getMessage());
    }
}

// ========================================================
// ROUTING
// ========================================================

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? 'chat';
$input = json_decode(file_get_contents('php://input'), true) ?: [];

switch ($method) {
    case 'GET':
        handleGet($action, $pdo, $config);
        break;

    case 'POST':
        handlePost($action, $input, $pdo, $config);
        break;

    default:
        respond(['error' => 'method_not_allowed'], 405);
}

// ========================================================
// GET HANDLERS
// ========================================================

function handleGet($action, $pdo, $config) {
    switch ($action) {
        case 'chats':
            getChats($pdo);
            break;

        case 'history':
            getChatHistory($pdo);
            break;

        case 'models':
            getModels($pdo);
            break;

        case 'status':
            getStatus($pdo, $config);
            break;

        default:
            respond(['error' => 'unknown_action', 'action' => $action], 400);
    }
}

function getChats($pdo) {
    $userId = $_GET['userId'] ?? null;
    $limit = intval($_GET['limit'] ?? 50);

    if (!$pdo) {
        respond(['chats' => [], 'message' => 'Database not configured']);
    }

    try {
        if ($userId) {
            $stmt = $pdo->prepare("SELECT * FROM kql_chats WHERE userId = ? ORDER BY updated DESC LIMIT ?");
            $stmt->execute([$userId, $limit]);
        } else {
            $stmt = $pdo->prepare("SELECT * FROM kql_chats ORDER BY updated DESC LIMIT ?");
            $stmt->execute([$limit]);
        }

        respond(['chats' => $stmt->fetchAll()]);
    } catch (PDOException $e) {
        respond(['error' => 'query_failed', 'message' => $e->getMessage()], 500);
    }
}

function getChatHistory($pdo) {
    $chatId = $_GET['chatId'] ?? null;
    $limit = intval($_GET['limit'] ?? 100);

    if (!$chatId) {
        respond(['error' => 'chatId_required'], 400);
    }

    if (!$pdo) {
        respond(['messages' => [], 'message' => 'Database not configured']);
    }

    try {
        $stmt = $pdo->prepare("SELECT * FROM kql_messages WHERE chatId = ? ORDER BY timestamp ASC LIMIT ?");
        $stmt->execute([$chatId, $limit]);

        respond(['messages' => $stmt->fetchAll(), 'chatId' => $chatId]);
    } catch (PDOException $e) {
        respond(['error' => 'query_failed', 'message' => $e->getMessage()], 500);
    }
}

function getModels($pdo) {
    if (!$pdo) {
        // Return default models
        respond(['models' => [
            ['id' => 'default', 'name' => 'Default Model', 'provider' => 'local'],
            ['id' => 'ollama', 'name' => 'Ollama (Local)', 'provider' => 'ollama'],
            ['id' => 'openai', 'name' => 'OpenAI', 'provider' => 'openai'],
            ['id' => 'anthropic', 'name' => 'Anthropic', 'provider' => 'anthropic']
        ]]);
    }

    try {
        $stmt = $pdo->query("SELECT * FROM kql_models ORDER BY name ASC");
        respond(['models' => $stmt->fetchAll()]);
    } catch (PDOException $e) {
        respond(['error' => 'query_failed', 'message' => $e->getMessage()], 500);
    }
}

function getStatus($pdo, $config) {
    $status = [
        'status' => 'ok',
        'version' => '2.0.0',
        'kql' => $pdo ? 'connected' : 'not_configured',
        'providers' => []
    ];

    // Check providers
    if (!empty($config['llm']['openai']['key'])) {
        $status['providers'][] = 'openai';
    }
    if (!empty($config['llm']['anthropic']['key'])) {
        $status['providers'][] = 'anthropic';
    }
    $status['providers'][] = 'local';

    // Check Ollama
    $ollama_url = $config['llm']['ollama']['url'] ?? 'http://localhost:11434';
    $ch = curl_init("$ollama_url/api/tags");
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 2);
    $result = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode === 200) {
        $status['providers'][] = 'ollama';
        $status['ollama'] = 'running';
    } else {
        $status['ollama'] = 'not_running';
    }

    respond($status);
}

// ========================================================
// POST HANDLERS
// ========================================================

function handlePost($action, $input, $pdo, $config) {
    switch ($action) {
        case 'chat':
            sendChat($input, $pdo, $config);
            break;

        case 'create_chat':
            createChat($input, $pdo);
            break;

        case 'save_message':
            saveMessage($input, $pdo);
            break;

        case 'feedback':
            saveFeedback($input, $pdo);
            break;

        default:
            respond(['error' => 'unknown_action', 'action' => $action], 400);
    }
}

function sendChat($input, $pdo, $config) {
    $message = $input['message'] ?? '';
    $model = $input['model'] ?? 'default';
    $provider = $input['provider'] ?? 'local';
    $chatId = $input['chatId'] ?? null;
    $userId = $input['userId'] ?? 'anonymous';

    if (empty($message)) {
        respond(['error' => 'message_required'], 400);
    }

    // Log request
    logEvent($pdo, 'chat_request', [
        'message' => substr($message, 0, 100),
        'model' => $model,
        'provider' => $provider
    ], 'chat');

    // Get response based on provider
    $start_time = microtime(true);
    $response_text = '';

    switch ($provider) {
        case 'openai':
            $response_text = callOpenAI($message, $model, $config);
            break;

        case 'anthropic':
            $response_text = callAnthropic($message, $model, $config);
            break;

        case 'ollama':
            $response_text = callOllama($message, $model, $config);
            break;

        default:
            $response_text = generateLocalResponse($model, $message);
    }

    $processing_time = round((microtime(true) - $start_time) * 1000);

    // Save messages to KQL
    if ($pdo && $chatId) {
        try {
            // Save user message
            $stmt = $pdo->prepare("INSERT INTO kql_messages (id, chatId, role, content, model, timestamp) VALUES (?, ?, ?, ?, ?, ?)");
            $stmt->execute([generateId('msg'), $chatId, 'user', $message, null, time() * 1000]);

            // Save assistant response
            $stmt->execute([generateId('msg'), $chatId, 'assistant', $response_text, $model, time() * 1000]);

            // Update chat timestamp
            $stmt = $pdo->prepare("UPDATE kql_chats SET updated = ? WHERE id = ?");
            $stmt->execute([time() * 1000, $chatId]);
        } catch (PDOException $e) {
            error_log("Message save failed: " . $e->getMessage());
        }
    }

    // Log completion
    logEvent($pdo, 'chat_response', [
        'model' => $model,
        'provider' => $provider,
        'tokens_estimated' => ceil(strlen($response_text) / 4),
        'processing_time' => $processing_time
    ], 'chat');

    respond([
        'response' => $response_text,
        'model' => $model,
        'provider' => $provider,
        'tokens_estimated' => ceil(strlen($response_text) / 4),
        'processing_time' => $processing_time
    ]);
}

function createChat($input, $pdo) {
    $title = $input['title'] ?? 'New Chat';
    $userId = $input['userId'] ?? 'anonymous';

    $chatId = generateId('chat');
    $now = time() * 1000;

    if ($pdo) {
        try {
            $stmt = $pdo->prepare("INSERT INTO kql_chats (id, userId, title, created, updated) VALUES (?, ?, ?, ?, ?)");
            $stmt->execute([$chatId, $userId, $title, $now, $now]);
        } catch (PDOException $e) {
            respond(['error' => 'create_failed', 'message' => $e->getMessage()], 500);
        }
    }

    respond([
        'chatId' => $chatId,
        'title' => $title,
        'userId' => $userId,
        'created' => $now
    ]);
}

function saveMessage($input, $pdo) {
    if (!$pdo) {
        respond(['error' => 'database_not_configured'], 500);
    }

    $chatId = $input['chatId'] ?? null;
    $role = $input['role'] ?? 'user';
    $content = $input['content'] ?? '';
    $model = $input['model'] ?? null;

    if (!$chatId || !$content) {
        respond(['error' => 'chatId_and_content_required'], 400);
    }

    $messageId = generateId('msg');
    $now = time() * 1000;

    try {
        $stmt = $pdo->prepare("INSERT INTO kql_messages (id, chatId, role, content, model, timestamp) VALUES (?, ?, ?, ?, ?, ?)");
        $stmt->execute([$messageId, $chatId, $role, $content, $model, $now]);

        respond(['messageId' => $messageId, 'saved' => true]);
    } catch (PDOException $e) {
        respond(['error' => 'save_failed', 'message' => $e->getMessage()], 500);
    }
}

function saveFeedback($input, $pdo) {
    if (!$pdo) {
        respond(['error' => 'database_not_configured'], 500);
    }

    $messageId = $input['messageId'] ?? null;
    $rating = intval($input['rating'] ?? 0);
    $feedback = $input['feedback'] ?? '';

    try {
        $stmt = $pdo->prepare("INSERT INTO kql_rlhf (id, type, data, rating, timestamp) VALUES (?, ?, ?, ?, ?)");
        $stmt->execute([
            generateId('rlhf'),
            'feedback',
            json_encode(['messageId' => $messageId, 'feedback' => $feedback]),
            $rating,
            time() * 1000
        ]);

        respond(['saved' => true]);
    } catch (PDOException $e) {
        respond(['error' => 'feedback_failed', 'message' => $e->getMessage()], 500);
    }
}

// ========================================================
// PROVIDER FUNCTIONS
// ========================================================

function callOpenAI($message, $model, $config) {
    $api_key = $config['llm']['openai']['key'] ?? null;
    if (!$api_key) {
        return "OpenAI not configured on server.";
    }

    $model_id = $config['llm']['openai']['model'] ?? 'gpt-4o-mini';

    $ch = curl_init('https://api.openai.com/v1/chat/completions');
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode([
            'model' => $model_id,
            'messages' => [['role' => 'user', 'content' => $message]],
            'max_tokens' => 1024
        ]),
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $api_key
        ],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 60
    ]);

    $response = curl_exec($ch);
    curl_close($ch);

    $data = json_decode($response, true);
    return $data['choices'][0]['message']['content'] ?? "OpenAI request failed.";
}

function callAnthropic($message, $model, $config) {
    $api_key = $config['llm']['anthropic']['key'] ?? null;
    if (!$api_key) {
        return "Anthropic not configured on server.";
    }

    $model_id = $config['llm']['anthropic']['model'] ?? 'claude-3-5-sonnet-20241022';

    $ch = curl_init('https://api.anthropic.com/v1/messages');
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode([
            'model' => $model_id,
            'messages' => [['role' => 'user', 'content' => $message]],
            'max_tokens' => 1024
        ]),
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'x-api-key: ' . $api_key,
            'anthropic-version: 2023-06-01'
        ],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 60
    ]);

    $response = curl_exec($ch);
    curl_close($ch);

    $data = json_decode($response, true);
    return $data['content'][0]['text'] ?? "Anthropic request failed.";
}

function callOllama($message, $model, $config) {
    $ollama_url = $config['llm']['ollama']['url'] ?? 'http://localhost:11434';
    $model_id = $config['llm']['ollama']['model'] ?? 'llama3.2';

    $ch = curl_init("$ollama_url/api/generate");
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode([
            'model' => $model_id,
            'prompt' => $message,
            'stream' => false
        ]),
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 120
    ]);

    $response = curl_exec($ch);
    curl_close($ch);

    $data = json_decode($response, true);
    return $data['response'] ?? "Ollama not available.";
}

function generateLocalResponse($model, $message) {
    return "Local model ($model) response to: \"$message\"\n\n" .
           "This is a placeholder response. Configure OpenAI, Anthropic, or Ollama on the server for real AI responses. " .
           "KQL backend is ready for chat persistence and analytics.";
}
?>
