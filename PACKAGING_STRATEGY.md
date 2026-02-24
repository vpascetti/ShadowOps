# ShadowOps Packaging & Distribution Strategy

## Overview

You now have a **complete, easy packaging solution** for both pilot customers and full launch. This document explains the strategy and how to use each component.

---

## The Complete Picture

### Three Deployment Scenarios

| Scenario | Use Case | Setup Time | Customers | Files |
|----------|----------|-----------|-----------|-------|
| **Pilot** | Small trial deployments | 5 min | Beta partners | `docker-compose.pilot.yml` |
| **On-Premise** | Single server deployment | 20 min | Mid-size manufacturers | `docker-compose.yml` + setup guide |
| **Cloud/Enterprise** | Multi-region, auto-scaling | 1-2 hours | Large enterprises | Kubernetes + Helm charts |

---

## What You Have

### 1. Dockerfile.api & Dockerfile.web
- Production-ready Docker images
- Multi-stage builds for optimization
- Health checks built-in
- Configurable via environment variables

### 2. **docker-compose.pilot.yml**
- All services (API, Web, Database) in one file
- Environment variable configuration
- Health checks for each service
- Perfect for pilots and small deployments

### 3. **pilot-package.sh** (Automated Packaging Tool)
Creates a clean, customer-ready package:
```bash
./pilot-package.sh 1.0.0
```

**Output:**
- `shadowops-pilot-1.0.0/` - Directory
- `shadowops-pilot-1.0.0.zip` - Ready to distribute
- `shadowops-pilot-1.0.0.tar.gz` - Alternative format

### 4. **PILOT_SETUP.md**
Complete customer-facing setup guide with:
- Prerequisites
- Quick start (5 minutes)
- Configuration options
- Troubleshooting
- IQMS integration instructions

### 5. **LAUNCH_DEPLOYMENT.md**
Enterprise deployment documentation:
- Kubernetes setup
- AWS/Azure/GCP deployment
- Security checklist
- Production configuration
- Scaling strategy
- Disaster recovery

---

## 🚀 How to Use Each Component

### For **Pilot Customers** (Fastest Path)

```bash
# 1. Generate the pilot package
./pilot-package.sh 1.0.0

# 2. Share with customer
# Send: shadowops-pilot-1.0.0.zip

# 3. Customer just runs:
# - Extract ZIP
# - ./start.sh
# - Open http://localhost:5173
```

**Time to value:** 5-10 minutes ⚡

### For **Launch Customers** (On-Premise)

```bash
# 1. Use the production docker-compose.yml
docker-compose -f docker-compose.yml up -d

# 2. Follow LAUNCH_DEPLOYMENT.md for:
# - Security hardening
# - Database backups
# - Monitoring setup
# - Scaling configuration

# 3. Provide customers with:
# - LAUNCH_DEPLOYMENT.md
# - Custom .env template
# - Support contact information
```

**Time to value:** 20-30 minutes

### For **Enterprise/Cloud** (Full Scale)

```bash
# 1. Create Kubernetes manifests in k8s/
# 2. Create Helm charts in helm/
# 3. Follow LAUNCH_DEPLOYMENT.md Kubernetes section
# 4. Deploy to cloud provider

# Example for AWS:
docker build -f Dockerfile.api -t <account>.dkr.ecr.<region>.amazonaws.com/shadowops-api .
docker push <account>.dkr.ecr.<region>.amazonaws.com/shadowops-api
# Use ECS or EKS to deploy
```

**Time to value:** 1-2 hours

---

## Customer Handoff Checklist

### For Pilot Customers

- [ ] ZIP file ready (`shadowops-pilot-1.0.0.zip`)
- [ ] README.md in package (auto-copied from PILOT_SETUP.md)
- [ ] Example `.env` file included
- [ ] Start/stop scripts included
- [ ] Demo guide included (optional)
- [ ] Support contact info provided

### For Launch Customers

- [ ] Production Dockerfiles tested
- [ ] LAUNCH_DEPLOYMENT.md customized for their environment
- [ ] Security checklist completed
- [ ] Backup procedures documented
- [ ] Monitoring setup configured
- [ ] Support runbooks provided

### For Enterprise/Cloud

- [ ] Kubernetes manifests reviewed
- [ ] Helm charts tested
- [ ] Infrastructure templates provided
- [ ] Auto-scaling policies configured
- [ ] Disaster recovery plan documented
- [ ] 24/7 support structure in place

---

## 🔄 Update & Release Workflow

### When You Release a New Version

```bash
# 1. Update version in package.json
npm version minor  # or patch, major

# 2. Update code, commit
git add .
git commit -m "v1.1.0: New features"
git tag v1.1.0
git push origin main --tags

# 3. Create pilot package
./pilot-package.sh 1.1.0

# 4. Update Docker images
docker build -f Dockerfile.api -t shadowops-api:1.1.0 .
docker build -f Dockerfile.web -t shadowops-web:1.1.0 .

# 5. Push to registry (Docker Hub, private registry, etc.)
docker push shadowops-api:1.1.0

# 6. Update customers
# - Notify pilot customers of new version available
# - Provide upgrade instructions in LAUNCH_DEPLOYMENT.md
```

---

## Security & Customization

### Sensitive Information to Remove Before Packaging

Before creating a customer package:

```bash
# Remove sensitive files
rm -f .env                    # Production secrets
rm -f .env.*.local           # Local overrides
rm -f *.key *.pem           # SSL certificates
rm -rf logs/                # Previous logs
rm -rf node_modules/.cache  # Cache files
```

The `pilot-package.sh` script already does this.

### Customer-Specific Customization

For each customer, you might provide:

```
shadowops-pilot-acme.zip/
├── README.md (customized with ACME branding)
├── .env.example (with ACME-specific settings)
├── docker-compose.yml (with ACME server details)
├── QUICK_START.pdf (branded)
└── START_HERE.txt (simple instructions)
```

---

## Scaling from Pilot to Launch

### Pilot to Launch Upgrade Path

```
Pilot Phase                     Launch Phase
─────────────────────────────── ─────────────────────────────────
docker-compose.pilot.yml  ──→  docker-compose.yml + Kubernetes
Single server             ──→  Load-balanced cluster
Demo data                 ──→  Production data + backups
HTTP                      ──→  HTTPS + TLS
No monitoring             ──→  Full monitoring stack
```

### Pilot Package Limitations (By Design)

- Single server deployment only
- Demo/test data only
- No backup automation
- No high availability
- No load balancing

### Upgrade to Production

1. Use LAUNCH_DEPLOYMENT.md
2. Architect for your scale
3. Implement security hardening
4. Add monitoring & backups
5. Set up disaster recovery
6. Configure auto-scaling

---

## Template: Customer Email

When distributing pilot packages:

```
Subject: ShadowOps Pilot Package Ready

Hi [Customer],

We're excited to provide you with ShadowOps for your evaluation!

🚀 GET STARTED:
1. Download: shadowops-pilot-1.0.0.zip
2. Extract and read: README.md
3. Run: ./start.sh
4. Open: http://localhost:5173

⏱️ Expected time: ~5 minutes

📚 DOCUMENTATION:
- README.md - Complete setup guide
- DEMO_GUIDE.md - Feature walkthrough
- PILOT_PITCH.md - About ShadowOps

🆘 SUPPORT:
- Check README.md troubleshooting section
- Email: pilot-support@shadowops.com
- Slack: #shadowops-pilots

We're here to help you get the most from this evaluation!

Best regards,
ShadowOps Team
```

---

## 📈 Metrics & Success Criteria

### Pilot Success Metrics
- Time to first login: < 15 minutes
- Data import success: > 90%
- User satisfaction: > 4/5 stars
- Show value within 1 week

### Launch Success Metrics
- Uptime: > 99.5%
- API response time: < 500ms
- User adoption: > 80%
- Support tickets: < 5% of users

---

## Maintenance & Updates

### Regular Tasks

```bash
# Monthly security updates
docker pull postgres:15
docker-compose -f docker-compose.yml up -d

# Quarterly version updates
./pilot-package.sh 1.2.0
# Send release notes to all customers

# Annual security audit
# - Review access logs
# - Update SSL certificates
# - Rotate API keys
# - Backup verification
```

---

## 📞 Next Steps

1. **Test the packaging:**
   ```bash
   ./pilot-package.sh 0.1.0
   # cd shadowops-pilot-0.1.0
   # ./start.sh
   ```

2. **Customize for your brand:**
   - Add company logo to PILOT_SETUP.md
   - Update support contacts
   - Add custom .env examples

3. **Set up distribution:**
   - Create download portal
   - Set up support channels
   - Prepare training materials

4. **Plan enterprise deployment:**
   - Review LAUNCH_DEPLOYMENT.md
   - Create runbooks for your infrastructure
   - Plan disaster recovery

---

## Related Documents

- [PILOT_SETUP.md](./PILOT_SETUP.md) - Customer-facing pilot guide
- [LAUNCH_DEPLOYMENT.md](./LAUNCH_DEPLOYMENT.md) - Enterprise deployment
- [DEMO_GUIDE.md](./DEMO_GUIDE.md) - Feature walkthrough
- [README.md](./README.md) - Project overview

---

**Created:** February 2026  
**Status:** Ready for pilot distribution  
**Next Review:** After first pilot customer feedback
