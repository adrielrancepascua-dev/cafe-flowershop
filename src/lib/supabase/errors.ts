/**
 * Supabase/PostgREST errors are not always `instanceof Error` in production
 * bundles, so UI catch blocks must normalize them before reading `.message`.
 */
export function extractSupabaseErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === 'object' && error !== null) {
    const record = error as Record<string, unknown>;
    if (typeof record.message === 'string' && record.message.trim()) {
      return record.message;
    }
    if (typeof record.error_description === 'string' && record.error_description.trim()) {
      return record.error_description;
    }
  }

  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  return fallback;
}

export function toServiceError(error: unknown, fallback: string): Error {
  return new Error(extractSupabaseErrorMessage(error, fallback));
}
