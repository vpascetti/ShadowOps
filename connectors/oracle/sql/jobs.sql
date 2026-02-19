-- Canonical ShadowOps job extractor for Oracle 19c
-- Returns 1 row per WORKORDER_ID (latest by ROW_NUMBER)

SELECT * FROM (
  SELECT
    w.ID AS job_id,
    w.JOB AS job,
    w.WORK_CENTER AS work_center,
    w.START_TIME AS start_date,
    COALESCE(w.MUST_SHIP_DATE, w.PROMISE_DATE, w.END_TIME) AS due_date,
    w.CYCLES_REQ AS qty_released,
    GREATEST(0, LEAST(w.CYCLES_REQ, w.CYCLES_REQ - NVL(parts.parts_to_go, 0))) AS qty_completed,
    vsh.HOURS_TO_GO AS hours_to_go,
    parts.parts_to_go AS parts_to_go,
    vsh.PROD_START_TIME AS prod_start_time,
    vsh.PROD_END_TIME AS prod_end_time,
    w.EPLANT_ID AS eplant_id,
    e.NAME AS eplant_company,
    w.ORIGIN AS origin,
    w.FIRM AS firm,
    w.PART_ID AS part,
    p.DESCRIP AS part_descrip,
    ROW_NUMBER() OVER (PARTITION BY w.ID ORDER BY w.END_TIME DESC NULLS LAST) AS rn
  FROM
    WORKORDER w
    LEFT JOIN V_SCHED_HRS_TO_GO vsh ON vsh.WORKORDER_ID = w.ID
    LEFT JOIN V_SCHED_PARTS_TO_GO parts ON parts.WORKORDER_ID = w.ID
    LEFT JOIN EPLANT e ON e.ID = w.EPLANT_ID
    LEFT JOIN PART p ON p.ID = w.PART_ID
) WHERE rn = 1
