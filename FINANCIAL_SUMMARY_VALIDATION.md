# Financial Summary Validation Report

**Generated:** February 20, 2026  
**Endpoint:** `/api/financial-summary`  
**Data Source:** IQMS Live Data via `iqms_jobs_fast.sql` 

## Current Financial Summary

### Summary Metrics
| Metric | Value | Status |
|--------|--------|---------|
| **Total Order Value** | **$178,579,591** | ⚠️ Extremely High |
| Revenue at Risk | $78,825,025 | 44% of total (119 jobs score ≥70) |
| Delayed Order Impact | $8,287,242 | 4.6% of total (128 jobs overdue/due soon) |
| WIP Value | $178,579,591 | Same as total (0 closed jobs) |
| On-Time Delivery Rate | 0% | ⚠️ No completed jobs |

### Job Metrics
| Metric | Value | Notes |
|--------|--------|-------|
| Total Jobs | 418 | |
| Jobs with Pricing | 351 | 84% coverage |
| Avg Unit Price |$226.04 | Seems reasonable |
| Avg Order Value | **$427,224** | ⚠️ Very high |
| Overdue Jobs | 52 | 12.4% |
| Due Within 7 Days | 76 | 18.2% |
| At-Risk Jobs (score ≥70) | 119 | 28.5% |
| Total Remaining Work | 218,097 hours | ~105 work-years |

## Critical Issues Found

### 🚨 Issue #1: Three Massive SYGMANET Orders Dominate Everything

**Top 5 Orders by Value:**
1. OINGO3I4N (SYGMANET) - **$67,283,038** 
2. 3498899834 (SYGMANET) - **$67,123,240**
3. OINGO3I4N (SYGMANET) - **$23,734,729**
4. BM-002 (ABCO001) - $2,532,000
5. 490301400 (ABCO001) - $2,236,895

**Impact:**
- 3 SYGMANET orders = **$158,140,007** (88.5% of total WIP)
- Remaining 415 jobs = **$20,439,584** (11.5% of total WIP)
- Average order without SYGMANET = **$49,252** (vs $427k with them)

**Possible Causes:**
1. **Legitimate High-Volume Orders**
   - $67M ÷ $105.13/unit = ~640,000 units per order
   - Plausible for high-volume manufacturing contracts
   - SYGMANET might be a major OEM customer

2. **Data Quality Issue - Wrong Quantity**
   - `PTALLOCATE.MFG_QUAN` might include cumulative or lifetime quantity
   - Should be using order quantity, not production history

3. **Data Quality Issue - Wrong Price Field**
   - Using `ORD_DETAIL.UNIT_PRICE` but should use `ORD_DETAIL.TOT_LINE`?
   - Or UNIT_PRICE field populated incorrectly in ERP

4. **Currency or Unit Mismatch**
   - Price in dollars but quantity in thousands?
   - Missing decimal point (e.g., 640 vs 640,000)?

### 🚨 Issue #2: Zero Completed Jobs

**Finding:** `completedJobs: 0` out of 418 total

**Possible Causes:**
1. **Status Field Mapping Issue**
   - SQL uses `CASE WHEN ... < SYSDATE THEN 'closed' ELSE 'open'` based on due date
   - Should be checking actual order status field (e.g., `WORKORDER.STATUS`)
   - Jobs might be completed but not past due date yet

2. **Test/Development Environment**
   - All jobs are active/open in this system
   - No historical closed orders loaded

**Impact:**
- On-Time Delivery Rate = 0% (meaningless)
- WIP Value = Total Order Value (no differentiation)

### 🚨 Issue #3: Missing Manufacturing Quantities

**Finding:** Many jobs show `mfg_quantity: null`

**Sample:**
```json
{
  "part": "CC3641050-00",
  "unit_price": 18.225,
  "total_order_value": 44833.5,
  "mfg_quantity": null  // ← Missing!
}
```

**Calculation:**
- If `mfg_quantity` is null, we can't verify: $44,833.50 ÷ $18.225 = 2,460 units (implied)
- But UI shows `null` for the quantity field

**Possible Causes:**
- `PTALLOCATE` table not joined correctly
- Using wrong quantity field (should use `CYCLES_REQ` from WORKORDER?)
- Data not populated in IQMS for these orders

## SQL Query Analysis

### Current Calculation
```sql
-- From iqms_jobs_fast.sql Line 41
ORD_DETAIL.UNIT_PRICE AS unit_price,
(ORD_DETAIL.UNIT_PRICE * PTALLOCATE.MFG_QUAN) AS total_order_value
```

### Potential Issues with Join
```sql
-- Pricing join (Lines 107-111)
LEFT OUTER JOIN IQMS.ORDERS ORDERS
  ON ORDERS.ORDERNO = PTORDER_REL.ORDERNO
LEFT OUTER JOIN IQMS.ORD_DETAIL ORD_DETAIL
  ON ORD_DETAIL.ORDERS_ID = ORDERS.ID
```

**Missing:** `AND ORD_DETAIL.ITEMNO = WORKORDER.PART_NO`

This could cause:
- Multiple ORD_DETAIL rows per work order (Cartesian join)
- Wrong line item matched to work order
- Inflated prices from wrong part number

### Alternative Fields to Consider
```sql
-- Instead of UNIT_PRICE * MFG_QUAN, try:
ORD_DETAIL.TOT_LINE AS total_order_value  -- Pre-calculated line total
-- Or:
ORD_DETAIL.UNIT_PRICE AS unit_price,
ORD_DETAIL.QUAN_ORD AS order_quantity,     -- Actual order quantity
(ORD_DETAIL.UNIT_PRICE * ORD_DETAIL.QUAN_ORD) AS total_order_value
```

## Recommendations

### Immediate Actions

1. **Verify SYGMANET Orders** ✅ CRITICAL
   ```sql
   -- Run this query in IQMS to check actual values
   SELECT 
     WORKORDER.PART_NO,
     WORKORDER.CYCLES_REQ,
     PTALLOCATE.MFG_QUAN,
     PTALLOCATE.SHIP_QUAN,
     ORD_DETAIL.UNIT_PRICE,
     ORD_DETAIL.QUAN_ORD,
     ORD_DETAIL.TOT_LINE,
     (ORD_DETAIL.UNIT_PRICE * PTALLOCATE.MFG_QUAN) AS our_calculation,
     (ORD_DETAIL.UNIT_PRICE * ORD_DETAIL.QUAN_ORD) AS ord_calculation
   FROM IQMS.WORKORDER
   LEFT JOIN IQMS.PTALLOCATE ON PTALLOCATE.WORKORDER_ID = WORKORDER.ID
   LEFT JOIN IQMS.PTORDER_REL ON PTORDER_REL.PTALLOCATE_ID = PTALLOCATE.ID
   LEFT JOIN IQMS.ORDERS ON ORDERS.ORDERNO = PTORDER_REL.ORDERNO
   LEFT JOIN IQMS.ORD_DETAIL ON ORD_DETAIL.ORDERS_ID = ORDERS.ID
   WHERE WORKORDER.PART_NO IN ('OINGO3I4N', '3498899834')
   ORDER BY our_calculation DESC;
   ```

2. **Fix ORD_DETAIL Join** 🔧
   - Add `AND ORD_DETAIL.ITEMNO = WORKORDER.PART_NO` to Line 111
   - Ensures correct line item matched
   - Prevents Cartesian join inflation

3. **Use Correct Quantity Field** 🔧
   - Verify if `PTALLOCATE.MFG_QUAN` is correct quantity
   - Consider using `ORD_DETAIL.QUAN_ORD` instead (actual order qty)
   - Or use `WORKORDER.CYCLES_REQ` (work order quantity)

4. **Fix Completed Jobs Detection** 🔧
   - Don't infer status from due date
   - Use actual status field: `WORKORDER.STATUS = 'C'` or similar
   - Check IQMS schema for completion field

5. **Add Data Quality Checks** 📊
   - Flag orders where `total_order_value > $10M` for review
   - Calculate median order value (not average) for better insight
   - Show distribution: 25th percentile, median, 75th percentile, 95th percentile

6. **Consider Using TOT_LINE** 🔄
   - `ORD_DETAIL.TOT_LINE` is pre-calculated line total
   - Eliminates multiplication errors
   - Compare `TOT_LINE` vs our calculation to validate

### Medium-Term Improvements

1. **Add Percentile Metrics**
   - Show median order value (more representative than average)
   - 95th percentile to identify outliers
   - Distribution histogram in UI

2. **Customer Risk Breakdown**
   - Show revenue at risk by customer
   - Identify concentration risk (88% in one customer!)
   - Alert when single customer > 50% of revenue

3. **Historical Baseline**
   - Track financial metrics over time
   - Compare current WIP to 30-day average
   - Alert on unusual spikes

4. **Confidence Indicators**
   - Show "351/418 jobs have pricing (84%)" prominently
   - Flag metrics with low coverage
   - Warn when outliers dominate (3 orders = 88% of total)

## Validation Checklist

Before trusting the financial summary:

- [ ] Verify SYGMANET order quantities in IQMS (are they really 640k units?)
- [ ] Check if UNIT_PRICE field is populated correctly in ORD_DETAIL
- [ ] Confirm ORD_DETAIL join includes `ITEMNO` match
- [ ] Validate that MFG_QUAN is the right quantity field to use
- [ ] Fix completed job detection (check actual status, not due date)
- [ ] Compare calculated `total_order_value` vs `ORD_DETAIL.TOT_LINE`
- [ ] Add outlier filtering (jobs > $10M get manual review)
- [ ] Show median alongside average to reveal skew
- [ ] Add customer concentration risk metric (% from top customer)

## Current Status: ⚠️ DATA NEEDS VALIDATION

**Recommendation:** Do not use current financial summary for executive reporting until SYGMANET orders are validated. The $178M total could be:
- ✅ Accurate (if those are real 640k-unit orders)
- ❌ Inflated 10x-100x (if quantity or price field is wrong)

**Next Step:** Run the SYGMANET verification query above to see actual IQMS values.
