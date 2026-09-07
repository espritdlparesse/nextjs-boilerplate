export function clampText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

// Один хелпер на две формы ошибки: брошенный Error и результат Supabase,
// у которого message лежит на обычном объекте без прототипа Error.
export function errorMessage(error: unknown, fallback = "unknown error") {
  if (typeof error === "string" && error) return error;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message) return message;
  }
  return fallback;
}
