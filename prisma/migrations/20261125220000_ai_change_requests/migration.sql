-- Finished requests from the in-app AI chat (bug reports, improvements, upgrades), written in the
-- user's own language. Saved by POST /api/ai-chat/requests, emailed to admins, managed on
-- /admin/ai-requests (admin and system_admin).
CREATE TABLE IF NOT EXISTS ai_change_requests (
  id              bigserial PRIMARY KEY,
  requester_id    text,
  requester_email text,
  requester_name  text,
  pathname        text,
  type            text NOT NULL CHECK (type IN ('bug', 'improvement', 'upgrade')),
  language        text NOT NULL DEFAULT 'en' CHECK (language IN ('ka', 'en')),
  title           text NOT NULL,
  prompt          text NOT NULL,
  conversation    jsonb NOT NULL DEFAULT '[]'::jsonb,
  status          text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'done', 'rejected')),
  admin_note      text,
  emailed_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_change_requests_status_created
  ON ai_change_requests (status, created_at DESC);
