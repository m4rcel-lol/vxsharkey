# Security Documentation for vxsharkey

## Overview

vxsharkey acts as a proxy that fetches public notes from Sharkey/Misskey instances
and renders them as embed-friendly HTML pages. Because it makes outbound HTTP
requests based on user input (the instance domain), it must guard against
Server-Side Request Forgery (SSRF) and other injection attacks.

## SSRF Prevention

### Domain Validation

All instance domains are validated before any outbound request is made:

1. **No IP addresses**: Both IPv4 and IPv6 literals are rejected. Users must
   provide a valid hostname, not an IP address.

2. **No localhost**: `localhost` and `*.localhost` are explicitly blocked.

3. **Hostname format**: Only valid hostnames are accepted — they must contain at
   least two labels (e.g., `example.com`), each label must be 1–63 characters
   of alphanumeric characters and hyphens (not starting or ending with a
   hyphen), and the TLD must be at least 2 characters.

4. **Private IP detection**: Helper functions `isPrivateIPv4` and `isPrivateIPv6`
   are available for extended DNS-resolution-based checks if needed in the future.

### Request Safety

- All upstream requests are made over **HTTPS only** (`https://{instance}/api/notes/show`).
- Requests have a strict **5-second timeout** via `AbortSignal.timeout()`.
- Response bodies are limited to **1 MB** to prevent memory exhaustion attacks.

## XSS Prevention

All user-generated content is sanitized before being embedded in HTML:

- `escapeHtml()` escapes `&`, `<`, `>`, `"`, and `'` characters.
- `sanitizeUrl()` only allows `http:` and `https:` URLs, rejecting `javascript:`,
  `data:`, and other dangerous protocols.
- URLs are HTML-escaped after protocol validation.

## Rate Limiting

An in-memory sliding-window rate limiter protects against abuse:

- Default: **60 requests per IP per minute**.
- Configurable via `RATE_LIMIT_MAX` and `RATE_LIMIT_WINDOW_MS` environment variables.
- Rate limit headers (`X-RateLimit-Remaining`, `X-RateLimit-Reset`) are included
  in responses.

## Content Security

- The response includes appropriate security headers when deployed behind a
  reverse proxy (nginx/Caddy configs provided).
- `Content-Security-Policy` restricts script execution, image sources, and media
  sources.
- `X-Content-Type-Options: nosniff` prevents MIME-type sniffing.
- `X-Frame-Options: DENY` prevents clickjacking.

## Privacy

- The service does not collect or store any personal data.
- Only public notes (visibility: "public") are rendered; non-public notes
  return 404.
- The cache stores rendered HTML (not raw API responses) for up to 5 minutes.

## Deployment Hardening

- The Docker image runs as a non-root user (`vxsharkey`, UID 1001).
- The systemd service file includes `NoNewPrivileges`, `ProtectSystem=strict`,
  `ProtectHome`, and `PrivateTmp` directives.
- Memory and CPU limits are set in the systemd service.

## Reporting Vulnerabilities

If you discover a security vulnerability, please report it responsibly by
opening a private issue on the GitHub repository.
