# Timeline Track

A personal daily log you write as one messy paragraph at the end of the day. Claude splits it into **done items, to-dos and events**, each with a category, tags, project and roadmap step. You review and edit everything, then save it. Over time you get a timeline, project history, roadmap progress and a Markdown export for any date range.

Built with Next.js 16, Neon Postgres, Tailwind CSS v4 and the Anthropic API (Claude Opus 5.5).

## Features

- **Today**: one text box. "Split with Claude" turns your paragraph into structured items; fix any field on the review screen before saving. Open to-dos and events carry over from earlier days.
- **Smart day boundary**: anything you log before 4 AM counts as the previous day (configurable per user). You can also back-fill past days.
- **Timeline**: activity heatmap, streaks, and every day's items with 7, 30 and 90-day views.
- **Projects**: created when Claude spots a new project name (you confirm it), with status, milestones, open items and history.
- **Roadmaps**: paste or upload a long plan (.md, .txt or .pdf). Claude turns it into phases, steps and checklists with planned hours and target dates from your start date. Edit the tree, save it, and your daily logs tick steps off automatically.
- **Export**: Markdown grouped by date with a summary, filterable by category, tag and project (`/export`, or `/api/export` for scripts).
- Light and dark mode, a mobile layout with a bottom tab bar, and an installable PWA manifest.

## Run it locally

### 1. Prerequisites

- **Node.js 20.9 or newer** (`node -v`)
- A free **[Neon](https://neon.tech)** Postgres database. The app uses Neon's serverless HTTP driver, so a plain local Postgres won't work without code changes.
- An **[Anthropic API key](https://console.anthropic.com)**

### 2. Install

```bash
git clone https://github.com/abhinag007/timeline-track.git
cd timeline-track
npm install
```

### 3. Create the database

In the Neon dashboard, create a project, open **SQL Editor**, paste the contents of [`db/schema.sql`](db/schema.sql) and run it once. You can also use `psql`:

```bash
psql "$DATABASE_URL" -f db/schema.sql
```

### 4. Configure environment variables

```bash
cp .env.example .env.local
```

Fill in `.env.local`:

| Variable | Where to get it |
| --- | --- |
| `DATABASE_URL` | Neon dashboard → **Connect** → connection string |
| `SESSION_SECRET` | Any long random string, for example from `openssl rand -base64 32` |
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) → API Keys |

`.env.local` is git-ignored. Never commit it.

### 5. Create your login

There is no public sign-up. This script asks for an email and password and adds the 9 default categories:

```bash
npm run create-user
```

Anything you log before 4 AM counts as the previous day. To change the time zone or the cutoff:

```sql
update users set timezone = 'Europe/London', day_cutoff_hour = 3 where email = 'you@example.com';
```

### 6. Start

```bash
npm run dev
```

Open http://localhost:3000 and sign in. If port 3000 is taken, run `npm run dev -- -p 3200`.

## Deploy

The app needs a Node.js server (Server Actions and API routes), so it **can't run on GitHub Pages**. [Vercel](https://vercel.com) is the easiest host: import the repo, add the three environment variables, and deploy. Large PDF roadmap imports can take a minute or two, which fits within Vercel's default 300-second function limit.

## Project structure

```
db/schema.sql            Database schema
scripts/create-user.mjs  Creates a login and default categories
src/app/(app)/           Pages: Today, Timeline, Projects, Roadmaps, Export
src/app/actions.ts       Server Actions (login, save log, roadmaps, …)
src/app/api/export/      Markdown export endpoint
src/lib/split.ts         Claude prompt and schema for splitting a daily log
src/lib/roadmap.ts       Claude prompt and schema for turning a plan into a roadmap
src/lib/data.ts          Database queries
src/lib/session.ts       Signed-cookie sessions (jose)
src/components/          UI components
```

## Cost

At one or two logs a day on Claude Opus 5.5, expect about $4 a month of API usage. Roadmap imports from long PDFs cost more per run.

## License

[MIT](LICENSE)
