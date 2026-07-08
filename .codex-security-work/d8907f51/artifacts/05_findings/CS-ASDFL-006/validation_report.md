# Validation: CS-ASDFL-006 - CSV exports are vulnerable to formula injection

Disposition: reportable

Method: static source trace plus existing regression test review.

Evidence: user-controlled exported fields reaches CSV opened by admin in spreadsheet software at js/yonetim.js:710.

Confidence: high.
