-- OPTIMIZED: Detailed material requirements for a specific work order
-- Shows all materials, their requirements, and shortage status
-- Performance improvements: Replaced subqueries with JOINs, consolidated division lookup
SELECT 
       a.class,
       a.itemno,
       a.rev,
       a.descrip,
       a.descrip2,
       a.eplant_id,
       h.prod_date,
       u.arinvt_id,
       h.division_id,
       u.tot_mat_qty as qty,
       -- Optimized: Use pre-joined division data instead of subquery
       CASE NVL(params.capacity_consolidate_div_req, 'N')
         WHEN 'Y' THEN a.onhand
         ELSE NVL(div.onhand, a.onhand)
       END as onhand,
       -- Shortage calculation using pre-computed onhand
       (u.tot_mat_qty - 
         CASE NVL(params.capacity_consolidate_div_req, 'N')
           WHEN 'Y' THEN a.onhand
           ELSE NVL(div.onhand, a.onhand)
         END
       ) as shortage_qty,
       std.eplant_id as standard_eplant_id
FROM                     
       iqms.day_hrs h
       INNER JOIN iqms.day_pts p ON h.id = p.day_hrs_id
       INNER JOIN iqms.day_use u ON p.id = u.day_pts_id
       INNER JOIN iqms.arinvt a ON u.arinvt_id = a.id
       CROSS JOIN iqms.params params
       -- Optimized: JOIN instead of EXISTS subquery
       INNER JOIN iqms.xcpt_mat_req x 
         ON u.arinvt_id = x.arinvt_id
         AND h.prod_date >= x.must_arrive
         AND DECODE(params.capacity_consolidate_div_req, 'Y', -1, NVL(h.division_id,0)) = NVL(x.division_id,0)
       -- Optimized: Pre-join division data instead of correlated subquery
       LEFT JOIN iqms.v_arinvt_division div 
         ON div.arinvt_id = u.arinvt_id 
         AND NVL(h.division_id,0) = NVL(div.division_id,0)
       -- Optimized: JOIN for standard instead of subquery
       LEFT JOIN iqms.standard std ON h.standard_id = std.id
WHERE
       h.workorder_id = :workorder_id
ORDER BY
       a.class,
       a.itemno,
       a.rev,
       a.eplant_id,
       h.prod_date
