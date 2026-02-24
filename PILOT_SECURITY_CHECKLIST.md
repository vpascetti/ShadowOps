ShadowOps Pilot - Pre-Launch Security Checklist
================================================

Use this checklist before your pilot users access the system.
Print it out or track digitally - sign off when complete.


PHASE 1: CREDENTIALS & SECRETS (DO FIRST)
==========================================

Requirement: Complete before any network access

Database Password
   Task: Change from default to strong password
   [ ] Opened .env file
   [ ] Set DB_PASSWORD to 16+ character complex password
   [ ] Password contains: uppercase, lowercase, numbers, symbols
   [ ] Password is NOT related to company name/product
   [ ] Password stored securely (password manager)
   [ ] Restarted services: docker-compose restart db
   [ ] Verified no errors in logs: docker-compose logs db
   Completed: _____  Signed by: _________________ Date: ______

IQMS Password
   Task: Ensure IQMS credentials are strong and limited
   [ ] IQMS account is NOT admin account
   [ ] IQMS account has READ-ONLY permissions only
   [ ] IQMS password is 16+ characters, complex
   [ ] IQMS password unique to ShadowOps (not reused)
   [ ] IQMS credentials in .env (not hardcoded anywhere else)
   [ ] Credentials never checked into git
   [ ] .env added to .gitignore
   Completed: _____  Signed by: _________________ Date: ______

Protect .env File
   Task: Secure the configuration file
   [ ] File permissions set to 600: chmod 600 .env
   [ ] Only admin user can read: ls -la .env
   [ ] .env backed up in secure location
   [ ] Backup .env also protected (chmod 600)
   Completed: _____  Signed by: _________________ Date: ______


PHASE 2: NETWORK ISOLATION (CRITICAL)
======================================

Requirement: Database must not be accessible from internet

Database Port Check
   Task: Verify database is NOT exposed
   [ ] Ran: docker-compose ps
   [ ] Database container exists and is running
   [ ] Checked port exposure in docker-compose.yml
   [ ] Database ports NOT in public Port mappings
      (Should show only in container, not host)
   [ ] Ran: netstat -tuln | grep 5432
      Result: 127.0.0.1:5432 (localhost only, NOT 0.0.0.0)
   [ ] Can NOT access from external machine
   Completed: _____  Signed by: _________________ Date: ______

API Port Firewall
   Task: Restrict API access to authorized network only
   [ ] API port 5050 configured in firewall
   [ ] Firewall rule: Allow ONLY from authorized IP ranges
   [ ] Firewall rule: Block from public internet
   [ ] Tested: Can access from authorized network
   [ ] Tested: Cannot access from public internet/VPN
   [ ] Firewall logs reviewed for denied attempts
   Completed: _____  Signed by: _________________ Date: ______

Web Port Restriction
   Task: Restrict web access appropriately
   [ ] Web port 5173 in firewall rules
   [ ] Firewall configured: Allow from specific IP ranges
   [ ] Internal only OR behind VPN
   [ ] Not accessible from public internet
   [ ] Tested access from authorized location
   [ ] Tested access blocked from unauthorized location
   Completed: _____  Signed by: _________________ Date: ______


PHASE 3: DATA PROTECTION
=========================

HTTPS/TLS Configuration
   Task: Encrypt data in transit (minimum for pilot)
   At minimum (self-signed is OK for pilot):
   [ ] SSL certificate generated or obtained
   [ ] Certificate path configured in nginx
   [ ] Certificate trusted by client browsers
      (self-signed OK with warning acknowledged)
   [ ] HTTPS enabled on web port (443 or mapped)
   [ ] HTTP redirects to HTTPS
   [ ] SSL certificate validity checked: not expired soon
   [ ] TLS version 1.2 or higher enforced
   Completed: _____  Signed by: _________________ Date: ______

Database Backup
   Task: Ensure recovery is possible
   [ ] Backup script created: ./backup.sh
   [ ] Manual backup tested: ./backup.sh
   [ ] Backup file created and not empty
   [ ] Restore tested: restore from backup
   [ ] System data matches restored data
   [ ] Backups scheduled (daily minimum)
   [ ] Backup location has adequate disk space
   [ ] Backup permissions secured: chmod 600 backup files
   Completed: _____  Signed by: _________________ Date: ______

Data Encryption in Transit
   Task: IQMS connection must be secure
   [ ] IQMS connection over SSL/TLS verified
   [ ] IQMS certificate valid and trusted
   [ ] API connects to IQMS over encrypted channel
   [ ] Raw TCP connection NOT used
   Completed: _____  Signed by: _________________ Date: ______


PHASE 4: ACCESS CONTROL
========================

Authentication Required
   Task: All access must require credentials
   [ ] Anonymous access tested - should be blocked
   [ ] All endpoints require authentication token
   [ ] Login page requires valid credentials
   [ ] Session timeout configured (recommended: 1 hour)
   [ ] Invalid credentials rejected immediately
   Completed: _____  Signed by: _________________ Date: ______

User Access Management
   Task: Control who can access the system
   [ ] Created admin account with strong password
   [ ] Created read-only test account
   [ ] Created limited user accounts for pilots
   [ ] No accounts share passwords
   [ ] Accounts match pilot user list exactly
   [ ] Unnecessary accounts disabled (default accounts removed)
   [ ] Account activity logged
   Completed: _____  Signed by: _________________ Date: ______


PHASE 5: MONITORING & LOGGING
==============================

Audit Logging Enabled
   Task: Record all important activities
   [ ] API request logging enabled
   [ ] Authentication attempt logging enabled
   [ ] Database modification logging enabled
   [ ] Error logging configured
   [ ] Logs contain: timestamp, user, action, result
   [ ] Logs do NOT contain passwords or credentials
   [ ] Log retention policy: Minimum 90 days
   [ ] Log files secured: not world-readable
   Completed: _____  Signed by: _________________ Date: ______

Log Review Process
   Task: Establish process to monitor logs
   [ ] Responsible person assigned to review logs
   [ ] Review frequency: Daily minimum
   [ ] Process documented for suspicious activity
   [ ] Failed login attempts monitored
   [ ] Unusual access patterns noted
   [ ] Account lockout threshold: 10 failures/15 min
   Completed: _____  Signed by: _________________ Date: ______


PHASE 6: INCIDENT RESPONSE
===========================

Documentation
   Task: Prepare response procedures
   [ ] Incident response plan documented
   [ ] Contact list created (who to notify)
   [ ] Escalation procedures defined
   [ ] Isolation procedure: docker-compose down
   [ ] Evidence preservation procedure documented
   [ ] Communication template prepared
   Completed: _____  Signed by: _________________ Date: ______

Emergency Procedures
   Task: Know what to do if compromised
   [ ] Emergency isolate procedure practiced
   [ ] Password reset procedure tested
   [ ] Account lockout procedure tested
   [ ] Backup restore procedure tested
   [ ] Team trained on incident response
   Completed: _____  Signed by: _________________ Date: ______


PHASE 7: CONFIGURATION SECURITY
================================

Secrets Management
   Task: Ensure secrets are not exposed
   [ ] .env file NOT in version control
   [ ] No passwords in Docker logs
   [ ] No credentials in Docker images
   [ ] No secrets in environment variables exposed to users
   [ ] docker-compose.yml has no hardcoded secrets
   Completed: _____  Signed by: _________________ Date: ______

Source Control
   Task: Secure what's in git
   [ ] .env added to .gitignore
   [ ] .env.backup added to .gitignore
   [ ] SSL certificates not committed
   [ ] Private keys not committed
   [ ] Sensitive documentation marked as confidential
   [ ] git history reviewed for exposed secrets
   Completed: _____  Signed by: _________________ Date: ______


PHASE 8: SECURITY TESTING
==========================

Basic Penetration Testing
   Task: Test common vulnerabilities
   [ ] Tested SQL injection: Failed (protected)
   [ ] Tested XSS: Failed (protected)
   [ ] Tested brute force: Rate limiting engaged
   [ ] Tested default credentials: Rejected
   [ ] Tested privilege escalation: Not possible
   [ ] Tested unauthorized port access: Blocked
   Completed: _____  Signed by: _________________ Date: ______

Vulnerability Scanning
   Task: Check for known vulnerabilities
   [ ] Docker image scanned: docker scout cves ...
   [ ] No critical vulnerabilities found
   [ ] High severity issues documented with plans
   [ ] Patch plan created for any vulnerabilities
   Completed: _____  Signed by: _________________ Date: ______


PHASE 9: TRAINING & DOCUMENTATION
==================================

Team Training
   Task: Ensure team knows security procedures
   [ ] Security guide reviewed with all admins
   [ ] Password policy communicated
   [ ] Incident response procedure reviewed
   [ ] Logging review process trained
   [ ] Access control policies understood
   Completed: _____  Signed by: _________________ Date: ______

Documentation
   Task: Everything documented
   [ ] Security architecture documented
   [ ] Network diagram with firewall rules
   [ ] User access procedures documented
   [ ] Password reset procedure documented
   [ ] Backup/restore procedure documented
   [ ] Incident response plan documented
   [ ] Emergency contacts documented
   [ ] System configuration documented (sanitized for secrets)
   Completed: _____  Signed by: _________________ Date: ______


FINAL SIGN-OFF
==============

Pre-Launch Approval

I certify that:
  - All phases above have been completed
  - Passwords have been changed
  - Network is properly isolated
  - Backups are working
  - Audit logging is enabled
  - Team is trained
  - Security risks are documented

Authorized by: _________________________________ 

Position: ____________________________________

Date: _____________________

Approved to: [ ] Pilot with listed users only
             [ ] Limited production deployment
             [ ] Full production deployment


Risk Acknowledgment
===================

Risks acknowledged and accepted:

1. Manufacturing systems are high-value targets
   Risk accepted: YES / NO
   
2. Any unpatched vulnerabilities will expose data
   Risk accepted: YES / NO
   
3. Pilot may be subject to attacks
   Risk accepted: YES / NO
   
4. Backups may be needed for recovery
   Risk accepted: YES / NO

All risks accepted: YES / NO

If NO to any risk: DO NOT PROCEED - Address risk first.


Ongoing Security Maintenance
=============================

After this checklist, maintain security:

Weekly
  [ ] Review logs for suspicious activity
  [ ] Check firewall rule violations
  [ ] Verify backups completed

Monthly
  [ ] Review user access - remove unused accounts
  [ ] Check for security advisories/patches
  [ ] Test backup restoration

Quarterly
  [ ] Rotate API keys/passwords
  [ ] Update Docker images
  [ ] Review and update security procedures
  [ ] Assess new security risks

Annually
  [ ] Full security audit
  [ ] Penetration testing
  [ ] Update SSL certificates
  [ ] Comprehensive security training


For Questions
=============

Security concerns: Contact infosec team
Technical issues: Contact DevOps team
Compliance questions: Contact compliance/legal

Do not proceed without approved security sign-off.
