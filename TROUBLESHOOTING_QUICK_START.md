# Quick Start: Troubleshooting AI Feature

## What Was Built

A complete AI-powered troubleshooting system that captures user issues, analyzes them with an LLM, and tracks follow-ups:

### 🎯 User Experience
- **Floating AI button** on every page (bottom-right corner)
- User describes their issue → AI analyzes → User confirms → Data saved

### 📊 Admin Dashboard
- **Path**: `/admin/troubleshooting` (admin-only)
- View unfollowed-up issues
- Mark issues as resolved with notes
- Track which prompts need attention

### 💾 Database
- Table: `troubleshooting_prompts` ✅ Created
- Stores: user email, timestamp, page context, original description, AI prompt, edits, follow-up status

## 🚀 Getting Started (3 Steps)

### Step 1: Install Ollama (Local LLM)
```bash
# Download from https://ollama.ai
# Or on Linux:
curl https://ollama.ai/install.sh | sh

# Pull the lightweight Mistral 7B model:
ollama pull mistral

# Start the server:
ollama serve
```
Server runs on `http://localhost:11434`

### Step 2: Add Environment Variable
Add to `.env.local`:
```env
OLLAMA_API=http://localhost:11434/api/generate
```

### Step 3: Test It!
```bash
pnpm dev
# Go to any page and click the blue "Need Help?" button in the bottom-right
```

## 📁 File Structure Created

```
components/troubleshooting/
├── floating-ai-button.tsx       ← Shows on every page
├── troubleshooting-modal.tsx    ← User workflow (4 steps)
└── analytics-view.tsx           ← Admin dashboard table

app/api/troubleshooting/
├── generate/route.ts            ← Calls LLM, saves to DB
├── confirm/route.ts             ← User confirms prompt
└── mark-followed-up/route.ts    ← Admin marks issue resolved

app/admin/troubleshooting/
└── page.tsx                      ← Admin dashboard view

docs/
└── TROUBLESHOOTING_AI_SETUP.md   ← Detailed setup guide
```

## 🔄 How It Works

### User Flow
1. **Click** "Need Help?" button (auto-shows page context)
2. **Describe** their issue in plain text
3. **Review** AI-generated troubleshooting prompt
4. **Edit** (optional) if needed
5. **Confirm** - saved to database with email & timestamp

### Admin Flow
1. Visit `/admin/troubleshooting`
2. Filter by "Unfollowed Up" to see new issues
3. Investigate & reproduce
4. Deploy fix or update documentation
5. Add notes and mark "Followed Up"
6. Use patterns to identify systemic problems

## 🧠 AI Model Info

- **Model**: Mistral 7B (open-source)
- **Size**: ~4GB download
- **Speed**: ~1-3 seconds per prompt
- **Cost**: FREE (runs locally)
- **Fallback**: Rule-based prompt generation if Ollama unavailable

## 📝 Database Records

Each prompt stores:
```
{
  uuid: "...",
  user_email: "user@example.com",
  created_at: "2026-06-12T10:30:00Z",
  page_context: "Dashboard / Bank Transactions",
  original_description: "Export is taking too long",
  generated_prompt: "[AI analysis]",
  edited_prompt: "[User edits if any]",
  confirmed_at: "...",
  confirmed_by_user: true,
  is_followed_up: false,      ← Admin marks when handled
  follow_up_notes: "[What was done]",
  model_used: "mistral-7b"
}
```

## 🔍 Key Features

✅ **Auto Page Context** - Captures current page URL/name automatically
✅ **User Edits** - Users can modify AI prompt before confirming  
✅ **Admin Analytics** - See which issues aren't being followed up
✅ **Fallback Mode** - Works without Ollama (rule-based prompts)
✅ **Indexed Queries** - Fast lookups by email, date, follow-up status
✅ **Session-Based** - Only visible to authenticated users

## 🛠️ Troubleshooting

### "Need Help?" button not showing?
- Check user is logged in (`useSession()` returns data)
- Check `FloatingAIButton` is imported in `app/app-shell.tsx` ✅

### LLM analysis fails?
- System automatically falls back to rule-based prompts
- Check Ollama is running: `ollama serve`
- Verify `.env.local` has `OLLAMA_API` set

### Admin page shows no data?
- Verify users have clicked "Confirm" to save prompts
- Check database connection
- SQL: `SELECT COUNT(*) FROM troubleshooting_prompts;`

## 🚢 Deployment

### Environment Variables Needed
```env
# Development
OLLAMA_API=http://localhost:11434/api/generate

# Production (use hosted LLM if needed)
OLLAMA_API=https://api.your-provider.com/generate
```

### Database Permissions
- Table `troubleshooting_prompts` ✅ created
- All required indexes ✅ created
- Ready for Vercel/production

## 📚 Learn More

- [Full Setup Guide](./TROUBLESHOOTING_AI_SETUP.md)
- [Ollama Docs](https://github.com/ollama/ollama)
- [Mistral Model Card](https://huggingface.co/mistralai/Mistral-7B)

---

**Ready?** Just install Ollama, set `.env.local`, and click "Need Help?" on any page! 🎉
