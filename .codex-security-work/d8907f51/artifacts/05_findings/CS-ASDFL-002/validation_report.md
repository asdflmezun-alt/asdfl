# Validation: CS-ASDFL-002 - Stored XSS in career requests and job applications

Disposition: reportable

Method: static source trace plus existing regression test review.

Evidence: student internship request and job application fields reaches career dashboard innerHTML and href interpolation at js/kariyer.js:523.

Confidence: high.
