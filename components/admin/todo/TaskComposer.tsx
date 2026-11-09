"use client";
import { useState } from "react";
import { faPlus, faSliders } from "@fortawesome/free-solid-svg-icons";
import { Icon } from "@/components/ui/Icon";
import { apiFetch } from "@/lib/client";
import { usePreferences } from "@/components/Preferences";
import { useSounds } from "@/hooks/useSounds";
import { useTaskActions } from "./taskActions";

/** Type a title and press Enter to add a task; the side button opens the full editor. */
export function TaskComposer({
  listId,
  onDetails,
}: {
  listId: string;
  onDetails: () => void;
}) {
  const { t } = usePreferences(),
    { playCreated } = useSounds(),
    { revalidate } = useTaskActions(),
    [title, setTitle] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const value = title.trim();
    if (!value || busy) return;
    setBusy(true);
    try {
      const response = await apiFetch("/api/admin/todo/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listId, title: value }),
      });
      if (response.ok) {
        setTitle("");
        playCreated();
        revalidate();
      }
    } catch {
      /* apiFetch already displays the connection error. */
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="composer" onSubmit={submit} data-busy={busy || undefined}>
      <Icon icon={faPlus} className="composer-plus" />
      <input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder={t("Aggiungi un'attività")}
        aria-label={t("Aggiungi un'attività")}
        maxLength={500}
        enterKeyHint="done"
      />
      <button
        type="button"
        className="ghost-icon"
        aria-label={t("Nuova task")}
        data-tip={t("Nuova attività con dettagli")}
        data-tip-side="top"
        onClick={onDetails}
      >
        <Icon icon={faSliders} />
      </button>
    </form>
  );
}
