-- Enhanced V_RT_PART_NUMBERS query with PMJOB maintenance schedule integration
-- Adds: next_pm_due_date, days_until_next_pm, pm_status from IQMS preventive maintenance

SELECT 
  -- All original V_RT_PART_NUMBERS columns (27 fields)
  V_RT_PART_NUMBERS.EQNO AS work_center,
  V_RT_PART_NUMBERS.CNTR_DESC AS work_center_desc,
  V_RT_PART_NUMBERS.PART AS part_number,
  V_RT_PART_NUMBERS.PART_PARTDESC AS part_desc,
  V_RT_PART_NUMBERS.JOB AS job_number,
  V_RT_PART_NUMBERS.SUFFIX AS job_suffix,
  V_RT_PART_NUMBERS.OPERNUM AS operation,
  V_RT_PART_NUMBERS.OPERDESC AS operation_desc,
  V_RT_PART_NUMBERS.SHIFT_DWN AS shift_dwn,
  V_RT_PART_NUMBERS.TOTAL_ACTUAL AS total_actual,
  V_RT_PART_NUMBERS.TOTAL_GOOD AS total_good,
  V_RT_PART_NUMBERS.TOTAL_SCRAP AS total_scrap,
  V_RT_PART_NUMBERS.QTY_REQD AS qty_required,
  V_RT_PART_NUMBERS.QTY_COMP AS qty_complete,
  V_RT_PART_NUMBERS.AVG_CYCLE AS avg_cycle,
  V_RT_PART_NUMBERS.STD_CYCLE AS std_cycle,
  V_RT_PART_NUMBERS.EST_CYCLE AS est_cycle,
  V_RT_PART_NUMBERS.MIN_CYCLE AS min_cycle,
  V_RT_PART_NUMBERS.MAX_CYCLE AS max_cycle,
  V_RT_PART_NUMBERS.EMPLOYEEINITIALS AS operator_initials,
  V_RT_PART_NUMBERS.HAS_QC_ISSUES AS has_qc_issues,
  V_RT_PART_NUMBERS.QC_ISSUE_COUNT AS qc_issue_count,
  V_RT_PART_NUMBERS.MATERIAL_EXCEPTION AS material_exception,
  V_RT_PART_NUMBERS.EXCEPTION_SEVERITY AS exception_severity,
  V_RT_PART_NUMBERS.LAST_TX AS last_transaction,
  V_RT_PART_NUMBERS.PK_HIDE AS pk_hide,
  V_RT_PART_NUMBERS.IS_VIRTUAL AS is_virtual,
  
  -- New PM fields from PMJOB (3 fields)
  next_pm.calculated_next_due AS next_pm_due_date,
  next_pm.days_until_pm AS days_until_next_pm,
  next_pm.pm_description AS pm_status

FROM IQMS.V_RT_PART_NUMBERS

-- Get the earliest upcoming PM for this work center
LEFT JOIN LATERAL (
  SELECT 
    -- Calculate next due date based on last completion + interval
    CASE 
      WHEN pmjob.UOM = 'DAYS' THEN pmjob.LAST_CLOSED_WO + pmjob.PERFORM_EVERY
      WHEN pmjob.UOM = 'HOURS' THEN pmjob.LAST_CLOSED_WO + (pmjob.PERFORM_EVERY / 24)
      WHEN pmjob.UOM = 'WEEKS' THEN pmjob.LAST_CLOSED_WO + (pmjob.PERFORM_EVERY * 7)
      WHEN pmjob.UOM = 'MONTHS' THEN ADD_MONTHS(pmjob.LAST_CLOSED_WO, pmjob.PERFORM_EVERY)
      ELSE pmjob.LAST_CLOSED_WO + pmjob.PERFORM_EVERY
    END AS calculated_next_due,
    
    -- Calculate days until PM (negative if overdue)
    TRUNC(
      CASE 
        WHEN pmjob.UOM = 'DAYS' THEN pmjob.LAST_CLOSED_WO + pmjob.PERFORM_EVERY
        WHEN pmjob.UOM = 'HOURS' THEN pmjob.LAST_CLOSED_WO + (pmjob.PERFORM_EVERY / 24)
        WHEN pmjob.UOM = 'WEEKS' THEN pmjob.LAST_CLOSED_WO + (pmjob.PERFORM_EVERY * 7)
        WHEN pmjob.UOM = 'MONTHS' THEN ADD_MONTHS(pmjob.LAST_CLOSED_WO, pmjob.PERFORM_EVERY)
        ELSE pmjob.LAST_CLOSED_WO + pmjob.PERFORM_EVERY
      END - SYSDATE
    ) AS days_until_pm,
    
    -- PM description with frequency info
    'Every ' || pmjob.PERFORM_EVERY || ' ' || pmjob.UOM || 
    CASE 
      WHEN pmjob.LAST_CLOSED_WO IS NOT NULL 
      THEN ' (Last: ' || TO_CHAR(pmjob.LAST_CLOSED_WO, 'MM/DD/YYYY') || ')'
      ELSE ' (Never completed)'
    END AS pm_description
    
  FROM IQMS.PMJOB pmjob
  JOIN IQMS.PMEQMT pmeqmt ON pmjob.PMEQMT_ID = pmeqmt.ID
  
  WHERE pmeqmt.EQNO = V_RT_PART_NUMBERS.EQNO
    AND (pmjob.ARCHIVED IS NULL OR pmjob.ARCHIVED = 'N')  -- Only active PM jobs
    AND pmjob.LAST_CLOSED_WO IS NOT NULL  -- Must have at least one completion
    AND pmjob.PERFORM_EVERY > 0  -- Must have valid interval
  
  -- Get the earliest (most urgent) PM
  ORDER BY 
    CASE 
      WHEN pmjob.UOM = 'DAYS' THEN pmjob.LAST_CLOSED_WO + pmjob.PERFORM_EVERY
      WHEN pmjob.UOM = 'HOURS' THEN pmjob.LAST_CLOSED_WO + (pmjob.PERFORM_EVERY / 24)
      WHEN pmjob.UOM = 'WEEKS' THEN pmjob.LAST_CLOSED_WO + (pmjob.PERFORM_EVERY * 7)
      WHEN pmjob.UOM = 'MONTHS' THEN ADD_MONTHS(pmjob.LAST_CLOSED_WO, pmjob.PERFORM_EVERY)
      ELSE pmjob.LAST_CLOSED_WO + pmjob.PERFORM_EVERY
    END ASC
  
  FETCH FIRST 1 ROW ONLY
) next_pm ON 1=1

WHERE V_RT_PART_NUMBERS.PK_HIDE IS NULL
  AND (V_RT_PART_NUMBERS.IS_VIRTUAL IS NULL OR V_RT_PART_NUMBERS.IS_VIRTUAL IN (' ', 'N'));
