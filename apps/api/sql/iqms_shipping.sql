-- IQMS Shipping Data Query
-- Retrieves shipped orders with delivery dates and on-time performance
-- Used for calculating true on-time delivery metrics (vs just on-time completion)

SELECT
  w.ID AS workorder_id,
  w.JOB AS job_id,
  w.ITEM_NO AS item_number,
  w.DESCRIP AS description,
  w.CUST_NO AS customer_id,
  w.CUST_NAME AS customer_name,
  w.CYCLES_REQ AS qty_ordered,
  sh.QTY_SHIPPED AS qty_shipped,
  sh.SHIP_DATE AS actual_ship_date,
  COALESCE(w.MUST_SHIP_DATE, w.PROMISE_DATE, w.END_TIME) AS promised_date,
  w.END_TIME AS work_order_closed_date,
  sh.TRACKING_NUMBER AS tracking_number,
  sh.CARRIER AS shipping_carrier,
  sh.DELIVERY_DATE AS actual_delivery_date,
  sh.DELIVERY_SIGNATURE AS delivery_signature,
  CASE
    WHEN sh.DELIVERY_DATE IS NULL THEN 'In Transit'
    WHEN sh.DELIVERY_DATE <= COALESCE(w.MUST_SHIP_DATE, w.PROMISE_DATE, w.END_TIME) THEN 'On Time'
    ELSE 'Late'
  END AS delivery_status,
  CASE
    WHEN sh.DELIVERY_DATE IS NOT NULL THEN
      sh.DELIVERY_DATE - COALESCE(w.MUST_SHIP_DATE, w.PROMISE_DATE, w.END_TIME)
    ELSE NULL
  END AS days_late_or_early,
  sh.NOTES AS shipping_notes,
  w.PO_NUMBER AS po_number,
  sh.CREATED_TIMESTAMP AS shipping_record_date
FROM WORKORDER w
LEFT JOIN SHIPMENT sh ON sh.WORKORDER_ID = w.ID
WHERE w.STATUS != 'Void'
  AND sh.CREATED_TIMESTAMP IS NOT NULL  -- Only include shipped orders
  AND sh.CREATED_TIMESTAMP > TRUNC(SYSDATE) - 90  -- Last 90 days
ORDER BY sh.CREATED_TIMESTAMP DESC
