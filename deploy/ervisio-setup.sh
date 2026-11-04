#!/usr/bin/env bash
# Non-interactive Docker install used by the Ervisio plugin (and usable by hand):
#   deploy/ervisio-setup.sh --url https://todo.example.com [--version 0.3.0]
# Writes .env once (existing secrets are kept), prepares the plugin socket
# directory and starts the stack. Run it from a checkout or a release archive.
set -eu

url=""
version=""
# Host directory bind-mounted at /run/ervisio-todo in the container.
socket_dir="${ERVISIO_SOCKET_DIR:-/run/ervisio-todo}"

usage() {
  echo "Usage: $0 --url URL [--version X.Y.Z]" >&2
  echo "  --url      public URL of the instance (AUTH_URL), http(s) origin" >&2
  echo "  --version  image tag (ERVISIO_VERSION); default: the compose default" >&2
}

while [ $# -gt 0 ]; do
  case "$1" in
    --url) url="${2:?--url needs a value}"; shift ;;
    --version) version="${2:?--version needs a value}"; shift ;;
    -h | --help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage; exit 2 ;;
  esac
  shift
done

[ -n "$url" ] || { usage; exit 2; }
url="${url%/}"
case "$url" in
  http://* | https://*) ;;
  *) echo "The URL must start with http:// or https://" >&2; exit 2 ;;
esac
case "${url#*://}" in
  */* | *\?* | *'#'* | *@*) echo "The URL must be an origin without path, query or credentials" >&2; exit 2 ;;
esac
case "$version" in
  "" | [0-9]*.[0-9]*.[0-9]*) ;;
  *) echo "--version must look like 0.3.0" >&2; exit 2 ;;
esac

cd -- "$(dirname -- "$0")/.."
command -v docker >/dev/null || { echo "Install Docker Engine and try again." >&2; exit 1; }
docker compose version >/dev/null
docker info >/dev/null

rand_hex() {
  if command -v openssl >/dev/null; then openssl rand -hex "$1"
  else head -c "$1" /dev/urandom | od -An -tx1 | tr -d ' \n'; fi
}

# Replace KEY=value in .env, or append it.
set_env() {
  if grep -q "^$1=" .env; then
    sed "s|^$1=.*|$1=$2|" .env > .env.tmp && cat .env.tmp > .env && rm -f .env.tmp
  else
    printf '%s=%s\n' "$1" "$2" >> .env
  fi
}

umask 077
if [ ! -f .env ]; then
  {
    echo "AUTH_SECRET=$(rand_hex 24)"
    echo "AUTH_URL=$url"
    [ -n "$version" ] && echo "ERVISIO_VERSION=$version"
    echo "PLUGIN_SOCKET=/run/ervisio-todo/api.sock"
    echo "ERVISIO_SOCKET_DIR=$socket_dir"
  } > .env
  echo "Created .env."
else
  # Keep AUTH_SECRET and every other setting; only the URL (and version) move.
  grep -q '^AUTH_SECRET=.\{32,\}' .env || set_env AUTH_SECRET "$(rand_hex 24)"
  set_env AUTH_URL "$url"
  [ -z "$version" ] || set_env ERVISIO_VERSION "$version"
  grep -q '^PLUGIN_SOCKET=' .env || set_env PLUGIN_SOCKET /run/ervisio-todo/api.sock
  grep -q '^ERVISIO_SOCKET_DIR=' .env || set_env ERVISIO_SOCKET_DIR "$socket_dir"
  echo "Kept the existing .env (AUTH_URL updated)."
fi

# The container runs as uid/gid 1000 (node) and creates the socket here.
priv=""
if [ "$(id -u)" -ne 0 ] && command -v sudo >/dev/null; then priv=sudo; fi
$priv mkdir -p "$socket_dir"
$priv chown 1000:1000 "$socket_dir"
$priv chmod 0755 "$socket_dir"
# /run is a tmpfs: recreate the directory at boot so the bind mount keeps working.
if [ "$socket_dir" = /run/ervisio-todo ] && [ -d /etc/tmpfiles.d ]; then
  echo "d $socket_dir 0755 1000 1000 -" | $priv tee /etc/tmpfiles.d/ervisio-todo.conf >/dev/null
fi

# Prefer the published image; fall back to building this checkout.
docker compose pull app || docker compose build app
docker compose up -d --wait

echo
echo "ErvisioTodo is running at $url"
echo "The first account you register becomes the administrator."
