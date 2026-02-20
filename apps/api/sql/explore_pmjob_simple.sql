-- Simple PMJOB Exploration - Focus on what we need for Plant Pulse
-- Goal: Add PM schedule data to realtime work centers with minimal complexity

-- =============================================================================
-- STEP 1: Understand PMJOB structure
-- =============================================================================

-- Get all column names and types
SELECT column_name, data_type, nullable, data_length
FROM all_tab_columns
WHERE owner = 'IQMS' AND table_name = 'PMJOB'
ORDER BY column_id;

-- =============================================================================
-- STEP 2: See sample data
-- =============================================================================

-- Look at 10 sample PM jobs
SELECT * 
FROM IQMS.PMJOB 
WHERE ROWNUM <= 10;

-- =============================================================================
-- STEP 3: Check for work center link
-- =============================================================================

-- Does PMJOB have direct work center reference?
SELECT COUNT(*) as has_eqno
FROM all_tab_columns 
WHERE owner = 'IQMS' 
  AND table_name = 'PMJOB' 
  AND column_name = 'EQNO';

SELECT COUNT(*) as has_work_center
FROM all_tab_columns 
WHERE owner = 'IQMS' 
  AND table_name = 'PMJOB' 
  AND column_name LIKE '%WORK%CENTER%';

SELECT COUNT(*) as has_resource
FROM all_tab_columns 
WHERE owner = 'IQMS' 
  AND table_name = 'PMJOB' 
  AND column_name LIKE '%RESOURCE%';

-- Show all column names to find the link
SELECT column_name
FROM all_tab_columns
WHERE owner = 'IQMS' AND table_name = 'PMJOB'
ORDER BY column_name;

-- =============================================================================
-- STEP 4: Check for key fields we need
-- =============================================================================

-- Do we have due date fields?
SELECT column_name, data_type
FROM all_tab_columns
WHERE owner = 'IQMS' 
  AND table_name = 'PMJOB'
  AND (column_name LIKE '%DUE%' 
    OR column_name LIKE '%DATE%'
    OR column_name LIKE '%NEXT%'
    OR column_name LIKE '%LAST%'
    OR column_name LIKE '%FREQ%'
    OR column_name LIKE '%SCHEDULE%'
    OR column_name LIKE '%INTERVAL%')
ORDER BY column_name;

-- =============================================================================
-- STEP 5: Understand active vs inactive jobs
-- =============================================================================

-- What statuses exist?
SELECT 
  STATUS,
  COUNT(*) as job_count
FROM IQMS.PMJOB
GROUP BY STATUS
ORDER BY job_count DESC;

-- =============================================================================
-- STEP 6: Find PM jobs with due dates
-- =============================================================================

-- Jobs with upcoming due dates (next 30 days)
SELECT *
FROM IQMS.PMJOB
WHERE NEXT_DUE_DATE IS NOT NULL
  AND NEXT_DUE_DATE BETWEEN SYSDATE AND SYSDATE + 30
  AND ROWNUM <= 20
ORDER BY NEXT_DUE_DATE;

-- Jobs that are overdue
SELECT *
FROM IQMS.PMJOB
WHERE NEXT_DUE_DATE IS NOT NULL
  AND NEXT_DUE_DATE < SYSDATE
  AND ROWNUM <= 20
ORDER BY NEXT_DUE_DATE;

-- =============================================================================
-- STEP 7: Prototype join to realtime work centers
-- =============================================================================

-- Try joining PMJOB directly to V_RT_PART_NUMBERS
-- (This query will fail until we know the correct join key)

/*
SELECT 
  rt.EQNO AS work_center,
  rt.CNTR_DESC AS work_center_desc,
  pm.JOB_ID,
  pm.DESCRIPTION,
  pm.NEXT_DUE_DATE,
  TRUNC(pm.NEXT_DUE_DATE - SYSDATE) AS days_until_pm,
  pm.FREQUENCY,
  pm.FREQUENCY_TYPE,
  pm.LAST_COMPLETED,
  pm.STATUS
FROM IQMS.V_RT_PART_NUMBERS rt
LEFT JOIN IQMS.PMJOB pm ON rt.EQNO = pm.????  -- TODO: Find correct join
WHERE rt.PK_HIDE IS NULL
  AND (rt.IS_VIRTUAL IS NULL OR rt.IS_VIRTUAL IN (' ', 'N'))
  AND ROWNUM <= 20;
*/

-- =============================================================================
-- STEP 8: Coverage analysis
-- =============================================================================

-- How many unique work centers/equipment in PMJOB?
SELECT COUNT(DISTINCT ?????) AS equipment_count
FROM IQMS.PMJOB;
-- Note: Replace ????? with the actual work center/equipment field name

-- Active PM jobs count
SELECT COUNT(*) AS active_pm_jobs
FROM IQMS.PMJOB
WHERE STATUS = 'ACTIVE' OR STATUS = 'A';  -- Try both formats

-- =============================================================================
-- STEP 9: Simple aggregation - next PM per work center
-- =============================================================================

-- Get earliest next PM due date per work center/equipment
-- (Adjust query after understanding column names)

/*
SELECT 
  ?????,  -- work center or equipment ID
  MIN(NEXT_DUE_DATE) AS next_pm_due,
  TRUNC(MIN(NEXT_DUE_DATE) - SYSDATE) AS days_until_pm,
  COUNT(*) AS pm_job_count
FROM IQMS.PMJOB
WHERE STATUS IN ('ACTIVE', 'A')
  AND NEXT_DUE_DATE IS NOT NULL
GROUP BY ?????
HAVING MIN(NEXT_DUE_DATE) <= SYSDATE + 30
ORDER BY next_pm_due;
*/
