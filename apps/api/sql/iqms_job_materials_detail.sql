-- Detailed material requirements for a specific work order
-- Shows all materials, their requirements, and shortage status
select a.class,
       a.itemno,
       a.rev,
       a.descrip,
       a.descrip2,
       a.eplant_id,
       h.prod_date,
       u.arinvt_id,
       h.division_id,
       u.tot_mat_qty as qty,
       case nvl(params.capacity_consolidate_div_req, 'N')
         when 'Y' then
           a.onhand
         else
           (select onhand from v_arinvt_division where arinvt_id = u.arinvt_id and NVL(h.division_id,0) = NVL(division_id,0))
       end as onhand,
       (u.tot_mat_qty - 
         case nvl(params.capacity_consolidate_div_req, 'N')
           when 'Y' then a.onhand
           else (select onhand from v_arinvt_division where arinvt_id = u.arinvt_id and NVL(h.division_id,0) = NVL(division_id,0))
         end
       ) as shortage_qty,
       (select eplant_id from standard where id = h.standard_id) as standard_eplant_id
  from                     
       day_hrs h,
       day_pts p,
       day_use u,
       arinvt a,
       params
 where
       h.id = p.day_hrs_id
   and p.id = u.day_pts_id
   and exists (select 1
                 from xcpt_mat_req x
                where u.arinvt_id = x.arinvt_id
                  and h.prod_date >= x.must_arrive
                  and decode( params.capacity_consolidate_div_req, 'Y', -1, nvl(h.division_id,0)) = NVL(x.division_id,0))
   and h.workorder_id = :workorder_id
   and u.arinvt_id = a.id
order by
       a.class,
       a.itemno,
       a.rev,
       a.eplant_id,
       h.prod_date
