ShadowOps Application Security Checklist
========================================

WHAT WE GUARANTEE
=================

ShadowOps application is secure and cannot be blamed for backdoors or vulnerabilities.

We own:
  - Secure application code (no backdoors, no exploitable vulnerabilities)
  - API authentication & authorization
  - Data encryption in transit (HTTPS/TLS)
  - Audit logging of all actions
  - Secure credential handling
  - Input validation & injection prevention

Customer's IT team owns:
  - Network firewall and isolation
  - Server infrastructure security
  - Operating system hardening
  - Database server hardening
  - Network architecture
  - Physical security
  - Access control policies


YOUR 3-MINUTE SETUP (APPLICATION SECURITY ONLY)
==============================================

1. CHANGE DATABASE PASSWORD

   In .env file:
     DB_PASSWORD=shadowops_pass  [DEFAULT - CHANGE THIS]
   
   To:
     DB_PASSWORD=<new_strong_password>
   
   Why: So attackers can't use our default credentials
   Time: 2 minutes

2. CONFIGURE IQMS ACCOUNT AS READ-ONLY

   Ask your customer's IT or IQMS admin:
   "Is the ShadowOps IQMS account READ-ONLY?"
   
   If YES: Good, done.
   If NO: Ask them to make it read-only.
   
   Why: Limits what ShadowOps can do if compromised
   Time: 1 minute (if already read-only)

3. ENABLE HTTPS IF NETWORK-ACCESSIBLE

   If ShadowOps will be accessed over network (not just localhost):
     Follow HTTPS_SETUP.md
     Takes ~10 minutes
   
   If only localhost: HTTP is fine for testing
   
   Why: Encrypts login credentials and data in transit
   Time: 10 minutes (if needed)


WHAT YOU DONT NEED TO WORRY ABOUT
==================================

Network firewall:
  - NOT our responsibility
  - Customer IT handles this
  - We assume firewall blocks unauthorized access

Database network isolation:
  - NOT our responsibility
  - Customer IT handles this
  - We assume database isn't exposed

Server hardening:
  - NOT our responsibility
  - Customer IT handles this
  - We assume OS is properly secured

Access control policies:
  - NOT our responsibility
  - Customer IT handles this
  - We handle application-level auth


WHAT'S BUILT-IN (NO ACTION NEEDED)
==================================

These are already in ShadowOps - nothing to configure:

API Authentication:
  - All API calls require valid JWT token
  - Status: Built-in, works automatically

Password Storage:
  - Bcrypt hashing (industry standard)
  - Status: Built-in, no configuration

Session Security:
  - Secure session tokens
  - Status: Built-in, works automatically

Input Validation:
  - All inputs validated
  - SQL injection prevention
  - XSS prevention
  - Status: Built-in, no configuration

Audit Logging:
  - All user actions logged with timestamps
  - Failed auth attempts logged
  - Data access logged
  - Status: Built-in, logs to /logs directory

Error Handling:
  - Errors don't expose system details
  - Safe error messages to users
  - Status: Built-in, no configuration

Dependency Security:
  - All npm packages up-to-date
  - Security patches applied
  - Status: Maintained by our team


FINAL CHECK BEFORE GIVING TO CUSTOMER
======================================

Did you:
  [ ] Change default database password from "shadowops_pass"?
  [ ] Ask customer IT to confirm IQMS account is read-only?
  [ ] If network-accessible: Configured HTTPS (follow HTTPS_SETUP.md)?

All checked? You're done. ShadowOps is secure.

Their IT team handles the rest (firewall, network, infrastructure).


WHAT IF CUSTOMER HAS SECURITY QUESTIONS?
=========================================

They ask: "Is your app secure?"
You say: "Yes, ShadowOps is built with security best practices:
  - All credentials are hashed
  - All API calls require authentication
  - All data in transit is encrypted (HTTPS)
  - All user actions are logged
  - Input validation prevents injection attacks
  See SECURITY_GUIDE.md for technical details."

They ask: "What about network security?"
You say: "That's handled by your IT team. We handle the application.
  - We require HTTPS for network access (you configure)
  - We enforce read-only database access (you configure)
  - We log all actions (you monitor)
  Your IT team configures firewall, network isolation, etc."

They ask: "What if you have a vulnerability?"
You say: "We maintain the code and update dependencies regularly.
  If we find or receive notice of a vulnerability, we patch it
  immediately and provide updates to all customers."

They ask: "Do you do security testing?"
You say: "Yes. Our code goes through security review before release.
  We don't do penetration testing on customer infrastructure,
  but we handle application security thoroughly."


SIGN-OFF
========

By completing this 3-minute checklist, ShadowOps is secure.

Completed by: ____________________________

Title: __________________________________

Date: ___________________

Note: This checklist covers APPLICATION security.
      Your IT team owns INFRASTRUCTURE security.
      Both are required for secure operation.
