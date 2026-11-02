export async function readJsonResponse<T>(res: Response): Promise<T> {
  const text = await res.text();

  if (!text.trim()) {
    throw new Error(
      res.ok
        ? "Il server ha restituito una risposta vuota."
        : `Il server ha restituito una risposta vuota (${res.status}).`,
    );
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    const normalized = text
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (normalized) {
      throw new Error(normalized.slice(0, 220));
    }

    throw new Error(
      res.ok
        ? "Il server ha restituito una risposta non valida."
        : `Il server ha restituito una risposta non valida (${res.status}).`,
    );
  }
}
