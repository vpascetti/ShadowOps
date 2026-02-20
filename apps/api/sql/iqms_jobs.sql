-- ShadowOps: Comprehensive job data for risk analysis
-- Focus: Late Deliveries, Material Shortages, Capacity Overload
-- Returns ONE ROW PER JOB (current/first operation only, primary allocation only)
WITH job_data AS (
  SELECT
    -- Job Identity
    V_SCHED_HRS_TO_GO.WORKORDER_ID AS job_id,
    ARINVT.ITEMNO AS part,
    ARINVT.DESCRIP AS description,
    ARCUSTO.CUSTNO AS customer,
    
    -- Timing & Dates (Late Delivery Risk)
    COALESCE(PTALLOCATE.PROMISE_DATE, PTALLOCATE.MUST_SHIP_DATE) AS due_date,
    PTALLOCATE.MUST_SHIP_DATE AS must_ship_date,
    PTALLOCATE.REQUEST_DATE AS request_date,
    V_SCHED_HRS_TO_GO.PROD_START_TIME AS prod_start_time,
    V_SCHED_HRS_TO_GO.PROD_END_TIME AS prod_end_time,
    WORKORDER.START_TIME AS wo_start_time,
    WORKORDER.END_TIME AS wo_end_time,
    
    -- Aggregate hours across all operations for this job
    WO_TOTALS.total_hours_to_go AS remaining_work,
    WO_TOTALS.total_prod_hours AS prod_hours,
    WO_TOTALS.operation_count AS operation_count,
    V_SCHED_HRS_TO_GO.HOURS_TO_GO AS hours_to_go_this_op,
    
    -- Status & Priority
    CASE 
      WHEN WORKORDER.FIRM = 'Y' THEN 'firm'
      ELSE 'planned'
    END AS status,
    WORKORDER.FIRM AS firm,
    WORKORDER.ORIGIN AS origin,
    WORKORDER.PRIORITY AS priority,
    WORKORDER.PRIORITY_LEVEL AS priority_level,
    WORKORDER.PRIORITY_NOTE AS priority_note,
    
    -- Quantities
    WORKORDER.CYCLES_REQ AS cycles_required,
    WORKORDER.CYCLES_PLANNED AS cycles_planned,
    PARTS_AGG.total_parts_to_go AS parts_to_go,
    PTALLOCATE.SHIP_QUAN AS ship_quantity,
    PTALLOCATE.MFG_QUAN AS mfg_quantity,
    
    -- Material Availability (Material Shortage Risk)
    WORKORDER.IS_XCPT_MAT AS material_exception,
    WORKORDER.IS_HARD_ALLOCATED AS hard_allocated,
    PTALLOCATE.FG_ALLOCATE AS fg_allocate,
    PTALLOCATE.PO_ALLOCATE AS po_allocate,
    PTALLOCATE.SCHED_ALLOCATE AS sched_allocate,
    MAT_SHORT.material_item AS material_item,
    MAT_SHORT.material_required_qty AS material_required_qty,
    MAT_SHORT.material_issued_qty AS material_issued_qty,
    MAT_SHORT.material_short_qty AS material_short_qty,
    
    -- Resource & Capacity (Capacity Overload Risk) - Current Operation
    WORK_CENTER.EQNO AS work_center,
    V_SCHED_HRS_TO_GO.CNTR_SEQ AS operation_seq,
    V_SCHED_HRS_TO_GO.SETUPHRS AS setup_hours,
    WC_CAPACITY.total_load AS work_center_load,
    WC_CAPACITY.queue_depth AS work_center_queue_depth,
    
    -- System fields
    V_SCHED_HRS_TO_GO.ID AS schedule_id,
    WORKORDER.EPLANT_ID AS plant_id,
    EPLANT.NAME AS eplant_company,
    
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

  LEFT OUTER JOIN IQMS.EPLANT EPLANT
    ON WORKORDER.EPLANT_ID = EPLANT.ID

  -- Material shortage: pick the largest short item per job
  LEFT OUTER JOIN (
    SELECT
      h.workorder_id AS workorder_id,
      a.itemno AS material_item,
      a.descrip AS material_descrip,
      SUM(u.tot_mat_qty) AS material_required_qty,
      CAST(NULL AS NUMBER) AS material_issued_qty,
      SUM(
        GREATEST(
          0,
          u.tot_mat_qty
          - CASE NVL(params.capacity_consolidate_div_req, 'N')
              WHEN 'Y' THEN a.onhand
              ELSE NVL(div.onhand, a.onhand)
            END
        )
      ) AS material_short_qty,
      ROW_NUMBER() OVER (
        PARTITION BY h.workorder_id
        ORDER BY SUM(
          GREATEST(
            0,
            u.tot_mat_qty
            - CASE NVL(params.capacity_consolidate_div_req, 'N')
                WHEN 'Y' THEN a.onhand
                ELSE NVL(div.onhand, a.onhand)
              END
          )
        ) DESC,
        a.itemno
      ) AS rn
    FROM iqms.day_hrs h
    INNER JOIN iqms.day_pts p ON h.id = p.day_hrs_id
    INNER JOIN iqms.day_use u ON p.id = u.day_pts_id
    INNER JOIN iqms.arinvt a ON u.arinvt_id = a.id
    CROSS JOIN iqms.params params
    INNER JOIN iqms.xcpt_mat_req x
      ON u.arinvt_id = x.arinvt_id
      AND h.prod_date >= x.must_arrive
      AND DECODE(params.capacity_consolidate_div_req, 'Y', -1, NVL(h.division_id, 0)) = NVL(x.division_id, 0)
    LEFT JOIN iqms.v_arinvt_division div
      ON div.arinvt_id = u.arinvt_id
      AND NVL(h.division_id, 0) = NVL(div.division_id, 0)
    WHERE COALESCE(u.tot_mat_qty, 0) > 0
    GROUP BY
      h.workorder_id,
      a.itemno,
      a.descrip,
      CASE NVL(params.capacity_consolidate_div_req, 'N')
        WHEN 'Y' THEN a.onhand
        ELSE NVL(div.onhand, a.onhand)
      END
  ) MAT_SHORT
    ON WORKORDER.ID = MAT_SHORT.workorder_id
    AND MAT_SHORT.rn = 1
  
  -- Work Center Capacity Data
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
)
SELECT 
  job_id, part, description, customer,
  due_date, must_ship_date, request_date,
  prod_start_time, prod_end_time, wo_start_time, wo_end_time,
  remaining_work, prod_hours, operation_count,
  status, firm, origin, priority, priority_level, priority_note,
  cycles_required, cycles_planned, parts_to_go, ship_quantity, mfg_quantity,
  material_exception, hard_allocated, fg_allocate, po_allocate, sched_allocate,
  material_item, material_required_qty, material_issued_qty, material_short_qty,
  work_center, operation_seq, setup_hours, work_center_load, work_center_queue_depth,
  schedule_id, plant_id
FROM job_data
WHERE rn = 1
  AND ROWNUM <= 5000  -- Limit to prevent performance issues on large datasets
  
ORDER BY 
  due_date ASC NULLS LAST,
  priority_level DESC NULLS LAST,
  remaining_work DESC


