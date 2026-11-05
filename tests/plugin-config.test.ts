import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { parseDocument, patchDocument, run } from "../deploy/plugin-config.mjs";

const requestId = "a".repeat(32);
const secret = "s".repeat(48);
const initial = `# persistent configuration\nAUTH_SECRET=${secret}\nAUTH_URL=https://original.example.test\n`;
function fixture(source = initial) {
  const directory = mkdtempSync(join(tmpdir(), "todo-plugin-config-"));
  const state = join(directory, ".plugin-config");
  mkdirSync(state);
  writeFileSync(join(directory, ".env"), source, { mode: 0o644 });
  return {
    directory,
    state,
    read: () => readFileSync(join(directory, ".env"), "utf8"),
    inspect: (name: string, env: string[]) =>
      writeFileSync(
        join(state, name),
        JSON.stringify([{ Config: { Env: env } }]),
      ),
    apply: (revision: string, changes: Record<string, unknown>) => {
      writeFileSync(
        join(state, "requests", `${requestId}.json`),
        JSON.stringify({ revision, changes }),
      );
      return run("apply", directory, requestId);
    },
    cleanup: () => rmSync(directory, { recursive: true, force: true }),
  };
}
function readConfiguration(directory: string) {
  const document = run("read", directory);
  assert.ok(
    document.revision !== undefined &&
      document.values !== undefined &&
      document.configured !== undefined &&
      document.secrets !== undefined,
  );
  return {
    revision: document.revision,
    values: document.values,
    configured: document.configured,
    secrets: document.secrets,
  };
}
const values = (source: string) =>
  Object.fromEntries(
    parseDocument(source).map(
      ({ key, value }: { key: string; value: string }) => [key, value],
    ),
  );

test("configuration migration imports live custom settings once and excludes image/system defaults", () => {
  const f = fixture();
  try {
    f.inspect("container.json", [
      "AUTH_URL=https://live.example.test",
      "AUTH_SECRET=" + secret,
      "CUSTOM_TOKEN=custom-secret",
      "PATH=/image/bin",
      "NODE_ENV=production",
      "DATA_DIR=/app/data",
      "PLUGIN_SECRET=transient",
      "PORT=3000",
      "ERVISIO_SOCKET_DIR=/run/socket",
    ]);
    f.inspect("image.json", ["PATH=/image/bin", "NODE_ENV=production"]);
    const first = readConfiguration(f.directory);
    assert.equal(first.values.AUTH_URL, "https://live.example.test");
    assert.ok(first.configured.includes("CUSTOM_TOKEN"));
    assert.doesNotMatch(
      f.read(),
      /PATH=|NODE_ENV=|DATA_DIR=|PLUGIN_SECRET=|PORT=|ERVISIO_SOCKET_DIR=/,
    );
    f.inspect("container.json", [
      "AUTH_URL=https://stale.example.test",
      "CUSTOM_TOKEN=stale",
    ]);
    f.apply(first.revision, { AUTH_URL: "https://saved.example.test" });
    assert.equal(
      readConfiguration(f.directory).values.AUTH_URL,
      "https://saved.example.test",
    );
    run("recover", f.directory, "0.3.2");
    assert.equal(values(f.read()).AUTH_URL, "https://saved.example.test");
    assert.equal(values(f.read()).ERVISIO_VERSION, "0.3.2");
    assert.equal(values(f.read()).CUSTOM_TOKEN, "custom-secret");
    assert.ok(f.read().startsWith("# persistent configuration\n"));
  } finally {
    f.cleanup();
  }
});

test("existing Compose installations keep the internal port fixed when changing the host port", () => {
  const f = fixture();
  try {
    writeFileSync(
      join(f.directory, "compose.yaml"),
      readFileSync("compose.yaml", "utf8").replace('      PORT: "3000"\n', ""),
    );
    const doc = readConfiguration(f.directory);
    f.apply(doc.revision, { PORT: "8051" });
    const config = spawnSync(
      "docker",
      ["compose", "config", "--format", "json"],
      { cwd: f.directory, encoding: "utf8" },
    );
    assert.equal(config.status, 0, config.stderr);
    const app = JSON.parse(config.stdout).services.app;
    assert.equal(app.environment.PORT, "3000");
    assert.equal(app.ports[0].published, "8051");
    assert.equal(app.ports[0].target, 3000);
  } finally {
    f.cleanup();
  }
});

test("configuration read masks built-in, transient and unknown secrets", () => {
  const f = fixture(
    initial +
      "PLUGIN_SECRET=transient-secret\nSMTP_URL=smtp://user:pass@mail.example.test\nCUSTOM_PASSWORD=unknown-secret\n",
  );
  try {
    const document = readConfiguration(f.directory);
    const output = JSON.stringify(document);
    for (const value of [
      secret,
      "transient-secret",
      "unknown-secret",
      "user:pass",
    ])
      assert.ok(!output.includes(value));
    for (const key of [
      "AUTH_SECRET",
      "PLUGIN_SECRET",
      "SMTP_URL",
      "CUSTOM_PASSWORD",
    ]) {
      assert.ok(document.secrets.includes(key));
      assert.ok(document.configured.includes(key));
      assert.equal(Object.hasOwn(document.values, key), false);
    }
  } finally {
    f.cleanup();
  }
});

test("configuration apply preserves literal dollars, quotes, slashes and multiline secrets", () => {
  const f = fixture();
  const value =
    "literal $HOME ${USER} $$ quote \" and ' slash \\ newline\nsecond\tline";
  try {
    const document = readConfiguration(f.directory);
    f.apply(document.revision, { CUSTOM_TOKEN: value });
    assert.equal(values(f.read()).CUSTOM_TOKEN, value);
    writeFileSync(
      join(f.directory, "compose.yaml"),
      "services:\n  app:\n    image: example/test\n    env_file: .env\n",
    );
    const result = spawnSync("docker", ["compose", "config", "--environment"], {
      cwd: f.directory,
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    assert.ok(result.stdout.includes(`CUSTOM_TOKEN=${value}\n`));
  } finally {
    f.cleanup();
  }
});

test("configuration update keeps private independent backups of the previous env", () => {
  const f = fixture();
  try {
    readConfiguration(f.directory);
    const before = f.read();
    run("recover", f.directory, "0.3.2");
    const document = readConfiguration(f.directory);
    f.apply(document.revision, { MAIL_FROM: "Tasks <tasks@example.test>" });
    const backups = readdirSync(f.directory).filter((name) =>
      name.startsWith(".env.bak-"),
    );
    assert.equal(backups.length, 2);
    assert.ok(
      backups.some(
        (name) => readFileSync(join(f.directory, name), "utf8") === before,
      ),
    );
    for (const name of [...backups, ".env"])
      assert.equal(statSync(join(f.directory, name)).mode & 0o777, 0o600);
  } finally {
    f.cleanup();
  }
});

test("configuration apply refuses stale revisions and always removes request secrets", () => {
  const f = fixture();
  try {
    const document = readConfiguration(f.directory);
    writeFileSync(join(f.directory, ".env"), f.read() + "# external edit\n");
    const before = f.read();
    assert.throws(
      () => f.apply(document.revision, { AUTH_SECRET: "n".repeat(48) }),
      /changed/,
    );
    assert.equal(f.read(), before);
    assert.equal(
      existsSync(join(f.state, "requests", `${requestId}.json`)),
      false,
    );
  } finally {
    f.cleanup();
  }
});

test("configuration rejects protected keys and invalid values without changing env", () => {
  const f = fixture();
  try {
    const document = readConfiguration(f.directory);
    for (const changes of [
      { NODE_ENV: "development" },
      { COMPOSE_FILE: "/tmp/compose.yml" },
      { DOCKER_HOST: "tcp://remote" },
      { BUILDX_BUILDER: "remote" },
      { PLUGIN_SOCKET: "/tmp/socket" },
      { ERVISIO_VERSION: "0.4.0" },
      { AUTH_SECRET: "short" },
      { AUTH_URL: "https://example.test/path" },
      { AUTH_URL: "https://name:secret@example.test" },
      { PORT: "70000" },
      { REQUIRE_EMAIL_VERIFICATION: "true" },
      { AUTH_GOOGLE_ENABLED: "yes" },
      { AUTH_COOKIE_DOMAIN: ".elsewhere.test" },
      { SMTP_URL: "https://mail.example.test" },
      { CUSTOM_TOKEN: "a\0b" },
      { CUSTOM_TOKEN: 42 },
      { "INVALID-KEY": "value" },
    ]) {
      const before = f.read();
      assert.throws(() => f.apply(document.revision, changes));
      assert.equal(f.read(), before);
      assert.equal(
        existsSync(join(f.state, "requests", `${requestId}.json`)),
        false,
      );
    }
    assert.throws(() => run("recover", f.directory, "latest"), /version/);
  } finally {
    f.cleanup();
  }
});

test("configuration migration refuses incomplete deployment credentials", () => {
  const f = fixture("AUTH_URL=https://example.test\n");
  try {
    assert.throws(() => run("recover", f.directory, "0.3.2"), /AUTH_SECRET/);
    assert.equal(existsSync(join(f.state, "migrated")), false);
  } finally {
    f.cleanup();
  }
});

test("document patch replaces duplicate assignments while preserving unrelated comments and values", () => {
  const source =
    '# keep\nAUTH_URL="https://old.test"\nCUSTOM=untouched # comment\nexport AUTH_URL=https://duplicate.test\n';
  const patched = patchDocument(source, {
    AUTH_URL: "https://new.test",
    EXTRA: "$TOKEN",
  });
  assert.equal(
    parseDocument(patched).filter(
      ({ key }: { key: string }) => key === "AUTH_URL",
    ).length,
    1,
  );
  assert.match(patched, /CUSTOM=untouched # comment/);
  assert.ok(patched.startsWith("# keep\n"));
  assert.equal(values(patched).EXTRA, "$TOKEN");
});

test("empty boolean selection restores installation defaults without discarding other empty settings", () => {
  const f = fixture(initial + "AUTH_GOOGLE_ENABLED=false\n");
  try {
    const document = readConfiguration(f.directory);
    f.apply(document.revision, { AUTH_GOOGLE_ENABLED: "", MAIL_FROM: "" });
    assert.equal(Object.hasOwn(values(f.read()), "AUTH_GOOGLE_ENABLED"), false);
    assert.equal(values(f.read()).MAIL_FROM, "");
  } finally {
    f.cleanup();
  }
});

test("configuration rejects malformed requests and unsafe request identifiers", () => {
  const f = fixture();
  try {
    readConfiguration(f.directory);
    for (const id of [
      undefined,
      "../request",
      "A".repeat(32),
      "a".repeat(31),
    ]) {
      assert.throws(() => run("apply", f.directory, id), /request id/);
    }
    for (const body of ["null", "[]", "{broken"]) {
      const requestPath = join(f.state, "requests", `${requestId}.json`);
      writeFileSync(requestPath, body);
      assert.throws(() => run("apply", f.directory, requestId));
      assert.equal(existsSync(requestPath), false);
      assert.equal(f.read(), initial);
    }
    assert.equal(statSync(join(f.state, "requests")).mode & 0o777, 0o700);
  } finally {
    f.cleanup();
  }
});
