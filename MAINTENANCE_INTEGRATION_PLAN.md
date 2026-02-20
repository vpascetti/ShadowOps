# IQMS Preventive Maintenance Integration Plan

**Date:** February 20, 2026  
**Status:** 🔍 Discovery Phase

---

## Tables Identified

Found 6 IQMS tables for preventive maintenance:

| Table | Purpose | Expected Content |
|-------|---------|------------------|
| **PMEQMT** | PM Equipment Master | Equipment definitions, PM schedules |
| **PMJOB** | PM Jobs | Scheduled PM jobs, frequency, due dates |
| **PMTASK** | PM Tasks | Task definitions, checklists |
| **PMWO** | PM Work Orders | Historical PM work orders |
| **PMWO_DTL** | PM Work Order Details | WO line items, parts used |
| **PMWO_TYPE** | PM Work Order Types | WO categorization (routine, emergency, etc.) |

---

## Discovery Steps

Created SQL exploration script: [explore_maintenance_tables.sql](explore_maintenance_tables.sql)

### Step 1: Schema Discovery ✅
Queries to understand:
- Column names and data types for each table
- Nullable fields
- Primary/foreign key relationships

### Step 2: Find Join Keys 🔍
**Critical:** Determine how to link maintenance data to work centers:
- Does `PMEQMT` have `EQNO` (work center ID)?
- Or `WORK_CENTER` field?
- Or different equipment identifier?
- How to join `PMEQMT.???` to `V_RT_PART_NUMBERS.EQNO`?

### Step 3: Understand Data Model 🔍
Sample queries to understand:
- How `PMEQMT` (equipment) relates to `PMJOB` (scheduled PMs)
- How `PMJOB` relates to `PMWO` (work orders)
- What fields indicate:
  - Last PM date
  - Next PM due date
  - PM frequency/interval
  - PM status (overdue, due soon, OK)

### Step 4: Coverage Analysis 🔍
Determine:
- How many of our 111 work centers have PM equipment records?
- Coverage percentage
- Are some machines excluded from PM tracking?

---

## Expected Data Fields

### From PMEQMT (Equipment Master)
Likely fields (to be confirmed):
- `EQMT_ID` - Equipment ID (PK)
- `EQMT_NO` - Equipment number
- `EQNO` or `WORK_CENTER` - Link to work center (FK)
- `DESCRIPTION` - Equipment description
- `MANUFACTURER` - Make/model
- `SERIAL_NO` - Serial number
- `INSTALL_DATE` - Installation date
- `STATUS` - Active/inactive

### From PMJOB (Scheduled Jobs)
Likely fields (to be confirmed):
- `JOB_ID` - Job ID (PK)
- `EQMT_ID` - Equipment ID (FK)
- `JOB_NO` - Job number
- `DESCRIPTION` - Job description
- `FREQUENCY` - Interval (e.g., 30, 60, 90)
- `FREQUENCY_TYPE` - Type (DAYS, HOURS, MONTHS)
- `NEXT_DUE_DATE` - When next PM is due
- `LAST_COMPLETED_DATE` - Last time performed
- `STATUS` - ACTIVE, INACTIVE, ON_HOLD

### From PMWO (Work Orders)
Likely fields (to be confirmed):
- `WO_NO` - Work order number (PK)
- `EQMT_ID` - Equipment ID (FK)
- `JOB_ID` - PM Job ID (FK)
- `WO_DATE` - WO created date
- `SCHEDULED_DATE` - When work scheduled
- `COMPLETED_DATE` - When work completed
- `STATUS` - OPEN, IN_PROGRESS, COMPLETED, CANCELLED
- `WO_TYPE` - Type of PM (routine, emergency, etc.)
- `TECHNICIAN` - Who performed work
- `DURATION_HOURS` - Time spent

---

## Integration Goals

### Goal 1: Add Maintenance Data to Realtime Endpoint
**Endpoint:** `/api/realtime/part-numbers`

**New Fields to Add:**
```typescript
RealtimePartNumber {
  // Existing fields...
  work_center: string
  shift_dwn: number
  avg_cycle: number
  
  // NEW: Maintenance fields
  last_pm_date?: string           // Last completed PM
  days_since_last_pm?: number     // Days since last PM
  next_pm_due_date?: string       // Next scheduled PM
  days_until_next_pm?: number     // Days until next PM
  pm_frequency?: number           // PM interval (days/hours)
  pm_frequency_type?: string      // 'DAYS' | 'HOURS' | 'MONTHS'
  pm_status?: string              // 'OK' | 'DUE_SOON' | 'OVERDUE'
  equipment_id?: string           // IQMS equipment ID
  equipment_age_years?: number    // Years since install
}
```

### Goal 2: Update Maintenance Due Logic
**Current (health-based only):**
```typescript
maintenance_due_in_days = health === 'critical' ? 1 : health === 'warning' ? 5 : 14
```

**New (combine health + schedule):**
```typescript
const scheduledDays = days_until_next_pm ?? 999
const healthDays = health === 'critical' ? 1 : health === 'warning' ? 5 : 14
const overdueFlag = pm_status === 'OVERDUE'

maintenance_due_in_days = overdueFlag ? 0 : Math.min(scheduledDays, healthDays)
```

### Goal 3: Enhanced UI Display
**Current:**
```
Maintenance Due: 5d
```

**New:**
```
Maintenance Due: 5d
  Last PM: 45 days ago (PM interval: 60d)
  Next scheduled: Feb 25
  Status: Due soon
```

---

## SQL Query Template

Once schema is confirmed, create:
**File:** `apps/api/sql/iqms_realtime_with_maintenance.sql`

```sql
SELECT
  -- Existing realtime fields
  rt.EQNO AS work_center,
  rt.CNTR_DESC AS work_center_desc,
  rt.AVG_CYCLE AS avg_cycle,
  rt.STD_CYCLE AS std_cycle,
  rt.SHIFT_DWN AS shift_dwn,
  -- ... (all existing fields)
  
  -- NEW: Maintenance fields
  eq.EQMT_ID AS equipment_id,
  eq.EQMT_NO AS equipment_number,
  eq.INSTALL_DATE AS equipment_install_date,
  TRUNC((SYSDATE - eq.INSTALL_DATE) / 365.25) AS equipment_age_years,
  
  last_pm.COMPLETED_DATE AS last_pm_date,
  TRUNC(SYSDATE - last_pm.COMPLETED_DATE) AS days_since_last_pm,
  
  next_pm.NEXT_DUE_DATE AS next_pm_due_date,
  TRUNC(next_pm.NEXT_DUE_DATE - SYSDATE) AS days_until_next_pm,
  next_pm.FREQUENCY AS pm_frequency,
  next_pm.FREQUENCY_TYPE AS pm_frequency_type,
  
  CASE
    WHEN next_pm.NEXT_DUE_DATE IS NULL THEN NULL
    WHEN next_pm.NEXT_DUE_DATE < SYSDATE THEN 'OVERDUE'
    WHEN next_pm.NEXT_DUE_DATE <= SYSDATE + 7 THEN 'DUE_SOON'
    ELSE 'OK'
  END AS pm_status

FROM IQMS.V_RT_PART_NUMBERS rt

-- Join to equipment
LEFT JOIN IQMS.PMEQMT eq 
  ON rt.EQNO = eq.???? -- TODO: Confirm join key

-- Get last completed PM
LEFT JOIN LATERAL (
  SELECT 
    wo.EQMT_ID,
    wo.COMPLETED_DATE
  FROM IQMS.PMWO wo
  WHERE wo.EQMT_ID = eq.EQMT_ID
    AND wo.COMPLETED_DATE IS NOT NULL
  ORDER BY wo.COMPLETED_DATE DESC
  FETCH FIRST 1 ROW ONLY
) last_pm ON 1=1

-- Get next scheduled PM
LEFT JOIN LATERAL (
  SELECT
    job.EQMT_ID,
    job.NEXT_DUE_DATE,
    job.FREQUENCY,
    job.FREQUENCY_TYPE
  FROM IQMS.PMJOB job
  WHERE job.EQMT_ID = eq.EQMT_ID
    AND job.STATUS = 'ACTIVE'
  ORDER BY job.NEXT_DUE_DATE
  FETCH FIRST 1 ROW ONLY
) next_pm ON 1=1

WHERE rt.PK_HIDE IS NULL
  AND (rt.IS_VIRTUAL IS NULL OR rt.IS_VIRTUAL IN (' ', 'N'))
ORDER BY rt.EQNO;
```

---

## Implementation Plan

### Phase 1: Discovery (Day 1) 🔍
- [x] Identify PM tables (DONE)
- [ ] Run schema exploration queries
- [ ] Understand table relationships
- [ ] Find join key between PMEQMT and V_RT_PART_NUMBERS
- [ ] Sample data to validate structure
- [ ] Calculate coverage percentage

### Phase 2: SQL Development (Day 2) 
- [ ] Create `iqms_realtime_with_maintenance.sql` query
- [ ] Test on dev database
- [ ] Validate data quality (null handling, date formats)
- [ ] Performance test with 111 work centers
- [ ] Add to environment config

### Phase 3: API Integration (Day 3)
- [ ] Update `RealtimePartNumber` TypeScript interface
- [ ] Update `formatRealtimePart()` function
- [ ] Add new fields to API response
- [ ] Test endpoint: `/api/realtime/part-numbers`
- [ ] Validate 111 work centers return maintenance data

### Phase 4: Logic Update (Day 3-4)
- [ ] Update `analyzeRealtimeMachines()` in machineTendency.ts
- [ ] Implement combined health + schedule logic
- [ ] Handle null/missing maintenance data gracefully
- [ ] Add maintenance status indicators
- [ ] Update maintenance_due_in_days calculation

### Phase 5: UI Enhancement (Day 4-5)
- [ ] Update MachineHealthPanel component
- [ ] Display last PM date
- [ ] Display next scheduled PM date
- [ ] Show PM status badge (OK/DUE_SOON/OVERDUE)
- [ ] Add tooltip with full maintenance context
- [ ] Update styling for overdue indicator

### Phase 6: Testing & Validation (Day 5)
- [ ] Verify data accuracy with ops team
- [ ] Compare system due dates vs actual schedules
- [ ] Test edge cases (no PM data, overdue, etc.)
- [ ] Performance validation with full dataset
- [ ] UAT with maintenance team

---

## Next Actions

1. **Run Exploration Queries** ✅ Created
   - Execute [explore_maintenance_tables.sql](explore_maintenance_tables.sql)
   - Document results
   
2. **Identify Join Key** 🔍 CRITICAL
   - Determine how PMEQMT links to work centers
   - Options: EQNO, WORK_CENTER, RESOURCE_ID, or custom mapping

3. **Sample Data Review** 
   - Look at 5-10 equipment records
   - Verify PMJOB has NEXT_DUE_DATE
   - Verify PMWO has COMPLETED_DATE
   - Check date formats (Oracle DATE type)

4. **Coverage Check**
   - How many of 111 work centers have PM records?
   - Are injection molding machines covered?
   - Are extrusion lines covered?
   - What equipment types are excluded?

---

## Success Criteria

### Data Quality
- [ ] 80%+ of work centers have PM equipment records
- [ ] Last PM dates populated for active equipment
- [ ] Next due dates calculated for scheduled PMs
- [ ] PM frequency/interval data available

### Functional
- [ ] Maintenance due dates based on BOTH health and schedule
- [ ] "Overdue" status displays correctly
- [ ] "Due soon" (7 day window) alerts correctly
- [ ] Null/missing maintenance data handled gracefully

### User Experience
- [ ] Operators see actual PM schedules
- [ ] Maintenance team can validate due dates
- [ ] Overdue PMs highlighted in red
- [ ] Historical context visible (last PM date)

---

## Risk Mitigation

### Risk 1: Join Key Not Found
**Mitigation:** 
- Check for mapping table (EQUIPMENT_WORK_CENTER_MAP?)
- Use equipment number + naming convention match
- Fallback: Manual mapping file for critical equipment

### Risk 2: Poor Data Coverage
**Mitigation:**
- Document which equipment types lack PM data
- Use health-based estimation as fallback
- Phased rollout (PM data where available)

### Risk 3: Stale PM Data
**Mitigation:**
- Add "last updated" timestamp
- Cache invalidation every 15 minutes
- Show data freshness in UI

### Risk 4: Performance Impact
**Mitigation:**
- LEFT JOIN maintenance (won't block realtime data)
- Index optimization on EQMT_ID
- LATERAL queries for top-1 PM records
- Query plan analysis before production

---

## Documentation Updates

After integration complete:
- [ ] Update [MAINTENANCE_DUE_ANALYSIS.md](MAINTENANCE_DUE_ANALYSIS.md)
- [ ] Update [PLANT_PULSE_VALIDATION.md](PLANT_PULSE_VALIDATION.md)
- [ ] Document in API README
- [ ] Update DEMO_GUIDE with PM features

---

**Status:** Ready for Step 1 (Schema Discovery)  
**Blocker:** Need to run exploration queries to understand table structure  
**Owner:** Database team to execute SQL queries and share results
