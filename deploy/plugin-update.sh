set -eu
umask 077
v="$1"
d=/opt/ervisio-todo
[ -f "$d/compose.yaml" ] || { echo "No Docker installation in $d"; exit 1; }
command -v flock >/dev/null || { echo "flock is required to protect deployment configuration"; exit 1; }
cd "$d"
exec 9>.plugin-config.lock
flock -n 9 || { echo "Deployment configuration is busy; retry when the current operation finishes"; exit 1; }
mkdir -p .plugin-config
chmod 700 .plugin-config
trap 'rm -f .plugin-config/container.json .plugin-config/image.json' EXIT
trap 'exit 1' HUP INT TERM
container=$(docker compose ps --all --quiet app)
[ -n "$container" ] || { echo "No app container available to preserve deployment configuration"; exit 1; }
image=$(docker inspect --format '{{.Image}}' "$container")
docker inspect "$container" > .plugin-config/container.json
docker image inspect "$image" > .plugin-config/image.json
echo "==> backup"
docker run --rm --network none --user 0:0 --entrypoint node --mount "type=bind,src=$d,dst=/deployment" --workdir /deployment "$image" --input-type=module -e __PLUGIN_CONFIG_SOURCE__ recover "$v"
rm -f .plugin-config/container.json .plugin-config/image.json
echo "Data stays in the Docker volume ervisiotodo_todo-data"
echo "==> pull"
docker compose pull app
echo "==> up"
docker compose up -d
echo "==> done"
