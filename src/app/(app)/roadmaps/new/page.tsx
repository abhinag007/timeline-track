import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import RoadmapComposer from "@/components/RoadmapComposer";
import { PageHeader } from "@/components/ui";
import { requireToday } from "@/lib/session";

export default async function NewRoadmapPage() {
  const { today } = await requireToday();

  return (
    <div className="space-y-8">
      <div>
        <Link href="/roadmaps" className="btn-ghost -ml-2.5 mb-4">
          <ArrowLeft className="size-4" />
          Roadmaps
        </Link>
        <PageHeader
          title="New roadmap"
          description="Give Claude your whole plan. It splits it into phases, steps and checklists, plans the time and dates, and lets you edit everything before saving."
        />
      </div>
      <RoadmapComposer today={today} />
    </div>
  );
}
