'use client';

import React, { ReactNode } from 'react';
import { useComponentLogger } from '@/lib/logging/component-logger';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  componentName: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log the error
    console.error(
      `[${this.props.componentName}] Error Boundary caught:`,
      error,
      errorInfo,
    );

    // Send to monitoring
    fetch('/api/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        level: 'error',
        component: `ErrorBoundary-${this.props.componentName}`,
        message: error.message,
        data: {
          stack: error.stack,
          componentStack: errorInfo.componentStack,
        },
        timestamp: new Date().toISOString(),
      }),
    }).catch(() => {
      // Silently fail
    });

    // Call optional callback
    this.props.onError?.(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div
            style={{
              padding: '20px',
              backgroundColor: '#fee',
              border: '1px solid #f00',
              borderRadius: '4px',
              color: '#c00',
              fontSize: '14px',
            }}
          >
            <strong>{this.props.componentName} Error:</strong>
            <p>{this.state.error?.message}</p>
          </div>
        )
      );
    }

    return this.props.children;
  }
}

/**
 * Functional wrapper for easier use with logging
 */
export function WithErrorBoundary({
  children,
  componentName,
  fallback,
}: {
  children: ReactNode;
  componentName: string;
  fallback?: ReactNode;
}) {
  return (
    <ErrorBoundary
      componentName={componentName}
      fallback={fallback}
      onError={(error, info) => {
        console.error(`[${componentName}] Boundary error:`, error, info);
      }}
    >
      {children}
    </ErrorBoundary>
  );
}
