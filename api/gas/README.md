# XJSON-BOT Google Apps Script API

Free serverless backend using Google Sheets as database.

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

### GET Actions

| Action | Description | Parameters |
|--------|-------------|------------|
| `status` | Health check | - |
| `models` | List models | - |
| `chats` | Get chat list | `userId` |
| `messages` | Get messages | `chatId` |

## Data Storage

Data is stored in Google Sheets:

| Sheet | Purpose |
|-------|---------|
| `Chats` | Chat sessions |
| `Messages` | Chat messages |
| `Memory` | K'UHUL memory |
| `Usage` | Token usage logs |

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
