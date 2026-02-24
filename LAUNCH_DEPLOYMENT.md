# ShadowOps Production Deployment Guide

## Deployment Options

### Option 1: Docker Compose (Small to Medium)
Suitable for on-premise or single-server deployments.

**Use Cases:**
- Small-to-medium manufacturing facilities
- Internal/on-premise deployments
- Development/staging environments

**Setup:**
```bash
# Build images
docker build -f Dockerfile.api -t shadowops-api:latest .
docker build -f Dockerfile.web -t shadowops-web:latest .

# Run with production docker-compose
docker-compose -f docker-compose.yml up -d

# For scaling with multiple API replicas
# Edit docker-compose.yml and add:
# - Multiple API service definitions
# - Load balancer (nginx/haproxy)
```

### Option 2: Kubernetes (Large Scale)
Suitable for cloud deployments with high availability needs.

**Use Cases:**
- Large enterprise deployments
- Multi-region deployments
- Auto-scaling requirements
- Cloud providers (AWS, Azure, GCP)

**Files Included:**
- `k8s/deployment.yaml` - Kubernetes deployment files
- `helm/` - Helm charts for simplified deployment

**Setup:**
```bash
# Option A: Using kubectl
kubectl apply -f k8s/deployment.yaml

# Option B: Using Helm
helm install shadowops ./helm/shadowops --values helm/values.yaml

# Scale replicas
kubectl scale deployment shadowops-api --replicas=3
```

### Option 3: Cloud-Native (PaaS)

#### AWS ECS
```bash
# Push images to ECR
aws ecr create-repository --repository-name shadowops-api
docker tag shadowops-api:latest <account>.dkr.ecr.<region>.amazonaws.com/shadowops-api:latest
docker push <account>.dkr.ecr.<region>.amazonaws.com/shadowops-api:latest

# Deploy via ECS task definition
aws ecs create-service --cluster shadowops --service-name shadowops-api ...
```

#### Azure Container Instances
```bash
# Push to Azure Container Registry
az acr build --registry <registryName> -f Dockerfile.api -t shadowops-api:latest .

# Deploy
az container create --resource-group <group> --name shadowops-api ...
```

#### Google Cloud Run
```bash
# Push to Google Container Registry
docker tag shadowops-api gcr.io/<project>/shadowops-api:latest
docker push gcr.io/<project>/shadowops-api:latest

# Deploy
gcloud run deploy shadowops-api --image gcr.io/<project>/shadowops-api:latest
```

## Security Checklist

Before production deployment:

- [ ] Change all default passwords
- [ ] Enable HTTPS/TLS encryption
- [ ] Configure firewall rules
- [ ] Set up authentication (OAuth2, SAML, etc.)
- [ ] Enable audit logging
- [ ] Configure database backups
- [ ] Set up monitoring & alerting
- [ ] Configure rate limiting
- [ ] Enable CORS restrictions
- [ ] Rotate API keys regularly

### TLS Configuration

```yaml
# In docker-compose or ingress configuration
environment:
  - ENABLE_HTTPS=true
  - SSL_CERT_PATH=/etc/ssl/certs/server.crt
  - SSL_KEY_PATH=/etc/ssl/private/server.key

volumes:
  - /path/to/certs:/etc/ssl/certs
  - /path/to/keys:/etc/ssl/private
```

## 📊 Monitoring & Maintenance

### Health Checks
Services include built-in health check endpoints:
- API: `GET /health`
- Web: `GET /health`
- Database: PostgreSQL health check

### Logging
```bash
# View all logs
docker-compose logs -f

# Log aggregation (ELK Stack, Datadog, etc.)
# Configure log drivers in docker-compose.yml
```

### Backups
```bash
# PostgreSQL backup
docker-compose exec db pg_dump -U shadowops shadowops_db > backup.sql

# Restore
docker-compose exec -T db psql -U shadowops shadowops_db < backup.sql

# Automated daily backups (cron job)
0 2 * * * /path/to/backup-script.sh
```

### Scaling

**Horizontal (Add more servers):**
```yaml
# docker-compose with load balancer
services:
  nginx:
    image: nginx:latest
    # Routes to multiple API instances
  api-1:
    build: .
  api-2:
    build: .
  api-3:
    build: .
```

**Vertical (Increase resources):**
```yaml
# Increase container resource limits
deploy:
  resources:
    limits:
      cpus: '4'
      memory: 8G
    reservations:
      cpus: '2'
      memory: 4G
```

## Database Management

### Connection Pooling
```env
# In configuration
DATABASE_POOL_MIN=5
DATABASE_POOL_MAX=20
```

### Performance Tuning
```sql
-- Create indexes
CREATE INDEX idx_status ON work_orders(status);
CREATE INDEX idx_created_at ON work_orders(created_at);

-- Analyze query performance
EXPLAIN ANALYZE SELECT ...;
```

## Performance Targets

| Metric | Target | Notes |
|--------|--------|-------|
| API Response Time | < 500ms | P95 |
| Web Load Time | < 3s | First Contentful Paint |
| Uptime | 99.5% | Monthly |
| Database Query Time | < 100ms | P95 |

## 🔄 Zero-Downtime Deployment

```bash
# Blue-Green Deployment
# 1. Start new version alongside existing
docker-compose -f docker-compose-green.yml up -d

# 2. Test green version
curl http://localhost:5051/health

# 3. Switch traffic
# - Update load balancer/DNS
# - Verify monitoring

# 4. Scale down blue
docker-compose down

# 5. Rename for next cycle
mv docker-compose.yml docker-compose-blue.yml
mv docker-compose-green.yml docker-compose.yml
```

## Pre-Launch Checklist

- [ ] All security checks passed
- [ ] Database backups configured
- [ ] Monitoring and alerting active
- [ ] Load testing completed
- [ ] Disaster recovery plan documented
- [ ] Support procedures documented
- [ ] Performance benchmarks met
- [ ] User documentation complete
- [ ] Training materials prepared
- [ ] Customer onboarding process ready

## Disaster Recovery

### Backup Strategy
- Daily automated database backups
- Retention: 30 days minimum
- Test restores monthly

### Recovery Procedures
```bash
# Full system restore
docker-compose down -v
docker volume create shadowops_pgdata
docker-compose up -d

# Restore from backup
docker-compose exec -T db psql -U shadowops shadowops_db < backup.sql
```

## Support & Troubleshooting

Refer to individual service logs:
```bash
docker-compose logs -f api
docker-compose logs -f web
docker-compose logs -f db
```

Common issues and resolution steps in [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
