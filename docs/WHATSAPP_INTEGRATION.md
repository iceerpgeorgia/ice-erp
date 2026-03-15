# WhatsApp Integration (Cloud API)

This document explains how to connect WhatsApp to the app and route commands into:

- `POST /api/integrations/openclaw/command`

Implemented webhook route:

- `GET/POST /api/integrations/whatsapp/webhook`
- File: `app/api/integrations/whatsapp/webhook/route.ts`

## What It Supports

- Receives WhatsApp text messages
- Forwards message text as `transcript` to OpenClaw command endpoint
- Sends result summary back to user in WhatsApp
- Requires explicit confirmation prefix for write commands:
  - `confirm ...`
  - `დაადასტურე ...`

## Required Environment Variables

- `WHATSAPP_VERIFY_TOKEN` - used by Meta webhook verification
- `WHATSAPP_ACCESS_TOKEN` - Meta Cloud API access token
- `WHATSAPP_PHONE_NUMBER_ID` - phone number ID from Meta app
- `WHATSAPP_APP_SECRET` - optional but recommended for signature validation
- `WHATSAPP_APP_BASE_URL` - optional absolute app URL; if empty uses request origin
- `OPENCLAW_WEBHOOK_SECRET` - required to authorize internal call to OpenClaw route

## Meta Webhook Setup

1. Create or use existing Meta app with WhatsApp product.
2. Set callback URL to:
   - `https://<your-domain>/api/integrations/whatsapp/webhook`
3. Set verify token equal to `WHATSAPP_VERIFY_TOKEN`.
4. Subscribe to `messages` webhook field.

## Command Examples

Read commands:

- `მაჩვენე კონტრაგენტი სახელად ალფა`
- `იპოვე გადახდა a1b2c3_4d_9f8e7d`

Write command with confirmation:

- `confirm შექმენი კონტრაგენტი სახელად ბეტა საიდენტიფიკაციო ნომერი 12345678901`

Without `confirm`/`დაადასტურე`, write intent returns a safety prompt.

## Security Notes

- Keep `WHATSAPP_APP_SECRET` enabled to validate `x-hub-signature-256`.
- Keep `OPENCLAW_WEBHOOK_SECRET` strong and private.
- Do not expose admin intents without confirmation workflow.
