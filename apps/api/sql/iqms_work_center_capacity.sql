-- Work Center Capacity Analysis
-- Shows current load, available capacity, and queue depth per work center
SELECT
  WC.EQNO AS work_center_id,
  WC.CNTR_DESC AS work_center_name,
  WC.SHIFTS AS shifts_per_day,
  WC.HRS_DAY AS hours_per_day,
  WC.MFG_DAYS_WEEK AS days_per_week,
  WC.CAPACITY AS rated_capacity,
  
  -- Calculate available capacity (hours per week)
  (WC.SHIFTS * WC.HRS_DAY * WC.MFG_DAYS_WEEK) AS available_hours_per_week,
  
  -- Current load (sum of hours to go for all jobs at this work center)
  COALESCE(LOAD.total_hours_to_go, 0) AS current_load_hours,
  
  -- Queue depth (number of jobs waiting)
  COALESCE(LOAD.job_count, 0) AS queue_depth,
  
  -- Utilization (load / available capacity)
  CASE 
    WHEN (WC.SHIFTS * WC.HRS_DAY * WC.MFG_DAYS_WEEK) > 0 THEN
      ROUND((COALESCE(LOAD.total_hours_to_go, 0) / (WC.SHIFTS * WC.HRS_DAY * WC.MFG_DAYS_WEEK)) * 100, 1)
    ELSE 0
  END AS utilization_percent

FROM IQMS.WORK_CENTER WC

LEFT JOIN (
  SELECT 
    V_SCHED.WORK_CENTER_ID,
    SUM(V_SCHED.HOURS_TO_GO) AS total_hours_to_go,
    COUNT(DISTINCT V_SCHED.WORKORDER_ID) AS job_count
  FROM IQMS.V_SCHED_HRS_TO_GO V_SCHED
  WHERE V_SCHED.HOURS_TO_GO > 0
  GROUP BY V_SCHED.WORK_CENTER_ID
) LOAD ON WC.ID = LOAD.WORK_CENTER_ID

WHERE 
  -- Exclude virtual work centers
  (WC.IS_VIRTUAL IS NULL OR WC.IS_VIRTUAL IN (' ', 'N'))
  -- Only include work centers with active jobs or standard capacity
  AND (LOAD.job_count > 0 OR WC.SHIFTS > 0)
  
ORDER BY 
  utilization_percent DESC NULLS LAST,
  current_load_hours DESC
