import { NextRequest, NextResponse } from 'next/server';

interface LogPayload {
  level: 'debug' | 'info' | 'warn' | 'error';
  component: string;
  message: string;
  data?: Record<string, unknown>;
  userAgent?: string;
  url?: string;
  timestamp?: string;
}

export async function POST(request: NextRequest) {
  try {
    const payload: LogPayload = await request.json();

    // In development, log to console
    if (process.env.NODE_ENV === 'development') {
      console.log(
        `[CLIENT-LOG] [${payload.level.toUpperCase()}] ${payload.component}: ${payload.message}`,
        payload.data,
      );
    }

    // In production, you could send to external service like:
    // - Sentry
    // - LogRocket
    // - Custom logging service
    // - CloudWatch
    if (process.env.SENTRY_DSN) {
      // Example: Send to Sentry
      // await sendToSentry(payload);
    }

    // Log critical errors
    if (payload.level === 'error') {
      console.error(
        `[CRITICAL-ERROR] ${payload.component}: ${payload.message}`,
        {
          ...payload.data,
          url: payload.url,
          userAgent: payload.userAgent,
          timestamp: payload.timestamp,
        },
      );
    }

    return NextResponse.json(
      { success: true, logged: payload.component },
      { status: 200 },
    );
  } catch (error) {
    console.error('[LOG-API] Failed to log:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to log' },
      { status: 500 },
    );
  }
}
