export class QuickTaneError extends Error {
  statusCode?: number;
  body?: unknown;

  constructor(message: string, statusCode?: number, body?: unknown) {
    super(message);
    this.name = new.target.name;
    this.statusCode = statusCode;
    this.body = body;
  }
}

/** Invalid, missing, or suspended API key (401 / 403). */
export class AuthenticationError extends QuickTaneError {}
/** The requested run does not exist (404). */
export class NotFoundError extends QuickTaneError {}
/** The request was rejected (422). */
export class ValidationError extends QuickTaneError {}
/** Rate limit or plan concurrency limit exceeded (429). */
export class RateLimitError extends QuickTaneError {}
/** Any other non-2xx response. */
export class APIError extends QuickTaneError {}

const STATUS_MAP: Record<number, typeof QuickTaneError> = {
  401: AuthenticationError,
  403: AuthenticationError,
  404: NotFoundError,
  422: ValidationError,
  429: RateLimitError,
};

export async function raiseForStatus(response: Response): Promise<void> {
  if (response.status < 400) {
    return;
  }

  let body: unknown = null;
  let message = response.statusText || "Request failed";

  try {
    body = await response.clone().json();
    message =
      (body as { message?: string })?.message ??
      firstValidationError(body) ??
      message;
  } catch {
    try {
      body = await response.clone().text();
    } catch {
      /* ignore */
    }
  }

  const ErrorClass = STATUS_MAP[response.status] ?? APIError;
  throw new ErrorClass(message, response.status, body);
}

function firstValidationError(body: unknown): string | undefined {
  const errors = (body as { errors?: Record<string, unknown> })?.errors;
  if (errors && typeof errors === "object") {
    for (const messages of Object.values(errors)) {
      if (Array.isArray(messages) && messages.length > 0) {
        return String(messages[0]);
      }
    }
  }
  return undefined;
}
