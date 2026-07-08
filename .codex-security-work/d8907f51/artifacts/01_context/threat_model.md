# ASDFL Repository Threat Model

ASDFL is a static multi-page alumni/community platform backed by Supabase Auth, Postgres RLS, RPC functions, and Storage. The main protected assets are real personal data, profile contact details, scholarship and application records, mentorship/career workflows, community content, event RSVPs, gallery uploads, legal-consent/data-request records, and admin privileges.

Trust boundaries: public visitors, authenticated ordinary users, admins, Supabase Auth identities, Postgres RLS/RPC functions, Storage object policies, and static-hosting security headers. Attacker-controlled inputs include profile fields, application/request data, posts/comments, gallery metadata, uploaded file metadata, RSVP/job/mentorship ids, URL fields, localStorage state, and any Supabase row rendered back into HTML.

Highest-impact failure modes: RLS bypass, role/mentor/admin privilege escalation, exposure of private contact or application data, stored XSS against users or admins, unauthorized workflow state changes, unsafe upload/content handling, and deployment header bypasses.
