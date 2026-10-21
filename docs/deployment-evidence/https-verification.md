# HTTPS verification

Observed 2026-10-21 23:45 JST, release 20261021.1.

- https://bobuy.cc returns 200, Server cloudflare, CF-RAY NRT.
- /health returns {"status":"ok","service":"gateway-service"}.
- http://bobuy.cc returns 301 to https://bobuy.cc/.
- https://www.bobuy.cc returns 301 to https://bobuy.cc/.
- HSTS max-age=31536000 is present.
- Cloudflare authenticated UI readback: Full (strict).
- Apex A and www CNAME are proxied; existing five MX and one SPF TXT retained.
- Origin Let's Encrypt certificate covers bobuy.cc and www.bobuy.cc,
  expires 2027-01-19. Cloudflare Universal SSL is active.
- Certbot dry-run with --cert-name bobuy.cc succeeded for both names.
- bobuy-cert-renew.timer enabled and active; nginx -t and reload succeeded.

Browser evidence uses an empty business database with one bootstrap operator.
The browser report stores cookie flags and names only, never cookie values.
