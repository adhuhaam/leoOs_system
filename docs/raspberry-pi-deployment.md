# Deploying LEO OS on Raspberry Pi 4 Model B

A complete guide to running the full LEO OS stack (API server + PostgreSQL + web frontend) on a Raspberry Pi 4 running Ubuntu Server.

## Hardware requirements

| Item | Minimum | Recommended |
|------|---------|-------------|
| Model | Pi 4 (2 GB RAM) | Pi 4 (4 GB RAM) |
| Storage | 16 GB SD card | 32 GB SD card (Class 10 / A2) |
| OS | Ubuntu Server 22.04 LTS (64-bit ARM) | Ubuntu Server 24.04 LTS (64-bit ARM) |
| Network | Wired ethernet | Wired ethernet |

> **Note on Tesseract OCR and RAM:** Tesseract loads the English language model (~50 MB) into memory. On a 2 GB Pi you will be close to the limit with PostgreSQL + Node.js + Tesseract all running simultaneously. 4 GB is more comfortable.

---

## 1. Flash Ubuntu Server

1. Download [Ubuntu Server 22.04 LTS for Raspberry Pi (ARM64)](https://ubuntu.com/download/raspberry-pi) — choose the **64-bit** image.
2. Flash it to the SD card using [Raspberry Pi Imager](https://www.raspberrypi.com/software/) or `dd`.
3. During flashing (Raspberry Pi Imager → gear icon), set:
   - Hostname: `leoos` (or whatever you prefer)
   - Username + password
   - Wi-Fi credentials (if not using ethernet)
   - Enable SSH

Boot the Pi, find its IP on your router, and SSH in:
```bash
ssh ubuntu@<pi-ip>
```

---

## 2. System packages

```bash
sudo apt update && sudo apt upgrade -y

# Runtime dependencies
sudo apt install -y \
  curl git nginx \
  postgresql postgresql-contrib \
  ghostscript \         # needed by pdf2pic
  libjpeg-dev libpng-dev   # needed by sharp

# Node.js 22 (LTS) via NodeSource
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# pnpm
npm install -g pnpm pm2
```

---

## 3. PostgreSQL setup

```bash
sudo -u postgres psql <<'SQL'
CREATE USER leoos WITH PASSWORD 'choose-a-strong-password';
CREATE DATABASE leoos OWNER leoos;
GRANT ALL PRIVILEGES ON DATABASE leoos TO leoos;
SQL
```

The `DATABASE_URL` for your `.env` will be:
```
DATABASE_URL=postgresql://leoos:choose-a-strong-password@localhost:5432/leoos
```

---

## 4. Clone and configure the project

```bash
cd /home/ubuntu
git clone <your-repo-url> leo-os
cd leo-os

# Create environment file for the API server
cat > artifacts/api-server/.env <<'ENV'
DATABASE_URL=postgresql://leoos:choose-a-strong-password@localhost:5432/leoos
SESSION_SECRET=generate-a-long-random-string
APP_PASSWORD=your-app-password
NODE_ENV=production
PORT=8080
BASE_PATH=/api
ENV
```

> **Generate a session secret:** `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

---

## 5. Install dependencies and build

```bash
# Install all workspace dependencies (first run downloads Tesseract language data)
pnpm install

# Approve native build scripts (sharp needs this)
pnpm approve-builds
# Select: sharp

# Push the DB schema (creates all tables)
pnpm --filter @workspace/db run push

# Build the API server bundle
pnpm --filter @workspace/api-server run build

# Build the web frontend (static files)
pnpm --filter @workspace/passport-ocr run build
```

The built files land at:
- API server: `artifacts/api-server/dist/index.mjs`
- Web frontend: `artifacts/passport-ocr/dist/` (static HTML/JS/CSS)

---

## 6. Tesseract language data (offline use)

On first OCR request, `tesseract.js` downloads `eng.traineddata` (~4 MB) from the internet and caches it in `~/.cache/tessdata/` (or a platform-specific path). This happens once automatically.

**If the Pi has no internet access**, pre-download the file before deploying:

```bash
# On a machine with internet access:
mkdir -p ~/.cache/tessdata
curl -L -o ~/.cache/tessdata/eng.traineddata \
  https://github.com/naptha/tessdata/releases/download/4.0.0/eng.traineddata.gz \
  | gunzip > ~/.cache/tessdata/eng.traineddata

# Copy to the Pi (adjust path as needed)
scp ~/.cache/tessdata/eng.traineddata ubuntu@<pi-ip>:~/.cache/tessdata/
```

---

## 7. PM2 process manager

PM2 keeps the API server running after reboots and restarts it if it crashes.

```bash
# Start the API server
pm2 start artifacts/api-server/dist/index.mjs \
  --name "leo-api" \
  --env production

# Save the process list so it survives reboots
pm2 save
pm2 startup  # follow the printed command to enable autostart
```

Check logs:
```bash
pm2 logs leo-api
pm2 status
```

---

## 8. Nginx reverse proxy

Nginx routes `/api` to the Node.js server and serves the built frontend static files directly.

```bash
sudo nano /etc/nginx/sites-available/leoos
```

Paste:

```nginx
server {
    listen 80;
    server_name _;          # replace with leomaldives.com if using a domain

    # Serve the React frontend (built static files)
    root /home/ubuntu/leo-os/artifacts/passport-ocr/dist;
    index index.html;

    # API — proxy to Node.js
    location /api/ {
        proxy_pass         http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   Upgrade           $http_upgrade;
        proxy_set_header   Connection        keep-alive;
        # Increase timeout for OCR (Tesseract can take 5–15 s on Pi)
        proxy_read_timeout 120s;
        client_max_body_size 20M;
    }

    # All other paths — let React Router handle them
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/leoos /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl restart nginx
```

The app is now live at `http://<pi-ip>/`.

---

## 9. Optional: HTTPS with Let's Encrypt

Only needed if the Pi is exposed to the internet with a real domain (e.g. `leomaldives.com`).

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d leomaldives.com
```

Certbot auto-renews every 60 days. Verify: `sudo certbot renew --dry-run`.

---

## 10. Keeping the app up to date

```bash
cd /home/ubuntu/leo-os
git pull

pnpm install
pnpm --filter @workspace/db run push    # apply any new DB migrations
pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/passport-ocr run build

pm2 restart leo-api
sudo systemctl reload nginx
```

---

## Performance expectations on Pi 4

| Operation | Pi 4 (2 GB) | Pi 4 (4 GB) |
|-----------|-------------|-------------|
| Server startup | ~5 s | ~3 s |
| Tesseract worker init (first request) | ~8–12 s | ~5–8 s |
| OCR per passport (subsequent) | ~8–15 s | ~5–10 s |
| Page load (frontend) | instant | instant |
| Concurrent OCR jobs | 1 at a time | 1–2 at a time |

OCR is the bottleneck. The singleton Tesseract worker is reused across requests so initialization only happens once after each server start.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `sharp` fails to load | Run `pnpm approve-builds` and select `sharp` |
| PDF upload fails | Install `ghostscript`: `sudo apt install -y ghostscript` |
| Tesseract hangs | First request downloads `eng.traineddata` — wait ~30 s or pre-download |
| `ENOMEM` / out of memory | Upgrade to 4 GB Pi or add a 1 GB swap file |
| 502 Bad Gateway | Check `pm2 logs leo-api` — API may have crashed |
| Port 8080 not reachable | PM2 process not running; run `pm2 restart leo-api` |

### Add swap (for 2 GB Pi)

```bash
sudo fallocate -l 1G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```
