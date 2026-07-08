# Security Review: asdfl

## Scope

- Target: `C:\Users\alika\Documents\GitHub\asdfl`, full repository, revision `429ae2b66303ab24c651416e222c455313d9a908`.
- Reviewed surfaces: Supabase migrations, shared auth/app code, admin panel, community/events/gallery/career/student/alumni flows, service worker, security headers, and existing security tests.
- Validation mode: static source tracing plus existing regression tests. `npm.cmd test` passed 11/11 tests.
- Limitation: the Codex Security app scan directory under `AppData\Local\Temp` was not writable from this session, so this readable report is stored under the repository workspace instead of the plugin scan bundle.

## Findings

| # | Severity | Confidence | Finding |
|---|---|---|---|
| 1 | High | High | Stored XSS in gallery metadata |
| 2 | High | High | Stored XSS in career requests and job applications |
| 3 | High | High | Stored XSS in admin application views |
| 4 | Medium | High | Post authors can self-pin posts and forge like counts |
| 5 | Medium | Medium | Sensitive workflow tables lack visible RLS policies in migrations |
| 6 | Low | High | CSV exports are vulnerable to formula injection |

### 1. Stored XSS in gallery metadata

Affected lines:
- `js/galeri.js:45`
- `js/galeri.js:50`
- `js/galeri.js:52`
- `js/galeri.js:69`
- `js/galeri.js:75`
- `js/galeri.js:77`
- `js/galeri.js:130`

`handleGalleryUpload` stores user-controlled `title` and `description` directly in `gallery`. The gallery grid and lightbox then build `innerHTML` with `g.title`, `g.description`, `g.image_url`, and joined `profiles.name` without `ASDFL.escapeHTML`, `escapeAttr`, or safe URL handling. Any authenticated gallery uploader can persist HTML/script-capable payloads that execute for gallery visitors. Image file type and size checks do not protect these text and attribute sinks.

Fix: escape gallery title, description, author, year, and URL attributes before interpolation, or build DOM nodes with `textContent`/`setAttribute`. Add a regression test covering `galeri.js` render sinks.

### 2. Stored XSS in career requests and job applications

Affected lines:
- `js/kariyer.js:313`
- `js/kariyer.js:319`
- `js/kariyer.js:323`
- `js/kariyer.js:523`
- `js/kariyer.js:528`
- `js/kariyer.js:577`
- `js/kariyer.js:582`
- `js/kariyer.js:629`
- `js/kariyer.js:633`
- `js/kariyer.js:787`

Student-created internship request fields and job application fields are rendered through `innerHTML` without escaping. `resumeUrl` only checks `startsWith('http://')` or `startsWith('https://')`; quoted attribute injection remains possible because the value is placed directly in `href="${app.resume_url}"`. This can execute attacker-controlled markup in student dashboards or employer/admin application views.

Fix: apply `ASDFL.escapeHTML` to all text fields, `ASDFL.escapeAttr` plus URL parsing to `href` fields, and prefer DOM construction for links. Validate URLs with `new URL`, require `http:`/`https:`, and render the normalized URL.

### 3. Stored XSS in admin application views

Affected lines:
- `js/yonetim.js:1054`
- `js/yonetim.js:1059`
- `js/yonetim.js:1061`
- `js/yonetim.js:1063`
- `js/yonetim.js:1074`
- `js/yonetim.js:1078`
- `js/yonetim.js:1100`
- `js/yonetim.js:1101`
- `js/yonetim.js:1110`
- `js/yonetim.js:1342`
- `js/yonetim.js:1350`
- `js/yonetim.js:1354`
- `js/yonetim.js:1360`
- `js/yonetim.js:1362`
- `js/yonetim.js:1394`
- `js/yonetim.js:1398`

The admin scholarship/application modal and list interpolate `applications.details`, `applications.title`, and joined profile fields into `innerHTML` without escaping. A regular applicant can submit data that executes when an admin reviews applications, making this more severe than a public-page XSS because it targets privileged users.

Fix: escape every user/application/profile value before template interpolation. Keep status/type badge values allowlisted. Add tests similar to the existing XSS tests for `yonetim.js` application render paths.

### 4. Post authors can self-pin posts and forge like counts

Affected lines:
- `supabase/migrations/202607080001_posts_baseline_and_poll_votes.sql:15`
- `supabase/migrations/202607080001_posts_baseline_and_poll_votes.sql:18`
- `supabase/migrations/202607080001_posts_baseline_and_poll_votes.sql:57`
- `supabase/migrations/202607080001_posts_baseline_and_poll_votes.sql:83`
- `supabase/migrations/202607040001_community_social.sql:7`

`posts` includes privileged/integrity fields `likes_count` and `pinned`. The `Authors and admins update posts` policy allows post authors to update their own row, and `protect_post_ownership()` only freezes `id`, `author_id`, and `created_at`. That leaves authors able to set `pinned = true` and arbitrary `likes_count`, bypassing the admin-only `set_post_pinned()` intent and poll/like integrity controls.

Fix: restrict author updates to safe fields, or add a trigger that only allows admins/RPC paths to change `pinned` and server-maintained counters. Consider replacing broad row UPDATE with SECURITY DEFINER RPCs for editable fields.

### 5. Sensitive workflow tables lack visible RLS policies in migrations

Affected evidence:
- Client direct access: `js/app.js:330`, `js/app.js:467`, `js/app.js:623`, `js/app.js:681`, `js/app.js:724`, `js/app.js:822`, `js/app.js:919`, `js/app.js:989`
- Admin direct access: `js/yonetim.js:113`, `js/yonetim.js:146`, `js/yonetim.js:312`, `js/yonetim.js:1264`, `js/yonetim.js:1295`, `js/yonetim.js:1416`
- Migration gap: current migrations show RLS policies for posts/events/notifications/likes/reports, but no visible `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` and ownership/admin policies for `applications`, `scholarships`, `contact_requests`, `data_requests`, `job_applications`, `internship_requests`, `mentorships`, `mentorship_appointments`, or `job_postings`.

The browser directly reads and mutates several privacy- and workflow-sensitive tables. Some hardening migrations attach ownership triggers or notification triggers if those tables exist, but the checked migration set does not define corresponding RLS policies. If these tables exist in production with default/permissive privileges, authenticated users may read or update application, mentorship, career, contact-request, or data-request records across users.

Fix: add explicit RLS enablement and least-privilege policies for every client-reachable table. Use owner-scoped policies for self-service rows and admin-only RPCs/policies for status changes, scholarship management, and data requests. Add tests that fail when any client-reachable table lacks RLS.

### 6. CSV exports are vulnerable to formula injection

Affected lines:
- `js/yonetim.js:710`
- `js/yonetim.js:718`
- `js/yonetim.js:1155`
- `js/yonetim.js:1164`
- `js/yonetim.js:1188`
- `js/yonetim.js:1200`

Admin CSV exports quote fields and double quotes, but they do not neutralize leading spreadsheet formula characters such as `=`, `+`, `-`, or `@`. User-controlled names, email fields, application notes, sponsor/program values, and attendee fields can become formulas when opened in Excel or Sheets.

Fix: centralize a CSV cell encoder that prefixes formula-like values with a single quote or tab after trimming leading whitespace, then uses it for every export path.

## Reviewed Surfaces

| Surface | Risk area | Outcome | Notes |
|---|---|---|---|
| Supabase admin RPCs | Privilege escalation | No issue found | `set_user_role`, `set_user_mentor`, `delete_user`, `set_post_pinned`, and `list_event_attendees` use admin checks and revoked public execute grants. |
| Profiles/public directory | Private contact exposure | No issue found | `public_profiles` gates email/phone by share flags and direct private contact columns are revoked from broad SELECT. |
| Storage uploads | Unsafe upload | No issue found | Client and Storage policy enforce image type/size, own folder, and per-user count. Metadata rendering remains vulnerable separately. |
| Community posts/comments | Stored XSS | Mostly no issue found | Main post/comment rendering escapes content; post update policy issue is separate. |
| Events/RSVPs | Authz/capacity | No issue found | Event writes are admin-only, RSVP rows are user-scoped, and capacity has server-side enforcement. |
| Service worker | Cache/security boundary | No issue found | Same-origin GET only, network-first navigation, no message handler. |
| Security headers | Browser hardening | No issue found | `_headers` declares CSP, frame denial, nosniff, HSTS, referrer and permissions policies. |

## Verification

- `npm.cmd test`: passed 11 tests.
- Existing tests do not currently cover gallery/career/admin application render sinks, CSV formula neutralization, or the `posts.pinned`/`likes_count` update restriction.
