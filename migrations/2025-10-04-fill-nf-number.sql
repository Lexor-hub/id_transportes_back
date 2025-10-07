-- Migration: 2025-10-04-fill-nf-number.sql
-- Purpose: ensure `nf_number` exists on delivery_notes and try to populate missing values
-- from delivery_receipts.filename when available. Also create an audit table with
-- delivery_notes rows that remain without nf_number for manual review.

-- 1) Ensure column exists (MySQL 8+ supports IF NOT EXISTS for ADD COLUMN)
ALTER TABLE delivery_notes
  ADD COLUMN IF NOT EXISTS nf_number VARCHAR(50) NULL;

-- 2) Try to populate nf_number from delivery_receipts.filename when the latter
-- looks non-empty. This is a best-effort attempt; filenames may not be actual NF numbers
-- so results should be reviewed.
UPDATE delivery_notes dn
JOIN delivery_receipts dr ON dr.delivery_note_id = dn.id
SET dn.nf_number = dr.filename
WHERE (dn.nf_number IS NULL OR TRIM(dn.nf_number) = '')
  AND dr.filename IS NOT NULL
  AND TRIM(dr.filename) <> ''
  AND (dn.nf_number IS NULL OR dn.nf_number = '');

-- 3) Create an audit table with deliveries that still don't have an nf_number
-- after the attempted fill, so you can manually inspect and correct them.
CREATE TABLE IF NOT EXISTS delivery_notes_missing_nf (
  id INT PRIMARY KEY,
  delivery_note_id INT NOT NULL,
  client_name_extracted VARCHAR(255),
  delivery_address VARCHAR(255),
  created_at DATETIME,
  receipt_filename VARCHAR(500),
  receipt_image_url VARCHAR(500),
  notes TEXT,
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Clear previous entries for the same migration run (optional)
DELETE FROM delivery_notes_missing_nf WHERE recorded_at < NOW() - INTERVAL 30 DAY;

-- Insert current missing NF rows for audit
INSERT INTO delivery_notes_missing_nf (delivery_note_id, client_name_extracted, delivery_address, created_at, receipt_filename, receipt_image_url, notes)
SELECT dn.id, dn.client_name_extracted, dn.delivery_address, dn.created_at, dr.filename, dr.image_url, NULL
FROM delivery_notes dn
LEFT JOIN delivery_receipts dr ON dr.delivery_note_id = dn.id
WHERE dn.nf_number IS NULL OR TRIM(dn.nf_number) = '';

-- 4) (Optional) Create an index to speed future checks
CREATE INDEX IF NOT EXISTS idx_delivery_notes_missing_nf_delivery ON delivery_notes_missing_nf(delivery_note_id);

-- IMPORTANT NOTES:
-- - This migration attempts a simple fill from receipt filename. Filenames are free-form
--   and may not represent the NF number format. You must review the rows in
--   `delivery_notes_missing_nf` and correct `delivery_notes.nf_number` manually when needed.
-- - Always BACKUP your database before running migrations.
-- - Run this script in a maintenance window if your DB is large.
