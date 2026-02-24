# Quick Reference: Packaging Your Application

## One-Minute Summary

You now have **three easy ways** to get ShadowOps to customers:

### 1. Pilot (Fastest)
```bash
./pilot-package.sh 1.0.0
# Creates: shadowops-pilot-1.0.0.zip
# For: Small trial users, 5-minute setup
```

### 2. Production (On-Premise)
```bash
# Use docker-compose.yml + LAUNCH_DEPLOYMENT.md
# For: Enterprise customers, full-featured
# Setup: 20-30 minutes
```

### 3. Cloud/Enterprise
```bash
# Use Kubernetes + Helm (create if needed)
# For: Large scale, multi-region
# Setup: 1-2 hours
```

---

## Files You Now Have

### Docker
- `Dockerfile.api` - API container
- `Dockerfile.web` - Web app container
- `nginx.conf` - Web server config
- `docker-compose.pilot.yml` - Pilot setup (all-in-one)

### Automation
- `pilot-package.sh` - Creates customer-ready ZIP
- `.env.pilot.example` - Configuration template

### Documentation
- `PILOT_SETUP.md` - For pilot customers
- `LAUNCH_DEPLOYMENT.md` - For enterprise builds
- `PACKAGING_STRATEGY.md` - This complete strategy

---

## Quick Action Plan

### Right Now
```bash
# 1. Test the pilot package system
./pilot-package.sh 0.1.0

# 2. Verify it works
cd shadowops-pilot-0.1.0
./start.sh
# Visit http://localhost:5173
# Hit Ctrl+C to stop

# 3. Cleanup
cd ..
rm -rf shadowops-pilot-0.1.0*
```

### Next Week
```bash
# 1. Customize for your brand
cp PILOT_SETUP.md PILOT_SETUP.custom.md
# Edit to add your support email, etc.

# 2. Create first real pilot package
./pilot-package.sh 1.0.0

# 3. Share with first beta customer
# Upload shadowops-pilot-1.0.0.zip
```

### Before Full Launch
```bash
# 1. Test production docker-compose
docker-compose -f docker-compose.yml up -d

# 2. Review LAUNCH_DEPLOYMENT.md
# - Security hardening
# - Backup automation
# - Monitoring setup

# 3. Plan cloud strategy
# - Kubernetes setup
# - Cloud provider integration
# - Disaster recovery
```

---

## For Different Audiences

### Dev Team
- Read: [LAUNCH_DEPLOYMENT.md](./LAUNCH_DEPLOYMENT.md) - to understand production setup
- Reference: [docker-compose.pilot.yml](./docker-compose.pilot.yml) - for containerization
- Understand: [pilot-start.sh](./pilot-start.sh) - interactive setup flow

### Product/Sales
- Share: [PACKAGING_STRATEGY.md](./PACKAGING_STRATEGY.md) - timeline & options
- Share: [PILOT_INTERACTIVE_SETUP.md](./PILOT_INTERACTIVE_SETUP.md) - customer experience
- Use: Pilot package created by `./pilot-package.sh` - easy customer trials
- Show: Customers just extract ZIP + run `./start.sh`

### DevOps/Infrastructure
- Reference: [LAUNCH_DEPLOYMENT.md](./LAUNCH_DEPLOYMENT.md#-deployment-options) - deployment options
- Build: Kubernetes manifests based on `Dockerfile.*` files
- Understand: [pilot-start.sh](./pilot-start.sh) - how IQMS connection is configured

### Customer Support
- Distribute: [PILOT_SETUP.md](./PILOT_SETUP.md) - troubleshooting guide
- Reference: [PILOT_INTERACTIVE_SETUP.md](./PILOT_INTERACTIVE_SETUP.md) - what customer sees
- Escalate: Use [LAUNCH_DEPLOYMENT.md](./LAUNCH_DEPLOYMENT.md#-troubleshooting) for production issues

---

## 📊 Estimated Customer Success Timeline

```
Pilot Phase              Production Phase
─────────────────────────────────────────────────────────────
Day 1    5 min    Get started          Day 1   30 min   Deploy
         15 min   Import data          Day 2   8 hrs    Config & test
         30 min   Explore dashboard    Day 3   4 hrs    Security hardening
         
Week 1   Feedback collection          Week 1  Monitoring & tuning
Week 2   Feature requests             Week 2  Training & documentation
Week 3   Decision point                       Support handoff
```

---

## 🔄 Each Release Cycle

```bash
# Step 1: Develop & test (your regular process)
git commit -am "New feature"

# Step 2: Create versions
npm version minor              # Updates package.json

# Step 3: Create packages
./pilot-package.sh 1.1.0       # For pilots
docker build ... -t acme-api:1.1.0  # For production

# Step 4: Distribute
# - Upload shadowops-pilot-1.1.0.zip for pilot customers
# - Push Docker images to registry
# - Notify existing customers of upgrade path
```

---

## 🆘 Common Questions Answered

### Q: Can I customize the pilot for specific customers?
**A:** Yes! Edit the generated package before distributing:
```bash
./pilot-package.sh 1.0.0
# Edit shadowops-pilot-1.0.0/README.md
# Edit shadowops-pilot-1.0.0/.env.example
# Re-ZIP and distribute
```

### Q: How do pilots upgrade to production?
**A:** Follow [LAUNCH_DEPLOYMENT.md](./LAUNCH_DEPLOYMENT.md) - it covers migration from pilot to full deployment.

### Q: What about existing ShadowOps installations?
**A:** Use your existing docker-compose, or migrate to new setup with:
```bash
docker-compose -f docker-compose.yml up --scale api=3
```

### Q: Can we do cloud deployment?
**A:** Yes! See [LAUNCH_DEPLOYMENT.md - Cloud-Native](./LAUNCH_DEPLOYMENT.md#option-3-cloud-native-paas) section for AWS, Azure, Google Cloud.

### Q: What sizes of customers can we support?
**A:** 
- **Pilot:** 1-5 users, demo data
- **On-Premise:** 5-500 employees, full features
- **Cloud/Enterprise:** Unlimited, multi-region

---

## Get Help

- **Questions about packaging?** → Read [PACKAGING_STRATEGY.md](./PACKAGING_STRATEGY.md)
- **Setting up for pilot customer?** → Use [PILOT_SETUP.md](./PILOT_SETUP.md)
- **Production deployment?** → Follow [LAUNCH_DEPLOYMENT.md](./LAUNCH_DEPLOYMENT.md)
- **Troubleshooting?** → Check the troubleshooting section in relevant guide

---

**You're ready to scale!**

Everything you need to package, distribute, and scale ShadowOps is now in place. Start with a pilot, gather feedback, and launch to more customers with confidence.
