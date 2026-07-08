# Validation: CS-ASDFL-005 - Sensitive workflow tables lack visible RLS policies in migrations

Disposition: reportable

Method: static source trace plus existing regression test review.

Evidence: authenticated users calling Supabase table APIs reaches applications and other workflow tables with no visible RLS in migrations at js/app.js:989.

Confidence: medium.
