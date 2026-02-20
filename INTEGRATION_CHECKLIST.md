# ✅ Predictive Analytics Integration Checklist

## Backend Integration (✅ COMPLETE)

- ✅ Database schema created:
  - `job_snapshots` - Historical job progress
  - `work_center_metrics` - Work center performance data
  
- ✅ Snapshot recording service:
  - Automatically records every 15 minutes
  - Runs in background after server startup
  - File: `/apps/api/snapshot-service.js`
  
- ✅ Forecast enrichment service:
  - Calculates job completion forecasts
  - Detects immediate issues (late, stalled, expiring)
  - Detects work center anomalies
  - File: `/apps/api/forecast-enrichment.js`

- ✅ New API endpoints:
  - `GET /api/demo/jobs?includePredictions=true` - Get jobs with forecasts
  - `GET /api/anomalies/dashboard` - Get all anomalies
  - `GET /api/jobs/{jobId}/forecast` - Get specific job forecast
  - `GET /api/work-centers/{workCenter}/anomalies` - Get work center anomalies
  - `POST /api/snapshots/record` - Manually record snapshot
  - `POST /api/work-centers/{workCenter}/metrics` - Record metrics

## Frontend Integration (📋 TODO)

### 📊 Components Created
- ✅ `PredictionCards.jsx` - Forecast display components
- ✅ `AnomalyDashboard.jsx` - Anomaly dashboard

### 🎨 UI Integration Points

#### 1. Jobs List View
Add early warning badges to each job row:
```jsx
import { PredictionBadge } from './components/PredictionCards'

// In your jobs list component:
<tr key={job.job_id}>
  <td>{job.job_id}</td>
  <td>{job.customer}</td>
  <td>{job.part}</td>
  <td>
    <PredictionBadge 
      forecast={job.forecast} 
      issues={job.issues} 
      riskLevel={job._risk_level}
    />
  </td>
</tr>
```

#### 2. Job Detail View
Add full forecast section:
```jsx
import { ForecastCard, IssuesAlert } from './components/PredictionCards'

function JobDetailView({ job }) {
  return (
    <div>
      {job.issues && <IssuesAlert issues={job.issues} />}
      {job.forecast && <ForecastCard forecast={job.forecast} />}
    </div>
  )
}
```

#### 3. Dashboard Main View
Add anomaly dashboard to main dashboard:
```jsx
import { AnomalyDashboard } from './components/AnomalyDashboard'

export function Dashboard() {
  return (
    <div className="space-y-6">
      <ExistingDashboardContent />
      <AnomalyDashboard />
    </div>
  )
}
```

### 📝 Usage Example

#### Fetch jobs with predictions:
```javascript
const response = await fetch('/api/demo/jobs?includePredictions=true', {
  headers: {
    'x-tenant-token': localStorage.getItem('tenant_token')
  }
})
const { jobs } = await response.json()

// Each job now has:
// jobs[0].forecast: { method, predicted_completion_date, predicted_lateness_days, confidence_score, basis }
// jobs[0].issues: [ { type, message, icon } ]
// jobs[0]._risk_level: 'critical' | 'urgent' | 'warning' | 'normal'
```

#### Fetch anomalies:
```javascript
const response = await fetch('/api/anomalies/dashboard', {
  headers: {
    'x-tenant-token': localStorage.getItem('tenant_token')
  }
})
const { anomalies } = await response.json()

// anomalies structure:
// {
//   "CNC-01": [
//     { type: "slowdown", severity: "high", message: "...", icon: "🔧" }
//   ],
//   "WELD-02": [
//     { type: "queue_buildup", severity: "medium", message: "...", icon: "📊" }
//   ]
// }
```

## 🔄 How Data Flows

1. **Backend records snapshots every 15 minutes:**
   - Polls jobs table
   - Creates snapshot with current hours_to_go, qty_completed, status
   - Stores in job_snapshots table

2. **Frontend requests jobs WITH predictions:**
   - Calls `/api/demo/jobs?includePredictions=true`
   - Backend enriches each job with forecasts + issues
   - Returns enhanced job data

3. **Frontend shows early warnings:**
   - Displays badges/alerts on jobs list
   - Shows full forecast card on job detail
   - Highlights critical/urgent items

4. **Anomalies are detected and displayed:**
   - Work center metrics collected automatically
   - Anomalies dashboard shows slowdowns, queue buildups, scrap spikes
   - Refreshes every 5 minutes

## 🚀 Next Steps to Complete Integration

### Immediate (30 min):
- [ ] Add `?includePredictions=true` to jobs API call in frontend
- [ ] Import and display `PredictionBadge` in jobs table
- [ ] Import and display `AnomalyDashboard` in main dashboard

### Short-term (1-2 hours):
- [ ] Add full `ForecastCard` to job detail view
- [ ] Add `IssuesAlert` component to job detail
- [ ] Style and tune colors to match brand
- [ ] Test with sample data

### Medium-term (1 day):
- [ ] Configure snapshot interval (currently 15 min)
- [ ] Add email/Slack alerts for critical predictions
- [ ] Create custom dashboard for planners
- [ ] Add historical trend charts

### Advanced (Phase 3):
- [ ] Train ML models on historical snapshot data
- [ ] Add maintenance failure predictions
- [ ] Add scrap rate predictions
- [ ] Root cause classification

## 📊 Testing the Integration

### Step 1: Start the server
```bash
./start.sh
```

### Step 2: Wait 15 minutes for first snapshot
The snapshot service runs every 15 minutes. After first interval, you can test forecasts.

### Step 3: Test API endpoints
```bash
# Get jobs with predictions
curl http://localhost:5050/api/demo/jobs?includePredictions=true \
  -H "x-tenant-token: YOUR_TOKEN"

# Get anomalies dashboard
curl http://localhost:5050/api/anomalies/dashboard \
  -H "x-tenant-token: YOUR_TOKEN"
```

### Step 4: Check database
```bash
# Connect to postgres
psql -h localhost -U shadowops -d shadowops_db

# Check snapshots recorded
SELECT COUNT(*) FROM job_snapshots;

# Check work center metrics
SELECT * FROM work_center_metrics WHERE work_center = 'CNC-01';
```

## 📋 Files Modified/Created

| File | Status | Purpose |
|------|--------|---------|
| `apps/api/snapshot-service.js` | ✅ Created | Auto-records job snapshots + work center metrics |
| `apps/api/forecast-enrichment.js` | ✅ Created | Calculates forecasts and detects issues |
| `apps/api/index.js` | ✅ Updated | Integrated services, added endpoints |
| `apps/api/db.js` | ✅ Updated | Added 3 new tables |
| `packages/core/src/predictions.ts` | ✅ Created | Prediction algorithms + tests |
| `apps/web/src/components/PredictionCards.jsx` | ✅ Created | UI components for forecasts |
| `apps/web/src/components/AnomalyDashboard.jsx` | ✅ Created | Anomaly dashboard component |

## 🎯 Key Features Now Available

✨ **Job Forecast Predictions:**
- Predicts completion dates based on velocity
- Shows confidence scores
- Identifies jobs that will be late days in advance

⚠️ **Immediate Issue Detection:**
- Flags late jobs
- Alerts on stalled jobs
- Warns when jobs expire soon

🔴 **Anomaly Alerts:**
- Detects work center slowdowns (throughput drops)
- Identifies queue buildups
- Detects elevated scrap rates

📊 **Automatic Trending:**
- Snapshots recorded every 15 minutes
- Historical data for 30+ days
- Statistical anomaly detection

## 💡 Tips & Configuration

### Tuning Snapshot Interval
In `apps/api/index.js`:
```javascript
// Change interval (in minutes)
startSnapshotService(tenantId, 15) // Change 15 to desired minutes
```

### Tuning Anomaly Sensitivity
In `apps/api/forecast-enrichment.js`:
```javascript
// More sensitive: Lower multiplier (1.5 = more alerts)
// Less sensitive: Higher multiplier (2.5 = fewer alerts)
if (latestDepth > avgDepth * 1.5) { // Adjust 1.5
```

### Disabling Auto-Snapshots
Comment out in `apps/api/index.js`:
```javascript
// startSnapshotService(tenantId, 15)
```

---

**Status:** Backend ✅ Complete | Frontend 📋 Ready to Integrate (1-2 hours of UI work)
