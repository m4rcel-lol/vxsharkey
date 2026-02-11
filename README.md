# vxsharkey

Embed-optimized proxy for public [Sharkey](https://joinsharkey.org/) / [Misskey](https://misskey-hub.net/) notes.
Works like [vxtwitter](https://github.com/dylanpdx/BetterTwitFix) but for the Fediverse.

## What it does

When you share a Sharkey/Misskey note link through vxsharkey, platforms like Discord,
Slack, and Telegram will display a rich embed with the note content, images, and videos.

**Example:**
```
https://vx.twitkey.com/sharkey.example.com/notes/9xyzabc123
```

## Features

- Rich OpenGraph and Twitter Card metadata for embeds
- Image and video preview support
- Content Warning (CW) display
- In-memory LRU cache with 5-minute TTL
- SSRF protection (no IPs, no localhost, hostname validation)
- Per-IP rate limiting
- XSS-safe HTML rendering
- Lightweight — runs on Alpine Linux with minimal resources
- Docker and bare-metal deployment support

## Quick Start

```bash
npm install
node src/index.js
```

Then visit: `http://localhost:3000/{instance}/notes/{noteId}`

## Documentation

- [Deployment Guide](DEPLOYMENT.md) — Full setup instructions, Docker, Alpine, reverse proxy
- [Security Documentation](SECURITY.md) — SSRF prevention, XSS, rate limiting

## API

| Endpoint | Description |
|---|---|
| `GET /:instance/notes/:noteId` | Render note embed page |
| `GET /health` | Health check |
| `GET /metrics` | Service metrics |

## Testing

```bash
npm test
```

## License

MIT
