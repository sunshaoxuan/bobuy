#!/bin/sh
set -eu
docker run --rm --name bobuy-certbot-renew \
  -v /etc/letsencrypt:/etc/letsencrypt \
  -v /var/lib/letsencrypt:/var/lib/letsencrypt \
  -v /opt/bobuy/data/acme:/var/www/acme \
  certbot/certbot:v5.1.0 renew --cert-name bobuy.cc --webroot -w /var/www/acme "$@"
docker exec bobuy-gateway nginx -t
docker exec bobuy-gateway nginx -s reload
