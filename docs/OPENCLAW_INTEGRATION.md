# OpenClaw Voice Integration (MVP)

This document describes the voice-command integration path for OpenClaw so users can create records and retrieve data through voice chat.

## Goal

Allow users to speak commands like:

- "Find payment `a1b2c3_4d_9f8e7d`"
- "Show counteragent named Alpha"
- "Create counteragent named Beta LLC"

The app processes transcript/intents through a secure API and executes controlled DB operations.

## Implemented Endpoint

- `POST /api/integrations/openclaw/command`

Supported intents:

- `get_payments`
- `get_counteragents`
- `create_counteragent`

Route file:

- `app/api/integrations/openclaw/command/route.ts`

Mobile test page:

- `/voice` (mobile-first UI for speech-to-command)

## Security Model

The endpoint accepts either:

- trusted server-to-server requests via header `x-openclaw-secret` matching `OPENCLAW_WEBHOOK_SECRET`, or
- authenticated in-app user session (NextAuth).

Write protection:

- all write actions require `confirmWrite=true`.

This avoids accidental record creation from speech recognition noise.

## Request Format

```json
{
  "transcript": "create counteragent named Acme LLC",
  "intent": "create_counteragent",
  "parameters": {
    "name": "Acme LLC",
    "identificationNumber": "12345678901",
    "limit": 10
  },
  "confirmWrite": true
}
```

Notes:

- `intent` is optional if transcript clearly maps to a supported intent.
- `paymentId` must match `6_2_6` hex pattern (for example `a1b2c3_4d_9f8e7d`).
- Georgian command parsing is supported (see examples below).

## Georgian Voice Commands

Examples recognized by the endpoint parser:

- `"იპოვე გადახდა a1b2c3_4d_9f8e7d"`
- `"მაჩვენე კონტრაგენტი სახელად ალფა"`
- `"შექმენი კონტრაგენტი სახელად ბეტა"`
- `"შექმენი კონტრაგენტი სახელად ბეტა საიდენტიფიკაციო ნომერი 12345678901"`

Supported Georgian trigger words:

- Create: `შექმენი კონტრაგენტი`, `დაამატე კონტრაგენტი`
- Retrieve payment: `იპოვე გადახდა`, `მაჩვენე გადახდა`, `მომეცი გადახდა`
- Retrieve counteragent: `იპოვე კონტრაგენტი`, `მაჩვენე კონტრაგენტი`, `მომეცი კონტრაგენტი`

Name extraction supports both:

- English marker: `named ...`
- Georgian marker: `სახელად ...`

Identification number extraction supports:

- `საიდენტიფიკაციო ნომერი 12345678901`
- `inn 12345678901`

## Example Calls

Retrieve payments by ID:

```bash
curl -X POST http://localhost:3000/api/integrations/openclaw/command \
  -H "Content-Type: application/json" \
  -H "x-openclaw-secret: $OPENCLAW_WEBHOOK_SECRET" \
  -d '{
    "intent": "get_payments",
    "parameters": { "paymentId": "a1b2c3_4d_9f8e7d", "limit": 5 }
  }'
```

Create counteragent:

```bash
curl -X POST http://localhost:3000/api/integrations/openclaw/command \
  -H "Content-Type: application/json" \
  -H "x-openclaw-secret: $OPENCLAW_WEBHOOK_SECRET" \
  -d '{
    "intent": "create_counteragent",
    "parameters": { "name": "Acme LLC", "identificationNumber": "12345678901" },
    "confirmWrite": true
  }'
```

## OpenClaw Agent Prompt Guidance

Configure OpenClaw tool usage with these rules:

- For reads, call endpoint with `get_payments` or `get_counteragents`.
- For creates, ask confirmation first, then call with `confirmWrite=true`.
- Always pass structured `parameters` when available (avoid relying only on transcript parsing).

## WhatsApp Channel

If you want WhatsApp as the chat channel, use:

- `GET/POST /api/integrations/whatsapp/webhook`
- Setup guide: `docs/WHATSAPP_INTEGRATION.md`

This webhook receives WhatsApp text messages, forwards transcript commands to OpenClaw endpoint, and sends response summaries back to WhatsApp.

## Mobile Access Guidance

For phone usage in production:

- deploy app under HTTPS,
- open `/voice` on mobile browser,
- keep recognition language set to `ka-GE` for Georgian speech,
- rely on existing NextAuth login or call from OpenClaw server with `x-openclaw-secret`.

## Recommended Next Step (Production)

For full conversational reliability, add a second-stage tool-orchestrator:

- OpenClaw performs STT + intent extraction.
- App endpoint executes only validated tool calls.
- Optionally log voice tool actions to `AuditLog` with transcript and final structured command.
