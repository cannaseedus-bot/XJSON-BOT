# XJSON-BOT API Backends

Choose the backend that fits your needs. All backends provide OpenAI-compatible REST APIs.

## 🎯 Quick Comparison

| Feature | Python | PHP | GAS (Google) |
|---------|--------|-----|--------------|
| **Cost** | Server required | Hosting required | **Free** |
| **Setup** | Complex | Medium | **Easy** |
| **Streaming** | ✅ Full SSE | ✅ Simulated | ❌ No |
| **Local Models** | ✅ Janus/Ollama | ❌ API only | ❌ API only |
| **K'UHUL Engine** | ✅ Full | ✅ Basic | ✅ Basic |
| **Database** | SQLite/Postgres | MySQL | Google Sheets |
| **Best For** | Power users | cPanel users | **Everyone else** |

## 🚀 Quick Start

### Option 1: Google Apps Script (Recommended for beginners)

**Zero cost, zero server, works in 5 minutes:**

1. Create a Google Sheet
2. Extensions → Apps Script
3. Paste `gas/Code.gs`
4. Deploy as Web App
5. Done!

```javascript
const api = new XJSONBackend('gas', 'https://script.google.com/.../exec');
const response = await api.chat('Hello!');
```

### Option 2: PHP (For cPanel/shared hosting)

**Works on any $5/month hosting:**

1. Upload `php/` folder to your server
2. Configure `config.example.php`
3. Done!

```javascript
const api = new XJSONBackend('php', 'https://yourdomain.com/api/php');
const response = await api.chat('Hello!');
```

### Option 3: Python (For advanced users)

**Full power with local models:**

```bash
cd python
pip install -r requirements.txt
uvicorn main:app --reload
```

```javascript
const api = new XJSONBackend('python', 'http://localhost:8000');
const response = await api.chat('Hello!');
```

## 📁 Directory Structure

```
api/
├── README.md              ← You are here
├── backend-adapter.js     ← Unified frontend client
│
├── gas/                   ← Google Apps Script
│   ├── Code.gs           ← Main GAS code
│   └── README.md         ← Setup instructions
│
├── php/                   ← PHP Backend
│   ├── index.php         ← Main API
│   ├── config.example.php ← Configuration template
│   └── .htaccess         ← URL rewriting
│
└── (../python/)          ← Python Backend (optional)
    ├── main.py           ← FastAPI server
    ├── requirements.txt  ← Dependencies
    └── Dockerfile        ← Container build
```

## 🔌 API Endpoints

All backends support these endpoints:

### Chat
```
POST /v1/chat/completions
{
  "model": "gpt-4o-mini",
  "messages": [{"role": "user", "content": "Hello!"}],
  "temperature": 0.7,
  "max_tokens": 4096,
  "stream": false
}
```

### Models
```
GET /v1/models
GET /v1/models/{model_id}
```

### K'UHUL (Python/PHP only)
```
POST /v1/kuhul/run
POST /v1/kuhul/compress
POST /v1/kuhul/decompress
```

## 🔧 Frontend Integration

### Using the Adapter

```javascript
// Include the adapter
<script src="api/backend-adapter.js"></script>

// Create backend instance
const api = new XJSONBackend('gas', 'YOUR_GAS_URL');

// Simple chat
const response = await api.chat('What is AI?');
console.log(response.choices[0].message.content);

// With options
const response = await api.chat([
  { role: 'system', content: 'You are a helpful assistant.' },
  { role: 'user', content: 'Explain quantum computing.' }
], {
  model: 'gpt-4o',
  temperature: 0.5,
  maxTokens: 2000
});

// Streaming (Python/PHP only)
for await (const chunk of api.streamChat('Tell me a story')) {
  process.stdout.write(chunk);
}
```

### Backend Switching

```javascript
// Save preference
api.configure('php', 'https://myserver.com/api');

// Get current config
console.log(api.getInfo());
// { type: 'php', baseUrl: '...', capabilities: [...] }
```

## 🔐 Security

### API Keys

| Backend | Storage Location |
|---------|-----------------|
| Python | `.env` file or environment |
| PHP | `config.php` outside public_html |
| GAS | Script Properties (encrypted) |

### Rate Limiting

All backends support rate limiting:
- Python: Middleware-based
- PHP: File-based cache
- GAS: Google quotas apply

## 📊 Model Support

| Model | Python | PHP | GAS |
|-------|--------|-----|-----|
| GPT-4o | ✅ | ✅ | ✅ |
| GPT-4o-mini | ✅ | ✅ | ✅ |
| Claude 3.5 | ✅ | ✅ | ✅ |
| DeepSeek R1 | ✅ | ✅ | ✅ |
| Janus (images) | ✅ | ❌ | ❌ |
| Ollama (local) | ✅ | ✅ | ❌ |

## 🛠️ Troubleshooting

### CORS Errors
- Python: CORS middleware included
- PHP: Headers set in index.php
- GAS: CORS handled by Google

### Streaming Not Working
- GAS doesn't support SSE streaming
- PHP streaming requires output buffering disabled
- Python uses SSE-Starlette

### Rate Limit Exceeded
- Increase limits in config
- Or upgrade to paid API plans

## 📈 Scaling

| Users | Recommended Backend |
|-------|-------------------|
| 1-10 | GAS (free) |
| 10-100 | PHP on shared hosting |
| 100-1000 | PHP on VPS |
| 1000+ | Python with Redis |

---

**Choose your backend and start building!** 🚀

For detailed setup instructions, see each backend's README.
