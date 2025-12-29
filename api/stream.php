<?php
/* ========================================================
   XJSON-BOT / MX2LM Streaming Endpoint
   =====================================================
   Server-Sent Events (SSE) streaming interface
   Integrates with KQL backend for persistence

   Endpoint: /api/stream.php
   Protocol: SSE (text/event-stream)

   Stack Position:
   Browser → SSE → stream.php → KQL/MySQL → Java/gRPC (optional)
   ======================================================== */

// Load secure config (outside public_html)
$config_path = dirname(dirname(dirname(__FILE__))) . '/secure/kql-api-config.php';
$config = file_exists($config_path) ? require $config_path : [];

// CORS and SSE Headers
header('Content-Type: text/event-stream');
header('Cache-Control: no-cache');
header('Connection: keep-alive');
header('X-Accel-Buffering: no');

// CORS - check allowed origins
$allowed_origins = $config['api']['allowedOrigins'] ?? ['*'];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '*';
if (in_array('*', $allowed_origins) || in_array($origin, $allowed_origins)) {
    header("Access-Control-Allow-Origin: $origin");
}
header('Access-Control-Allow-Headers: Content-Type, X-API-Key');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');

// Handle preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// ========================================================
// SSE HELPERS
// ========================================================

function sendSSE($data, $event = "message") {
    echo "event: $event\n";
    echo "data: " . json_encode($data) . "\n\n";
    ob_flush();
    flush();
}

function sendError($message, $code = 'error') {
    sendSSE(['error' => $code, 'message' => $message], 'error');
    echo "event: end\n";
    echo "data: " . json_encode(['status' => 'error']) . "\n\n";
    ob_flush();
    flush();
    exit;
}

// ========================================================
// INPUT PARSING
// ========================================================

$input = json_decode(file_get_contents('php://input'), true) ?: [];

$message = $input['message'] ?? $_GET['message'] ?? '';
$model = $input['model'] ?? $_GET['model'] ?? 'default';
$chatId = $input['chatId'] ?? $_GET['chatId'] ?? null;
$userId = $input['userId'] ?? $_GET['userId'] ?? 'anonymous';
$provider = $input['provider'] ?? $_GET['provider'] ?? 'local';
$stream_to_java = $input['useJavaBackend'] ?? false;

// Validate
if (empty($message)) {
    sendError('Message is required', 'message_required');
}

// ========================================================
// KQL LOGGING (MySQL if configured)
// ========================================================

$pdo = null;
if (!empty($config['mysql'])) {
    try {
        $pdo = new PDO(
            "mysql:host={$config['mysql']['host']};dbname={$config['mysql']['database']};charset=utf8mb4",
            $config['mysql']['username'],
            $config['mysql']['password'],
            [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
        );
    } catch (PDOException $e) {
        // Continue without DB logging
        error_log("KQL MySQL connection failed: " . $e->getMessage());
    }
}

function logToKQL($pdo, $type, $data, $source = 'stream') {
    if (!$pdo) return;
    try {
        $stmt = $pdo->prepare("INSERT INTO kql_events (id, type, data, source, timestamp) VALUES (?, ?, ?, ?, ?)");
        $stmt->execute([
            'evt_' . uniqid(),
            $type,
            json_encode($data),
            $source,
            time() * 1000
        ]);
    } catch (PDOException $e) {
        error_log("KQL log failed: " . $e->getMessage());
    }
}

function saveMessage($pdo, $chatId, $role, $content, $model) {
    if (!$pdo || !$chatId) return;
    try {
        $stmt = $pdo->prepare("INSERT INTO kql_messages (id, chatId, role, content, model, timestamp) VALUES (?, ?, ?, ?, ?, ?)");
        $stmt->execute([
            'msg_' . uniqid(),
            $chatId,
            $role,
            $content,
            $model,
            time() * 1000
        ]);
    } catch (PDOException $e) {
        error_log("KQL message save failed: " . $e->getMessage());
    }
}

// ========================================================
// LOG REQUEST START
// ========================================================

logToKQL($pdo, 'stream_start', [
    'message' => substr($message, 0, 100),
    'model' => $model,
    'provider' => $provider,
    'chatId' => $chatId,
    'userId' => $userId
], 'stream');

// ========================================================
// INITIAL CONNECTION
// ========================================================

sendSSE([
    'status' => 'connected',
    'model' => $model,
    'provider' => $provider,
    'timestamp' => time(),
    'streamId' => uniqid('stream_')
], 'connect');

// ========================================================
// JAVA gRPC BACKEND (optional)
// ========================================================

if ($stream_to_java && !empty($config['java']['endpoint'])) {
    // Forward to Java gRPC streaming backend
    $java_endpoint = $config['java']['endpoint'] . '/stream';

    sendSSE(['type' => 'thinking', 'content' => 'Connecting to Java backend...', 'progress' => 10]);

    $ch = curl_init($java_endpoint);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode([
            'message' => $message,
            'model' => $model,
            'chatId' => $chatId
        ]),
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_RETURNTRANSFER => false,
        CURLOPT_WRITEFUNCTION => function($ch, $data) {
            // Forward Java SSE chunks to client
            echo $data;
            ob_flush();
            flush();
            return strlen($data);
        }
    ]);

    curl_exec($ch);
    curl_close($ch);
    exit;
}

// ========================================================
// THINKING PHASE
// ========================================================

$thinking_steps = [
    ['type' => 'thinking', 'content' => 'Processing your message...', 'progress' => 10],
    ['type' => 'thinking', 'content' => "Analyzing with $model...", 'progress' => 30],
    ['type' => 'thinking', 'content' => 'Generating response...', 'progress' => 60],
    ['type' => 'thinking', 'content' => 'Finalizing output...', 'progress' => 90],
];

foreach ($thinking_steps as $step) {
    usleep(150000); // 150ms delay
    sendSSE($step);
}

// ========================================================
// PROVIDER ROUTING
// ========================================================

$response_text = '';
$start_time = microtime(true);

switch ($provider) {
    case 'openai':
        $response_text = stream_openai($message, $model, $config);
        break;

    case 'anthropic':
        $response_text = stream_anthropic($message, $model, $config);
        break;

    case 'ollama':
        $response_text = stream_ollama($message, $model, $config);
        break;

    case 'local':
    default:
        $response_text = generate_local_response($model, $message);
        break;
}

$processing_time = round((microtime(true) - $start_time) * 1000);

// ========================================================
// STREAM RESPONSE CHUNKS
// ========================================================

$sentences = preg_split('/(?<=[.!?])\s+/', $response_text);
$full_response = '';

foreach ($sentences as $index => $sentence) {
    if (trim($sentence)) {
        usleep(rand(80000, 200000)); // 80-200ms delay

        $full_response .= $sentence . ' ';

        sendSSE([
            'type' => 'chunk',
            'content' => $sentence . ' ',
            'chunk_index' => $index,
            'total_chunks' => count($sentences),
            'progress' => min(100, 90 + (($index + 1) / count($sentences) * 10))
        ]);
    }
}

// ========================================================
// SAVE TO KQL
// ========================================================

// Save user message
saveMessage($pdo, $chatId, 'user', $message, null);

// Save assistant response
saveMessage($pdo, $chatId, 'assistant', trim($full_response), $model);

// Log completion
logToKQL($pdo, 'stream_complete', [
    'model' => $model,
    'provider' => $provider,
    'chatId' => $chatId,
    'tokens_estimated' => ceil(strlen($full_response) / 4),
    'processing_time' => $processing_time
], 'stream');

// ========================================================
// COMPLETION
// ========================================================

sendSSE([
    'type' => 'complete',
    'total_chunks' => count($sentences),
    'tokens_estimated' => ceil(strlen($full_response) / 4),
    'finish_reason' => 'stop',
    'model' => $model,
    'provider' => $provider,
    'processing_time' => $processing_time
], 'complete');

// End stream
echo "event: end\n";
echo "data: " . json_encode(['status' => 'stream_complete']) . "\n\n";
ob_flush();
flush();

// ========================================================
// PROVIDER STREAMING FUNCTIONS
// ========================================================

function stream_openai($message, $model, $config) {
    $api_key = $config['llm']['openai']['key'] ?? null;
    if (!$api_key) {
        return "OpenAI API key not configured. Please add your API key to the server configuration.";
    }

    $model_id = $config['llm']['openai']['model'] ?? 'gpt-4o-mini';

    $ch = curl_init('https://api.openai.com/v1/chat/completions');
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode([
            'model' => $model_id,
            'messages' => [['role' => 'user', 'content' => $message]],
            'stream' => false, // For simplicity, get full response then chunk it
            'max_tokens' => 1024
        ]),
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $api_key
        ],
        CURLOPT_RETURNTRANSFER => true
    ]);

    $response = curl_exec($ch);
    curl_close($ch);

    $data = json_decode($response, true);
    return $data['choices'][0]['message']['content'] ?? "Error getting OpenAI response.";
}

function stream_anthropic($message, $model, $config) {
    $api_key = $config['llm']['anthropic']['key'] ?? null;
    if (!$api_key) {
        return "Anthropic API key not configured. Please add your API key to the server configuration.";
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
        CURLOPT_RETURNTRANSFER => true
    ]);

    $response = curl_exec($ch);
    curl_close($ch);

    $data = json_decode($response, true);
    return $data['content'][0]['text'] ?? "Error getting Anthropic response.";
}

function stream_ollama($message, $model, $config) {
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
    return $data['response'] ?? "Error getting Ollama response. Is Ollama running?";
}

// ========================================================
// LOCAL RESPONSE GENERATOR
// ========================================================

function generate_local_response($model_name, $message) {
    $responses = [
        'deepseek-r1' => "DeepSeek R1 analyzing your query: \"$message\"\n\n" .
                        "I apply enhanced reasoning capabilities to understand complex queries. " .
                        "My analysis considers multiple perspectives and generates coherent responses. " .
                        "The quantum-enhanced inference ensures optimal results with high accuracy. " .
                        "Would you like me to elaborate on any specific aspect?",

        'deepseek-coder' => "DeepSeek Coder processing programming query.\n\n" .
                           "For your question about: \"$message\"\n\n" .
                           "I specialize in code generation, debugging, and optimization. " .
                           "I can help with multiple programming languages and best practices. " .
                           "Let me know if you need specific code examples or explanations.",

        'janus-pro' => "Janus Pro Quantum Analysis Stream.\n\n" .
                       "Processing through MX2LM quantum lattice...\n" .
                       "Query: \"$message\"\n\n" .
                       "Dual-perspective reasoning engaged for optimal response generation. " .
                       "Quantum compression applied for efficiency. " .
                       "Entangled meaning vectors analyzed for deeper understanding.",

        'llama3' => "Hello! I'm Llama 3 responding to your message.\n\n" .
                    "You asked: \"$message\"\n\n" .
                    "As a general-purpose model, I can help with various topics. " .
                    "I provide balanced responses with good coverage. " .
                    "Let me know if you need more specific information.",

        'cline-agent' => "Cline Agent activated for task execution.\n\n" .
                         "Task analysis complete. Planning execution steps. " .
                         "Tool integration available for complex tasks. " .
                         "Quantum acceleration enabled for faster processing. " .
                         "Ready to execute your requested task.",

        'kuhul-quantum' => "K'UHUL Quantum Engine streaming quantum processing.\n\n" .
                           "Quantum superposition of response states. " .
                           "Entanglement optimization for coherence. " .
                           "SCXQ2 compression at 98.5% ratio. " .
                           "Quantum computation complete with optimal results."
    ];

    return $responses[$model_name] ??
           "MX2LM Model responding to: \"$message\"\n\n" .
           "This is a response from the $model_name model. " .
           "Configure a real AI provider (OpenAI, Anthropic, Ollama) in your server settings for actual AI responses. " .
           "KQL backend is ready for persistence and analytics.";
}
?>
