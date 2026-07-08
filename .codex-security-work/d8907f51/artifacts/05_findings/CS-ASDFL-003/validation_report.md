# Validation: CS-ASDFL-003 - Stored XSS in admin application views

Disposition: reportable

Method: static source trace plus existing regression test review.

Evidence: application/profile fields submitted by ordinary users reaches admin application modal/list innerHTML at js/yonetim.js:1054.

Confidence: high.
