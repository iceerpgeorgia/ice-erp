# Troubleshooting AI Feature Setup Guide

## Overview
This feature allows users to report issues and get AI-generated troubleshooting prompts. The system captures user feedback to help identify and fix gaps in the application.

## Architecture

### Database
- **Table**: `troubleshooting_prompts`
  - Stores user issues, AI-generated prompts, confirmations, and follow-up status
  - Admin-only analytics view at `/admin/troubleshooting`

### Components
1. **FloatingAIButton**: Persistent button on every page (bottom-right corner)
2. **TroubleshootingModal**: Multi-step workflow:
   - Step 1: User describes the issue
   - Step 2: AI generates a troubleshooting prompt
   - Step 3: User reviews and can edit the prompt
   - Step 4: Confirmation recorded to database

### API Routes
- `POST /api/troubleshooting/generate` - Generate prompt via LLM
- `POST /api/troubleshooting/confirm` - Save confirmed prompt
- `POST /api/troubleshooting/mark-followed-up` - Admin marks issue as resolved

## Setup Instructions

### Option 1: Using Ollama (Recommended - Free & Local)

#### 1. Install Ollama
- **Windows/Mac**: Download from [ollama.ai](https://ollama.ai)
- **Linux**: 
  ```bash
  curl https://ollama.ai/install.sh | sh
  ```

#### 2. Pull the Mistral 7B Model
```bash
ollama pull mistral
```
This downloads the lightweight 7B parameter model (~4GB).

#### 3. Start Ollama Server
```bash
ollama serve
```
Server runs on `http://localhost:11434` by default.

#### 4. Set Environment Variable
Add to `.env.local`:
```env
OLLAMA_API=http://localhost:11434/api/generate
```

### Option 2: Using Alternative Models

If you want to use a different model:

1. **Update `.env.local`**:
   ```env
   OLLAMA_API=http://your-api-endpoint
   ```

2. **Modify `app/api/troubleshooting/generate/route.ts`**:
   ```typescript
   const MODEL_NAME = 'your-model-name'; // Change from 'mistral:7b'
   ```

## Admin Analytics Dashboard

Access: `/admin/troubleshooting` (admin-only)

### Features
- **Dashboard Stats**: Total prompts, unfollowed-up issues, confirmed prompts
- **Filterable Table**: View all prompts with filters (all, unfollowed, confirmed)
- **Expandable Rows**: See full issue details, AI prompt, and user edits
- **Follow-up Management**: Mark issues as resolved with notes

### Workflow
1. Admin reviews unfollowed-up issues
2. Takes action (deploy fix, update documentation, etc.)
3. Adds follow-up notes and marks as "Followed Up"
4. Tracking helps identify systematic problems

## Usage Flow

### User Flow
1. User clicks "Need Help?" button on any page
2. Describes their issue in the modal
3. System sends description + page context to AI
4. AI generates structured troubleshooting prompt
5. User can edit before confirming
6. Prompt saved to database with timestamp and email

### Admin Flow
1. Check `/admin/troubleshooting` dashboard regularly
2. Filter by "Unfollowed Up" to see new issues
3. Investigate and reproduce issues
4. Deploy fixes or update documentation
5. Mark in dashboard with follow-up notes
6. Use patterns to improve app design/UX

## Data Collected

Each prompt record includes:
- `user_email`: Who reported the issue
- `created_at`: When reported
- `page_context`: What page/feature they were on
- `original_description`: Raw user feedback
- `generated_prompt`: AI analysis
- `edited_prompt`: User's edits (if any)
- `confirmed_at`: When user confirmed
- `is_followed_up`: Admin has actioned this?
- `follow_up_notes`: What was done

## Performance Notes

- **Ollama (Local)**: Fast (~1-3 sec per request), no API costs
- **Fallback (Rule-based)**: Instant, used if Ollama unavailable
- Database queries indexed on: `user_email`, `created_at`, `is_followed_up`

## Troubleshooting

### Ollama Not Responding
If the API returns an error:
1. Check Ollama server is running: `ollama serve`
2. Verify API endpoint in `.env.local`
3. System falls back to rule-based generation automatically

### Modal Not Appearing
- Verify `FloatingAIButton` is imported in `app-shell.tsx`
- Check user is authenticated (`useSession()`)
- Ensure NextAuth session is working

### Analytics Page Shows No Data
- Verify database connection
- Check `troubleshooting_prompts` table exists:
  ```sql
  SELECT * FROM troubleshooting_prompts LIMIT 1;
  ```

## Future Enhancements

1. **Slack Integration**: Notify admins of critical issues
2. **Pattern Analysis**: Group similar issues automatically
3. **Suggested Fixes**: Show common solutions
4. **Sentiment Analysis**: Identify frustrated users
5. **Knowledge Base**: Link prompts to documentation
6. **A/B Testing**: Test different AI models/prompts

## Deployment

### Production Considerations

1. **API Security**: Ensure `/api/troubleshooting/*` requires authentication
2. **Rate Limiting**: Add rate limits to prevent abuse
3. **Data Privacy**: Handle user emails according to privacy policy
4. **Monitoring**: Log Ollama failures to error tracking
5. **Scaling**: For high volume, consider hosted LLM API (Groq, Together.ai)

### Environment Setup
```bash
# Development (with Ollama locally)
OLLAMA_API=http://localhost:11434/api/generate

# Production (hosted LLM)
OLLAMA_API=https://api.your-llm-provider.com/generate
```

## See Also
- [Prisma Documentation](https://www.prisma.io/docs/)
- [Next.js API Routes](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
- [Ollama Documentation](https://github.com/ollama/ollama)
- [Mistral Model Card](https://huggingface.co/mistralai/Mistral-7B)
