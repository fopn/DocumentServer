#!/bin/bash

php /var/www/html/occ config:system:set trusted_domains 10 --value=nextcloud

# Disable throttling for dev — mobile login retries trip the default
# brute-force protection and rate limiter, blocking further requests.
php /var/www/html/occ config:system:set auth.bruteforce.protection.enabled --value=false --type=boolean
php /var/www/html/occ config:system:set ratelimit.protection.enabled --value=false --type=boolean

# Remove stock onlyoffice app if present — it conflicts with eurooffice's autoloader
rm -rf /var/www/html/custom_apps/onlyoffice

echo "Waiting for Euro-Office document server to be ready..."
until curl -sf http://eo/healthcheck > /dev/null 2>&1; do
    echo "Waiting for http://eo/healthcheck..."
    sleep 5
done
echo "Document server is ready!"

# Baseline URL; `make local` / `make mobile` rewrite this via `refresh-urls`.
php /var/www/html/occ app:enable eurooffice
php /var/www/html/occ config:app:set eurooffice DocumentServerUrl --value="http://localhost:8080/"
php /var/www/html/occ config:app:set eurooffice StorageUrl --value="http://nextcloud/"
php /var/www/html/occ config:app:set eurooffice DocumentServerInternalUrl --value="http://eo/"
php /var/www/html/occ config:app:set eurooffice VerifyPeerOff --value="true"
php /var/www/html/occ config:app:set eurooffice jwt_secret --value="euro-office-dev-jwt-secret-key-2026"

