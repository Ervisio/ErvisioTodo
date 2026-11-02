export async function apiFetch(input: RequestInfo | URL, init?: RequestInit) {
  try {
    const response = await globalThis.fetch(input, init);
    if (!response.ok) {
      const body = await response
        .clone()
        .json()
        .catch(() => ({}));
      if (typeof window !== "undefined")
        window.dispatchEvent(
          new CustomEvent("ervisio:error", {
            detail: body.error || "Operazione non riuscita",
          }),
        );
    }
    return response;
  } catch (e) {
    if (typeof window !== "undefined")
      window.dispatchEvent(
        new CustomEvent("ervisio:error", {
          detail: "Connessione interrotta. Controlla la rete e riprova.",
        }),
      );
    throw e;
  }
}
export async function dataFetcher(url: string) {
  const response = await apiFetch(url),
    body = await response.json();
  if (!response.ok) throw new Error(body.error);
  return body.data;
}
