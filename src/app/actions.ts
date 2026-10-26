"use server";

import { randomUUID } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { sql } from "@/lib/db";
import { isIsoDate } from "@/lib/dates";
import {
  getCategories,
  getOpenChecklistItems,
  getOpenItems,
  getProjects,
  getRoadmapSteps,
  getTagNames,
} from "@/lib/data";
import { claudeKeyForRequest, clearDemoKey, storeDemoKey } from "@/lib/claude-key";
import { createDemoUser, deleteDemoUser, DemoError, safeTimezone } from "@/lib/demo";
import { createSession, deleteSession, getSession, requireSession, requireToday, requireUserId } from "@/lib/session";
import { extractRoadmap, RoadmapError, type RoadmapProposal, type RoadmapSource } from "@/lib/roadmap";
import { ProposalSchema, SplitError, splitLog, type Proposal } from "@/lib/split";

// ---------- auth ----------

export type LoginState = { error?: string } | undefined;

export async function login(_state: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const rows = await sql`select id, password_hash, timezone, day_cutoff_hour from users where email = ${email}`;
  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash as string))) {
    return { error: "Wrong email or password." };
  }
  await createSession({ id: user.id as string, timezone: user.timezone as string, day_cutoff_hour: user.day_cutoff_hour as number });
  redirect("/");
}

export async function logout() {
  const session = await getSession();
  if (session?.demo) {
    await deleteDemoUser(session.userId);
    await clearDemoKey();
  }
  await deleteSession();
  redirect("/login");
}

// ---------- demo ----------

export async function startDemo(_state: LoginState, formData: FormData): Promise<LoginState> {
  // Starting over replaces the visitor's previous sandbox.
  const previous = await getSession();
  if (previous?.demo) await deleteDemoUser(previous.userId);
  let user;
  try {
    user = await createDemoUser(safeTimezone(String(formData.get("tz") ?? "UTC")));
  } catch (error) {
    if (error instanceof DemoError) return { error: error.message };
    throw error;
  }
  await clearDemoKey();
  await createSession(user, { demoUntil: user.expiresAt });
  redirect("/");
}

export type ClaudeKeyState = { error?: string; ok?: boolean } | undefined;

export async function saveClaudeKey(_state: ClaudeKeyState, formData: FormData): Promise<ClaudeKeyState> {
  const session = await requireSession();
  if (!session.demo) return { error: "Your account uses the API key set on the server." };
  const apiKey = String(formData.get("key") ?? "").trim();
  if (!/^sk-ant-[\w-]{20,}$/.test(apiKey)) return { error: "That doesn't look like an Anthropic API key. It starts with sk-ant-." };
  try {
    // A free call that only succeeds with a working key.
    await new Anthropic({ apiKey }).models.list({ limit: 1 });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
      return { error: "Claude didn't accept that key. Check it and try again." };
    }
    if (error instanceof Anthropic.APIError) return { error: `Couldn't check the key (${error.status}). Try again in a moment.` };
    throw error;
  }
  const [user] = await sql`select expires_at from users where id = ${session.userId} and is_demo`;
  if (!user) redirect("/login");
  await storeDemoKey(session.userId, apiKey, new Date(user.expires_at as string));
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function removeClaudeKey() {
  await clearDemoKey();
  revalidatePath("/", "layout");
}

// ---------- log splitting ----------

// needKey: the demo has no working Claude key, so the page should ask for one.
export type AnalyzeResult = { proposal: Proposal } | { error: string; needKey?: boolean };

export async function analyzeLog(text: string, entryDate: string): Promise<AnalyzeResult> {
  const userId = await requireUserId();
  if (!text.trim()) return { error: "Write something about your day first." };
  if (!isIsoDate(entryDate)) return { error: "Pick a valid date." };

  const [categories, tags, projects, openItems, steps, checklist] = await Promise.all([
    getCategories(userId),
    getTagNames(userId),
    getProjects(userId),
    getOpenItems(userId),
    getRoadmapSteps(userId),
    getOpenChecklistItems(userId),
  ]);
  const key = await claudeKeyForRequest();
  if ("error" in key) return { error: key.error, needKey: key.needKey };
  try {
    const proposal = await splitLog(text, { entryDate, categories, tags, projects, openItems, steps, checklist }, key.apiKey);
    return { proposal };
  } catch (error) {
    if (error instanceof SplitError) return { error: error.message, needKey: error.badKey || undefined };
    console.error(error);
    return { error: "Something went wrong while splitting your log." };
  }
}

// ---------- saving ----------

const SaveSchema = z.object({
  entryDate: z.string().refine(isIsoDate),
  rawText: z.string().min(1),
  items: ProposalSchema.shape.items.min(1),
  stepStatusChanges: ProposalSchema.shape.step_status_changes,
});

export type SaveInput = z.infer<typeof SaveSchema>;

export async function saveEntry(input: SaveInput): Promise<{ error: string } | void> {
  const userId = await requireUserId();
  const parsed = SaveSchema.safeParse(input);
  if (!parsed.success) return { error: "Some items are incomplete. Every item needs a title." };
  const { entryDate, rawText, stepStatusChanges } = parsed.data;
  const items = parsed.data.items.map((i) => ({
    ...i,
    duration_minutes: i.duration_minutes && i.duration_minutes > 0 ? Math.round(i.duration_minutes) : null,
  }));
  if (items.some((i) => !i.title.trim())) return { error: "Every item needs a title." };

  const [categories, projects] = await Promise.all([getCategories(userId), getProjects(userId)]);
  const categoryId = new Map(categories.map((c) => [c.name, c.id]));
  const projectIds = new Set(projects.map((p) => p.id));
  const projectByLower = new Map(projects.map((p) => [p.name.toLowerCase(), p.id]));

  // Tags are upserted up front so their ids are known for the transaction.
  const tagNames = [...new Set(items.flatMap((i) => i.tags))];
  const tagId = new Map<string, string>();
  if (tagNames.length) {
    await sql`insert into tags (user_id, name) select ${userId}, unnest(${tagNames}::text[]) on conflict do nothing`;
    const rows = await sql`select id, name from tags where user_id = ${userId} and name = any(${tagNames}::text[])`;
    rows.forEach((r) => tagId.set(r.name as string, r.id as string));
  }

  const entryId = randomUUID();
  const queries = [sql`insert into entries (id, user_id, entry_date, raw_text) values (${entryId}, ${userId}, ${entryDate}, ${rawText})`];

  const newProjects = new Map<string, string>();
  for (const item of items) {
    const name = item.new_project_name?.trim();
    if (!name || projectByLower.has(name.toLowerCase()) || newProjects.has(name.toLowerCase())) continue;
    const id = randomUUID();
    newProjects.set(name.toLowerCase(), id);
    queries.push(sql`insert into projects (id, user_id, name) values (${id}, ${userId}, ${name})`);
  }

  for (const item of items) {
    const itemId = randomUUID();
    const newName = item.new_project_name?.trim().toLowerCase();
    const projectId =
      item.project_id && projectIds.has(item.project_id)
        ? item.project_id
        : newName
          ? (projectByLower.get(newName) ?? newProjects.get(newName) ?? null)
          : null;
    const due = item.kind === "done" || !item.due_date || !isIsoDate(item.due_date) ? null : item.due_date;

    queries.push(sql`
      insert into items (id, user_id, entry_id, entry_date, kind, title, category_id, project_id,
                         roadmap_step_id, duration_minutes, due_date)
      select ${itemId}, ${userId}, ${entryId}, ${entryDate}, ${item.kind}, ${item.title.trim()},
             ${categoryId.get(item.category) ?? null}, ${projectId},
             (select s.id from roadmap_steps s join roadmap_phases ph on ph.id = s.phase_id
                join roadmaps r on r.id = ph.roadmap_id
               where s.id = ${item.roadmap_step_id}::uuid and r.user_id = ${userId}),
             ${item.duration_minutes}, ${due}
    `);
    for (const name of new Set(item.tags)) {
      const id = tagId.get(name);
      if (id) queries.push(sql`insert into item_tags (item_id, tag_id) values (${itemId}, ${id})`);
    }
    if (item.closes_open_item_ids.length) {
      queries.push(sql`
        update items set closed_on = ${entryDate}, closed_by_item_id = ${itemId}
        where user_id = ${userId} and id = any(${item.closes_open_item_ids}::uuid[]) and closed_on is null
      `);
    }
    if (item.checklist_item_ids.length) {
      queries.push(sql`
        update roadmap_checklist_items c set done_on = ${entryDate}
        from roadmap_steps s, roadmap_phases ph, roadmaps r
        where c.id = any(${item.checklist_item_ids}::uuid[]) and s.id = c.step_id
          and ph.id = s.phase_id and r.id = ph.roadmap_id and r.user_id = ${userId}
      `);
    }
  }

  for (const change of stepStatusChanges) {
    queries.push(sql`
      update roadmap_steps s set status = ${change.new_status}
      from roadmap_phases ph, roadmaps r
      where s.id = ${change.step_id}::uuid and ph.id = s.phase_id and r.id = ph.roadmap_id and r.user_id = ${userId}
    `);
  }

  await sql.transaction(queries);
  revalidatePath("/", "layout");
  redirect(`/timeline?saved=${entryDate}`);
}

// ---------- quick edits ----------

export async function closeOpenItem(itemId: string) {
  const { userId, today } = await requireToday();
  await sql`update items set closed_on = ${today} where id = ${itemId} and user_id = ${userId} and closed_on is null`;
  revalidatePath("/", "layout");
}

export async function deleteItem(itemId: string) {
  const userId = await requireUserId();
  await sql`delete from items where id = ${itemId} and user_id = ${userId}`;
  revalidatePath("/", "layout");
}

export async function setProjectStatus(projectId: string, status: "active" | "paused" | "shipped") {
  const userId = await requireUserId();
  await sql`update projects set status = ${status} where id = ${projectId} and user_id = ${userId}`;
  revalidatePath("/projects", "layout");
}

export async function createProject(formData: FormData) {
  const userId = await requireUserId();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  await sql`insert into projects (user_id, name) values (${userId}, ${name}) on conflict do nothing`;
  revalidatePath("/projects");
}

export async function addMilestone(projectId: string, formData: FormData) {
  const userId = await requireUserId();
  const title = String(formData.get("title") ?? "").trim();
  const doneOn = String(formData.get("done_on") ?? "");
  if (!title) return;
  await sql`
    insert into project_milestones (project_id, title, done_on)
    select id, ${title}, ${isIsoDate(doneOn) ? doneOn : null} from projects where id = ${projectId} and user_id = ${userId}
  `;
  revalidatePath(`/projects/${projectId}`);
}

export async function completeMilestone(projectId: string, milestoneId: string) {
  const { userId, today } = await requireToday();
  await sql`
    update project_milestones m set done_on = ${today}
    from projects p where m.id = ${milestoneId} and p.id = m.project_id and p.user_id = ${userId}
  `;
  revalidatePath(`/projects/${projectId}`);
}

// ---------- roadmaps ----------

const MAX_TEXT_CHARS = 600_000;
const MAX_PDF_BASE64 = 11_000_000; // about 8 MB of PDF

export type AnalyzeRoadmapInput = { startDate: string; text?: string; pdf?: { name: string; base64: string } };
export type AnalyzeRoadmapResult = { proposal: RoadmapProposal } | { error: string; needKey?: boolean };

export async function analyzeRoadmap(input: AnalyzeRoadmapInput): Promise<AnalyzeRoadmapResult> {
  await requireUserId();
  if (!isIsoDate(input.startDate)) return { error: "Pick a valid start date." };
  let source: RoadmapSource;
  if (input.pdf) {
    if (input.pdf.base64.length > MAX_PDF_BASE64) return { error: "That PDF is over 8 MB. Paste the text instead." };
    source = { kind: "pdf", name: input.pdf.name.slice(0, 200), base64: input.pdf.base64 };
  } else {
    const text = input.text?.trim() ?? "";
    if (text.length < 40) return { error: "Paste your roadmap document, or upload a file." };
    if (text.length > MAX_TEXT_CHARS) return { error: "That document is too long for one roadmap. Split it into two." };
    source = { kind: "text", text };
  }
  const key = await claudeKeyForRequest();
  if ("error" in key) return { error: key.error, needKey: key.needKey };
  try {
    return { proposal: await extractRoadmap(source, input.startDate, key.apiKey) };
  } catch (error) {
    if (error instanceof RoadmapError) return { error: error.message, needKey: error.badKey || undefined };
    console.error(error);
    return { error: "Something went wrong while reading your document." };
  }
}

const SaveRoadmapSchema = z.object({
  title: z.string().trim().min(1).max(300),
  summary: z.string().max(1000),
  startDate: z.string().refine(isIsoDate),
  sourceDoc: z.string().max(MAX_TEXT_CHARS).nullable(),
  phases: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(300),
        steps: z
          .array(
            z.object({
              title: z.string().trim().min(1).max(300),
              description: z.string().max(1000).nullable(),
              planned_minutes: z.number().int().positive().nullable(),
              target_date: z.string().refine(isIsoDate).nullable(),
              source_ref: z.string().max(200).nullable(),
              checklist: z.array(z.string().trim().min(1).max(300)).max(50),
            }),
          )
          .min(1),
      }),
    )
    .min(1),
});

export type SaveRoadmapInput = z.infer<typeof SaveRoadmapSchema>;

export async function saveRoadmap(input: SaveRoadmapInput): Promise<{ error: string } | void> {
  const userId = await requireUserId();
  const parsed = SaveRoadmapSchema.safeParse(input);
  if (!parsed.success) return { error: "Every phase needs a title and at least one step, and every step needs a title." };
  const { title, summary, startDate, sourceDoc, phases } = parsed.data;

  // Ids are generated here so the whole tree goes in with four bulk inserts.
  const roadmapId = randomUUID();
  const ph = { id: [] as string[], title: [] as string[], pos: [] as number[] };
  const st = {
    id: [] as string[], phase: [] as string[], title: [] as string[], description: [] as (string | null)[],
    target: [] as (string | null)[], minutes: [] as (number | null)[], ref: [] as (string | null)[], pos: [] as number[],
  };
  const ck = { id: [] as string[], step: [] as string[], title: [] as string[], pos: [] as number[] };

  phases.forEach((phase, p) => {
    const phaseId = randomUUID();
    ph.id.push(phaseId);
    ph.title.push(phase.title);
    ph.pos.push(p);
    phase.steps.forEach((step, s) => {
      const stepId = randomUUID();
      st.id.push(stepId);
      st.phase.push(phaseId);
      st.title.push(step.title);
      st.description.push(step.description?.trim() || null);
      st.target.push(step.target_date);
      st.minutes.push(step.planned_minutes);
      st.ref.push(step.source_ref?.trim() || null);
      st.pos.push(s);
      step.checklist.forEach((item, c) => {
        ck.id.push(randomUUID());
        ck.step.push(stepId);
        ck.title.push(item);
        ck.pos.push(c);
      });
    });
  });

  await sql.transaction([
    sql`insert into roadmaps (id, user_id, title, summary, start_date, source_doc)
        values (${roadmapId}, ${userId}, ${title}, ${summary.trim() || null}, ${startDate}, ${sourceDoc})`,
    sql`insert into roadmap_phases (id, roadmap_id, title, position)
        select id, ${roadmapId}, title, pos from unnest(${ph.id}::uuid[], ${ph.title}::text[], ${ph.pos}::smallint[]) as t(id, title, pos)`,
    sql`insert into roadmap_steps (id, phase_id, title, description, target_date, planned_minutes, source_ref, position)
        select * from unnest(${st.id}::uuid[], ${st.phase}::uuid[], ${st.title}::text[], ${st.description}::text[],
                             ${st.target}::date[], ${st.minutes}::int[], ${st.ref}::text[], ${st.pos}::smallint[])`,
    sql`insert into roadmap_checklist_items (id, step_id, title, position)
        select * from unnest(${ck.id}::uuid[], ${ck.step}::uuid[], ${ck.title}::text[], ${ck.pos}::smallint[])`,
  ]);
  revalidatePath("/", "layout");
  redirect(`/roadmaps/${roadmapId}`);
}

export async function setStepStatus(stepId: string, status: "not_started" | "in_progress" | "done") {
  const userId = await requireUserId();
  await sql`
    update roadmap_steps s set status = ${status}
    from roadmap_phases ph, roadmaps r
    where s.id = ${stepId} and ph.id = s.phase_id and r.id = ph.roadmap_id and r.user_id = ${userId}
  `;
  revalidatePath("/", "layout");
}

export async function toggleChecklistItem(itemId: string) {
  const { userId, today } = await requireToday();
  // Ticking an item on a step you haven't started marks the step in progress.
  await sql.transaction([
    sql`
      update roadmap_checklist_items c set done_on = case when c.done_on is null then ${today}::date else null end
      from roadmap_steps s, roadmap_phases ph, roadmaps r
      where c.id = ${itemId} and s.id = c.step_id and ph.id = s.phase_id and r.id = ph.roadmap_id and r.user_id = ${userId}
    `,
    sql`
      update roadmap_steps s set status = 'in_progress'
      from roadmap_checklist_items c, roadmap_phases ph, roadmaps r
      where c.id = ${itemId} and c.done_on is not null and s.id = c.step_id and s.status = 'not_started'
        and ph.id = s.phase_id and r.id = ph.roadmap_id and r.user_id = ${userId}
    `,
  ]);
  revalidatePath("/", "layout");
}

export async function deleteRoadmap(roadmapId: string) {
  const userId = await requireUserId();
  await sql`delete from roadmaps where id = ${roadmapId} and user_id = ${userId}`;
  revalidatePath("/", "layout");
  redirect("/roadmaps");
}
