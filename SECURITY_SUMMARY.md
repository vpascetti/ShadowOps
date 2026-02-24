ShadowOps Pilot - Security Summary
===================================

Manufacturing is a high-value target for cyber attacks.
This document summarizes security in ShadowOps Pilot.


WHAT'S SECURE BY DEFAULT
=========================

Container Isolation
  - API and database run in separate containers
  - Database is NOT exposed to host (only accessible via API)
  - Each container runs with minimal permissions

Authentication
  - All API endpoints require valid authentication
  - Session timeouts enforced
  - Failed login attempts tracked

Logging
  - All API requests logged
  - Authentication attempts logged
  - Error logging enabled

Dependencies
  - Alpine Linux base images (smaller attack surface)
  - Node.js 20 LTS (security patches included)
  - PostgreSQL 15 (recent version, security updates)
  - Nginx (hardened web server)

Code Security
  - No hardcoded credentials
  - Credentials passed via environment variables
  - Input validation on all endpoints
  - Protection against common attacks built in


WHAT YOU MUST CONFIGURE BEFORE PILOTS
======================================

Critical: MUST do these before any pilot user accesses the system

1. Change Database Password
   Location: .env file
   Current: DB_PASSWORD=shadowops_pass (DEFAULT - NOT SECURE)
   
   Required action:
     - Change to unique, strong password (16+ characters)
     - Mix uppercase, lowercase, numbers, symbols
     - Store securely in password manager
     - Do this FIRST, before anything else
   
   How: Edit .env, update DB_PASSWORD=...
        Then restart: docker-compose restart db

2. Secure IQMS Credentials
   Location: .env file
   
   Required actions:
     - IQMS_USER must be READ-ONLY account (not admin)
     - IQMS_PASSWORD must be strong (16+ characters)
     - IQMS account must have LIMITED permissions:
         READ: Work orders, maintenance, equipment, plant status
         WRITE: None
         DELETE: None
   
   Why: Limits blast radius if credentials compromised

3. Network Isolation
   Requirement: Database port 5432 must NOT be accessible from internet
   
   Verify:
     - netstat -tuln | grep 5432
     - Result should show: 127.0.0.1:5432 (localhost only)
   
   Protect:
     - API port 5050: Behind firewall, authorized IPs only
     - Web port 5173: Restricted to internal network or VPN
     - Database: Never expose to internet

4. Enable HTTPS
   Requirement: Data in transit must be encrypted
   
   For pilot: Self-signed certificate acceptable
   For production: Real certificate required
   
   How: Follow HTTPS_SETUP.md for step-by-step instructions
   
   Quick start:
     openssl req -x509 -newkey rsa:4096 -nodes \
       -out cert.pem -keyout key.pem -days 365

5. Setup Audit Logging
   Requirement: All important activities must be logged
   
   What's logged:
     - API requests (who, what, when)
     - Authentication (attempts, failures)
     - Data modifications (if any)
     - Errors (with context)
   
   Review:
     - Check logs daily for suspicious activity
     - Failed logins from unexpected locations?
     - Unusual data access patterns?
     - After-hours access?

6. Backup Strategy
   Requirement: Must be able to recover from data loss
   
   Setup:
     - Daily automated backups required
     - Backup storage has adequate space
     - Test restore procedure monthly
     - Backups secured (not publicly accessible)
   
   Quick test:
     docker-compose exec db pg_dump -U shadowops shadowops_db > backup.sql
     docker-compose exec -T db psql -U shadowops shadowops_db < backup.sql


OPTIONAL: ENHANCED SECURITY
============================

Not required for pilot, but recommended for production:

Rate Limiting
  - Limit API requests per IP/user
  - Prevent brute force, DoS attacks
  - Implemented in API layer

Multi-Factor Authentication (MFA)
  - Additional verification beyond password
  - Recommended for admin accounts

Single Sign-On (SSO)
  - Integrate with company AD/Okta
  - Centralized user management

Database Encryption at Rest
  - Data encrypted on disk
  - Requires encrypted filesystem or PostgreSQL encryption modules

VPN Access Only
  - Only accessible via VPN
  - Completely isolated from internet


BEFORE FIRST PILOT USER COMPLETES THIS CHECKLIST
==================================================

Security Pre-Launch Checklist

These must all be completed before pilot users access:

[ ] Database password changed (16+ chars, complex)
[ ] IQMS credentials set to non-admin account with READ-ONLY access
[ ] IQMS password changed to strong value (16+ chars)
[ ] Database port 5432 verified NOT exposed to internet
    (netstat -tuln | grep 5432 shows 127.0.0.1:5432 only)
[ ] API port 5050 behind firewall/VPN
[ ] Web port 5173 restricted to authorized IPs only
[ ] HTTPS certificate generated and configured
[ ] HTTP redirects to HTTPS verified
[ ] Audit logging verification (logs being generated)
[ ] Test backup created and restore tested
[ ] .env file protected (chmod 600)
[ ] .env NOT committed to git (.gitignore configured)
[ ] .env.example has NO credentials (only placeholders)

Signed off: ________________________  Date: ________

If ANY item is not complete, DO NOT START PILOT USERS.


IN-PILOT MONITORING CHECKLIST
==============================

While pilot users are testing, monitor:

Daily (each morning):
  [ ] Check for failed login attempts: docker-compose logs api | grep "login failed"
  [ ] Check for errors: docker-compose logs api | grep ERROR
  [ ] Verify backup completed successfully
  [ ] Audit log for unusual patterns

Weekly:
  [ ] Review all logs for security incidents
  [ ] Check firewall logs for blocked attempts
  [ ] Verify no new security vulnerabilities (docker scout)

Monthly:
  [ ] Security audit of configuration
  [ ] Test disaster recovery procedure
  [ ] Review user access - remove unused accounts
  [ ] Update security documentation


KNOWN SECURITY CONSIDERATIONS
==============================

Manufacturing as a Target
  - US CISA reports daily attacks on manufacturing
  - Common targets: IQMS, historians, PLC systems
  - ShadowOps is external to core production but accesses data

Pilot Risk Profile
  - Limited users (pilot team only)
  - Limited data (current operations only)
  - Limited access (internal network only)
  - Short duration (weeks to months)

Planned Mitigations
  - Firewall restricts network access
  - Audit logging tracks all activities
  - Database isolated (not exposed)
  - Backed up daily for recovery

Residual Risks (Accepted)
  - API compromise could expose work order data
  - API compromise could expose equipment status
  - Mitigation: API hardened, isolated network, audit logging
  - Recovery: Restore from backup, rotate credentials

Risk Level (with mitigations): LOW (for pilot with internal access only)


INCIDENT RESPONSE
=================

If you suspect a security incident:

1. IMMEDIATELY:
   docker-compose down
   (Takes system offline)

2. PRESERVE EVIDENCE:
   - Save all logs
   - Take screenshots of errors
   - Document timeline
   - Save .env file (protected location)

3. INVESTIGATE:
   - Review logs from past 24 hours
   - Check for unauthorized changes
   - Analyze failed logins
   - Look for unusual data access

4. NOTIFY:
   - Contact infosec team
   - Don't share credentials in unsecured channels
   - Prepare description of incident

5. REMEDIATE:
   - Change all passwords
   - Rotate API credentials
   - Patch any vulnerabilities
   - Restore from clean backup if needed

6. RE-ENABLE:
   - Rebuild containers
   - Verify all security settings
   - Test carefully
   - Resume gradually


COMPLIANCE & STANDARDS
======================

Applicable frameworks:
  - NIST Cybersecurity Framework
  - CISA Manufacturing Profile
  - OWASP Application Security
  - CIS Controls

Documentation:
  - SECURITY_GUIDE.md (comprehensive security guide)
  - PILOT_SECURITY_CHECKLIST.md (pre-launch checklist)
  - HTTPS_SETUP.md (enabling HTTPS)

Audit trail maintained:
  - Access logs (API server)
  - Authentication logs (success/failure)
  - System logs (errors, events)
  - Backup verification


ONGOING SECURITY MAINTENANCE
=============================

After pilot launches (continuing security):

Weekly
  - Review access logs
  - Check for failed attempts
  - Verify backups completed

Monthly
  - Update Docker images (security patches)
  - Review and remove unused user accounts
  - Check for security advisories

Quarterly
  - Rotate passwords and credentials
  - Full security assessment
  - Update firewall rules review
  - Security training refresher

Annually
  - Full security audit (internal or third-party)
  - Penetration testing
  - Update SSL certificates
  - Comprehensive security procedure review


SUPPORT & QUESTIONS
===================

For security questions:
  - Local infosec team
  - Your IT/security department
  - Community: https://www.cybersecurityframewo.org/

For technical support:
  - Documentation in this package
  - DevOps or system administrator

For compliance questions:
  - Your legal/compliance team
  - Industry-specific guidance (ICS-CERT, CISA)


SECURITY RESOURCES
==================

Manufacturing Security:
  - CISA: https://www.cisa.gov/manufacturing-profile
  - ISA: https://www.isa.org/

Container Security:
  - Docker Security: https://docs.docker.com/engine/security/
  - NIST: https://csrc.nist.gov/

Application Security:
  - OWASP: https://owasp.org/
  - CWE: https://cwe.mitre.org/

TLS/SSL:
  - Mozilla SSL Configuration: https://ssl-config.mozilla.org/
  - NIST TLS Guidelines: https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-52r2.pdf


Bottom Line
===========

ShadowOps Pilot is designed secure for protected networks.

Before production:
  1. Complete PILOT_SECURITY_CHECKLIST.md
  2. Review SECURITY_GUIDE.md for your environment
  3. Enable HTTPS (HTTPS_SETUP.md)
  4. Get security sign-off before pilot users access

During pilot:
  1. Monitor daily for security issues
  2. Review logs weekly
  3. Maintain backups

The security of your manufacturing data depends on these steps.
Do not skip security configuration.

Questions? Review the security documentation in this package.
