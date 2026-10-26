import "server-only";
import { sql } from "./db";

export type Category = { id: string; name: string };
export type Project = { id: string; name: string; status: "active" | "paused" | "shipped"; description: string | null };
export type OpenItem = { id: string; kind: "todo" | "event"; title: string; entry_date: string; due_date: string | null; project_name: string | null };
export type RoadmapStep = {
  id: string;
  title: string;
  status: string;
  phase: string;
  roadmap: string;
  roadmap_id: string;
  target_date: string | null;
};
export type ChecklistItem = { id: string; title: string; step_id: string };

export type ItemRow = {
  id: string;
  entry_date: string;
  kind: "done" | "todo" | "event";
  title: string;
  category: string | null;
  project_id: string | null;
  project_name: string | null;
  roadmap_step: string | null;
  duration_minutes: number | null;
  due_date: string | null;
  closed_on: string | null;
  tags: string[];
};

export async function getCategories(userId: string): Promise<Category[]> {
  return (await sql`select id, name from categories where user_id = ${userId} order by position`) as Category[];
}

export async function getTagNames(userId: string): Promise<string[]> {
  const rows = await sql`select name from tags where user_id = ${userId} order by name`;
  return rows.map((r) => r.name as string);
}

export async function getProjects(userId: string): Promise<Project[]> {
  return (await sql`
    select id, name, status, description from projects
    where user_id = ${userId}
    order by case status when 'active' then 0 when 'paused' then 1 else 2 end, name
  `) as Project[];
}

export async function getOpenItems(userId: string): Promise<OpenItem[]> {
  return (await sql`
    select i.id, i.kind, i.title, i.entry_date::text as entry_date, i.due_date::text as due_date, p.name as project_name
    from items i left join projects p on p.id = i.project_id
    where i.user_id = ${userId} and i.kind in ('todo', 'event') and i.closed_on is null
    order by coalesce(i.due_date, i.entry_date), i.created_at
  `) as OpenItem[];
}

export async function getRoadmapSteps(userId: string): Promise<RoadmapStep[]> {
  return (await sql`
    select s.id, s.title, s.status, ph.title as phase, r.title as roadmap, r.id as roadmap_id, s.target_date::text as target_date
    from roadmap_steps s
    join roadmap_phases ph on ph.id = s.phase_id
    join roadmaps r on r.id = ph.roadmap_id
    where r.user_id = ${userId} and s.status <> 'done'
    order by r.created_at, ph.position, s.position
  `) as RoadmapStep[];
}

export async function getOpenChecklistItems(userId: string): Promise<ChecklistItem[]> {
  return (await sql`
    select c.id, c.title, c.step_id
    from roadmap_checklist_items c
    join roadmap_steps s on s.id = c.step_id
    join roadmap_phases ph on ph.id = s.phase_id
    join roadmaps r on r.id = ph.roadmap_id
    where r.user_id = ${userId} and c.done_on is null and s.status <> 'done'
      -- Only steps you're on or about to reach, so the log prompt stays small.
      and (s.status = 'in_progress' or s.target_date is null or s.target_date <= current_date + 21)
    order by r.created_at, ph.position, s.position, c.position
  `) as ChecklistItem[];
}

export type ItemFilters = { category?: string; tag?: string; projectId?: string };

export async function getItems(userId: string, from: string, to: string, filters: ItemFilters = {}): Promise<ItemRow[]> {
  return (await sql`
    select i.id, i.entry_date::text as entry_date, i.kind, i.title, c.name as category,
           i.project_id, p.name as project_name, s.title as roadmap_step,
           i.duration_minutes, i.due_date::text as due_date, i.closed_on::text as closed_on,
           coalesce(array_agg(t.name order by t.name) filter (where t.name is not null), '{}') as tags
    from items i
    left join categories c on c.id = i.category_id
    left join projects p on p.id = i.project_id
    left join roadmap_steps s on s.id = i.roadmap_step_id
    left join item_tags it on it.item_id = i.id
    left join tags t on t.id = it.tag_id
    where i.user_id = ${userId}
      and i.entry_date between ${from} and ${to}
      and (${filters.category ?? null}::text is null or c.name = ${filters.category ?? null})
      and (${filters.projectId ?? null}::uuid is null or i.project_id = ${filters.projectId ?? null})
      and (${filters.tag ?? null}::text is null or exists (
        select 1 from item_tags it2 join tags t2 on t2.id = it2.tag_id
        where it2.item_id = i.id and t2.name = ${filters.tag ?? null}))
    group by i.id, c.name, p.name, s.title
    order by i.entry_date, i.created_at
  `) as ItemRow[];
}

export async function getLoggedDays(userId: string): Promise<Set<string>> {
  const rows = await sql`select distinct entry_date::text as d from entries where user_id = ${userId}`;
  return new Set(rows.map((r) => r.d as string));
}

export async function getProject(userId: string, projectId: string): Promise<Project | null> {
  const rows = await sql`select id, name, status, description from projects where id = ${projectId} and user_id = ${userId}`;
  return (rows[0] as Project) ?? null;
}

export async function getProjectItems(userId: string, projectId: string): Promise<ItemRow[]> {
  return getItems(userId, "1900-01-01", "2999-12-31", { projectId });
}

export type ProjectStats = { project_id: string; item_count: number; minutes: number; open_count: number; last_date: string | null };

export async function getProjectStats(userId: string): Promise<Map<string, ProjectStats>> {
  const rows = (await sql`
    select project_id, count(*)::int as item_count, coalesce(sum(duration_minutes), 0)::int as minutes,
           count(*) filter (where kind in ('todo','event') and closed_on is null)::int as open_count,
           max(entry_date)::text as last_date
    from items where user_id = ${userId} and project_id is not null
    group by project_id
  `) as ProjectStats[];
  return new Map(rows.map((r) => [r.project_id, r]));
}

export type Milestone = { id: string; title: string; done_on: string | null };

export async function getMilestones(userId: string, projectId: string): Promise<Milestone[]> {
  return (await sql`
    select m.id, m.title, m.done_on::text as done_on
    from project_milestones m join projects p on p.id = m.project_id
    where m.project_id = ${projectId} and p.user_id = ${userId}
    order by m.done_on nulls last, m.created_at
  `) as Milestone[];
}

// Items per logged day, for the activity heatmap.
export async function getDayCounts(userId: string, from: string, to: string): Promise<Map<string, number>> {
  const rows = await sql`
    select e.entry_date::text as d, count(i.id)::int as n
    from entries e left join items i on i.entry_id = e.id
    where e.user_id = ${userId} and e.entry_date between ${from} and ${to}
    group by e.entry_date
  `;
  return new Map(rows.map((r) => [r.d as string, r.n as number]));
}

export type RoadmapSummary = {
  id: string;
  title: string;
  summary: string | null;
  start_date: string | null;
  end_date: string | null;
  phase_count: number;
  step_count: number;
  steps_done: number;
  steps_in_progress: number;
  next_step: string | null;
};

export async function getRoadmaps(userId: string): Promise<RoadmapSummary[]> {
  return (await sql`
    select r.id, r.title, r.summary, r.start_date::text as start_date,
           max(s.target_date)::text as end_date,
           count(distinct ph.id)::int as phase_count,
           count(s.id)::int as step_count,
           count(s.id) filter (where s.status = 'done')::int as steps_done,
           count(s.id) filter (where s.status = 'in_progress')::int as steps_in_progress,
           (select s2.title from roadmap_steps s2 join roadmap_phases p2 on p2.id = s2.phase_id
             where p2.roadmap_id = r.id and s2.status <> 'done'
             order by s2.status = 'in_progress' desc, p2.position, s2.position limit 1) as next_step
    from roadmaps r
    left join roadmap_phases ph on ph.roadmap_id = r.id
    left join roadmap_steps s on s.phase_id = ph.id
    where r.user_id = ${userId}
    group by r.id
    order by r.created_at desc
  `) as RoadmapSummary[];
}

export type RoadmapDetail = {
  id: string;
  title: string;
  summary: string | null;
  start_date: string | null;
  phases: {
    id: string;
    title: string;
    steps: {
      id: string;
      title: string;
      description: string | null;
      status: "not_started" | "in_progress" | "done";
      target_date: string | null;
      planned_minutes: number | null;
      source_ref: string | null;
      logged_minutes: number;
      log_count: number;
      checklist: { id: string; title: string; done_on: string | null }[];
    }[];
  }[];
};

export async function getRoadmap(userId: string, roadmapId: string): Promise<RoadmapDetail | null> {
  const [roadmap] = await sql`
    select id, title, summary, start_date::text as start_date from roadmaps where id = ${roadmapId} and user_id = ${userId}
  `;
  if (!roadmap) return null;
  const [phases, steps, checklist] = await Promise.all([
    sql`select id, title from roadmap_phases where roadmap_id = ${roadmapId} order by position`,
    sql`
      select s.id, s.phase_id, s.title, s.description, s.status, s.target_date::text as target_date, s.planned_minutes, s.source_ref,
             coalesce(sum(i.duration_minutes), 0)::int as logged_minutes, count(i.id)::int as log_count
      from roadmap_steps s
      join roadmap_phases ph on ph.id = s.phase_id
      left join items i on i.roadmap_step_id = s.id and i.kind = 'done'
      where ph.roadmap_id = ${roadmapId}
      group by s.id
      order by s.position
    `,
    sql`
      select c.id, c.step_id, c.title, c.done_on::text as done_on
      from roadmap_checklist_items c
      join roadmap_steps s on s.id = c.step_id
      join roadmap_phases ph on ph.id = s.phase_id
      where ph.roadmap_id = ${roadmapId}
      order by c.position
    `,
  ]);
  return {
    ...(roadmap as Omit<RoadmapDetail, "phases">),
    phases: phases.map((ph) => ({
      id: ph.id as string,
      title: ph.title as string,
      steps: steps
        .filter((st) => st.phase_id === ph.id)
        .map((st) => ({
          ...(st as Omit<RoadmapDetail["phases"][number]["steps"][number], "checklist">),
          checklist: checklist.filter((c) => c.step_id === st.id).map((c) => ({ id: c.id, title: c.title, done_on: c.done_on })),
        })),
    })),
  };
}
