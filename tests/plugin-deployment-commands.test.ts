import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

const manifest = JSON.parse(
  readFileSync("plugin/plugin/manifest.json", "utf8"),
);
const initialEnv = `AUTH_SECRET=${"s".repeat(40)}\nAUTH_URL=https://todo.example.com\n`;

test("generated commands respect Ervisio argument limits and use only declared slots", () => {
  for (const command of manifest.capabilities.commands) {
    assert.ok(command.argv.length <= 64, command.name);
    for (const argument of command.argv) {
      assert.ok(Buffer.byteLength(argument) <= 1024, command.name);
      for (const match of argument.matchAll(/\{(\d+)\}/g))
        assert.ok(Number(match[1]) < (command.args?.length ?? 0), command.name);
    }
  }
});

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), "todo-config-commands-"));
  const bin = join(directory, "bin");
  mkdirSync(bin);
  writeFileSync(join(directory, ".env"), initialEnv, { mode: 0o600 });
  writeFileSync(join(directory, "compose.yaml"), "services: {}\n");
  writeFileSync(join(bin, "flock"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
  writeFileSync(
    join(bin, "docker"),
    `#!/usr/bin/env node
const fs = require('node:fs');
const cp = require('node:child_process');
const args = process.argv.slice(2);
if (args[0] === 'compose' && args[1] === 'ps') console.log('container-id');
else if (args[0] === 'inspect' && args[1] === '--format') console.log('sha256:old-image');
else if (args[0] === 'inspect') console.log(JSON.stringify([{Config:{Env:['AUTH_SECRET=${"s".repeat(40)}','AUTH_URL=https://live.example.com','SMTP_URL=smtps://private:password@mail.example.com']}}]));
else if (args[0] === 'image') console.log(JSON.stringify([{Config:{Env:['PATH=/usr/bin']}}]));
else if (args[0] === 'run') {
  const index = args.indexOf('-e');
  args[index + 1] = args[index + 1].replaceAll('"/deployment"', JSON.stringify(process.env.CONFIG_DIR));
  const result = cp.spawnSync(process.execPath, ['--input-type=module', ...args.slice(index)], {stdio:'inherit'});
  process.exit(result.status ?? 1);
} else if (args[0] === 'compose' && args[1] === 'config' && process.env.REJECT_COMPOSE) process.exit(1);
else if (args[0] === 'compose' && args[1] === 'up') fs.writeFileSync(process.env.CONFIG_DIR + '/applied', args.join(' '));
`,
    { mode: 0o755 },
  );
  const run = (name: string, id = "", reject = false) => {
    const command = manifest.capabilities.commands.find(
      (entry: { name: string }) => entry.name === name,
    );
    const offset = 4 + (command.args?.length ?? 0);
    const source = Buffer.from(command.argv.slice(offset).join(""), "base64")
      .toString("utf8")
      .replaceAll("/opt/ervisio-todo", directory);
    const argv = command.argv
      .slice(0, offset)
      .map((part: string) => (part === "{0}" ? id : part));
    argv.push(
      ...(Buffer.from(source)
        .toString("base64")
        .match(/.{1,1000}/g) ?? []),
    );
    return spawnSync(argv[0], argv.slice(1), {
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${bin}:${process.env.PATH}`,
        CONFIG_DIR: directory,
        REJECT_COMPOSE: reject ? "1" : "",
      },
    });
  };
  return {
    directory,
    run,
    cleanup: () => rmSync(directory, { recursive: true, force: true }),
  };
}

test("deployment commands recover live configuration, redact secrets, save and recreate", () => {
  const f = fixture();
  try {
    const read = f.run("configuration-read");
    assert.equal(read.status, 0, read.stderr);
    const doc = JSON.parse(read.stdout);
    assert.equal(doc.values.AUTH_URL, "https://live.example.com");
    assert.ok(doc.configured.includes("SMTP_URL"));
    assert.ok(!read.stdout.includes("private:password"));
    const id = "a".repeat(32);
    writeFileSync(
      join(f.directory, ".plugin-config/requests", `${id}.json`),
      JSON.stringify({
        revision: doc.revision,
        changes: {
          AUTH_URL: "https://new.example.com",
          SMTP_URL: "smtps://new:password@mail.example.com",
        },
      }),
    );
    const saved = f.run("configuration-save", id);
    assert.equal(saved.status, 0, saved.stderr);
    assert.ok(
      readFileSync(join(f.directory, ".env"), "utf8").includes(
        "https://new.example.com",
      ),
    );
    assert.ok(!saved.stdout.includes("new:password"));
    assert.equal(
      existsSync(join(f.directory, ".plugin-config/requests", `${id}.json`)),
      false,
    );
    const applied = f.run("configuration-apply");
    assert.equal(applied.status, 0, applied.stderr);
    assert.match(
      readFileSync(join(f.directory, "applied"), "utf8"),
      /--force-recreate --wait/,
    );
  } finally {
    f.cleanup();
  }
});

test("Compose rejection restores saved environment and does not recreate", () => {
  const f = fixture();
  try {
    const read = f.run("configuration-read");
    assert.equal(read.status, 0, read.stderr);
    const before = readFileSync(join(f.directory, ".env"), "utf8");
    const id = "b".repeat(32);
    writeFileSync(
      join(f.directory, ".plugin-config/requests", `${id}.json`),
      JSON.stringify({
        revision: JSON.parse(read.stdout).revision,
        changes: { AUTH_URL: "https://rejected.example.com" },
      }),
    );
    const saved = f.run("configuration-save", id, true);
    assert.equal(saved.status, 1);
    assert.match(saved.stderr, /previous settings restored/);
    assert.equal(readFileSync(join(f.directory, ".env"), "utf8"), before);
    assert.equal(existsSync(join(f.directory, "applied")), false);
  } finally {
    f.cleanup();
  }
});
