# Deployment Log

## 2026-02-11
- Summary: Added refresh controls for projects lists and removed the payments export row cap by exporting from a full dataset fetch.
- Changes:
  - Projects pages: refresh button + no-store fetch on admin and dictionaries.
  - Payments: export fetches full dataset and applies filters/sort; API ignores non-numeric limit values.
- Commit: f49cad0 (app changes: 415df4a)
- Production: FAILED (https://ice-lxmivnkwc-iceerp.vercel.app) — build error: "pnpm prisma generate && pnpm build" exited with 1
