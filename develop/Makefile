PRODUCT_VERSION ?= $(shell cat ../VERSION)
export PRODUCT_VERSION

EO_JWT_SECRET ?= euro-office-dev-jwt-secret-key-2026
export EO_JWT_SECRET

# Detect host LAN IP for phones/emulators/LAN devices. Used by `make mobile`
# and `make refresh-urls`.
ifeq ($(shell uname -s),Darwin)
	DETECTED_HOST_LAN_IP := $(shell ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null)
else
	# 1.1.1.1 is a dummy public target — `ip route get` just asks the kernel
	# which local source IP it would use, without actually sending packets.
	DETECTED_HOST_LAN_IP := $(shell ip route get 1.1.1.1 2>/dev/null | awk '{print $$7; exit}')
endif

# Empty by default: `make local` runs on localhost (desktop browser + iOS sim).
# `make mobile` sets this so Android emulators and LAN-connected devices can reach the editor.
HOST_LAN_IP ?=
export HOST_LAN_IP

local:
	@echo ""
	@echo "   ███████╗ ██████╗"
	@echo "   ██╔════╝██╔═══██╗"
	@echo "   █████╗  ██║   ██║"
	@echo "   ██╔══╝  ██║   ██║"
	@echo "   ███████╗╚██████╔╝"
	@echo "   ╚══════╝ ╚═════╝"
	@echo ""
	@echo "   Euro-Office Development Environment"
	@echo ""
ifeq ($(HOST_LAN_IP),)
	@echo "   Mode: localhost (desktop browser + iOS sim)"
	@echo "   For Android / physical device testing: make mobile"
else
	@echo "   Mode: mobile / LAN"
	@echo "   Host LAN IP:   $(HOST_LAN_IP)"
	@echo "   On IP change:  make refresh-urls"
endif
	@echo ""
	docker compose up -d
	@$(MAKE) --no-print-directory refresh-urls
	@$(MAKE) --no-print-directory print-nc-version
	@docker compose exec eo bash || true

# Like `make local`, but injects the detected HOST_LAN_IP so that Nextcloud
# returns a DocumentServerUrl mobile/LAN clients can actually reach.
mobile:
	@HOST_LAN_IP="$(DETECTED_HOST_LAN_IP)" $(MAKE) local

# Run against a future Nextcloud version (master / stable33 / stable34) using the
# nextcloud-docker-dev source-clone image. Each NC_BRANCH gets its own named volume,
# so switching branches preserves each branch's installed state.
#
#   make next                       — master (current NC dev trunk)
#   make next NC_BRANCH=stable33    — pin to NC33 stable
#   make next NC_BRANCH=stable34    — pin to NC34 stable (once cut)
#
# `make local` follows nextcloud:latest from Docker Hub (current stable) — use that
# for day-to-day work; reach for `make next` only when testing against unreleased
# or non-current NC.
next:
	@echo ""
	@echo "   Euro-Office — Next NC testing"
	@echo "   NC branch: $${NC_BRANCH:-master}"
	@echo "   Volume:    nc_data_$${NC_BRANCH:-master}  (preserved across switches)"
	@echo ""
	NC_BRANCH=$${NC_BRANCH:-master} docker compose -f docker-compose.yml -f docker-compose.next.yml up -d
	@$(MAKE) --no-print-directory refresh-urls
	@$(MAKE) --no-print-directory print-nc-version
	@docker compose exec eo bash || true

pull:
	docker compose pull && docker compose up -d && docker compose exec eo bash || true

build:
	(cd ../build && docker buildx bake develop) && \
	(docker compose up -d) && \
	(docker compose exec eo bash || true)

# Align Euro-Office URLs and trusted_domains with the current mode.
# - If HOST_LAN_IP is set: mobile/LAN mode (DocumentServerUrl = http://<ip>:8080/, trusted_domains[2] = <ip>).
# - If HOST_LAN_IP is empty: localhost mode (DocumentServerUrl = http://localhost:8080/, trusted_domains[2] cleared).
# Waits for Nextcloud + Euro-Office to finish installing on first boot, then applies idempotently.
refresh-urls:
	@start=$$(date +%s); \
	  while ! docker compose exec -T eo curl -sf http://localhost/healthcheck >/dev/null 2>&1; do \
	    printf "\r[eo]        waiting     (%ds)   " $$(($$(date +%s) - start)); \
	    sleep 2; \
	  done; \
	  printf "\r[eo]        ready        (%ds)        \n" $$(($$(date +%s) - start))
	@start=$$(date +%s); \
	  while ! docker compose exec -T -u www-data nextcloud ./occ config:app:get eurooffice DocumentServerUrl 2>/dev/null | grep -q "http"; do \
	    printf "\r[nextcloud] installing  (%ds)   " $$(($$(date +%s) - start)); \
	    sleep 2; \
	  done; \
	  printf "\r[nextcloud] ready        (%ds)        \n" $$(($$(date +%s) - start))
	@target="$${HOST_LAN_IP:-localhost}"; \
	  echo "Setting DocumentServerUrl to http://$$target:8080/"; \
	  docker compose exec -T -u www-data nextcloud ./occ config:app:set eurooffice DocumentServerUrl --value="http://$$target:8080/" >/dev/null 2>&1; \
	  if [ "$$target" = "localhost" ]; then \
	    docker compose exec -T -u www-data nextcloud ./occ config:system:delete trusted_domains 2 >/dev/null 2>&1 || true; \
	  else \
	    docker compose exec -T -u www-data nextcloud ./occ config:system:set trusted_domains 2 --value=$$target >/dev/null 2>&1; \
	  fi
	@docker compose exec -T -u www-data nextcloud ./occ config:app:set eurooffice jwt_secret --value="$(EO_JWT_SECRET)" >/dev/null 2>&1; \
	  echo "JWT secret aligned with document server"

# Print the Nextcloud version installed in the running container. Useful after
# `make local` (where it shows the latest stable Docker Hub tag) and `make next`
# (where it resolves the tracked branch — e.g. master → "34.0.0 beta 2").
print-nc-version:
	@v=$$(docker compose exec -T -u www-data nextcloud ./occ -V 2>/dev/null | tr -d '\r'); \
	  if [ -n "$$v" ]; then echo "Running: $$v"; fi
