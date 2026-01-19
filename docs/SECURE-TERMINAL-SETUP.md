# Secure Web Terminal Setup Guide

This documents the secure web terminal setup that allows Claude Code to be accessed via a webpage embedded in the Island Goodes admin dashboard.

## Overview

The setup uses:
- **ttyd** - Terminal emulator that runs in a web browser
- **tmux** - Terminal multiplexer for persistent sessions
- **nginx** - Reverse proxy with SSL and access restrictions
- **Let's Encrypt** - Free SSL certificates via certbot

## Architecture

```
[Browser] → [Nginx :443 SSL] → [ttyd :7681 localhost] → [tmux session] → [Claude Code]
                ↑
        Only allows requests from islandgoodes.com
```

## Prerequisites

- Ubuntu/Debian server with root access
- Domain with DNS pointing to server (e.g., terminal.islandgoodes.com)
- Ports 80 and 443 open

## Installation Steps

### 1. Install Required Packages

```bash
apt-get update
apt-get install -y nginx tmux certbot python3-certbot-nginx

# Install ttyd
wget https://github.com/tsl0922/ttyd/releases/download/1.7.7/ttyd.x86_64 -O /usr/bin/ttyd
chmod +x /usr/bin/ttyd
```

### 2. Create ttyd Systemd Service

Create `/etc/systemd/system/ttyd-secure.service`:

```ini
[Unit]
Description=Secure Web Terminal (ttyd)
After=network.target

[Service]
Type=simple
User=root
Environment=TERM=xterm-256color
ExecStart=/usr/bin/ttyd \
    --port 7681 \
    --interface 127.0.0.1 \
    --writable \
    --credential admin:YOUR_SECURE_PASSWORD_HERE \
    -t enableSixel=true \
    -t enableTrzsz=true \
    /bin/bash -c "tmux attach-session -t islandgoodes || tmux new-session -s islandgoodes"
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

**Key options:**
- `--port 7681` - Local port (not exposed publicly)
- `--interface 127.0.0.1` - Only listen on localhost (nginx proxies to this)
- `--writable` - Allow input (not read-only)
- `--credential` - Basic auth username:password
- `enableSixel` - Image support in terminal
- `enableTrzsz` - File transfer support
- tmux command - Attaches to existing session or creates new one

### 3. Create Nginx Configuration

Create `/etc/nginx/sites-available/terminal-islandgoodes`:

```nginx
# Secure terminal proxy for Island Goodes
# Accessible via iframe from islandgoodes.com admin pages

server {
    listen 80;
    server_name terminal.islandgoodes.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name terminal.islandgoodes.com;

    ssl_certificate /etc/letsencrypt/live/terminal.islandgoodes.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/terminal.islandgoodes.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    location / {
        # Security: Only allow from islandgoodes.com
        # Check both Referer (HTTP) and Origin (WebSocket)

        set $allowed 0;

        # Allow if Referer contains islandgoodes.com
        if ($http_referer ~* "islandgoodes\.com") {
            set $allowed 1;
        }

        # Allow if Origin is from islandgoodes.com (for WebSocket)
        if ($http_origin ~* "islandgoodes\.com") {
            set $allowed 1;
        }

        if ($allowed = 0) {
            return 403 "Access denied. Terminal only accessible from islandgoodes.com/admin/terminal";
        }

        proxy_pass http://127.0.0.1:7681;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
        proxy_buffering off;
    }
}
```

### 4. Enable Site and Get SSL Certificate

```bash
# Enable the site
ln -s /etc/nginx/sites-available/terminal-islandgoodes /etc/nginx/sites-enabled/

# Test nginx config
nginx -t

# Get SSL certificate (will modify nginx config automatically)
certbot --nginx -d terminal.islandgoodes.com

# Reload nginx
systemctl reload nginx
```

### 5. Start and Enable Services

```bash
# Reload systemd
systemctl daemon-reload

# Enable and start ttyd
systemctl enable ttyd-secure
systemctl start ttyd-secure

# Check status
systemctl status ttyd-secure
```

### 6. DNS Configuration

Add an A record in your DNS:
```
terminal.islandgoodes.com → YOUR_SERVER_IP
```

## Security Layers

1. **SSL/TLS** - All traffic encrypted via Let's Encrypt certificate
2. **Nginx Referrer Check** - Only accepts requests from islandgoodes.com
3. **ttyd Basic Auth** - Username/password required
4. **Localhost Binding** - ttyd only listens on 127.0.0.1, not exposed directly
5. **Admin Page Protection** - The /admin/terminal page requires admin login

## Embedding in Admin Page

The terminal is embedded in `/admin/terminal` page via iframe:

```html
<iframe
    src="https://terminal.islandgoodes.com"
    style="width: 100%; height: 80vh; border: none;"
    allow="clipboard-read; clipboard-write"
></iframe>
```

## Maintenance Commands

```bash
# Check service status
systemctl status ttyd-secure

# View logs
journalctl -u ttyd-secure -f

# Restart service
systemctl restart ttyd-secure

# List tmux sessions
tmux ls

# Attach to session manually (for debugging)
tmux attach-session -t islandgoodes

# Renew SSL certificate (auto-renewal should be set up by certbot)
certbot renew
```

## Troubleshooting

### Terminal not loading
1. Check ttyd is running: `systemctl status ttyd-secure`
2. Check nginx is running: `systemctl status nginx`
3. Check nginx error log: `tail -f /var/log/nginx/error.log`

### 403 Forbidden
- Ensure you're accessing from islandgoodes.com domain
- Check nginx Referer/Origin configuration

### Connection drops
- Check `proxy_read_timeout` in nginx (set to 86400 = 24 hours)
- Check if tmux session is still alive: `tmux ls`

### SSL certificate issues
- Run `certbot renew --dry-run` to test renewal
- Check certificate expiry: `certbot certificates`

## Changing the Password

1. Generate a secure password
2. Edit `/etc/systemd/system/ttyd-secure.service`
3. Update the `--credential admin:NEW_PASSWORD` line
4. Reload and restart:
   ```bash
   systemctl daemon-reload
   systemctl restart ttyd-secure
   ```
