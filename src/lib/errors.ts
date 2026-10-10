/**
 * A rule was broken in a way the user can fix ("that plan is full").
 * Models throw it; controllers turn it into a friendly message.
 */
export class DomainError extends Error {
  constructor(
    message: string,
    readonly code: string = "domain_error",
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export const isDomainError = (error: unknown): error is DomainError =>
  error instanceof DomainError;
