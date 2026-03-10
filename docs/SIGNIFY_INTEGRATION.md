# Signify Integration

This project now includes a reusable Signify e-signature integration for sending documents to counteragents by email or phone.

## Added Components

- `lib/signify.ts`
  - Authenticates with Signify (`/authenticate`)
  - Uploads document (`/create-document`)
  - Starts signature workflow (`/set-document-details`)
  - Caches access token in-memory until expiry
- `app/api/integrations/signify/send/route.ts`
  - Trigger-oriented endpoint to send document to one counteragent
  - Can resolve recipient contact data from `counteragents` table by `counteragentUuid`
  - Supports `recipientContactType` = `EMAIL` or `MOBILE`
  - Optional protection via `SIGNIFY_TRIGGER_SECRET`

## Environment Variables

Add to `.env.local`:

- `SIGNIFY_BASE_URL=https://portal.signifyapp.com/integration-api/v2`
- `SIGNIFY_CLIENT_ID=...`
- `SIGNIFY_CLIENT_SECRET=...`
- `SIGNIFY_TRIGGER_SECRET=...` (optional but recommended)

## API Endpoint

`POST /api/integrations/signify/send`

Headers (optional security):

- `x-signify-trigger-secret: <SIGNIFY_TRIGGER_SECRET>`

Minimal request body:

```json
{
  "trigger": "counteragent-contract-created",
  "counteragentUuid": "<counteragent_uuid>",
  "documentName": "Service Agreement",
  "fileBase64": "<base64_pdf>",
  "recipientContactType": "EMAIL"
}
```

With mobile delivery:

```json
{
  "trigger": "counteragent-contract-created",
  "counteragentUuid": "<counteragent_uuid>",
  "documentName": "Service Agreement",
  "fileBase64": "<base64_pdf>",
  "recipientContactType": "MOBILE",
  "possibleSignatureTypes": ["SMS_OTP"]
}
```

Optional field positioning:

```json
{
  "signatureField": {
    "page": 1,
    "left": 100,
    "top": 100,
    "width": 200,
    "height": 60
  }
}
```

## Trigger Integration Pattern

For business triggers (examples):

- Contract generated for a counteragent
- Payment/statement approval required
- Onboarding workflow step reached

Call this endpoint from your trigger handler and pass:

- `counteragentUuid` (preferred)
- `documentName`
- `fileBase64`
- `recipientContactType`

The endpoint auto-resolves name/email/phone from `counteragents` if available.
