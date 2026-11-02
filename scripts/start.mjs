import { existsSync } from "node:fs";
import { resolve } from "node:path";
if (!existsSync(".next/standalone/server.js"))
  throw new Error("Esegui npm run build prima di avviare il servizio");
process.env.DATA_DIR = resolve(process.env.DATA_DIR || "./data");
process.env.HOSTNAME = process.env.BIND_HOST || "127.0.0.1";
process.env.NODE_ENV = "production";
await import("../.next/standalone/server.js");
