This folder contains SQL migrations for the backend database.

Migration: 2025-10-04-fill-nf-number.sql
- Purpose: ensure `nf_number` exists on `delivery_notes`, attempt to populate missing values from
  `delivery_receipts.filename`, and create an audit table `delivery_notes_missing_nf` with
  entries that remain without `nf_number` for manual review.

How to run (PowerShell / Windows):
1) Backup your database.
2) From PowerShell, run (replace placeholders):

   mysql -u YOUR_DB_USER -p -h YOUR_DB_HOST YOUR_DB_NAME < migrations\\2025-10-04-fill-nf-number.sql

3) Review the contents of `delivery_notes_missing_nf` and correct values in `delivery_notes.nf_number` as needed.

Notes:
- Filenames are free-form; automatic population may be incorrect for some rows and must be validated.
- Run in maintenance window for large DBs.
