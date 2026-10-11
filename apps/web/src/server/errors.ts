/**
 * One error type for "you may not do that".
 *
 * Carrying the HTTP status on the error lets a route handler translate any
 * failure from the service layer into the right response without a chain of
 * instanceof checks, and keeps the message itself safe to show a user.
 */
export class AccessError extends Error {
  constructor(
    message: string,
    readonly status: number = 403,
  ) {
    super(message);
    this.name = "AccessError";
  }
}

/** Turn any thrown value into something safe to send back. */
export function toResponseError(e: unknown): { message: string; status: number } {
  if (e instanceof AccessError) return { message: e.message, status: e.status };
  if (e instanceof Error && e.name === "ZodError") {
    return { message: "Some of those values are not valid.", status: 400 };
  }
  // Never leak an internal message: it may contain a connection string.
  console.error("[layoutcraft] unhandled server error", e);
  return { message: "Something went wrong at our end. Please try again.", status: 500 };
}
