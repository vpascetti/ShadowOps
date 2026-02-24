# Shipping Data & On-Time Delivery Tracking Guide

## Overview

The Shipping Data system provides real-time visibility into delivery performance and supply chain execution. It integrates directly with IQMS shipment data to track promised vs. actual delivery dates, identify on-time delivery (OTD) trends, and uncover shipping anomalies.

This system enables:
- On-Time Delivery (OTD) % tracking at company and per-customer levels
- Early detection of shipping issues and late deliveries
- Customer-level performance metrics (which customers receive on time?)
- Historical shipment tracking per job/order
- Predictive forecasting for upcoming batch shipments
- Anomaly alerts for shipping performance drops

## Architecture

### Data Flow

```
IQMS Database (WORKORDER + SHIPMENT tables)
       ↓
[iqms_shipping.sql] - Extracts promised & actual delivery dates
       ↓
[shipping-service.js] - Processes and enriches shipment data
       ↓
[PostgreSQL shipments table] - Stores with tenant isolation
       ↓
[API Endpoints] - Provides REST access to metrics & anomalies
       ↓
Web UI - Displays OTD trends, customer comparisons, alerts
```

### Database Schema

**Table: `shipments`** (PostgreSQL)

Core fields for tracking delivery performance:

| Column | Type | Purpose |
|--------|------|---------|
| `id` | uuid | Unique shipment identifier |
| `tenant_id` | uuid | Multi-tenant isolation |
| `workorder_id` | varchar | Link to IQMS work order |
| `job_id` | integer | Link to ShadowOps job |
| `customer_id` | varchar | Identifies customer |
| `po_number` | varchar | Purchase order reference |
| `qty_ordered` | integer | Total items ordered |
| `qty_shipped` | integer | Actual qty shipped |
| `promised_date` | date | Promised delivery per PO |
| `actual_ship_date` | date | When items left facility |
| `actual_delivery_date` | date | When customer received |
| `work_order_closed_date` | date | When manufacturing completed |
| `tracking_number` | varchar | Carrier tracking ID |
| `shipping_carrier` | varchar | UPS, FedEx, etc. |
| `delivery_signature` | varchar | Proof of delivery |
| `delivery_status` | varchar | 'On Time', 'Late', 'In Transit' |
| `days_late_or_early` | integer | +5 (5 days late), -2 (2 days early) |
| `source` | varchar | 'iqms' or 'manual_entry' |
| `created_at` | timestamp | First sync/entry time |
| `updated_at` | timestamp | Last update from IQMS |

### Service Layer

File: `apps/api/shipping-service.js` (280+ lines)

**Core Functions:**

#### 1. `syncShippingDataFromIQMS(tenantId, queryIQMSFunc)`
Synchronizes shipment data from IQMS every sync cycle.

```javascript
// How it works:
// 1. Queries IQMS for all shipments (90-day lookback by default)
// 2. Calculates delivery_status: 'Late' if actual_delivery_date > promised_date
// 3. Calculates days_late_or_early: difference in days
// 4. Upserts into PostgreSQL (if exists, update; if not, insert)
// 5. Returns count of synced records

// Returns: { synced: 427, error: null }
```

**Parameters:**
- `tenantId` (uuid): Multi-tenant context
- `queryIQMSFunc` (function): Oracle query function (queryIQMS from index.js)

**Returns:**
```json
{
  "synced": 427,
  "error": null
}
```

---

#### 2. `getOnTimeDeliveryMetrics(tenantId, daysBack)`
Company-wide OTD % and lateness statistics.

```javascript
// Use case: Dashboard KPI - "What % of our deliveries are on time?"
// Returns: OTD %, count of on/late, average lateness
```

**Parameters:**
- `tenantId` (uuid)
- `daysBack` (integer): How many days to analyze (default: 90)

**Returns:**
```json
{
  "on_time_delivery_percent": 92.5,
  "on_time_count": 247,
  "late_count": 20,
  "total_shipments": 267,
  "average_days_late": 1.8,
  "max_days_late": 8,
  "analysis_period_days": 90
}
```

**Use Cases:**
- Executive reporting: "Our OTD is 92.5%"
- Trend tracking: "We improved 2% this month"
- SLA compliance: "Target is 95%, we're at 92.5%"
- Carrier performance: "Carrier X has lower OTD"

---

#### 3. `getLateShipments(tenantId, daysBack)`
All late deliveries in time period (for operations team alerts).

```javascript
// Use case: Find all late shipments so ops can escalate with customers
```

**Parameters:**
- `tenantId` (uuid)
- `daysBack` (integer, default: 30)

**Returns:**
```json
[
  {
    "id": "ship-001",
    "workorder_id": "WO-123456",
    "job_id": 5042,
    "customer_id": "ACME_CORP",
    "customer_name": "ACME Corporation",
    "po_number": "PO-2024-0842",
    "qty_ordered": 500,
    "qty_shipped": 500,
    "promised_date": "2024-01-15",
    "actual_delivery_date": "2024-01-18",
    "days_late": 3,
    "tracking_number": "1Z999AA10123456784",
    "shipping_carrier": "UPS",
    "delivery_status": "Late"
  },
  ...
]
```

---

#### 4. `getShippingStatusByCustomer(tenantId, daysBack)`
Per-customer OTD metrics (enables customer segmentation).

```javascript
// Use case: "Which customers consistently receive late? Which receive early?"
// Returns: OTD % for each customer for relationship management insights
```

**Parameters:**
- `tenantId` (uuid)
- `daysBack` (integer, default: 90)

**Returns:**
```json
[
  {
    "customer_id": "ACME_CORP",
    "customer_name": "ACME Corporation",
    "on_time_delivery_percent": 87.5,
    "on_time_count": 7,
    "late_count": 1,
    "total_shipments": 8,
    "average_days_late": 2.5,
    "top_issue": "Carrier delays (UPS)"
  },
  {
    "customer_id": "WIDGET_INC",
    "customer_name": "Widget Inc",
    "on_time_delivery_percent": 100.0,
    "on_time_count": 12,
    "late_count": 0,
    "total_shipments": 12,
    "average_days_late": 0,
    "top_issue": null
  }
]
```

---

#### 5. `getJobShipments(tenantId, jobId)`
Complete shipment history for a specific job (detail drilling).

```javascript
// Use case: "When did this order ship? Is it late? Who received it?"
```

**Parameters:**
- `tenantId` (uuid)
- `jobId` (integer): Specific job/order

**Returns:**
```json
[
  {
    "shipment_id": "ship-002",
    "job_id": 5042,
    "workorder_id": "WO-123456",
    "customer_id": "ACME_CORP",
    "po_number": "PO-2024-0842",
    "qty_shipped": 250,
    "ship_date": "2024-01-16",
    "promised_date": "2024-01-15",
    "actual_delivery_date": "2024-01-18",
    "days_late": 3,
    "shipping_carrier": "UPS",
    "tracking_number": "1Z999AA10123456784"
  }
]
```

---

#### 6. `getShippingAnomalies(tenantId, daysBack)`
Detect abnormal shipping patterns and performance drops.

```javascript
// Use case: "Are we trending worse? Are certain carriers unreliable?"
// Returns: Anomalies like:
//   - OTD dropped 10% vs. previous month
//   - Carrier X has 50% late rate (vs 5% company avg)
//   - Customer Y shipping 5 days late consistently
```

**Parameters:**
- `tenantId` (uuid)
- `daysBack` (integer, default: 30)

**Returns:**
```json
[
  {
    "anomaly_type": "carrier_performance_drop",
    "severity": "high",
    "description": "FedEx on-time delivery dropped to 60% (company avg 92%)",
    "metric": "carrier",
    "metric_value": "FedEx",
    "current_value": 0.60,
    "expected_value": 0.92,
    "impact": "high"
  },
  {
    "anomaly_type": "customer_chronic_late",
    "severity": "medium",
    "description": "ACME Corp receiving 5 of last 8 shipments late",
    "metric": "customer",
    "metric_value": "ACME_CORP",
    "current_value": 62.5,
    "expected_value": 90,
    "impact": "medium"
  }
]
```

---

#### 7. `getShippingForecast(tenantId, daysAhead)`
Predict upcoming shipment volume and identify high-risk periods.

```javascript
// Use case: "How many orders will ship next week? Any capacity issues predicted?"
```

**Parameters:**
- `tenantId` (uuid)
- `daysAhead` (integer, default: 7)

**Returns:**
```json
[
  {
    "forecast_date": "2024-01-22",
    "predicted_shipments": 12,
    "predicted_units": 1850,
    "predicted_revenue": 185000,
    "confidence": 0.88,
    "risk_factors": []
  },
  {
    "forecast_date": "2024-01-23",
    "predicted_shipments": 18,
    "predicted_units": 3200,
    "predicted_revenue": 320000,
    "confidence": 0.76,
    "risk_factors": [
      "High volume day - monitor fulfillment center capacity"
    ]
  }
]
```

---

## API Endpoints

### 1. Sync Shipping Data from IQMS

**POST /api/shipping/sync**

Manually trigger sync of shipment data from IQMS. (Normally runs on schedule, but available on-demand.)

**Request:**
```bash
curl -X POST http://localhost:3001/api/shipping/sync \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "ok": true,
  "message": "Synced 427 shipments",
  "synced": 427,
  "error": null,
  "timestamp": "2024-01-21T14:32:00Z"
}
```

---

### 2. Get On-Time Delivery Metrics

**GET /api/shipping/metrics**

Company-wide OTD % and lateness analysis.

**Request:**
```bash
curl "http://localhost:3001/api/shipping/metrics?daysBack=90" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Query Parameters:**
- `daysBack` (integer, default: 90): Analysis period

**Response:**
```json
{
  "ok": true,
  "metrics": {
    "on_time_delivery_percent": 92.5,
    "on_time_count": 247,
    "late_count": 20,
    "total_shipments": 267,
    "average_days_late": 1.8,
    "max_days_late": 8,
    "analysis_period_days": 90
  },
  "recommendation": "On-time delivery performing well."
}
```

---

### 3. Get Late Shipments

**GET /api/shipping/late**

All late deliveries in period (for operations escalation).

**Request:**
```bash
curl "http://localhost:3001/api/shipping/late?daysBack=30" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Query Parameters:**
- `daysBack` (integer, default: 30): How many days back

**Response:**
```json
{
  "ok": true,
  "late_shipments": [
    {
      "id": "ship-001",
      "workorder_id": "WO-123456",
      "job_id": 5042,
      "customer_id": "ACME_CORP",
      "customer_name": "ACME Corporation",
      "po_number": "PO-2024-0842",
      "qty_shipped": 500,
      "promised_date": "2024-01-15",
      "actual_delivery_date": "2024-01-18",
      "days_late": 3,
      "tracking_number": "1Z999AA10123456784",
      "shipping_carrier": "UPS"
    }
  ],
  "count": 20,
  "daysBack": 30
}
```

---

### 4. Get Shipping Status by Customer

**GET /api/shipping/by-customer**

Per-customer OTD tracking for relationship management.

**Request:**
```bash
curl "http://localhost:3001/api/shipping/by-customer?daysBack=90" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Query Parameters:**
- `daysBack` (integer, default: 90): Analysis period

**Response:**
```json
{
  "ok": true,
  "customers": [
    {
      "customer_id": "ACME_CORP",
      "customer_name": "ACME Corporation",
      "on_time_delivery_percent": 87.5,
      "on_time_count": 7,
      "late_count": 1,
      "total_shipments": 8,
      "average_days_late": 2.5,
      "top_issue": "Carrier delays (UPS)"
    }
  ],
  "count": 12,
  "daysBack": 90
}
```

---

### 5. Get Shipments for Specific Job

**GET /api/jobs/:jobId/shipments**

Complete shipment history for a job (drill-down view).

**Request:**
```bash
curl "http://localhost:3001/api/jobs/5042/shipments" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Path Parameters:**
- `jobId` (integer): Specific job ID

**Response:**
```json
{
  "ok": true,
  "job_id": "5042",
  "shipments": [
    {
      "shipment_id": "ship-002",
      "job_id": 5042,
      "workorder_id": "WO-123456",
      "customer_id": "ACME_CORP",
      "po_number": "PO-2024-0842",
      "qty_shipped": 250,
      "ship_date": "2024-01-16",
      "promised_date": "2024-01-15",
      "actual_delivery_date": "2024-01-18",
      "days_late": 3,
      "shipping_carrier": "UPS"
    }
  ],
  "count": 1
}
```

---

### 6. Get Shipping Anomalies

**GET /api/shipping/anomalies**

Detect abnormal shipping patterns and performance issues.

**Request:**
```bash
curl "http://localhost:3001/api/shipping/anomalies?daysBack=30" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Query Parameters:**
- `daysBack` (integer, default: 30): Analysis period

**Response:**
```json
{
  "ok": true,
  "anomalies": [
    {
      "anomaly_type": "carrier_performance_drop",
      "severity": "high",
      "description": "FedEx on-time delivery dropped to 60% (company avg 92%)",
      "metric": "carrier",
      "metric_value": "FedEx",
      "current_value": 0.60,
      "expected_value": 0.92
    }
  ],
  "count": 3,
  "daysBack": 30,
  "alert_level": "high"
}
```

---

### 7. Get Shipping Forecast

**GET /api/shipping/forecast**

Predict upcoming shipment volume and risks.

**Request:**
```bash
curl "http://localhost:3001/api/shipping/forecast?daysAhead=7" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Query Parameters:**
- `daysAhead` (integer, default: 7): Days to forecast ahead

**Response:**
```json
{
  "ok": true,
  "forecast": [
    {
      "forecast_date": "2024-01-22",
      "predicted_shipments": 12,
      "predicted_units": 1850,
      "predicted_revenue": 185000,
      "confidence": 0.88,
      "risk_factors": []
    },
    {
      "forecast_date": "2024-01-23",
      "predicted_shipments": 18,
      "predicted_units": 3200,
      "predicted_revenue": 320000,
      "confidence": 0.76,
      "risk_factors": [
        "High volume day - monitor fulfillment center capacity"
      ]
    }
  ]
}
```

---

## Integration with IQMS

### SQL Query: `apps/api/sql/iqms_shipping.sql`

The system uses a 90-day lookback query to fetch shipment data:

```sql
SELECT
  wo.WORKORDER_ID,
  wo.WORK_ORDER_STATUS,
  w.JOB_ID,
  c.CUSTOMER_ID,
  c.CUSTOMER_NAME,
  wo.PO_NUMBER,
  wo.QTY_ORDERED,
  sh.QTY_SHIPPED,
  wo.PROMISED_DATE,
  wo.ACTUAL_SHIP_DATE,
  sh.ACTUAL_DELIVERY_DATE,
  wo.WORK_ORDER_CLOSED_DATE,
  sh.TRACKING_NUMBER,
  sh.SHIPPING_CARRIER,
  sh.DELIVERY_SIGNATURE,
  CASE
    WHEN sh.ACTUAL_DELIVERY_DATE > wo.PROMISED_DATE THEN 'Late'
    WHEN sh.ACTUAL_DELIVERY_DATE <= wo.PROMISED_DATE THEN 'On Time'
    ELSE 'In Transit'
  END AS DELIVERY_STATUS,
  (sh.ACTUAL_DELIVERY_DATE - wo.PROMISED_DATE) AS DAYS_LATE_OR_EARLY
FROM
  WORKORDER wo
  JOIN SHIPMENT sh ON wo.WORKORDER_ID = sh.WORKORDER_ID
  JOIN JOB w ON wo.JOB_ID = w.JOB_ID
  JOIN CUSTOMER c ON w.CUSTOMER_ID = c.CUSTOMER_ID
WHERE
  wo.ACTUAL_SHIP_DATE >= SYSDATE - 90
  AND sh.ACTUAL_DELIVERY_DATE IS NOT NULL
ORDER BY
  sh.ACTUAL_DELIVERY_DATE DESC
```

**How to verify IQMS connectivity:**

1. Test Oracle connection:
```bash
cd /workspaces/ShadowOps/apps/api
node test-oracle-connection.js
```

2. Query shipment data:
```bash
node -e "
const db = require('./db');
const { queryIQMS } = require('./index');
queryIQMS(require('fs').readFileSync('./sql/iqms_shipping.sql', 'utf-8'))
  .then(rows => console.log('Shipments:', rows.length))
  .catch(err => console.error('Error:', err.message))
"
```

---

## Use Cases & Examples

### Use Case 1: Daily OTD Dashboard

**Problem:** Need to see if we're meeting 95% OTD target.

**Solution:**
```bash
curl "http://localhost:3001/api/shipping/metrics?daysBack=30"
```

**Action:**
- If OTD > 95%: All good, no action needed
- If OTD < 90%: Review late shipments endpoint for patterns
- If OTD 90-94%: Monitor trends, flag to ops team

---

### Use Case 2: Customer Relationship Management

**Problem:** Which high-value customers are consistently late?

**Solution:**
```bash
curl "http://localhost:3001/api/shipping/by-customer?daysBack=90" | jq '.customers | sort_by(.on_time_delivery_percent)'
```

**Action:**
- Contact customers with OTD < 85% to discuss issues (carrier, destination, etc.)
- Recognize customers with 100% OTD
- Prioritize shipments for at-risk customers

---

### Use Case 3: Carrier Performance

**Problem:** Is one carrier consistently late?

**Solution:**
```bash
curl "http://localhost:3001/api/shipping/anomalies?daysBack=30"
```

**Look for:** Anomalies with `metric = "carrier"` and `severity = "high"`

**Action:**
- If FedEx OTD is 60% but company avg is 92%, renegotiate or switch carriers
- If UPS is reliable, prioritize UPS for late shipments

---

### Use Case 4: Escalation Alerts

**Problem:** Operations team needs to know which customers will receive late orders TODAY.

**Solution:**
- Sync shipment data: `POST /api/shipping/sync`
- Get late shipments: `GET /api/shipping/late?daysBack=1`
- Send alerts via Slack/email with customer names and days late

**Action:** Custom API wrapper that polls `/api/shipping/late` and sends alerts to operations team.

---

### Use Case 5: Predictive Shipping Capacity

**Problem:** Can we handle high volume forecast next week?

**Solution:**
```bash
curl "http://localhost:3001/api/shipping/forecast?daysAhead=7"
```

**Look for:** Days with `predicted_shipments > 20` (or your facility capacity)

**Action:**
- If forecast shows 25 shipments on Jan 25, notify shipping team to prepare
- Pre-arrange additional carriers for high-volume days
- Stagger finish times to smooth shipping workload

---

## Configuration

**Environment Variables:**

```bash
# IQMS Connection (for shipment sync)
IQMS_HOST=your.oracle.server.com
IQMS_PORT=1521
IQMS_USER=iqms_read_user
IQMS_PASSWORD=secure_password
IQMS_SID=IQMS01

# Sync Schedule (cron format, or run manually)
SHIPPING_SYNC_SCHEDULE=0 */6 * * * (every 6 hours)
```

**Enable Shipping Sync:**

The shipping sync runs automatically with job snapshots. To trigger manually:

```bash
curl -X POST http://localhost:3001/api/shipping/sync \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Troubleshooting

**Issue: "Shipping sync returns 0 synced"**

1. Verify IQMS credentials:
```bash
node test-oracle-connection.js
```

2. Check SQL query output:
```bash
node -e "const { queryIQMS } = require('./index'); queryIQMS(require('fs').readFileSync('./sql/iqms_shipping.sql', 'utf-8')).then(rows => console.log('Found', rows.length, 'shipments')).catch(console.error)"
```

3. Verify connection timeout: Increase `iqms_shipping.sql` filter if > 90 days old

---

**Issue: "API returns 503 - IQMS not configured"**

1. Check environment variables:
```bash
echo $IQMS_HOST $IQMS_PORT $IQMS_USER
```

2. If not set, add to `.env`:
```bash
IQMS_HOST=your.server.com
IQMS_PORT=1521
IQMS_USER=iqms_user
IQMS_PASSWORD=password
IQMS_SID=IQMS01
```

3. Restart API:
```bash
docker restart shadowops-api
```

---

**Issue: "Late shipment alerts are wrong"**

1. Verify promised_date in IQMS: Is `PROMISED_DATE` field set correctly on POs?
2. Verify actual delivery: Is `ACTUAL_DELIVERY_DATE` populated in SHIPMENT table?
3. Check timezone: SQL query uses server timezone - convert if needed

---

## Next Steps

**Phase 2: Enhanced Insights**
1. Carrier performance dashboard (OTD % by carrier)
2. Customer risk scoring (at-risk customers for account managers)
3. Geographical delivery heatmap (regions with lateness issues)
4. Supplier/raw material impact on on-time delivery

**Phase 3: Predictive ML**
1. Use `prediction_training_data` table captures outcomes
2. Train supervised model: Predict lateness given job characteristics
3. Model features: Job complexity, customer location, manufacturing lead time, carrier choice

**Phase 4: Automation**
1. Auto-escalate late shipments to account managers
2. Auto-adjust carrier selection based on real-time OTD
3. Multi-carrier load balancing to optimize OTD

---

## Summary

The Shipping Data system provides complete on-time delivery visibility:

- **Metrics:** OTD %, per-customer performance, carrier reliability
- **Alerts:** Late shipments, anomalies, capacity forecasts
- **Integration:** Automatic IQMS sync, multi-tenant isolation, full audit trail
- **Extensibility:** Ready for ML model training via prediction_training_data table

**Key Endpoints:**
- `/api/shipping/metrics` - Company OTD dashboard
- `/api/shipping/late` - Escalation alerts (which orders are late?)
- `/api/shipping/by-customer` - Account manager insights
- `/api/shipping/anomalies` - Carrier & process issues
- `/api/shipping/forecast` - Shipping volume predictions
