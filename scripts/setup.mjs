import {
  existsSync,
  readFileSync,
  writeFileSync,
  appendFileSync,
  mkdirSync,
} from "node:fs";
import { randomBytes } from "node:crypto";
if (!existsSync(".env"))
  writeFileSync(".env", readFileSync(".env.example"), { mode: 0o600 });
let contents = readFileSync(".env", "utf8");
if (!/^AUTH_SECRET=.{32,}$/m.test(contents)) {
  contents = contents.replace(
    /^AUTH_SECRET=.*$/m,
    `AUTH_SECRET=${randomBytes(48).toString("base64url")}`,
  );
  writeFileSync(".env", contents, { mode: 0o600 });
}
mkdirSync("data", { recursive: true, mode: 0o700 });
console.log(
  "Configurazione locale pronta in .env; nessun account predefinito. Avvia npm run dev e registra il primo amministratore.",
);
