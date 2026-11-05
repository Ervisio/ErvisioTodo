"use client";

import { apiFetch as fetch } from "@/lib/client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import useSWR from "swr";
import { AdminField } from "@/components/admin/AdminFields";
import { ImageUploadField } from "@/components/admin/ImageUploadField";
import { ColorInput } from "@/components/ColorInput";
import { ListIcon } from "@/components/ui/ListIcon";
import type { TodoProjectPlain, TodoListPlain } from "@/types/todo";
const schema = z.object({
  title: z.string().min(1, "Nome obbligatorio").max(200),
  projectId: z.string().nullable(),
  iconType: z.enum(["fontawesome", "emoji", "image"]),
  iconValue: z.string().min(1, "Icona obbligatoria"),
  members: z.array(z.string()),
  aiContext: z.string(),
  slug: z
    .string()
    .min(1, "URL obbligatorio")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Usa lettere minuscole, numeri e trattini",
    ),
  subdomain: z.string(),
  accentColor: z.string(),
  backgroundColor: z.string(),
  faviconUrl: z.string(),
});
export type TodoListPayload = z.infer<typeof schema>;
type Member = { _id: string; username: string };
const fetcher = (url: string) =>
  fetch(url)
    .then((r) => r.json())
    .then((r) => r.data);
export function TodoListForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: Partial<TodoListPlain>;
  onSubmit: (data: TodoListPayload) => Promise<void>;
  onCancel: () => void;
}) {
  const [error, setError] = useState(""),
    [query, setQuery] = useState(""),
    [matches, setMatches] = useState<Member[]>([]),
    [extra, setExtra] = useState<Member[]>([]);
  const { data: config } = useSWR("/api/public", fetcher);
  const { data: projects = [] } = useSWR<TodoProjectPlain[]>(
    "/api/admin/todo/projects",
    fetcher,
  );
  const { data: existing } = useSWR<Member[]>(
    initial?._id
      ? `/api/admin/users?listId=${initial._id}`
      : "/api/admin/users",
    fetcher,
  );
  const {
    register,
    watch,
    setValue,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<TodoListPayload>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: initial?.title || "",
      projectId: initial?.projectId || null,
      iconType: initial?.iconType || "fontawesome",
      iconValue: initial?.iconValue || "fa-solid fa-list-check",
      members: initial?.members || [],
      aiContext: initial?.aiContext || "",
      slug: initial?.slug || "",
      subdomain: initial?.subdomain || "",
      accentColor: initial?.accentColor || "#b94406",
      backgroundColor: initial?.backgroundColor ?? "",
      faviconUrl: initial?.faviconUrl || "",
    },
  });
  const values = watch(),
    members = values.members;
  async function search() {
    const res = await fetch(`/api/admin/users?q=${encodeURIComponent(query)}`),
      body = await res.json();
    if (!res.ok) {
      setError(body.error);
      return;
    }
    setMatches(body.data);
    if (!body.data.length)
      setError(
        "Nessun utente con questo username o email. Deve prima registrarsi.",
      );
  }
  const users = [
    ...new Map([...(existing || []), ...extra].map((u) => [u._id, u])).values(),
  ];
  return (
    <form
      className="space-y-5"
      onSubmit={handleSubmit(async (data) => {
        setError("");
        try {
          await onSubmit(data);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Salvataggio non riuscito");
        }
      })}
    >
      <AdminField
        label="Nome lista"
        required
        error={errors.title?.message}
        {...register("title", {
          onChange: (e) => {
            if (!initial?._id)
              setValue(
                "slug",
                e.target.value
                  .toLowerCase()
                  .normalize("NFD")
                  .replace(/[\u0300-\u036f]/g, "")
                  .replace(/[^a-z0-9]+/g, "-")
                  .replace(/^-|-$/g, "")
                  .slice(0, 63),
              );
          },
        })}
        placeholder="Es. Progetti Ervisio"
      />
      <label className="field">
        Progetto
        <select
          value={values.projectId || ""}
          onChange={(e) => setValue("projectId", e.target.value || null)}
        >
          <option value="">Senza progetto</option>
          {projects.map((project) => (
            <option key={project._id} value={project._id}>
              {project.title}
            </option>
          ))}
        </select>
        <small>
          I membri del progetto hanno accesso alle liste al suo interno.
        </small>
      </label>
      <div className="grid grid-cols-2 gap-4">
        <label className="field">
          Tipo icona
          <select {...register("iconType")}>
            <option value="emoji">Emoji</option>
            <option value="fontawesome">FontAwesome</option>
            <option value="image">Immagine</option>
          </select>
        </label>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            {values.iconType !== "image" && (
              <AdminField
                label={
                  values.iconType === "emoji" ? "Emoji" : "Classe FontAwesome"
                }
                {...register("iconValue")}
                error={errors.iconValue?.message}
                placeholder={
                  values.iconType === "emoji" ? "📋" : "fa-solid fa-star"
                }
              />
            )}
          </div>
          <div className="pb-3 text-2xl">
            <ListIcon list={values} />
          </div>
        </div>
      </div>
      {values.iconType === "image" && (
        <ImageUploadField
          label="Icona lista"
          value={values.iconValue}
          onChange={(v) => setValue("iconValue", v)}
          subfolder="branding"
        />
      )}
      <div className="list-color-fields">
        <div className="field">
          <span>Colore principale</span>
          <ColorInput
            label="Colore principale"
            value={values.accentColor}
            onChange={(color) => setValue("accentColor", color)}
          />
        </div>
        <div className="field">
          <span>Sfondo</span>
          <label className="theme-background-toggle">
            <input
              type="checkbox"
              checked={!values.backgroundColor}
              onChange={(event) =>
                setValue(
                  "backgroundColor",
                  event.target.checked
                    ? ""
                    : getComputedStyle(document.documentElement)
                        .getPropertyValue("--sheet")
                        .trim(),
                )
              }
            />
            Usa lo sfondo del tema
          </label>
          {values.backgroundColor && (
            <ColorInput
              label="Sfondo"
              value={values.backgroundColor}
              onChange={(color) => setValue("backgroundColor", color)}
            />
          )}
        </div>
      </div>
      <ImageUploadField
        label="Favicon"
        value={values.faviconUrl}
        onChange={(v) => setValue("faviconUrl", v)}
        subfolder="branding"
        hint="PNG, ICO o immagine HTTPS. Se vuoto viene usata l’icona predefinita."
      />
      <div className="space-y-3 border-t border-white/10 pt-4">
        <AdminField
          label="URL della lista"
          {...register("slug")}
          error={errors.slug?.message}
          hint={`${config?.canonicalUrl || ""}/l/${values.slug || "nome-lista"}`}
        />
        <AdminField
          label="Sottodominio"
          {...register("subdomain")}
          disabled={!config?.baseDomain}
          placeholder="progetti"
          hint={
            config?.baseDomain
              ? `${values.subdomain || "progetti"}.${config.baseDomain} · Il DNS deve puntare a questa installazione.`
              : "Disponibile quando il gestore configura il dominio dell’installazione."
          }
        />
        {initial?.subdomain && (
          <div className="flex flex-wrap gap-2">
            {["standalone", "docker"].map((target) => (
              <button
                key={target}
                type="button"
                className="button secondary text-xs"
                onClick={async () => {
                  const r = await fetch(
                    `/api/admin/todo/lists/${initial._id}/caddy?target=${target}`,
                  );
                  const b = await r.json();
                  if (!r.ok) {
                    setError(b.error);
                    return;
                  }
                  const a = document.createElement("a");
                  a.href = URL.createObjectURL(
                    new Blob([b.data.content], { type: "text/plain" }),
                  );
                  a.download = `Caddyfile.${initial.subdomain}.${target}`;
                  a.click();
                  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
                }}
              >
                Scarica Caddyfile {target}
              </button>
            ))}
          </div>
        )}
      </div>
      <fieldset className="space-y-3 border-t border-white/10 pt-4">
        <legend className="text-sm font-medium">Condivisione</legend>
        <p className="text-xs text-white/55">
          Solo tu e i membri selezionati potete aprire la lista. I membri
          possono gestire attività e tag.
        </p>
        <div className="flex gap-2">
          <input
            aria-label="Username o email del membro"
            className="input min-w-0 flex-1"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Username o email completi"
          />
          <button type="button" className="button secondary" onClick={search}>
            Cerca
          </button>
        </div>
        {matches.map((u) => (
          <button
            key={u._id}
            type="button"
            className="button secondary"
            onClick={() => {
              setValue("members", [...new Set([...members, u._id])]);
              setExtra([...extra, u]);
              setMatches([]);
              setQuery("");
            }}
          >
            Aggiungi {u.username}
          </button>
        ))}
        <div className="flex flex-wrap gap-3">
          {users.map((u) => (
            <label key={u._id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={members.includes(u._id)}
                onChange={() =>
                  setValue(
                    "members",
                    members.includes(u._id)
                      ? members.filter((id) => id !== u._id)
                      : [...members, u._id],
                  )
                }
              />
              {u.username}
            </label>
          ))}
        </div>
      </fieldset>
      {config?.aiEnabled && (
        <label className="field">
          Contesto per l’assistente AI
          <textarea {...register("aiContext")} rows={3} />
        </label>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-3">
        <button type="button" className="button secondary" onClick={onCancel}>
          Annulla
        </button>
        <button className="button" disabled={isSubmitting}>
          {isSubmitting ? "Salvataggio…" : "Salva lista"}
        </button>
      </div>
    </form>
  );
}
