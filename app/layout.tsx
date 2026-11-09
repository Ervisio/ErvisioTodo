import {
  resolveTheme,
  themeVariables,
  validThemeId,
  validCustomTheme,
  isHex,
  type ThemeDefinition,
} from "@/lib/themes";
import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { headers, cookies } from "next/headers";
import { brandingFor } from "@/lib/server/todo";
import { workspaceSettings } from "@/lib/server/settings";
import {
  PreferencesProvider,
  type Locale,
  type Preferences,
} from "@/components/Preferences";
import { Toasts } from "@/components/Toasts";
import { TipLayer } from "@/components/ui/TipLayer";
import localFont from "next/font/local";
import "./globals.css";
import "./shell.css";
import "./settings.css";
// Figtree (UI) and JetBrains Mono (code) are self-hosted variable fonts, as in the approved mockups.
const figtree = localFont({
  src: "./fonts/figtree-var.ttf",
  weight: "300 900",
  variable: "--font-sans",
  display: "swap",
});
const mono = localFont({
  src: "./fonts/jetbrains-mono-var.ttf",
  weight: "100 800",
  variable: "--font-mono",
  display: "swap",
});
export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const brand = brandingFor((await headers()).get("host") || ""),
    settings = workspaceSettings();
  return {
    title: brand ? `${brand.title} · ${settings.siteName}` : settings.siteName,
    description: "Attività, progetti e idee nel tuo spazio di lavoro.",
    icons: { icon: brand?.faviconUrl || "/favicon.svg" },
    robots: { index: false, follow: false },
  };
}
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const store = await cookies(),
    settings = workspaceSettings(),
    savedLocale = store.get("ervisio-locale")?.value,
    savedTheme = store.get("ervisio-theme")?.value;
  let initialAccentColor: string | null = null,
    initialCustomTheme: ThemeDefinition | undefined;
  try {
    const appearance = JSON.parse(
      decodeURIComponent(store.get("ervisio-appearance")?.value || "{}"),
    );
    if (isHex(appearance.accentColor))
      initialAccentColor = appearance.accentColor;
    if (validCustomTheme(appearance.customTheme))
      initialCustomTheme = appearance.customTheme;
  } catch {}
  const locale: Locale =
    savedLocale === "en" || savedLocale === "it"
      ? savedLocale
      : settings.defaultLocale;
  const theme: Preferences["theme"] = validThemeId(savedTheme)
    ? savedTheme
    : "system";
  return (
    <html
      lang={locale}
      className={`${figtree.variable} ${mono.variable}`}
      data-theme={
        theme === "system"
          ? undefined
          : resolveTheme(theme, initialCustomTheme ? [initialCustomTheme] : [])
              .scheme
      }
      data-palette={
        theme === "system"
          ? undefined
          : resolveTheme(theme, initialCustomTheme ? [initialCustomTheme] : [])
              .id
      }
      style={
        theme === "system"
          ? undefined
          : (themeVariables(
              resolveTheme(
                theme,
                initialCustomTheme ? [initialCustomTheme] : [],
              ),
              initialAccentColor,
            ) as CSSProperties)
      }
      suppressHydrationWarning
    >
      <body>
        <PreferencesProvider
          initialLocale={locale}
          initialTheme={theme}
          initialAccentColor={initialAccentColor}
          initialCustomTheme={initialCustomTheme}
        >
          {children}
          <Toasts />
          <TipLayer />
        </PreferencesProvider>
      </body>
    </html>
  );
}
