import Link from "next/link";
export default function NotFound() {
  return (
    <main className="center-message">
      <h1>Questo spazio non è disponibile</h1>
      <p>
        Controlla l’indirizzo o chiedi al proprietario di aggiungerti alla
        lista.
      </p>
      <Link href="/" className="button">
        Vai alle tue liste
      </Link>
    </main>
  );
}
