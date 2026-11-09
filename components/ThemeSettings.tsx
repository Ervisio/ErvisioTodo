"use client";
import { useRef, useState, useEffect, type CSSProperties } from "react";
import { usePreferences } from "./Preferences";
import {
  THEME_PRESETS,
  ACCENT_SWATCHES,
  resolveTheme,
  themeVariables,
  themeContrastErrors,
  validCustomTheme,
  type ThemeDefinition,
  type ThemePalette,
} from "@/lib/themes";
import { ColorInput } from "./ColorInput";
import { Icon } from "./ui/Icon";
import {
  faCheck,
  faPlus,
  faPen,
  faCopy,
  faTrash,
  faDownload,
  faUpload,
  faRotateLeft,
} from "@fortawesome/free-solid-svg-icons";
const colorLabels: Record<keyof ThemePalette, string> = {
  canvas: "Sfondo pagina",
  sheet: "Pannelli e liste",
  surface: "Superfici secondarie",
  text: "Testo principale",
  muted: "Testo secondario",
  border: "Bordi",
  accent: "Colore accento",
  danger: "Errori",
  success: "Conferme",
};
export function ThemeSettings() {
  const { preferences, setPreference, t } = usePreferences(),
    [draft, setDraft] = useState<ThemeDefinition | null>(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    file = useRef<HTMLInputElement>(null),
    [systemDark, setSystemDark] = useState(false);
  useEffect(() => {
    const query = matchMedia("(prefers-color-scheme: dark)"),
      update = () => setSystemDark(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  const resolved = resolveTheme(
    preferences.theme,
    preferences.customThemes,
    systemDark,
  );
  function select(id: string) {
    setPreference({ theme: id, accentColor: null });
    setMessage("");
  }
  function edit(theme?: ThemeDefinition, duplicate = false) {
    const base = theme || resolved;
    setError("");
    setDraft({
      ...base,
      id: theme && !duplicate ? theme.id : `custom-${crypto.randomUUID()}`,
      name:
        theme && !duplicate
          ? theme.name
          : theme
            ? `${theme.name.slice(0, 40)} copia`
            : "Il mio tema",
      colors: {
        ...base.colors,
        accent: preferences.accentColor || base.colors.accent,
      },
    });
  }
  function save(event: React.FormEvent) {
    event.preventDefault();
    if (!draft) return;
    const errors = themeContrastErrors(draft.colors);
    if (errors.length) {
      setError(errors.join(" "));
      return;
    }
    if (!validCustomTheme(draft)) {
      setError("Controlla nome e colori del tema.");
      return;
    }
    const themes = [
      ...preferences.customThemes.filter((theme) => theme.id !== draft.id),
      { ...draft, name: draft.name.trim() },
    ];
    if (themes.length > 20) {
      setError("Puoi salvare fino a 20 temi personali.");
      return;
    }
    setPreference({ customThemes: themes, theme: draft.id, accentColor: null });
    setDraft(null);
    setError("");
    setMessage("Tema salvato.");
  }
  function remove(theme: ThemeDefinition) {
    if (!window.confirm(`Eliminare il tema “${theme.name}”?`)) return;
    setPreference({
      customThemes: preferences.customThemes.filter(
        (item) => item.id !== theme.id,
      ),
      ...(preferences.theme === theme.id
        ? { theme: "system", accentColor: null }
        : {}),
    });
    if (draft?.id === theme.id) setDraft(null);
  }
  function exportThemes() {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            { version: 1, themes: preferences.customThemes },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
    );
    a.download = "ervisio-todo-temi.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  async function importThemes(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    event.target.value = "";
    if (!selected) return;
    try {
      if (selected.size > 100000) throw Error("File troppo grande.");
      const data = JSON.parse(await selected.text());
      if (
        data.version !== 1 ||
        !Array.isArray(data.themes) ||
        !data.themes.length ||
        !data.themes.every(
          (theme: unknown) =>
            validCustomTheme(theme) &&
            themeContrastErrors(theme.colors).length === 0,
        )
      )
        throw Error("File tema non valido o contrasto insufficiente.");
      const themes = [
        ...preferences.customThemes.filter(
          (theme) =>
            !data.themes.some((item: ThemeDefinition) => item.id === theme.id),
        ),
        ...data.themes,
      ];
      if (themes.length > 20)
        throw Error("Puoi salvare fino a 20 temi personali.");
      setPreference({ customThemes: themes });
      setError("");
      setMessage("Temi importati.");
    } catch (error) {
      setError((error as Error).message);
    }
  }
  function card(theme: ThemeDefinition) {
    return (
      <button
        type="button"
        className={`theme-card${preferences.theme === theme.id ? " selected" : ""}`}
        key={theme.id}
        aria-label={`${t("Tema")}: ${t(theme.name)}`}
        aria-pressed={preferences.theme === theme.id}
        onClick={() => select(theme.id)}
      >
        <span
          className="theme-mini"
          style={themeVariables(theme) as CSSProperties}
          aria-hidden="true"
        >
          <i className="mini-sidebar">
            <em />
          </i>
          <span className="mini-panel">
            <i />
            <i />
            <i />
          </span>
        </span>
        <span className="theme-caption">
          <span>{t(theme.name)}</span>
          {preferences.theme === theme.id && <Icon icon={faCheck} />}
        </span>
      </button>
    );
  }
  return (
    <div className="theme-settings">
      <div className="settings-row">
        <div>
          <strong>{t("Tema")}</strong>
          <p>{t("Un solo tema per navigazione, liste e pannelli.")}</p>
        </div>
        <select
          aria-label={t("Tema")}
          value={preferences.theme}
          onChange={(event) => select(event.target.value)}
        >
          <option value="system">{t("Sistema")}</option>
          {[...THEME_PRESETS, ...preferences.customThemes].map((theme) => (
            <option value={theme.id} key={theme.id}>
              {t(theme.name)}
            </option>
          ))}
        </select>
      </div>
      <div className="theme-grid">{THEME_PRESETS.map(card)}</div>
      <div className="settings-row theme-accent-row">
        <div>
          <strong>{t("Colore accento")}</strong>
          <p>{t("Personalizza pulsanti, icone e indicatori del tema.")}</p>
        </div>
        <div className="accent-control">
          <div className="accent-swatches" aria-label={t("Campioni colore")}>
            {ACCENT_SWATCHES.map((color) => (
              <button
                type="button"
                key={color}
                aria-label={`${t("Accento")} ${color}`}
                aria-pressed={
                  (preferences.accentColor || resolved.colors.accent) === color
                }
                onClick={() => setPreference({ accentColor: color })}
                style={{ "--swatch": color } as CSSProperties}
              >
                <span />
              </button>
            ))}
          </div>
          <ColorInput
            label={t("Colore accento personale")}
            value={preferences.accentColor || resolved.colors.accent}
            onChange={(color) => setPreference({ accentColor: color })}
          />
          <button
            type="button"
            className="icon-button"
            aria-label={t("Ripristina accento del tema")}
            title={t("Ripristina accento del tema")}
            onClick={() => setPreference({ accentColor: null })}
          >
            <Icon icon={faRotateLeft} />
          </button>
        </div>
      </div>
      <label className="settings-row">
        <div>
          <strong>{t("Usa i colori delle liste")}</strong>
          <p>
            {t(
              "Sostituisce sfondo e accento delle attività con quelli configurati nella lista.",
            )}
          </p>
        </div>
        <input
          type="checkbox"
          className="switch"
          checked={preferences.useListColors}
          aria-label={t("Usa i colori delle liste")}
          onChange={(event) =>
            setPreference({ useListColors: event.target.checked })
          }
        />
      </label>
      <label className="settings-row">
        <div>
          <strong>{t("Mostra informazioni extra")}</strong>
          <p>
            {t(
              "Date, contatori, assegnatari e allegati accanto ad attività e liste.",
            )}
          </p>
        </div>
        <input
          type="checkbox"
          className="switch"
          checked={preferences.showExtras}
          aria-label={t("Mostra informazioni extra")}
          onChange={(event) =>
            setPreference({ showExtras: event.target.checked })
          }
        />
      </label>
      <label className="settings-row">
        <div>
          <strong>{t("Apertura della colonna liste")}</strong>
          <p>
            {t(
              "Sopra le attività le lascia ferme; Affianca le sposta per fare spazio.",
            )}
          </p>
        </div>
        <select
          value={preferences.sidebarMode}
          aria-label={t("Apertura della colonna liste")}
          onChange={(event) =>
            setPreference({
              sidebarMode: event.target.value as "overlay" | "push",
            })
          }
        >
          <option value="overlay">{t("Sopra le attività")}</option>
          <option value="push">{t("Affianca")}</option>
        </select>
      </label>
      <div className="theme-library-heading">
        <div>
          <h3>{t("I tuoi temi")}</h3>
          <p className="settings-help">
            {t("Crea, modifica e salva fino a 20 temi su questo dispositivo.")}
          </p>
        </div>
        <button type="button" className="button compact" onClick={() => edit()}>
          <Icon icon={faPlus} />
          {t("Crea tema")}
        </button>
      </div>
      {preferences.customThemes.length > 0 ? (
        <div className="theme-grid custom-theme-grid">
          {preferences.customThemes.map((theme) => (
            <div className="custom-theme" key={theme.id}>
              {card(theme)}
              <div className="theme-actions">
                <button
                  type="button"
                  aria-label={`${t("Modifica tema")}: ${theme.name}`}
                  title={t("Modifica tema")}
                  onClick={() => edit(theme)}
                >
                  <Icon icon={faPen} />
                </button>
                <button
                  type="button"
                  aria-label={`${t("Duplica tema")}: ${theme.name}`}
                  title={t("Duplica tema")}
                  onClick={() => edit(theme, true)}
                >
                  <Icon icon={faCopy} />
                </button>
                <button
                  type="button"
                  aria-label={`${t("Elimina tema")}: ${theme.name}`}
                  title={t("Elimina tema")}
                  onClick={() => remove(theme)}
                >
                  <Icon icon={faTrash} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="settings-help">
          {t(
            "Nessun tema personale. Parti da quello attuale e cambia i colori.",
          )}
        </p>
      )}
      {draft && (
        <form
          className="theme-editor"
          aria-label={t("Editor tema personalizzato")}
          onSubmit={save}
        >
          <div className="theme-editor-heading">
            <h3>{t("Tema personalizzato")}</h3>
            <span>{t("Anteprima")}</span>
          </div>
          <div className="theme-editor-content">
            <div>
              <label className="field">
                {t("Nome tema")}
                <input
                  aria-label={t("Nome tema")}
                  required
                  maxLength={50}
                  value={draft.name}
                  onChange={(event) =>
                    setDraft({ ...draft, name: event.target.value })
                  }
                />
              </label>
              <label className="field mt-4">
                {t("Modalità")}
                <select
                  value={draft.scheme}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      scheme: event.target.value as "light" | "dark",
                    })
                  }
                >
                  <option value="light">{t("Chiaro")}</option>
                  <option value="dark">{t("Scuro")}</option>
                </select>
              </label>
              <div className="theme-color-grid">
                {Object.entries(colorLabels).map(([key, label]) => (
                  <div className="theme-color" key={key}>
                    <span>{t(label)}</span>
                    <ColorInput
                      label={t(label)}
                      value={draft.colors[key as keyof ThemePalette]}
                      onChange={(color) =>
                        setDraft({
                          ...draft,
                          colors: { ...draft.colors, [key]: color },
                        })
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
            <div
              className="theme-live-preview"
              style={
                {
                  ...themeVariables(draft),
                  colorScheme: draft.scheme,
                } as CSSProperties
              }
            >
              <div className="preview-top">
                <Icon icon={faCheck} />
                <b>ErvisioTodo</b>
              </div>
              <div className="preview-content">
                <h4>{t("La tua prossima release")}</h4>
                <p>{t("Da completare")}</p>
                <div className="preview-task">
                  <i />
                  {t("Verificare la nuova interfaccia")}
                </div>
                <div className="preview-task">
                  <i />
                  {t("Pubblicare la documentazione")}
                </div>
                <button type="button" tabIndex={-1}>
                  <Icon icon={faPlus} />
                  {t("Nuova attività")}
                </button>
              </div>
            </div>
          </div>
          <div className="theme-editor-footer">
            <button
              type="button"
              className="button secondary"
              onClick={() => {
                setDraft(null);
                setError("");
              }}
            >
              {t("Annulla")}
            </button>
            <button type="submit" className="button">
              {t("Salva tema")}
            </button>
          </div>
        </form>
      )}
      <div className="theme-transfer">
        <input
          ref={file}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={importThemes}
        />
        <button
          type="button"
          className="button secondary compact"
          onClick={() => file.current?.click()}
        >
          <Icon icon={faUpload} />
          {t("Importa temi")}
        </button>
        <button
          type="button"
          className="button secondary compact"
          disabled={!preferences.customThemes.length}
          onClick={exportThemes}
        >
          <Icon icon={faDownload} />
          {t("Esporta temi")}
        </button>
      </div>
      {error && (
        <p className="error" role="alert">
          {t(error)}
        </p>
      )}
      {message && (
        <p className="saved-message" role="status">
          {t(message)}
        </p>
      )}
    </div>
  );
}
