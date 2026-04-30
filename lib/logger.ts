/**
 * Minimal structured logger.
 *
 * Goals:
 * - Drop-in replacement for ad-hoc `console.log` calls in API routes.
 * - JSON output in production so Vercel log drains can parse it.
 * - Pretty output in development.
 * - Respect `LOG_LEVEL` env (`debug | info | warn | error`).
 *
 * Intentionally dependency-free to avoid bundle bloat and to keep the
 * Vercel function size small. Swap for `pino` if/when richer features
 * (sampling, transports, redaction) are needed.
 */

type Level = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<Level, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const envLevel = (process.env.LOG_LEVEL?.toLowerCase() as Level | undefined) ?? "info";
const threshold = LEVEL_ORDER[envLevel] ?? LEVEL_ORDER.info;
const isProd = process.env.NODE_ENV === "production";

function emit(level: Level, msg: string, fields?: Record<string, unknown>) {
  if (LEVEL_ORDER[level] < threshold) return;
  const payload = {
    level,
    time: new Date().toISOString(),
    msg,
    ...(fields ?? {}),
  };
  const out = isProd ? JSON.stringify(payload) : `[${level}] ${msg}${fields ? ` ${JSON.stringify(fields)}` : ""}`;
  // eslint-disable-next-line no-console
  (level === "error" ? console.error : level === "warn" ? console.warn : console.log)(out);
}

export const logger = {
  debug: (msg: string, fields?: Record<string, unknown>) => emit("debug", msg, fields),
  info: (msg: string, fields?: Record<string, unknown>) => emit("info", msg, fields),
  warn: (msg: string, fields?: Record<string, unknown>) => emit("warn", msg, fields),
  error: (msg: string, fields?: Record<string, unknown>) => emit("error", msg, fields),
  /** Returns a child logger that prepends `prefix` to every message. */
  child: (prefix: string) => ({
    debug: (msg: string, fields?: Record<string, unknown>) => emit("debug", `[${prefix}] ${msg}`, fields),
    info: (msg: string, fields?: Record<string, unknown>) => emit("info", `[${prefix}] ${msg}`, fields),
    warn: (msg: string, fields?: Record<string, unknown>) => emit("warn", `[${prefix}] ${msg}`, fields),
    error: (msg: string, fields?: Record<string, unknown>) => emit("error", `[${prefix}] ${msg}`, fields),
  }),
};
