# ==============================================================================
# MODULE DOCKERFILE
# This file is not meant to be built standalone. It is consumed by the 
# docker-bake.hcl files in the parent monorepos.
#
# REQUIRED CONTEXTS:
# - server: builds from server repo
# - core: builds from core repo
# - web-apps: builds from web-apps repo
# - sdkjs: builds from sdkjs repo
# - example: builds from example repo
# ==============================================================================


FROM alpine AS bundle
    ARG BUILD_ROOT=/package
    # --- Copy build files
    RUN mkdir -p /build/documentserver/sdkjs-plugins /build/documentserver/fonts \
                /build/documentserver/server/FileConverter/lib /build/documentserver/server/tools

    # --- Static content from build context (rarely changes) ---
    COPY dictionaries /build/documentserver/dictionaries
    COPY document-templates /build/documentserver/document-templates
    COPY core-fonts /build/documentserver/core-fonts

    # --- Config files
    COPY build/configs/core/DoctRenderer.config /build/documentserver/server/FileConverter/bin/DoctRenderer.config
    COPY build/configs/metrics/config/config.js /build/documentserver/server/Metrics/config/config.js


    # --- Build stage outputs (change with code) ---
    COPY --from=sdkjs ${BUILD_ROOT} /build/documentserver/
    COPY --from=web-apps ${BUILD_ROOT} /build/documentserver/

    COPY --from=core ${BUILD_ROOT}/bin/ /build/documentserver/server/FileConverter/bin/
    COPY --from=core ${BUILD_ROOT}/tools/ /build/documentserver/server/tools/
    COPY --from=core ${BUILD_ROOT}/*.so* /build/documentserver/server/FileConverter/lib/
    COPY --from=core ${BUILD_ROOT}/tools/*.so* /build/documentserver/server/tools/

    COPY --from=server ${BUILD_ROOT}/docservice    /build/documentserver/server/DocService/docservice
    COPY --from=server ${BUILD_ROOT}/fileconverter /build/documentserver/server/FileConverter/converter
    COPY --from=server ${BUILD_ROOT}/metrics       /build/documentserver/server/Metrics/metrics
    COPY --from=server ${BUILD_ROOT}/adminpanel    /build/documentserver/server/AdminPanel/server/adminpanel
    COPY --from=server ${BUILD_ROOT}/build         /build/documentserver/server/AdminPanel/client/build


    COPY --from=example /example/example /build/documentserver-example/example
    RUN mkdir -p /build/documentserver-example/files
    COPY --from=example /example/config/* /config/documentserver-example/

    COPY document-server-package/common/documentserver-example/welcome /build/documentserver-example/welcome
    RUN YEAR=$(date +"%Y") && \
        sed -i "s|{{OFFICIAL_PRODUCT_NAME}}|Community Edition|g" /build/documentserver-example/welcome/*.html && \
        find /build/documentserver-example/welcome -depth -type f \
            -exec sed -i "s_{{year}}_${YEAR}_g" {} \; && \
        sed -i "s|{{EXAMPLE_DISABLED_COMMANDS}}|sudo systemctl start ds-example|g" \
            /build/documentserver-example/welcome/example-disabled.html && \
        rm -f /build/documentserver-example/welcome/admin-disabled.html && \
        sed -i '/<!-- BEGIN ADMIN PANEL SECTION -->/,/<!-- END ADMIN PANEL SECTION -->/d' \
            /build/documentserver-example/welcome/docker.html \
            /build/documentserver-example/welcome/linux.html \
            /build/documentserver-example/welcome/linux-rpm.html \
            /build/documentserver-example/welcome/win.html