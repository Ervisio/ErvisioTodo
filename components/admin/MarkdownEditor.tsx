"use client";

/**
 * MarkdownEditor — textarea with a formatting toolbar.
 * Takes controlled value/onChange props (compatible with both plain useState
 * and react-hook-form Controller pattern).
 *
 * Pre-made component snippets (inserted at cursor):
 *   callout-info / callout-warning / callout-danger / callout-success
 *   imgcontainer  / imgrid / ytube / mp4
 */

import { useRef, useState, useEffect } from "react";
import { Icon } from "@/components/ui/Icon";
import {
  faBold,
  faItalic,
  faStrikethrough,
  faHeading,
  faCode,
  faList,
  faListOl,
  faQuoteLeft,
  faLink,
  faImage,
  faMinus,
  faTableCells,
  faChevronDown,
  faChevronUp,
} from "@fortawesome/free-solid-svg-icons";

// ─── Snippet templates ────────────────────────────────────────────────────────

const SNIPPETS = {
  callout_info: `<div data-component="callout" data-type="info">
ℹ️ **Titolo** — Testo del callout informativo.
</div>`,
  callout_warning: `<div data-component="callout" data-type="warning">
⚠️ **Attenzione** — Testo dell'avviso.
</div>`,
  callout_danger: `<div data-component="callout" data-type="danger">
🚨 **Importante** — Testo di pericolo/errore.
</div>`,
  callout_success: `<div data-component="callout" data-type="success">
✅ **Ottimo** — Testo di successo o conferma.
</div>`,
  imgcontainer: `<div data-component="imgcontainer" data-caption="Didascalia opzionale">
![Testo alternativo](https://url-immagine.jpg)
</div>`,
  imgrid: `<div data-component="imgrid">
![](https://url-immagine-1.jpg)
![](https://url-immagine-2.jpg)
![](https://url-immagine-3.jpg)
</div>`,
  ytube: `<div data-component="ytube" data-id="VIDEO_ID"></div>`,
  mp4: `<div data-component="mp4" data-src="https://url/video.mp4"></div>`,
  table: `| Colonna 1 | Colonna 2 | Colonna 3 |
|-----------|-----------|-----------|
| Cella     | Cella     | Cella     |
| Cella     | Cella     | Cella     |`,
} as const;

// ─── Helper types ─────────────────────────────────────────────────────────────

interface MarkdownEditorProps {
  value: string;
  onChange: (val: string) => void;
  label?: string;
  error?: string;
  required?: boolean;
  placeholder?: string;
  rows?: number;
  className?: string;
  id?: string;
}

// ─── Toolbar button ───────────────────────────────────────────────────────────

function ToolbarBtn({
  title,
  onClick,
  children,
  active = false,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => {
        e.preventDefault(); // prevent textarea losing focus
        onClick();
      }}
      className={`flex h-7 w-7 items-center justify-center rounded text-xs transition-colors ${
        active
          ? "bg-accent/20 text-accent"
          : "text-ink-dim hover:bg-white/10 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return <div className="mx-1 h-5 w-px bg-white/10" />;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function MarkdownEditor({
  value,
  onChange,
  label,
  error,
  required,
  placeholder,
  rows = 6,
  className = "",
  id,
}: MarkdownEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [showComponents, setShowComponents] = useState(false);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setShowComponents(false);
      }
    }
    if (showComponents) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showComponents]);

  // ── Cursor helpers ──────────────────────────────────────────────────────────

  function wrapSelection(before: string, after: string = "") {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = value.slice(start, end);
    const replacement = selected || "testo";
    const newVal =
      value.slice(0, start) + before + replacement + after + value.slice(end);
    onChange(newVal);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(
        start + before.length,
        start + before.length + replacement.length,
      );
    });
  }

  function prefixLines(prefix: string) {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const before = value.slice(0, start);
    const lineStart = before.lastIndexOf("\n") + 1;
    const fullBefore = value.slice(0, lineStart);
    const textEnd = end === start ? start : end;
    const lines = value.slice(lineStart, textEnd).split("\n");
    const prefixed = lines.map((l) => prefix + l).join("\n");
    const newVal = fullBefore + prefixed + value.slice(textEnd);
    onChange(newVal);
    requestAnimationFrame(() => el.focus());
  }

  function insertBlock(snippet: string) {
    const el = textareaRef.current;
    if (!el) return;
    const pos = el.selectionEnd;
    const before = value.slice(0, pos);
    const after = value.slice(pos);
    const prefix = before.length > 0 && !before.endsWith("\n\n") ? "\n\n" : "";
    const suffix = after.length > 0 && !after.startsWith("\n") ? "\n\n" : "\n";
    const newVal = before + prefix + snippet + suffix + after;
    onChange(newVal);
    setShowComponents(false);
    requestAnimationFrame(() => el.focus());
  }

  // ── Snippet menu ─────────────────────────────────────────────────────────────

  const componentGroups = [
    {
      label: "Callout",
      items: [
        { key: "callout_info", label: "ℹ️ Info" },
        { key: "callout_warning", label: "⚠️ Avviso" },
        { key: "callout_danger", label: "🚨 Pericolo" },
        { key: "callout_success", label: "✅ Successo" },
      ],
    },
    {
      label: "Immagini",
      items: [
        { key: "imgcontainer", label: "🖼️ Immagine + didascalia" },
        { key: "imgrid", label: "⊞ Griglia immagini" },
      ],
    },
    {
      label: "Video",
      items: [
        { key: "ytube", label: "▶️ YouTube embed" },
        { key: "mp4", label: "🎬 Video MP4/WebM" },
      ],
    },
    {
      label: "Altro",
      items: [{ key: "table", label: "⊞ Tabella" }],
    },
  ] as const;

  return (
    <div className={`space-y-1 ${className}`}>
      {/* Label */}
      {label && (
        <label className="block text-xs font-medium text-ink-dim" htmlFor={id}>
          {label}
          {required && <span className="ml-1 text-rose-400">*</span>}
        </label>
      )}

      {/* Editor container */}
      <div className="overflow-hidden rounded-lg border border-white/[0.04] focus-within:border-accent transition-colors">
        {/* ── Toolbar ──────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-0.5 border-b border-white/[0.04] bg-[var(--surface)] px-2 py-1.5">
          {/* Text formatting */}
          <ToolbarBtn
            title="Grassetto (Ctrl+B)"
            onClick={() => wrapSelection("**", "**")}
          >
            <Icon icon={faBold} />
          </ToolbarBtn>
          <ToolbarBtn
            title="Corsivo (Ctrl+I)"
            onClick={() => wrapSelection("*", "*")}
          >
            <Icon icon={faItalic} />
          </ToolbarBtn>
          <ToolbarBtn title="Barrato" onClick={() => wrapSelection("~~", "~~")}>
            <Icon icon={faStrikethrough} />
          </ToolbarBtn>

          <ToolbarDivider />

          {/* Headings */}
          <ToolbarBtn title="Titolo H2" onClick={() => prefixLines("## ")}>
            <span className="font-bold text-[10px] leading-none">H2</span>
          </ToolbarBtn>
          <ToolbarBtn title="Titolo H3" onClick={() => prefixLines("### ")}>
            <span className="font-bold text-[10px] leading-none">H3</span>
          </ToolbarBtn>
          <ToolbarBtn
            title="Separatore orizzontale"
            onClick={() => insertBlock("---")}
          >
            <Icon icon={faMinus} />
          </ToolbarBtn>

          <ToolbarDivider />

          {/* Code */}
          <ToolbarBtn
            title="Codice inline"
            onClick={() => wrapSelection("`", "`")}
          >
            <Icon icon={faCode} />
          </ToolbarBtn>
          {/* Heading icon for H2 label */}
          <ToolbarBtn title="Titolo generico" onClick={() => prefixLines("# ")}>
            <Icon icon={faHeading} />
          </ToolbarBtn>

          <ToolbarDivider />

          {/* Lists */}
          <ToolbarBtn
            title="Lista non ordinata"
            onClick={() => prefixLines("- ")}
          >
            <Icon icon={faList} />
          </ToolbarBtn>
          <ToolbarBtn title="Lista numerata" onClick={() => prefixLines("1. ")}>
            <Icon icon={faListOl} />
          </ToolbarBtn>
          <ToolbarBtn title="Citazione" onClick={() => prefixLines("> ")}>
            <Icon icon={faQuoteLeft} />
          </ToolbarBtn>

          <ToolbarDivider />

          {/* Link & Image */}
          <ToolbarBtn
            title="Link"
            onClick={() => wrapSelection("[", "](https://url)")}
          >
            <Icon icon={faLink} />
          </ToolbarBtn>
          <ToolbarBtn
            title="Immagine"
            onClick={() =>
              insertBlock("![Testo alternativo](https://url-immagine.jpg)")
            }
          >
            <Icon icon={faImage} />
          </ToolbarBtn>
          <ToolbarBtn
            title="Tabella"
            onClick={() => insertBlock(SNIPPETS.table)}
          >
            <Icon icon={faTableCells} />
          </ToolbarBtn>

          <ToolbarDivider />

          {/* Components dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                setShowComponents((v) => !v);
              }}
              className="flex h-7 items-center gap-1.5 rounded px-2 text-xs text-ink-dim hover:bg-white/10 hover:text-white transition-colors"
            >
              Componenti
              <Icon
                icon={showComponents ? faChevronUp : faChevronDown}
                className="text-[9px]"
              />
            </button>

            {showComponents && (
              <div className="absolute left-0 top-full z-50 mt-1 w-52 overflow-hidden rounded-lg border border-white/[0.04] bg-[var(--surface)] shadow-2xl">
                {componentGroups.map((group) => (
                  <div key={group.label}>
                    <p className="border-b border-white/5 px-3 py-1.5 text-[10px] font-semibold  text-ink-faint">
                      {group.label}
                    </p>
                    {group.items.map(({ key, label }) => (
                      <button
                        key={key}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          insertBlock(SNIPPETS[key]);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-ink-dim hover:bg-white/10 hover:text-white transition-colors"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Textarea ──────────────────────────────────────────────────────── */}
        <textarea
          ref={textareaRef}
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          required={required}
          className="block w-full resize-y bg-transparent px-4 py-3 font-mono text-sm text-white/80 placeholder-white/20 outline-none"
          spellCheck={false}
        />
      </div>

      {/* Markdown hint */}
      <p className="text-[10px] text-ink-faint">
        Markdown supportato — usa il menu <em>Componenti</em> per inserire
        callout, immagini, video e altro.
      </p>

      {/* Error */}
      {error && <p className="text-xs text-rose-400">{error}</p>}
    </div>
  );
}
