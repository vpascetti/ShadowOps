ShadowOps Pilot - Enabling HTTPS/TLS
====================================

For manufacturing systems, HTTPS is REQUIRED for security.
This guide shows how to enable HTTPS in ShadowOps Pilot.


QUICK START (Self-Signed Certificate)
=====================================

For pilots, a self-signed certificate is acceptable while testing.

Step 1: Generate Self-Signed Certificate

Run this command from the ShadowOps directory:

  openssl req -x509 -newkey rsa:4096 -nodes \
    -out cert.pem -keyout key.pem -days 365 \
    -subj "/C=US/ST=Manufacturing/L=Plant/O=YourCompany/CN=localhost"

This creates:
  - cert.pem (public certificate)
  - key.pem (private key)
  - Valid for 365 days

Step 2: Create certificates directory

  mkdir -p ./certs
  mv cert.pem ./certs/
  mv key.pem ./certs/
  chmod 600 ./certs/key.pem
  chmod 644 ./certs/cert.pem

Step 3: Update docker-compose

Change port mapping in docker-compose.yml:

  web:
    ports:
      - '443:443'  # HTTPS port (was 5173)
    volumes:
      - ./certs:/etc/ssl/certs:ro  # Add this line
      - ./certs:/etc/ssl/private:ro  # Add this line

Step 4: Update nginx.conf

In nginx.conf, update the server block:

  server {
      listen 80;
      listen 443 ssl;
      
      ssl_certificate /etc/ssl/certs/cert.pem;
      ssl_certificate_key /etc/ssl/private/key.pem;
      
      # Security headers
      add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
      add_header X-Content-Type-Options "nosniff" always;
      add_header X-Frame-Options "DENY" always;
      add_header X-XSS-Protection "1; mode=block" always;
      
      # Redirect HTTP to HTTPS
      if ($scheme != "https") {
          return 301 https://$server_name$request_uri;
      }
      
      # Rest of nginx configuration...
  }

Step 5: Restart services

  docker-compose stop
  docker-compose up -d

Step 6: Test

Open browser: https://localhost:5173

You'll see a certificate warning (expected for self-signed):
  - Firefox: "This Connection is Untrusted"
  - Chrome: "Your connection is not private"
  - Click "Advanced" and "Accept the Risk"

Access the application - it's now secure!


PRODUCTION: Using a Real Certificate
=====================================

For actual production pilots (or after pilot), use a real certificate.

Option 1: Free Certificate from Let's Encrypt

Step 1: Install certbot

  sudo apt-get install certbot python3-certbot-nginx

Step 2: Generate certificate (you need a domain name)

  sudo certbot certonly --standalone \
    -d yourdomain.com \
    --email admin@company.com \
    --agree-tos

This generates:
  /etc/letsencrypt/live/yourdomain.com/fullchain.pem
  /etc/letsencrypt/live/yourdomain.com/privkey.pem

Step 3: Copy to certs directory

  sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem ./certs/cert.pem
  sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem ./certs/key.pem
  sudo chmod 644 ./certs/cert.pem
  sudo chmod 600 ./certs/key.pem

Step 4: Setup auto-renewal

  Create ./renew-cert.sh:
  
    #!/bin/bash
    certbot renew --quiet
    cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem ./certs/cert.pem
    cp /etc/letsencrypt/live/yourdomain.com/privkey.pem ./certs/key.pem
    docker-compose restart web

  Make executable:
    chmod +x ./renew-cert.sh
  
  Add to crontab (runs monthly):
    0 0 1 * * /path/to/renew-cert.sh

Step 5: Configure DNS

Point your domain to the server:
  yourdomain.com A record → your-server-ip

Step 6: Update nginx.conf

  server_name yourdomain.com;

Step 7: Restart

  docker-compose restart web


Option 2: Purchase Certificate from CA

Alternative: Buy certificate from:
  - DigiCert
  - Sectigo
  - GlobalSign
  - Others

Process:
  1. Purchase certificate
  2. CA provides cert files and private key
  3. Place in ./certs/
  4. Update nginx.conf with your domain
  5. Restart services


NGINX SSL Configuration Best Practices
======================================

Add these to nginx.conf for security:

TLS Version:
  ssl_protocols TLSv1.2 TLSv1.3;

Cipher suites:
  ssl_ciphers HIGH:!aNULL:!MD5;
  ssl_prefer_server_ciphers on;

Session configuration:
  ssl_session_cache shared:SSL:10m;
  ssl_session_timeout 10m;

HSTS (HTTP Strict Transport Security):
  add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

Security headers:
  add_header X-Content-Type-Options "nosniff" always;
  add_header X-Frame-Options "DENY" always;
  add_header X-XSS-Protection "1; mode=block" always;
  add_header Referrer-Policy "strict-origin-when-cross-origin" always;

Complete secure nginx block:

  server {
      listen 80;
      listen 443 ssl http2;
      server_name localhost;
      
      # SSL Configuration
      ssl_certificate /etc/ssl/certs/cert.pem;
      ssl_certificate_key /etc/ssl/private/key.pem;
      
      ssl_protocols TLSv1.2 TLSv1.3;
      ssl_ciphers HIGH:!aNULL:!MD5;
      ssl_prefer_server_ciphers on;
      
      ssl_session_cache shared:SSL:10m;
      ssl_session_timeout 10m;
      
      # Security Headers
      add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
      add_header X-Content-Type-Options "nosniff" always;
      add_header X-Frame-Options "DENY" always;
      add_header X-XSS-Protection "1; mode=block" always;
      add_header Referrer-Policy "strict-origin-when-cross-origin" always;
      
      # Redirect HTTP to HTTPS
      if ($scheme != "https") {
          return 301 https://$server_name$request_uri;
      }
      
      # Logging
      access_log /var/log/nginx/access.log;
      error_log /var/log/nginx/error.log warn;
      
      # Root location
      location / {
          root /usr/share/nginx/html;
          try_files $uri $uri/ /index.html;
      }
      
      # API proxy
      location /api/ {
          proxy_pass http://api:5050/;
          proxy_set_header Host $host;
          proxy_set_header X-Real-IP $remote_addr;
          proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
          proxy_set_header X-Forwarded-Proto $scheme;
          proxy_redirect off;
      }
      
      # Health check
      location /health {
          access_log off;
          return 200 "ok\n";
          add_header Content-Type text/plain;
      }
  }


CERTIFICATE RENEWAL REMINDERS
==============================

Self-signed: 
  - Expires after 365 days
  - Set calendar reminder 30 days before expiration
  - Regenerate: openssl ... (see above)

Let's Encrypt:
  - Expires after 90 days
  - Certbot renews automatically (check monthly)
  - Create backup before renewal

Commercial:
  - Check CA renewal dates
  - Most auto-renew if enabled
  - Plan renewal 60 days ahead


TESTING HTTPS
=============

After enabling HTTPS, verify:

1. Test in browser
   https://localhost:5173
   - Should load with certificate info
   - Click lock icon should show certificate

2. Test API connectivity
   curl -k https://localhost:5050/health
   (use -k to ignore self-signed warning)

3. Check TLS version
   openssl s_client -connect localhost:443 -tls1_2

4. Security scan
   Use: https://www.ssllabs.com/ssltest/ (for public URLs)


TROUBLESHOOTING
===============

Certificate not found?
  ERROR: No such file or directory: ./certs/cert.pem
  
  Fix: Make sure you created certs/ and ran openssl command

Certificate expired?
  Browser shows: "Certificate has expired"
  
  Fix: Regenerate or renew certificate (see above)

nginx not starting?
  ERROR: [emerg] SSL_ERROR_NODECODE or SSL errors
  
  Fix: Check certificate path in nginx.conf matches reality
       chmod 600 on key.pem
       Check for typos in file paths

Browser certificate warning?
  For self-signed: Expected! Click "Advanced" and continue
  For real cert: Not expected - check certificate validity

API not accessible through nginx?
  Make sure API service is running
  Check /api/ proxy configuration in nginx.conf
  docker-compose logs web


CERTIFICATE SECURITY
====================

Protect your private key:

  chmod 600 ./certs/key.pem
  
Never:
  - Share private key
  - Commit to version control
  - Display in logs
  - Put in emails
  - Add to backups without encryption

Only public certificate (cert.pem) is safe to share:
  chmod 644 ./certs/cert.pem


ADVANCED: Certificate Pinning
==============================

For extra security (not required for pilot):

In API client or browser extension, pin the certificate:
  - Certificate pinning prevents MITM attacks
  - Requires certificate doesn't change unexpectedly
  - Breaks if you forget to update before renewal

Setup:
  1. Extract certificate hash
  2. Configure client to only accept that hash
  3. Update hash when renewing certificate

Not recommended for pilots - just use HTTPS.


Questions?
==========

SSL Certificate questions:
  - Mozilla SSL Configuration Generator: https://ssl-config.mozilla.org/
  - OWASP TLS Cheat Sheet: https://cheatsheetseries.owasp.org/

Let's Encrypt:
  - https://letsencrypt.org/docs/

Self-signed certificates:
  - https://www.ssl.com/article/self-signed-certificates/
