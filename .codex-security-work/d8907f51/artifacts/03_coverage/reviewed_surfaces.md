# Repository Coverage Ledger

| Row | Surface | Risk Area | Files Checked | Disposition | Evidence |
|---|---|---|---|---|---|
| COV-001 | Gallery | Stored XSS / unsafe upload metadata | `js/galeri.js`, `js/app.js` | reportable | CS-ASDFL-001 |
| COV-002 | Career workflows | Stored XSS / URL attribute injection | `js/kariyer.js`, `js/app.js` | reportable | CS-ASDFL-002 |
| COV-003 | Admin application review | Stored XSS against privileged users | `js/yonetim.js`, `yonetim.html` | reportable | CS-ASDFL-003 |
| COV-004 | Community posts | Authorization and integrity controls | `supabase/migrations/202607080001_posts_baseline_and_poll_votes.sql`, `js/topluluk.js` | reportable | CS-ASDFL-004 |
| COV-005 | Supabase workflow tables | Missing RLS / object authorization | `js/app.js`, `js/yonetim.js`, `supabase/migrations/*.sql` | reportable | CS-ASDFL-005 |
| COV-006 | Admin exports | CSV injection | `js/yonetim.js` | reportable | CS-ASDFL-006 |
| COV-007 | Admin RPCs | Privilege escalation | `202606180001_security_hardening.sql`, `202607040001_community_social.sql`, `202607080002_events_baseline_and_rsvps.sql` | no_issue_found | Admin RPCs use `is_admin()`, fixed search_path, and revoked public execute grants. |
| COV-008 | Profiles directory | Private contact exposure | `js/app.js`, `js/mezunlar.js`, profile migrations | no_issue_found | `public_profiles` filters email/phone by share flags and raw `profiles` contact columns are revoked from broad reads. |
| COV-009 | Storage policies | Unsafe upload | `js/app.js`, `202606180001_security_hardening.sql` | no_issue_found | Client and storage policy enforce image types, size, own path, and object count. |
| COV-010 | Events/RSVPs | Authz/capacity/privacy | `js/etkinlikler.js`, `202607080002_events_baseline_and_rsvps.sql` | no_issue_found | Admin-only event writes, user-scoped RSVP mutations, and server-side capacity trigger are present. |
| COV-011 | Service worker/cache | Offline cache privilege boundary | `sw.js`, `js/bootstrap.js` | no_issue_found | Same-origin GET handling, no message handler, network-first navigation. |
| COV-012 | Browser headers/vendor assets | CSP/CDN/header hardening | `_headers`, HTML pages, `assets/vendor` | no_issue_found | Security headers declared and tests reject HTTPS CDN script/link tags. |
