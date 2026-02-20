-- IQMS Preventive Maintenance Schema Exploration
-- Tables: PMEQMT, PMJOB, PMTASK, PMWO, PMWO_DTL, PMWO_TYPE

-- =============================================================================
-- STEP 1: Describe each table structure
-- =============================================================================

-- Equipment Master
SELECT column_name, data_type, nullable
FROM all_tab_columns
WHERE owner = 'IQMS' AND table_name = 'PMEQMT'
ORDER BY column_id;

-- PM Jobs
SELECT column_name, data_type, nullable
FROM all_tab_columns
WHERE owner = 'IQMS' AND table_name = 'PMJOB'
ORDER BY column_id;

-- PM Tasks
SELECT column_name, data_type, nullable
FROM all_tab_columns
WHERE owner = 'IQMS' AND table_name = 'PMTASK'
ORDER BY column_id;

-- PM Work Orders
SELECT column_name, data_type, nullable
FROM all_tab_columns
WHERE owner = 'IQMS' AND table_name = 'PMWO'
ORDER BY column_id;

-- PM Work Order Details
SELECT column_name, data_type, nullable
FROM all_tab_columns
WHERE owner = 'IQMS' AND table_name = 'PMWO_DTL'
ORDER BY column_id;

-- PM Work Order Types
SELECT column_name, data_type, nullable
FROM all_tab_columns
WHERE owner = 'IQMS' AND table_name = 'PMWO_TYPE'
ORDER BY column_id;

-- =============================================================================
-- STEP 2: Check for related views
-- =============================================================================

SELECT view_name, text
FROM all_views
WHERE owner = 'IQMS' 
  AND (view_name LIKE 'V_PM%' OR view_name LIKE 'V_%MAINT%')
ORDER BY view_name;

-- =============================================================================
-- STEP 3: Sample data to understand relationships
-- =============================================================================

-- Sample from PMEQMT (Equipment)
SELECT * FROM IQMS.PMEQMT WHERE ROWNUM <= 5;

-- Sample from PMJOB (Jobs)
SELECT * FROM IQMS.PMJOB WHERE ROWNUM <= 5;

-- Sample from PMTASK (Tasks)
SELECT * FROM IQMS.PMTASK WHERE ROWNUM <= 5;

-- Sample from PMWO (Work Orders)
SELECT * FROM IQMS.PMWO WHERE ROWNUM <= 10 ORDER BY rownum DESC;

-- Sample from PMWO_DTL (Work Order Details)
SELECT * FROM IQMS.PMWO_DTL WHERE ROWNUM <= 10;

-- =============================================================================
-- STEP 4: Find the join key to work centers
-- =============================================================================

-- Check if PMEQMT has work center reference
SELECT DISTINCT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM all_tab_columns WHERE owner='IQMS' AND table_name='PMEQMT' AND column_name='EQNO') THEN 'Has EQNO'
    WHEN EXISTS (SELECT 1 FROM all_tab_columns WHERE owner='IQMS' AND table_name='PMEQMT' AND column_name='WORK_CENTER') THEN 'Has WORK_CENTER'
    WHEN EXISTS (SELECT 1 FROM all_tab_columns WHERE owner='IQMS' AND table_name='PMEQMT' AND column_name='RESOURCE_ID') THEN 'Has RESOURCE_ID'
    ELSE 'Unknown join key'
  END AS join_key_type
FROM dual;

-- =============================================================================
-- STEP 5: Find most recent PM work order per equipment
-- =============================================================================

-- Last completed PM per equipment
SELECT 
  eq.*, 
  wo.WO_NO,
  wo.WO_DATE,
  wo.COMPLETED_DATE,
  wo.STATUS,
  wo.WO_TYPE
FROM IQMS.PMEQMT eq
LEFT JOIN IQMS.PMWO wo ON eq.EQMT_ID = wo.EQMT_ID
WHERE wo.COMPLETED_DATE IS NOT NULL
  AND ROWNUM <= 20
ORDER BY wo.COMPLETED_DATE DESC;

-- =============================================================================
-- STEP 6: Find upcoming scheduled PM
-- =============================================================================

-- Next scheduled PM per equipment
SELECT 
  eq.*,
  job.JOB_ID,
  job.NEXT_DUE_DATE,
  job.FREQUENCY,
  job.FREQUENCY_TYPE,
  job.STATUS
FROM IQMS.PMEQMT eq
LEFT JOIN IQMS.PMJOB job ON eq.EQMT_ID = job.EQMT_ID
WHERE job.STATUS = 'ACTIVE'
  AND ROWNUM <= 20
ORDER BY job.NEXT_DUE_DATE;

-- =============================================================================
-- STEP 7: Prototype query for Plant Pulse integration
-- =============================================================================

-- Join maintenance data with work centers from V_RT_PART_NUMBERS
SELECT 
  rt.EQNO AS work_center,
  rt.CNTR_DESC AS work_center_desc,
  eq.EQMT_ID AS equipment_id,
  eq.EQMT_NO AS equipment_number,
  eq.DESCRIPTION AS equipment_description,
  
  -- Last PM info
  last_pm.WO_NO AS last_pm_wo,
  last_pm.COMPLETED_DATE AS last_pm_date,
  TRUNC(SYSDATE - last_pm.COMPLETED_DATE) AS days_since_last_pm,
  
  -- Next scheduled PM
  next_pm.NEXT_DUE_DATE AS next_pm_due_date,
  TRUNC(next_pm.NEXT_DUE_DATE - SYSDATE) AS days_until_next_pm,
  next_pm.FREQUENCY AS pm_frequency,
  next_pm.FREQUENCY_TYPE AS pm_frequency_type,
  
  -- Status indicators
  CASE
    WHEN next_pm.NEXT_DUE_DATE < SYSDATE THEN 'OVERDUE'
    WHEN next_pm.NEXT_DUE_DATE <= SYSDATE + 7 THEN 'DUE_SOON'
    ELSE 'OK'
  END AS pm_status

FROM IQMS.V_RT_PART_NUMBERS rt

-- Join to equipment (need to determine correct join key)
LEFT JOIN IQMS.PMEQMT eq ON rt.EQNO = eq.???? -- TODO: Find correct join field

-- Get last completed PM
LEFT JOIN (
  SELECT 
    EQMT_ID,
    WO_NO,
    COMPLETED_DATE,
    ROW_NUMBER() OVER (PARTITION BY EQMT_ID ORDER BY COMPLETED_DATE DESC) AS rn
  FROM IQMS.PMWO
  WHERE COMPLETED_DATE IS NOT NULL
) last_pm ON eq.EQMT_ID = last_pm.EQMT_ID AND last_pm.rn = 1

-- Get next scheduled PM
LEFT JOIN (
  SELECT
    EQMT_ID,
    NEXT_DUE_DATE,
    FREQUENCY,
    FREQUENCY_TYPE,
    ROW_NUMBER() OVER (PARTITION BY EQMT_ID ORDER BY NEXT_DUE_DATE) AS rn
  FROM IQMS.PMJOB
  WHERE STATUS = 'ACTIVE'
) next_pm ON eq.EQMT_ID = next_pm.EQMT_ID AND next_pm.rn = 1

WHERE rt.PK_HIDE IS NULL
  AND (rt.IS_VIRTUAL IS NULL OR rt.IS_VIRTUAL IN (' ', 'N'))
ORDER BY rt.EQNO;

-- =============================================================================
-- STEP 8: Count coverage
-- =============================================================================

-- How many work centers have PM equipment records?
SELECT 
  COUNT(DISTINCT rt.EQNO) AS total_work_centers,
  COUNT(DISTINCT eq.EQMT_ID) AS work_centers_with_pm,
  ROUND(COUNT(DISTINCT eq.EQMT_ID) * 100.0 / NULLIF(COUNT(DISTINCT rt.EQNO), 0), 1) AS coverage_pct
FROM IQMS.V_RT_PART_NUMBERS rt
LEFT JOIN IQMS.PMEQMT eq ON rt.EQNO = eq.???? -- TODO: Find correct join
WHERE rt.PK_HIDE IS NULL;
