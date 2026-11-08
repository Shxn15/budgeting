import { DomainError } from '../../domain/operations';

/** Text for an error caught in a dialog. */
export function errorMessage(error: unknown): string {
  if (error instanceof DomainError) return error.message;
  const detail = error instanceof Error ? error.message : String(error);
  return `Das hat leider nicht geklappt: ${detail}`;
}
