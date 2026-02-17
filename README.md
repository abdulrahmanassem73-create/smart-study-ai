# generate-study-content (Supabase Edge Function)

Calls Google Gemini from the server **without exposing the API key to the browser**.

## What it does

This function receives a request from the frontend and then calls Gemini using the server-side secret `GEMINI_API_KEY`.

Supported actions:
- `study_pack` → returns `{ analysis_markdown, questions[] }`
- `explain` → returns `{ markdown, questions[] }`
- `chat` → returns `{ text }` (supports RAG when `fileId` provided)
- `index_file` → indexes embeddings into `public.file_embeddings`

## Request body

```json
{
  "action": "study_pack",
  "text": "...",
  "questionCount": 10
}
```

For chat:

```json
{
  "action": "chat",
  "commandLabel": "سؤال عام",
  "userMessage": "...",
  "pageMarkdown": "...",
  "globalSummaries": [{ "fileName": "...", "summary": "..." }],
  "mode": "normal",
  "socratic": false
}
```

## Set secrets

```bash
supabase secrets set GEMINI_API_KEY="YOUR_KEY"
```

## Deploy

```bash
supabase functions deploy generate-study-content
```
