WITH new_assignments AS (
  INSERT INTO request_vendors (request_id, vendor_id, notified_at)
  SELECT sr.id, v.id, now()
  FROM service_requests sr
  JOIN vendor_categories vc ON vc.category_id = sr.category_id
  JOIN vendors v ON v.id = vc.vendor_id
  JOIN users u ON u.id = v.user_id
  WHERE sr.status IN ('open', 'partially_quoted', 'quoted')
    AND u.status = 'active'
    AND v.verification_status = 'verified'
    AND NOT EXISTS (
      SELECT 1
      FROM request_vendors rv
      WHERE rv.request_id = sr.id AND rv.vendor_id = v.id
    )
  ON CONFLICT DO NOTHING
  RETURNING request_id, vendor_id
)
INSERT INTO notifications (user_id, type, title, body, link)
SELECT
  v.user_id,
  'request_new',
  'New ' || c.name || ' request',
  s.name || ' needs "' || sr.title || '" for ' || COALESCE(e.name, 'an event') ||
    CASE
      WHEN sr.response_deadline IS NULL THEN ''
      ELSE ' (quotes close ' || to_char(sr.response_deadline AT TIME ZONE 'UTC', 'YYYY-MM-DD') || ')'
    END || '.',
  '/vendor'
FROM new_assignments na
JOIN service_requests sr ON sr.id = na.request_id
JOIN categories c ON c.id = sr.category_id
JOIN societies s ON s.id = sr.society_id
JOIN vendors v ON v.id = na.vendor_id
LEFT JOIN events e ON e.id = sr.event_id;
