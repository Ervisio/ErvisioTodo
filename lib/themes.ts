/** Personal UI themes. List branding is kept separate from these tokens. */
export type ThemePalette = {
  canvas: string;
  sheet: string;
  surface: string;
  text: string;
  muted: string;
  border: string;
  accent: string;
  danger: string;
  success: string;
};
export type ThemeDefinition = {
  id: string;
  name: string;
  scheme: "light" | "dark";
  colors: ThemePalette;
};
export const THEME_PRESETS: ThemeDefinition[] = [
  {
    id: "light",
    name: "Chiaro",
    scheme: "light",
    colors: {
      canvas: "#f4f6fa",
      sheet: "#ffffff",
      surface: "#e7ebf2",
      text: "#20252d",
      muted: "#5a6575",
      border: "#e1e6ee",
      accent: "#245ac2",
      danger: "#b3261e",
      success: "#226c48",
    },
  },
  {
    id: "dark",
    name: "Scuro",
    scheme: "dark",
    colors: {
      canvas: "#000000",
      sheet: "#121219",
      surface: "#262633",
      text: "#eeeef4",
      muted: "#a9abba",
      border: "#2c2c3a",
      accent: "#9ea8ff",
      danger: "#ffb4ab",
      success: "#87d5ad",
    },
  },
  {
    id: "amoled",
    name: "AMOLED",
    scheme: "dark",
    colors: {
      canvas: "#000000",
      sheet: "#000000",
      surface: "#121212",
      text: "#eeeeee",
      muted: "#aaaaaa",
      border: "#303030",
      accent: "#73c3fa",
      danger: "#ff8a91",
      success: "#84d6a2",
    },
  },
  {
    id: "tokyo-night",
    name: "Tokyo Night",
    scheme: "dark",
    colors: {
      canvas: "#16161e",
      sheet: "#1a1b26",
      surface: "#24283b",
      text: "#c0caf5",
      muted: "#9aa5ce",
      border: "#3b4261",
      accent: "#7aa2f7",
      danger: "#f7768e",
      success: "#9ece6a",
    },
  },
  {
    id: "github-dark",
    name: "GitHub Dark",
    scheme: "dark",
    colors: {
      canvas: "#010409",
      sheet: "#0d1117",
      surface: "#161b22",
      text: "#f0f6fc",
      muted: "#9198a1",
      border: "#3d444d",
      accent: "#58a6ff",
      danger: "#f85149",
      success: "#3fb950",
    },
  },
  {
    id: "dracula",
    name: "Dracula",
    scheme: "dark",
    colors: {
      canvas: "#21222c",
      sheet: "#282a36",
      surface: "#343746",
      text: "#f8f8f2",
      muted: "#b3b9d1",
      border: "#51556d",
      accent: "#bd93f9",
      danger: "#ff5555",
      success: "#50fa7b",
    },
  },
  {
    id: "catppuccin-mocha",
    name: "Catppuccin Mocha",
    scheme: "dark",
    colors: {
      canvas: "#181825",
      sheet: "#1e1e2e",
      surface: "#313244",
      text: "#cdd6f4",
      muted: "#a6adc8",
      border: "#45475a",
      accent: "#cba6f7",
      danger: "#f38ba8",
      success: "#a6e3a1",
    },
  },
  {
    id: "nord",
    name: "Nord",
    scheme: "dark",
    colors: {
      canvas: "#2e3440",
      sheet: "#3b4252",
      surface: "#434c5e",
      text: "#eceff4",
      muted: "#c0c9d8",
      border: "#69758a",
      accent: "#88c0d0",
      danger: "#f2a2aa",
      success: "#a3be8c",
    },
  },
  {
    id: "solarized-light",
    name: "Solarized Light",
    scheme: "light",
    colors: {
      canvas: "#eee8d5",
      sheet: "#fdf6e3",
      surface: "#eee8d5",
      text: "#36474f",
      muted: "#586e75",
      border: "#c8c1ae",
      accent: "#006d9d",
      danger: "#bd2929",
      success: "#536f00",
    },
  },
];
export const isHex = (value: unknown): value is string =>
  typeof value === "string" && /^#[a-f\d]{6}$/i.test(value);
export const rgbChannels = (hex: string) =>
  [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16));
export function luminance(hex: string) {
  const channels = rgbChannels(hex).map((value) => {
    const v = value / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
export function contrast(a: string, b: string) {
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
export function mix(a: string, b: string, weight: number) {
  const one = rgbChannels(a),
    two = rgbChannels(b);
  return (
    "#" +
    one
      .map((value, index) =>
        Math.round(value * weight + two[index] * (1 - weight))
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}
function readable(color: string, background: string, fallback: string) {
  return contrast(color, background) >= 4.5 ? color : fallback;
}
export function themeVariables(
  theme: ThemeDefinition,
  accentOverride?: string | null,
) {
  const c = theme.colors,
    accent = isHex(accentOverride) ? accentOverride : c.accent;
  return {
    "--canvas": c.canvas,
    "--sheet": c.sheet,
    "--surface": c.surface,
    "--fg": rgbChannels(c.text).join(" "),
    "--ink-dim": rgbChannels(readable(c.muted, c.sheet, c.text)).join(" "),
    "--ink-faint": rgbChannels(readable(c.muted, c.sheet, c.text)).join(" "),
    "--line": c.border,
    "--accent": accent,
    "--accent-ch": rgbChannels(accent).join(" "),
    "--accent-ink": readable(accent, c.sheet, c.text),
    "--accent-soft": mix(accent, c.sheet, 0.12),
    "--on-accent":
      contrast(accent, "#ffffff") >= contrast(accent, "#111111")
        ? "#ffffff"
        : "#111111",
    "--danger": readable(c.danger, c.sheet, c.text),
    "--success": readable(c.success, c.sheet, c.text),
  };
}
export function validCustomTheme(value: unknown): value is ThemeDefinition {
  if (!value || typeof value !== "object") return false;
  const v = value as ThemeDefinition;
  return (
    /^custom-[a-zA-Z0-9-]{1,64}$/.test(v.id) &&
    typeof v.name === "string" &&
    v.name.trim().length > 0 &&
    v.name.length <= 50 &&
    ["light", "dark"].includes(v.scheme) &&
    !!v.colors &&
    Object.keys(THEME_PRESETS[0].colors).every((key) =>
      isHex(v.colors[key as keyof ThemePalette]),
    )
  );
}
export function parseCustomThemes(value: unknown): ThemeDefinition[] {
  return Array.isArray(value)
    ? value.filter(validCustomTheme).slice(0, 20)
    : [];
}
export function resolveTheme(
  id: string,
  customThemes: ThemeDefinition[] = [],
  systemDark = false,
) {
  return id === "system"
    ? THEME_PRESETS[systemDark ? 1 : 0]
    : [...THEME_PRESETS, ...customThemes].find((theme) => theme.id === id) ||
        THEME_PRESETS[0];
}
export function validThemeId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    (value === "system" ||
      THEME_PRESETS.some((t) => t.id === value) ||
      /^custom-[a-zA-Z0-9-]{1,64}$/.test(value))
  );
}
export function themeContrastErrors(colors: ThemePalette) {
  const errors: string[] = [];
  if (
    contrast(colors.text, colors.sheet) < 4.5 ||
    contrast(colors.text, colors.canvas) < 4.5 ||
    contrast(colors.text, colors.surface) < 4.5
  )
    errors.push("Aumenta il contrasto tra testo e sfondi (almeno 4,5:1).");
  if (contrast(colors.muted, colors.sheet) < 4.5)
    errors.push("Aumenta il contrasto del testo secondario (almeno 4,5:1).");
  return errors;
}
export const ACCENT_SWATCHES = [
  "#b94406",
  "#ef5e67",
  "#d88a29",
  "#58b77b",
  "#53bccc",
  "#58a6ff",
  "#9b8afb",
  "#df8bc3",
];
export function hsvToHex(h: number, s: number, v: number) {
  const c = v * s,
    x = c * (1 - Math.abs(((h / 60) % 2) - 1)),
    m = v - c,
    rgb =
      h < 60
        ? [c, x, 0]
        : h < 120
          ? [x, c, 0]
          : h < 180
            ? [0, c, x]
            : h < 240
              ? [0, x, c]
              : h < 300
                ? [x, 0, c]
                : [c, 0, x];
  return (
    "#" +
    rgb
      .map((channel) =>
        Math.round((channel + m) * 255)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}
export function hexToHsv(hex: string) {
  const [r, g, b] = rgbChannels(hex).map((value) => value / 255),
    max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    delta = max - min;
  let h =
    delta === 0
      ? 0
      : max === r
        ? 60 * (((g - b) / delta) % 6)
        : max === g
          ? 60 * ((b - r) / delta + 2)
          : 60 * ((r - g) / delta + 4);
  if (h < 0) h += 360;
  return { h, s: max === 0 ? 0 : delta / max, v: max };
}
