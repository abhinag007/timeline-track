import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { sql } from "./db";
import { addDays, logicalToday } from "./dates";

// Each "Try the demo" click gets its own sandbox account with sample data. It is
// deleted after DEMO_HOURS, and the visitor brings their own Claude API key.
export const DEMO_HOURS = 24;
const MAX_ACTIVE_DEMOS = 300;
const CUTOFF = 4;

export class DemoError extends Error {}

type DemoItem = { kind: string; title: string; category: string; project?: string | null; step?: string; minutes?: number; due?: string };

const CATEGORIES = ["Work", "Building", "Sales", "Brand", "Learning", "Practice", "Career", "Health", "Personal"];

const PROJECTS = [
  { key: "lumen", name: "Lumen", status: "active", description: "Habit tracker for iOS" },
  { key: "cli", name: "devlog-cli", status: "active", description: "Open-source CLI for writing changelogs" },
  { key: "site", name: "Portfolio site", status: "shipped", description: "Personal site and case studies" },
] as const;

// [project, title, days ago it was reached, or null if not yet]
const MILESTONES: [string, string, number | null][] = [
  ["lumen", "First 100 beta users", 42],
  ["lumen", "TestFlight public beta", 21],
  ["lumen", "App Store launch", null],
  ["cli", "100 GitHub stars", 7],
  ["site", "Site live", 110],
];

// [title, category, project, minutes]
const DONE: [string, string, string | null, number][] = [
  ["Shipped streak reminders in Lumen", "Building", "lumen", 120],
  ["Fixed the onboarding crash on iOS 18", "Building", "lumen", 90],
  ["Designed the new stats screen", "Building", "lumen", 75],
  ["Answered beta feedback emails", "Work", "lumen", 40],
  ["Refactored the sync layer", "Building", "lumen", 100],
  ["Released devlog-cli v0.4", "Building", "cli", 80],
  ["Triaged GitHub issues on devlog-cli", "Work", "cli", 35],
  ["Reviewed two pull requests at work", "Work", null, 45],
  ["Two LeetCode mediums (graphs)", "Practice", null, 60],
  ["Read a chapter of Designing Data-Intensive Applications", "Learning", null, 45],
  ["Applied to two senior frontend roles", "Career", null, 50],
  ["Updated the portfolio case study", "Career", "site", 70],
  ["Wrote a blog post on Rust error handling", "Brand", null, 70],
  ["5 km run", "Health", null, 35],
];

// Phases -> steps [title, status, week, checklist]
const ROADMAP: [string, [string, "done" | "in_progress" | "not_started", number, string[]][]][] = [
  ["Foundations", [
    ["JavaScript internals refresher", "done", 0, ["Event loop and microtasks", "Closures and scope", "Prototypes and classes"]],
    ["TypeScript generics deep dive", "done", 1, ["Conditional types", "Mapped types", "Write three utility types"]],
  ]],
  ["System design", [
    ["Design a news feed", "in_progress", 3, ["Data model", "Pagination and caching", "Draw the architecture", "Explain trade-offs out loud"]],
    ["Design a collaborative editor", "not_started", 5, ["CRDT vs OT", "Presence and cursors", "Offline sync"]],
  ]],
  ["Interview practice", [
    ["Mock interview with a friend", "not_started", 8, ["Book the slot", "Prepare three stories"]],
    ["Behavioural stories (STAR)", "not_started", 9, ["Conflict story", "Leadership story", "Failure story"]],
  ]],
];

export function safeTimezone(tz: string): string {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return tz;
  } catch {
    return "UTC";
  }
}

export async function createDemoUser(timezone: string) {
  await sql`delete from users where is_demo and expires_at < now()`;
  const [{ active }] = await sql`select count(*)::int as active from users where is_demo`;
  if (active >= MAX_ACTIVE_DEMOS) throw new DemoError("The demo is busy right now. Try again in a little while.");

  const userId = randomUUID();
  const expiresAt = new Date(Date.now() + DEMO_HOURS * 3_600_000);
  const today = logicalToday(timezone, CUTOFF);
  // Nobody can sign in with the password; the session is created directly.
  const passwordHash = await bcrypt.hash(randomBytes(24).toString("base64"), 8);

  const cat = Object.fromEntries(CATEGORIES.map((name) => [name, randomUUID()]));
  const proj: Record<string, string> = Object.fromEntries(PROJECTS.map((p) => [p.key, randomUUID()]));

  const roadmapId = randomUUID();
  const roadmapStart = addDays(today, -28);
  const ph = { id: [] as string[], title: [] as string[], pos: [] as number[] };
  const st = { id: [] as string[], phase: [] as string[], title: [] as string[], status: [] as string[], target: [] as string[], minutes: [] as number[], pos: [] as number[] };
  const ck = { step: [] as string[], title: [] as string[], done: [] as (string | null)[], pos: [] as number[] };
  let currentStep = "";
  ROADMAP.forEach(([phaseTitle, steps], p) => {
    const phaseId = randomUUID();
    ph.id.push(phaseId);
    ph.title.push(phaseTitle);
    ph.pos.push(p);
    steps.forEach(([title, status, week, checklist], s) => {
      const stepId = randomUUID();
      if (status === "in_progress") currentStep = stepId;
      st.id.push(stepId);
      st.phase.push(phaseId);
      st.title.push(title);
      st.status.push(status);
      st.target.push(addDays(roadmapStart, (week + 1) * 7 - 1));
      st.minutes.push(180 + week * 20);
      st.pos.push(s);
      checklist.forEach((item, c) => {
        const ticked = status === "done" || (status === "in_progress" && c < 2);
        ck.step.push(stepId);
        ck.title.push(item);
        ck.done.push(ticked ? addDays(roadmapStart, week * 7 + c) : null);
        ck.pos.push(c);
      });
    });
  });

  // About two months of logs: most days logged, a few gaps, today included.
  const en = { id: [] as string[], date: [] as string[], raw: [] as string[] };
  const it = {
    entry: [] as string[], date: [] as string[], kind: [] as string[], title: [] as string[], category: [] as string[],
    project: [] as (string | null)[], step: [] as (string | null)[], minutes: [] as (number | null)[], due: [] as (string | null)[],
  };
  const addEntry = (date: string, items: DemoItem[]) => {
    const entryId = randomUUID();
    en.id.push(entryId);
    en.date.push(date);
    en.raw.push(items.map((i) => i.title).join(". ") + ".");
    for (const i of items) {
      it.entry.push(entryId);
      it.date.push(date);
      it.kind.push(i.kind);
      it.title.push(i.title);
      it.category.push(cat[i.category]);
      it.project.push(i.project ? proj[i.project] : null);
      it.step.push(i.step ?? null);
      it.minutes.push(i.minutes ?? null);
      it.due.push(i.due ?? null);
    }
  };
  for (let back = 60; back >= 1; back--) {
    if (Math.random() > (back < 21 ? 0.9 : 0.7)) continue;
    const picks = [...DONE].sort(() => Math.random() - 0.5).slice(0, 2 + Math.floor(Math.random() * 3));
    const items: DemoItem[] = picks.map(([title, category, project, minutes]) => ({ kind: "done", title, category, project, minutes }));
    if (back === 2) items.push({ kind: "done", title: "Sketched the news feed data model", category: "Learning", minutes: 60, step: currentStep });
    addEntry(addDays(today, -back), items);
  }
  addEntry(today, [
    { kind: "done", title: "Practised the news feed design out loud", category: "Learning", minutes: 45, step: currentStep },
    { kind: "done", title: "Fixed the token refresh bug in the API", category: "Work", minutes: 120 },
    { kind: "todo", title: "Submit Lumen build to App Store review", category: "Building", project: "lumen" },
    { kind: "todo", title: "Write tests for the config parser", category: "Building", project: "cli" },
    { kind: "event", title: "Frontend interview at Acme", category: "Career", due: addDays(today, 2) },
    { kind: "event", title: "Mock interview with a friend", category: "Career", due: addDays(today, 4) },
  ]);

  await sql.transaction([
    sql`insert into users (id, email, password_hash, timezone, day_cutoff_hour, is_demo, expires_at)
        values (${userId}, ${`demo-${userId}@demo.invalid`}, ${passwordHash}, ${timezone}, ${CUTOFF}, true, ${expiresAt})`,
    sql`insert into categories (id, user_id, name, position)
        select id, ${userId}, name, pos from unnest(${Object.values(cat)}::uuid[], ${Object.keys(cat)}::text[], ${CATEGORIES.map((_, i) => i)}::smallint[]) as t(id, name, pos)`,
    sql`insert into projects (id, user_id, name, status, description)
        select id, ${userId}, name, status, description
        from unnest(${PROJECTS.map((p) => proj[p.key])}::uuid[], ${PROJECTS.map((p) => p.name)}::text[], ${PROJECTS.map((p) => p.status)}::text[], ${PROJECTS.map((p) => p.description)}::text[]) as t(id, name, status, description)`,
    sql`insert into project_milestones (project_id, title, done_on)
        select * from unnest(${MILESTONES.map(([p]) => proj[p])}::uuid[], ${MILESTONES.map(([, t]) => t)}::text[], ${MILESTONES.map(([, , d]) => (d === null ? null : addDays(today, -d)))}::date[])`,
    sql`insert into roadmaps (id, user_id, title, summary, start_date)
        values (${roadmapId}, ${userId}, 'Senior frontend interview prep', 'Twelve weeks from fundamentals to mock interviews, about 6 hours a week.', ${roadmapStart})`,
    sql`insert into roadmap_phases (id, roadmap_id, title, position)
        select id, ${roadmapId}, title, pos from unnest(${ph.id}::uuid[], ${ph.title}::text[], ${ph.pos}::smallint[]) as t(id, title, pos)`,
    sql`insert into roadmap_steps (id, phase_id, title, status, target_date, planned_minutes, position)
        select * from unnest(${st.id}::uuid[], ${st.phase}::uuid[], ${st.title}::text[], ${st.status}::text[], ${st.target}::date[], ${st.minutes}::int[], ${st.pos}::smallint[])`,
    sql`insert into roadmap_checklist_items (step_id, title, done_on, position)
        select * from unnest(${ck.step}::uuid[], ${ck.title}::text[], ${ck.done}::date[], ${ck.pos}::smallint[])`,
    sql`insert into entries (id, user_id, entry_date, raw_text)
        select id, ${userId}, d, raw from unnest(${en.id}::uuid[], ${en.date}::date[], ${en.raw}::text[]) as t(id, d, raw)`,
    sql`insert into items (user_id, entry_id, entry_date, kind, title, category_id, project_id, roadmap_step_id, duration_minutes, due_date)
        select ${userId}, * from unnest(${it.entry}::uuid[], ${it.date}::date[], ${it.kind}::text[], ${it.title}::text[], ${it.category}::uuid[],
          ${it.project}::uuid[], ${it.step}::uuid[], ${it.minutes}::int[], ${it.due}::date[])`,
  ]);

  return { id: userId, timezone, day_cutoff_hour: CUTOFF, expiresAt };
}

export async function deleteDemoUser(userId: string) {
  await sql`delete from users where id = ${userId} and is_demo`;
}
