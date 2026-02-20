# PMJOB Simple Integration Plan

## Overview
Focus on **PMJOB table only** for initial PM schedule integration - simpler, faster, lower risk than a 6-table approach.

## What We Need from PMJOB

### Critical Fields
1. **Work Center Link** - How does PMJOB connect to V_RT_PART_NUMBERS.EQNO?
   - Column name like: EQNO, WORK_CENTER, RESOURCE_ID, EQUIPMENT_ID, EQMT_ID
2. **Next Due Date** - When is the next PM scheduled?
   - Column name like: NEXT_DUE_DATE, DUE_DATE, NEXT_DATE, SCHEDULED_DATE
3. **Status** - Is the PM active/inactive/completed?
   - Column name like: STATUS, JOB_STATUS, ACTIVE

### Nice-to-Have Fields
4. **Last Completed Date** - When was the PM last done?
   - Column name like: LAST_COMPLETED, COMPLETED_DATE, LAST_DATE
5. **Frequency** - How often is PM scheduled?
   - Column name like: FREQUENCY, INTERVAL, FREQUENCY_TYPE (days/weeks/months)
6. **Description** - What PM work is involved?
   - Column name like: DESCRIPTION, JOB_DESC, TITLE

## Three-Step Integration

### Step 1: Run Discovery (User Task)
Execute `explore_pmjob_simple.sql` and provide:
- [ ] All PMJOB column names (Step 1)
- [ ] Sample data showing 5-10 rows (Step 2)
- [ ] Confirm work center link column name (Step 3)
- [ ] Confirm due date column name (Step 4)
- [ ] Status values that mean "active" (Step 5)

### Step 2: Build Simple SQL (Agent Task)
Create `iqms_realtime_with_pmjob.sql`:

```sql
-- Simplified template - to be adjusted based on actual column names
SELECT 
  -- All existing V_RT_PART_NUMBERS columns
  rt.EQNO AS work_center,
  rt.CNTR_DESC AS work_center_desc,
  rt.SHIFT_DWN,
  rt.AVG_CYCLE,
  ... (all 27 existing fields),
  
  -- Add just 3 PM fields from PMJOB
  next_pm.NEXT_DUE_DATE AS next_pm_due_date,
  CASE 
    WHEN next_pm.NEXT_DUE_DATE IS NULL THEN NULL
    ELSE TRUNC(next_pm.NEXT_DUE_DATE - SYSDATE)
  END AS days_until_next_pm,
  next_pm.STATUS AS pm_status

FROM IQMS.V_RT_PART_NUMBERS rt

-- Get earliest next PM for this work center
LEFT JOIN LATERAL (
  SELECT 
    NEXT_DUE_DATE,
    STATUS
  FROM IQMS.PMJOB pm
  WHERE pm.{WORK_CENTER_COLUMN} = rt.EQNO  -- TODO: Replace {WORK_CENTER_COLUMN}
    AND pm.STATUS = 'ACTIVE'  -- TODO: Adjust status value if needed
    AND pm.NEXT_DUE_DATE IS NOT NULL
  ORDER BY pm.NEXT_DUE_DATE ASC
  FETCH FIRST 1 ROW ONLY
) next_pm ON 1=1

WHERE rt.PK_HIDE IS NULL
  AND (rt.IS_VIRTUAL IS NULL OR rt.IS_VIRTUAL IN (' ', 'N'));
```

Success criteria:
- Query returns 113 rows (same as current)
- ~80+ work centers have `next_pm_due_date` populated
- `days_until_next_pm` correctly calculates negative for overdue

### Step 3: Update Application Code (Agent Task)

#### 3.1 Update TypeScript Interface
File: `apps/api/src/types.ts` (or wherever RealtimePartNumber is defined)

```typescript
export interface RealtimePartNumber {
  // ... existing 27 fields ...
  
  // Add 3 PM fields
  next_pm_due_date: string | null;        // ISO date string "2026-02-25"
  days_until_next_pm: number | null;      // Can be negative if overdue
  pm_status: string | null;               // "ACTIVE", etc.
}
```

#### 3.2 Update SQL Query Usage
File: `apps/api/index.js` or `apps/api/db.js`

Replace `iqms_realtime_part_numbers.sql` reference with `iqms_realtime_with_pmjob.sql`

#### 3.3 Enhance Maintenance Logic
File: `apps/web/src/utils/machineTendency.ts` (Line 238)

**Current logic:**
```typescript
maintenance_due_in_days: health === 'critical' ? 1 : health === 'warning' ? 5 : 14
```

**New combined logic:**
```typescript
maintenance_due_in_days: (() => {
  const healthBasedDays = health === 'critical' ? 1 : health === 'warning' ? 5 : 14;
  const scheduledDays = machine.days_until_next_pm;
  
  // If we have scheduled PM data, use the earlier of health-based or scheduled
  if (scheduledDays !== null && scheduledDays !== undefined) {
    return Math.min(healthBasedDays, scheduledDays);
  }
  
  // Fall back to health-based estimate
  return healthBasedDays;
})()
```

This ensures:
- If PM is overdue (days_until_next_pm = -5), we show -5 (overdue takes priority)
- If PM is soon (days_until_next_pm = 2) but health is good, we show 2 (schedule wins)
- If health is critical (1 day) but PM is months away, we show 1 (health wins)
- If no PM data available, we fall back to health-based estimate

#### 3.4 Update UI (Optional Enhancement)
File: `apps/web/src/components/PlantPulsePanel.jsx`

Add PM context to machine cards:

```jsx
<div className="machine-maintenance">
  <span className="maintenance-due">
    Maintenance: {machine.maintenance_due_in_days}d
  </span>
  {machine.next_pm_due_date && (
    <span className="pm-schedule" title={`Scheduled PM: ${machine.next_pm_due_date}`}>
      📅 {machine.days_until_next_pm < 0 ? 'OVERDUE' : 'Scheduled'}
    </span>
  )}
</div>
```

## Benefits of Simple Approach

✅ **Fast Implementation** - One table, one join, minimal code changes  
✅ **Low Risk** - No complex multi-table joins that could fail  
✅ **Immediate Value** - Shows actual PM schedules vs health estimates  
✅ **Easy to Test** - Can verify 113 rows still return with 3 new fields  
✅ **Extensible** - Can add PMWO last-completed data later if needed  

## Success Metrics

- [ ] Query executes in < 2 seconds
- [ ] All 113 work centers return (no loss of data)
- [ ] 80%+ work centers have `next_pm_due_date` populated
- [ ] Overdue PMs correctly show negative `days_until_next_pm`
- [ ] Plant Pulse UI shows "Maintenance: -5d" for overdue equipment
- [ ] Health-based prediction still works for equipment without PM schedules

## Future Enhancements (Later)

Once PMJOB integration is stable:
- Add PMWO join for `last_pm_completed_date` and `days_since_last_pm`
- Add PMTASK join for detailed task lists
- Add PM work order history for trending
- Add frequency/interval tracking for predictive scheduling

## Next Step

**User:** Run `explore_pmjob_simple.sql` (Steps 1-6) and provide:
1. Screenshot or text of PMJOB columns (Step 1 output)
2. Sample of 5-10 rows (Step 2 output)
3. Result of join key search (Step 3 output)
4. Result of date fields search (Step 4 output)
5. Status value list (Step 5 output)

**Agent:** Will build `iqms_realtime_with_pmjob.sql` using discovered structure and update TypeScript/logic accordingly.
