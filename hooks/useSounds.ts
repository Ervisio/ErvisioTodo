"use client";

import { useCallback } from "react";
import { usePreferences } from "@/components/Preferences";

function playTone(
  frequency: number,
  duration: number,
  startTime: number,
  ctx: AudioContext,
  volume = 0.08,
): void {
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();
  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, startTime);
  gainNode.gain.setValueAtTime(volume, startTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  oscillator.start(startTime);
  oscillator.stop(startTime + duration);
}

function createContext(): AudioContext | null {
  try {
    return new (window.AudioContext || (window as any).webkitAudioContext)();
  } catch {
    return null;
  }
}

export function useSounds() {
  const { preferences } = usePreferences();
  /** Two ascending notes — task created */
  const playCreated = useCallback(() => {
    if (!preferences.sounds) return;
    const ctx = createContext();
    if (!ctx) return;
    const t = ctx.currentTime;
    playTone(523.25, 0.12, t, ctx); // C5
    playTone(659.25, 0.18, t + 0.1, ctx); // E5
    setTimeout(() => ctx.close(), 600);
  }, [preferences.sounds]);

  /** Three ascending notes + longer last — task completed */
  const playCompleted = useCallback(() => {
    if (!preferences.sounds) return;
    const ctx = createContext();
    if (!ctx) return;
    const t = ctx.currentTime;
    playTone(523.25, 0.1, t, ctx); // C5
    playTone(659.25, 0.1, t + 0.09, ctx); // E5
    playTone(783.99, 0.35, t + 0.18, ctx); // G5
    setTimeout(() => ctx.close(), 900);
  }, [preferences.sounds]);

  return { playCreated, playCompleted };
}
