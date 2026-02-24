ShadowOps Pilot - Security Configuration Guide
================================================

CRITICAL: Manufacturing systems are high-value targets. Follow these security steps before production.


IMMEDIATE ACTIONS (Before Going Live)
======================================

1. CHANGE ALL DEFAULT PASSWORDS

Edit .env file:
   DB_PASSWORD=<STRONG_PASSWORD_HERE>
   
Requirements:
   - Minimum 16 characters
   - Mix of uppercase, lowercase, numbers, symbols
   - Not used elsewhere
   - Store securely (password manager)

2. SECURE YOUR IQMS CREDENTIALS

In .env file, ensure:
   IQMS_PASSWORD=<STRONG_PASSWORD>
   
Best practices:
   - Use a service account in IQMS specifically for ShadowOps
   - Limit that account to READ-ONLY access to necessary tables
   - Rotate credentials every 90 days
   - Never check credentials into version control

3. NETWORK ISOLATION

Your database should NOT be accessible from the internet:

Certificate that port 5432 is NOT open:
   netstat -tuln | grep 5432
   Should show: 127.0.0.1:5432 only (localhost only)

API port (5050) should be accessible only within your network:
   - Behind a firewall
   - Behind a VPN
   - Behind a reverse proxy with authentication
   - NOT exposed to the public internet

4. FIREWALL RULES

Set up firewall rules:

Port 5173 (Web UI):
   - Allow from: Authorized IP ranges only
   - Block: Public internet access

Port 5050 (API):
   - Allow from: Internal network only
   - Block: External traffic

Port 5432 (Database):
   - Allow from: localhost/127.0.0.1 only
   - Block: All remote connections

5. ENABLE HTTPS/TLS

For production (even pilot):
   1. Generate SSL certificate (self-signed OK for pilot)
   2. Configure in nginx.conf reverse proxy
   3. Redirect HTTP to HTTPS
   4. Set secure cookie flags

See section below for HTTPS setup.

6. ACCESS CONTROL

Implement authentication:
   - Require login for all users
   - Use strong password policy
   - Enable multi-factor auth if possible
   - Log all access attempts
   - Implement role-based access control (RBAC)

7. AUDIT LOGGING

Enable comprehensive logging:
   - API request logs (who, what, when)
   - Database change logs
   - Authentication logs (successes/failures)
   - Error logs with sufficient detail
   - Review logs weekly for suspicious activity

8. BACKUP & RECOVERY

Secure your backups:
   - Daily automated backups required
   - Store backups encrypted
   - Test restore procedure monthly
   - Store offsite backup copy
   - Encryption: Enable database encryption at rest


DATA SECURITY
=============

Credentials Storage
-------------------
File: .env (NEVER commit to git)

Protect it:
   1. File permissions: chmod 600 .env
   2. Encrypt at rest if possible
   3. Access: Admin only
   4. Audit: Log who accesses it
   5. Rotate: Change IQMS password quarterly

IQMS Connection
---------------
Credentials are stored in .env and used by the API:
   - API never logs credentials
   - API uses credentials only for IQMS queries
   - API should use connection pooling
   - IQMS should log all API connections

Data in Transit
----------------
Current: HTTP (INSECURE for production)
Required: HTTPS/TLS

Enable TLS:
   1. Generate self-signed cert (pilot): 
      openssl req -x509 -newkey rsa:4096 -nodes \
      -out cert.pem -keyout key.pem -days 365

   2. Place in: /path/to/certs/
   
   3. Update nginx.conf to:
      listen 443 ssl;
      ssl_certificate /etc/ssl/certs/cert.pem;
      ssl_certificate_key /etc/ssl/private/key.pem;

   4. Update docker-compose to mount certs

Data at Rest
------------
PostgreSQL database:
   - Data stored on disk unencrypted (by default)
   - Entire /var/lib/postgresql/data on encrypted filesystem
   - Backup files encrypted
   - Access logs: Enable PostgreSQL logging

   Enable PostgreSQL logging:
   In docker-compose, add to db service:
      command: -c log_statement=all -c log_duration=on


CONTAINER & IMAGE SECURITY
===========================

Docker Images
-------------
Current: node:20-alpine, nginx:alpine (good choices)

Best practices:
   1. Keep images updated: docker pull latest
   2. Scan for vulnerabilities: 
      docker scout cves shadowops-api:latest
   3. Don't run as root (already set in Dockerfile)
   4. Use read-only filesystems where possible
   5. Don't store secrets in images

Docker Compose
--------------
Add security options:

  api:
    build: ...
    security_opt:
      - no-new-privileges:true
    read_only: true
    tmpfs:
      - /tmp
      - /app/.npm
    cap_drop:
      - ALL
    cap_add:
      - NET_BIND_SERVICE

Container Isolation
-------------------
Run containers in user-defined network:

   docker network create shadowops-net
   
   services connect ONLY to each other, not host
   Database accessible only to API container


API SECURITY
============

Rate Limiting
-------------
Implement to prevent abuse:
   - Max 100 requests/minute per IP
   - Max 10 requests/minute for login attempts
   - Throttle file exports
   - Return 429 status code when limited

Authentication
---------------
Requirements:
   - All API endpoints require authentication
   - No anonymous data access
   - Use JWT or session tokens
   - Tokens expire after 1 hour of inactivity
   - Logout invalidates token immediately

Input Validation
----------------
All API inputs must be validated:
   - SQL injection prevention (use parameterized queries)
   - Command injection prevention
   - XSS prevention (sanitize output)
   - File upload restrictions
   - File size limits

CORS Configuration
------------------
Restrict cross-origin access:

   api:
     environment:
       CORS_ORIGIN: "http://localhost:5173"
   
   Whitelist only known origins
   Never use: CORS_ORIGIN="*"

Error Handling
--------------
Never expose internal details:
   BAD:  "Error: SELECT failed - column 'password' not found"
   GOOD: "An error occurred. Contact support."
   
   Log full errors server-side, show generic messages to users


IQMS CONNECTION SECURITY
=========================

Connection Method
------------------
Current: Likely direct TCP/IP

Secure options (in priority):
   1. VPN tunnel + SSL/TLS
   2. SSH tunnel
   3. Reverse proxy with SSL
   4. Direct connection with IP whitelist

Never:
   - Connect over unencrypted network
   - Use administrator accounts
   - Grant write access to IQMS


IQMS Service Account
---------------------
In IQMS, create dedicated account:

Permissions:
   - READ-ONLY access to:
      * WORK_ORDERS table
      * MAINTENANCE_SCHEDULE table
      * PLANT_STATUS table
      * EQUIPMENT_INFO table
   
   - NO write access
   - NO access to user/password tables
   - NO access to sensitive business data

Monitoring:
   - Enable IQMS audit logging
   - Monitor for:
      * Failed authentication attempts
      * Unusual query patterns
      * After-hours connections
      * Large data exports


DEPLOYMENT SECURITY
===================

Pre-Deployment Checklist
------------------------
Run before production:

   [ ] SSL/TLS certificate installed
   [ ] CORS whitelist configured
   [ ] Database password changed (16+ char, complex)
   [ ] IQMS credentials rotated (not default)
   [ ] Firewall rules verified
   [ ] Database port 5432 NOT exposed externally
   [ ] API rate limiting configured
   [ ] Authentication required on all endpoints
   [ ] Audit logging enabled
   [ ] Daily backup procedure tested
   [ ] Backup restore tested
   [ ] Error logs reviewed for no secrets exposure
   [ ] Security scanning completed (no critical vulns)
   [ ] Network isolation verified
   [ ] .env file secured (chmod 600)
   [ ] .env NOT in git repository
   [ ] Admin credentials documented securely
   [ ] Incident response plan documented
   [ ] Support team trained on security procedures


MONITORING & INCIDENT RESPONSE
===============================

What to Monitor
----------------
1. Authentication Failures
   - More than 5 failed attempts per user?
   - Alert after 3 failed login attempts
   - Block account after 10 failures (15 min)

2. Suspicious API Activity
   - Unusual query patterns?
   - Large data exports at 3 AM?
   - Someone accessing from unexpected location?

3. Database Activity
   - Schema changes (should be none in pilot)
   - Unusual DELETE operations
   - Large data modifications

4. System Health
   - Disk space (backups require space)
   - Memory usage (potential DoS)
   - CPU usage (possible attack)
   - Network traffic volume

5. Container Restarts
   - API unexpectedly restarting?
   - Database connection failures?
   - Config errors in logs?


Incident Response Plan
-----------------------
If you suspect a security incident:

   1. ISOLATE: Take system offline immediately
      docker-compose down
      
   2. PRESERVE: Don't delete anything
      - Save logs
      - Screenshot errors
      - Document timeline
      
   3. INVESTIGATE:
      - Review all logs from past 24 hours
      - Check for unauthorized changes
      - Analyze failed login attempts
      - Review database audit log
      
   4. NOTIFY:
      - Inform infosec team
      - Control information sharing
      - Prepare communication for affected users
      
   5. REMEDIATE:
      - Change all passwords
      - Rotate API keys
      - Update firewall rules if breach origin identified
      - Patch systems
      
   6. VALIDATE:
      - Verify system is secure
      - Run security tests
      - Restore from known-good backup if needed
      
   7. POST-INCIDENT:
      - Root cause analysis
      - Update security procedures
      - Implement preventive measures


COMPLIANCE CONSIDERATIONS
==========================

Depending on your industry/location, you may need:

NIST Cybersecurity Framework
   - Identify, Protect, Detect, Respond, Recover

CISA Guidelines
   - Especially for manufacturing/critical infrastructure

SOC 2 Type II (if customers demand)
   - Security, availability, integrity

HIPAA (if healthcare-related data)
   - Protected health information handling

GDPR (if EU customers/data)
   - Data privacy and user rights

Recommended:
   1. Document your security procedures
   2. Conduct security audit
   3. Implement access controls audit trail
   4. Regular penetration testing
   5. Incident response plan


ONGOING SECURITY MAINTENANCE
=============================

Monthly
-------
- Review access logs for anomalies
- Check for security advisories
- Verify backups completed successfully
- Test restoration from backup

Quarterly
---------
- Rotate API keys and passwords
- Update Docker images
- Run security vulnerability scan
- Review and update firewall rules

Annually
--------
- Full security audit
- Penetration testing
- Update SSL certificates
- Review and update incident response plan
- Security training for team


QUICK SECURITY CHECKLIST FOR PILOTS
====================================

Before first pilot user:

Network
   [ ] Database port 5432 blocked from internet (localhost only)
   [ ] API port 5050 behind firewall/VPN
   [ ] Web port 5173 restricted to authorized IPs

Credentials
   [ ] DB password changed to 16+ character complex password
   [ ] IQMS password set to strong value
   [ ] Credentials in .env secured (chmod 600)
   [ ] .env added to .gitignore (never check in)

Access Control
   [ ] Authentication required for all users
   [ ] User accounts created with unique passwords
   [ ] Password policy enforced (minimum requirements)

Data Protection
   [ ] Daily backups scheduled and tested
   [ ] HTTPS/TLS enabled (self-signed cert acceptable for pilot)
   [ ] IQMS connection over secure channel

Logging
   [ ] Audit logging enabled
   [ ] Logs retained for at least 90 days
   [ ] Log files secured (not world-readable)

Compliance
   [ ] Security procedures documented
   [ ] Incident response plan created
   [ ] Security risks documented
   [ ] Data classification documented


Questions?
==========

For security concerns specific to your environment:
   - Contact your security team
   - Consult with your network administrator
   - Review NIST Cybersecurity Framework guidelines
   - Consider security audit by third party


Last Updated: February 2026
This guide covers manufacturing industry best practices.
Customize based on your specific security requirements.
