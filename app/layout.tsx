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
import localFont from "next/font/local";
import "./globals.css";
const manrope = localFont({
  src: [
    { path: "./fonts/manrope-400.ttf", weight: "400" },
    { path: "./fonts/manrope-500.ttf", weight: "500" },
    { path: "./fonts/manrope-600.ttf", weight: "600" },
  ],
  variable: "--font-manrope",
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
      className={manrope.variable}
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
        </PreferencesProvider>
      </body>
    </html>
  );
}
