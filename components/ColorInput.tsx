"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { isHex, hexToHsv, hsvToHex } from "@/lib/themes";
export function ColorInput({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  const [open, setOpen] = useState(false),
    [text, setText] = useState(value),
    root = useRef<HTMLSpanElement>(null),
    hue = useRef(hexToHsv(value).h);
  useEffect(() => {
    setText(value);
    const hsv = hexToHsv(value);
    if (hsv.s > 0 && hsv.v > 0) hue.current = hsv.h;
  }, [value]);
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
        if (!root.current?.contains(event.target as Node)) setOpen(false);
      },
      escape = (event: KeyboardEvent) => {
        if (event.key === "Escape") setOpen(false);
      };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  const hsv = hexToHsv(value),
    h = hsv.s === 0 || hsv.v === 0 ? hue.current : hsv.h;
  function position(event: React.PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect(),
      s = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      v =
        1 - Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
    onChange(hsvToHex(h, s, v));
  }
  return (
    <span className="color-input" ref={root}>
      <button
        type="button"
        className="color-trigger"
        aria-label={`Seleziona ${label}`}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        title="Apri selettore colore"
      >
        <i style={{ background: value }} />
      </button>
      <input
        type="text"
        aria-label={label}
        aria-invalid={text !== value && !isHex(text) ? true : undefined}
        value={text}
        maxLength={7}
        spellCheck={false}
        autoComplete="off"
        onChange={(event) => {
          const next = event.target.value;
          setText(next);
          if (isHex(next)) onChange(next.toLowerCase());
        }}
        onBlur={() => {
          if (!isHex(text)) setText(value);
        }}
      />
      {open && (
        <span
          role="dialog"
          aria-label={`${label}: selettore`}
          className="color-popover"
        >
          <span className="color-popover-heading">
            {label}
            <button
              type="button"
              aria-label="Chiudi selettore colore"
              onClick={() => setOpen(false)}
            >
              ×
            </button>
          </span>
          <div
            className="color-plane"
            role="slider"
            aria-label="Saturazione e luminosità"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(hsv.s * 100)}
            aria-valuetext={`Saturazione ${Math.round(hsv.s * 100)}%, luminosità ${Math.round(hsv.v * 100)}%`}
            tabIndex={0}
            style={{ "--hue-color": hsvToHex(h, 1, 1) } as CSSProperties}
            onPointerDown={(event) => {
              event.preventDefault();
              event.currentTarget.setPointerCapture(event.pointerId);
              position(event);
            }}
            onPointerMove={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId))
                position(event);
            }}
            onPointerUp={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId))
                event.currentTarget.releasePointerCapture(event.pointerId);
            }}
            onKeyDown={(event) => {
              if (
                ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(
                  event.key,
                )
              ) {
                event.preventDefault();
                onChange(
                  hsvToHex(
                    h,
                    Math.min(
                      1,
                      Math.max(
                        0,
                        hsv.s +
                          (event.key === "ArrowRight"
                            ? 0.02
                            : event.key === "ArrowLeft"
                              ? -0.02
                              : 0),
                      ),
                    ),
                    Math.min(
                      1,
                      Math.max(
                        0,
                        hsv.v +
                          (event.key === "ArrowUp"
                            ? 0.02
                            : event.key === "ArrowDown"
                              ? -0.02
                              : 0),
                      ),
                    ),
                  ),
                );
              }
            }}
          >
            <i
              style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }}
            />
          </div>
          <input
            className="color-hue"
            type="range"
            aria-label="Tonalità"
            min={0}
            max={359}
            value={Math.round(h)}
            onChange={(event) => {
              hue.current = Number(event.target.value);
              onChange(
                hsvToHex(Number(event.target.value), hsv.s || 1, hsv.v || 1),
              );
            }}
          />
          <span className="color-popover-value">
            <i style={{ background: value }} />
            {value.toUpperCase()}
          </span>
        </span>
      )}
    </span>
  );
}
