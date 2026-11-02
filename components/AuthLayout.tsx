export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="auth-layout">
      <aside className="auth-story">
        <a href="/" className="wordmark">
          <span className="brand-symbol">✓</span>
          <span>
            ervis<span className="text-white/60">io</span>
            <small>Todo</small>
          </span>
        </a>
        <div className="story-copy">
          <div className="story-check">✓</div>
          <h2>
            Le idee trovano
            <br />
            il loro ordine.
          </h2>
          <p>
            Una lista per ogni progetto.
            <br />
            Tutti i dettagli al posto giusto.
          </p>
          <div className="story-list">
            <span>
              <i />
              Dare forma al prossimo progetto
            </span>
            <span>
              <i />
              Condividere il lavoro con il team
            </span>
            <span className="done">
              <i>✓</i>Fare spazio a nuove idee
            </span>
          </div>
        </div>
        <p className="story-footer">ErvisioTodo · Il tuo spazio di lavoro</p>
      </aside>
      <section className="auth-main">
        {children}
        <p className="auth-footnote">
          Le tue liste restano accessibili solo a te e ai membri che scegli.
        </p>
      </section>
    </main>
  );
}
