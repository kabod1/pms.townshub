-- ═══════════════════════════════════════════════════════════════════════════
-- TOWNSHUB PMS — ANALYTICAL QUERIES FOR REPORTS & EXECUTIVE BI DASHBOARD
-- These queries document the analytics logic used in the React frontend.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── HOTEL REPORTS ───────────────────────────────────────────────────────────

-- 1. Occupancy Rate (current snapshot)
SELECT
  COUNT(*) FILTER (WHERE status = 'occupied') AS occupied_rooms,
  COUNT(*) AS total_rooms,
  ROUND(
    COUNT(*) FILTER (WHERE status = 'occupied') * 100.0 / NULLIF(COUNT(*), 0),
    1
  ) AS occupancy_pct
FROM rooms
WHERE tenant_id = :tenant_id AND is_active = true;

-- 2. Revenue per Selected Period (with previous-period comparison)
SELECT
  SUM(total_amount)          AS revenue_this_period,
  COUNT(*)                   AS bookings_this_period,
  AVG(room_rate)             AS avg_daily_rate
FROM bookings
WHERE
  tenant_id   = :tenant_id
  AND status  IN ('confirmed', 'checked_in', 'checked_out')
  AND check_in_date BETWEEN :from_date AND :to_date;

-- 3. RevPAR (Revenue Per Available Room)
-- RevPAR = ADR × Occupancy %
-- ADR = SUM(room_rate) / COUNT(bookings)
-- Calculated in-app from queries 1 and 2.

-- 4. Average Length of Stay
SELECT
  AVG(
    EXTRACT(EPOCH FROM (check_out_date::timestamp - check_in_date::timestamp)) / 86400
  ) AS avg_nights
FROM bookings
WHERE
  tenant_id   = :tenant_id
  AND status  IN ('confirmed', 'checked_in', 'checked_out')
  AND check_in_date BETWEEN :from_date AND :to_date;

-- 5. Daily Revenue Trend (for selected date range)
SELECT
  check_in_date                 AS date,
  SUM(total_amount)             AS revenue,
  COUNT(*)                      AS bookings
FROM bookings
WHERE
  tenant_id   = :tenant_id
  AND status  IN ('confirmed', 'checked_in', 'checked_out')
  AND check_in_date BETWEEN :from_date AND :to_date
GROUP BY check_in_date
ORDER BY check_in_date;

-- 6. Monthly Revenue Trend (last 12 months)
SELECT
  DATE_TRUNC('month', check_in_date::date) AS month,
  TO_CHAR(check_in_date::date, 'Mon YY')   AS month_label,
  SUM(total_amount)                         AS revenue,
  COUNT(*)                                  AS bookings
FROM bookings
WHERE
  tenant_id   = :tenant_id
  AND status  IN ('confirmed', 'checked_in', 'checked_out')
  AND check_in_date >= DATE_TRUNC('month', NOW() - INTERVAL '11 months')
GROUP BY 1, 2
ORDER BY 1;

-- 7. Booking Source Breakdown
SELECT
  source,
  COUNT(*) AS bookings,
  SUM(total_amount) AS revenue,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 1) AS pct
FROM bookings
WHERE
  tenant_id   = :tenant_id
  AND status  IN ('confirmed', 'checked_in', 'checked_out')
  AND check_in_date BETWEEN :from_date AND :to_date
GROUP BY source
ORDER BY bookings DESC;

-- 8. Top Room Types by Revenue
SELECT
  rt.name                AS room_type,
  COUNT(b.id)            AS bookings,
  SUM(b.total_amount)    AS revenue,
  AVG(b.room_rate)       AS avg_rate
FROM bookings b
JOIN room_types rt ON rt.id = b.room_type_id
WHERE
  b.tenant_id  = :tenant_id
  AND b.status IN ('confirmed', 'checked_in', 'checked_out')
  AND b.check_in_date BETWEEN :from_date AND :to_date
GROUP BY rt.name
ORDER BY revenue DESC
LIMIT 5;

-- 9. Monthly Occupancy Trend (last 6 months, based on unique rooms occupied per month)
SELECT
  DATE_TRUNC('month', check_in_date::date) AS month,
  TO_CHAR(check_in_date::date, 'Mon YY')   AS month_label,
  COUNT(DISTINCT room_id)                   AS occupied_rooms,
  (SELECT COUNT(*) FROM rooms WHERE tenant_id = :tenant_id AND is_active = true) AS total_rooms,
  ROUND(
    COUNT(DISTINCT room_id) * 100.0 /
      NULLIF((SELECT COUNT(*) FROM rooms WHERE tenant_id = :tenant_id AND is_active = true), 0),
    1
  ) AS occupancy_pct
FROM bookings
WHERE
  tenant_id   = :tenant_id
  AND status  IN ('confirmed', 'checked_in', 'checked_out')
  AND check_in_date >= DATE_TRUNC('month', NOW() - INTERVAL '5 months')
GROUP BY 1, 2
ORDER BY 1;

-- 10. Top 5 Guests by Total Spend
SELECT
  id,
  first_name || ' ' || last_name AS full_name,
  email,
  vip_status,
  total_stays,
  total_spent
FROM guests
WHERE tenant_id = :tenant_id AND total_spent > 0
ORDER BY total_spent DESC
LIMIT 5;

-- ─── PROPERTY REPORTS ─────────────────────────────────────────────────────────

-- 11. Property Portfolio Occupancy
SELECT
  COUNT(*) FILTER (WHERE status = 'occupied') AS occupied_units,
  COUNT(*) AS total_units,
  ROUND(
    COUNT(*) FILTER (WHERE status = 'occupied') * 100.0 / NULLIF(COUNT(*), 0),
    1
  ) AS occupancy_pct
FROM units
WHERE tenant_id = :tenant_id AND is_active = true;

-- 12. Monthly Rent Roll (from active leases)
SELECT
  SUM(monthly_rent) AS monthly_rent_roll,
  COUNT(*)          AS active_leases
FROM leases
WHERE tenant_id = :tenant_id AND status = 'active';

-- 13. Rent Collection Summary (current month)
SELECT
  SUM(amount)       AS total_due,
  SUM(paid_amount)  AS total_collected,
  SUM(balance)      AS total_balance,
  COUNT(*) FILTER (WHERE status = 'overdue') AS overdue_count,
  SUM(balance) FILTER (WHERE status = 'overdue') AS overdue_amount
FROM rent_schedule
WHERE
  tenant_id  = :tenant_id
  AND due_date >= DATE_TRUNC('month', CURRENT_DATE)
  AND due_date <  DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month';

-- 14. Rent Collection by Month (last 6 months)
SELECT
  DATE_TRUNC('month', due_date) AS month,
  TO_CHAR(due_date, 'Mon YY')   AS month_label,
  SUM(amount)                   AS expected,
  SUM(paid_amount)              AS collected,
  ROUND(SUM(paid_amount) * 100.0 / NULLIF(SUM(amount), 0), 1) AS collection_pct
FROM rent_schedule
WHERE
  tenant_id = :tenant_id
  AND due_date >= DATE_TRUNC('month', NOW() - INTERVAL '5 months')
GROUP BY 1, 2
ORDER BY 1;

-- 15. Top Overdue Accounts
SELECT
  rs.id,
  rs.due_date,
  rs.amount,
  rs.balance,
  rs.days_overdue,
  pt.first_name || ' ' || pt.last_name AS renter_name,
  u.unit_number,
  p.name AS property_name
FROM rent_schedule rs
JOIN property_tenants pt ON pt.id = rs.property_tenant_id
JOIN units u ON u.id = rs.unit_id
JOIN properties p ON p.id = u.property_id
WHERE
  rs.tenant_id = :tenant_id
  AND rs.status = 'overdue'
ORDER BY rs.balance DESC
LIMIT 10;

-- 16. Leases Expiring in Next 30 Days
SELECT
  l.id,
  l.lease_reference,
  l.end_date,
  l.monthly_rent,
  pt.first_name || ' ' || pt.last_name AS renter_name,
  u.unit_number,
  p.name AS property_name
FROM leases l
JOIN property_tenants pt ON pt.id = l.property_tenant_id
JOIN units u ON u.id = l.unit_id
JOIN properties p ON p.id = u.property_id
WHERE
  l.tenant_id = :tenant_id
  AND l.status = 'active'
  AND l.end_date IS NOT NULL
  AND l.end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
ORDER BY l.end_date;

-- 17. Portfolio Value (annual market rent)
SELECT
  SUM(market_rent * 12) AS annual_portfolio_value,
  SUM(market_rent)      AS monthly_market_rent,
  COUNT(*)              AS total_units
FROM units
WHERE tenant_id = :tenant_id AND is_active = true AND market_rent IS NOT NULL;

-- 18. Management Fees Earned (all statements)
SELECT
  SUM(management_fee) AS total_management_fees,
  COUNT(*)            AS statement_count
FROM owner_statements
WHERE tenant_id = :tenant_id;

-- ─── EXECUTIVE BI ─────────────────────────────────────────────────────────────

-- 19. GOPPAR (Gross Operating Profit Per Available Room)
-- GOPPAR = (Total Revenue × Gross Margin) / Total Rooms
-- Gross margin assumed at 65% (configurable); calculated in-app.

-- 20. NPS Score
SELECT
  AVG(nps_score)                         AS avg_nps,
  COUNT(*) FILTER (WHERE nps_score >= 9) AS promoters,
  COUNT(*) FILTER (WHERE nps_score <= 6) AS detractors,
  COUNT(*)                               AS total_responses,
  ROUND(
    (COUNT(*) FILTER (WHERE nps_score >= 9) -
     COUNT(*) FILTER (WHERE nps_score <= 6)) * 100.0 / NULLIF(COUNT(*), 0),
    0
  ) AS nps_score
FROM surveys
WHERE tenant_id = :tenant_id AND nps_score IS NOT NULL;

-- 21. F&B Revenue (current month)
SELECT
  SUM(subtotal)  AS fb_revenue,
  COUNT(*)       AS orders
FROM fb_orders
WHERE
  tenant_id   = :tenant_id
  AND status  != 'cancelled'
  AND created_at >= DATE_TRUNC('month', CURRENT_DATE);
