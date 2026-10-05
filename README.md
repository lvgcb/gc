# GC Education catalog

React/Vite catalog for Vercel. The site shows a bundled copy of all 237 entries until Supabase is connected. After connection, edits save to Supabase and appear for all visitors.

## Local

```sh
npm install
npm run dev
npm run build
```

## One-time Supabase setup

1. Create a Supabase project.
2. Run [schema.sql](supabase/schema.sql) in its SQL Editor. Then open **Table Editor → catalog_items → Insert → Import Data from CSV** and upload [catalog_items.csv](supabase/catalog_items.csv). It contains 240 entries. Existing counselor notes are encrypted; the three new hackathons have no counselor notes yet.
3. In **Authentication → Users**, create an account for `akimzhansagatzhan@gmail.com`. The database policy grants edits only to this email.
4. If Vercel's Supabase integration has set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, no variable setup is needed. Otherwise, set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in Vercel. Do not use a secret key.
5. Import this GitHub repository into Vercel. Vercel builds the Vite app with `npm run build` and serves `dist`.

The editor signs in with the Supabase account and then uses the existing counselor password to decrypt the notes. The password stays in the browser. Public visitors can read the catalog but cannot change it. JSON download provides a backup of the current catalog.
