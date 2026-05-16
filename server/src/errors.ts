export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export function assertFound<T>(
  value: T | null | undefined,
  message = "Ресурс не найден",
): T {
  if (value === null || value === undefined) {
    throw new HttpError(404, message);
  }

  return value;
}
