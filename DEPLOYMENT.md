# Deployment Guide for vxsharkey

## Prerequisites

- Node.js 18+ (recommended: 22 LTS)
- npm

## Quick Start

```bash
# Clone the repository
git clone https://github.com/m4rcel-lol/vxsharkey.git
cd vxsharkey

# Install dependencies
npm install --production

# Start the server
node src/index.js
```

The server starts on `http://0.0.0.0:3000` by default.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Server port |
| `HOST` | `0.0.0.0` | Bind address |
| `CACHE_MAX_SIZE` | `500` | Maximum cached entries |
| `CACHE_TTL_MS` | `300000` | Cache TTL (5 minutes) |
| `RATE_LIMIT_MAX` | `60` | Max requests per IP per window |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Rate limit window (1 minute) |

## Docker Deployment

### Build and run

```bash
docker build -t vxsharkey .
docker run -d --name vxsharkey -p 3000:3000 vxsharkey
```

### With environment variables

```bash
docker run -d \
  --name vxsharkey \
  -p 3000:3000 \
  -e PORT=3000 \
  -e RATE_LIMIT_MAX=120 \
  --memory=256m \
  --cpus=2 \
  --restart=unless-stopped \
  vxsharkey
```

## Alpine Linux (Non-Docker) Setup

```bash
# Install Node.js
apk add --no-cache nodejs npm

# Create service user
adduser -D -h /opt/vxsharkey vxsharkey

# Deploy application
mkdir -p /opt/vxsharkey
cd /opt/vxsharkey
# Copy project files here
npm install --production

# Install and enable systemd service (if using OpenRC instead, see below)
cp vxsharkey.service /etc/systemd/system/
systemctl enable vxsharkey
systemctl start vxsharkey
```

### OpenRC (Alpine default init)

Create `/etc/init.d/vxsharkey`:

```bash
#!/sbin/openrc-run

name="vxsharkey"
description="Embed proxy for Sharkey/Misskey notes"
command="/usr/bin/node"
command_args="/opt/vxsharkey/src/index.js"
command_user="vxsharkey"
command_background=true
pidfile="/run/${RC_SVCNAME}.pid"
output_log="/var/log/vxsharkey.log"
error_log="/var/log/vxsharkey.err"

depend() {
    need net
    after firewall
}
```

```bash
chmod +x /etc/init.d/vxsharkey
rc-update add vxsharkey default
rc-service vxsharkey start
```

## Reverse Proxy Setup

### Nginx

Copy `nginx.conf` to `/etc/nginx/conf.d/vxsharkey.conf` and update:
- SSL certificate paths
- Server name (`vx.twitkey.com`)

```bash
nginx -t
systemctl reload nginx
```

### Caddy

Copy `Caddyfile` contents to your Caddy configuration. Caddy handles
TLS certificates automatically.

```bash
caddy reload
```

## Testing

### Run tests

```bash
npm test
```

### Example curl commands

```bash
# Health check
curl http://localhost:3000/health

# Metrics
curl http://localhost:3000/metrics

# Fetch a note embed (replace with a real instance and note ID)
curl http://localhost:3000/sharkey.example.com/notes/9xyzabc123

# Test invalid domain (should return 400)
curl http://localhost:3000/localhost/notes/abc123

# Test rate limiting headers (headers are returned regardless of upstream response)
curl -v http://localhost:3000/misskey.io/notes/abc123 2>&1 | grep X-RateLimit
```

## Monitoring

The `/metrics` endpoint returns JSON with:
- `cacheSize`: Current number of cached entries
- `uptime`: Server uptime in seconds
- `memoryUsage`: Node.js memory usage breakdown

## Updating

```bash
cd /opt/vxsharkey
git pull
npm install --production
systemctl restart vxsharkey  # or: rc-service vxsharkey restart
```
