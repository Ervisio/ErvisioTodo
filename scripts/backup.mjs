import { DatabaseSync, backup } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
const directory = resolve(process.env.DATA_DIR || "./data");
const destination = resolve(process.argv[2] || "./backups");
mkdirSync(destination, { recursive: true, mode: 0o700 });
const db = new DatabaseSync(resolve(directory, "ervisio.sqlite"), {
  readOnly: true,
});
const filename = resolve(
  destination,
  `ervisio-${new Date().toISOString().replace(/[:.]/g, "-")}.sqlite`,
);
await backup(db, filename);
db.close();
console.log(`Backup completo (database, account e allegati): ${filename}`);
