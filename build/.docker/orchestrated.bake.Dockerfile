ARG POSTGRES_VERSION="15"
ARG MYSQL_VERSION="latest"
ARG MARIADB_VERSION="latest"

FROM fedora:43 AS ds-base

    LABEL maintainer Euro-Office

    ARG COMPANY_NAME=euro-office
    ARG DS_VERSION_HASH
    ENV COMPANY_NAME=$COMPANY_NAME \
        APPLICATION_NAME=$COMPANY_NAME \
        DS_VERSION_HASH=$DS_VERSION_HASH \
        NODE_ENV=production-linux \
        NODE_CONFIG_DIR=/etc/$COMPANY_NAME/documentserver \
        PKG_NATIVE_CACHE_PATH=/tmp/.cache

    RUN dnf -y updateinfo list --security && \
        dnf update --security -y && \
        dnf install sudo \
                    python3-pip \
                    findutils \
                    shadow-utils \
                    procps-ng \
                    tar \
                    unzip \
                    libaio \
                    libnsl \
                    nano \
                    gettext \
                    nginx \
                    httpd-tools \
                    wget -y && \
        pip3 install --no-cache-dir redis && \
        wget -O /usr/local/bin/dumb-init https://github.com/Yelp/dumb-init/releases/download/v1.2.5/dumb-init_1.2.5_$(uname -m) && \
        chmod +x /usr/local/bin/dumb-init && \
        mkdir -p /oracle/instantclient /opt/oracle /home/ds /etc/nginx/includes && \
        wget -O /oracle/basic.zip https://download.oracle.com/otn_software/linux/instantclient/2370000/instantclient-basic-linux.x64-23.7.0.25.01.zip && \
        unzip /oracle/basic.zip -d /oracle/instantclient && \
        mv /oracle/instantclient/instantclient_23_7 /opt/oracle/instantclient_23_7 && \
        rm -rf /oracle && \
        groupadd --system --gid 101 ds && \
        useradd --system -g ds --no-create-home --shell /sbin/nologin --uid 101 ds && \
        chown -R ds:ds /home/ds && \
        dnf clean all && \
        rm -rf /var/cache/dnf && \
        rm -f /var/log/*log

FROM ds-base AS ds-service
    ARG TARGETARCH
    ARG DS_VERSION_HASH
    ARG PRODUCT_EDITION=
    ARG RELEASE_VERSION
    ARG PRODUCT_VERSION
    ENV TARGETARCH=$TARGETARCH \
        DS_VERSION_HASH=$DS_VERSION_HASH
    WORKDIR /ds

    COPY --from=packages / /tmp/

    RUN dnf -y install cabextract xorg-x11-font-utils fontconfig && \
        rpm -ivh --nodigest \
        https://downloads.sourceforge.net/project/mscorefonts2/rpms/msttcore-fonts-installer-2.6-1.noarch.rpm && \
        TARGETARCH=$(echo $TARGETARCH | sed "s/"$TARGETARCH"/"$(uname -m)"/g") && \
        rpm -ivh /tmp/euro-office-documentserver-${PRODUCT_VERSION}-0.${TARGETARCH}.rpm --noscripts --nodeps && \
        mkdir -p /var/www/$COMPANY_NAME/documentserver/core-fonts/msttcore && \
        cp -vt \
            /var/www/$COMPANY_NAME/documentserver/core-fonts/msttcore \
            /usr/share/fonts/msttcore/*.ttf && \
        chmod a+r /etc/$COMPANY_NAME/documentserver*/*.json && \
        chmod a+r /etc/$COMPANY_NAME/documentserver/log4js/*.json
    COPY --chown=ds:ds \
        build/configs/orchestrated/nginx/includes/http-common.conf \
        build/configs/orchestrated/nginx/includes/http-upstream.conf \
        /etc/$COMPANY_NAME/documentserver/nginx/includes/
    #COPY --chown=ds:ds \
    #    fonts/ \
    #    /var/www/$COMPANY_NAME/documentserver/core-fonts/custom/
    #COPY --chown=ds:ds \
    #    plugins/ \
    #    /var/www/$COMPANY_NAME/documentserver/sdkjs-plugins/
    #COPY --chown=ds:ds \
    #    dictionaries/ \
    #    /var/www/onlyoffice/documentserver/dictionaries/
    RUN documentserver-generate-allfonts.sh true && \
        #python3 /var/www/onlyoffice/documentserver/server/dictionaries/update.py && \
        documentserver-flush-cache.sh -h $DS_VERSION_HASH -r false
    #    documentserver-pluginsmanager.sh -r false \
    #    --update=\"/var/www/$COMPANY_NAME/documentserver/sdkjs-plugins/plugin-list-default.json\"

# --------------------------------------------------------------------------------
# This image contains ALL runtime components (DocService, Converter, Adminpanel and
# Proxy) and is intended to be reused by
# multiple Kubernetes Deployments
#
# Model:
#   - Select the Docs service via container args (docservice|converter|adminpanel)
#   - For the Proxy Deployment, override ONLY `command` in the
#     PodSpec to run proxy-docker-entrypoint.sh directly
# --------------------------------------------------------------------------------

FROM ds-base AS docs
    ENV DOCSERVICE_HOST_PORT=localhost:8000 \
        ADMINPANEL_HOST_PORT=localhost:9000 \
        EXAMPLE_HOST_PORT=localhost:3000 \
        NGINX_ACCESS_LOG=off \
        NGINX_GZIP_PROXIED=off \
        NGINX_CLIENT_MAX_BODY_SIZE=100m \
        NGINX_WORKER_CONNECTIONS=4096 \
        NGINX_WORKER_PROCESSES=1
    COPY --chown=ds:ds build/configs/orchestrated/nginx/nginx.conf /etc/nginx/nginx.conf
    COPY --chown=ds:ds --from=ds-service \
        /usr/bin/documentserver-generate-allfonts.sh \
        #/usr/bin/documentserver-pluginsmanager.sh \
        /usr/local/bin/
    #COPY --from=ds-service \
    #    /var/www/$COMPANY_NAME/documentserver/server/dictionaries/update.py \
    #    /var/www/$COMPANY_NAME/documentserver/server/dictionaries/update.py
    COPY --from=ds-service \
        /var/www/$COMPANY_NAME/documentserver/server/tools/allfontsgen \
        /var/www/$COMPANY_NAME/documentserver/server/tools/allfontsgen
    COPY --from=ds-service \
        /var/www/$COMPANY_NAME/documentserver/server/tools/allthemesgen \
        /var/www/$COMPANY_NAME/documentserver/server/tools/allthemesgen
    COPY --from=ds-service \
        /var/www/$COMPANY_NAME/documentserver/server/tools/pluginsmanager \
        /var/www/$COMPANY_NAME/documentserver/server/tools/pluginsmanager
    COPY --chown=ds:ds --chmod=644 --from=ds-service \
        /etc/$COMPANY_NAME/documentserver/nginx/ds.conf \
        /etc/nginx/conf.d/
    COPY --chown=ds:ds --chmod=644 --from=ds-service \
        /etc/$COMPANY_NAME/documentserver*/nginx/includes/*.conf \
        /etc/nginx/includes/ds-cache.conf \
        /etc/nginx/includes/
    COPY --chown=ds:ds --from=ds-service \
        /var/www/$COMPANY_NAME/documentserver/dictionaries \
        /var/www/$COMPANY_NAME/documentserver/dictionaries
    COPY --from=ds-service \
        /etc/$COMPANY_NAME/documentserver/default.json \
        /etc/$COMPANY_NAME/documentserver/production-linux.json \
        /etc/$COMPANY_NAME/documentserver/
    COPY --from=ds-service --chown=ds:ds \
        /etc/$COMPANY_NAME/documentserver/log4js/production.json \
        /etc/$COMPANY_NAME/documentserver/log4js/
    COPY --chown=ds:ds --from=ds-service \
        /var/www/$COMPANY_NAME/documentserver/sdkjs-plugins \
        /var/www/$COMPANY_NAME/documentserver/sdkjs-plugins
    COPY --from=ds-service \
        /var/www/$COMPANY_NAME/documentserver/core-fonts \
        /var/www/$COMPANY_NAME/documentserver/core-fonts
    COPY --chown=ds:ds --from=ds-service \
        /var/www/$COMPANY_NAME/documentserver/fonts \
        /var/www/$COMPANY_NAME/documentserver/fonts
    COPY --from=ds-service \
        /usr/share/fonts \
        /usr/share/fonts
    COPY --chown=ds:ds --from=ds-service \
        /var/www/$COMPANY_NAME/documentserver/sdkjs \
        /var/www/$COMPANY_NAME/documentserver/sdkjs
    COPY --from=ds-service \
        /var/www/$COMPANY_NAME/documentserver/server/DocService \
        /var/www/$COMPANY_NAME/documentserver/server/DocService
    COPY --from=ds-service \
        /var/www/$COMPANY_NAME/documentserver/server/FileConverter \
        /var/www/$COMPANY_NAME/documentserver/server/FileConverter
    COPY --from=ds-service \
        /var/www/$COMPANY_NAME/documentserver/server/AdminPanel/server \
        /var/www/$COMPANY_NAME/documentserver/server/AdminPanel/server
    COPY --chown=ds:ds --from=ds-service \
        /var/www/$COMPANY_NAME/documentserver/server/AdminPanel/client \
        /client
    #COPY --from=ds-service \
    #    /var/www/$COMPANY_NAME/documentserver/server/info \
    #    /var/www/$COMPANY_NAME/documentserver/server/info
    COPY --chown=ds:ds --from=ds-service \
        /var/www/$COMPANY_NAME/documentserver/web-apps \
        /var/www/$COMPANY_NAME/documentserver/web-apps
    COPY --from=ds-service \
        /var/www/$COMPANY_NAME/documentserver/document-templates/new \
        /var/www/$COMPANY_NAME/documentserver/document-templates/new
    #COPY --from=ds-service \
    #    /var/www/$COMPANY_NAME/documentserver/document-formats \
    #    /var/www/$COMPANY_NAME/documentserver/document-formats
    COPY --chown=ds:ds --from=ds-service \
        /var/www/$COMPANY_NAME/documentserver-example/welcome \
        /var/www/$COMPANY_NAME/documentserver-example/welcome
    COPY build/scripts/orchestrated/docker-entrypoint.sh build/scripts/orchestrated/proxy-docker-entrypoint.sh /usr/local/bin/
    COPY build/scripts/orchestrated/init-docker-entrypoint.sh /init/
    RUN sed 's|\(application\/zip.*\)|\1\n    application\/wasm wasm;|' \
            -i /etc/nginx/mime.types && \
        sed 's,\(listen.\+:\)\([0-9]\+\)\(.*;\),'"\18888\3"',' \
            -i /etc/nginx/conf.d/ds.conf && \
        sed '/access_log.*/d' -i /etc/nginx/includes/ds-common.conf && \
        sed '/error_log.*/d' -i /etc/nginx/includes/ds-common.conf && \
        echo -e "\ngzip_proxied \$NGINX_GZIP_PROXIED;\n" >> /etc/nginx/includes/ds-common.conf && \
        sed 's/#*\s*\(gzip_static\).*/\1 on;/g' -i /etc/nginx/includes/ds-docservice.conf && \
        sed -i 's/etc\/nginx/tmp\/proxy_nginx/g' /etc/nginx/nginx.conf && \
        sed -i 's/etc\/nginx/tmp\/proxy_nginx/g' /etc/nginx/conf.d/ds.conf && \
        sed 's/\(X-Forwarded-For\).*/\1 example.com;/' -i /etc/nginx/includes/ds-example.conf && \
        sed 's/\(index\).*/\1 k8s.html;/' -i /etc/nginx/includes/ds-example.conf && \
        chmod 755 /var/log/nginx && \
        ln -sf /dev/stdout /var/log/nginx/access.log && \
        ln -sf /dev/stderr /var/log/nginx/error.log && \
        mkdir -p \
            /var/lib/$COMPANY_NAME/documentserver/App_Data/cache/files \
            /var/www/$COMPANY_NAME/config \
            /var/lib/$COMPANY_NAME/documentserver/App_Data/docbuilder && \
        chown -R ds:ds /var/lib/$COMPANY_NAME/documentserver /var/www/$COMPANY_NAME/config && \
        find \
            /var/www/$COMPANY_NAME/documentserver/fonts \
            -type f ! \
            -name "*.*" \
            -exec sh -c 'gzip -cf9 $0 > $0.gz && chown ds:ds $0.gz' {} \; && \
        find \
            /var/www/$COMPANY_NAME/documentserver/sdkjs \
            /var/www/$COMPANY_NAME/documentserver/sdkjs-plugins \
            /var/www/$COMPANY_NAME/documentserver/web-apps \
            /var/www/$COMPANY_NAME/documentserver-example/welcome \
            -type f \
            \( -name *.js -o -name *.json -o -name *.htm -o -name *.html -o -name *.css \) \
            -exec sh -c 'gzip -cf9 $0 > $0.gz && chown ds:ds $0.gz' {} \;
    VOLUME /var/lib/$COMPANY_NAME
    USER ds

    # --------------------------------------------------------------------
    # Default entrypoint for Docs services
    # Do NOT override this for DocService/Converter/Adminpanel; only provide `args`
    # --------------------------------------------------------------------
    ENTRYPOINT ["dumb-init", "--", "docker-entrypoint.sh"]

    # --------------------------------------------------------------------
    # Default execution mode for the image.
    # Kubernetes `args` override this value:
    #   - DocService Deployment:
    #       args: ["docservice", ...]
    #   - Converter Deployment:
    #       args: ["converter", ...]
    #   - Adminpanel Deployment:
    #       args: ["adminpanel"]
    #
    # Proxy Deployment should override `command` instead:
    #   command: ["proxy-docker-entrypoint.sh"]
    #   args: [...]
    # --------------------------------------------------------------------
    CMD ["docservice"]