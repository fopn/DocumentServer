#!/usr/bin/env bash
#
# One-command local setup for the EuroOffice FileOpen fork.
# Runs entirely on localhost. No ngrok. No PHP or Node needed on the host
# (the build steps run in throwaway containers).
#
# Usage, from the document server repo root:
#   bash develop/bootstrap.sh
#
# Prereqs: Docker Desktop running, and git. That is it.
#
set -euo pipefail
export MSYS_NO_PATHCONV=1   # keep Docker volume paths intact on Windows git-bash

DS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"   # repo root (this script lives in develop/)
# Use Windows-style paths (C:/...) so BOTH git and Docker -v work under Git Bash.
# cygpath exists in Git Bash; on Linux/macOS this leaves the path unchanged.
command -v cygpath >/dev/null 2>&1 && DS_DIR="$(cygpath -m "$DS_DIR")"
PARENT="$(dirname "$DS_DIR")"
APP_DIR="$PARENT/eurooffice-nextcloud"
APP_REPO="https://github.com/ryanmathew404/EuroOffice-FileOpen-Demo.git"

# --prebuilt uses the published doc-server image (editor already compiled) and
# skips the slow in-container editor build. This is the easy path for teammates.
PREBUILT=0
[ "${1:-}" = "--prebuilt" ] && PREBUILT=1
COMPOSE_FILES="-f docker-compose.yml"
[ "$PREBUILT" = "1" ] && COMPOSE_FILES="$COMPOSE_FILES -f docker-compose.prebuilt.yml"

if [ "$PREBUILT" = "1" ]; then
  echo "==> Editor: using prebuilt image ghcr.io/ryanmathew404/eurooffice-documentserver (no build)"
else
  echo "==> Editor source (web-apps submodule with the Protection tab)"
  git -C "$DS_DIR" submodule update --init web-apps
fi

echo "==> 2/7  Nextcloud app, cloned as a sibling folder"
if [ ! -d "$APP_DIR/.git" ]; then
  git clone --branch nextcloud-app "$APP_REPO" "$APP_DIR"
fi
git -C "$APP_DIR" submodule update --init assets/document-templates assets/document-formats

echo "==> 3/7  App dependencies: PHP vendor + built frontend"
docker run --rm -v "$APP_DIR":/app -w /app composer:2 install --no-dev --ignore-platform-reqs --no-interaction
docker run --rm -v "$APP_DIR":/app -w /app node:20 bash -lc "npm install --no-audit --no-fund && npm run build"
# The Vite build empties js/ before writing, which deletes the committed
# fo-fileperms.js relay (the script that saves owner permissions). Restore it,
# or the Protection tab will look like it works but nothing will save.
git -C "$APP_DIR" checkout -- js/fo-fileperms.js 2>/dev/null || true
test -f "$APP_DIR/js/fo-fileperms.js" || echo "WARNING: js/fo-fileperms.js missing after build; saving will not work"

echo "==> Starting the stack (localhost only)"
( cd "$DS_DIR/develop" && docker compose $COMPOSE_FILES up -d )

echo "==> 5/7  Waiting for the document server to be ready"
until curl -sf http://localhost:8080/healthcheck >/dev/null 2>&1; do printf '.'; sleep 3; done
echo " ready"

if [ "$PREBUILT" = "1" ]; then
  echo "==> Editor already built into the image, skipping the build step"
else
  echo "==> Building the editors (full build, then patching the version hash)"
  docker exec eo bash -lc '
    set -e
    cd /develop/web-apps/build && npm ci
    BUILD_ROOT=$EO_ROOT grunt --gruntfile Gruntfile.js deploy-documenteditor deploy-presentationeditor
    H=$(md5sum $EO_ROOT/web-apps/apps/documenteditor/main/app.js | cut -c1-32)
    files=$(grep -rl "{{HASH_POSTFIX}}\|{{PRODUCT_VERSION}}" $EO_ROOT/web-apps/apps/ || true)
    [ -n "$files" ] && sed -i "s/{{HASH_POSTFIX}}/$H/g; s/{{PRODUCT_VERSION}}/9.3.1/g" $files
    nginx -s reload
  '
fi

echo "==> 7/7  Pointing Nextcloud at the local document server (no ngrok)"
docker exec -u www-data -w /var/www/html nextcloud php occ config:app:set eurooffice DocumentServerUrl --value="http://localhost:8080/" >/dev/null

cat <<'DONE'

All set.

  Nextcloud:   http://localhost:8081   (admin / admin)
  Doc server:  http://localhost:8080

The eurooffice app is enabled and configured for localhost. Open a .docx or
.pptx that you own, then use the Protection tab to restrict editing, printing,
or saving a copy. Anyone you share the file with has those limits enforced.

To stop without losing data:   docker stop eo nextcloud onlyoffice
To start again:                docker start eo nextcloud onlyoffice
DONE
