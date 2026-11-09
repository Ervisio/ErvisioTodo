"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Side = "top" | "bottom" | "left" | "right";
const GAP = 8,
  EDGE = 8,
  DELAY = 350,
  OPPOSITE: Record<Side, Side> = {
    top: "bottom",
    bottom: "top",
    left: "right",
    right: "left",
  };

/** Picks the first side, starting from the preferred one, where the tip fits inside the viewport. */
function place(anchor: DOMRect, tip: DOMRect, preferred: Side) {
  const order = [
      preferred,
      OPPOSITE[preferred],
      ...(["top", "bottom", "right", "left"] as Side[]).filter(
        (s) => s !== preferred && s !== OPPOSITE[preferred],
      ),
    ],
    vw = innerWidth,
    vh = innerHeight;
  const fits = (side: Side) =>
    side === "top"
      ? anchor.top - GAP - tip.height >= EDGE
      : side === "bottom"
        ? anchor.bottom + GAP + tip.height <= vh - EDGE
        : side === "left"
          ? anchor.left - GAP - tip.width >= EDGE
          : anchor.right + GAP + tip.width <= vw - EDGE;
  const side = order.find(fits) ?? preferred,
    clamp = (v: number, size: number, max: number) =>
      Math.min(Math.max(v, EDGE), max - size - EDGE);
  if (side === "top" || side === "bottom")
    return {
      side,
      x: clamp(anchor.left + anchor.width / 2 - tip.width / 2, tip.width, vw),
      y: side === "top" ? anchor.top - GAP - tip.height : anchor.bottom + GAP,
    };
  return {
    side,
    x: side === "left" ? anchor.left - GAP - tip.width : anchor.right + GAP,
    y: clamp(anchor.top + anchor.height / 2 - tip.height / 2, tip.height, vh),
  };
}

/**
 * One tooltip for the whole app. Any element with data-tip="text" gets it on hover (after a short delay)
 * and on keyboard focus. data-tip-side sets the preferred side; the tip flips to wherever it fits and is
 * rendered in a portal so panels and scroll containers never clip it.
 */
export function TipLayer() {
  const [tip, setTip] = useState<{ text: string; el: HTMLElement } | null>(
      null,
    ),
    [pos, setPos] = useState<{ x: number; y: number; side: Side } | null>(null),
    box = useRef<HTMLDivElement>(null),
    timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    const target = (event: Event) =>
      (event.target as Element | null)?.closest?.<HTMLElement>("[data-tip]");
    const show = (el: HTMLElement, wait: number) => {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        const text = el.dataset.tip;
        if (text && el.isConnected) setTip({ text, el });
      }, wait);
    };
    const hide = () => {
      clearTimeout(timer.current);
      setTip(null);
      setPos(null);
    };
    const over = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      const el = target(event);
      if (el) show(el, DELAY);
    };
    const out = (event: PointerEvent) => {
      const el = target(event);
      if (el && !el.contains(event.relatedTarget as Node | null)) hide();
    };
    const focus = (event: FocusEvent) => {
      const el = target(event);
      if (el?.matches(":focus-visible")) show(el, 0);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") hide();
    };
    document.addEventListener("pointerover", over);
    document.addEventListener("pointerout", out);
    document.addEventListener("focusin", focus);
    document.addEventListener("focusout", hide);
    document.addEventListener("pointerdown", hide, true);
    document.addEventListener("scroll", hide, true);
    window.addEventListener("keydown", key);
    window.addEventListener("resize", hide);
    return () => {
      clearTimeout(timer.current);
      document.removeEventListener("pointerover", over);
      document.removeEventListener("pointerout", out);
      document.removeEventListener("focusin", focus);
      document.removeEventListener("focusout", hide);
      document.removeEventListener("pointerdown", hide, true);
      document.removeEventListener("scroll", hide, true);
      window.removeEventListener("keydown", key);
      window.removeEventListener("resize", hide);
    };
  }, []);
  useLayoutEffect(() => {
    if (!tip || !box.current) return;
    const side = (tip.el.dataset.tipSide as Side | undefined) ?? "top";
    setPos(
      place(
        tip.el.getBoundingClientRect(),
        box.current.getBoundingClientRect(),
        side in OPPOSITE ? side : "top",
      ),
    );
  }, [tip]);
  if (!tip) return null;
  return createPortal(
    <div
      ref={box}
      role="tooltip"
      className="tip"
      data-side={pos?.side}
      style={
        pos
          ? { left: pos.x, top: pos.y }
          : { left: 0, top: 0, visibility: "hidden" }
      }
    >
      {tip.text}
    </div>,
    document.body,
  );
}
