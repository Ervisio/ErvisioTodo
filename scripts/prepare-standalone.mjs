import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
const output = resolve(".next/standalone");
if (!existsSync(resolve(output, "server.js")))
  throw new Error("Output standalone non trovato");
mkdirSync(resolve(output, ".next"), { recursive: true });
cpSync("public", resolve(output, "public"), { recursive: true });
cpSync(".next/static", resolve(output, ".next/static"), { recursive: true });
// The deployable artifact receives configuration only at runtime.
for (const name of [
  ".env",
  ".env.local",
  ".env.production",
  ".env.production.local",
])
  rmSync(resolve(output, name), { force: true });
console.log("Output standalone completo di asset e senza file .env.");
