#!/bin/bash
# Recompile PresentationEditor app.js without full build (no clean, no postload)
set -e
cd /develop/web-apps/build
BUILD_ROOT=$EO_ROOT grunt --gruntfile Gruntfile.js init-build-presentationeditor main-app-init requirejs:compile
# Patch the version placeholder that replace:writeVersion would normally handle
VER="${PRODUCT_VERSION:-9.2.1}.$(python3 -c "import json; d=json.load(open('/develop/web-apps/build/presentationeditor.json')); print(d['build'])")"
sed -i "s/{{PRODUCT_VERSION}}/$VER/g" "$EO_ROOT/web-apps/apps/presentationeditor/main/app.js"
echo "Version patched: $VER"
# Update nginx cache tag (single-line file; rewrite it wholesale to avoid sed escaping)
NEW_TAG=$(md5sum "$EO_ROOT/web-apps/apps/presentationeditor/main/app.js" | cut -c1-32)
echo "set \$cache_tag \"$NEW_TAG\";" > /etc/nginx/includes/ds-cache.conf
nginx -s reload
echo "Cache tag updated: $NEW_TAG — done."
