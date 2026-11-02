"use client";

import { usePreferences } from "@/components/Preferences";
import { useCapabilities } from "@/hooks/useCapabilities";
import { apiFetch as fetch } from "@/lib/client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { readJsonResponse } from "@/lib/http/readJsonResponse";
import { AdminModal } from "@/components/admin/AdminModal";
import { AdminField } from "@/components/admin/AdminFields";
import { MarkdownEditor } from "@/components/admin/MarkdownEditor";
import { Icon } from "@/components/ui/Icon";
import {
  faStar,
  faPaperclip,
  faXmark,
  faSave,
  faPlus,
  faUser,
  faCalendar,
  faWandMagicSparkles,
  faTag,
} from "@fortawesome/free-solid-svg-icons";
import { faStar as faStarOutline } from "@fortawesome/free-regular-svg-icons";
import type { TodoTaskPlain, TodoAttachment, TodoTagPlain } from "@/types/todo";

const fetcher = (url: string) =>
  fetch(url)
    .then((r) => r.json())
    .then((r) => r.data ?? []);

interface AdminUser {
  _id: string;
  username: string;
  email: string;
}

interface Props {
  open: boolean;
  task: TodoTaskPlain | null;
  listId: string;
  /** null = root task */
  parentTaskId?: string | null;
  onClose: () => void;
  onSaved: () => void;
}

export function TaskDetailModal({
  open,
  task,
  listId,
  parentTaskId = null,
  onClose,
  onSaved,
}: Props) {
  const { aiEnabled } = useCapabilities();
  const { preferences } = usePreferences();
  const isNew = !task;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [isFavorite, setIsFavorite] = useState(false);
  const [assignedTo, setAssignedTo] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<TodoAttachment[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [generatePromptText, setGeneratePromptText] = useState("");

  // Users for assignment
  const { data: users } = useSWR<AdminUser[]>(
    open && listId ? `/api/admin/users?listId=${listId}` : null,
    fetcher,
    { revalidateOnFocus: false },
  );

  // Tags for this list
  const { data: availableTags } = useSWR<TodoTagPlain[]>(
    open && listId ? `/api/admin/todo/tags?listId=${listId}` : null,
    fetcher,
    { revalidateOnFocus: false },
  );

  useEffect(() => {
    if (!open) return;
    if (task) {
      setTitle(task.title);
      setDescription(task.description ?? "");
      setDueDate(task.dueDate ? task.dueDate.slice(0, 10) : "");
      setIsFavorite(task.isFavorite);
      setAssignedTo(task.assignedTo);
      setAttachments(task.attachments);
      setTags(task.tags ?? []);
    } else {
      setTitle("");
      setDescription("");
      setDueDate("");
      setIsFavorite(false);
      setAssignedTo([]);
      setAttachments([]);
      setTags([]);
    }
    setError(null);
  }, [open, task]);

  async function handleSave() {
    if (!title.trim()) {
      setError("Il titolo è obbligatorio");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        title: title.trim(),
        description,
        dueDate: dueDate || null,
        isFavorite,
        assignedTo,
        attachments,
        tags,
        listId,
        parentTaskId,
      };
      const url = task
        ? `/api/admin/todo/tasks/${task._id}`
        : "/api/admin/todo/tasks";
      const method = task ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await readJsonResponse<{ success: boolean; error?: string }>(
        res,
      );
      if (!json.success) throw new Error(json.error ?? "Errore");
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      files.forEach((file) => form.append("file", file));
      form.append("listId", listId);
      const res = await fetch("/api/admin/upload", {
        method: "POST",
        body: form,
      });
      const json = await readJsonResponse<{
        success: boolean;
        files?: TodoAttachment[];
        error?: string;
      }>(res);
      if (!res.ok || !json.success || !json.files)
        throw new Error(json.error || "Errore upload");
      const updated = [...attachments, ...json.files];
      if (task) {
        const response = await fetch(`/api/admin/todo/tasks/${task._id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ attachments: updated }),
        });
        if (!response.ok) {
          const body = await response.json();
          throw new Error(body.error);
        }
      }
      setAttachments(updated);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Errore upload");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleRemoveAttachment(url: string) {
    const updated = attachments.filter((a) => a.url !== url);
    setAttachments(updated);
    if (task) {
      await fetch(
        `/api/admin/todo/tasks/${task._id}/attachments?url=${encodeURIComponent(url)}`,
        {
          method: "DELETE",
        },
      );
    }
  }

  function toggleUser(uid: string) {
    setAssignedTo((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid],
    );
  }

  function openPromptModal() {
    setGeneratePromptText("");
    setError(null);
    setShowPromptModal(true);
  }

  async function handleGenerateAI() {
    if (!generatePromptText || !generatePromptText.trim()) return;

    setIsGeneratingAI(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/todo/ai-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: generatePromptText.trim(),
          listId,
          parentTaskId,
          currentTitle: title,
          currentDescription: description,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Errore AI");
      if (json.title) setTitle(json.title);
      if (json.description) setDescription(json.description);
      setShowPromptModal(false);
    } catch (e: any) {
      setError("Errore AI: " + e.message);
    } finally {
      setIsGeneratingAI(false);
    }
  }

  const isImage = (url: string) =>
    /\.(png|jpe?g|gif|webp|avif|svg)$/i.test(url);

  return (
    <>
      <AdminModal
        open={open}
        title={isNew ? "Nuova task" : "Modifica task"}
        presentation={preferences.editorLayout}
        onClose={onClose}
        size="xl"
      >
        <div className="space-y-5">
          {/* Title */}
          <AdminField
            label="Titolo"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Descrivi brevemente la task…"
            error={error && !title.trim() ? error : undefined}
          />

          {/* Description (markdown) */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="block text-xs font-medium text-ink-dim">
                Descrizione (E Titolo)
              </label>
              <button
                type="button"
                hidden={!aiEnabled}
                onClick={openPromptModal}
                disabled={isGeneratingAI}
                className={`flex items-center gap-1.5 text-xs font-medium text-blue-400 transition hover:text-blue-300 ${isGeneratingAI ? "opacity-50 cursor-not-allowed animate-pulse" : ""}`}
              >
                <Icon icon={faWandMagicSparkles} className="text-[10px]" />
                {isGeneratingAI ? "Generazione..." : "AI Genera/Refactor"}
              </button>
            </div>
            <MarkdownEditor
              value={description}
              onChange={setDescription}
              rows={8}
            />
          </div>

          {/* Row: due date + favorite */}
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-ink-dim">
                <Icon icon={faCalendar} className="text-[10px]" />
                Scadenza
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-lg border border-white/[0.04] bg-white/5 px-3 py-2 text-sm text-white focus:border-orange-500/30 focus:outline-none focus:ring-1 focus:ring-orange-500/15 [color-scheme:dark]"
              />
            </div>
            <button
              type="button"
              onClick={() => setIsFavorite((v) => !v)}
              className={`mb-0.5 flex items-center gap-2 rounded-lg border px-4 py-2 text-sm transition ${
                isFavorite
                  ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-400"
                  : "border-white/[0.04] bg-white/5 text-ink-dim hover:text-yellow-400"
              }`}
            >
              <Icon icon={isFavorite ? faStar : faStarOutline} />
              {isFavorite ? "Preferito" : "Aggiungi ai preferiti"}
            </button>
          </div>

          {/* Assigned users */}
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-ink-dim">
              <Icon icon={faUser} className="text-[10px]" />
              Assegna a
            </label>
            {!users ? (
              <p className="text-xs text-ink-faint">Caricamento utenti…</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {users.map((u) => {
                  const selected = assignedTo.includes(u._id);
                  return (
                    <button
                      key={u._id}
                      type="button"
                      onClick={() => toggleUser(u._id)}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                        selected
                          ? "bg-orange-500/20 text-orange-300 ring-1 ring-orange-500/40"
                          : "bg-white/5 text-ink-dim hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      {u.username || u.email}
                    </button>
                  );
                })}
                {users.length === 0 && (
                  <p className="text-xs text-ink-faint">
                    Nessun utente trovato
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Tags */}
          {availableTags && availableTags.length > 0 && (
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-ink-dim">
                <Icon icon={faTag} className="text-[10px]" />
                Tag
              </label>
              <div className="flex flex-wrap gap-2">
                {availableTags.map((tag) => {
                  const selected = tags.includes(tag._id);
                  return (
                    <button
                      key={tag._id}
                      type="button"
                      onClick={() =>
                        setTags((prev) =>
                          prev.includes(tag._id)
                            ? prev.filter((id) => id !== tag._id)
                            : [...prev, tag._id],
                        )
                      }
                      className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition ${
                        selected
                          ? "ring-1"
                          : "bg-white/5 text-ink-dim hover:bg-white/10 hover:text-white"
                      }`}
                      style={
                        selected
                          ? {
                              backgroundColor: tag.color + "25",
                              color: tag.color,
                            }
                          : undefined
                      }
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: tag.color }}
                      />
                      {tag.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Attachments */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-xs font-medium text-ink-dim">
                <Icon icon={faPaperclip} className="text-[10px]" />
                Allegati ({attachments.length})
              </label>
              <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/[0.04] px-3 py-1.5 text-xs text-ink-dim transition hover:bg-white/5 hover:text-white">
                {uploading ? (
                  <span className="h-3 w-3 animate-spin rounded-full border border-white/30 border-t-white" />
                ) : (
                  <Icon icon={faPlus} className="text-[10px]" />
                )}
                Aggiungi file
                <input
                  type="file"
                  multiple
                  accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.zip,.txt,.md"
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={uploading}
                />
              </label>
            </div>

            {attachments.length > 0 && (
              <div className="space-y-2 rounded-lg border border-white/[0.04] bg-white/3 p-2">
                {attachments.map((att) => (
                  <div
                    key={att.url}
                    className="flex items-center justify-between gap-2 rounded-md bg-white/5 px-3 py-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {isImage(att.url) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={att.url}
                          alt={att.name}
                          className="h-8 w-8 rounded object-cover shrink-0"
                        />
                      ) : (
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-white/10 text-xs text-ink-faint">
                          <Icon icon={faPaperclip} />
                        </div>
                      )}
                      <div className="min-w-0">
                        <a
                          href={att.url}
                          target="_blank"
                          rel="noreferrer"
                          className="block truncate text-xs text-white/80 hover:text-white"
                        >
                          {att.name}
                        </a>
                        <p className="text-xs text-ink-faint">{att.mimeType}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(att.url)}
                      className="shrink-0 rounded p-1 text-ink-faint transition hover:text-rose-400"
                    >
                      <Icon icon={faXmark} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Error */}
          {error && title.trim() && (
            <p className="rounded-lg bg-rose-500/[0.06] px-3 py-2 text-sm text-rose-400">
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-white/[0.04] px-4 py-2 text-sm text-ink-dim transition hover:bg-white/5 hover:text-white"
            >
              Annulla
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-orange-600 disabled:opacity-50"
            >
              {saving ? (
                <span className="h-3.5 w-3.5 animate-spin rounded-full border border-white/30 border-t-white" />
              ) : (
                <Icon icon={faSave} />
              )}
              {isNew ? "Crea task" : "Salva modifiche"}
            </button>
          </div>
        </div>
      </AdminModal>

      {/* Sub modal for AI Generation! Notice how we use a standard div or a basic modal since we can't nest native modals perfectly without Z-index control, but in this isolated context AdminModal sets standard Z-index layers.  We can safely use AdminModal with size="sm" */}
      <AdminModal
        open={showPromptModal}
        title="AI Genera / Refactor"
        onClose={() => setShowPromptModal(false)}
        size="md"
      >
        <div className="space-y-4 pt-2">
          <p className="text-sm text-white/80 mb-2">
            Cosa vuoi generare o migliorare con l&apos;AI?
          </p>
          <textarea
            value={generatePromptText}
            onChange={(e) => setGeneratePromptText(e.target.value)}
            placeholder="Es: Crea una task per aggiornare i pacchetti npm..."
            className="w-full rounded-lg border border-white/[0.04] bg-white/5 p-3 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            rows={3}
            autoFocus
          />
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setShowPromptModal(false)}
              disabled={isGeneratingAI}
              className="rounded-lg border border-white/[0.04] px-4 py-2 text-sm text-ink-dim transition hover:bg-white/5 hover:text-white"
            >
              Annulla
            </button>
            <button
              onClick={handleGenerateAI}
              disabled={!generatePromptText.trim() || isGeneratingAI}
              className="flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-600 disabled:opacity-50"
            >
              {isGeneratingAI ? (
                <span className="h-3.5 w-3.5 animate-spin rounded-full border border-white/30 border-t-white" />
              ) : (
                <Icon icon={faWandMagicSparkles} />
              )}
              Genera
            </button>
          </div>
        </div>
      </AdminModal>
    </>
  );
}
