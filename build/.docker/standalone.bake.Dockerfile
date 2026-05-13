# ==============================================================================
# MODULE DOCKERFILE
# This file is not meant to be built standalone. It is consumed by the 
# docker-bake.hcl files in the parent monorepos.
#
# REQUIRED CONTEXTS:
# - packages: final packages of documentserver
# ==============================================================================

#### FINAL UBUNTU ####
FROM ubuntu:24.04 AS finalubuntu
ARG PRODUCT_VERSION
ARG BUILD_ROOT=/package

ARG EO_ROOT=/var/www/euro-office/documentserver
ARG EO_LOG=/var/log/euro-office/documentserver
ARG EO_CONF=/etc/euro-office/documentserver

ENV EO_ROOT=${EO_ROOT}
ENV EO_LOG=${EO_LOG}
ENV EO_CONF=${EO_CONF}

RUN apt-get -y update && \
    ACCEPT_EULA=Y apt-get -yq install \
        postgresql postgresql-client redis-server rabbitmq-server \
        nginx sudo gdb nginx-extras supervisor jq util-linux && \
    rm -rf /var/lib/apt/lists/*

# Create the 'ds' user that is required by OnlyOffice scripts
#RUN useradd -r -s /bin/false ds || true

# --- install euro-office .deb package
ARG TARGETARCH
COPY --from=packages / /tmp/
RUN apt-get -y update && \
    service postgresql start && \
    service rabbitmq-server start && \
    sudo -u postgres psql -c "CREATE USER eurooffice WITH password 'eurooffice';" && \
    sudo -u postgres psql -c "CREATE DATABASE eurooffice OWNER eurooffice;" && \
    echo "euro-office-documentserver ds/db-type string postgres" | debconf-set-selections && \
    echo "euro-office-documentserver ds/db-host string localhost" | debconf-set-selections && \
    echo "euro-office-documentserver ds/db-port string 5432" | debconf-set-selections && \
    echo "euro-office-documentserver ds/db-user string eurooffice" | debconf-set-selections && \
    echo "euro-office-documentserver ds/db-pwd password eurooffice" | debconf-set-selections && \
    echo "euro-office-documentserver ds/db-name string eurooffice" | debconf-set-selections && \
    DS_DOCKER_INSTALLATION=true DEBIAN_FRONTEND=noninteractive apt-get -yq install /tmp/euro-office-documentserver_${PRODUCT_VERSION}-0_${TARGETARCH}.deb
    #sudo -u postgres bash -c "PGPASSWORD=eurooffice psql -h localhost -U eurooffice -d eurooffice -f ${EO_ROOT}/server/schema/postgresql/createdb.sql"


# --- Final setup ---
COPY build/standalone/configs/supervisor/ /etc/supervisor/conf.d/
COPY --chmod=755 build/standalone/scripts/entrypoint.sh /entrypoint.sh

#RUN mkdir -p ${EO_LOG}/docservice ${EO_LOG}/converter \
#             ${EO_LOG}/adminpanel ${EO_LOG}/metrics

#RUN mkdir -p ${EO_ROOT}/documentserver-example/files

#RUN mkdir -p ${EO_ROOT}/server/Common/config && \
#    echo '{}' > ${EO_ROOT}/server/Common/config/runtime.json

#RUN mkdir -p /var/lib/euro-office #&& \
#    chown -R ds:ds /var/www/euro-office /var/lib/euro-office /var/log/euro-office

RUN /usr/bin/documentserver-flush-cache.sh -r false

ENTRYPOINT ["/entrypoint.sh"]