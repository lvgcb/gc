# GC Education opportunity catalog — product specification

**Status:** implemented product as of 7 October 2026. This is the handoff for developers, designers, and AI agents. Read [DESIGN.md](DESIGN.md) for the visual identity and [README.md](README.md) for quick setup. If this document and the code disagree, inspect the code and update this specification.

## Purpose and audience

GC Education helps students in grades 9–12 in Kazakhstan discover competitions, hackathons, research programs, scholarships, and other opportunities. A student should be able to find a relevant entry, understand its eligibility and timing, and reach the organizer's official website. The catalog does not submit applications or guarantee admission, funding, or eligibility.

The live site is [gc-sand.vercel.app](https://gc-sand.vercel.app/); the source repository is [lvgcb/gc](https://github.com/lvgcb/gc). This is a single-page React/Vite site on Vercel, styled with Tailwind CSS v4 through its Vite plugin. Supabase provides live data, editor authentication, and public team requests. There is no separately deployed custom backend.

| User | Main task | Access |
| --- | --- | --- |
| Student or visitor | Discover, compare, open official sources, find teammates | Public, no account |
| Catalog editor | Correct, add, or remove entries and maintain private notes | Supabase account on the `catalog_admins` allowlist plus counselor decryption password |
| Counselor | Possible future workflow | Not specified; do not extend counselor mode without the product owner's direction |

The checked-in SQL allowlists `akimzhansagatzhan@gmail.com`. Never commit account passwords, the counselor password, or a Supabase service-role/secret key.

## Product rules

- The audience is based in Kazakhstan. The catalog describes Kazakhstan access, but organizer rules remain authoritative.
- Public visitors browse without signing in. Only allowlisted editors may write catalog rows.
- Russian, Kazakh, and English are supported. Russian is the initial UI language. The catalog entry name is shared; detail text is localized.
- Team matching is a public Telegram contact list for qualifying events, not chat, team formation, or moderated recruitment.
- Keep deployment to a Vercel frontend connected directly to Supabase unless the owner explicitly changes that requirement.
- Dates, prices, eligibility, and availability can change. Do not label an unconfirmed date as confirmed.

## Visitor journey and current behavior

1. The header shows GC Education branding, a language switch, catalog heading, audience description, verification label, and four counts based on the currently loaded catalog.
2. Search, sorting, and filters narrow the catalog. Filters open in a right-side drawer. The groups are entry type, subject area, cost, Kazakhstan access, selectivity, deadline status, and Group Events. Option counts refer to the full loaded catalog.
3. Results appear in a responsive card grid, initially 24 cards. A **Show more** button reveals another 24. The result count reflects the current search and filters.
4. A collapsed card contains type, first subject area, name, a short preview from the first two description sentences, and an upcoming confirmed deadline if available. Collapsed cards have consistent heights.
5. **Подробнее / Details** expands the card in place. It shows the full description; cost, access, selectivity, deadline, and Group Event labels; and any available age, route, format, cost, aid, selection, and outcome details. An organizer link appears only for a valid HTTP(S) URL.
6. Empty results offer a reset. Loading and live-data fallback notices are shown in-page. A back-to-top button appears after scrolling.

### Search, filters, and sorting

- Search is case-insensitive. Every whitespace-separated word must match the name or the selected language's description, field, deadline explanation, or cost explanation. It does not search all detail fields or all languages.
- Values within a filter group are ORed; selected groups are ANDed. Subject areas are an array and match any selected area.
- “Soon” means a confirmed date from today through the next 120 days. A card is marked urgent for a confirmed date within 45 days. Date windows use the visitor's local timezone.
- Default sorting orders by deadline status, upcoming confirmed date, cost, then name. Alternatives sort by name or prioritize free/aid entries.
- Deadline status values are `date`, `window`, `external`, `unpublished`, and `closed`. A date mentioned in prose is not a confirmed deadline; `ds: "date"` and ISO `d` control that UI.

### Group Events and Find a team

- A Group Event has a student team entry or requires a school group. Solo participation can also be available. National delegations in individually scored olympiads, group classes, and event directories do not count. Check organizer participation rules when uncertain.
- Classification lives in [src/groupEvents.js](src/groupEvents.js) as stable IDs; an item-level `groupEvent` boolean overrides the ID list. At this document's date, 66 of 243 live catalog entries are classified. This category is derived in the frontend, not stored as a separate field in the present CSV.
- The filter drawer includes Group Events. An expanded group card shows a badge, and every group card has a **Find a team** button.
- The button reveals a Telegram username form and the 50 latest usernames for that event. Users may enter `@handle` or `handle`; the app stores lowercase without `@`. Valid handles have 5–32 ASCII letters, digits, or underscores. Duplicate username/event pairs are ignored.
- Usernames are public and link to `https://t.me/<handle>`. There is no Telegram ownership check, moderation, removal UI, expiry, or private messaging. The form is unavailable when the live catalog is unavailable.

## Catalog data and content contract

At this document's date, [supabase/catalog_items.csv](supabase/catalog_items.csv) contains **243 rows**: 133 IDs beginning `C` and 110 beginning `P`. Types: 133 competitions, 86 programs, 12 scholarships, and 12 after-school entries. [src/catalog.json](src/catalog.json) is an older bundled fallback with **237 entries**. These numbers are snapshots, not permanent claims.

Each `public.catalog_items` row has `id` (stable text key), `data` (public JSON), and optional `note` (encrypted counselor note as Base64 text). IDs link notes and team requests; preserve them when updating an entry.

| JSON field | Meaning |
| --- | --- |
| `id`, `n`, `u` | Stable ID, shared display name, organizer URL |
| `t` | `competition`, `program`, `scholarship`, or `after` |
| `a` | Subject-area key array defined in `src/translations.json` |
| `c` | Cost: `free`, `aid`, `paid`, or `unknown` |
| `k` | Kazakhstan access: `yes` or `limited` |
| `lv` | Selectivity: `open`, `selective`, or `elite` |
| `ds`, `d` | Deadline status and optional confirmed `YYYY-MM-DD` date |
| `ru`, `kk`, `en` | Localized detail objects |
| `st` | Translation-pending indicator outside Russian when truthy |
| `groupEvent` | Optional boolean overriding the group-event ID list |

Localized detail fields are `e` description, `dn` short deadline label, `l` deadline explanation, `g` eligibility/age, `z` access/application route, `f` field, `p` period, `m` format, `o` cost details, `i` aid, `s` selection, and `r` outcome. Empty fields are omitted from expanded cards. UI translations and subject-area labels are in [src/translations.json](src/translations.json).

Write short, specific descriptions for collapsed cards; put rules and longer context in expanded details. Preserve the difference between confirmed facts and estimates. Use direct official organizer links where possible. Recheck eligibility and deadlines before publishing updates.

## Source of truth and fallback

- With Supabase client settings, the app reads `catalog_items` in one request for rows 0–999. The database is the live source. Editor changes appear for other visitors after reload.
- If Supabase is unconfigured, unavailable, errors, or has no rows, the app loads `src/catalog.json`. It shows a notice when configured live loading fails. The fallback is bundled into Vercel and can lag behind the database.
- The CSV is a manual import/backup artifact, not a runtime data source. Editing the CSV alone does not update Supabase or the bundled fallback. Editing Supabase alone does not update the CSV or fallback.
- The 237 bundled entries have encrypted counselor notes; six later CSV entries have none. The password is not documented in the repository spec.
- `supabase/seed.sql` is an older large SQL import artifact. Use the current CSV for bulk import; do not assume the SQL seed contains later additions.

## Editor and counselor notes

The lock control opens a login dialog. With Supabase configured, an editor supplies a Supabase email/password and a separate counselor password. The app authenticates with Supabase, verifies the user against `catalog_admins`, then decrypts counselor notes in the browser. Database row-level security enforces catalog writes. The counselor password derives a PBKDF2/AES-GCM key in the browser; plaintext notes and the password are not stored in Supabase. Encryption metadata (`salt`, `iter`, `check`) is bundled in `src/catalog.json`.

Unlocked editors can add, edit, and delete entries; edit localized text and private notes; and download a JSON backup. Save encrypts the note and upserts `id`, `data`, and `note`. Deleting an entry also removes its team requests through the database foreign key. Locking clears decrypted notes from React state and signs out.

Without configured Supabase, counselor unlock and editing can work on the bundled data **only in the current browser session**. The JSON download is the only backup; it is not automatically imported or deployed. If Supabase is configured but live loading failed, unlocking is blocked. When an editor changes Russian details, unchanged Kazakh and English counterparts may be copied from Russian and flagged for translation; review all three languages before considering the record complete.

## Supabase and Vercel setup

1. Run [supabase/schema.sql](supabase/schema.sql) to create `catalog_admins`, `catalog_items`, grants, and row-level security policies. It inserts the current allowlisted email.
2. Import [supabase/catalog_items.csv](supabase/catalog_items.csv) into `catalog_items` via Supabase Table Editor. Preserve IDs, JSON, and encrypted note strings.
3. Run [supabase/team_requests.sql](supabase/team_requests.sql) after `catalog_items` exists. It creates a public table with a catalog foreign key, username constraint, and anonymous read/insert policies.
4. Create the editor's Supabase Auth user separately; the allowlist row does not create an Auth account.
5. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in Vercel. The Vite config also accepts `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from its Supabase integration. These are public client settings; never put a service-role key in the frontend.
6. Vercel builds with `npm run build` and serves `dist`. No custom server/API deployment is currently required.

`team_requests` has primary key `(event_id, telegram_username)`. Anyone can read or insert under its current policies. There is no client delete action. Privacy, abuse controls, and retention require a product decision before extending this feature.

## Visual and accessibility direction

Follow [DESIGN.md](DESIGN.md): an energetic Gen-Z education/editorial identity with clear hierarchy, concise copy, useful information, and restrained decoration. The shipped UI has a **light theme** and `#8054CC` violet emphasis. Avoid excessive violet, generic stock visuals, yellow card hover states, crowded cards, and unsupported achievement claims. Header/footer logo: `public/gc-education.png`.

Keep desktop and mobile layouts usable. Preserve semantic controls, visible keyboard focus, readable contrast, dialog focus handling, Escape behavior, and `prefers-reduced-motion`. Do not rely on color alone for deadlines or access. Validate organizer links as HTTP(S). New user-facing UI copy needs Russian, Kazakh, and English.

The prior request to add visual detail to the hero had **not been implemented** when this specification was written. The desired direction was more interest without overwhelming the catalog. Treat it as a pending design task, not current behavior.

## Contributor map and checks

| File | Responsibility |
| --- | --- |
| `src/App.jsx` | Page UI, loading, search/filter/sort, cards, team form, editor |
| `src/style.css` | Tailwind import, light-theme tokens, and a small set of component rules |
| `src/translations.json` | UI text and subject-area labels |
| `src/groupEvents.js` | Student-team classification |
| `src/supabase.js` | Browser Supabase client configuration |
| `src/telegram.js` | Username validation |
| `src/crypto.js` | Browser-side note encryption/decryption |
| `src/catalog.json` | Bundled fallback and encryption metadata |
| `supabase/catalog_items.csv` | Manual import artifact |
| `supabase/schema.sql` | Catalog/admin tables and policies |
| `supabase/team_requests.sql` | Team-request table and policies |
| `scripts/check.mjs` | Lightweight helper/security/classification checks |

Run `npm run check` and `npm run build` after code or data-model changes; inspect desktop and mobile behavior after visual changes.

## Known limitations and open decisions

- Future counselor workflow and permissions are undefined. Preserve current behavior until the owner specifies changes.
- The public team list has no moderation, ownership proof, deletion UI, or retention policy.
- The bundled fallback and CSV are updated manually; there is no automatic export from Supabase. The fallback currently omits six CSV rows.
- The client fetches at most 1,000 live rows. A larger catalog needs pagination or a revised retrieval strategy.
- Some notices and editor validation alerts are hard-coded in English despite the three-language UI.
- Verification copy and many opportunity dates are time-sensitive; refresh against organizers before calling them current.
