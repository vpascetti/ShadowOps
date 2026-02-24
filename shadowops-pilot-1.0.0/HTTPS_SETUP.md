HTTPS Setup (If Needed)
======================

Only needed if ShadowOps will be accessed over network.
If testing on localhost only, skip this.


SELF-SIGNED CERTIFICATE (5 Minutes)
===================================

For pilot testing:

1. Generate certificate:

   openssl req -x509 -newkey rsa:4096 -nodes \
     -out cert.pem -keyout key.pem -days 365 \
     -subj "/C=US/ST=State/L=City/O=Company/CN=localhost"

2. Create certs directory:

   mkdir -p ./certs
   mv cert.pem ./certs/
   mv key.pem ./certs/

3. Update docker-compose.yml ports:

   web:
     ports:
       - '443:443'  # Change from 5173 to 443

4. Update docker-compose.yml volumes:

   web:
     volumes:
       - ./certs:/etc/ssl/certs:ro

5. Update nginx.conf:

   Add to server block:
     listen 443 ssl;
     ssl_certificate /etc/ssl/certs/cert.pem;
     ssl_certificate_key /etc/ssl/certs/key.pem;

6. Restart:

   docker-compose down
   docker-compose up -d

7. Test:

   https://localhost:443
   
   Browser warns about self-signed cert - normal.
   Data is encrypted.

Done.


FOR PRODUCTION: Let your IT team use Let's Encrypt or real certificate.
