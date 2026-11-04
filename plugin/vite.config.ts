import { defineConfig } from "vite";
import { ervisioPlugin } from "@ervisio/plugin-sdk/vite";

// One self-contained ES module at dist/todo/index.js. React is never bundled: `react` and the JSX runtime are
// aliased by the preset to the SDK's shims, which forward to sdk.react (see @ervisio/plugin-sdk/react).
const config = ervisioPlugin({ id: "todo", entry: "src/index.ts" });

// This folder sits inside the ErvisioTodo app, which has its own postcss/Tailwind config. An inline (empty) PostCSS
// config stops Vite from picking that one up: the plugin's CSS is plain and must be shipped as written.
export default defineConfig({
  ...config,
  css: { ...config.css, postcss: { plugins: [] } },
});
