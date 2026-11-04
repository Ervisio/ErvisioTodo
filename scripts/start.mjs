import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { startPluginSocket } from "./plugin-socket.mjs";
if (!existsSync(".next/standalone/server.js"))
  throw new Error("Esegui npm run build prima di avviare il servizio");
process.env.DATA_DIR = resolve(process.env.DATA_DIR || "./data");
process.env.HOSTNAME = process.env.BIND_HOST || "127.0.0.1";
process.env.NODE_ENV = "production";
try {
  await startPluginSocket();
} catch (error) {
  console.error("Plugin socket disabled:", error.message);
  delete process.env.PLUGIN_SECRET;
}
await import("../.next/standalone/server.js");
