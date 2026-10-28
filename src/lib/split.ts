import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { addDays, formatDay } from "./dates";
import type { Category, ChecklistItem, OpenItem, Project, RoadmapStep } from "./data";

const MODEL = "claude-opus-5-5";

export const ProposalSchema = z.object({
  items: z.array(
    z.object({
      kind: z.enum(["done", "todo", "event"]),
      title: z.string(),
      category: z.string(),
      tags: z.array(z.string()),
      duration_minutes: z.number().nullable(),
      due_date: z.string().nullable(),
      project_id: z.string().nullable(),
      new_project_name: z.string().nullable(),
      roadmap_step_id: z.string().nullable(),
      checklist_item_ids: z.array(z.string()),
      closes_open_item_ids: z.array(z.string()),
      updates_open_item_id: z.string().nullable(),
    }),
  ),
  step_status_changes: z.array(
    z.object({
      step_id: z.string(),
      new_status: z.enum(["in_progress", "done"]),
      reason: z.string(),
    }),
  ),
});

export type Proposal = z.infer<typeof ProposalSchema>;

export type SplitContext = {
  entryDate: string;
  categories: Category[];
  tags: string[];
  projects: Project[];
  openItems: OpenItem[];
  steps: RoadmapStep[];
  checklist: ChecklistItem[];
};

// Stable instructions first so they are served from the prompt cache.
const SYSTEM = `You turn a person's end-of-day log into structured items for their personal timeline tracker.

The log is written quickly and informally, often as one long sentence. Split it into separate items, one per distinct activity, plan, or upcoming event.

For each item decide:
- kind:
  - "done": something they did or finished on the entry date.
  - "todo": something still to do ("testing is required", "I have to prepare", "need to fix").
  - "event": a dated happening involving others, such as a meeting, demo, call or interview ("tomorrow I have a demo").
  If one phrase contains both a finished part and a remaining part ("made it complete, now only testing is required"), make two items.
- title: a short, clear line in the person's own terms. Past tense for done items, imperative for todos, a plain noun phrase for events. Keep names exactly (product names, people, companies). Do not add facts that are not in the log.
- category: exactly one name from the provided category list.
- tags: 1 to 3 lowercase kebab-case tags. Reuse an existing tag whenever one fits (match meaning, not just spelling). Only invent a tag when nothing existing fits.
- duration_minutes: only if the log states or clearly implies a duration ("2 hours", "30 min"). Otherwise null. Never guess.
- due_date: for todos and events, the YYYY-MM-DD date if one is stated or implied ("tomorrow", "on Friday"), resolved relative to the entry date. Preparation for a dated event is due on the day of that event. Otherwise null. Always null for done items.
- project_id: the id of an existing project this item is about, matching by name case-insensitively. null if none.
- new_project_name: if the item is clearly about a named project, product or client engagement that is not in the project list, its name as written (e.g. "devlog-cli"). Use the same spelling for every item about it. Otherwise null. Never set both project_id and new_project_name. A person's day job is not a new project unless they name it.
- roadmap_step_id: the id of a roadmap step only when the item clearly works on that step. Most items match no step; use null then.
- checklist_item_ids: ids of checklist items this done item clearly completes. Empty for todos and events.
- closes_open_item_ids: ids of open todos or events this done item clearly completes or that have clearly happened. Only close when the log makes that plain.
- updates_open_item_id: for todos and events only. When the log changes something that is already an open item (postponed, rescheduled, moved to another time or day, renamed, more details given) rather than introducing a new one, return that open item's id here. The item then replaces the open one instead of being added again, so give its full new title, due_date, category, tags and project, not just the change. When an event is postponed, also update any open todo that prepares for it, so its due date moves with the event. Never point two items at the same open item. null when the item is new. Always null for done items.

Also return step_status_changes: suggest "in_progress" when work starts on a step that has not started, and "done" only when the log says the step is finished. Give a short reason. Usually this list is empty.

The person will review everything before it is saved, so prefer leaving a field empty over guessing.`;

function contextBlock(ctx: SplitContext): string {
  const tomorrow = addDays(ctx.entryDate, 1);
  return JSON.stringify(
    {
      entry_date: `${ctx.entryDate} (${formatDay(ctx.entryDate)})`,
      tomorrow: `${tomorrow} (${formatDay(tomorrow)})`,
      categories: ctx.categories.map((c) => c.name),
      existing_tags: ctx.tags,
      projects: ctx.projects.map((p) => ({ id: p.id, name: p.name, status: p.status })),
      open_items: ctx.openItems.map((i) => ({
        id: i.id,
        kind: i.kind,
        title: i.title,
        due_date: i.due_date,
        project: i.project_name,
      })),
      roadmap_steps: ctx.steps.map((s) => ({ id: s.id, roadmap: s.roadmap, phase: s.phase, step: s.title, status: s.status })),
      checklist_items: ctx.checklist.map((c) => ({ id: c.id, step_id: c.step_id, title: c.title })),
    },
    null,
    2,
  );
}

// badKey: Claude rejected the API key, so the caller can ask for a new one.
export class SplitError extends Error {
  constructor(message: string, readonly badKey = false) {
    super(message);
  }
}

export async function splitLog(text: string, ctx: SplitContext, apiKey: string): Promise<Proposal> {
  const client = new Anthropic({ apiKey });
  let response;
  try {
    response = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: betaZodOutputFormat(ProposalSchema) },
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [
        {
          role: "user",
          content: `<context>\n${contextBlock(ctx)}\n</context>\n\n<log>\n${text}\n</log>`,
        },
      ],
    });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      throw new SplitError("Claude rejected the API key. Check that it's correct and still active.", true);
    }
    if (error instanceof Anthropic.RateLimitError) {
      throw new SplitError("Claude is rate limited right now. Try again in a minute.");
    }
    if (error instanceof Anthropic.APIError) {
      throw new SplitError(`Claude API error (${error.status}): ${error.message}`);
    }
    throw error;
  }

  if (response.stop_reason === "refusal") {
    throw new SplitError("Claude declined to process this log. Try rewording it.");
  }
  if (response.stop_reason === "max_tokens" || !response.parsed_output) {
    throw new SplitError("Claude's reply was incomplete. Try again.");
  }
  return sanitize(response.parsed_output, ctx);
}

// Drop anything that doesn't point at the user's real data.
function sanitize(proposal: Proposal, ctx: SplitContext): Proposal {
  const categoryByLower = new Map(ctx.categories.map((c) => [c.name.toLowerCase(), c.name]));
  const projectIds = new Set(ctx.projects.map((p) => p.id));
  const openIds = new Set(ctx.openItems.map((i) => i.id));
  const stepIds = new Set(ctx.steps.map((s) => s.id));
  const checklistIds = new Set(ctx.checklist.map((c) => c.id));
  const isDate = (d: string | null) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null);
  // Each open item can be replaced by at most one new item.
  const claimed = new Set<string>();
  const claimUpdate = (item: Proposal["items"][number]) => {
    const id = item.updates_open_item_id;
    if (item.kind === "done" || !id || !openIds.has(id) || claimed.has(id)) return null;
    claimed.add(id);
    return id;
  };

  return {
    items: proposal.items.map((item) => ({
      ...item,
      category: categoryByLower.get(item.category.toLowerCase()) ?? "Personal",
      tags: [...new Set(item.tags.map((t) => t.trim().toLowerCase().replace(/^#/, "").replace(/\s+/g, "-")).filter(Boolean))].slice(0, 3),
      duration_minutes: item.duration_minutes && item.duration_minutes > 0 ? Math.round(item.duration_minutes) : null,
      due_date: item.kind === "done" ? null : isDate(item.due_date),
      project_id: item.project_id && projectIds.has(item.project_id) ? item.project_id : null,
      new_project_name: item.project_id && projectIds.has(item.project_id) ? null : item.new_project_name?.trim() || null,
      roadmap_step_id: item.roadmap_step_id && stepIds.has(item.roadmap_step_id) ? item.roadmap_step_id : null,
      checklist_item_ids: item.checklist_item_ids.filter((id) => checklistIds.has(id)),
      closes_open_item_ids: item.closes_open_item_ids.filter((id) => openIds.has(id)),
      updates_open_item_id: claimUpdate(item),
    })),
    step_status_changes: proposal.step_status_changes.filter((c) => stepIds.has(c.step_id)),
  };
}
