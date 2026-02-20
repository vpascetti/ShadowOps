# Plant Pulse: Maintenance Due Date Analysis

**Status:** ⚠️ CRITICAL ISSUE - Maintenance dates are estimates, not based on actual maintenance history

---

## Current Maintenance Due Logic

### Overview
The Plant Pulse currently calculates maintenance due dates **based on machine health status only**, not on actual maintenance schedules or historical maintenance records.

### How It Currently Works

**File:** [machineTendency.ts - Line 238](apps/web/src/utils/machineTendency.ts#L238)

```typescript
maintenance_due_in_days: health === 'critical' ? 1 : health === 'warning' ? 5 : 14
```

### The Algorithm

**Step 1: Determine Machine Health Status**

Machine health is determined by current shift performance:

```typescript
let health: MachineHealthStatus = 'healthy'

if (downHours >= 3 || cycleTrend > 5 || errorRate >= 10) {
  health = 'critical'
} else if (downHours >= 1 || cycleTrend > 2 || errorRate >= 5) {
  health = 'warning'
}
```

**Health Thresholds:**

| Factor | Threshold | Triggers |
|--------|-----------|----------|
| **Downtime** | >= 3 hours | CRITICAL |
| | >= 1 hour | WARNING |
| **Cycle Drift** | > 5 seconds | CRITICAL |
| | > 2 seconds | WARNING |
| **Error Rate** | >= 10% | CRITICAL |
| | >= 5% | WARNING |

**Step 2: Assign Maintenance Window Based on Health**

```typescript
maintenance_due_in_days: 
  health === 'critical' ? 1 :     // 1 day if critical
  health === 'warning' ? 5 :      // 5 days if warning
  14                              // 14 days if healthy
```

### What This Produces

| Health Status | Maintenance Due | Meaning |
|---|---|---|
| 🔴 **CRITICAL** | **1 day** | "Dispatch maintenance immediately" |
| 🟡 **WARNING** | **5 days** | "Inspect within 48 hours" |
| 🟢 **HEALTHY** | **14 days** | "Continue monitoring" |

---

## What's Missing: Real Maintenance Data

### ❌ No Actual Maintenance History
The system currently has **NO**:
- Last maintenance date per machine
- Planned preventive maintenance (PM) schedule
- Equipment master maintenance intervals
- Maintenance completion records
- Maintenance technician logs
- MTBF (Mean Time Between Failures) historical data

### ❌ No IQMS Maintenance Integration
The SQL query for realtime data [iqms_realtime_part_numbers.sql](apps/api/sql/iqms_realtime_part_numbers.sql) includes:

✅ **Performance Data Available:**
- avg_cycle / std_cycle (cycle time drift)  
- shift_up / shift_dwn (uptime/downtime hours)
- qc_issue_count / run_qty (quality rate)
- down_code / down_descrip (current downtime reason)

❌ **Missing Maintenance Data:**
- last_maintenance_date
- next_pm_due_date
- maintenance_interval_hours
- maintenance_hours_since_pm
- equipment_mtbf
- maintenance_history
- preventive_maintenance_schedule

---

## Data Available vs Data Needed

### Current Realtime Fields (27 total)
```
✅ work_center (machine ID)
✅ work_center_desc (machine name)
✅ shift_up / shift_dwn (uptime/downtime)
✅ avg_cycle / std_cycle / last_cycle (performance)
✅ down_code / down_descrip (failure reason)
✅ qc_issue_count / run_qty (quality)
✅ start_time (job start)
✅ has_qc_issues
... (11 more)

❌ NO: last_maintenance_date
❌ NO: maintenance_due_date  
❌ NO: maintenance_interval
❌ NO: maintenance_history
❌ NO: equipment_model
❌ NO: equipment_age
❌ NO: service_contract
```

### IQMS Tables That Might Have Maintenance Data
(Suggested for investigation)
- **IQMS.EQUIPMENT_MASTER** - Equipment definitions with PM schedules
- **IQMS.MAINTENANCE_LOG** - Historical maintenance records
- **IQMS.PM_SCHEDULE** - Preventive maintenance calendar
- **IQMS.WORK_ORDER_MAINTENANCE** - Maintenance work orders
- **IQMS.DOWNTIME_CODES** - Equipment failure categorization

---

## What Maintenance Due Dates Actually Mean Today

### 🔴 "1 Day" (CRITICAL Health)

**Current Triggers:**
- Machine already down >= 3 hours THIS SHIFT, OR
- Cycle time degrading > 5 seconds from standard, OR
- Error rate >= 10%

**Interpretation:**
- "This machine is ALREADY broken or breaking NOW"
- Due date assumes: "Fix today to restore production"
- NOT based on: Last time maintenance was done

**Real-World Problem:**
```
Machine MIXER02 shows "Maintenance Due: 1d" 
because it has 74.2 hours of downtime TODAY

Truth: Could be down for a known equipment failure,
       not a scheduled PM that's overdue
```

### 🟡 "5 Days" (WARNING Health)

**Current Triggers:**
- Machine down >= 1 hour (but < 3), OR
- Cycle drift > 2 seconds (but < 5), OR
- Error rate >= 5% (but < 10%)

**Interpretation:**
- "Machine performance degrading, inspect soon"
- Assumes: "Degradation will worsen, PM needed"
- NOT based on: Actual maintenance schedule

**Real-World Problem:**
```
Machine shows "Maintenance Due: 5d" because 
cycle time is 1 second over standard

Truth: Machine may have just been serviced,
       or 1-second drift may be normal variation
```

### 🟢 "14 Days" (HEALTHY)

**Current Logic:**
- Not CRITICAL and not WARNING

**Interpretation:**
- "No urgent maintenance needed, check back in 2 weeks"
- Generic placeholder interval
- NOT based on: Actual PM schedule

**Real-World Problem:**
```
Machine shows "Maintenance Due: 14d" 
But actual PM schedule says: Due TOMORROW
(maintenance data not available)
```

---

## The Real Issue: Predictive vs Scheduled Maintenance

### What We're Doing (Condition-Based)
```
Current Performance → Health Score → Estimate When Maintenance Needed
(Reactive/Predictive)
```

**Example:**
- Machine: Downtime 1.5h, Cycle drift +3s
- Health: WARNING
- Maintenance Due: 5 days ← Estimated prediction

### What We Should Be Doing (Schedule-Based)
```
Maintenance Schedule + Equipment History + Current Health → Override Due Date
(Proactive/Scheduled + Predictive)
```

**Better Example:**
- Machine: Downtime 1.5h, Cycle drift +3s
- Health: WARNING
- **Last PM:** 45 days ago (interval: 60 days)
- **Maintenance Due:** 15 days (from schedule)
- **Override:** 5 days (health indicates sooner needed)
- **Final:** 5 days ← Use most urgent

---

## What Maintenance Data Should Be Used

### From Equipment Master
```
Equipment:
  - Model: "ENGEL Victory 130T"
  - Age: 8 years
  - Last Maintenance: 2026-02-01
  - PM Interval: 90 days
  - MTBF: 2000 hours
  - Hours Since PM: 156 hours
  - Next PM Due: 2026-05-01 (in 70 days)
  
Status:
  - Current hours since PM: 156h
  - At risk if: > 80% of interval (156/180 = 87%)
  - Due if: > interval (156/90 = 173%)
  - Overdue if: 2x + interval
```

### From Downtime Codes
```
Current downtime: "HYDRAULIC_LEAK"
  - Severity: High
  - Typical fix: 4-6 hours
  - Preventable by: Oil analysis + seal inspection
  - Triggers PM: Yes
  - Recommended frequency: Quarterly
```

### From Maintenance History
```
Last 5 maintenance events:
  1. 2026-02-01: Routine PM (2h) - Oil change + seal check ✅
  2. 2026-01-15: Emergency repair (4h) - Pump failure 🔴
  3. 2025-12-20: Routine PM (2h) - Oil change + seal check ✅
  4. 2025-11-30: Inspection only (1h) - Found crack 🟡
  5. 2025-10-15: Routine PM (2h) - Oil change ✅
  
Pattern: Emergency repairs every 45-50 days
Recommendation: Increase PM frequency to monthly
```

---

## Gap Analysis

### What Works ✅
- **Real-time performance detection**
  - Identifies machines degrading NOW
  - Detects cycles getting slower
  - Catches QC problems immediately

### What's Blind ⚠️
- **Maintenance schedules**
  - Don't know when PM is actually due
  - Don't know when last PM happened
  - Don't know equipment age/MTBF

### What's Missing ❌
- **Maintenance history**
  - Can't see failure patterns
  - Can't calculate optimal PM intervals
  - Can't predict repeat failures

### What's Risky 🔴
- **False confidence**
  - "14 days due" might mean "PM not due for 90 days"
  - Or might mean "should check today"
  - Users don't know which

---

## Real-World Examples

### Example 1: EXT LINE 1 (Critical - 74.2h downtime)
```
Current Data:
  - Work Center: "EXT LINE 1"
  - Downtime this shift: 74.2 hours
  - Current Health: CRITICAL
  - Maintenance Due: 1 day ("NOW")
  
Current UI Shows:
  🔴 CRITICAL | Maintenance Due: NOW
  "Dispatch maintenance immediately"
  
Missing Context:
  ❓ Is this a KNOWN equipment failure?
  ❓ Was this machine down during off-shift?
  ❓ Is a tech already assigned?
  ❓ When was last PM?
  ❓ Is maintenance arriving in 30 min?
  
Problem: "1 day" doesn't tell if tech is already en route
```

### Example 2: MIXER02 (74.2h downtime) 
```
Same as above - system sees only current shift performance
No historical context about this machine's reliability
```

### Example 3: B-06 (74.2h downtime)
```
Same pattern - CRITICAL just means "down NOW"
Not "maintenance is overdue by X days"
```

### Example 4: Machine with Predictive Maintenance
```
Healthy machine, 0 downtime, normal cycles
Current: "Maintenance Due: 14 days" (healthy default)

What we DON'T know:
  - Is this machine's PM schedule due in 3 days? (OVERDUE)
  - Or is PM not due for 50 days? (FINE)
  - Did last PM happen like scheduled?
```

---

## Recommendations

### Phase 1: Validation (Immediate)
1. **Verify IQMS has maintenance data**
   - Check for V_MAINTENANCE or V_PM views
   - Check EQUIPMENT_MASTER table
   - Check MAINTENANCE_LOG table
   - Check downtime codes mapping

2. **Confirm maintenance logic assumptions**
   - Clarify what "1 day", "5 days", "14 days" mean
   - Document business rules
   - Validate thresholds match ops standards

### Phase 2: Integration (Days 3-5)
1. **Add maintenance data to realtime endpoint**
   - Query last maintenance date per machine
   - Query PM schedule due date
   - Query equipment age / hours
   - Join to IQMS maintenance tables

2. **Update SQL query**
   - Extend iqms_realtime_part_numbers.sql
   - Add maintenance date fields
   - Add PM schedule fields
   - Add equipment characteristics

3. **Enhance maintenance logic**
   - Compare against actual PM schedule
   - Use most-urgent between predicted and scheduled
   - Show "X days overdue" if applicable
   - Show "was due Y days ago"

### Phase 3: Visibility (Days 6-7)
1. **Show maintenance context**
   - Last PM date
   - Next scheduled PM date
   - Days since last PM
   - Days until next PM
   - Equipment age / MTBF

2. **Improve UI display**
   - Color code by "days from due" not just health
   - Show if overdue vs upcoming
   - Display maintenance history on hover
   - Link to work order system

---

## Testing Questions

1. **For Operations:**
   - "When the system shows 'Maintenance Due: 1d', what does that mean to you?"
   - "How do you know if a machine actually needs maintenance?"
   - "Where do you get the real maintenance schedule?"
   - "What's your PM interval for [specific machine]?"

2. **For Maintenance:**
   - "When was the last time [Machine X] had PM?"
   - "What's the typical PM interval for your equipment?"
   - "How do you schedule preventive maintenance?"
   - "What failures are you trying to prevent?"

3. **For IQMS:**
   - "Where do you track maintenance history?"
   - "Do you have equipment master data?"
   - "Is there a PM schedule or calendar system?"
   - "Can we query last maintenance date by work center?"

---

## Summary

### 🎯 Current State
The maintenance due dates shown in Plant Pulse are **estimates based on current machine health**, not actual maintenance schedules. 

**Maintenance "due in X days" means:** "Based on performance degradation, maintenance intervention may be needed within X days"

**It does NOT mean:** "According to the maintenance schedule, PM is due in X days"

### ⚠️ Risk
- Operators might not perform scheduled PM while thinking machine is "healthy" (14 day estimate)
- Operators might over-maintain healthy machines that just have normal performance variation
- Maintenance team has no visibility into actual PM schedules
- "1 day" for critical machines might mean "emergency repair needed TODAY" or "PM overdue by 30 days" - unclear

### ✅ Solution
Integrate actual maintenance schedule data from IQMS, then use **the most restrictive** due date:
```
Maintenance Due = min(
  predictive_model_days,    // From current health
  scheduled_pm_days,        // From PM calendar  
  last_maintenance_days     // Overdue calculation
)
```

This gives operators both **predictive insight** AND **scheduled compliance**.

---

**Status:** Ready for Phase 1 validation and Phase 2 integration once IQMS maintenance data is confirmed available.
