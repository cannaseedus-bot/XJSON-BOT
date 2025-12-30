# XJSON-BOT Google Apps Script API

Free serverless backend using Google Sheets as database.

## Shards

| File | Purpose | Artifact ID |
|------|---------|-------------|
| `Code.gs` | Chat API, models, memory, SCXQ2 | `XJSON_GAS_API_v1` |
| `auth.gs` | Auth, sessions, per-user DB | `AUTH_IDB_KQL_SHEETS_GLOBAL_v5` |

## Why GAS?

- **100% Free** - No hosting costs
- **No Server Required** - Runs on Google's infrastructure
- **Google Sheets as DB** - Easy to view/edit data
- **HTTPS Built-in** - Secure by default
- **Personal Mesh** - Each user controls their own backend

## Quick Setup

### 1. Create Google Sheet

1. Go to [sheets.google.com](https://sheets.google.com)
2. Create a new spreadsheet
3. Name it "XJSON-BOT Data"

### 2. Open Apps Script

1. In your sheet: **Extensions → Apps Script**
2. Delete any existing code
3. Copy/paste `Code.gs` contents

### 3. Configure API Keys

1. In Apps Script: **Project Settings → Script Properties**
2. Add these properties:
   - `OPENAI_API_KEY` = your OpenAI key
   - `ANTHROPIC_API_KEY` = your Anthropic key (optional)
   - `DEEPSEEK_API_KEY` = your DeepSeek key (optional)

Or run `setupApiKeys()` function and edit the keys in the code.

### 4. Deploy

1. Click **Deploy → New Deployment**
2. Select type: **Web app**
3. Settings:
   - Execute as: **Me**
   - Who has access: **Anyone** (or just you)
4. Click **Deploy**
5. Copy the **Web app URL**

### 5. Use in Frontend

```javascript
const GAS_URL = 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec';

// Chat completion
const response = await fetch(GAS_URL, {
  method: 'POST',
  body: JSON.stringify({
    action: 'chat',
    model: 'gpt-4o-mini',
    messages: [
      { role: 'user', content: 'Hello!' }
    ]
  })
});

const data = await response.json();
console.log(data.choices[0].message.content);
```

## API Reference

### POST Actions

| Action | Description | Parameters |
|--------|-------------|------------|
| `chat` | Chat completion | `model`, `messages`, `temperature`, `max_tokens` |
| `saveChat` | Save chat | `id`, `userId`, `title` |
| `saveMessage` | Save message | `chatId`, `role`, `content`, `model` |
| `remember` | Store memory | `key`, `value`, `category`, `confidence` |
| `recall` | Recall memory | `key` |
| `compress` | SCXQ2 compress | `data` |
| `decompress` | SCXQ2 decompress | `data` |

### Auth Actions (auth.gs)

| Action | Description | Parameters |
|--------|-------------|------------|
| `securoLogin` | Google OAuth login | `idToken`, `app_id` |

**SecuroLogin Response:**
```json
{
  "ok": true,
  "app_id": "global",
  "identity": {
    "external_id": "google_sub_id",
    "email": "user@example.com",
    "verified": true,
    "name": "User Name",
    "picture": "https://..."
  },
  "securoToken": "base64_payload.hmac_sig",
  "apiKey": "key_uuid",
  "db_json": {
    "@schema": "asx://db/db.json.v1",
    "users": [...],
    "sessions": [...],
    "api_keys": [...],
    "apps": [...],
    "events": [...],
    "rlhf": [...]
  },
  "persistence": { "server": "google_sheets", "client": "indexeddb" },
  "query": { "language": "kql.v1", "authority": "client" }
}
```

### GET Actions

| Action | Description | Parameters |
|--------|-------------|------------|
| `status` | Health check | - |
| `models` | List models | - |
| `chats` | Get chat list | `userId` |
| `messages` | Get messages | `chatId` |

## Data Storage

### Code.gs (Chat API)

Data is stored in the active spreadsheet:

| Sheet | Purpose |
|-------|---------|
| `Chats` | Chat sessions |
| `Messages` | Chat messages |
| `Memory` | K'UHUL memory |
| `Usage` | Token usage logs |

### auth.gs (Per-User Sheets)

Each user gets their own spreadsheet (`ASX_USER_{external_id}`):

| Sheet | Columns |
|-------|---------|
| `users` | `external_id`, `email`, `verified`, `name`, `picture`, `last_login` |
| `sessions` | `securoToken`, `external_id`, `issued_at` |
| `api_keys` | `key`, `owner`, `active`, `created`, `lastUsed` |
| `apps` | `app_id`, `first_seen`, `last_seen` |
| `events` | `event_id`, `app_id`, `type`, `timestamp`, `payload` |
| `rlhf` | `id`, `app_id`, `model`, `score`, `timestamp`, `meta` |

## Limitations

- **6 min execution limit** per request
- **No true streaming** (GAS doesn't support SSE)
- **Rate limits** apply (Google quotas)
- **Cold starts** can add latency

## Comparison

| Feature | GAS | PHP | Python |
|---------|-----|-----|--------|
| Cost | Free | Hosting cost | Hosting cost |
| Setup | Easy | Medium | Complex |
| Streaming | ❌ | ✅ | ✅ |
| Local models | ❌ | ❌ | ✅ (Janus) |
| Persistence | Sheets | MySQL | SQLite/Postgres |
| Offline | ❌ | ❌ | ✅ |
| Auth (SecuroLink) | ✅ | ✅ | ✅ |
| Per-user DB | ✅ (Sheets) | ✅ | ✅ |

## Security

1. API keys are stored in Script Properties (encrypted)
2. Use "Me" for execution to protect keys
3. Use "Anyone" access only if needed
4. Consider adding API key validation for your app

## Troubleshooting

### "Script function not found"
- Make sure you copied the entire `Code.gs` file
- Check for syntax errors

### "Authorization required"
- Re-deploy and authorize permissions
- Check execution permissions

### "Exceeded maximum execution time"
- Reduce max_tokens
- Use a smaller model
- Split large requests

## Updates

To update your deployment:
1. Edit code in Apps Script
2. **Deploy → Manage Deployments**
3. Click edit (pencil icon) on active deployment
4. Select **New version**
5. Click **Deploy**

---

**Part of the XJSON-BOT Multi-Backend Architecture**
