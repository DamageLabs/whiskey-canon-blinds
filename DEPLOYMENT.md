# Whiskey Canon Blinds — Production Deployment Guide

This guide covers deploying Whiskey Canon Blinds on the DamageLabs GCP VM.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Production Details](#production-details)
3. [Deploy Application](#deploy-application)
4. [Configure Environment](#configure-environment)
5. [Database Setup](#database-setup)
6. [systemd Service](#systemd-service)
7. [Nginx Configuration](#nginx-configuration)
8. [SSL with Let's Encrypt](#ssl-with-lets-encrypt)
9. [Maintenance](#maintenance)
10. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- GCP VM running Ubuntu 24.04 LTS
- Node.js installed at `/usr/local/bin/node`
- Nginx installed and running
- Git installed
- Domain DNS pointing to the VM's external IP

## Production Details

| Setting | Value |
|---------|-------|
| Domain | blinds.whiskey-canon.com |
| Port | 3003 |
| Directory | `/var/www/blinds.whiskey-canon.com` |
| User | `fusion94` |
| Process Manager | systemd (`whiskey-canon-blinds.service`) |
| Database | SQLite (`data/whiskey.db`) |
| Node Binary | `/usr/local/bin/node` |

---

## Deploy Application

### Initial Deploy

```bash
cd /var/www
sudo git clone https://github.com/DamageLabs/whiskey-canon-blinds.git blinds.whiskey-canon.com
sudo chown -R fusion94:fusion94 blinds.whiskey-canon.com
cd blinds.whiskey-canon.com

# Install dependencies
npm install

# Build server
npm run build:server

# Build client
npm run build
```

### Update Deploy

```bash
cd /var/www/blinds.whiskey-canon.com
git pull origin main
npm install
npm run build:server
npm run build
sudo systemctl restart whiskey-canon-blinds
```

---

## Configure Environment

```bash
cat > /var/www/blinds.whiskey-canon.com/.env << 'EOF'
# Server
PORT=3003
NODE_ENV=production

# Database
DATABASE_PATH=./data/whiskey.db

# Auth
JWT_SECRET=<run: openssl rand -hex 64>

# CORS
CORS_ORIGIN=https://blinds.whiskey-canon.com
CLIENT_URL=https://blinds.whiskey-canon.com

# Frontend
VITE_API_URL=https://blinds.whiskey-canon.com/api

# Email (Resend)
RESEND_API_KEY=<your-key>
FROM_EMAIL=Whiskey Canon <noreply@blinds.whiskey-canon.com>
EOF

chmod 600 /var/www/blinds.whiskey-canon.com/.env
```

---

## Database Setup

The SQLite database is stored at `data/whiskey.db` and initialized automatically on first run.

```bash
# Ensure data directory exists
mkdir -p /var/www/blinds.whiskey-canon.com/data
```

---

## systemd Service

### Create the Service

```bash
sudo tee /etc/systemd/system/whiskey-canon-blinds.service > /dev/null << 'EOF'
[Unit]
Description=Whiskey Canon Blinds (blinds.whiskey-canon.com)
After=network.target
StartLimitIntervalSec=60
StartLimitBurst=5

[Service]
Type=simple
User=fusion94
Group=fusion94
WorkingDirectory=/var/www/blinds.whiskey-canon.com
ExecStart=/usr/local/bin/node server/dist/index.js
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal
Environment=NODE_ENV=production
Environment=PORT=3003

NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF
```

### Enable and Start

```bash
sudo systemctl daemon-reload
sudo systemctl enable whiskey-canon-blinds
sudo systemctl start whiskey-canon-blinds
```

### Common Commands

```bash
sudo systemctl status whiskey-canon-blinds      # Check status
sudo systemctl restart whiskey-canon-blinds     # Restart
sudo systemctl stop whiskey-canon-blinds        # Stop
sudo journalctl -u whiskey-canon-blinds -f      # Follow logs
sudo journalctl -u whiskey-canon-blinds -n 50   # Last 50 lines
```

---

## Nginx Configuration

The Nginx config is version-controlled in `DamageLabs/brain` at `infra/nginx/sites-available/whiskey-canon-blinds`.

Key points:
- Static files served from `/var/www/blinds.whiskey-canon.com/dist`
- API requests proxied to `localhost:3003`
- Shared snippets: `security-headers.conf`, `static-cache.conf`

```bash
sudo ln -sf /etc/nginx/sites-available/whiskey-canon-blinds /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

---

## SSL with Let's Encrypt

```bash
sudo certbot --nginx -d blinds.whiskey-canon.com \
  --non-interactive --agree-tos -m fusion94@gmail.com
```

Auto-renewal test:
```bash
sudo certbot renew --dry-run
```

---

## Maintenance

### Database Backup

```bash
# Manual backup
cp /var/www/blinds.whiskey-canon.com/data/whiskey.db ~/backups/blinds-$(date +%Y%m%d-%H%M%S).db

# Automated daily backup (add to crontab)
0 2 * * * cp /var/www/blinds.whiskey-canon.com/data/whiskey.db /home/fusion94/backups/blinds-$(date +\%Y\%m\%d).db
```

### View Logs

```bash
sudo journalctl -u whiskey-canon-blinds -f
sudo tail -f /var/log/nginx/access.log
```

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Exit code 203 | Node binary not accessible | Verify `/usr/local/bin/node` exists |
| Exit code 1 | Missing env var | Check `.env` has JWT_SECRET, DATABASE_PATH |
| Port conflict | Another process on 3003 | `sudo ss -tlnp \| grep :3003` |
| 502 Bad Gateway | Service not running | `sudo systemctl start whiskey-canon-blinds` |
| CORS errors | Wrong CORS_ORIGIN | Must match exact domain including `https://` |

---

*Last updated: March 17, 2026*
