# Dashboard Remote Access Guide

## VPS Access

Your ohmarwtf dashboard is running on a VPS and accessible remotely.

### Direct Access (HTTP)

**Dashboard URL**: `http://72.60.110.67:3000`

The dashboard server is configured to listen on all network interfaces (`0.0.0.0`), and port 3000 is open in the firewall.

### Starting the Agent

```bash
cd /opt/ohmarwtf
npm run dev
```

Once the agent starts, you'll see:
```
Dashboard server running on port 3000 (accessible on all interfaces)
```

Then open your browser to: **http://72.60.110.67:3000**

---

## Security Warnings ⚠️

### Current State: NO AUTHENTICATION

The dashboard currently has **NO authentication or encryption**. Anyone who knows your IP address can:
- View all agent data (positions, trades, state)
- Pause/resume trading
- Enable safe mode
- See your capital and PnL

### Immediate Security Recommendations

**Option 1: SSH Tunnel (Recommended for Development)**

Instead of accessing directly, create an SSH tunnel:

```bash
# On your local machine
ssh -L 3000:localhost:3000 root@72.60.110.67
```

Then access dashboard at: `http://localhost:3000` (secure, encrypted via SSH)

**Option 2: Restrict Firewall to Your IP**

```bash
# On VPS - remove public access
sudo ufw delete allow 3000

# Allow only your IP (replace with your actual IP)
sudo ufw allow from YOUR_IP_HERE to any port 3000
```

**Option 3: Add Basic Authentication (Production)**

Add authentication middleware to the dashboard server:
- JWT tokens
- Session-based auth
- API keys
- OAuth

**Option 4: Use Reverse Proxy with HTTPS**

Set up nginx/Caddy with:
- HTTPS (Let's Encrypt SSL certificate)
- Basic authentication
- Rate limiting
- IP whitelisting

---

## Production Deployment Security Checklist

Before running with real money:

- [ ] Enable HTTPS with valid SSL certificate
- [ ] Add authentication (JWT, session, or API key)
- [ ] Implement IP whitelisting
- [ ] Add rate limiting
- [ ] Set up monitoring/alerts
- [ ] Use environment variables for secrets
- [ ] Enable CORS protection
- [ ] Add request logging
- [ ] Implement session timeouts
- [ ] Use reverse proxy (nginx/Caddy)

---

## Quick Security Setup: Nginx with Basic Auth

Here's a quick production-ready setup:

### 1. Install Nginx

```bash
sudo apt update
sudo apt install nginx apache2-utils
```

### 2. Create Basic Auth Password

```bash
sudo htpasswd -c /etc/nginx/.htpasswd admin
# Enter password when prompted
```

### 3. Configure Nginx

Create `/etc/nginx/sites-available/ohmarwtf-dashboard`:

```nginx
server {
    listen 80;
    server_name 72.60.110.67;  # or your domain name

    location / {
        auth_basic "ohmarwtf Dashboard";
        auth_basic_user_file /etc/nginx/.htpasswd;

        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 4. Enable and Restart

```bash
sudo ln -s /etc/nginx/sites-available/ohmarwtf-dashboard /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 5. Update Firewall

```bash
# Close direct access to port 3000
sudo ufw delete allow 3000

# Nginx will proxy through port 80 (already open)
```

Now access at `http://72.60.110.67` with username/password.

---

## For HTTPS (Let's Encrypt)

If you have a domain name pointed at your VPS:

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get SSL certificate (replace with your domain)
sudo certbot --nginx -d yourdomain.com

# Certbot will automatically configure HTTPS
```

---

## Current Configuration

**Server**: Binds to `0.0.0.0:3000` (all interfaces)
**Firewall**: Port 3000 open to public
**Authentication**: None (⚠️ **INSECURE**)
**Encryption**: None (HTTP only, not HTTPS)

**Status**: ⚠️ **DEVELOPMENT ONLY** - Do not use with real funds without securing first!

---

## Recommended: SSH Tunnel for Now

Until you set up proper authentication:

```bash
# On your local machine
ssh -L 3000:localhost:3000 root@72.60.110.67 -N

# Keep that terminal open, then browse to:
# http://localhost:3000
```

This keeps the dashboard private and encrypted through SSH.
