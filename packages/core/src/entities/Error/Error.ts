/**
 * Domain errors.
 *
 * These are classes (not Zod) because error handling relies on `instanceof` checks:
 *   if (error instanceof NotFoundError) { ... }
 *
 * Thrown inside repositories and controllers.
 * Caught at the app boundary (server actions, CLI commands, API routes)
 * and translated into user-facing messages or HTTP status codes.
 *
 * Never import from repositories or controllers here —
 * entities are the innermost layer and depend on nothing.
 */

/** Thrown when a requested resource does not exist. */
export class NotFoundError extends Error {
  constructor(message = 'Not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

/** Thrown when an operation would create a duplicate (e.g. email already taken). */
export class ConflictError extends Error {
  constructor(message = 'Conflict') {
    super(message);
    this.name = 'ConflictError';
  }
}

/** Thrown when input fails validation at the app boundary. `fieldErrors` maps field names to their error messages. */
export class InputParseError extends Error {
  constructor(
    message = 'Invalid input',
    public readonly fieldErrors: Record<string, string[]> = {}
  ) {
    super(message);
    this.name = 'InputParseError';
  }
}

/**
 * Thrown when a user tries to perform an action they are not allowed to.
 * Intentionally provided as part of the domain-error vocabulary even though
 * no controller in the template throws it yet — forkers add it when wiring
 * role / permission / ownership checks above the controller layer.
 */
export class UnauthorizedError extends Error {
  constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

/** Thrown by repositories when a database or external service call fails. */
export class DatabaseOperationError extends Error {
  constructor(message = 'Database operation failed') {
    super(message);
    this.name = 'DatabaseOperationError';
  }
}
