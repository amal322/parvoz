# Parvoz

The hiring platform of Central Asian University. Companies subscribe to reach students with
registrar-verified records, and pay three gross monthly salaries for each hire.

- Live site: https://amal322.github.io/parvoz/
- Interface in Uzbek, Russian and English
- System design, benchmarks and open decisions: [docs/SYSTEM.md](docs/SYSTEM.md)

## What is here

| Path | What it is |
|---|---|
| `src/views/Landing.tsx` | Landing page: draggable student cards, stacked steps, fee calculator, plans, FAQ |
| `src/views/company.tsx` | Employer: talent base, compare, profile, interview times, pipeline, roles, billing |
| `src/views/student.tsx` | Student: inbox, interview choice, hire confirmation, jobs, profile, preferences |
| `src/views/office.tsx` | Career office: revenue, funnel, graduate outcomes, placement ledger, companies |
| `src/i18n.ts` | All copy, key → [English, Russian, Uzbek], plus date and money formats |
| `src/data/logic.ts` | Ranking formula and fee maths |
| `src/data/store.ts` | In-memory demo backend. Each action mirrors one database function |
| `src/data/seed.ts` | Demo data. Every person and company is invented |
| `src/data/live.ts` | What the public site reads from the real database: counts only |
| `src/lib/supabase.ts` | Supabase client and the calls that replace the store actions |
| `supabase/migrations/` | Schema `parvoz`: tables, row level security, functions |
| `supabase/seed.sql` | The same demo data for the database |
| `supabase/verify.sql` | Plays one hire on a deployed database, then rolls itself back |
| `scripts/check-sql.mjs` | Applies everything to an in-process Postgres and runs 46 checks |
| `scripts/check-i18n.mjs` | Checks that every key used in code exists in all three languages |

## Run it

```bash
npm install          # also draws the placeholder portraits into src/data/portraits.ts
npm run dev          # prototype on demo data
npm run check:sql    # access rules, interviews, fee maths, seed, verify script
npm run check:i18n   # 497 keys in three languages
npm run build        # site in dist/
npm run seed:sql     # rebuild supabase/seed.sql from src/data/seed.ts
```

## How it is deployed

**Site.** Every push to `main` runs `.github/workflows/deploy.yml`: checks, build, GitHub Pages.

**Database.** Supabase project `cau-pgc`, schema `parvoz` (it shares the project with the CAU problem
registry and does not touch its tables). Applied in this order through the SQL editor:
`0001_init.sql`, `0002_features.sql`, `seed.sql`, then `verify.sql` to check (14 of 14 passed).

**Connecting the two.** Two switches, both outside the repository:

1. Supabase → Integrations → Data API → Settings → Exposed schemas: add `parvoz`.
2. GitHub → Settings → Secrets and variables → Actions → Variables: add `SUPABASE_PUBLISHABLE_KEY`
   with the project's publishable key (Supabase → Settings → API keys), then re-run the Deploy
   workflow.

With both in place the landing page shows live counts from the database. Without them it shows the
demo figures. A visitor without an account can read only those counts and the plans table.

## Status

Live: the site, the database schema with demo data, public counts on the landing page.
Still on the in-memory demo store: the employer, student and career office screens.
Next: sign-in, then moving those screens to the database one by one (`src/lib/supabase.ts` already
has the calls). Sign-in will share its users with the registry while both live in one project.

Uzbek copy was written without a native speaker's review and needs one before launch.

## Credits

- Portraits: DiceBear "Notionists" by Zoish, CC0. They are illustrations standing in for student
  photos, which will come from the Digital CV.
- Type: Inter Tight and Oranienbaum, SIL Open Font License.
