export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-md space-y-6 rounded-lg border border-border bg-card p-8 shadow-lg">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Access Denied
          </h1>
          <p className="text-muted-foreground">
            Your Google account is not authorized to access this application.
          </p>
        </div>
        
        <div className="space-y-4 text-sm text-muted-foreground">
          <p>
            Please contact your system administrator to request access.
          </p>
          <p>
            They will need to authorize your email address before you can sign in.
          </p>
        </div>

        <div className="pt-4">
          <a
            href="/"
            className="block w-full rounded-md bg-primary px-4 py-2 text-center text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Back to Home
          </a>
        </div>
      </div>
    </div>
  );
}
