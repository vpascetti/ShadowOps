# Proactive Predictive Analytics - Implementation Guide

## Overview

ShadowOps now includes **3 proactive predictive modules** that predict issues **before they happen**:

1. **Deadline Risk Prediction** - Which jobs will be late  
2. **Bottleneck Detection** - Which work centers will become constraints in 2-3 days
3. **Material Shortage Prediction** - Which jobs will hit inventory constraints

These use **statistical models** (ready for ML enhancement) to predict risks 1-3 days in advance, giving your planning team time to intervene.

---

## 1. Deadline Risk Prediction

**Problem:** Jobs are often marked late **after** they miss the deadline. Then it's reactive firefighting.

**Solution:** Predict which jobs will be late **before it happens** by analyzing:
- Historical velocity (hours completed per day)
- Queue depth at the work center (resource contention)
- Velocity trend (deteriorating progress = increased risk)
- Days remaining until due date

### API Endpoint

```bash
GET /api/predictions/lateness-risk?lookbackDays=30
```

### Response

```json
{
  "ok": true,
  "prediction_type": "lateness_risk",
  "timestamp": "2024-02-24T14:30:00Z",
  "jobs_at_risk": [
    {
      "job_id": 10045,
      "due_date": "2024-02-27T17:00:00Z",
      "work_center": "CNC-01",
      "days_until_due": 3.2,
      "velocity_per_day": 6.5,
      "days_to_completion": 5.1,
      "predicted_lateness_days": 1.9,
      "risk_score": 7.5,
      "risk_level": "high",
      "confidence": 0.85,
      "risk_factors": [
        "Will be 1.9 days late at current velocity",
        "Queue building: 8 jobs (normally 3)",
        "Velocity declining: 6.5 hrs/day (was higher)"
      ],
      "recommended_action": "Prioritize this job, consider reassigning non-critical work"
    },
    // ... more jobs
  ],
  "total_jobs_at_risk": 12,
  "critical_count": 3,
  "high_count": 4,
  "lookback_days": 30
}
```

### Risk Levels

- **critical** (risk_score >= 8): URGENT - Add resources or expedite immediately
- **high** (risk_score >= 5): Prioritize this job
- **medium** (risk_score >= 3): Monitor closely
- **low** (risk_score < 2): On track

### Use Cases

**For Planners:**
```
"Job 10045 predicted to be 1.9 days late. 
 Recommend: Transfer 3 hours to overflow work center NOW."
```

**For Operations:**
```
"CNC-01 queue is building and slowing all jobs.
 Add second shift or use alternate machine."
```

**For Executives:**
```
"3 jobs at critical risk. Revenue impact: $250K if not resolved.
 Resource allocation forecast: 2 hours overtime per day for 3 days."
```

---

## 2. Bottleneck Detection (2-3 Days Ahead)

**Problem:** Bottlenecks are discovered AFTER they happen. By then, jobs are backing up.

**Solution:** Predict which work center will become the constraint **2-3 days ahead** by analyzing:
- Current queue depth
- Queue trend (growing or shrinking?)
- Incoming jobs due in forecast window
- Historical throughput vs. queue ratio

### API Endpoint

```bash
GET /api/predictions/bottlenecks?lookbackDays=30&forecastDays=3
```

### Response

```json
{
  "ok": true,
  "prediction_type": "bottleneck",
  "timestamp": "2024-02-24T14:30:00Z",
  "bottlenecks": [
    {
      "work_center": "WELD-02",
      "risk_score": 8.2,
      "risk_level": "critical",
      "current_queue_depth": 12,
      "queue_trend": 2.1,
      "incoming_jobs_next_n_days": 15,
      "forecast_days": 3,
      "avg_cycle_time_minutes": 45.5,
      "historical_throughput_per_day": 8.5,
      "factors": [
        "High queue detected: 12 jobs",
        "Queue growing: +2.1 jobs per day",
        "15 jobs due in next 3 days",
        "Queue depth (12) >> throughput capacity (8.5/day)"
      ],
      "recommendation": "IMMEDIATE: Add resources or divert jobs to alternate work center"
    },
    {
      "work_center": "PAINT-01",
      "risk_score": 5.7,
      "risk_level": "high",
      "current_queue_depth": 6,
      "queue_trend": 1.3,
      "incoming_jobs_next_n_days": 8,
      "forecast_days": 3,
      "avg_cycle_time_minutes": 30.0,
      "historical_throughput_per_day": 12.0,
      "factors": [
        "Queue building: +1.3 jobs per day",
        "8 jobs due in next 3 days"
      ],
      "recommendation": "Prepare additional resources, may need capacity increase"
    }
  ],
  "total_at_risk": 2,
  "critical_count": 1,
  "high_count": 1,
  "forecast_days": 3,
  "lookback_days": 30
}
```

### Proactive Actions

**When risk_level = "critical":**
- Alert production manager immediately
- Prepare alternate work center
- Brief team on re-routing procedure
- Estimate cost of overtime vs. alternate routing

**When risk_level = "high":**
- Schedule cross-training at this work center
- Check for upcoming maintenance that might worsen constraint
- Load-balance non-urgent jobs to other centers

### Use Cases

**For Schedulers:**
```
"WELD-02 will be bottleneck in 2 days.
 Recommend: Schedule 15 incoming jobs across WELD-01, WELD-03.
 Estimated rebalance time: 30 minutes."
```

**For Plant Manager:**
```
"Two work centers at risk in 3-day forecast window.
 Suggest: Authorize 6 hours overtime on each center.
 Expected cost savings vs. missed deadlines: $45K."
```

---

## 3. Material Shortage Prediction

**Problem:** Jobs are held up waiting for parts. No advance warning.

**Solution:** Predict which jobs will hit material constraints by:
- Detecting historical material issues (root_cause flagged)
- Checking current inventory vs. minimums
- Identifying material demand spikes (multiple jobs using same part)

### API Endpoint

```bash
GET /api/predictions/material-shortage?lookbackDays=30
```

### Response

```json
{
  "ok": true,
  "prediction_type": "material_shortage",
  "timestamp": "2024-02-24T14:30:00Z",
  "jobs_at_risk": [
    {
      "job_id": 10052,
      "part": "PN-4502",
      "due_date": "2024-02-26T17:00:00Z",
      "days_until_due": 2.1,
      "risk_score": 9.2,
      "risk_level": "critical",
      "material_risk_factors": [
        "Part PN-4502: stock 12 <= min threshold 50",
        "3 other jobs using same part (material demand spike)"
      ],
      "recommended_action": "URGENT: Check material availability and supplier ETA"
    },
    {
      "job_id": 10048,
      "part": "PN-3301",
      "due_date": "2024-02-28T17:00:00Z",
      "days_until_due": 4.0,
      "risk_score": 5.8,
      "risk_level": "high",
      "material_risk_factors": [
        "Job flagged with historical material issue"
      ],
      "recommended_action": "Contact supplier to confirm availability and lead time"
    }
  ],
  "total_jobs_at_risk": 5,
  "critical_count": 2,
  "high_count": 2,
  "lookback_days": 30
}
```

### Proactive Actions

**When risk_level = "critical":**
- Contact supplier for emergency delivery
- Check if substitute material available
- Prepare customer communication (may need to reschedule)

**When risk_level = "high":**
- Confirm supplier delivery date
- Reserve inventory from other jobs if critical
- Alert procurement to expedite

### Use Cases

**For Procurement:**
```
"PN-4502 at critical shortage. Current stock: 12, need: 50.
 Supplier ETA: March 2 (1 week late).
 Recommend: Use substitute PN-4501 (compatible) or delay job by 1 week."
```

**For Operations:**
```
"Job 10052 will hit material shortage in 2 days.
 Action: Temporarily stop advancement on this job.
 Reschedule to Job 10051 until material arrives."
```

---

## 4. Combined Predictions Summary

Get all three predictions in one call for dashboard/executive view:

### API Endpoint

```bash
GET /api/predictions/summary?lookbackDays=30&forecastDays=3
```

### Response

```json
{
  "ok": true,
  "prediction_type": "summary",
  "timestamp": "2024-02-24T14:30:00Z",
  "summary": {
    "total_predictions": 19,
    "critical_items": 5,
    "lateness_risk": {
      "total": 12,
      "critical": 3,
      "high": 4,
      "top_job": {
        "job_id": 10045,
        "predicted_lateness_days": 1.9,
        "risk_score": 7.5
      }
    },
    "bottleneck_risk": {
      "total": 2,
      "critical": 1,
      "high": 1,
      "top_wc": {
        "work_center": "WELD-02",
        "risk_score": 8.2
      }
    },
    "material_shortage_risk": {
      "total": 5,
      "critical": 2,
      "high": 2,
      "top_job": {
        "job_id": 10052,
        "part": "PN-4502",
        "risk_score": 9.2
      }
    }
  },
  "details": {
    "lateness_jobs": [ ... ],
    "bottlenecks": [ ... ],
    "material_shortages": [ ... ]
  }
}
```

---

## Implementation Details

### Database Schema

#### Job Snapshots (for velocity trend analysis)
```sql
CREATE TABLE job_snapshots (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER,
  snapshot_date TIMESTAMP NOT NULL,
  job_id INTEGER NOT NULL,
  hours_to_go NUMERIC,
  qty_completed NUMERIC,
  status TEXT,
  created_at TIMESTAMP DEFAULT now()
);
```

**Populate snapshots via:**
```bash
POST /api/snapshots/record
{
  "job_id": 10045,
  "hours_to_go": 20,
  "qty_completed": 150,
  "status": "In Progress"
}
```

#### Work Center Metrics (for bottleneck detection)
```sql
CREATE TABLE work_center_metrics (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER,
  work_center TEXT NOT NULL,
  metric_date TIMESTAMP NOT NULL,
  throughput NUMERIC,
  avg_cycle_time NUMERIC,
  queue_depth INTEGER,
  utilization NUMERIC,
  scrap_rate NUMERIC,
  created_at TIMESTAMP DEFAULT now()
);
```

**Populate metrics via:**
```bash
POST /api/work-centers/CNC-01/metrics
{
  "throughput": 8.5,
  "avg_cycle_time": 45.5,
  "queue_depth": 3,
  "utilization": 0.92,
  "scrap_rate": 0.01
}
```

#### Prediction Training Data (for ML model training)
```sql
CREATE TABLE prediction_training_data (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER,
  job_id INTEGER NOT NULL,
  prediction_type TEXT,
  prediction_data JSONB,
  outcome JSONB,
  outcome_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT now()
);
```

This table automatically collects prediction outcomes for model training.

---

## Machine Learning Readiness

The system collects training data automatically for future ML models:

### What's Tracked

1. **Lateness Model:** Each prediction + actual completion date
   - Input: velocity, queue_depth, trend, days_remaining
   - Output: actual_lateness_days, was_late_bool

2. **Bottleneck Model:** Each prediction + actual queue congestion
   - Input: incoming_jobs, throughput, current_queue, trend
   - Output: actual_peak_queue, days_until_peak

3. **Material Model:** Each prediction + actual material availability
   - Input: current_inventory, demand_spike, historical_risk
   - Output: actual_shortage_bool, actual_delay_days

### ML Enhancement Roadmap

**Phase 2 (After 30 days data collection):**
- Train statistical anomaly detector
- Improve threshold tuning based on false positive rate

**Phase 3 (After 60+ days data collection):**
- Build logistic regression model for lateness probability
- Create gradient boosting model for bottleneck timing
- Ensemble methods for material shortage

**Phase 4 (+ ML Engineering):**
- Deep LSTM for time-series job progression
- Graph neural networks for job dependencies
- Reinforcement learning for optimal scheduling recommendations

---

## Dashboard Integration

### Recommended Dashboard Sections

1. **Critical Alerts** (top of dashboard)
   - Red boxes: Jobs at critical lateness risk
   - Red boxes: Work centers at critical bottleneck risk  
   - Red boxes: Jobs at critical material risk

2. **Upcoming Risks** (next 3 days)
   - Yellow cards: High-risk items that need attention
   - Recommendations for each

3. **Trend Charts**
   - Queue depth trending for each work center
   - Job velocity trending (are jobs accelerating or slowing?)
   - Material utilization vs. minimum thresholds

4. **Action Items**
   - For each critical item: recommended action from prediction
   - Quick "approve" button to notify team
   - Log of actions taken + outcomes

---

## Configuration

### Query Parameters

```
lookbackDays=30      # How far back to look for historical patterns (default: 30)
forecastDays=3       # How far ahead to predict bottlenecks (default: 3)
```

### Risk Score Calculation

Each prediction uses **multi-factor risk scoring**:

```
risk_score = sum(factor_weights * factor_values)

Example for Lateness:
  - Days late: 0-10 (weight: 1.0)
  - Queue depth impact: 0-10 (weight: 0.5)
  - Velocity trend: 0-5 (weight: 0.3)
  
Result: risk_score ranges 0-25 (normalized to 0-10 display range)
```

### Confidence Score

Based on data quality:
- 1+ snapshots: confidence 0.3 (low data)
- 5+ snapshots: confidence 0.6 (moderate)
- 20+ snapshots: confidence 0.85+ (high)

---

## Next Steps

1. **Enable data collection immediately**
   - Set up job snapshot recording (every 4 hours)
   - Record work center metrics (every shift)

2. **Deploy predictions to production**
   - Add summary endpoint to operations dashboard
   - Create email alerts for critical items

3. **Monitor prediction accuracy**
   - Track which predictions were correct vs. false positives
   - Tune risk thresholds based on 7-day results

4. **Plan ML enhancement**
   - After 30+ days data: retrain models
   - After 60+ days: introduce advanced models

---

## Example: Full Workflow

**Monday 9:00 AM:**
1. Planner calls `/api/predictions/summary`
2. System returns: 3 jobs at critical lateness risk, 1 bottleneck
3. Planner clicks "View Details" on Job 10045
4. Sees: "Will be 1.9 days late at current velocity"
5. Recommendation: "Transfer 3 hours to CNC-02"
6. Planner executes recommendation
7. System logs: prediction_type=lateness, action_taken=reassign, outcome_result=...

**By Wednesday:**
- Job 10045 completed on time
- Outcome recorded: prediction was accurate, confidence improves
- System learns this planner's intervention style

**After 60 days:**
- ML model trained on 1,000+ predictions + outcomes
- New model 20% more accurate than basic statistical rules
- System provides confidence intervals on each prediction

---

## Troubleshooting

**"No jobs at risk"**
- Check if job_snapshots are being populated
- Need at least 2 snapshots per job for velocity calculation
- Verify snapshot collection is running: `POST /api/snapshots/record`

**"Bottleneck predictions all show 'low'"**
- Check if work_center_metrics are being recorded
- Need historical data to establish baselines
- Verify metrics collection: `POST /api/work-centers/{wc}/metrics`

**"Material shortages not detecting issues"**
- Ensure inventory table is populated
- Check if inventory.min_threshold is set correctly
- Material detection requires either:
  - Inventory data + low stock, OR
  - Historical material shortage flags in root_cause field
