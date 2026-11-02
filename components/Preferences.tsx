"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  isHex,
  parseCustomThemes,
  resolveTheme,
  themeVariables,
  validThemeId,
  type ThemeDefinition,
} from "@/lib/themes";
import { translations } from "@/lib/i18n";
export type Locale = "it" | "en";
export type Preferences = {
  locale: Locale;
  theme: string;
  accentColor: string | null;
  customThemes: ThemeDefinition[];
  useListColors: boolean;
  editorLayout: "panel" | "dialog";
  sidebarCollapsed: boolean;
  view: "list" | "cards";
  sounds: boolean;
};
const defaults: Preferences = {
  locale: "it",
  theme: "system",
  accentColor: null,
  customThemes: [],
  useListColors: false,
  editorLayout: "panel",
  sidebarCollapsed: false,
  view: "list",
  sounds: true,
};
const Context = createContext({
  preferences: defaults,
  setPreference: (_patch: Partial<Preferences>) => {},
  t: (text: string) => text,
});
export function PreferencesProvider({
  children,
  initialLocale,
  initialTheme,
  initialAccentColor = null,
  initialCustomTheme,
}: {
  children: React.ReactNode;
  initialLocale: Locale;
  initialTheme?: Preferences["theme"];
  initialAccentColor?: string | null;
  initialCustomTheme?: ThemeDefinition;
}) {
  const router = useRouter(),
    [preferences, setState] = useState<Preferences>({
      ...defaults,
      locale: initialLocale,
      theme: initialTheme || "system",
      accentColor: initialAccentColor,
      customThemes: initialCustomTheme ? [initialCustomTheme] : [],
    });
  useEffect(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem("ervisio.preferences") || "{}",
      );
      setState((current) => ({
        ...current,
        customThemes: [
          ...parseCustomThemes(saved.customThemes),
          ...current.customThemes.filter(
            (theme) =>
              !parseCustomThemes(saved.customThemes).some(
                (savedTheme) => savedTheme.id === theme.id,
              ),
          ),
        ],
        accentColor: isHex(saved.accentColor)
          ? saved.accentColor
          : current.accentColor,
        useListColors: saved.useListColors === true,
        ...Object.fromEntries(
          Object.entries(saved).filter(([k, v]) =>
            k === "editorLayout"
              ? ["panel", "dialog"].includes(String(v))
              : k === "view"
                ? ["list", "cards"].includes(String(v))
                : ["sidebarCollapsed", "sounds"].includes(k) &&
                  typeof v === "boolean",
          ),
        ),
      }));
    } catch {}
  }, []);
  useEffect(() => {
    document.documentElement.lang = preferences.locale;
    const query = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const resolved = resolveTheme(
          preferences.theme,
          preferences.customThemes,
          query.matches,
        ),
        root = document.documentElement;
      root.dataset.theme = resolved.scheme;
      root.dataset.palette = resolved.id;
      root.style.colorScheme = resolved.scheme;
      for (const [key, value] of Object.entries(
        themeVariables(resolved, preferences.accentColor),
      ))
        root.style.setProperty(key, value);
    };
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, [
    preferences.locale,
    preferences.theme,
    preferences.accentColor,
    preferences.customThemes,
  ]);
  function setPreference(patch: Partial<Preferences>) {
    if (patch.theme && !validThemeId(patch.theme)) return;
    if (patch.customThemes)
      patch = { ...patch, customThemes: parseCustomThemes(patch.customThemes) };
    setState((current) => {
      const next = { ...current, ...patch };
      try {
        localStorage.setItem("ervisio.preferences", JSON.stringify(next));
      } catch {}
      const appearance = {
        accentColor: next.accentColor,
        customTheme: next.customThemes.find((theme) => theme.id === next.theme),
      };
      document.cookie = `ervisio-appearance=${encodeURIComponent(JSON.stringify(appearance))};path=/;max-age=31536000;samesite=lax${location.protocol === "https:" ? ";secure" : ""}`;
      for (const k of ["locale", "theme"] as const)
        if (patch[k])
          document.cookie = `ervisio-${k}=${next[k]};path=/;max-age=31536000;samesite=lax${location.protocol === "https:" ? ";secure" : ""}`;
      return next;
    });
    if (patch.locale) router.refresh();
  }
  const t = (text: string) =>
    preferences.locale === "it" ? text : translations[text] || text;
  return (
    <Context.Provider value={{ preferences, setPreference, t }}>
      {children}
    </Context.Provider>
  );
}
export const usePreferences = () => useContext(Context);
