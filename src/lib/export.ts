import "server-only";
import { getItems, getLoggedDays, getProjects } from "./data";
import { addDays, isIsoDate } from "./dates";
import { buildMarkdown } from "./markdown";

export type ExportParams = { from?: string; to?: string; category?: string; tag?: string; project?: string };

// Shared by the export page preview and the download route.
export async function buildExport(userId: string, today: string, params: ExportParams) {
  let from = params.from && isIsoDate(params.from) ? params.from : addDays(today, -6);
  let to = params.to && isIsoDate(params.to) ? params.to : today;
  if (from > to) [from, to] = [to, from];

  const projects = await getProjects(userId);
  const project = projects.find((p) => p.id === params.project);
  const filters = {
    category: params.category || undefined,
    tag: params.tag?.replace(/^#/, "").toLowerCase() || undefined,
    projectId: project?.id,
  };
  const [items, loggedDays] = await Promise.all([getItems(userId, from, to, filters), getLoggedDays(userId)]);

  const labels = [filters.category && `category ${filters.category}`, filters.tag && `#${filters.tag}`, project && `project ${project.name}`].filter(Boolean);
  const markdown = buildMarkdown({ from, to, today, items, loggedDays, filterLabel: labels.join(", ") || undefined });
  return { markdown, from, to, today, projects, filename: `timeline_${from}_to_${to}.md` };
}
