import { test } from "node:test";
import assert from "node:assert/strict";
import {
  THEME_PRESETS,
  themeVariables,
  themeContrastErrors,
  contrast,
  parseCustomThemes,
  resolveTheme,
  validCustomTheme,
} from "../lib/themes";
test("every preset has readable text on every app surface and a contrasting action label", () => {
  const ids = new Set();
  for (const theme of THEME_PRESETS) {
    assert.ok(!ids.has(theme.id));
    ids.add(theme.id);
    assert.deepEqual(themeContrastErrors(theme.colors), [], theme.name);
    const vars = themeVariables(theme);
    assert.ok(
      contrast(vars["--accent"], vars["--on-accent"]) >= 4.5,
      theme.name,
    );
    assert.ok(
      contrast(vars["--accent-ink"], theme.colors.sheet) >= 4.5,
      theme.name,
    );
  }
  assert.equal(resolveTheme("amoled").colors.canvas, "#000000");
  assert.equal(resolveTheme("amoled").colors.sheet, "#000000");
});
test("custom themes validate colors, names and IDs, reject CSS injection and survive resolution", () => {
  const theme = { ...THEME_PRESETS[1], id: "custom-example", name: "My theme" };
  assert.ok(validCustomTheme(theme));
  assert.equal(resolveTheme(theme.id, [theme]).id, theme.id);
  assert.equal(
    parseCustomThemes([
      theme,
      {
        ...theme,
        colors: { ...theme.colors, sheet: "url(https://bad.example)" },
      },
    ]).length,
    1,
  );
  assert.equal(validCustomTheme({ ...theme, id: "dark" }), false);
  assert.equal(validCustomTheme({ ...theme, name: " " }), false);
  assert.equal(
    parseCustomThemes(Array.from({ length: 25 }, () => theme)).length,
    20,
  );
  assert.equal(resolveTheme("missing").id, "light");
  assert.equal(resolveTheme("system", [], true).id, "dark");
  const vars = themeVariables(theme, "#00d4ff");
  assert.equal(vars["--accent"], "#00d4ff");
  assert.equal(vars["--accent-ch"], "0 212 255");
  assert.equal(vars["--on-accent"], "#111111");
  assert.equal(
    themeContrastErrors({ ...theme.colors, text: theme.colors.sheet }).length,
    1,
  );
});
test("color picker HSV conversion round trips exact HEX colors", async () => {
  const { hexToHsv, hsvToHex } = await import("../lib/themes");
  for (const hex of [
    "#000000",
    "#ffffff",
    "#ff0000",
    "#00ff00",
    "#0000ff",
    "#f49b65",
    "#00d4ff",
    "#b94406",
  ]) {
    const hsv = hexToHsv(hex);
    assert.equal(hsvToHex(hsv.h, hsv.s, hsv.v), hex);
  }
});
