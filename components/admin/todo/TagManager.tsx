"use client";

import { apiFetch as fetch } from "@/lib/client";

import { useState } from "react";
import useSWR from "swr";
import { Icon } from "@/components/ui/Icon";
import {
  faPlus,
  faTrash,
  faPen,
  faCheck,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import type { TodoTagPlain } from "@/types/todo";

const fetcher = (url: string) =>
  fetch(url)
    .then((r) => r.json())
    .then((r) => r.data ?? []);

const PRESET_COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#f43f5e",
  "#14b8a6",
  "#a855f7",
  "#6366f1",
];

interface Props {
  listId: string;
  onClose: () => void;
}

export function TagManager({ listId, onClose }: Props) {
  const { data: tags, mutate } = useSWR<TodoTagPlain[]>(
    `/api/admin/todo/tags?listId=${listId}`,
    fetcher,
  );

  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PRESET_COLORS[5]);
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const response = await fetch("/api/admin/todo/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), color: newColor, listId }),
      });
      if (!response.ok) return;
      setNewName("");
      setNewColor(PRESET_COLORS[5]);
      mutate();
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Eliminare questo tag? Verrà rimosso da tutte le task."))
      return;
    await fetch(`/api/admin/todo/tags/${id}`, { method: "DELETE" });
    mutate();
  }

  function startEdit(tag: TodoTagPlain) {
    setEditingId(tag._id);
    setEditName(tag.name);
    setEditColor(tag.color);
  }

  async function handleSaveEdit() {
    if (!editingId || !editName.trim()) return;
    await fetch(`/api/admin/todo/tags/${editingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName.trim(), color: editColor }),
    });
    setEditingId(null);
    mutate();
  }

  return (
    <div className="space-y-4">
      {/* Existing tags */}
      <div className="space-y-2">
        {!tags ? (
          <p className="text-xs text-ink-faint">Caricamento…</p>
        ) : tags.length === 0 ? (
          <p className="text-xs text-ink-faint">Nessun tag creato</p>
        ) : (
          tags.map((tag) => (
            <div
              key={tag._id}
              className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2"
            >
              {editingId === tag._id ? (
                <>
                  <div className="flex flex-wrap gap-1">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setEditColor(c)}
                        className="h-5 w-5 rounded-full border-2 transition"
                        style={{
                          backgroundColor: c,
                          borderColor:
                            editColor === c ? "white" : "transparent",
                        }}
                      />
                    ))}
                  </div>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="flex-1 rounded border border-white/[0.04] bg-white/5 px-2 py-1 text-sm text-white focus:border-orange-500/30 focus:outline-none"
                    onKeyDown={(e) => e.key === "Enter" && handleSaveEdit()}
                  />
                  <button
                    onClick={handleSaveEdit}
                    className="rounded p-1 text-emerald-400 hover:text-emerald-300"
                  >
                    <Icon icon={faCheck} className="text-xs" />
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="rounded p-1 text-ink-faint hover:text-white"
                  >
                    <Icon icon={faXmark} className="text-xs" />
                  </button>
                </>
              ) : (
                <>
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span className="flex-1 text-sm text-white">{tag.name}</span>
                  <button
                    onClick={() => startEdit(tag)}
                    className="rounded p-1 text-ink-faint hover:text-white"
                  >
                    <Icon icon={faPen} className="text-xs" />
                  </button>
                  <button
                    onClick={() => handleDelete(tag._id)}
                    className="rounded p-1 text-ink-faint hover:text-rose-400"
                  >
                    <Icon icon={faTrash} className="text-xs" />
                  </button>
                </>
              )}
            </div>
          ))
        )}
      </div>

      {/* Create new tag */}
      <div className="space-y-2 rounded-lg border border-white/[0.04] bg-white/3 p-3">
        <p className="text-xs font-medium text-ink-dim">Nuovo tag</p>
        <div className="flex flex-wrap gap-1.5">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setNewColor(c)}
              className="h-6 w-6 rounded-full border-2 transition"
              style={{
                backgroundColor: c,
                borderColor: newColor === c ? "white" : "transparent",
              }}
            />
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nome tag…"
            maxLength={50}
            className="flex-1 rounded-lg border border-white/[0.04] bg-white/5 px-3 py-2 text-sm text-white placeholder:text-ink-faint focus:border-orange-500/30 focus:outline-none"
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
          <button
            onClick={handleCreate}
            disabled={creating || !newName.trim()}
            className="flex items-center gap-1.5 rounded-lg bg-orange-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-orange-600 disabled:opacity-50"
          >
            <Icon icon={faPlus} className="text-xs" />
            Crea
          </button>
        </div>
      </div>

      {/* Close button */}
      <div className="flex justify-end">
        <button
          onClick={onClose}
          className="rounded-lg border border-white/[0.04] px-4 py-2 text-sm text-ink-dim transition hover:bg-white/5 hover:text-white"
        >
          Chiudi
        </button>
      </div>
    </div>
  );
}
