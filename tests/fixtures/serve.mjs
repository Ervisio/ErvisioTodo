import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import net from "node:net";
import http from "node:http";
const directory = mkdtempSync(join(tmpdir(), "ervisio-e2e-")),
  messages = [];
const smtp = net.createServer((socket) => {
  socket.write("220 localhost ESMTP test\r\n");
  let buffer = "",
    collecting = false,
    message = "";
  socket.on("data", (data) => {
    buffer += data.toString();
    let newline;
    while ((newline = buffer.indexOf("\r\n")) >= 0) {
      const line = buffer.slice(0, newline);
      buffer = buffer.slice(newline + 2);
      if (collecting) {
        if (line === ".") {
          messages.push(message);
          message = "";
          collecting = false;
          socket.write("250 Message accepted\r\n");
        } else message += line + "\r\n";
        continue;
      }
      if (/^EHLO|^HELO/.test(line))
        socket.write("250-localhost\r\n250 SIZE 1048576\r\n");
      else if (line === "DATA") {
        collecting = true;
        socket.write("354 End with dot\r\n");
      } else if (line === "QUIT") {
        socket.end("221 Bye\r\n");
      } else socket.write("250 OK\r\n");
    }
  });
});
const inbox = http.createServer((req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(messages));
});
await Promise.all([
  new Promise((r) => smtp.listen(2527, "127.0.0.1", r)),
  new Promise((r) => inbox.listen(2528, "127.0.0.1", r)),
]);
const child = spawn(
  process.execPath,
  process.env.E2E_PRODUCTION
    ? [".next/standalone/server.js"]
    : [
        "node_modules/next/dist/bin/next",
        "dev",
        "--hostname",
        "127.0.0.1",
        "--port",
        "3137",
      ],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      HOSTNAME: "127.0.0.1",
      PORT: "3137",
      AUTH_SECRET: "e2e-only-secret-for-isolated-test-database-123456",
      AUTH_URL: "http://localhost:3137",
      DATA_DIR: directory,
      BASE_DOMAIN: "example.test",
      AUTH_COOKIE_DOMAIN: "",
      AUTH_LOCAL_ENABLED: "true",
      AUTH_GOOGLE_ENABLED: "false",
      AUTH_DISCORD_ENABLED: "false",
      AUTH_COGNITO_ENABLED: "false",
      REGISTRATION_ENABLED: "true",
      REQUIRE_EMAIL_VERIFICATION: "false",
      SMTP_URL: "smtp://127.0.0.1:2527/?ignoreTLS=true",
      MAIL_FROM: "Ervisio Test <noreply@example.test>",
      AI_API_KEY: "",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
);
let closing = false;
function close() {
  if (closing) return;
  closing = true;
  child.kill("SIGTERM");
  smtp.close();
  inbox.close();
  setTimeout(() => {
    rmSync(directory, { recursive: true, force: true });
    process.exit(0);
  }, 1500).unref();
}
process.on("SIGINT", close);
process.on("SIGTERM", close);
child.on("exit", close);
