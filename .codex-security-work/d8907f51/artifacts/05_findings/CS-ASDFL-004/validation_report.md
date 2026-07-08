# Validation: CS-ASDFL-004 - Post authors can self-pin posts and forge like counts

Disposition: reportable

Method: static source trace plus existing regression test review.

Evidence: authenticated post author update reaches mutable pinned and likes_count fields at supabase/migrations/202607080001_posts_baseline_and_poll_votes.sql:57.

Confidence: high.
