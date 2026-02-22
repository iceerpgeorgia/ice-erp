'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';

export const dynamic = 'force-dynamic';

function AuthErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  const errorMessages: Record<string, { title: string; description: string }> = {
    Configuration: {
      title: 'Server Configuration Error',
      description: 'There is a problem with the server configuration. Please contact support.',
    },
    AccessDenied: {
      title: 'Access Denied',
      description: 'You do not have permission to sign in. Please contact your administrator.',
    },
    Verification: {
      title: 'Verification Error',
      description: 'The sign-in link is no longer valid. It may have expired.',
    },
    OAuthSignin: {
      title: 'OAuth Sign-in Error',
      description: 'Error in constructing an authorization URL.',
    },
    OAuthCallback: {
      title: 'OAuth Callback Error',
      description: 'Error in handling the response from the OAuth provider.',
    },
    OAuthCreateAccount: {
      title: 'OAuth Account Creation Error',
      description: 'Could not create OAuth provider user in the database.',
    },
    EmailCreateAccount: {
      title: 'Email Account Creation Error',
      description: 'Could not create email provider user in the database.',
    },
    Callback: {
      title: 'Callback Error',
      description: 'Error in the OAuth callback handler route.',
    },
    OAuthAccountNotLinked: {
      title: 'Account Already Exists',
      description:
        'This email is already associated with another account. Please sign in using your original method.',
    },
    EmailSignin: {
      title: 'Email Sign-in Error',
      description: 'Check your email address and try again.',
    },
    CredentialsSignin: {
      title: 'Sign-in Failed',
      description: 'The credentials you provided are incorrect. Please try again.',
    },
    SessionRequired: {
      title: 'Session Required',
      description: 'You must be signed in to access this page.',
    },
    Default: {
      title: 'Authentication Error',
      description: 'An unexpected error occurred during authentication.',
    },
  };

  const errorInfo = errorMessages[error || 'Default'] || errorMessages.Default;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-6 rounded-lg border border-border bg-card p-8 shadow-lg">
        {/* Error Icon */}
        <div className="flex justify-center">
          <div className="rounded-full bg-destructive/10 p-3">
            <svg
              className="h-8 w-8 text-destructive"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
        </div>

        {/* Error Message */}
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {errorInfo.title}
          </h1>
          <p className="text-sm text-muted-foreground">{errorInfo.description}</p>
        </div>

        {/* Error Code */}
        {error && (
          <div className="rounded-md bg-muted p-3 text-center">
            <p className="text-xs text-muted-foreground">
              Error Code: <span className="font-mono font-medium">{error}</span>
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3">
          <Link
            href="/auth/signin"
            className="block w-full rounded-md bg-primary px-4 py-2 text-center text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Try Again
          </Link>
          <Link
            href="/"
            className="block w-full rounded-md border border-border px-4 py-2 text-center text-sm font-medium text-foreground hover:bg-accent"
          >
            Back to Home
          </Link>
        </div>

        {/* Help Text */}
        <div className="text-center text-xs text-muted-foreground">
          If the problem persists, please contact your system administrator.
        </div>
      </div>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    }>
      <AuthErrorContent />
    </Suspense>
  );
}
