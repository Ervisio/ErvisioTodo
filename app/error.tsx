"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="center-message">
      <h1>Non siamo riusciti a caricare lo spazio</h1>
      <p>Riprova tra qualche istante.</p>
      <button onClick={reset} className="button">
        Riprova
      </button>
    </main>
  );
}
