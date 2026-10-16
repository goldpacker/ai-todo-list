export type TodoErrorCode =
  | "VALIDATION"
  | "NOT_FOUND"
  | "DUPLICATE_SOURCE"
  | "INVALID_TRANSITION"
  | "REPO_REQUIRED"
  | "CLAIM_CONFLICT"
  | "CONFLICT";

/** A domain error with a stable code, so agents can react without parsing messages. */
export class TodoError extends Error {
  readonly code: TodoErrorCode;
  readonly details?: unknown;

  constructor(code: TodoErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "TodoError";
    this.code = code;
    this.details = details;
  }

  toJSON() {
    return { code: this.code, message: this.message, details: this.details };
  }
}

export function notFound(what: string, id: number | string): TodoError {
  return new TodoError("NOT_FOUND", `${what} ${id} not found`, { what, id });
}
