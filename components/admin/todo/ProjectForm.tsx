"use client";
import { useState } from "react";
import useSWR from "swr";
import { dataFetcher } from "@/lib/client";
import { usePreferences } from "@/components/Preferences";
import type { TodoProjectPlain } from "@/types/todo";
export type ProjectPayload = {
  title: string;
  slug: string;
  description: string;
  iconValue: string;
  color: string;
  members: string[];
};
export function ProjectForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: TodoProjectPlain;
  onSubmit: (data: ProjectPayload) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = usePreferences(),
    [value, setValue] = useState<ProjectPayload>({
      title: initial?.title || "",
      slug: initial?.slug || "",
      description: initial?.description || "",
      iconValue: initial?.iconValue || "fa-solid fa-folder",
      color: initial?.color || "#b94406",
      members: initial?.members || [],
    }),
    [query, setQuery] = useState(""),
    [known, setKnown] = useState<{ _id: string; username: string }[]>([]),
    [matches, setMatches] = useState<{ _id: string; username: string }[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const { data: members } = useSWR<{ _id: string; username: string }[]>(
    initial ? `/api/admin/users?projectId=${initial._id}` : null,
    dataFetcher,
  );
  const people = [
    ...new Map([...(members || []), ...known].map((u) => [u._id, u])).values(),
  ];
  async function search() {
    try {
      const result = await dataFetcher(
        `/api/admin/users?q=${encodeURIComponent(query)}`,
      );
      setMatches(result);
      if (!result.length) setError(t("Nessun risultato"));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <form
      className="space-y-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          await onSubmit(value);
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="field">
        {t("Nome progetto")}
        <input
          required
          maxLength={200}
          value={value.title}
          onChange={(e) => {
            const title = e.target.value;
            setValue((current) => ({
              ...current,
              title,
              ...(!initial
                ? {
                    slug: title
                      .toLowerCase()
                      .normalize("NFD")
                      .replace(/[\u0300-\u036f]/g, "")
                      .replace(/[^a-z0-9]+/g, "-")
                      .replace(/^-|-$/g, "")
                      .slice(0, 63),
                  }
                : {}),
            }));
          }}
          placeholder="Es. Rilascio Ervisio"
        />
      </label>
      <label className="field">
        URL
        <input
          required
          maxLength={63}
          pattern="[a-z0-9]+(-[a-z0-9]+)*"
          value={value.slug}
          onChange={(e) => setValue({ ...value, slug: e.target.value })}
        />
        <small>/p/{value.slug || "nome-progetto"}</small>
      </label>
      <label className="field">
        {t("Descrizione")}
        <textarea
          value={value.description}
          maxLength={4000}
          onChange={(e) => setValue({ ...value, description: e.target.value })}
          rows={3}
        />
      </label>
      <div className="grid grid-cols-2 gap-4">
        <label className="field">
          {t("Icona")}
          <input
            value={value.iconValue}
            maxLength={64}
            required
            onChange={(e) => setValue({ ...value, iconValue: e.target.value })}
          />
        </label>
        <label className="field">
          {t("Colore")}
          <input
            type="color"
            value={value.color}
            onChange={(e) => setValue({ ...value, color: e.target.value })}
          />
        </label>
      </div>
      <fieldset>
        <legend className="mb-2 text-sm font-medium">{t("Membri")}</legend>
        <p className="settings-help">
          {t("I membri del progetto hanno accesso a tutte le sue liste.")}
        </p>
        <div className="mt-3 flex gap-2">
          <input
            aria-label={t("Username o email completi")}
            className="input min-w-0 flex-1"
            placeholder={t("Username o email completi")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button className="button secondary" type="button" onClick={search}>
            {t("Cerca")}
          </button>
        </div>
        {matches.map((u) => (
          <button
            className="button secondary mt-3"
            key={u._id}
            type="button"
            onClick={() => {
              setKnown([...known, u]);
              setValue({
                ...value,
                members: [...new Set([...value.members, u._id])],
              });
              setMatches([]);
              setQuery("");
            }}
          >
            {t("Aggiungi")} {u.username}
          </button>
        ))}
        <div className="mt-3 flex flex-wrap gap-3">
          {people.map((u) => (
            <label key={u._id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={value.members.includes(u._id)}
                onChange={() =>
                  setValue({
                    ...value,
                    members: value.members.includes(u._id)
                      ? value.members.filter((id) => id !== u._id)
                      : [...value.members, u._id],
                  })
                }
              />
              {u.username}
            </label>
          ))}
        </div>
      </fieldset>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-3">
        <button type="button" className="button secondary" onClick={onCancel}>
          {t("Annulla")}
        </button>
        <button disabled={busy} className="button">
          {t("Salva progetto")}
        </button>
      </div>
    </form>
  );
}
