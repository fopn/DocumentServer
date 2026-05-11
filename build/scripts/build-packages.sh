#!/usr/bin/env bash
# build-packages.sh — runs inside the Docker `package` stage.
# Populates the build output directory from the finalubuntu-installed files,
# then invokes the upstream document-server-package Makefile to produce
# .deb and .rpm packages, which are placed in /packages/.
set -euo pipefail

# ---------------------------------------------------------------------------
# Detect architecture → upstream Makefile TARGET convention
# ---------------------------------------------------------------------------
case "$(uname -m)" in
  x86_64)  TARGET="linux_64"   ;;
  aarch64) TARGET="linux_arm64" ;;
  *) echo "ERROR: Unsupported architecture: $(uname -m)" >&2; exit 1 ;;
esac

PRODUCT_VERSION="${PRODUCT_VERSION:-0.0.0}"
BUILD_NUMBER="${BUILD_NUMBER:-0}"

# The upstream Makefile is invoked from /document-server-package/.
# BUILD_OUTPUT_DIR=../build/package/out  →  /build/package/out/ (absolute)
OUT_BASE="/build/package/out"
OUT_DIR="${OUT_BASE}/${TARGET}/euro-office/documentserver"
EXAMPLE_OUT="${OUT_BASE}/${TARGET}/euro-office/documentserver-example"

echo "==> [build-packages] TARGET=${TARGET}"
echo "==> [build-packages] PRODUCT_VERSION=${PRODUCT_VERSION}, BUILD_NUMBER=${BUILD_NUMBER}"

# ---------------------------------------------------------------------------
# 1. Populate documentserver output directory
# ---------------------------------------------------------------------------
echo "==> Setting up output directory: ${OUT_DIR}"
mkdir -p "${OUT_DIR}"
cp -a /build/documentserver/. "${OUT_DIR}/"

# Remove the Docker-specific runtime marker (upstream Makefile doesn't expect it)
rm -f "${OUT_DIR}/server/Common/config/runtime.json"
# Remove the Docker-generated log4js root file
rm -f "${OUT_DIR}/log4js.json"

# ---------------------------------------------------------------------------
# 2. Overlay original source configs (unprocessed)
#    The upstream Makefile runs sed transforms on these; they must NOT be
#    the Docker-specific pre-processed versions from build/configs/onlyoffice/.
# ---------------------------------------------------------------------------
echo "==> Overlaying original server source configs"
mkdir -p "${OUT_DIR}/server/Common/config/log4js"
cp -a /server-src/Common/config/. "${OUT_DIR}/server/Common/config/"
# Ensure runtime.json is absent after the overlay
rm -f "${OUT_DIR}/server/Common/config/runtime.json"

# ---------------------------------------------------------------------------
# 3. Schema files (upstream runs sed -i on them for DB renaming)
# ---------------------------------------------------------------------------
echo "==> Copying schema files"
cp -a /server-src/schema/. "${OUT_DIR}/server/schema/"

# ---------------------------------------------------------------------------
# 4. License files (upstream Makefile copies and renames these)
# ---------------------------------------------------------------------------
echo "==> Copying license files"
cp -f /server-src/LICENSE.txt   "${OUT_DIR}/server/"
cp -f /server-src/3rd-Party.txt "${OUT_DIR}/server/"
cp -a /server-src/license/.     "${OUT_DIR}/server/license/"

# ---------------------------------------------------------------------------
# 5. Populate documentserver-example output directory
# ---------------------------------------------------------------------------
echo "==> Setting up example output directory: ${EXAMPLE_OUT}"
mkdir -p "${EXAMPLE_OUT}/config"
cp -f /build/documentserver-example/example "${EXAMPLE_OUT}/"
cp -f /config/documentserver-example/*.json "${EXAMPLE_OUT}/config/" 2>/dev/null || true

# ---------------------------------------------------------------------------
# 6. Run upstream Makefile
# ---------------------------------------------------------------------------
echo "==> Running upstream packaging Makefile (deb rpm)"
cd /document-server-package
make deb rpm \
  BUILD_OUTPUT_DIR="${OUT_BASE}" \
  PRODUCT_VERSION="${PRODUCT_VERSION}" \
  BUILD_NUMBER="${BUILD_NUMBER}"

# ---------------------------------------------------------------------------
# 7. Collect output packages
# ---------------------------------------------------------------------------
echo "==> Collecting packages"
mkdir -p /packages
find /document-server-package/deb          -name "*.deb" -exec cp -v {} /packages/ \;
find /document-server-package/rpm/builddir -name "*.rpm" -exec cp -v {} /packages/ \;

echo ""
echo "==> Done. Packages:"
ls -lh /packages/
