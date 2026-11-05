import fs from "node:fs";

const manifestPath = new URL("../plugin/plugin/manifest.json", import.meta.url);
const helper = fs.readFileSync(
  new URL("../deploy/plugin-config.mjs", import.meta.url),
  "utf8",
);
const quote = (value) => `'${value.replaceAll("'", "'\\''")}'`;
const embed = (source) =>
  source.replaceAll("__PLUGIN_CONFIG_SOURCE__", quote(helper));
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
function inlineCommand(command, source, unit) {
  const params = command.args?.map((_, i) => `{${i}}`) ?? [];
  const capture = params.map((_, i) => `p${i}=$1; shift;`).join(" ");
  const forward = params.map((_, i) => `"$p${i}"`).join(" ");
  const launch = unit
    ? `systemctl stop ${unit}.service 2>/dev/null || :; systemctl reset-failed ${unit}.service 2>/dev/null || :; exec systemd-run --unit=${unit} --remain-after-exit --setenv=PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin sh -c "$script" ${command.name} ${forward}`
    : `exec sh -c "$script" ${command.name} ${forward}`;
  command.argv = [
    "sh",
    "-c",
    `# ervisio-inline\nset -eu\n${capture}\nscript=$(printf '%s' "$@" | base64 -d)\n${launch}`,
    command.name,
    ...params,
    ...Buffer.from(source)
      .toString("base64")
      .match(/.{1,1000}/g),
  ];
}
const install = manifest.capabilities.commands.find(
  (command) => command.name === "install-docker",
);
const installSource = install.argv[2].startsWith("# ervisio-inline")
  ? Buffer.from(
      install.argv.slice(4 + install.args.length).join(""),
      "base64",
    ).toString("utf8")
  : install.argv[3];
inlineCommand(install, installSource, "ervisio-todo-install");
const update = manifest.capabilities.commands.find(
  (command) => command.name === "update-docker",
);
inlineCommand(
  update,
  embed(
    fs.readFileSync(
      new URL("../deploy/plugin-update.sh", import.meta.url),
      "utf8",
    ),
  ),
  "ervisio-todo-update",
);

const prelude = `set -eu
umask 077
d=/opt/ervisio-todo
cd "$d"
exec 9>.plugin-config.lock
flock -n 9 || { echo "Deployment configuration is busy; retry later" >&2; exit 1; }
mkdir -p .plugin-config/requests
chmod 700 .plugin-config .plugin-config/requests
container=$(docker compose ps --all --quiet app)
[ -n "$container" ] || { echo "No app container found" >&2; exit 1; }
image=$(docker inspect --format '{{.Image}}' "$container")
`;
const invoke = `docker run --rm --network none --user 0:0 --entrypoint node --mount "type=bind,src=$d,dst=/deployment" --workdir /deployment "$image" --input-type=module -e __PLUGIN_CONFIG_SOURCE__`;
const commands = [
  {
    name: "configuration-read",
    admin: true,
    timeoutSec: 60,
    argv: [
      "sh",
      "-c",
      embed(
        prelude +
          `
trap 'rm -f .plugin-config/container.json .plugin-config/image.json' EXIT
docker inspect "$container" > .plugin-config/container.json
docker image inspect "$image" > .plugin-config/image.json
${invoke} read
`,
      ),
    ],
    description:
      "Recover existing Docker customization once and read persistent configuration with secrets redacted",
  },
  {
    name: "configuration-save",
    admin: true,
    timeoutSec: 60,
    args: [{ maxLen: 32, pattern: "[a-f0-9]{32}" }],
    argv: [
      "sh",
      "-c",
      embed(
        prelude +
          `
cp -p .env .plugin-config/env.before-save
trap 'rm -f .plugin-config/env.before-save .plugin-config/requests/"$1".json' EXIT
${invoke} apply "$1"
if ! docker compose config --quiet >/dev/null 2>&1; then
  mv .plugin-config/env.before-save .env
  echo "Docker Compose rejected the configuration; previous settings restored" >&2
  exit 1
fi
`,
      ),
      "configuration-save",
      "{0}",
    ],
    description:
      "Validate and atomically save a private configuration request, restoring previous settings if Compose rejects it",
  },
  {
    name: "configuration-apply",
    admin: true,
    timeoutSec: 180,
    argv: [
      "sh",
      "-c",
      prelude +
        `
docker compose config --quiet >/dev/null 2>&1 || { echo "Invalid Compose configuration" >&2; exit 1; }
docker compose up -d --force-recreate --wait --wait-timeout 90 app
`,
    ],
    description:
      "Recreate the app from persisted configuration and wait for its health check",
  },
];
for (const command of commands) {
  inlineCommand(command, command.argv[2]);
  const index = manifest.capabilities.commands.findIndex(
    (existing) => existing.name === command.name,
  );
  if (index < 0) manifest.capabilities.commands.push(command);
  else manifest.capabilities.commands[index] = command;
}
manifest.capabilities.files = {
  write: [{ path: "/opt/ervisio-todo/.plugin-config/requests", admin: true }],
};
const output = JSON.stringify(manifest, null, 2) + "\n";
if (process.argv.includes("--check")) {
  if (
    JSON.stringify(JSON.parse(fs.readFileSync(manifestPath, "utf8"))) !==
    JSON.stringify(manifest)
  ) {
    console.error("Plugin commands are stale. Run npm run plugin:commands.");
    process.exitCode = 1;
  }
} else fs.writeFileSync(manifestPath, output);
