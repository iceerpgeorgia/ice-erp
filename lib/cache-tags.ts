// Centralized cache tag constants for Next.js `unstable_cache` / `revalidateTag`.
// Kept outside `app/api/**` so route files only export HTTP method handlers
// (Next.js rejects unrelated exports from `route.ts`).

export const PAYMENT_OPTIONS_TAG = 'payment-id-options';
