import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

const MODEL = "claude-opus-5-5";

export const RoadmapProposalSchema = z.object({
  title: z.string(),
  summary: z.string(),
  phases: z.array(
    z.object({
      title: z.string(),
      steps: z.array(
        z.object({
          title: z.string(),
          description: z.string().nullable(),
          planned_minutes: z.number().nullable(),
          week: z.number(),
          checklist: z.array(z.string()),
          source_ref: z.string().nullable(),
        }),
      ),
    }),
  ),
});

export type RoadmapProposal = z.infer<typeof RoadmapProposalSchema>;

export type RoadmapSource = { kind: "text"; text: string } | { kind: "pdf"; name: string; base64: string };

const SYSTEM = `You turn a long planning document (a study guide, playbook, course outline, launch plan) into a structured roadmap the person will work through and track day by day.

Structure:
- phases: the document's top-level stages, in the order the person should do them. Use the document's own grouping (parts, sections, months, tracks). Usually 3 to 10 phases.
- steps: inside each phase, concrete units of work a person can start and finish: a topic to study, a skill to practise, a project to build, a deliverable. Usually 3 to 12 per phase. Title each step as a short action or topic in the document's terms ("Arrays and hashing", "Build a RAG pipeline", "Mock system design interview").
- description: one or two sentences on what the step involves and what "done" looks like, taken from the document. null if the document says nothing beyond the title.
- checklist: specific sub-items the document lists for the step: named problems, subtopics, questions to prepare, resources to finish, deliverables. Keep each one short. At most 15 per step. Empty when the document lists none. Do not pad.
- planned_minutes: the time the document estimates for the step ("2 hours", "3 days at 2 hrs/day" = 360). If the document gives time for a whole phase or week, split it sensibly across its steps. null when the document gives no estimate.
- week: the 1-based week by which the step should be finished, counted from the start date. Follow the document's timeline when it has one ("Week 3", "Month 2" = weeks 5 to 8, "Days 1-14"). When it has none, lay the steps out in order at a realistic pace for someone working on this alongside a job, so later steps never come before earlier ones.
- source_ref: the heading or section of the document the step comes from, so the person can find it again. null if unclear.

Also return a short title for the roadmap (the document's own name if it has one) and a one or two sentence summary of the goal.

Rules:
- Keep everything that is actionable; leave out background reading, motivation and commentary unless the document asks the person to do it.
- Never invent topics, problems or estimates the document does not contain. Prefer an empty field over a guess.
- Keep names, technologies and problem titles exactly as written.
- The person will review and edit the roadmap before saving.`;

// badKey: Claude rejected the API key, so the caller can ask for a new one.
export class RoadmapError extends Error {
  constructor(message: string, readonly badKey = false) {
    super(message);
  }
}

export async function extractRoadmap(source: RoadmapSource, startDate: string, apiKey: string): Promise<RoadmapProposal> {
  const client = new Anthropic({ apiKey });

  const intro = `Start date: ${startDate}. Build the roadmap from the document below.`;
  const content: Anthropic.Beta.BetaContentBlockParam[] =
    source.kind === "pdf"
      ? [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data: source.base64 }, title: source.name },
          { type: "text", text: intro },
        ]
      : [{ type: "text", text: `${intro}\n\n<document>\n${source.text}\n</document>` }];

  let message;
  try {
    // Long documents produce long output, so stream to avoid request timeouts.
    const stream = client.beta.messages.stream({
      model: MODEL,
      max_tokens: 64000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: betaZodOutputFormat(RoadmapProposalSchema) },
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content }],
    });
    message = await stream.finalMessage();
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      throw new RoadmapError("Claude rejected the API key. Check that it's correct and still active.", true);
    }
    if (error instanceof Anthropic.RateLimitError) {
      throw new RoadmapError("Claude is rate limited right now. Try again in a minute.");
    }
    if (error instanceof Anthropic.APIError) {
      throw new RoadmapError(`Claude API error (${error.status}): ${error.message}`);
    }
    throw error;
  }

  if (message.stop_reason === "refusal") {
    throw new RoadmapError("Claude declined to process this document.");
  }
  if (message.stop_reason === "max_tokens" || !message.parsed_output) {
    throw new RoadmapError("The roadmap came out too long to finish. Try splitting the document into two roadmaps.");
  }
  return sanitize(message.parsed_output);
}

function sanitize(p: RoadmapProposal): RoadmapProposal {
  const clean = (s: string) => s.trim().slice(0, 300);
  let lastWeek = 1;
  return {
    title: clean(p.title) || "Untitled roadmap",
    summary: p.summary.trim().slice(0, 1000),
    phases: p.phases
      .map((phase) => ({
        title: clean(phase.title),
        steps: phase.steps
          .filter((s) => s.title.trim())
          .map((s) => {
            // Weeks never go backwards, so target dates stay in order.
            lastWeek = Math.max(lastWeek, Math.min(520, Math.round(s.week) || lastWeek));
            return {
              title: clean(s.title),
              description: s.description?.trim().slice(0, 1000) || null,
              planned_minutes: s.planned_minutes && s.planned_minutes > 0 ? Math.round(s.planned_minutes) : null,
              week: lastWeek,
              checklist: s.checklist.map(clean).filter(Boolean).slice(0, 25),
              source_ref: s.source_ref?.trim().slice(0, 200) || null,
            };
          }),
      }))
      .filter((phase) => phase.title && phase.steps.length),
  };
}
