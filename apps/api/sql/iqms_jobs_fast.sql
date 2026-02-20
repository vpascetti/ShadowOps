-- ShadowOps: FAST job data query (simplified version)
-- This version skips expensive material shortage calculations for better performance
-- Use this when you need quick dashboard loads

WITH job_data AS (
  SELECT /*+ MATERIALIZE */
    -- Job Identity
    V_SCHED_HRS_TO_GO.WORKORDER_ID AS job_id,
    ARINVT.ITEMNO AS part,
    ARINVT.DESCRIP AS description,
    ARCUSTO.CUSTNO AS customer,
    
    -- Timing & Dates (Late Delivery Risk)
    COALESCE(PTALLOCATE.PROMISE_DATE, PTALLOCATE.MUST_SHIP_DATE) AS due_date,
    PTALLOCATE.MUST_SHIP_DATE AS must_ship_date,
    V_SCHED_HRS_TO_GO.PROD_START_TIME AS prod_start_time,
    V_SCHED_HRS_TO_GO.PROD_END_TIME AS prod_end_time,
    
    -- Aggregate hours across all operations for this job
    WO_TOTALS.total_hours_to_go AS remaining_work,
    WO_TOTALS.total_prod_hours AS prod_hours,
    WO_TOTALS.operation_count AS operation_count,
    
    -- Status & Priority
    CASE 
      WHEN WORKORDER.FIRM = 'Y' THEN 'firm'
      ELSE 'planned'
    END AS status,
    WORKORDER.FIRM AS firm,
    WORKORDER.PRIORITY AS priority,
    WORKORDER.PRIORITY_LEVEL AS priority_level,
    WORKORDER.PRIORITY_NOTE AS priority_note,
    
    -- Quantities
    PARTS_AGG.total_parts_to_go AS parts_to_go,
   PTALLOCATE.SHIP_QUAN AS ship_quantity,
    PTALLOCATE.MFG_QUAN AS mfg_quantity,
    
    -- Pricing from order detail
    ORD_DETAIL.UNIT_PRICE AS unit_price,
    (ORD_DETAIL.UNIT_PRICE * PTALLOCATE.MFG_QUAN) AS total_order_value,
    
    -- Material Availability (FAST - only flag, no details)
    WORKORDER.IS_XCPT_MAT AS material_exception,
    WORKORDER.IS_HARD_ALLOCATED AS hard_allocated,
    PTALLOCATE.FG_ALLOCATE AS fg_allocate,
    PTALLOCATE.PO_ALLOCATE AS po_allocate,
    PTALLOCATE.SCHED_ALLOCATE AS sched_allocate,
    
    -- Resource & Capacity - Current Operation
    WORK_CENTER.EQNO AS work_center,
    V_SCHED_HRS_TO_GO.CNTR_SEQ AS operation_seq,
    WC_CAPACITY.total_load AS work_center_load,
    WC_CAPACITY.queue_depth AS work_center_queue_depth,
    
    -- Row number to get only first record per job
    ROW_NUMBER() OVER (PARTITION BY V_SCHED_HRS_TO_GO.WORKORDER_ID ORDER BY PTALLOCATE.PROMISE_DATE ASC NULLS LAST, PTALLOCATE.ID) AS rn
    
  FROM IQMS.V_SCHED_HRS_TO_GO V_SCHED_HRS_TO_GO
  
  INNER JOIN IQMS.WORKORDER WORKORDER
    ON V_SCHED_HRS_TO_GO.WORKORDER_ID = WORKORDER.ID
  
  -- Get totals for this workorder (sum across all operations)
  INNER JOIN (
    SELECT 
      V.WORKORDER_ID,
      SUM(V.HOURS_TO_GO) AS total_hours_to_go,
      SUM(V.PRODHRS) AS total_prod_hours,
      COUNT(*) AS operation_count,
      MIN(V.CNTR_SEQ) AS first_operation_seq
    FROM IQMS.V_SCHED_HRS_TO_GO V
    WHERE V.HOURS_TO_GO > 0
    GROUP BY V.WORKORDER_ID
  ) WO_TOTALS ON WORKORDER.ID = WO_TOTALS.WORKORDER_ID
  
  -- Get parts to go aggregated
  LEFT OUTER JOIN (
    SELECT 
      P.CNTR_SCHED_ID,
      SUM(P.PARTS_TO_GO) AS total_parts_to_go
    FROM IQMS.V_SCHED_PARTS_TO_GO P
    GROUP BY P.CNTR_SCHED_ID
  ) PARTS_AGG ON V_SCHED_HRS_TO_GO.ID = PARTS_AGG.CNTR_SCHED_ID
  
  LEFT OUTER JOIN IQMS.WORK_CENTER WORK_CENTER
    ON V_SCHED_HRS_TO_GO.WORK_CENTER_ID = WORK_CENTER.ID
  
  LEFT OUTER JOIN IQMS.PTORDER PTORDER
    ON V_SCHED_HRS_TO_GO.WORKORDER_ID = PTORDER.WORKORDER_ID
    
  LEFT OUTER JOIN IQMS.PARTNO PARTNO
    ON PTORDER.PARTNO_ID = PARTNO.ID
    
  LEFT OUTER JOIN IQMS.ARINVT ARINVT
    ON PARTNO.ARINVT_ID = ARINVT.ID
    
  LEFT OUTER JOIN IQMS.PTORDER_REL PTORDER_REL
    ON PTORDER.ID = PTORDER_REL.PTORDER_ID
    
  LEFT OUTER JOIN IQMS.PTALLOCATE PTALLOCATE
    ON PTORDER_REL.PTALLOCATE_ID = PTALLOCATE.ID
  
  LEFT OUTER JOIN IQMS.ARCUSTO ARCUSTO
    ON WORKORDER.ARCUSTO_ID = ARCUSTO.ID
  
  -- Pricing from ORD_DETAIL (via ORDERS)
  LEFT OUTER JOIN IQMS.ORDERS ORDERS
    ON ORDERS.ORDERNO = PTORDER_REL.ORDERNO
  LEFT OUTER JOIN IQMS.ORD_DETAIL ORD_DETAIL
    ON ORD_DETAIL.ORDERS_ID = ORDERS.ID
  
  -- Work Center Capacity Data (aggregated)
  LEFT OUTER JOIN (
    SELECT 
      WORK_CENTER_ID,
      SUM(V.HOURS_TO_GO) AS total_load,
      COUNT(DISTINCT V.WORKORDER_ID) AS queue_depth
    FROM IQMS.V_SCHED_HRS_TO_GO V
    WHERE V.HOURS_TO_GO > 0
    GROUP BY WORK_CENTER_ID
  ) WC_CAPACITY ON V_SCHED_HRS_TO_GO.WORK_CENTER_ID = WC_CAPACITY.WORK_CENTER_ID
  
  WHERE 
    -- Exclude virtual work centers
    (WORK_CENTER.IS_VIRTUAL IS NULL OR WORK_CENTER.IS_VIRTUAL IN (' ', 'N'))
    -- Only show the FIRST/CURRENT operation for each job (to avoid duplicates)
    AND V_SCHED_HRS_TO_GO.CNTR_SEQ = WO_TOTALS.first_operation_seq
    -- Only include jobs that are scheduled on a work center
    AND WORK_CENTER.EQNO IS NOT NULL
),
ranked_jobs AS (
  SELECT 
    job_id, part, description, customer,
    due_date, must_ship_date,
    prod_start_time, prod_end_time,
    remaining_work, prod_hours, operation_count,
    status, firm, priority, priority_level, priority_note,
    parts_to_go, ship_quantity, mfg_quantity,
    unit_price, total_order_value,
    material_exception, hard_allocated, fg_allocate, po_allocate, sched_allocate,
    work_center, operation_seq, work_center_load, work_center_queue_depth,
    ROW_NUMBER() OVER (
      PARTITION BY work_center 
      ORDER BY due_date ASC NULLS LAST, priority_level DESC NULLS LAST, remaining_work DESC
    ) AS wc_rank
  FROM job_data
  WHERE rn = 1
)
SELECT 
  job_id, part, description, customer,
  due_date, must_ship_date,
  prod_start_time, prod_end_time,
  remaining_work, prod_hours, operation_count,
  status, firm, priority, priority_level, priority_note,
  parts_to_go, ship_quantity, mfg_quantity,
  unit_price, total_order_value,
  material_exception, hard_allocated, fg_allocate, po_allocate, sched_allocate,
  work_center, operation_seq, work_center_load, work_center_queue_depth
FROM ranked_jobs
WHERE wc_rank <= 5  -- Limit to first 5 jobs per work center
  AND ROWNUM <= 2000  -- Overall limit for faster response
ORDER BY 
  work_center,
  wc_rank
