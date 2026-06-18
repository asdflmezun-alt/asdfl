# ASDFL Mezunlar Dernegi

A static alumni platform backed by Supabase.

## Setup and verification

```powershell
npm install
npm run verify
supabase db push
```

`supabase/migrations` is the database schema source of truth. Root-level SQL files are historical references and must not be applied independently to new environments. If the hosting platform does not support `_headers`, copy the same headers into its deployment configuration.

The security migration assumes the existing production schema is present. Apply it to a staging project first, run the authorization checks, and then promote the same migration to production. Never expose a Supabase service-role key in this client.
