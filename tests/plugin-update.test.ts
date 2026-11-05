import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

const updateSource = readFileSync("deploy/plugin-update.sh", "utf8");
const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;

function runUpdate(options: { failure?: boolean; noContainer?: boolean } = {}) {
  const directory = mkdtempSync(join(tmpdir(), "todo-plugin-update-"));
  const bin = join(directory, "bin");
  mkdirSync(bin);
  writeFileSync(join(directory, "compose.yaml"), "services: {}\n");
  writeFileSync(join(directory, ".env"), "AUTH_SECRET=secret-value\n");
  writeFileSync(join(bin, "flock"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
  writeFileSync(
    join(bin, "docker"),
    `#!/usr/bin/env node
const fs = require('node:fs');
const cp = require('node:child_process');
const args = process.argv.slice(2);
const kind = args[0] === 'run' ? 'recover' : args.join(' ');
fs.appendFileSync(process.env.UPDATE_LOG, kind + '\\n');
if (args[0] === 'compose' && args[1] === 'ps') {
  if (!process.env.NO_CONTAINER) console.log('container-id');
} else if (args[0] === 'inspect' && args[1] === '--format') {
  console.log('sha256:old-image');
} else if (args[0] === 'inspect') {
  console.log(JSON.stringify([{ Config: { Env: ['AUTH_SECRET=secret-value'] } }]));
} else if (args[0] === 'image') {
  console.log(JSON.stringify([{ Config: { Env: ['PATH=/usr/bin'] } }]));
} else if (args[0] === 'run') {
  const index = args.indexOf('-e');
  const result = cp.spawnSync(process.execPath, ['--input-type=module', ...args.slice(index)], { cwd: process.env.UPDATE_DIR, stdio: 'inherit' });
  process.exit(result.status ?? 1);
}
`,
    { mode: 0o755 },
  );
  const helper = `
import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
assert.equal(process.argv[1], 'recover');
assert.equal(process.argv[2], '0.3.2');
const container = JSON.parse(readFileSync('.plugin-config/container.json', 'utf8'));
const image = JSON.parse(readFileSync('.plugin-config/image.json', 'utf8'));
assert.equal(container[0].Config.Env[0], 'AUTH_SECRET=secret-value');
assert.equal(image[0].Config.Env[0], 'PATH=/usr/bin');
if (process.env.FAIL_RECOVERY) throw new Error('Recovery failed');
writeFileSync('recovered', process.argv[2]);
`;
  const source = updateSource
    .replace("d=/opt/ervisio-todo", `d=${quote(directory)}`)
    .replace("__PLUGIN_CONFIG_SOURCE__", quote(helper));
  const result = spawnSync("sh", ["-c", source, "update-docker", "0.3.2"], {
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${bin}:${process.env.PATH}`,
      UPDATE_LOG: join(directory, "calls"),
      UPDATE_DIR: directory,
      ...(options.failure ? { FAIL_RECOVERY: "1" } : {}),
      ...(options.noContainer ? { NO_CONTAINER: "1" } : {}),
    },
  });
  return {
    directory,
    result,
    calls: readFileSync(join(directory, "calls"), "utf8"),
    cleanup: () => rmSync(directory, { recursive: true, force: true }),
  };
}

test("Docker update preserves configuration using the current image before replacing the app", () => {
  const run = runUpdate();
  try {
    assert.equal(run.result.status, 0, run.result.stderr);
    assert.equal(
      readFileSync(join(run.directory, "recovered"), "utf8"),
      "0.3.2",
    );
    assert.match(
      run.calls,
      /image inspect sha256:old-image\nrecover\ncompose pull app\ncompose up -d\n$/,
    );
    assert.doesNotMatch(run.result.stdout + run.result.stderr, /secret-value/);
    assert.throws(() =>
      readFileSync(join(run.directory, ".plugin-config/container.json")),
    );
    assert.throws(() =>
      readFileSync(join(run.directory, ".plugin-config/image.json")),
    );
  } finally {
    run.cleanup();
  }
});

test("Docker update stops before pull or recreation when preserving configuration fails", () => {
  const run = runUpdate({ failure: true });
  try {
    assert.notEqual(run.result.status, 0);
    assert.doesNotMatch(run.calls, /compose (pull|up)/);
    assert.equal(
      readFileSync(join(run.directory, ".env"), "utf8"),
      "AUTH_SECRET=secret-value\n",
    );
    assert.throws(() =>
      readFileSync(join(run.directory, ".plugin-config/container.json")),
    );
  } finally {
    run.cleanup();
  }
});

test("Docker update refuses recreation when the existing container cannot be found", () => {
  const run = runUpdate({ noContainer: true });
  try {
    assert.notEqual(run.result.status, 0);
    assert.match(run.result.stdout, /No app container available/);
    assert.doesNotMatch(run.calls, /recover|compose (pull|up)/);
  } finally {
    run.cleanup();
  }
});
