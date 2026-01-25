# Deploying Whiskey Canon Blinds on GCP VM with Nginx

This guide covers deploying the application on a Google Cloud Platform Virtual Machine using Nginx as a reverse proxy.

## Prerequisites

- GCP account with billing enabled
- Domain name (optional, but recommended for HTTPS)
- Basic familiarity with Linux command line

---

## 1. Create a GCP Virtual Machine

### Via GCP Console

1. Go to **Compute Engine** > **VM instances**
2. Click **Create Instance**
3. Configure the VM:
   - **Name**: `whiskey-canon-blinds`
   - **Region**: Choose closest to your users
   - **Machine type**: `e2-small` (2 vCPU, 2GB memory) minimum
   - **Boot disk**: Ubuntu 22.04 LTS, 20GB SSD
   - **Firewall**: Check "Allow HTTP traffic" and "Allow HTTPS traffic"
4. Click **Create**

### Via gcloud CLI

```bash
gcloud compute instances create whiskey-canon-blinds \
  --zone=us-central1-a \
  --machine-type=e2-small \
  --image-family=ubuntu-2204-lts \
  --image-project=ubuntu-os-cloud \
  --boot-disk-size=20GB \
  --tags=http-server,https-server
```

---

## 2. Connect to the VM

```bash
gcloud compute ssh whiskey-canon-blinds --zone=us-central1-a
```

Or use the SSH button in the GCP Console.

---

## 3. Install Dependencies

### Update system packages

```bash
sudo apt update && sudo apt upgrade -y
```

### Install Node.js 20.x

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### Install Nginx

```bash
sudo apt install -y nginx
```

### Install PM2 (Process Manager)

```bash
sudo npm install -g pm2
```

### Install Git

```bash
sudo apt install -y git
```

---

## 4. Clone and Build the Application

### Clone the repository

```bash
cd /opt
sudo git clone https://github.com/DamageLabs/whiskey-canon-blinds.git
sudo chown -R $USER:$USER whiskey-canon-blinds
cd whiskey-canon-blinds
```

### Install dependencies

```bash
npm install
```

### Create environment file

```bash
cat > .env << 'EOF'
# Server Configuration
PORT=3001
NODE_ENV=production

# JWT Secret (generate a secure random string)
JWT_SECRET=your-secure-random-string-here-change-this

# Database
DATABASE_PATH=./data/whiskey.db

# CORS (your domain or VM's external IP)
CORS_ORIGIN=https://yourdomain.com
EOF
```

Generate a secure JWT secret:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### Build the frontend

```bash
npm run build
```

### Build the server

```bash
npm run build:server
```

### Initialize the database

```bash
mkdir -p data
node -e "require('./server/dist/db/index.js')"
```

---

## 5. Configure PM2 to Run the Server

### Create PM2 ecosystem file

```bash
cat > ecosystem.config.cjs << 'EOF'
module.exports = {
  apps: [{
    name: 'whiskey-canon-blinds',
    script: './server/dist/index.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    error_file: './logs/error.log',
    out_file: './logs/output.log',
    merge_logs: true,
    time: true
  }]
};
EOF

mkdir -p logs
```

### Start the application

```bash
pm2 start ecosystem.config.cjs
```

### Configure PM2 to start on boot

```bash
pm2 startup systemd
pm2 save
```

### Useful PM2 commands

```bash
pm2 status          # Check status
pm2 logs            # View logs
pm2 restart all     # Restart application
pm2 stop all        # Stop application
```

---

## 6. Configure Nginx

### Create Nginx configuration

```bash
sudo nano /etc/nginx/sites-available/whiskey-canon-blinds
```

Paste the following configuration:

```nginx
server {
    listen 80;
    server_name yourdomain.com;  # Replace with your domain or VM's external IP

    # Frontend static files
    root /opt/whiskey-canon-blinds/dist;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    # API proxy
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket proxy for Socket.io
    location /socket.io {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Uploads directory
    location /uploads {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # SPA fallback - serve index.html for all other routes
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### Enable the site

```bash
sudo ln -s /etc/nginx/sites-available/whiskey-canon-blinds /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default  # Remove default site
```

### Test and reload Nginx

```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## 7. Configure Firewall (if using ufw)

```bash
sudo ufw allow 'Nginx Full'
sudo ufw allow OpenSSH
sudo ufw enable
```

---

## 8. Set Up HTTPS with Let's Encrypt (Recommended)

### Install Certbot

```bash
sudo apt install -y certbot python3-certbot-nginx
```

### Obtain SSL certificate

```bash
sudo certbot --nginx -d yourdomain.com
```

Follow the prompts. Certbot will automatically configure Nginx for HTTPS.

### Auto-renewal

Certbot sets up auto-renewal automatically. Test it with:

```bash
sudo certbot renew --dry-run
```

---

## 9. Update Frontend API URL

After setting up the domain, update the frontend to use the correct API URL.

### Create production environment file

```bash
cat > .env.production << 'EOF'
VITE_API_URL=https://yourdomain.com/api
EOF
```

### Rebuild the frontend

```bash
npm run build
```

---

## 10. Maintenance

### View logs

```bash
# Application logs
pm2 logs whiskey-canon-blinds

# Nginx access logs
sudo tail -f /var/log/nginx/access.log

# Nginx error logs
sudo tail -f /var/log/nginx/error.log
```

### Update the application

```bash
cd /opt/whiskey-canon-blinds
git pull origin main
npm install
npm run build
npm run build:server
pm2 restart all
```

### Backup the database

```bash
# Create backup
cp /opt/whiskey-canon-blinds/data/whiskey.db ~/backups/whiskey-$(date +%Y%m%d).db

# Or use cron for automated backups
crontab -e
# Add: 0 2 * * * cp /opt/whiskey-canon-blinds/data/whiskey.db /home/$USER/backups/whiskey-$(date +\%Y\%m\%d).db
```

---

## Troubleshooting

### Application not starting

```bash
pm2 logs whiskey-canon-blinds --lines 50
```

### 502 Bad Gateway

Check if the Node.js server is running:

```bash
pm2 status
curl http://localhost:3001/api/auth/me
```

### WebSocket connection issues

Ensure the `/socket.io` location block is configured in Nginx with proper WebSocket headers.

### Permission issues

```bash
sudo chown -R $USER:$USER /opt/whiskey-canon-blinds
chmod -R 755 /opt/whiskey-canon-blinds
```

### Check Nginx configuration

```bash
sudo nginx -t
sudo systemctl status nginx
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         Internet                             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    GCP Virtual Machine                       │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                      Nginx (:80/:443)                 │  │
│  │  - SSL termination                                    │  │
│  │  - Static file serving (dist/)                        │  │
│  │  - Reverse proxy to Node.js                           │  │
│  └───────────────────────────────────────────────────────┘  │
│                              │                               │
│              ┌───────────────┴───────────────┐              │
│              ▼                               ▼              │
│  ┌─────────────────────┐      ┌─────────────────────────┐  │
│  │   /api/* requests   │      │   /socket.io requests   │  │
│  └─────────────────────┘      └─────────────────────────┘  │
│              │                               │              │
│              └───────────────┬───────────────┘              │
│                              ▼                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              Node.js Server (:3001)                   │  │
│  │  - Express API                                        │  │
│  │  - Socket.io WebSocket server                         │  │
│  │  - SQLite database                                    │  │
│  │  - Managed by PM2                                     │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## Cost Estimate

| Resource | Specification | Monthly Cost (approx) |
|----------|--------------|----------------------|
| VM (e2-small) | 2 vCPU, 2GB RAM | ~$13 |
| Boot disk | 20GB SSD | ~$2 |
| Network egress | 1GB | Free tier |
| **Total** | | **~$15/month** |

*Costs vary by region. Check [GCP Pricing Calculator](https://cloud.google.com/products/calculator) for accurate estimates.*
